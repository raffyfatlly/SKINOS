
import { collection, addDoc, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from './firebase';
import { AnalyticsEvent } from '../types';

const COLLECTION_NAME = 'analytics_events';
const VISITOR_KEY = 'skinos_visitor_id';

// --- VISITOR IDENTIFICATION ---
export const getVisitorId = (): string => {
    let vid = localStorage.getItem(VISITOR_KEY);
    if (!vid) {
        vid = 'v_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        localStorage.setItem(VISITOR_KEY, vid);
    }
    return vid;
};

// --- CORE TRACKING ---
export const trackEvent = async (
    type: AnalyticsEvent['type'], 
    name: string, 
    details: Record<string, any> = {}, 
    userId?: string
) => {
    const event: AnalyticsEvent = {
        type,
        name,
        visitorId: getVisitorId(),
        userId: userId || undefined,
        timestamp: Date.now(),
        details,
        tokens: details.tokens || 0
    };

    console.log(`[Analytics] ${type}: ${name}`, event);

    if (db) {
        try {
            await addDoc(collection(db, COLLECTION_NAME), event);
        } catch (e) {
            // Silently fail in production to not block UI, log in dev
            console.warn("Analytics push failed", e);
        }
    }
};

// --- TOKEN ESTIMATION ---
export const estimateTokens = (inputText: string, outputText: string = ''): number => {
    // Rough estimation: 1 token ~= 4 characters
    return Math.ceil((inputText.length + outputText.length) / 4);
};

// --- ADMIN DASHBOARD DATA FETCHER ---
export const getAnalyticsSummary = async (days: number = 7) => {
    if (!db) return null;

    const startDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    // In a real production app with millions of records, you'd use Aggregate Queries 
    // or BigQuery. For this scale, client-side aggregation of the last 2000 events is fine for MVP.
    
    try {
        const q = query(
            collection(db, COLLECTION_NAME), 
            orderBy('timestamp', 'desc'), 
            limit(2000) 
        );
        
        const snapshot = await getDocs(q);
        const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AnalyticsEvent));
        
        // Filter by date range
        const recentEvents = events.filter(e => e.timestamp > startDate);

        // Aggregation Logic
        const uniqueVisitors = new Set(recentEvents.map(e => e.visitorId));
        const uniqueUsers = new Set(recentEvents.filter(e => e.userId).map(e => e.userId));
        
        let totalTokens = 0;
        let featureCounts: Record<string, number> = {};
        let dailyTraffic: Record<string, number> = {};
        
        let visitorUsage: Record<string, { 
            tokens: number, 
            lastSeen: number, 
            isUser: boolean, 
            actions: number,
            userId?: string,
            firstSeen: number
        }> = {};

        recentEvents.forEach(e => {
            // Token Sum
            if (e.tokens) totalTokens += e.tokens;
            
            // Feature Popularity
            if (e.type === 'VIEW') {
                featureCounts[e.name] = (featureCounts[e.name] || 0) + 1;
            }

            // Daily Stats for Chart
            const dateKey = new Date(e.timestamp).toLocaleDateString();
            dailyTraffic[dateKey] = (dailyTraffic[dateKey] || 0) + 1;

            // User Profiling
            const vid = e.visitorId;
            if (!visitorUsage[vid]) {
                visitorUsage[vid] = { 
                    tokens: 0, 
                    lastSeen: 0, 
                    isUser: !!e.userId, 
                    actions: 0,
                    userId: e.userId,
                    firstSeen: e.timestamp
                };
            }
            
            visitorUsage[vid].tokens += (e.tokens || 0);
            visitorUsage[vid].actions += 1;
            
            // Update timestamps
            if (e.timestamp > visitorUsage[vid].lastSeen) visitorUsage[vid].lastSeen = e.timestamp;
            if (e.timestamp < visitorUsage[vid].firstSeen) visitorUsage[vid].firstSeen = e.timestamp;
            
            // Update User Status if they logged in later in the stream
            if (e.userId && !visitorUsage[vid].isUser) {
                visitorUsage[vid].isUser = true;
                visitorUsage[vid].userId = e.userId;
            }
        });

        const sortedUsers = Object.entries(visitorUsage)
            .map(([vid, data]) => ({ vid, ...data }))
            .sort((a, b) => b.lastSeen - a.lastSeen);

        const chartData = Object.entries(dailyTraffic).map(([date, count]) => ({ date, count }));

        return {
            totalEvents: recentEvents.length,
            uniqueVisitors: uniqueVisitors.size,
            registeredUsers: uniqueUsers.size,
            totalTokens,
            // COST IN RM: Approx RM 2.50 per 1M tokens (Blended rate for Gemini Flash/Pro)
            estimatedCost: (totalTokens / 1000000) * 2.50, 
            topFeatures: Object.entries(featureCounts).sort((a,b) => b[1] - a[1]),
            recentLog: recentEvents.slice(0, 50),
            userTable: sortedUsers,
            chartData: chartData,
            allEvents: recentEvents // Return all for client-side drill-down
        };

    } catch (e) {
        console.error("Failed to fetch analytics", e);
        return null;
    }
};
