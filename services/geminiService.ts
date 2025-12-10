
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { Product, SkinMetrics, UserProfile } from "../types";

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

// --- AI FUNCTIONS ---

export const analyzeFaceSkin = async (
    imageBase64: string, 
    localMetrics?: SkinMetrics, 
    history?: SkinMetrics[]
): Promise<SkinMetrics> => {
    return runWithRetry(async (ai) => {
        // Construct a context string with the local deterministic data
        let promptContext = `
        You are a highly advanced AI Dermatologist with Context Awareness.
        Your goal is to analyze the user's face image and provide a clinical assessment (Scores 0-100) and a "clinical verdict" summary.
        
        INPUT CONTEXT - COMPUTER VISION PRE-ANALYSIS (Use as data anchor):
        - Acne/Blemishes Score: ${localMetrics?.acneActive || 'Unknown'} (Higher is Better)
        - Redness/Sensitivity Score: ${localMetrics?.redness || 'Unknown'} (Higher is Better)
        - Texture Score: ${localMetrics?.texture || 'Unknown'} (Higher is Better)
        
        CRITICAL SCORING GUIDE (Scale 0-100, where 100 is PERFECT):
        - 90-100: Excellent / Clear (No visible issues). Verdict must be POSITIVE.
        - 80-89: Good (Minor issues). Verdict should be mostly POSITIVE.
        - 60-79: Average (Visible issues). Verdict should be NEUTRAL/CONSTRUCTIVE.
        - 0-59: Poor / Critical (Severe issues). Verdict should be URGENT/CORRECTIVE.
        
        MANDATORY CONSISTENCY CHECK:
        - If 'acneActive' is > 85, you MUST NOT say "Acne is critical" or "Breakouts detected". You must say "Skin is clear" or "No active acne".
        - If 'redness' is > 85, you MUST NOT say "High inflammation". You must say "Skin tone is even".
        - Your 'analysisSummary' text MUST MATCH the numbers generated. Do not invent problems if the scores are high.
        
        SELF-CORRECTION RULE (Priority #1):
        - If you see visible acne, redness, or issues, you MUST output a low score (<70) for that metric, even if the "Computer Vision" score above is high. 
        - IGNORE the computer vision score if it contradicts your visual analysis of a severe issue.
        - If you write words like 'severe', 'critical', 'breakout', or 'inflamed' in the summary, the corresponding score MUST be below 60. Do not output 90.
        `;

        if (history && history.length > 0) {
            const sortedHistory = [...history].sort((a,b) => b.timestamp - a.timestamp);
            const lastScan = sortedHistory[0];
            const daysDiff = Math.abs((Date.now() - lastScan.timestamp) / (1000 * 60 * 60 * 24));
            const daysLabel = daysDiff < 1 ? "earlier today" : `${Math.round(daysDiff)} days ago`;

            promptContext += `
            
            PATIENT HISTORY (Last scan was ${daysLabel}):
            - Previous Overall Score: ${lastScan.overallScore}
            - Previous Acne Score: ${lastScan.acneActive}
            - Previous Redness Score: ${lastScan.redness}

            INTELLIGENT CONTEXT ANALYSIS (The "Wow" Factor):
            1. ENVIRONMENT & LIGHTING CHECK: 
               - If the photo is DIM, BLURRY, or has EXTREME SHADOWS: Do NOT trust the visual improvements fully. Anchor your scores heavily (70% weight) to the "Previous" scores.
               - If the photo is HIGH QUALITY: Trust your visual analysis (80% weight).
            
            2. REALITY CHECK (Anomaly Detection):
               - If "Acne" or "Redness" scores improved by >25 points in <2 days: This is physiologically impossible without makeup, filters, or extreme lighting changes. 
               - ACTION: Be skeptical. If the skin looks "too perfect" compared to history, assume **makeup** or **blur filters**.
               - SCORING: If you suspect makeup, penalize "Texture" and "Pore" scores to be realistic. Do not give 95+ just because foundation covered the redness.

            3. COMPARISON LOGIC:
               - Compare current state to history. Is it better? Worse? The same?
               - If stable, highlight consistency.
               - If significantly changed (and it looks real), celebrate it.
            `;
        } else {
             promptContext += `
             FIRST SCAN CONTEXT:
             - Establish a baseline. 
             - Analyze lighting: If poor, mention in summary that "better lighting might reveal more detail next time" but keep it brief.
             `;
        }

        promptContext += `
        VERDICT WRITING RULES (For 'analysisSummary'):
        1. STYLE: Direct, insightful, and "human-like". Avoid generic medical jargon. 
        2. BOLDING STRATEGY (Use Markdown **text**):
           - If a metric is GOOD (>85), bold the POSITIVE attribute (e.g., "**Clear Skin**", "**Healthy Barrier**").
           - If a metric is BAD (<60), bold the PROBLEM (e.g., "**Active Breakouts**", "**Inflammation**").
           - Do NOT bold "Acne" if the score is 95. That is confusing.
        3. CONTEXT AWARENESS (The "Wow" Moment):
           - If scores jump drastically overnight (better or worse), ACKNOWLEDGE it immediately. e.g., "Your acne score jumped up, but since it's only been 24 hours, this might be due to **different lighting**." or "Incredible recovery on the **inflammation**—that soothing serum is working fast."
           - If lighting is bad, mention it casually: "The lighting is a bit **dim**, so I'm relying on your history to fill in the blanks."
           - If consistent: "Your skin barrier is holding **steady**."
        4. CONTENT FOCUS:
           - Focus on the main data changes.
           - Keep it under 2 sentences.
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
                temperature: 0, // CRITICAL: Force deterministic output
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        overallScore: { type: Type.NUMBER },
                        acneActive: { type: Type.NUMBER },
                        acneScars: { type: Type.NUMBER },
                        poreSize: { type: Type.NUMBER },
                        blackheads: { type: Type.NUMBER },
                        wrinkleFine: { type: Type.NUMBER },
                        wrinkleDeep: { type: Type.NUMBER },
                        sagging: { type: Type.NUMBER },
                        pigmentation: { type: Type.NUMBER },
                        redness: { type: Type.NUMBER },
                        texture: { type: Type.NUMBER },
                        hydration: { type: Type.NUMBER },
                        oiliness: { type: Type.NUMBER },
                        darkCircles: { type: Type.NUMBER },
                        analysisSummary: { type: Type.STRING },
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
        if (!aiData.overallScore) throw new Error("Invalid AI Response");

        // Trust AI Scores more if there's a large discrepancy indicating the local vision missed something
        const trustAI = (local: number, ai: number) => {
             // If AI says 50 (Bad) and Local says 90 (Good), assume Local missed the issue -> Trust AI (e.g. 55)
             if (local > 80 && ai < 60) return Math.round((local * 0.1) + (ai * 0.9));
             // If AI says 90 (Good) and Local says 50 (Bad), assume AI hallucinated clarity or Local is strict -> Blend normally
             return Math.round((local * 0.20) + (ai * 0.80));
        };
        
        // Use AI scores directly for critical metrics if history logic applied, otherwise blend
        const finalMetrics: SkinMetrics = localMetrics ? {
            ...aiData,
            overallScore: trustAI(localMetrics.overallScore, aiData.overallScore),
            // We trust AI more for these complex texture analyses, but check for conflicts
            acneActive: trustAI(localMetrics.acneActive, aiData.acneActive),
            acneScars: trustAI(localMetrics.acneScars, aiData.acneScars),
            poreSize: trustAI(localMetrics.poreSize, aiData.poreSize),
            blackheads: trustAI(localMetrics.blackheads, aiData.blackheads),
            wrinkleFine: trustAI(localMetrics.wrinkleFine, aiData.wrinkleFine),
            wrinkleDeep: trustAI(localMetrics.wrinkleDeep, aiData.wrinkleDeep),
            sagging: trustAI(localMetrics.sagging, aiData.sagging),
            pigmentation: trustAI(localMetrics.pigmentation, aiData.pigmentation),
            redness: trustAI(localMetrics.redness, aiData.redness),
            texture: trustAI(localMetrics.texture, aiData.texture),
            hydration: trustAI(localMetrics.hydration, aiData.hydration),
            oiliness: trustAI(localMetrics.oiliness, aiData.oiliness),
            darkCircles: trustAI(localMetrics.darkCircles, aiData.darkCircles),
            skinAge: aiData.skinAge || localMetrics.skinAge,
            timestamp: Date.now()
        } : { ...aiData, timestamp: Date.now() };

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
    if (hasRetinol && hasAHA) conflicts.push("Retinol + AHA (Irritation Risk)");

    const riskyProducts = products.filter(p => auditProduct(p, user).warnings.length > 0)
                                  .map(p => ({ name: p.name, reason: auditProduct(p, user).warnings[0].reason }));

    // Redundancies
    const typeCounts = categories.reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const redundancies = Object.keys(typeCounts).filter(t => typeCounts[t] > 2).map(t => `Too many ${t}s`);

    // Grade
    let grade = 'B';
    if (missing.length === 0 && conflicts.length === 0 && riskyProducts.length === 0) grade = 'A';
    if (grade === 'A' && treatment > 50) grade = 'S';
    if (riskyProducts.length > 0 || conflicts.length > 0) grade = 'C';

    return {
        analysis: {
            grade,
            missing,
            conflicts,
            riskyProducts,
            redundancies,
            upgrades: riskyProducts.length > 0 ? [riskyProducts[0].name] : [],
            balance: { exfoliation, hydration, protection, treatment }
        }
    };
};

// Buying Decision Logic
export const getBuyingDecision = (product: Product, currentShelf: Product[], user: UserProfile) => {
    const audit = auditProduct(product, user);
    const context = analyzeProductContext(product, currentShelf);
    
    // Decision Logic
    let decision: 'BUY' | 'AVOID' | 'SWAP' | 'COMPARE' = 'COMPARE';
    let title = "Compare";
    let description = "Scores similarly to your current routine.";
    let color = "zinc";

    if (audit.warnings.length > 0) {
        decision = 'AVOID';
        title = "Avoid";
        description = "Contains ingredients that clash with your skin profile.";
        color = "rose";
    } else if (context.conflicts.length > 0) {
        decision = 'AVOID';
        title = "Conflict";
        description = `Clashes with ${context.conflicts.join(', ')} in your shelf.`;
        color = "amber";
    } else if (context.existingSameType.length > 0) {
        const current = context.existingSameType[0];
        const currentAudit = auditProduct(current, user);
        
        if (audit.adjustedScore > currentAudit.adjustedScore + 10) {
            decision = 'SWAP';
            title = "Upgrade";
            description = `Better match than your ${current.name}.`;
            color = "emerald";
        } else {
            decision = 'COMPARE';
            title = "Duplicate";
            description = `You already have ${current.name}. This isn't a significant upgrade.`;
            color = "zinc";
        }
    } else if (audit.adjustedScore > 85) {
        decision = 'BUY';
        title = "Excellent";
        description = "Great addition! Fills a gap in your routine.";
        color = "emerald";
    }

    return {
        verdict: { decision, title, description, color },
        audit,
        shelfConflicts: context.conflicts,
        existingSameType: context.existingSameType,
        comparison: {
            result: decision === 'SWAP' ? 'BETTER' : decision === 'COMPARE' ? 'SIMILAR' : 'WORSE',
            diff: 0
        }
    };
};

export const analyzeProductContext = (product: Product, shelf: Product[]) => {
    const conflicts = [];
    
    // Check Conflicts with Shelf
    if (product.ingredients.some(i => i.includes('Retinol'))) {
        if (shelf.some(p => p.ingredients.some(i => ['Glycolic Acid', 'Salicylic Acid'].includes(i)))) {
            conflicts.push("Exfoliating Acids");
        }
    }

    // Check Redundancy
    const existingSameType = shelf.filter(p => p.type === product.type);
    
    return {
        conflicts,
        existingSameType,
        typeCount: existingSameType.length
    };
};

export const getClinicalTreatmentSuggestions = (user: UserProfile) => {
    const metrics = user.biometrics;
    const suggestions = [];

    if (metrics.acneActive < 60 || metrics.poreSize < 60) {
        suggestions.push({
            name: "Salicylic Acid Peel",
            type: "TREATMENT",
            benefit: "Deep pore cleaning and acne reduction.",
            downtime: "1-2 Days"
        });
    }
    
    if (metrics.texture < 60 || metrics.acneScars < 70) {
        suggestions.push({
            name: "Microneedling",
            type: "TREATMENT",
            benefit: "Collagen induction for scars and texture.",
            downtime: "3-5 Days"
        });
    }

    if (metrics.hydration < 50) {
        suggestions.push({
            name: "Hydrafacial",
            type: "FACIAL",
            benefit: "Deep hydration and gentle exfoliation.",
            downtime: "None"
        });
    }

    if (metrics.redness < 60) {
        suggestions.push({
            name: "LED Therapy (Red/Yellow)",
            type: "FACIAL",
            benefit: "Reduces inflammation and promotes healing.",
            downtime: "None"
        });
    }

    // Default if skin is good
    if (suggestions.length === 0) {
        suggestions.push({
            name: "Maintenance Glow Facial",
            type: "FACIAL",
            benefit: "Maintains skin barrier and radiance.",
            downtime: "None"
        });
    }

    return suggestions.slice(0, 3);
};
