
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
 * Wrapper for AI calls.
 */
async function runWithRetry<T>(
    operation: (ai: GoogleGenAI) => Promise<T>, 
    fallbackValue?: T
): Promise<T> {
    try {
        const ai = getAI();
        return await operation(ai);
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
        analysisSummary: "Offline Analysis: Based on computer vision metrics only.",
        observations: { redness: "Visible markers detected.", hydration: "Requires monitoring." }
    };
    
    return {
        overallScore: 78,
        acneActive: 85, acneScars: 80, poreSize: 72, blackheads: 75,
        wrinkleFine: 88, wrinkleDeep: 95, sagging: 90, pigmentation: 70,
        redness: 65, texture: 75, hydration: 60, oiliness: 55, darkCircles: 68,
        analysisSummary: "Offline Analysis: Skin appears generally healthy with mild sensitivity markers.",
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
        You are a Dermatological Analysis AI designed for precision and consistency.
        
        INPUT DATA:
        - Image: High-Resolution Face Scan.
        - Computer Vision Estimates (Reference): ${metricString}
        ${anchorContext}
        
        TASK:
        Grade the skin metrics (0-100). Higher is ALWAYS Better/Healthier.
        
        SCORING RUBRIC:
        - 90-100: Flawless / Ideal.
        - 75-89: Good / Minor imperfections.
        - 50-74: Visible issues (Acne, Redness, Lines).
        - 0-49: Severe issues.
        
        OUTPUT FORMAT: JSON.
        Fields: overallScore, acneActive, acneScars, poreSize, blackheads, wrinkleFine, wrinkleDeep, sagging, pigmentation, redness, texture, hydration, oiliness, darkCircles, skinAge, stabilityRating (0-100), analysisSummary (string).
        
        Be consistent. If unsure, lean towards the Reference scores.
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
            analysisSummary: aiData.analysisSummary || "Analysis Complete",
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
        let promptText = "Extract product name, brand, type (CLEANSER, TONER, SERUM, MOISTURIZER, SPF, TREATMENT, FOUNDATION, CONCEALER, POWDER, PRIMER, SETTING_SPRAY, BLUSH, BRONZER), ingredients, and Estimated Retail Price in MYR (Malaysian Ringgit). Analyze suitability (0-100). Return JSON.";
        
        if (userMetrics) {
            promptText = `
            Analyze this product image for a user with the following skin profile:
            - Hydration: ${userMetrics.hydration} (0-40 is DRY, 40-60 is NORMAL, 60+ is HYDRATED)
            - Oiliness: ${userMetrics.oiliness} (0-40 is OILY, 40-60 is NORMAL, 60+ is DRY)
            - Acne Score: ${userMetrics.acneActive} (Lower is worse)
            - Sensitivity/Redness: ${userMetrics.redness} (Lower is sensitive)
            
            STRICT SCORING RUBRIC (Consistency is Key):
            1. TYPE CLASSIFICATION: Infer the type (CLEANSER, ETC) based on keywords. "Face Wash" = CLEANSER. "Lotion" = MOISTURIZER. "Sunblock" = SPF.
            2. DRY SKIN CONTRADICTION: If User Hydration < 45 AND product is "Matte", "Oil-Free", "Clay", "Foaming", or contains Alcohol Denat/Salicylic Acid -> Suitability Score MUST be < 50. Even if it helps acne, it is BAD for dry skin.
            3. SENSITIVE SKIN CONTRADICTION: If User Redness < 50 AND product contains Fragrance, Essential Oils, or High % Acids -> Suitability Score MUST be < 55.
            4. PERFECT MATCH: High score (>85) requires the product to specifically target the user's Weakest Metric without harming others.
            
            TASKS:
            1. Extract Name, Brand, Type.
            2. Estimate "estimatedPrice" in MYR (Malaysian Ringgit) based on retailers like Watsons, Sephora Malaysia, or Guardian.
            3. Calculate 'suitabilityScore' (0-100) using the RUBRIC above.
            4. List Risks and Benefits for THIS user.
            
            Return JSON.
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
                temperature: 0,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING },
                        name: { type: Type.STRING },
                        brand: { type: Type.STRING },
                        ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                        risks: { 
                            type: Type.ARRAY, 
                            items: { 
                                type: Type.OBJECT, 
                                properties: { 
                                    ingredient: { type: Type.STRING }, 
                                    riskLevel: { type: Type.STRING }, 
                                    reason: { type: Type.STRING } 
                                } 
                            } 
                        },
                        benefits: { 
                            type: Type.ARRAY, 
                            items: { 
                                type: Type.OBJECT, 
                                properties: { 
                                    ingredient: { type: Type.STRING }, 
                                    target: { type: Type.STRING }, 
                                    description: { type: Type.STRING }, 
                                    relevance: { type: Type.STRING } 
                                } 
                            } 
                        },
                        suitabilityScore: { type: Type.NUMBER },
                        estimatedPrice: { type: Type.NUMBER },
                        type: { type: Type.STRING }
                    }
                }
            }
        });

        const data = JSON.parse(response.text || "{}");
        return {
            ...data,
            id: Date.now().toString(),
            dateScanned: Date.now()
        };
    }, getFallbackProduct(userMetrics));
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
    const warnings: { reason: string }[] = [];
    
    // Safety Checks
    if (metrics.redness < 60 && (product.ingredients.includes('Fragrance') || product.ingredients.includes('Alcohol Denat'))) {
        score = Math.min(score, 45);
        warnings.push({ reason: "Contains potential irritants (Fragrance/Alcohol) for sensitive skin." });
    }
    
    if (metrics.hydration < 50 && product.ingredients.some(i => ['Clay', 'Charcoal', 'Salicylic Acid'].includes(i))) {
        if (product.type !== 'CLEANSER') {
            score = Math.min(score, 50);
            warnings.push({ reason: "May be too drying for your current hydration levels." });
        }
    }

    return {
        adjustedScore: score,
        warnings,
        analysisReason: warnings.length > 0 ? "Safety Mismatch" : score > 80 ? "Great Match" : "Average Fit"
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
    const riskyProducts: { name: string, reason: string }[] = [];
    products.forEach(p => {
        const audit = auditProduct(p, user);
        if (audit.warnings.length > 0) {
            riskyProducts.push({ name: p.name, reason: audit.warnings[0].reason });
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
    const totalIssues = missing.length + conflicts.length + riskyProducts.length;
    if (totalIssues === 0 && products.length >= 3) grade = 'S';
    else if (totalIssues === 0) grade = 'A';
    else if (totalIssues > 2) grade = 'D';
    else if (totalIssues > 0) grade = 'C';

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

    if (audit.warnings.length > 0) {
        decision = 'AVOID';
        title = 'Bad Match';
        description = 'Contains ingredients that conflict with your skin profile.';
        color = 'rose';
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
