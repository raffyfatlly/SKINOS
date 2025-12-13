
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { SkinMetrics, Product, UserProfile, IngredientRisk, Benefit } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helpers
const parseJSONFromText = (text: string): any => {
    try {
        // Find the first occurrence of { or [
        const startObj = text.indexOf('{');
        const startArr = text.indexOf('[');
        
        // Determine which comes first (or exists)
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
        console.error("JSON Parse Error", e);
        return {};
    }
};

const runWithRetry = async <T>(fn: (ai: GoogleGenAI) => Promise<T>, fallback: T, timeoutMs: number = 30000): Promise<T> => {
    try {
        const timeoutPromise = new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs));
        return await Promise.race([fn(ai), timeoutPromise]);
    } catch (e) {
        console.error("Gemini Error:", e);
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
        const prompt = `
        You are a smart product search engine for skincare and cosmetics.
        User Query: "${query}"
        
        TASK:
        1. Identify the likely BRAND and PRODUCT NAME from the query.
        2. If the brand is merged with the name (e.g., "glad2glow", "larocheposay"), separate them correctly (e.g., "Glad2Glow", "La Roche-Posay").
        3. If the query implies a specific product, return that single result.
        4. If the query is vague (e.g., "vitamin c serum"), suggest 3 popular, high-quality real-world products matching the description.
        
        OUTPUT:
        Strict JSON Array of objects.
        Example: [{"brand": "BrandName", "name": "Product Name"}]
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        
        const res = parseJSONFromText(response.text || "[]");
        return Array.isArray(res) ? res : [res].filter(x => x.name);
    }, [{ name: query, brand: "Generic" }]);
};

export const analyzeFaceSkin = async (image: string, localMetrics: SkinMetrics, history?: SkinMetrics[]): Promise<SkinMetrics> => {
    return runWithRetry<SkinMetrics>(async (ai) => {
        const prompt = `Analyze this face image for dermatological metrics. 
        The provided image may have lighting variances.
        Current computer-vision estimates (for reference only): ${JSON.stringify(localMetrics)}.
        
        TASK:
        1. Ignore the provided metrics if they contradict visible skin condition.
        2. Calibrate scoring to avoid extreme outliers:
           - 90-100: Clinical perfection / Glass Skin.
           - 75-89: Healthy, minor imperfections (Normal).
           - 50-74: Visible issues needing routine adjustment.
           - <50: Significant dermatological concerns.
        3. Output robust, realistic scores.

        Return JSON with fields: overallScore, acneActive, acneScars, poreSize, blackheads, wrinkleFine, wrinkleDeep, sagging, pigmentation, redness, texture, hydration, oiliness, darkCircles, skinAge, analysisSummary (string), observations (map of metric key to string observation).`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: image.split(',')[1] } },
                    { text: prompt }
                ]
            },
            config: { responseMimeType: 'application/json' }
        });
        
        const data = parseJSONFromText(response.text || "{}");
        return { ...localMetrics, ...data, timestamp: Date.now() };
    }, localMetrics);
};

export const analyzeProductImage = async (base64: string, userMetrics: SkinMetrics): Promise<Product> => {
    return runWithRetry<Product>(async (ai) => {
        const prompt = `Analyze this product label. Extract name, brand, ingredients. 
        Evaluate suitability for user with: ${JSON.stringify(userMetrics)}.
        Return JSON: name, brand, type, ingredients (array), estimatedPrice (number), suitabilityScore (0-100), risks (array of {ingredient, riskLevel, reason}), benefits (array of {ingredient, target, description, relevance}).`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64.split(',')[1] } },
                    { text: prompt }
                ]
            },
             config: { responseMimeType: 'application/json' }
        });

        const data = parseJSONFromText(response.text || "{}");
        return {
            id: Date.now().toString(),
            name: data.name || "Unknown Product",
            brand: data.brand || "Unknown Brand",
            type: data.type || "UNKNOWN",
            ingredients: data.ingredients || [],
            estimatedPrice: data.estimatedPrice || 0,
            suitabilityScore: data.suitabilityScore || 50,
            risks: data.risks || [],
            benefits: data.benefits || [],
            dateScanned: Date.now()
        };
    }, getFallbackProduct(userMetrics, "Scanned Product"));
};

export const analyzeProductFromSearch = async (productName: string, userMetrics: SkinMetrics, consistencyScore?: number, knownBrand?: string): Promise<Product> => {
    return runWithRetry<Product>(async (ai) => {
        const prompt = `
        Product Name: "${productName}"
        ${knownBrand ? `Brand: "${knownBrand}"` : ''}
        User Metrics (Scale 0-100, HIGHER IS BETTER/HEALTHIER):
        - Hydration: ${userMetrics.hydration} (High = Hydrated)
        - Redness: ${userMetrics.redness} (High = Calm, Low = Sensitive)
        - Acne Score: ${userMetrics.acneActive} (High = Clear Skin, Low = Severe Acne)
        ${consistencyScore ? `- TARGET SCORE: ${consistencyScore} (The user was previously shown this score. Ensure analysis aligns close to this if ingredients support it.)` : ''}
        
        TASK:
        1. RECALL: Use your internal product database to find the likely FULL INGREDIENTS LIST (INCI) for "${productName}" ${knownBrand ? `by ${knownBrand}` : ''}. 
           - Provide the most common formulation for this specific product name.
           - Estimate current price in MYR.
        
        2. SCORING STRATEGY (STRICT):
           - **Base Score**: 75 (Average).
           - **Perfect (95-99)**: Requires exact active matches AND zero risks.
           - **Excellent (85-94)**: Strong actives, maybe 1 minor acceptable trade-off.
           - **Good (75-84)**: Basic, safe, effective.
           - Penalize heavily (-10) for known irritants if skin is sensitive.
           - LIMIT: Max Score 99. Min Score 1.

        3. OUTPUT: Strict JSON format.
        {
            "name": "${productName}",
            "brand": "${knownBrand || "Brand"}",
            "type": "CLEANSER" | "TONER" | "SERUM" | "MOISTURIZER" | "SPF" | "TREATMENT" | "FOUNDATION" | "OTHER",
            "ingredients": ["Water", "Glycerin", ...], 
            "estimatedPrice": Number,
            "suitabilityScore": Number,
            "risks": [{ "ingredient": "Name", "riskLevel": "HIGH", "reason": "Why" }],
            "benefits": [{ "ingredient": "Name", "target": "Target", "description": "Why", "relevance": "HIGH" }]
        }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                 responseMimeType: 'application/json'
            }
        });

        const data = parseJSONFromText(response.text || "{}");

        if (!data || !data.name) throw new Error("Analysis failed");

        if (consistencyScore && Math.abs((data.suitabilityScore || 50) - consistencyScore) > 20) {
             data.suitabilityScore = Math.round((data.suitabilityScore + consistencyScore) / 2);
        } else if (consistencyScore) {
             data.suitabilityScore = consistencyScore;
        }

        return {
            id: Date.now().toString(),
            name: data.name,
            brand: data.brand || knownBrand || "Unknown",
            type: data.type || "UNKNOWN",
            ingredients: data.ingredients || [],
            estimatedPrice: data.estimatedPrice || 0,
            suitabilityScore: data.suitabilityScore || 50,
            risks: data.risks || [],
            benefits: data.benefits || [],
            dateScanned: Date.now()
        };
    }, { ...getFallbackProduct(userMetrics, productName), suitabilityScore: consistencyScore || 75, brand: knownBrand || "Unknown Brand" }, 45000); 
};

export const auditProduct = (product: Product, user: UserProfile) => {
    // Basic audit logic
    const warnings = product.risks.map(r => ({ 
        severity: r.riskLevel === 'HIGH' ? 'CRITICAL' : 'CAUTION', 
        reason: r.reason 
    }));
    
    let adjustedScore = product.suitabilityScore;
    // Penalty for sensitivity mismatch
    if (user.biometrics.redness < 50 && warnings.length > 0) adjustedScore -= 10;
    
    return {
        adjustedScore: Math.max(0, Math.min(100, adjustedScore)),
        warnings,
        analysisReason: warnings.length > 0 ? warnings[0].reason : "Good formulation match."
    };
};

export const analyzeShelfHealth = (products: Product[], user: UserProfile) => {
    const conflicts: string[] = [];
    const riskyProducts: any[] = [];
    const missing: string[] = [];
    const redundancies: string[] = [];
    const upgrades: string[] = [];
    
    const types = new Set(products.map(p => p.type));
    if (!types.has('CLEANSER')) missing.push('Cleanser');
    if (!types.has('SPF')) missing.push('SPF');
    if (!types.has('MOISTURIZER')) missing.push('Moisturizer');

    // Calculate Grade
    const avgScore = products.length > 0 ? products.reduce((acc, p) => acc + p.suitabilityScore, 0) / products.length : 0;
    let grade = 'C';
    if (avgScore > 85 && missing.length === 0) grade = 'S';
    else if (avgScore > 75) grade = 'A';
    else if (avgScore > 60) grade = 'B';

    products.forEach(p => {
        if (p.suitabilityScore < 50) {
            riskyProducts.push({ name: p.name, reason: "Low suitability score", severity: "CAUTION" });
        }
    });

    return {
        analysis: {
            grade,
            conflicts,
            riskyProducts,
            missing,
            redundancies,
            upgrades,
            balance: { 
                exfoliation: 50, 
                hydration: products.some(p => p.type === 'MOISTURIZER') ? 80 : 30, 
                protection: products.some(p => p.type === 'SPF') ? 90 : 20, 
                treatment: products.some(p => p.type === 'SERUM' || p.type === 'TREATMENT') ? 70 : 40 
            }
        }
    };
};

export const analyzeProductContext = (product: Product, shelf: Product[]) => {
    const typeCount = shelf.filter(p => p.type === product.type && p.id !== product.id).length;
    // Simple conflict detection (e.g. Retinol vs AHA)
    const conflicts: string[] = [];
    const ingredients = product.ingredients.join(' ').toLowerCase();
    
    shelf.forEach(p => {
        if (p.id === product.id) return;
        const pIng = p.ingredients.join(' ').toLowerCase();
        if (ingredients.includes('retinol') && (pIng.includes('glycolic') || pIng.includes('salicylic'))) {
            conflicts.push(`Retinol in ${product.name} vs Acids in ${p.name}`);
        }
    });

    return { conflicts, typeCount };
};

export const getClinicalTreatmentSuggestions = (user: UserProfile) => {
    const suggestions = [];
    if (user.biometrics.acneActive < 60) suggestions.push({ type: 'FACIAL', name: 'Deep Pore Cleanse', benefit: 'Clears congestion', downtime: 'None' });
    if (user.biometrics.wrinkleFine < 60) suggestions.push({ type: 'LASER', name: 'Fractional Laser', benefit: 'Boosts collagen', downtime: '2-3 Days' });
    if (user.biometrics.pigmentation < 60) suggestions.push({ type: 'PEEL', name: 'Chemical Peel', benefit: 'Evens tone', downtime: '1-2 Days' });
    return suggestions;
};

export const createDermatologistSession = (user: UserProfile, shelf: Product[]): Chat => {
    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
             systemInstruction: `You are a helpful dermatologist. User metrics: ${JSON.stringify(user.biometrics)}. Shelf: ${JSON.stringify(shelf.map(p => p.name))}.`
        }
    });
};

export const isQuotaError = (e: any) => {
    return e?.message?.includes('429') || e?.status === 429;
};

export const getBuyingDecision = (product: Product, shelf: Product[], user: UserProfile) => {
    const audit = auditProduct(product, user);
    let decision = 'CONSIDER';
    let color = 'zinc';
    
    if (audit.adjustedScore > 85 && audit.warnings.length === 0) { 
        decision = 'BUY'; color = 'emerald'; 
    } else if (audit.adjustedScore > 75) {
        decision = 'GREAT FIND'; color = 'teal';
    } else if (audit.adjustedScore < 40 || audit.warnings.some(w => w.severity === 'CRITICAL')) { 
        decision = 'AVOID'; color = 'rose'; 
    } else if (audit.adjustedScore < 60) {
        decision = 'CAUTION'; color = 'amber';
    }
    
    return {
        verdict: { decision, title: decision, description: audit.analysisReason, color },
        audit,
        shelfConflicts: [], // To be populated by analyzeProductContext logic if needed
        comparison: { result: audit.adjustedScore > 70 ? 'BETTER' : 'NEUTRAL' }
    };
};
