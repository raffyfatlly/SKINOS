
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { SkinMetrics, Product, UserProfile, IngredientRisk, Benefit } from '../types';
import { trackEvent, estimateTokens } from './analyticsService';

// Initialize with the mandatory API Key structure
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/** 
 * --- GEMINI 3 FLASH (DECEMBER 2025 SPECS) ---
 * Model: gemini-3-flash-preview
 * Latency: thinkingBudget: 0 (Equivalent to 'low' thinking_level)
 */
const MODEL_NAME = 'gemini-3-flash-preview';

// Configuration optimized for sub-second Flash performance
const GEMINI_3_CONFIG = {
    // The SDK uses thinkingBudget. 0 disables heavy reasoning for maximum speed.
    thinkingConfig: { thinkingBudget: 0 }
};

/**
 * Enhanced interface for Gemini 3 state preservation
 */
export interface Gemini3Content {
    role: 'user' | 'model' | 'function';
    parts: {
        text?: string;
        inlineData?: { mimeType: string; data: string };
        functionCall?: { name: string; args: object };
        functionResponse?: { name: string; response: object };
        thoughtSignature?: string; // Mandatory for stateful tool loops in Gemini 3
    }[];
}

// --- HELPERS ---

const parseJSONFromText = (text: string): any => {
    try {
        const startObj = text.indexOf('{');
        const startArr = text.indexOf('[');
        let start = -1;
        let end = -1;
        let isArray = false;

        if (startObj !== -1 && (startArr === -1 || startObj < startArr)) {
            start = startObj;
            end = text.lastIndexOf('}');
        } else if (startArr !== -1) {
            start = startArr;
            end = text.lastIndexOf(']');
            isArray = true;
        }

        if (start === -1 || end === -1) return isArray ? [] : {};
        const jsonStr = text.substring(start, end + 1);
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Gemini JSON Parse Error:", e);
        return {};
    }
};

const runWithRetry = async <T>(fn: (ai: GoogleGenAI) => Promise<T>, fallback: T, timeoutMs: number = 30000): Promise<T> => {
    try {
        const timeoutPromise = new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs));
        return await Promise.race([fn(ai), timeoutPromise]);
    } catch (e: any) {
        console.error("Gemini 3 Error Status:", e?.status || 'Unknown');
        console.error("Gemini 3 Error Message:", e?.message || String(e));
        
        // Tracking for Admin Dashboard visibility
        trackEvent('ERROR', 'GEMINI_FAILURE', { 
            error: e?.message || String(e),
            status: e?.status 
        });
        
        return fallback;
    }
};

const getFallbackProduct = (userMetrics: SkinMetrics, name: string): Product => ({
    id: Date.now().toString(),
    name: name,
    brand: "Unknown",
    type: "UNKNOWN",
    ingredients: [],
    dateScanned: Date.now(),
    risks: [],
    benefits: [],
    suitabilityScore: 50
});

// --- EXPORTED FUNCTIONS ---

export const searchProducts = async (query: string): Promise<{ name: string, brand: string }[]> => {
    return runWithRetry<{ name: string, brand: string }[]>(async (ai) => {
        const prompt = `User Query: "${query}". Return a JSON list of 5-10 specific products. Format: [{"brand": "string", "name": "string"}]`;
        
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: { 
                ...GEMINI_3_CONFIG,
                responseMimeType: 'application/json' 
            }
        });
        
        const tokens = estimateTokens(prompt, response.text || '');
        trackEvent('AI_USAGE', 'SEARCH_PRODUCTS', { query, tokens });

        const res = parseJSONFromText(response.text || "[]");
        return Array.isArray(res) ? res : [res].filter(x => x.name);
    }, [{ name: query, brand: "Generic" }]);
};

export const analyzeFaceSkin = async (image: string, localMetrics: SkinMetrics, history?: SkinMetrics[]): Promise<SkinMetrics> => {
    return runWithRetry<SkinMetrics>(async (ai) => {
        const prompt = `Analyze skin from image. Current biometrics: ${JSON.stringify(localMetrics)}. Output full SkinMetrics JSON.`;
        
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: image.split(',')[1] } },
                    { text: prompt }
                ]
            },
            config: { 
                ...GEMINI_3_CONFIG,
                responseMimeType: 'application/json'
            }
        });
        
        const tokens = estimateTokens(prompt, response.text || '') + 258;
        trackEvent('AI_USAGE', 'FACE_ANALYSIS', { tokens });

        const data = parseJSONFromText(response.text || "{}");
        return { ...localMetrics, ...data, timestamp: Date.now() };
    }, localMetrics);
};

export const analyzeProductFromSearch = async (productName: string, userMetrics: SkinMetrics, consistencyScore?: number, knownBrand?: string): Promise<Product> => {
    return runWithRetry<Product>(async (ai) => {
        const prompt = `Analyze "${productName}" for skin: ${JSON.stringify(userMetrics)}. Output Product JSON.`;

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                 ...GEMINI_3_CONFIG,
                 responseMimeType: 'application/json'
            }
        });

        const tokens = estimateTokens(prompt, response.text || '');
        trackEvent('AI_USAGE', 'PRODUCT_ANALYSIS_TEXT', { productName, tokens });

        const data = parseJSONFromText(response.text || "{}");
        return {
            id: Date.now().toString(),
            name: data.name || productName,
            brand: data.brand || knownBrand || "Unknown",
            type: data.type || "UNKNOWN",
            ingredients: data.ingredients || [],
            estimatedPrice: data.estimatedPrice || 0,
            suitabilityScore: data.suitabilityScore || 50,
            risks: data.risks || [],
            benefits: data.benefits || [],
            dateScanned: Date.now()
        };
    }, getFallbackProduct(userMetrics, productName), 45000); 
};

export const analyzeProductImage = async (base64: string, userMetrics: SkinMetrics): Promise<Product> => {
    return runWithRetry<Product>(async (ai) => {
        const visionPrompt = `Identify product and ingredients from image. Output Product JSON.`;

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64.split(',')[1] } },
                    { text: visionPrompt }
                ]
            },
            config: { 
                ...GEMINI_3_CONFIG,
                responseMimeType: 'application/json' 
            }
        });

        const data = parseJSONFromText(response.text || "{}");
        
        return {
            id: Date.now().toString(),
            name: data.name || "Scanned Product",
            brand: data.brand || "Unknown",
            type: data.type || "UNKNOWN",
            ingredients: data.ingredients || [],
            estimatedPrice: data.estimatedPrice || 0,
            suitabilityScore: data.suitabilityScore || 50,
            risks: data.risks || [],
            benefits: data.benefits || [],
            dateScanned: Date.now()
        };
    }, getFallbackProduct(userMetrics, "Scanned Product"), 60000); 
};

export const createDermatologistSession = (user: UserProfile, shelf: Product[]): Chat => {
    trackEvent('ACTION', 'AI_DERM_CONSULT', { shelfSize: shelf.length });
    return ai.chats.create({
        model: MODEL_NAME,
        config: {
             ...GEMINI_3_CONFIG,
             systemInstruction: `You are an expert dermatologist. User metrics: ${JSON.stringify(user.biometrics)}. Shelf: ${JSON.stringify(shelf.map(p => p.name))}.`
        }
    });
};

export const isQuotaError = (e: any) => {
    return e?.message?.includes('429') || e?.status === 429;
};

// Pure logic functions (No API calls)
export const auditProduct = (product: Product, user: UserProfile) => {
    const warnings = product.risks.map(r => ({ 
        severity: r.riskLevel === 'HIGH' ? 'CRITICAL' : 'CAUTION', 
        reason: r.reason 
    }));
    let adjustedScore = product.suitabilityScore;
    if (user.biometrics.redness < 50 && warnings.length > 0) adjustedScore -= 10;
    return {
        adjustedScore: Math.max(0, Math.min(100, adjustedScore)),
        warnings,
        analysisReason: warnings.length > 0 ? warnings[0].reason : "Good formulation match."
    };
};

export const analyzeShelfHealth = (products: Product[], user: UserProfile) => {
    const types = new Set(products.map(p => p.type));
    const missing = [];
    if (!types.has('CLEANSER')) missing.push('Cleanser');
    if (!types.has('SPF')) missing.push('SPF');
    if (!types.has('MOISTURIZER')) missing.push('Moisturizer');

    const avgScore = products.length > 0 ? products.reduce((acc, p) => acc + p.suitabilityScore, 0) / products.length : 0;
    let grade = 'C';
    if (avgScore > 85 && missing.length === 0) grade = 'S';
    else if (avgScore > 75) grade = 'A';

    return {
        analysis: {
            grade,
            conflicts: [],
            riskyProducts: [],
            missing,
            redundancies: [],
            upgrades: [],
            balance: { 
                exfoliation: 50, 
                hydration: products.some(p => p.type === 'MOISTURIZER') ? 80 : 30, 
                protection: products.some(p => p.type === 'SPF') ? 90 : 20, 
                treatment: 70 
            }
        }
    };
};

export const analyzeProductContext = (product: Product, shelf: Product[]) => {
    return { conflicts: [], typeCount: shelf.filter(p => p.type === product.type && p.id !== product.id).length };
};

export const getClinicalTreatmentSuggestions = (user: UserProfile) => {
    return [{ type: 'FACIAL', name: 'Deep Pore Cleanse', benefit: 'Clears active congestion', downtime: 'None' }].slice(0, 3);
};

export const getBuyingDecision = (product: Product, shelf: Product[], user: UserProfile) => {
    const audit = auditProduct(product, user);
    let decision = 'CONSIDER';
    let color = 'zinc';
    if (audit.adjustedScore > 85 && audit.warnings.length === 0) { decision = 'BUY'; color = 'emerald'; }
    else if (audit.adjustedScore < 40) { decision = 'AVOID'; color = 'rose'; }
    const context = analyzeProductContext(product, shelf);
    return {
        verdict: { decision, title: decision, description: audit.analysisReason, color },
        audit,
        shelfConflicts: context.conflicts, 
        comparison: { result: audit.adjustedScore > 70 ? 'BETTER' : 'NEUTRAL' }
    };
};

export const generateRoutineRecommendations = async (user: UserProfile): Promise<any> => {
    return runWithRetry<any>(async (ai) => {
        const prompt = `Generate AM/PM routine for: ${JSON.stringify(user.biometrics)}. Output JSON.`;
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: { 
                ...GEMINI_3_CONFIG,
                responseMimeType: 'application/json' 
            }
        });
        return parseJSONFromText(response.text || "{}");
    }, null, 60000);
};
