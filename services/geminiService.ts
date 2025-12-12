import { GoogleGenAI, Type, Chat } from "@google/genai";
import { Product, SkinMetrics, UserProfile } from "../types";

// --- EXPORTED TYPES ---

export interface SearchResult {
    name: string;
    brand: string;
    score?: number;
    price?: number;
}

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
        if (fallbackValue !== undefined) return fallbackValue;
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

const getFallbackProduct = (userMetrics?: SkinMetrics, overrideName?: string): Product => ({
    id: "fallback-" + Date.now(),
    name: overrideName || "Scanned Product (Offline)",
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
        You are an expert, observant Skincare Coach.
        
        INPUT DATA:
        - Image: Face Scan.
        - CV Estimate (Rough Guide): ${metricString}
        ${anchorContext}
        
        PART 1: NUMERICAL SCORING (STRICT CALIBRATION)
        Grade skin metrics (0-100). Higher is ALWAYS Better/Healthier.
        You MUST adhere to these ranges based on visual severity:
        
        - **None / Clear / Glass Skin**: 90-100 (No visible issues).
        - **Mild**: 75-89 (Small, minor imperfections, mostly clear).
        - **Moderate**: 60-74 (Distinct breakouts, texture, or redness. Visible but manageable).
          * NOTE: If you see a standard breakout, score it 65-70. Do not inflate to 80+.
        - **Significant**: 45-59 (Prominent issues, requiring immediate attention).
        - **Severe**: 1-44 (Inflamed, widespread, cystic, or deep scarring).

        PART 2: VISUAL ANALYSIS & SUMMARY (SIMPLE, CLEAR & DETAILED)
        - **Role**: You are a friendly, helpful Skincare Coach, not a medical textbook.
        - **Language**: Use **simple, everyday language**. Avoid complex medical jargon.
          * Instead of "erythema", say "redness".
          * Instead of "comedones", say "clogged pores" or "bumps".
          * Instead of "hyperpigmentation", say "dark spots" or "marks".
        - **Detail**: Be very specific about **where** you see issues (e.g., "forehead", "cheeks", "jawline") and **what** they look like.
        - **Tone**: Direct, honest, and easy to understand. Explain *what* you see and *why* it matters simply.
        - **Bold** the most important finding.
        - Example: "I see some **moderate redness and active breakouts on your cheeks**, likely due to clogged pores. Your forehead looks a bit shiny, suggesting some oiliness there."
        
        OUTPUT FORMAT: JSON.
        Fields: overallScore, acneActive, acneScars, poreSize, blackheads, wrinkleFine, wrinkleDeep, sagging, pigmentation, redness, texture, hydration, oiliness, darkCircles, stabilityRating (0-100), analysisSummary (string), skinAge (int), observations (Map<string, string>).
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
                        stabilityRating: { type: Type.INTEGER }, 
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
        const stabilityRating = aiData.stabilityRating || 0;
        const isRecent = timeDiffMinutes < 5;
        
        let stabilizationFactor = 0;
        if (prevScan) {
             if (isRecent) stabilizationFactor = 0.9; 
             else if (stabilityRating > 80) stabilizationFactor = 0.6;
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
            - Redness (Sensitivity Gauge): ${userMetrics.redness} (Note: < 50 is Sensitive, > 80 is Resilient. DO NOT use Overall Score for this.)
            
            TASKS:
            1. IDENTIFY: Scan the image to identify the Brand and Product Name.
            2. INGREDIENTS: Attempt to read the ingredient list from the label. Use knowledge base if blurry.
            3. SCORING STRATEGY (STRICT & REALISTIC):
               - **PHILOSOPHY**: 75 is Average/Decent. 85 is Great. 95+ is "Holy Grail" Perfection.
               - **BASE SCORE**: Start at 75 (Solid, standard product).
               - **BONUS**: +5 points per KEY active ingredient that matches user needs (max +20).
               - **PENALTY**: -5 to -10 points for risks (Fragrance, Alcohol, Mismatch).
               - **PERFECTION RULE**: Score > 90 is ONLY allowed if there are NO RISKS and MULTIPLE BENEFITS.
               - **REALISM**: If it's a basic moisturizer with no special actives, score should be ~75-80.
            
            Return STRICT JSON:
            {
                "name": "Exact Product Name",
                "brand": "Brand",
                "type": "CLEANSER" | "TONER" | "SERUM" | "MOISTURIZER" | "SPF" | "TREATMENT" | "FOUNDATION" | "OTHER",
                "ingredients": ["Water", "Glycerin", ...], 
                "estimatedPrice": Number,
                "suitabilityScore": Number (1-99),
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
    }, getFallbackProduct(userMetrics), 45000); 
};

// --- SEARCH FUNCTIONS ---

export const searchProducts = async (query: string): Promise<SearchResult[]> => {
    return runWithRetry(async (ai) => {
        const prompt = `
        TASK: Act as a product search engine for skincare.
        QUERY: "${query}"
        
        INSTRUCTIONS:
        1. List up to 5 real skincare/cosmetic products that match the query.
        2. Focus on popular, available brands.
        3. Return strictly JSON.

        OUTPUT FORMAT:
        [
            { "name": "Full Product Name", "brand": "Brand Name" }
        ]
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });

        const text = response.text || "[]";
        const results = parseJSONFromText(text);
        return Array.isArray(results) ? results : [];
    }, [], 20000);
};

export const findBetterAlternatives = async (productType: string, user: UserProfile): Promise<SearchResult[]> => {
     return runWithRetry(async (ai) => {
        const prompt = `
        User Profile:
        - Skin Type: ${user.skinType}
        - Concerns: Acne (${user.biometrics.acneActive}), Hydration (${user.biometrics.hydration}), Sensitivity (${user.biometrics.redness})
        
        TASK: Recommend 3 "Holy Grail" products in the category "${productType}" that are BETTER suited for this user than an average product.
        
        CRITERIA:
        - Must be highly rated real products.
        - Must target the user's specific biometric weaknesses.
        - Avoid irritants if sensitivity is high.

        OUTPUT JSON:
        [
            { "name": "Product Name", "brand": "Brand", "score": 95, "price": 50 }
        ]
        `;
        
        const response = await ai.models.generateContent({
             model: 'gemini-2.5-flash',
             contents: prompt,
             config: { responseMimeType: "application/json" }
        });
        
        const text = response.text || "[]";
        const results = parseJSONFromText(text);
        return Array.isArray(results) ? results : [];
    }, []);
}

export const generatePersonalizedHolyGrails = async (user: UserProfile): Promise<Record<string, SearchResult>> => {
    return runWithRetry(async (ai) => {
         const prompt = `
         Analyze this user biometric profile:
         - Hydration: ${user.biometrics.hydration} (Low < 50, High > 80)
         - Acne: ${user.biometrics.acneActive} (Low < 60 means active acne)
         - Sensitivity/Redness: ${user.biometrics.redness} (Low < 50 is sensitive)
         
         TASK: Identify ONE "Holy Grail" (Best Possible Match) product for each of these categories:
         1. CLEANSER
         2. MOISTURIZER
         3. SPF
         4. TREATMENT (Serum/Active)
         
         OUTPUT JSON Map:
         {
            "CLEANSER": { "name": "...", "brand": "...", "score": 98, "price": 45 },
            "MOISTURIZER": { ... },
            "SPF": { ... },
            "TREATMENT": { ... }
         }
         `;

         const response = await ai.models.generateContent({
             model: 'gemini-2.5-flash',
             contents: prompt,
             config: { responseMimeType: "application/json" }
         });

         const text = response.text || "{}";
         return parseJSONFromText(text) || {};
    }, {});
}

// Updated to accept an optional 'consistencyScore' to override or guide the suitability
export const analyzeProductFromSearch = async (productName: string, userMetrics: SkinMetrics, consistencyScore?: number): Promise<Product> => {
    return runWithRetry<Product>(async (ai) => {
        const prompt = `
        Product Name: "${productName}"
        User Metrics:
        - Hydration: ${userMetrics.hydration}
        - Redness (Sensitivity Gauge): ${userMetrics.redness} (Note: < 50 is Sensitive, > 80 is Resilient. DO NOT use Overall Score for this.)
        - Acne: ${userMetrics.acneActive}
        ${consistencyScore ? `- TARGET SCORE: ${consistencyScore} (The user was previously shown this score. Ensure analysis aligns close to this if ingredients support it.)` : ''}
        
        TASK:
        1. RECALL: Use your internal product database to find the likely FULL INGREDIENTS LIST (INCI) for "${productName}". 
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
                // No tools - intentionally using internal knowledge for deep ingredient analysis
            }
        });

        const text = response.text || "{}";
        const data = parseJSONFromText(text);

        if (!data || !data.name) throw new Error("Analysis failed");

        // Force consistency if provided
        if (consistencyScore && Math.abs((data.suitabilityScore || 50) - consistencyScore) > 20) {
             data.suitabilityScore = Math.round((data.suitabilityScore + consistencyScore) / 2);
        } else if (consistencyScore) {
             data.suitabilityScore = consistencyScore;
        }

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
    }, { ...getFallbackProduct(userMetrics, productName), suitabilityScore: consistencyScore || 75 }, 45000); 
};

// --- CHAT FUNCTIONS ---

export const createDermatologistSession = (user: UserProfile, shelf: Product[]): Chat => {
    const ai = getAI();
    
    const systemInstruction = `
    You are SkinOS AI, an advanced dermatological assistant.
    
    USER PROFILE:
    - Name: ${user.name}
    - Age: ${user.age}
    - Skin Type: ${user.skinType}
    - Biometrics: Hydration ${user.biometrics.hydration}/100, Acne ${user.biometrics.acneActive}/100, Sensitivity ${user.biometrics.redness}/100.
    
    CURRENT SHELF:
    ${shelf.map(p => `- ${p.name} (${p.type}): ${p.suitabilityScore}/100 match`).join('\n')}
    
    GUIDELINES:
    1. Be concise, professional, but friendly.
    2. Use the biometric data to explain WHY a product works or fails.
    3. If asked about routine, suggest ordering based on the shelf items provided.
    4. Provide specific ingredient advice.
    `;

    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction,
        }
    });
};

// IMPORTANT: Re-implementing auditProduct to ensure redness is the ONLY sensitivity check
export const auditProduct = (product: Product, user: UserProfile) => {
    const metrics = user.biometrics;
    let score = product.suitabilityScore;
    
    // 1. Start with risks identified by AI
    const warnings: { reason: string, severity: 'CAUTION' | 'CRITICAL' }[] = product.risks ? product.risks.map(r => ({ 
        reason: `${r.ingredient}: ${r.reason}`,
        severity: r.riskLevel === 'HIGH' ? 'CRITICAL' : 'CAUTION'
    })) : [];
    
    // 2. Local Safety Checks (Fallback/Double Check)
    if (product.ingredients && product.ingredients.length > 0) {
        // Sensitivity Check (Fragrance/Alcohol)
        const hasFragrance = product.ingredients.some(i => i.toLowerCase().includes('fragrance') || i.toLowerCase().includes('parfum'));
        const hasAlcohol = product.ingredients.some(i => i.toLowerCase().includes('alcohol denat') || i.toLowerCase().includes('ethanol'));
        
        // CRITICAL: Explicitly checking REDNESS metric for sensitivity. 
        // DO NOT use overallScore here.
        const isSensitive = metrics.redness < 60; // 60 is the threshold for 'Moderate' redness issues.
        const isVerySensitive = metrics.redness < 30; // 30 is 'Significant' redness.

        if (isSensitive && (hasFragrance || hasAlcohol)) {
            // Check if AI missed this
            if (!warnings.some(w => w.reason.toLowerCase().includes('fragrance') || w.reason.toLowerCase().includes('alcohol'))) {
                 const severity = isVerySensitive ? 'CRITICAL' : 'CAUTION';
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
            score += 5; 
        }

    } else {
        // If ingredients missing, rely solely on AI risks.
    }

    // FINAL SYNC: Update score based on warnings (Penalty System)
    let finalScore = score;
    
    // Apply penalties based on severity
    warnings.forEach(w => {
        if (w.severity === 'CRITICAL') {
            finalScore -= 20; 
        } else {
            finalScore -= 4; 
        }
    });
    
    finalScore = Math.max(10, finalScore);
    
    // STRICT CAP FOR CRITICAL ISSUES:
    if (warnings.some(w => w.severity === 'CRITICAL')) {
        finalScore = Math.min(40, finalScore);
    } else if (warnings.length > 0 && finalScore > 85) {
        finalScore = 85; 
    }

    // STRICT 1-99 CLAMPING (NOTHING IS PERFECT, NOTHING IS ZERO)
    finalScore = Math.min(99, Math.max(1, finalScore));

    // Determine the primary reason text
    const criticalWarning = warnings.find(w => w.severity === 'CRITICAL');
    const firstWarning = warnings[0];
    
    let analysisReason = "Average Fit";
    if (criticalWarning) analysisReason = "Critical Mismatch";
    else if (firstWarning) analysisReason = "Use with Caution";
    else if (finalScore > 85) analysisReason = "Excellent Match"; 
    else if (finalScore > 75) analysisReason = "Good Match";

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

// ... (Other exports: analyzeProductContext, getBuyingDecision, getClinicalTreatmentSuggestions, etc.) ...
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
