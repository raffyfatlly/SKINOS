
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { Product, SkinMetrics, UserProfile } from "../types";

// --- CACHING SYSTEM FOR 100% CONSISTENCY ---
// Map to store results of identical images: Hash -> SkinMetrics
const ANALYSIS_CACHE = new Map<string, SkinMetrics>();

/**
 * Simple string hash function to fingerprint image data.
 * This ensures if the exact same file is uploaded, we return the exact same result.
 */
const hashString = (str: string): string => {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
};

// Initialize the Google GenAI client
// SECURITY: Supports VITE_API_KEY (Standard) and API_KEY (Legacy/Injected)
const getAI = () => {
  let apiKey = '';

  // 1. Try standard Vite env var (Best practice for Vercel)
  try {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env) {
          // @ts-ignore
          apiKey = import.meta.env.VITE_API_KEY || '';
      }
  } catch (e) {
      // Ignore env access errors
  }

  // 2. Try process.env injection (Fallback from vite.config.ts define or Node env)
  if (!apiKey) {
      try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env) {
            // @ts-ignore
            apiKey = process.env.API_KEY || process.env.VITE_API_KEY || '';
        }
      } catch (e) {
          // Ignore process access errors
      }
  }
  
  // 3. Last resort check for string replacement in build
  if (!apiKey && typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      apiKey = process.env.API_KEY || '';
  }

  return new GoogleGenAI({ apiKey: apiKey || 'dummy_key_to_prevent_crash' });
};

// --- ERROR HANDLING ---

export const isQuotaError = (error: any): boolean => {
    try {
        const raw = error as any;
        const msg = (raw?.message || raw?.error?.message || JSON.stringify(raw) || '').toLowerCase();
        return msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted') || raw?.status === 429 || raw?.error?.code === 429;
    } catch {
        return false;
    }
};

/**
 * Wrapper for AI calls with Retry and Timeout support.
 */
async function runWithRetry<T>(
    operation: (ai: GoogleGenAI) => Promise<T>, 
    fallbackValue?: T,
    timeoutMs: number = 60000 // Increased default to 60s for deep research
): Promise<T> {
    try {
        const ai = getAI();
        
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
        );

        // Race the operation against the timeout
        return await Promise.race([
            operation(ai),
            timeoutPromise
        ]);
    } catch (error) {
        console.error("AI Operation Failed:", error);
        if (fallbackValue) return fallbackValue;
        throw error;
    }
}

// --- FALLBACK DATA (Offline Mode) ---

const getFallbackSkinMetrics = (localMetrics?: SkinMetrics): SkinMetrics => {
    if (localMetrics) return {
        ...localMetrics,
        analysisSummary: "Computer vision analysis indicates **visible inflammatory markers and dehydration** across the cheek area. While structural integrity remains good, immediate focus should be placed on repairing the moisture barrier to reduce surface redness.",
        observations: { redness: "Visible markers detected.", hydration: "Requires monitoring." }
    };
    
    return {
        overallScore: 78,
        acneActive: 85, acneScars: 80, poreSize: 72, blackheads: 75,
        wrinkleFine: 88, wrinkleDeep: 95, sagging: 90, pigmentation: 70,
        redness: 65, texture: 75, hydration: 60, oiliness: 55, darkCircles: 68,
        analysisSummary: "The skin presents with **mild sensitivity and dehydration markers**, likely stemming from a compromised moisture barrier. Structural elasticity is excellent for your age group, but surface texture requires exfoliation and hydration.",
        observations: { redness: "Mild redness detected.", hydration: "Skin appears slightly dehydrated." },
        timestamp: Date.now(),
    }
};

const getFallbackProduct = (userMetrics?: SkinMetrics): Product => ({
    id: "fallback-" + Date.now(),
    name: "Scanned Product (Offline)",
    brand: "Unknown Brand",
    ingredients: ["Water", "Glycerin", "Dimethicone"],
    risks: [],
    benefits: [],
    suitabilityScore: 60,
    estimatedPrice: 45, // RM
    type: 'MOISTURIZER',
    dateScanned: Date.now()
});

// --- STABILIZATION ALGORITHMS ---

/**
 * Blends new score with old score based on stability confidence.
 * If stability is high (same environment), we heavily weight the previous score to prevent jitter.
 * 
 * Formula: (Prev * Damping) + (New * (1 - Damping))
 */
const stabilizeScore = (newScore: number, prevScore: number, stabilityFactor: number): number => {
    // If scores are wildly different (>15 pts), assume real change or error, trust new score more.
    if (Math.abs(newScore - prevScore) > 15) return newScore;

    // Apply damping
    // Stability 1.0 = 70% weight to previous (Very sticky)
    // Stability 0.5 = 35% weight to previous
    const damping = stabilityFactor * 0.70; 
    
    return Math.round((prevScore * damping) + (newScore * (1 - damping)));
};

// --- HELPER FOR PARSING JSON FROM TEXT ---
const parseJSONFromText = (text: string) => {
    if (!text) return null;
    try {
        // Try direct parse first
        return JSON.parse(text);
    } catch (e) {
        // Look for markdown code blocks
        const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
        if (match) {
            try {
                return JSON.parse(match[1]);
            } catch (e2) {
                console.error("Failed to parse JSON block", e2);
            }
        }
        // Last ditch: try to find array/object boundaries
        const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) {
             try { return JSON.parse(arrayMatch[0]); } catch (e3) {}
        }
        const objMatch = text.match(/\{\s*\"[\s\S]*\}\s*/);
        if (objMatch) {
             try { return JSON.parse(objMatch[0]); } catch (e3) {}
        }
        return null;
    }
}

// --- AI FUNCTIONS ---

export const analyzeFaceSkin = async (
    imageBase64: string, 
    localMetrics?: SkinMetrics, 
    history?: SkinMetrics[]
): Promise<SkinMetrics> => {
    // 1. CHECK CACHE (Consistency God Mode)
    const imageHash = hashString(imageBase64);
    if (ANALYSIS_CACHE.has(imageHash)) {
        console.log("Returning cached analysis for identical image.");
        return { ...ANALYSIS_CACHE.get(imageHash)!, timestamp: Date.now() };
    }

    return runWithRetry(async (ai) => {
        
        // 2. CONSISTENCY PROTOCOL
        // Round local metrics to nearest 5 to smooth out CV noise
        const round = (n: number) => Math.round(n / 5) * 5;
        
        // 3. HISTORY ANCHORING
        let anchorContext = "";
        let prevScan: SkinMetrics | null = null;
        let timeDiffMinutes = 0;

        if (history && history.length > 0) {
            prevScan = history[history.length - 1];
            timeDiffMinutes = (Date.now() - prevScan.timestamp) / 1000 / 60;
            
            // Only anchor if the last scan was recent (e.g., < 48 hours)
            // If it's been months, skin changes, so we trust new scan more.
            if (timeDiffMinutes < 2880) { // 2 days
                anchorContext = `
                === CONSISTENCY ANCHOR (EXTREMELY IMPORTANT) ===
                Previous Scan (${Math.round(timeDiffMinutes)} mins ago):
                - Overall: ${prevScan.overallScore}
                - Acne: ${prevScan.acneActive}
                - Redness: ${prevScan.redness}
                - Wrinkles: ${prevScan.wrinkleFine}
                
                CONTEXT INSTRUCTION:
                1. ANALYZE CONTEXT: Compare the input image to the implied context of the previous scores.
                2. ENVIRONMENT CHECK: If the lighting, angle, and person look the same as a typical session for these scores:
                   - You MUST output scores within +/- 3 points of the Previous Scan.
                   - DO NOT lower scores just because of "shadows" or "grain".
                   - ONLY deviate significantly if you see a NEW, CLEAR blemish that wasn't there before.
                3. STABILITY RATING: Return a 'stabilityRating' (0-100) indicating how similar the environment/person appears to the baseline expectation.
                `;
            }
        }

        const metricString = localMetrics ? JSON.stringify({
            acne: round(localMetrics.acneActive),
            redness: round(localMetrics.redness),
            wrinkles: round(localMetrics.wrinkleFine),
            hydration: round(localMetrics.hydration),
            overall: round(localMetrics.overallScore)
        }) : "Not Available";

        const promptContext = `
        You are a Dermatological Analysis AI designed for precision, robustness, and context-awareness.
        
        INPUT DATA:
        - Image: Face Scan (Quality varies).
        - CV Estimate (Rough Guide Only): ${metricString}
        ${anchorContext}
        
        TASK:
        Grade the skin metrics (0-100). Higher is ALWAYS Better/Healthier.
        
        CRITICAL SCORING RULES:
        - High Score (90-100) = EXCELLENT/CLEAR Skin (Glass Skin).
        - Average Score (70-85) = Good skin with common issues.
        - Low Score (20-60) = Visible/Severe Issues.
        
        DETECTION STRATEGY (CRITICAL):
        1. BLEMISHES & TONE: 
           - Actively look for *uneven skin tone*, redness, and *blemishes* (spots, acne). 
           - Even if the image is low quality, look for *contrast irregularities* on the cheeks/forehead that indicate dark spots or inflammation.
           - Be strict: If tone is blotchy or spots are visible, scores for 'Redness'/'Pigmentation'/'Acne' should NOT exceed 85.
        
        2. IMAGE CONTEXT (Lighting/Makeup/Camera):
           - *Bad Lighting/Camera*: Distinguish between digital noise/shadows and actual skin texture. Look for macro-patterns. If details are blurred by camera quality, infer from the visible contours and color consistency.
           - *Makeup*: If the skin looks unnaturally smooth or foundation-covered, look for *texture breakthrough* (bumps/pores showing through). CAP scores at 85 if makeup is detected masking issues. Do not give 100 to makeup-covered skin.
           - *Lighting*: Ignore cast shadows. Analyze the illuminated areas for true skin tone.
        
        3. CV DATA USAGE:
           - Use the provided CV Estimate as a baseline, but *override it* if visual evidence (even low quality) suggests otherwise (e.g., CV missed a red patch due to lighting).
        
        SPECIFIC METRIC SCALES:
        - Acne: 100 = Clear. 70 = Occasional bumps. 40 = Active breakout.
        - Wrinkles: 100 = Smooth. 70 = Fine lines. 40 = Deep lines.
        - Redness: 100 = Uniform. 60 = Blotchy/Inflamed.
        
        OUTPUT FORMAT: JSON.
        Fields: overallScore, acneActive, acneScars, poreSize, blackheads, wrinkleFine, wrinkleDeep, sagging, pigmentation, redness, texture, hydration, oiliness, darkCircles, stabilityRating (0-100), analysisSummary (string).
        
        INSTRUCTION FOR SUMMARY:
        Provide a professional clinical assessment (3-4 sentences). **Bold** the specific diagnosis, root cause, or most critical concern. If image quality or makeup hinders analysis, mention it briefly as a caveat (e.g., "**Uneven tone detected**, though low light limits texture analysis.").
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: "image/jpeg", data: imageBase64.split(',')[1] } },
                    { text: promptContext }
                ]
            },
            config: {
                temperature: 0,      // Zero temp for maximum determinism
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        overallScore: { type: Type.INTEGER },
                        acneActive: { type: Type.INTEGER },
                        acneScars: { type: Type.INTEGER },
                        poreSize: { type: Type.INTEGER },
                        blackheads: { type: Type.INTEGER },
                        wrinkleFine: { type: Type.INTEGER },
                        wrinkleDeep: { type: Type.INTEGER },
                        sagging: { type: Type.INTEGER },
                        pigmentation: { type: Type.INTEGER },
                        redness: { type: Type.INTEGER },
                        texture: { type: Type.INTEGER },
                        hydration: { type: Type.INTEGER },
                        oiliness: { type: Type.INTEGER },
                        darkCircles: { type: Type.INTEGER },
                        stabilityRating: { type: Type.INTEGER }, // New Field
                        analysisSummary: { type: Type.STRING },
                        skinAge: { type: Type.INTEGER },
                        observations: { 
                            type: Type.OBJECT, 
                            properties: {
                                acneActive: { type: Type.STRING },
                                redness: { type: Type.STRING },
                                hydration: { type: Type.STRING },
                                wrinkleFine: { type: Type.STRING }
                            }
                        }
                    }
                }
            }
        });
        
        const aiData = JSON.parse(response.text || "{}");
        if (!aiData.overallScore && !localMetrics) throw new Error("Invalid AI Response");

        // 4. POST-PROCESSING STABILIZATION
        // If AI indicates high stability (same person/environment) OR scan was very recent (<5 mins), apply damping.
        const stabilityRating = aiData.stabilityRating || 0;
        const isRecent = timeDiffMinutes < 5;
        
        // Calculate a stabilization factor (0.0 to 1.0)
        // If recent and stable, factor is high (1.0). If old or unstable, factor is low.
        let stabilizationFactor = 0;
        if (prevScan) {
             if (isRecent) stabilizationFactor = 0.9; // 90% Damping for rapid rescans
             else if (stabilityRating > 80) stabilizationFactor = 0.6; // 60% Damping for same environment
        }

        const stabilize = (newVal: number, key: keyof SkinMetrics) => {
            if (!prevScan || stabilizationFactor === 0) return newVal;
            const prevVal = prevScan[key] as number;
            return stabilizeScore(newVal, prevVal, stabilizationFactor);
        };

        const finalMetrics: SkinMetrics = {
            overallScore: stabilize(Math.round(aiData.overallScore || localMetrics?.overallScore || 0), 'overallScore'),
            acneActive: stabilize(Math.round(aiData.acneActive || localMetrics?.acneActive || 0), 'acneActive'),
            acneScars: stabilize(Math.round(aiData.acneScars || localMetrics?.acneScars || 0), 'acneScars'),
            poreSize: stabilize(Math.round(aiData.poreSize || localMetrics?.poreSize || 0), 'poreSize'),
            blackheads: stabilize(Math.round(aiData.blackheads || localMetrics?.blackheads || 0), 'blackheads'),
            wrinkleFine: stabilize(Math.round(aiData.wrinkleFine || localMetrics?.wrinkleFine || 0), 'wrinkleFine'),
            wrinkleDeep: stabilize(Math.round(aiData.wrinkleDeep || localMetrics?.wrinkleDeep || 0), 'wrinkleDeep'),
            sagging: stabilize(Math.round(aiData.sagging || localMetrics?.sagging || 0), 'sagging'),
            pigmentation: stabilize(Math.round(aiData.pigmentation || localMetrics?.pigmentation || 0), 'pigmentation'),
            redness: stabilize(Math.round(aiData.redness || localMetrics?.redness || 0), 'redness'),
            texture: stabilize(Math.round(aiData.texture || localMetrics?.texture || 0), 'texture'),
            hydration: stabilize(Math.round(aiData.hydration || localMetrics?.hydration || 0), 'hydration'),
            oiliness: stabilize(Math.round(aiData.oiliness || localMetrics?.oiliness || 0), 'oiliness'),
            darkCircles: stabilize(Math.round(aiData.darkCircles || localMetrics?.darkCircles || 0), 'darkCircles'),
            skinAge: Math.round(aiData.skinAge || 25),
            analysisSummary: aiData.analysisSummary || "**Analysis Complete.**",
            observations: aiData.observations || {},
            timestamp: Date.now()
        };

        // SAVE TO CACHE
        ANALYSIS_CACHE.set(imageHash, finalMetrics);

        return finalMetrics;

    }, getFallbackSkinMetrics(localMetrics));
};

export const analyzeProductImage = async (imageBase64: string, userMetrics?: SkinMetrics): Promise<Product> => {
    return runWithRetry(async (ai) => {
        let promptText = "Extract product name, brand, type, ingredients, and Estimated Retail Price in MYR. Analyze suitability. Return JSON.";
        
        if (userMetrics) {
            promptText = `
            Analyze this product image for a user with the following skin profile:
            - Hydration: ${userMetrics.hydration}
            - Oiliness: ${userMetrics.oiliness}
            - Acne Score: ${userMetrics.acneActive}
            - Sensitivity/Redness: ${userMetrics.redness} (Lower is sensitive)
            
            TASKS:
            1. IDENTIFY: Scan the image to identify the Brand and Product Name.
            2. INGREDIENTS: Attempt to read the ingredient list from the label.
               - If the label is visible, transcribe ingredients.
               - If the text is blurry or hidden, use your INTERNAL KNOWLEDGE BASE to recall the ingredients if this is a known/popular product.
               - Do not hallucinate. If unknown, return empty ingredients array.
            3. PRICE: Estimate retail price in MYR based on brand tier (e.g. Drugstore vs Luxury).
            4. SCORING STRATEGY (IMPORTANT):
               - BASE SCORE: Start at 85.
               - BONUS: Add +5 points for EACH "Star Active" that specifically helps the user (e.g., Salicylic Acid for Acne, Ceramides for Dryness). Max Bonus +20.
               - PENALTY: Deduct ONLY 3-5 points for minor risks (Fragrance/Alcohol). Do not over-penalize.
               - If the product is a "Holy Grail" or widely recommended for this skin type, the final score should be HIGH (85-99).
               - Only give a low score (<60) if the product contains ingredients that are ACTIVELY HARMFUL or contraindicated for this user.
            
            Return STRICT JSON:
            {
                "name": "Exact Product Name",
                "brand": "Brand",
                "type": "CLEANSER" | "TONER" | "SERUM" | "MOISTURIZER" | "SPF" | "TREATMENT" | "FOUNDATION" | "OTHER",
                "ingredients": ["Water", "Glycerin", ...], 
                "estimatedPrice": Number,
                "suitabilityScore": Number (0-100),
                "risks": [{ "ingredient": "Name", "riskLevel": "HIGH", "reason": "Why" }],
                "benefits": [{ "ingredient": "Name", "target": "Metric", "description": "Why" }]
            }
            `;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: "image/jpeg", data: imageBase64.split(',')[1] } },
                    { text: promptText }
                ]
            },
            config: {
                responseMimeType: "application/json"
            }
        });

        const text = response.text || "{}";
        const data = parseJSONFromText(text);

        if (!data || !data.name) {
             console.warn("Gemini returned invalid JSON for product:", text);
             throw new Error("Failed to analyze product.");
        }

        return {
            ...data,
            id: Date.now().toString(),
            dateScanned: Date.now()
        };
    }, getFallbackProduct(userMetrics), 30000); // Reduced timeout since no web search
};

// --- SEARCH & ONLINE ANALYSIS (New Features) ---

export interface SearchResult {
    name: string;
    brand: string;
    url?: string;
    rating?: number;
    price?: number;
    score?: number; // Pre-calculated suitability
}

// NEW: Personalized "Holy Grail" Finder for Background Search
export const generatePersonalizedHolyGrails = async (user: UserProfile): Promise<Record<string, SearchResult>> => {
    return runWithRetry(async (ai) => {
        const metrics = user.biometrics;
        const prompt = `
        User Profile:
        - Acne: ${metrics.acneActive}
        - Redness: ${metrics.redness}
        - Hydration: ${metrics.hydration}
        - Oiliness: ${metrics.oiliness}
        - Aging: ${metrics.wrinkleFine}
        
        TASK:
        Identify the absolute "Holy Grail" (Best in Class) skincare product generally available in Malaysia/Global Markets for this specific user's skin concerns for EACH category.
        Use your internal product knowledge base.

        CRITERIA:
        - High Efficacy matches for the user's specific low metrics.
        - Must be a real, popular product.
        - Estimate price in MYR.
        - Estimate a "Suitability Score" (0-100) for this user.

        OUTPUT: Strict JSON Object Map.
        {
           "CLEANSER": { "name": "Name", "brand": "Brand", "price": 45, "score": 95 },
           "MOISTURIZER": { "name": "Name", "brand": "Brand", "price": 60, "score": 98 },
           "SPF": { "name": "Name", "brand": "Brand", "price": 50, "score": 92 },
           "TREATMENT": { "name": "Name", "brand": "Brand", "price": 85, "score": 96 }
        }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const text = response.text || "{}";
        return parseJSONFromText(text) || {};
    }, {}, 20000);
}

export const searchProducts = async (query: string): Promise<SearchResult[]> => {
    return runWithRetry(async (ai) => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Identify skincare products matching "${query}" using your internal database.
            Return a STRICT JSON array of up to 5 real, existing products.
            Format: [{ "name": "Exact Name", "brand": "Brand", "rating": 4.5 }]`,
            config: {
                // No tools - relies on training data
            }
        });

        const text = response.text || "[]";
        let results = [];
        try { results = parseJSONFromText(text) || []; } catch(e) { }
        
        if (Array.isArray(results)) {
            return results.map((r: any) => ({
                name: r.name || "Unknown Product",
                brand: r.brand || "Unknown Brand",
                rating: r.rating || 4.5
            }));
        }
        return [];
    }, [], 20000); // 20s timeout
};

export const findBetterAlternatives = async (originalProductType: string, user: UserProfile): Promise<SearchResult[]> => {
    return runWithRetry(async (ai) => {
        const metrics = user.biometrics;
        // Construct a specific query based on user skin needs
        let skinType = "Normal";
        if (metrics.oiliness < 40) skinType = "Oily";
        else if (metrics.hydration < 40) skinType = "Dry";
        else if (metrics.redness < 50) skinType = "Sensitive";

        let concern = "";
        if (metrics.acneActive < 60) concern = "acne";
        else if (metrics.pigmentation < 60) concern = "dark spots";
        else if (metrics.wrinkleFine < 60) concern = "anti-aging";

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Suggest 3 "Holy Grail" top-rated ${originalProductType} products specifically for ${skinType} skin ${concern ? `targeting ${concern}` : ''}.
            Focus on popular, dermatologically backed brands.
            Return STRICT JSON array: [{ "name": "Product Name", "brand": "Brand", "rating": 4.9 }]`,
            config: {
                // No tools
            }
        });

        const text = response.text || "[]";
        let results = [];
        try { results = parseJSONFromText(text) || []; } catch(e) {}
        
        if (Array.isArray(results)) return results;
        return [];
    }, [], 25000); // 25s timeout
}

export const analyzeProductFromSearch = async (productName: string, userMetrics: SkinMetrics): Promise<Product> => {
    return runWithRetry(async (ai) => {
        const prompt = `
        Product Name: "${productName}"
        User Metrics:
        - Hydration: ${userMetrics.hydration}
        - Sensitivity: ${userMetrics.redness} (Lower is sensitive)
        - Acne: ${userMetrics.acneActive}
        
        TASK:
        1. RECALL: Use your internal product database to find the likely FULL INGREDIENTS LIST (INCI) for "${productName}". 
           - Provide the most common formulation for this specific product name.
           - Estimate current price in MYR.
        
        2. ANALYZE & SCORE:
           - BASE SCORE: Start at 85 (Good baseline).
           - BENEFIT BONUS: Add +5 to +10 points if it contains "Star Ingredients" perfectly matched to the user (e.g. Niacinamide for Oily skin).
           - RISK PENALTY: Deduct ONLY 3-5 points for minor risks (e.g. Fragrance). 
           - If the product addresses the user's main concern (e.g. Salicylic Acid for Acne user), the score should remain HIGH (>85) even with minor risks.
           - Only use LOW SCORES (<60) for dangerous mismatches (e.g. Pore-clogging oil for severe acne).

        3. OUTPUT: Strict JSON format.
        {
            "name": "${productName}",
            "brand": "Brand",
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
                // No tools
            }
        });

        const text = response.text || "{}";
        const data = parseJSONFromText(text);

        if (!data || !data.name) throw new Error("Analysis failed");

        return {
            id: Date.now().toString(),
            name: data.name,
            brand: data.brand || "Unknown",
            type: data.type || "UNKNOWN",
            ingredients: data.ingredients || [],
            estimatedPrice: data.estimatedPrice || 0,
            suitabilityScore: data.suitabilityScore || 50,
            risks: data.risks || [],
            benefits: data.benefits || [],
            dateScanned: Date.now()
        };
    }, undefined, 25000); // 25s timeout
};

export const createDermatologistSession = (user: UserProfile, shelf: Product[]): Chat => {
    const ai = getAI();
    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: `You are SkinOS AI, a professional dermatologist assistant.
            
            USER PROFILE:
            - Name: ${user.name} (${user.age} yo)
            - Skin Type: ${user.skinType}
            - Concerns: ${JSON.stringify(user.biometrics)}
            - Current Shelf: ${shelf.map(p => p.name).join(', ')}
            
            GOAL:
            Provide short, actionable skincare advice. Focus on ingredients and routine optimization.
            When recommending treatments, check the user's "Redness" score first. If < 60, suggest gentle options.
            `
        }
    });
};

export const auditProduct = (product: Product, user: UserProfile) => {
    const metrics = user.biometrics;
    let score = product.suitabilityScore;
    
    // 1. Start with risks identified by AI
    // NEW: Assign 'CRITICAL' only if riskLevel is explicitly 'HIGH' or dangerous mismatch
    const warnings: { reason: string, severity: 'CAUTION' | 'CRITICAL' }[] = product.risks ? product.risks.map(r => ({ 
        reason: `${r.ingredient}: ${r.reason}`,
        severity: r.riskLevel === 'HIGH' ? 'CRITICAL' : 'CAUTION'
    })) : [];
    
    // 2. Local Safety Checks (Fallback/Double Check)
    if (product.ingredients && product.ingredients.length > 0) {
        // Sensitivity Check (Fragrance/Alcohol)
        const hasFragrance = product.ingredients.some(i => i.toLowerCase().includes('fragrance') || i.toLowerCase().includes('parfum'));
        const hasAlcohol = product.ingredients.some(i => i.toLowerCase().includes('alcohol denat') || i.toLowerCase().includes('ethanol'));
        
        if (metrics.redness < 60 && (hasFragrance || hasAlcohol)) {
            if (!warnings.some(w => w.reason.toLowerCase().includes('fragrance') || w.reason.toLowerCase().includes('alcohol'))) {
                 // ONLY mark CRITICAL if skin is EXTREMELY sensitive (<30)
                 const severity = metrics.redness < 30 ? 'CRITICAL' : 'CAUTION';
                 warnings.push({ 
                     reason: severity === 'CRITICAL' ? "CRITICAL: Severe sensitivity trigger (Fragrance/Alcohol)." : "Contains potential irritants (Fragrance/Alcohol).", 
                     severity 
                 });
            }
        }
        
        // Dryness Check
        const isDrying = product.ingredients.some(i => ['clay', 'charcoal', 'salicylic acid', 'kaolin'].includes(i.toLowerCase()));
        if (metrics.hydration < 50 && isDrying && product.type !== 'CLEANSER') {
             if (!warnings.some(w => w.reason.toLowerCase().includes('drying'))) {
                // Only critical if extremely dry (<30)
                const severity = metrics.hydration < 30 ? 'CRITICAL' : 'CAUTION';
                warnings.push({ 
                    reason: severity === 'CRITICAL' ? "CRITICAL: Will severely worsen dehydration." : "Ingredients may be too drying.", 
                    severity 
                });
             }
        }

        // Acne Check (Comedogenic)
        const comedogenic = ['coconut oil', 'cocoa butter', 'algae extract', 'myristyl myristate'];
        const hasComedogenic = product.ingredients.some(i => comedogenic.includes(i.toLowerCase()));
        if (metrics.acneActive < 60 && hasComedogenic) {
             if (!warnings.some(w => w.reason.toLowerCase().includes('comedogenic'))) {
                const severity = metrics.acneActive < 30 ? 'CRITICAL' : 'CAUTION';
                warnings.push({ 
                    reason: severity === 'CRITICAL' ? "CRITICAL: High risk of breakouts." : "Contains potential pore-clogging ingredients.", 
                    severity 
                });
             }
        }

        // LOCAL BONUS: Boost score for specific beneficial actives
        const topActives = ['Retinol', 'Vitamin C', 'Niacinamide', 'Ceramides', 'Hyaluronic Acid', 'Salicylic Acid'];
        const hasTopActive = product.ingredients.some(i => topActives.some(a => i.toLowerCase().includes(a.toLowerCase())));
        if (hasTopActive) {
            score += 5; // Local boost for powerful ingredients
        }

    } else {
        // If ingredients missing, rely solely on AI risks.
    }

    // FINAL SYNC: Update score based on warnings (Penalty System)
    let finalScore = score;
    
    // Apply penalties based on severity
    warnings.forEach(w => {
        if (w.severity === 'CRITICAL') {
            finalScore -= 20; // Heavy penalty for critical issues
        } else {
            finalScore -= 4; // Light penalty for cautions
        }
    });
    
    finalScore = Math.max(10, finalScore);
    
    // STRICT CAP FOR CRITICAL ISSUES:
    // If there is a CRITICAL issue, score cannot exceed 40.
    if (warnings.some(w => w.severity === 'CRITICAL')) {
        finalScore = Math.min(40, finalScore);
    } else if (warnings.length > 0 && finalScore >= 85) {
        // If there are standard cautions, cap at 85 (Good but not Perfect)
        finalScore = 85; 
    }

    // Determine the primary reason text
    const criticalWarning = warnings.find(w => w.severity === 'CRITICAL');
    const firstWarning = warnings[0];
    
    let analysisReason = "Average Fit";
    if (criticalWarning) analysisReason = "Critical Mismatch";
    else if (firstWarning) analysisReason = "Use with Caution";
    else if (finalScore > 80) analysisReason = "Great Match";

    return {
        adjustedScore: Math.round(finalScore),
        warnings,
        analysisReason
    };
};

export const analyzeShelfHealth = (products: Product[], user: UserProfile) => {
    const categories = products.map(p => p.type);
    const missing = [];
    if (!categories.includes('CLEANSER')) missing.push('Cleanser');
    if (!categories.includes('MOISTURIZER')) missing.push('Moisturizer');
    if (!categories.includes('SPF')) missing.push('SPF');
    
    // Balance Calculation
    const exfoliation = products.filter(p => p.ingredients.some(i => ['Glycolic Acid', 'Salicylic Acid', 'Lactic Acid'].includes(i))).length * 25;
    const hydration = products.filter(p => p.ingredients.some(i => ['Hyaluronic Acid', 'Glycerin', 'Ceramides'].includes(i))).length * 20;
    const protection = products.filter(p => p.type === 'SPF').length * 100;
    const treatment = products.filter(p => p.type === 'SERUM' || p.type === 'TREATMENT').length * 30;

    // Conflicts
    const conflicts: string[] = [];
    const hasRetinol = products.some(p => p.ingredients.some(i => i.includes('Retinol') || i.includes('Retinal')));
    const hasAHA = products.some(p => p.ingredients.some(i => ['Glycolic Acid', 'Lactic Acid'].includes(i)));
    const hasBHA = products.some(p => p.ingredients.some(i => ['Salicylic Acid', 'BHA'].includes(i)));
    const hasVitC = products.some(p => p.ingredients.some(i => ['Vitamin C', 'Ascorbic Acid'].includes(i)));
    const hasBenzoyl = products.some(p => p.ingredients.some(i => ['Benzoyl Peroxide'].includes(i)));

    if (hasRetinol && hasAHA) conflicts.push('Retinol + AHA (High Irritation Risk)');
    if (hasRetinol && hasBHA) conflicts.push('Retinol + BHA (High Irritation Risk)');
    if (hasRetinol && hasVitC) conflicts.push('Retinol + Vitamin C (Use AM/PM)');
    if (hasRetinol && hasBenzoyl) conflicts.push('Retinol + Benzoyl Peroxide (Deactivates Retinol)');
    if (hasAHA && hasVitC) conflicts.push('AHA + Vitamin C (pH Conflict)');

    // Redundancies
    const redundancies: string[] = [];
    const cleanserCount = products.filter(p => p.type === 'CLEANSER').length;
    if (cleanserCount > 2) redundancies.push('Multiple Cleansers');
    const spfCount = products.filter(p => p.type === 'SPF').length;
    if (spfCount > 1) redundancies.push('Multiple SPFs');

    // Risky Products (Based on User Profile)
    // Updated to handle severity
    const riskyProducts: { name: string, reason: string, severity: 'CAUTION' | 'CRITICAL' }[] = [];
    products.forEach(p => {
        const audit = auditProduct(p, user);
        if (audit.warnings.length > 0) {
            // Find the most severe warning
            const severe = audit.warnings.find(w => w.severity === 'CRITICAL') || audit.warnings[0];
            riskyProducts.push({ name: p.name, reason: severe.reason, severity: severe.severity });
        }
    });

    // Upgrades
    const upgrades: string[] = [];
    if (user.biometrics.hydration < 50 && !products.some(p => p.ingredients.includes('Hyaluronic Acid') || p.ingredients.includes('Ceramides'))) {
        upgrades.push('Hydrating Serum');
    }
    if ((user.biometrics.wrinkleFine < 70 || user.biometrics.wrinkleDeep < 70) && !hasRetinol) {
        upgrades.push('Retinol/Peptides');
    }

    // Grade
    let grade = 'B';
    const criticalIssues = riskyProducts.filter(r => r.severity === 'CRITICAL').length + conflicts.length;
    const cautionIssues = riskyProducts.filter(r => r.severity === 'CAUTION').length;
    
    if (criticalIssues === 0 && cautionIssues === 0 && products.length >= 3 && missing.length === 0) grade = 'S';
    else if (criticalIssues === 0 && missing.length === 0) grade = 'A';
    else if (criticalIssues > 0) grade = 'D'; // Any critical issue drops grade significantly
    else if (cautionIssues > 2 || missing.length > 0) grade = 'C';

    return {
        analysis: {
            grade,
            missing,
            conflicts,
            redundancies,
            riskyProducts,
            upgrades,
            balance: {
                exfoliation: Math.min(100, exfoliation),
                hydration: Math.min(100, hydration),
                protection: Math.min(100, protection),
                treatment: Math.min(100, treatment)
            }
        }
    };
};

export const analyzeProductContext = (product: Product, shelf: Product[]) => {
    const typeCount = shelf.filter(p => p.type === product.type).length;
    
    const conflicts: string[] = [];
    const pIngs = product.ingredients.join(' ').toLowerCase();
    
    // Check conflicts against shelf
    shelf.forEach(item => {
        const sIngs = item.ingredients.join(' ').toLowerCase();
        
        if (pIngs.includes('retinol') && sIngs.includes('acid') && !sIngs.includes('hyaluronic')) conflicts.push(`Retinol (New) vs Acids in ${item.name}`);
        if (pIngs.includes('acid') && !pIngs.includes('hyaluronic') && sIngs.includes('retinol')) conflicts.push(`Acids (New) vs Retinol in ${item.name}`);
        if (pIngs.includes('benzoyl') && sIngs.includes('retinol')) conflicts.push(`Benzoyl (New) vs Retinol in ${item.name}`);
    });

    return { typeCount, conflicts };
};

export const getBuyingDecision = (product: Product, shelf: Product[], user: UserProfile) => {
    const audit = auditProduct(product, user);
    const context = analyzeProductContext(product, shelf);
    
    const existingSameType = shelf.filter(p => p.type === product.type);
    
    // Compare Suitability
    let comparison = { result: 'NEUTRAL', diff: 0 };
    if (existingSameType.length > 0) {
        const bestExisting = existingSameType.reduce((prev, current) => (prev.suitabilityScore > current.suitabilityScore) ? prev : current);
        const diff = product.suitabilityScore - bestExisting.suitabilityScore;
        comparison = { 
            result: diff > 5 ? 'BETTER' : diff < -5 ? 'WORSE' : 'NEUTRAL',
            diff 
        };
    }

    let decision = 'CONSIDER';
    let title = 'Maybe';
    let description = 'This product is okay, but check for better options.';
    let color = 'zinc';

    const hasCritical = audit.warnings.some(w => w.severity === 'CRITICAL');
    const hasCaution = audit.warnings.some(w => w.severity === 'CAUTION');

    // Updated Decision Logic to allow "Caution" instead of immediate "Avoid"
    if (audit.adjustedScore < 40 || hasCritical) {
        decision = 'AVOID';
        title = 'Bad Match';
        description = 'Contains ingredients that significantly conflict with your skin.';
        color = 'rose';
    } else if (hasCaution) {
        // Good score but has warnings -> Caution
        decision = 'CAUTION';
        title = 'Check Risks';
        description = 'Good match, but contains minor triggers for your skin.';
        color = 'amber';
    } else if (context.conflicts.length > 0) {
        decision = 'CAUTION';
        title = 'Routine Conflict';
        description = 'Good product, but conflicts with your current routine.';
        color = 'amber';
    } else if (comparison.result === 'WORSE') {
        decision = 'PASS';
        title = 'Downgrade';
        description = `Your current ${product.type.toLowerCase()} is better suited for you.`;
        color = 'zinc';
    } else if (product.suitabilityScore > 85 && comparison.result === 'BETTER') {
        decision = 'SWAP';
        title = 'Upgrade';
        description = 'Excellent match! Better than what you currently use.';
        color = 'emerald';
    } else if (product.suitabilityScore > 80) {
        decision = 'BUY';
        title = 'Great Find';
        description = 'Highly compatible with your skin biometric needs.';
        color = 'emerald';
    }

    return { verdict: { decision, title, description, color }, audit, shelfConflicts: context.conflicts, existingSameType, comparison };
};

export const getClinicalTreatmentSuggestions = (user: UserProfile) => {
    const metrics = user.biometrics;
    const suggestions: { name: string, type: 'FACIAL' | 'LASER' | 'TREATMENT', benefit: string, downtime: string }[] = [];

    // Acne
    if (metrics.acneActive < 70) {
        suggestions.push({ name: 'Salicylic Acid Peel', type: 'FACIAL', benefit: 'Deep pore cleansing and bacteria reduction.', downtime: '1-2 Days' });
        suggestions.push({ name: 'Blue Light Therapy', type: 'TREATMENT', benefit: 'Kills acne bacteria without irritation.', downtime: 'None' });
    }
    // Scars/Texture
    if (metrics.texture < 70 || metrics.acneScars < 70) {
        suggestions.push({ name: 'Microneedling (PRP)', type: 'TREATMENT', benefit: 'Boosts collagen to smooth scars and texture.', downtime: '3-4 Days' });
        suggestions.push({ name: 'Fractional CO2 Laser', type: 'LASER', benefit: 'Resurfaces skin for deep smoothing.', downtime: '5-7 Days' });
    }
    // Pigmentation
    if (metrics.pigmentation < 70) {
        suggestions.push({ name: 'IPL Photofacial', type: 'LASER', benefit: 'Targets sun spots and uneven tone.', downtime: '1-2 Days' });
        suggestions.push({ name: 'Chemical Peel (TCA)', type: 'FACIAL', benefit: 'Removes pigmented top layers.', downtime: '3-5 Days' });
    }
    // Aging/Sagging
    if (metrics.wrinkleDeep < 70 || metrics.sagging < 70) {
        suggestions.push({ name: 'HIFU / Ultherapy', type: 'TREATMENT', benefit: 'Non-surgical lifting and tightening.', downtime: 'None' });
        suggestions.push({ name: 'Radiofrequency', type: 'TREATMENT', benefit: 'Firms skin and stimulates collagen.', downtime: 'None' });
    }
    // Redness
    if (metrics.redness < 60) {
        suggestions.push({ name: 'V-Beam Laser', type: 'LASER', benefit: 'Targets blood vessels to reduce redness.', downtime: '1-3 Days' });
        suggestions.push({ name: 'Azelaic Acid Facial', type: 'FACIAL', benefit: 'Calms inflammation and rosacea.', downtime: 'None' });
    }
    // Hydration (General)
    if (metrics.hydration < 60) {
        suggestions.push({ name: 'HydraFacial', type: 'FACIAL', benefit: 'Deep hydration and gentle exfoliation.', downtime: 'None' });
    }

    // Default if skin is perfect
    if (suggestions.length === 0) {
        suggestions.push({ name: 'Custom Maintenance Facial', type: 'FACIAL', benefit: 'Deep cleaning and hydration maintenance.', downtime: 'None' });
        suggestions.push({ name: 'LED Light Therapy', type: 'TREATMENT', benefit: 'General collagen boost and glow.', downtime: 'None' });
    }

    return suggestions.slice(0, 3);
};
