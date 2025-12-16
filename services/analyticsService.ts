
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, auth } from './firebase';
import { AnalyticsEvent } from '../types';

const COLLECTION_NAME = 'analytics_events';
const VISITOR_KEY = 'skinos_visitor_id';
const SESSION_KEY = 'skinos_session_id';

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
        details,
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

// --- ADMIN DASHBOARD DATA FETCHER ---
export const getAnalyticsSummary = async (days: number = 7) => {
    if (!db) {
        console.error("Cannot fetch analytics: DB not initialized");
        return null;
    }

    const startDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    try {
        const q = query(
            collection(db, COLLECTION_NAME), 
            orderBy('timestamp', 'desc'), 
            limit(2000) 
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            return {
                totalEvents: 0,
                uniqueVisitors: 0,
                registeredUsers: 0,
                totalTokens: 0,
                estimatedCost: 0,
                topFeatures: [],
                recentLog: [],
                userTable: [],
                chartData: [],
                allEvents: []
            };
        }

        const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AnalyticsEvent & { sessionId?: string }));
        
        // Filter by date range
        const recentEvents = events.filter(e => e.timestamp > startDate);

        // Aggregation Logic
        const uniqueVisitors = new Set(recentEvents.map(e => e.visitorId));
        const uniqueUsers = new Set(recentEvents.filter(e => e.userId).map(e => e.userId));
        
        let totalTokens = 0;
        let featureCounts: Record<string, number> = {};
        let dailyTraffic: Record<string, number> = {};
        
        // Enhanced User Tracking (aggregates by User OR Visitor ID)
        // Key = UserID (if exists) OR VisitorID
        let userUsage: Record<string, { 
            identity: string,
            isRegistered: boolean,
            tokens: number, 
            sessions: Set<string>,
            lastSeen: number, 
            actions: number,
            lastAction: string,
            email?: string
        }> = {};

        recentEvents.forEach(e => {
            // Token Sum
            if (e.tokens) totalTokens += e.tokens;
            
            // Feature Popularity
            if (e.type === 'VIEW') {
                featureCounts[e.name] = (featureCounts[e.name] || 0) + 1;
            }

            // Daily Stats for Chart
            const dateKey = new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            dailyTraffic[dateKey] = (dailyTraffic[dateKey] || 0) + 1;

            // User Profiling
            // If logged in, prioritize UserID as key. If guest, use VisitorID.
            // Note: In a real app, you might want to merge Visitor data into User data upon login. 
            // Here we treat them based on the event's context.
            const key = e.userId || e.visitorId;
            
            if (!userUsage[key]) {
                userUsage[key] = { 
                    identity: key,
                    isRegistered: !!e.userId,
                    tokens: 0, 
                    sessions: new Set(),
                    lastSeen: 0, 
                    actions: 0,
                    lastAction: ''
                };
            }
            
            userUsage[key].tokens += (e.tokens || 0);
            userUsage[key].actions += 1;
            userUsage[key].lastAction = e.name;
            if (e.sessionId) userUsage[key].sessions.add(e.sessionId);
            
            // Update timestamps
            if (e.timestamp > userUsage[key].lastSeen) userUsage[key].lastSeen = e.timestamp;
            
            // Upgrade status if they logged in later in the stream
            if (e.userId && !userUsage[key].isRegistered) {
                userUsage[key].isRegistered = true;
                userUsage[key].identity = e.userId; 
            }
        });

        // Convert Map to Array & Calculate Derived Metrics
        const sortedUsers = Object.values(userUsage)
            .map(u => {
                const sessionCount = u.sessions.size || 1;
                // Cost Calculation:
                // Gemini 1.5 Flash is approx $0.35 / 1M input tokens. 
                // Let's assume a blended rate (input + output) of roughly RM 2.50 per 1M tokens.
                const cost = (u.tokens / 1000000) * 2.50; 
                
                return { 
                    ...u, 
                    sessionCount,
                    avgTokensPerSession: Math.round(u.tokens / sessionCount),
                    estimatedCost: cost
                };
            })
            .sort((a, b) => b.tokens - a.tokens); // Sort by highest token usage first

        const chartData = Object.entries(dailyTraffic).map(([date, count]) => ({ date, count }));

        return {
            totalEvents: recentEvents.length,
            uniqueVisitors: uniqueVisitors.size,
            registeredUsers: uniqueUsers.size,
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
        if (e.code === 'permission-denied') {
            throw new Error("PERMISSION_DENIED");
        }
        return null;
    }
};
