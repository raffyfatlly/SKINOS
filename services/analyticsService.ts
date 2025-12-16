
import { collection, addDoc, getDocs, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { AnalyticsEvent } from '../types';

const COLLECTION_NAME = 'analytics_events';
const VISITOR_KEY = 'skinos_visitor_id';
const SESSION_KEY = 'skinos_session_id';

// Define Admins to exclude from analytics
const ADMIN_EMAILS = ['admin@skinos.ai', 'raf@admin.com'];

// --- IDENTITY MANAGEMENT ---

// 1. Visitor ID (Persistent Device ID)
export const getVisitorId = (): string => {
    let vid = localStorage.getItem(VISITOR_KEY);
    if (!vid) {
        vid = 'v_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        localStorage.setItem(VISITOR_KEY, vid);
    }
    return vid;
};

// 2. Session ID (Ephemeral, resets on tab close/new visit)
export const getSessionId = (): string => {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
        sid = 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
};

// --- CORE TRACKING ---
export const trackEvent = async (
    type: AnalyticsEvent['type'], 
    name: string, 
    details: Record<string, any> = {}, 
    explicitUserId?: string
) => {
    // Auto-detect User ID from Firebase Auth if not explicitly passed
    const finalUserId = explicitUserId || auth?.currentUser?.uid || undefined;
    const visitorId = getVisitorId();
    const sessionId = getSessionId();

    const event: AnalyticsEvent & { sessionId: string } = {
        type,
        name,
        visitorId,
        sessionId,
        userId: finalUserId,
        timestamp: Date.now(),
        details: {
            ...details,
            userAgent: navigator.userAgent, // Capture device info
            path: window.location.pathname
        },
        tokens: details.tokens || 0
    };

    // Console Log for Devs
    console.log(`[Analytics] ${type}: ${name} | Tokens: ${event.tokens} | User: ${finalUserId || 'Guest'}`);

    if (db) {
        try {
            await addDoc(collection(db, COLLECTION_NAME), event);
        } catch (e: any) {
            // Detailed Error Handling for Database Setup
            if (e.code === 'permission-denied') {
                console.error("Analytics Error: Permission Denied. Go to Firebase Console > Firestore > Rules and allow 'create' on 'analytics_events'.");
            } else if (e.code === 'unavailable' || e.code === 'not-found') {
                console.warn("Analytics Error: Firestore not created. Go to Firebase Console > Build > Firestore Database > Create Database.");
            } else {
                console.warn("Analytics push failed", e);
            }
        }
    } else {
        console.debug("Analytics skipped: Firebase DB not initialized.");
    }
};

// --- TOKEN ESTIMATION ---
export const estimateTokens = (inputText: string, outputText: string = ''): number => {
    // Rough estimation: 1 token ~= 4 characters
    return Math.ceil((inputText.length + outputText.length) / 4);
};

// --- MOCK DATA GENERATOR (Fallback) ---
export const getMockAnalyticsSummary = () => {
    const mockUsers = Array.from({ length: 15 }).map((_, i) => ({
        identity: i % 3 === 0 ? `User_${i}` : `Visitor ${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
        isRegistered: i % 3 === 0,
        email: i % 3 === 0 ? `user${i}@example.com` : undefined,
        tokens: Math.floor(Math.random() * 50000),
        sessions: new Set(['s1']),
        sessionCount: Math.floor(Math.random() * 5) + 1,
        actions: Math.floor(Math.random() * 20) + 1,
        lastSeen: Date.now() - Math.floor(Math.random() * 86400000 * 3),
        estimatedCost: Math.random() * 0.5,
        history: []
    }));

    return {
        totalEvents: 1240,
        uniqueVisitors: 85,
        registeredUsers: 24,
        totalTokens: 450000,
        estimatedCost: 1.12,
        topFeatures: [['Face Scan', 150], ['Product Search', 120], ['Routine Builder', 80]],
        recentLog: Array.from({ length: 10 }).map((_, i) => ({
            type: ['VIEW', 'ACTION', 'AI_USAGE'][Math.floor(Math.random() * 3)],
            name: 'Mock_Event_' + i,
            timestamp: Date.now() - i * 60000,
            tokens: 100
        })),
        userTable: mockUsers,
        chartData: Array.from({ length: 7 }).map((_, i) => ({
            date: new Date(Date.now() - (6-i)*86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            count: Math.floor(Math.random() * 200) + 50
        })),
        allEvents: []
    };
};

// --- ADMIN DASHBOARD DATA FETCHER ---
export const getAnalyticsSummary = async (days: number = 7) => {
    if (!db) {
        console.error("Cannot fetch analytics: DB not initialized");
        throw new Error("DB_NOT_INITIALIZED");
    }

    const startDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    try {
        // 1. Fetch Events (Last 2000)
        const q = query(
            collection(db, COLLECTION_NAME), 
            orderBy('timestamp', 'desc'), 
            limit(2000) 
        );
        
        let eventSnapshot;
        try {
            eventSnapshot = await getDocs(q);
        } catch (e: any) {
            if (e.code === 'permission-denied') throw new Error("PERMISSION_DENIED");
            throw e;
        }
        
        // 2. Fetch ALL Registered Users & Identify Admins
        const registeredUsersMap = new Map<string, any>();
        const adminUids = new Set<string>();

        try {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                const profile = userData.profile || {};
                const email = profile.email || userData.email;
                
                // Identify Admins to filter out
                if (email && ADMIN_EMAILS.includes(email)) {
                    adminUids.add(doc.id);
                } else {
                    registeredUsersMap.set(doc.id, userData);
                }
            });
        } catch (e) {
            console.warn("Could not fetch full users list (likely permission restricted). Proceeding with analytics-only data.");
        }
        
        // Initial Defaults
        let totalTokens = 0;
        let featureCounts: Record<string, number> = {};
        let dailyTraffic: Record<string, number> = {};
        const uniqueVisitors = new Set<string>();

        // User Usage Map
        let userUsage: Record<string, { 
            identity: string,
            isRegistered: boolean,
            tokens: number, 
            sessions: Set<string>,
            firstSeen: number,
            lastSeen: number, 
            actions: number,
            lastAction: string,
            email?: string,
            originalUid?: string,
            history: any[]
        }> = {};

        // 3. Process Events
        const events = eventSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AnalyticsEvent & { sessionId?: string }));
        
        // Filter events: Date range AND Exclude Admins
        const recentEvents = events.filter(e => {
            if (e.timestamp <= startDate) return false;
            if (e.userId && adminUids.has(e.userId)) return false;
            return true;
        });

        recentEvents.forEach(e => {
            // Aggregates
            if (e.tokens) totalTokens += e.tokens;
            if (e.type === 'VIEW') featureCounts[e.name] = (featureCounts[e.name] || 0) + 1;
            const dateKey = new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            dailyTraffic[dateKey] = (dailyTraffic[dateKey] || 0) + 1;
            uniqueVisitors.add(e.visitorId);

            // User Profiling
            // IMPORTANT: Group by UserID if present, otherwise VisitorID
            const key = e.userId || e.visitorId;
            const isGuest = !e.userId;
            
            // Format Visitor ID to look nice (e.g., Visitor 8A2B)
            // If they are a user, use their UID initially (will be overwritten by name later)
            const shortVisitorId = e.visitorId ? e.visitorId.substring(2, 6).toUpperCase() : 'UNKNOWN';
            const guestIdentity = `Visitor ${shortVisitorId}`;

            if (!userUsage[key]) {
                userUsage[key] = { 
                    identity: isGuest ? guestIdentity : (e.userId || 'Unknown User'),
                    isRegistered: !isGuest,
                    originalUid: e.userId,
                    tokens: 0, 
                    sessions: new Set(),
                    firstSeen: e.timestamp,
                    lastSeen: e.timestamp, 
                    actions: 0,
                    lastAction: '',
                    history: []
                };
            }
            
            userUsage[key].tokens += (e.tokens || 0);
            userUsage[key].actions += 1;
            userUsage[key].lastAction = e.name;
            if (e.sessionId) userUsage[key].sessions.add(e.sessionId);
            
            if (e.timestamp > userUsage[key].lastSeen) userUsage[key].lastSeen = e.timestamp;
            if (e.timestamp < userUsage[key].firstSeen) userUsage[key].firstSeen = e.timestamp;
            
            if (userUsage[key].history.length < 50) {
                userUsage[key].history.push({
                    name: e.name,
                    type: e.type,
                    timestamp: e.timestamp,
                    tokens: e.tokens || 0,
                    details: e.details
                });
            }

            // Upgrade status if a guest performs a login action later in the stream
            if (e.userId && !userUsage[key].isRegistered) {
                userUsage[key].isRegistered = true;
                userUsage[key].identity = e.userId; 
                userUsage[key].originalUid = e.userId;
            }
        });

        // 4. Merge Real Users (Database Source of Truth)
        // This ensures we have names/emails for registered users, and adds users who haven't been active recently
        registeredUsersMap.forEach((userData, uid) => {
            const profile = userData.profile || {};
            const displayName = profile.name || uid;
            
            // ROBUST EMAIL EXTRACTION
            let email = profile.email || userData.email;
            if (!email && displayName && displayName.includes('@')) {
                email = displayName;
            }
            
            // CHECK ANONYMITY STATUS
            const isAnonymous = profile.isAnonymous === true;

            if (userUsage[uid]) {
                // User exists in event logs -> Update details
                // FIX: Don't just set true. Set based on DB profile.
                userUsage[uid].isRegistered = !isAnonymous;
                userUsage[uid].identity = isAnonymous ? `Visitor ${uid.substring(0,4)}` : displayName;
                if (email) userUsage[uid].email = email;
                userUsage[uid].originalUid = uid;
            } else {
                // User exists in DB but NO recent events -> Add them manually
                userUsage[uid] = {
                    identity: isAnonymous ? `Visitor ${uid.substring(0,4)}` : displayName,
                    email: email,
                    isRegistered: !isAnonymous,
                    originalUid: uid,
                    tokens: 0,
                    sessions: new Set(),
                    firstSeen: userData.lastUpdated || Date.now(),
                    lastSeen: userData.lastUpdated || Date.now(), // Might be old
                    actions: 0,
                    lastAction: 'Inactive',
                    history: []
                };
            }
        });

        // Convert Map to Array & Calculate Derived Metrics
        const sortedUsers = Object.values(userUsage)
            .map(u => {
                const sessionCount = u.sessions.size || 1;
                const cost = (u.tokens / 1000000) * 2.50; 
                
                return { 
                    ...u, 
                    sessionCount,
                    avgTokensPerSession: Math.round(u.tokens / sessionCount),
                    estimatedCost: cost,
                    history: u.history.sort((a: any, b: any) => b.timestamp - a.timestamp)
                };
            })
            // Sort by: Registered first, then by activity
            .sort((a, b) => {
                if (a.isRegistered && !b.isRegistered) return -1;
                if (!a.isRegistered && b.isRegistered) return 1;
                return b.lastSeen - a.lastSeen;
            });

        const chartData = Object.entries(dailyTraffic).map(([date, count]) => ({ date, count }));

        return {
            totalEvents: recentEvents.length,
            uniqueVisitors: uniqueVisitors.size,
            registeredUsers: registeredUsersMap.size > 0 ? registeredUsersMap.size : uniqueVisitors.size,
            totalTokens,
            estimatedCost: (totalTokens / 1000000) * 2.50, 
            topFeatures: Object.entries(featureCounts).sort((a,b) => b[1] - a[1]),
            recentLog: recentEvents.slice(0, 50),
            userTable: sortedUsers,
            chartData: chartData,
            allEvents: recentEvents 
        };

    } catch (e: any) {
        console.error("Failed to fetch analytics", e);
        if (e.message === 'PERMISSION_DENIED') {
            throw new Error("PERMISSION_DENIED");
        }
        return null;
    }
};
