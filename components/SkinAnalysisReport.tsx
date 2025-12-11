
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SkinMetrics, Product, UserProfile } from '../types';
import { auditProduct, getClinicalTreatmentSuggestions } from '../services/geminiService';
import { RefreshCw, Sparkles, Sun, Moon, Ban, CheckCircle2, AlertTriangle, Target, BrainCircuit, Stethoscope, Plus, Microscope, X, FlaskConical, Search, ArrowRight, Pipette, Droplet, Layers, Fingerprint, Info, AlertOctagon, GitBranch, ArrowUpRight, Syringe, Zap, Activity, MessageCircle, ShieldAlert, TrendingUp, TrendingDown, Minus, ShoppingBag, ScanBarcode, ShieldCheck } from 'lucide-react';

// --- SUB COMPONENTS ---

const renderVerdict = (text: string) => {
  if (!text) return null;
  // Split by bold markers
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      // High contrast bolding for critical info
      return <strong key={i} className="font-black text-teal-900">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
};

interface MetricRingProps {
  label: string;
  value: number;
  metricKey: keyof SkinMetrics;
  onSelect: (key: keyof SkinMetrics) => void;
}

const MetricRing: React.FC<MetricRingProps> = ({ label, value, metricKey, onSelect }) => {
  let colorClass = "text-zinc-300"; 
  if (value < 60) colorClass = "text-rose-500"; 
  else if (value > 89) colorClass = "text-emerald-500"; 
  
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
      const observer = new IntersectionObserver(
          ([entry]) => {
              if (entry.isIntersecting) {
                  setIsVisible(true);
                  observer.disconnect(); 
              }
          },
          { threshold: 0.1 } 
      );

      if (elementRef.current) {
          observer.observe(elementRef.current);
      }

      return () => observer.disconnect();
  }, []);

  useEffect(() => {
      if (!isVisible) return;

      let start = 0;
      const duration = 1500;
      const startTime = performance.now();

      const animate = (time: number) => {
          const elapsed = time - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 4);
          
          setDisplayValue(Math.round(start + (value - start) * ease));

          if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
  }, [value, isVisible]);

  return (
      <button 
        ref={elementRef}
        onClick={() => onSelect(metricKey)}
        className="flex flex-col items-center justify-center p-2 relative transition-transform w-full group hover:scale-110 duration-300 ease-out"
      >
          <div className="relative w-11 h-11 flex items-center justify-center mb-3">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle
                    cx="50" cy="50" r="40"
                    className="text-black transition-colors opacity-10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8" 
                  />
                  <circle
                    cx="50" cy="50" r="40"
                    className={`${colorClass} transition-all duration-1000 ease-out`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeDasharray={`${displayValue * 2.51}, 251`}
                    strokeLinecap="round"
                    style={{ 
                        opacity: isVisible ? 1 : 0,
                        transition: 'opacity 0.5s ease-out'
                    }}
                  />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-[10px] font-black tracking-tighter text-black`}>{displayValue}</span>
              </div>
          </div>
          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest truncate w-full text-center group-hover:text-teal-600 transition-colors">{label}</span>
      </button>
  );
};

interface GroupSectionProps {
    title: string;
    score: number;
    delayClass?: string;
    children?: React.ReactNode;
}

const GroupSection: React.FC<GroupSectionProps> = ({ title, score, delayClass = "", children }) => (
  <div className={`modern-card rounded-[2rem] p-6 tech-reveal ${delayClass} hover:shadow-lg transition-shadow duration-500`}>
      <div className="flex justify-between items-center mb-6 px-1 border-b border-zinc-50 pb-4">
          <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest">{title}</h3>
          <div className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${score > 89 ? 'bg-emerald-50 text-emerald-600' : score < 60 ? 'bg-rose-50 text-rose-600' : 'text-zinc-400 bg-zinc-50'}`}>
              Avg: {Math.round(score)}
          </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
          {children}
      </div>
  </div>
);

interface MetricModalProps {
    metric: string; 
    score: number;
    age: number;
    observation?: string;
    onClose: () => void;
}

const MetricModal: React.FC<MetricModalProps> = ({ metric, score, age, observation, onClose }) => {
    const getAverage = () => {
        if (metric === 'sagging' || metric === 'wrinkleFine') return age < 30 ? 85 : 65;
        if (metric === 'oiliness') return age < 30 ? 60 : 80;
        return 75;
    };
    
    const avg = getAverage();
    const performance = score >= avg ? 'Above Average' : 'Below Average';

    const getObservation = () => {
        if (observation) return observation;
        
        const ROIMap: Record<string, string> = {
            'acneActive': 'Cheeks and Jawline',
            'acneScars': 'Cheek area',
            'poreSize': 'Nose/T-Zone',
            'blackheads': 'Nose and Chin',
            'wrinkleFine': 'Around eyes and forehead',
            'wrinkleDeep': 'Nasolabial folds and forehead',
            'sagging': 'Lower jawline contour',
            'pigmentation': 'Cheeks and forehead (Sun exposed areas)',
            'redness': 'Cheeks and nose bridge',
            'texture': 'Cheek surface',
            'hydration': 'General facial surface',
            'oiliness': 'Forehead and Nose (T-Zone)',
            'darkCircles': 'Under-eye area',
        };

        const location = ROIMap[metric] || 'Facial area';
        const severity = score < 60 ? 'Significant' : score < 80 ? 'Mild' : 'Minimal';
        
        if (metric === 'poreSize') return `${severity} enlargement detected on ${location} based on shadow analysis.`;
        if (metric === 'acneActive') return `${severity} inflammatory markers detected on ${location}.`;
        if (metric === 'redness') return `${severity} vascular reactivity observed on ${location}.`;
        if (metric === 'wrinkleFine') return `${severity} static lines detected ${location}.`;
        if (metric === 'pigmentation') return `${severity} melanin clustering observed on ${location}.`;
        
        if (score > 85) return `Healthy tissue density and clear skin surface detected on ${location}.`;
        return `${severity} biometric markers detected on ${location} needing attention.`;
    }

    const getDisplayTerm = (m: string) => {
        if (m === 'acneActive') return 'Acne';
        if (m === 'wrinkleFine') return 'Fine Lines';
        if (m === 'wrinkleDeep') return 'Wrinkles';
        if (m === 'poreSize') return 'Pores (Enlarged)';
        if (m === 'acneScars') return 'Scars/Marks';
        return m.charAt(0).toUpperCase() + m.slice(1);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/40 backdrop-blur-md animate-in fade-in duration-300">
             <div className="w-full max-w-sm bg-white rounded-[2.5rem] p-8 relative animate-in zoom-in-95 shadow-2xl">
                 <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-zinc-50 rounded-full text-zinc-400 hover:bg-zinc-100 transition-colors">
                     <X size={20} />
                 </button>

                 <div className="text-center mb-10 mt-4 tech-reveal">
                     <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{getDisplayTerm(metric)}</span>
                     <h2 className="text-7xl font-black text-zinc-900 mt-4 mb-4 tracking-tighter">{Math.round(score)}</h2>
                     <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-wide ${score > avg ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                         {performance}
                     </span>
                 </div>

                 <div className="mb-10 tech-reveal delay-100">
                     <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
                         <span>Peer Average ({avg})</span>
                         <span>You ({Math.round(score)})</span>
                     </div>
                     <div className="h-3 bg-zinc-100 rounded-full overflow-hidden relative">
                         <div className="absolute top-0 bottom-0 w-0.5 bg-zinc-400 z-10" style={{ left: `${avg}%` }} />
                         <div className={`h-full rounded-full transition-all duration-1000 draw-stroke ${score > 80 ? 'bg-emerald-400' : score > 60 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${score}%` }} />
                     </div>
                     <p className="text-[10px] text-zinc-400 mt-3 text-center">Comparing against age group: {age-5}-{age+5}</p>
                 </div>

                 <div className="bg-teal-50/50 rounded-2xl p-6 border border-teal-100/50 tech-reveal delay-200">
                     <h4 className="text-xs font-bold text-teal-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                         <Microscope size={14} /> AI Observation
                     </h4>
                     <p className="text-sm text-zinc-600 leading-relaxed font-medium">
                         {getObservation()}
                     </p>
                 </div>
             </div>
        </div>
    )
}

const getIngredientIcon = (name: string, action: string) => {
    const n = name.toLowerCase();
    const a = action.toLowerCase();
    
    if (n.includes('acid') || n.includes('bha') || n.includes('aha')) return <FlaskConical size={18} />;
    if (n.includes('vitamin c') || n.includes('bright') || a.includes('glow')) return <Sun size={18} />;
    if (n.includes('retinol') || n.includes('retinal') || n.includes('peptide')) return <Activity size={18} />;
    if (n.includes('hyaluronic') || n.includes('glycerin') || a.includes('hydrat')) return <Droplet size={18} />;
    if (n.includes('niacinamide') || n.includes('zinc')) return <ShieldCheck size={18} />;
    if (n.includes('spf') || a.includes('protect')) return <ShieldAlert size={18} />;
    if (n.includes('oil') || n.includes('extract')) return <Pipette size={18} />;
    
    return <Sparkles size={18} />;
};

interface RoutineRecommendation {
    ingredients: string[];
    benefit: string;
    formulation: string;
    vehicle: string;
    actionType: string;
    isFallback: boolean;
}

interface SkinAnalysisReportProps {
  userProfile: UserProfile;
  shelf: Product[];
  onRescan: () => void;
  onConsultAI: (query: string) => void;
  onViewProgress?: () => void;
}

const SkinAnalysisReport: React.FC<SkinAnalysisReportProps> = ({ userProfile, shelf, onRescan, onConsultAI, onViewProgress }) => {
  const metrics = userProfile.biometrics;
  const history = userProfile.scanHistory || [];
  const prevMetrics = history.length > 1 ? history[history.length - 2] : null;
  
  const age = userProfile.age || 25; 
  
  const [selectedMetric, setSelectedMetric] = useState<keyof SkinMetrics | null>(null);
  const [activeRoutineTab, setActiveRoutineTab] = useState<'AM' | 'PM'>('AM');
  const [complexity, setComplexity] = useState<'BASIC' | 'ADVANCED'>(userProfile.preferences?.complexity === 'ADVANCED' ? 'ADVANCED' : 'BASIC');
  const [isStrategyDismissed, setIsStrategyDismissed] = useState(false);
  const [isPrescriptionRevealed, setIsPrescriptionRevealed] = useState(false);
  
  const [isChartVisible, setIsChartVisible] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const observer = new IntersectionObserver(
          ([entry]) => {
              if (entry.isIntersecting) {
                  setIsChartVisible(true);
                  observer.disconnect();
              }
          },
          { threshold: 0.3 }
      );
      if (chartRef.current) observer.observe(chartRef.current);
      return () => observer.disconnect();
  }, []);

  const clinicalSuggestions = useMemo(() => {
      return getClinicalTreatmentSuggestions(userProfile);
  }, [userProfile]);

  const calculatedSkinType = useMemo(() => {
      const parts = [];
      const isSensitive = metrics.redness < 60;
      const isCriticallyDry = metrics.hydration < 45;
      const isOily = metrics.oiliness < 50;
      const isDry = metrics.hydration < 55;
      
      if (isSensitive) parts.push("Sensitive");

      if (isCriticallyDry) {
          parts.push("Dry");
      } else if (isOily) {
          parts.push("Oily");
      } else if (isDry) {
          parts.push("Dry");
      } else if (metrics.oiliness > 50 && metrics.oiliness < 70) {
          parts.push("Combination");
      } else {
          parts.push("Normal");
      }

      return parts.join(" + ");
  }, [metrics]);

  const groupAnalysis = useMemo(() => {
      const blemishScore = (metrics.acneActive + metrics.acneScars + metrics.blackheads + metrics.poreSize) / 4;
      const healthScore = (metrics.hydration + metrics.oiliness + metrics.redness + metrics.texture) / 4;
      const agingScore = (metrics.pigmentation + metrics.darkCircles + metrics.wrinkleFine + metrics.wrinkleDeep + metrics.sagging) / 5;

      const scores = [{ name: 'Blemishes', val: blemishScore }, { name: 'Skin Health', val: healthScore }, { name: 'Aging Signs', val: agingScore }].sort((a,b) => a.val - b.val);
      const lowestGroup = scores[0];

      let summary = "";
      if (metrics.analysisSummary) {
          summary = metrics.analysisSummary;
      } else {
          // Robust Fallback Logic with Bolding
          if (lowestGroup.val > 80) {
              summary = "Your skin demonstrates excellent resilience. **Maintenance is your primary goal** to preserve barrier integrity and elasticity.";
          } else if (lowestGroup.name === 'Blemishes') {
              summary = "Analysis detects congestion and active blemish markers. **Deep pore cleansing and oil control** should be the primary focus of your routine.";
          } else if (lowestGroup.name === 'Skin Health') {
              summary = "Your moisture barrier appears compromised. **Immediate hydration and soothing** are required to reduce sensitivity and restore balance.";
          } else {
              summary = "Early structural changes are visible. **Collagen support and sun protection** are critical to prevent deepening of fine lines.";
          }
      }

      return { blemishScore, healthScore, agingScore, priorityCategory: lowestGroup.name, priorityScore: lowestGroup.val, summaryText: summary };
  }, [metrics]);

  const progressVerdict = useMemo(() => {
      if (!prevMetrics) {
          return {
              status: "Baseline Established",
              trend: 0,
              verdictTitle: "Analysis Complete",
              verdictText: "We've mapped your skin's starting point. Add products to your shelf and scan again regularly to track real efficacy.",
              color: "text-zinc-600 bg-zinc-50 border-zinc-200"
          };
      }

      const diff = metrics.overallScore - prevMetrics.overallScore;
      const trend = Math.round(((metrics.overallScore - prevMetrics.overallScore) / prevMetrics.overallScore) * 100);
      
      // Calculate specific metric changes
      const changes = [
          { name: 'Redness', val: metrics.redness - prevMetrics.redness },
          { name: 'Hydration', val: metrics.hydration - prevMetrics.hydration },
          { name: 'Acne', val: metrics.acneActive - prevMetrics.acneActive },
          { name: 'Texture', val: metrics.texture - prevMetrics.texture }
      ].sort((a, b) => Math.abs(b.val) - Math.abs(a.val));
      
      const biggestChange = changes[0];

      // Find products added between the two scan timestamps
      const newProducts = shelf.filter(p => p.dateScanned > prevMetrics.timestamp && p.dateScanned < metrics.timestamp);
      const latestProduct = newProducts.length > 0 ? newProducts[newProducts.length - 1] : null;

      let verdictText = "";
      let title = "";
      
      // Changed threshold to < 5 (roughly 4%) to be more lenient on "stability"
      if (Math.abs(diff) < 5) {
          let status = "Steady";
          let color = "text-zinc-500 bg-zinc-50 border-zinc-200";

          // Context-aware titles to avoid saying "Stable" when condition is bad
          if (metrics.overallScore > 80) {
              title = "Health Maintained";
              status = "Maintained";
              color = "text-emerald-700 bg-emerald-50 border-emerald-100";
          } else if (metrics.overallScore < 60) {
              title = "Condition Persistent";
              status = "Persistent";
              color = "text-amber-700 bg-amber-50 border-amber-100";
          } else {
              title = "Consistent State";
              status = "Consistent";
          }
          
          verdictText = "Your skin metrics are hovering in the same range. No significant reactions or major improvements detected recently.";
          return { status: status, trend, verdictTitle: title, verdictText, color: color };
      }

      const improved = diff > 0;
      title = improved ? "Improving" : "Declining";
      
      if (improved) {
          if (latestProduct && biggestChange.val > 0) {
               // Attribution Logic
               verdictText = `The ${latestProduct.name} appears to be helping. ${biggestChange.name} has improved by +${Math.round(biggestChange.val)} points.`;
          } else {
               verdictText = `Routine is effective. ${biggestChange.name} shows the strongest improvement (+${Math.round(biggestChange.val)} points).`;
          }
          return { status: "Improving", trend, verdictTitle: title, verdictText, color: "text-emerald-700 bg-emerald-50 border-emerald-100" };
      } else {
           if (latestProduct && biggestChange.val < 0) {
               // Negative Attribution
               verdictText = `Monitor ${latestProduct.name}. ${biggestChange.name} has dropped by ${Math.round(biggestChange.val)} points since adding it.`;
          } else {
               verdictText = `Regression detected. ${biggestChange.name} has worsened (-${Math.abs(Math.round(biggestChange.val))} points). Check routine for irritants.`;
          }
          return { status: "Declining", trend, verdictTitle: title, verdictText, color: "text-rose-700 bg-rose-50 border-rose-100" };
      }

  }, [metrics, prevMetrics, shelf]);

  const prescription = useMemo(() => {
    let rankedConcerns = [
        { id: 'acneActive', score: metrics.acneActive }, { id: 'acneScars', score: metrics.acneScars },
        { id: 'pigmentation', score: metrics.pigmentation }, { id: 'redness', score: metrics.redness },
        { id: 'wrinkleFine', score: metrics.wrinkleFine }, { id: 'wrinkleDeep', score: metrics.wrinkleDeep },
        { id: 'hydration', score: metrics.hydration }, { id: 'oiliness', score: metrics.oiliness },
        { id: 'poreSize', score: metrics.poreSize }, { id: 'blackheads', score: metrics.blackheads },
        { id: 'texture', score: metrics.texture }, { id: 'sagging', score: metrics.sagging },
        { id: 'darkCircles', score: metrics.darkCircles }
    ];

    rankedConcerns = rankedConcerns.map(c => {
        if (c.id === 'acneActive') return { ...c, score: c.score - 15 }; 
        if (c.id === 'redness') return { ...c, score: c.score - 10 };   
        return c;
    });

    const goals = userProfile.preferences?.goals || [];
    if (goals.length > 0) {
        if (goals.includes('Look Younger & Firm')) {
             const idx = rankedConcerns.findIndex(c => c.id === 'wrinkleFine');
             if (idx > -1) rankedConcerns[idx].score -= 5;
        }
        if (goals.includes('Clear Acne & Blemishes')) {
             const idx = rankedConcerns.findIndex(c => c.id === 'acneActive');
             if (idx > -1) rankedConcerns[idx].score -= 5;
        }
    }

    rankedConcerns.sort((a, b) => a.score - b.score);
    // Expand concern list for advanced complexity
    const concernLimit = complexity === 'ADVANCED' ? 6 : 3;
    const topConcerns = rankedConcerns.slice(0, concernLimit);

    const ingredients: { name: string, action: string, context?: string, isSafetySwap?: boolean }[] = [];
    
    topConcerns.forEach(concern => {
        switch(concern.id) {
            case 'acneActive': ingredients.push({ name: 'Salicylic Acid', action: 'Deep clean your pores' }, { name: 'Benzoyl Peroxide', action: 'Eliminate acne bacteria' }); break;
            case 'acneScars': ingredients.push({ name: 'Azelaic Acid', action: 'Fade redness and marks' }, { name: 'Niacinamide', action: 'Balance oil and tone' }); break;
            case 'pigmentation': ingredients.push({ name: 'Vitamin C', action: 'Boost radiance and glow' }, { name: 'Tranexamic Acid', action: 'Target stubborn dark spots' }); break;
            case 'redness': ingredients.push({ name: 'Centella', action: 'Calm irritated skin' }, { name: 'Panthenol', action: 'Strengthen skin barrier' }); break;
            case 'wrinkleFine': ingredients.push({ name: 'Retinol', action: 'Refine texture and lines' }, { name: 'Peptides', action: 'Boost skin elasticity' }); break;
            case 'wrinkleDeep': ingredients.push({ name: 'Retinal', action: 'Accelerate skin renewal' }, { name: 'Growth Factors', action: 'Repair deep damage' }); break;
            case 'hydration': ingredients.push({ name: 'Hyaluronic Acid', action: 'Lock in deep moisture' }, { name: 'Polyglutamic Acid', action: 'Intense surface hydration' }); break;
            case 'oiliness': ingredients.push({ name: 'Niacinamide', action: 'Balance oil and tone' }, { name: 'Green Tea', action: 'Soothe and protect' }); break;
            case 'poreSize': ingredients.push({ name: 'BHA', action: 'Unclog congested pores' }, { name: 'Niacinamide', action: 'Tighten pore appearance' }); break;
            case 'blackheads': ingredients.push({ name: 'Salicylic Acid', action: 'Deep clean your pores' }, { name: 'Clay', action: 'Detoxify excess oil' }); break;
            case 'texture': ingredients.push({ name: 'Glycolic Acid', action: 'Resurface skin texture' }, { name: 'Urea', action: 'Hydrate and exfoliate' }); break;
            case 'sagging': ingredients.push({ name: 'Copper Peptides', action: 'Restore firmness' }, { name: 'Vitamin C', action: 'Boost radiance and glow' }); break;
            case 'darkCircles': ingredients.push({ name: 'Caffeine', action: 'Reduce under-eye bags' }); break;
        }
    });

    const limit = complexity === 'ADVANCED' ? 8 : 4;
    let uniqueIngredients = ingredients.filter((v,i,a)=>a.findIndex(t=>(t.name===v.name))===i).slice(0, limit);

    // --- CLINICAL SAFETY LAYER ---
    const isDehydrated = metrics.hydration < 45;
    const isSensitive = metrics.redness < 50;

    uniqueIngredients = uniqueIngredients.map(ing => {
        // Hydration Safety Swaps
        if (isDehydrated) {
            if (ing.name === 'Glycolic Acid') return { name: 'Lactic Acid', action: 'Gentle exfoliation', context: 'Swapped from Glycolic due to low hydration.', isSafetySwap: true };
            if (ing.name === 'Salicylic Acid') return { name: 'Willow Bark', action: 'Natural pore cleansing', context: 'Swapped from BHA to prevent drying.', isSafetySwap: true };
            if (ing.name === 'Retinol' || ing.name === 'Retinal') return { name: 'Bakuchiol', action: 'Gentle anti-aging', context: 'Swapped from Retinol to preserve moisture.', isSafetySwap: true };
            if (ing.name === 'Benzoyl Peroxide') return { name: 'Sulfur', action: 'Gentle acne treatment', context: 'Less drying than Benzoyl Peroxide.', isSafetySwap: true };
            if (ing.name === 'Clay') return { name: 'Enzyme Mask', action: 'Non-abrasive smoothing', context: 'Non-drying alternative to Clay.', isSafetySwap: true };
        }
        
        // Sensitivity Safety Swaps
        if (isSensitive) {
            if (ing.name === 'Glycolic Acid' || ing.name === 'Lactic Acid') return { name: 'PHA', action: 'Sensitive skin renewal', context: 'Acid swapped for sensitive skin safety.', isSafetySwap: true };
            if (ing.name === 'Vitamin C') return { name: 'Magnesium Ascorbyl Phosphate', action: 'Gentle brightening', context: 'Non-stinging Vitamin C form.', isSafetySwap: true };
            if (ing.name === 'Retinol') return { name: 'Peptides', action: 'Boost skin elasticity', context: 'Retinol is too harsh for current sensitivity.', isSafetySwap: true };
        }

        return ing;
    });

    const avoid: string[] = [];
    if (metrics.redness < 65) avoid.push('Fragrance', 'Alcohol Denat', 'Essential Oils');
    if (metrics.hydration < 55) avoid.push('Clay Masks', 'SLS', 'High % Acids');
    if (metrics.acneActive < 65 || metrics.oiliness < 55) avoid.push('Coconut Oil', 'Shea Butter', 'Mineral Oil');
    if (avoid.length === 0) avoid.push('Harsh Physical Scrubs');

    return { topConcerns, ingredients: uniqueIngredients, avoid, hasSafetySwaps: uniqueIngredients.some(i => i.isSafetySwap) };
  }, [metrics, complexity, userProfile.preferences]);

  const routinePlan = useMemo(() => {
    const plan: Record<string, RoutineRecommendation> = {};
    const usedIngredients = new Set<string>();

    const vehicleMap: Record<string, string[]> = {
        'CLEANSER': ['Salicylic Acid', 'Benzoyl Peroxide', 'Glycolic Acid', 'Lactic Acid', 'BHA', 'AHA', 'Tea Tree', 'Oat', 'Centella', 'Willow Bark', 'Sulfur', 'Panthenol', 'Niacinamide', 'Ceramides', 'Green Tea', 'Zinc'],
        'TONER': ['Glycolic Acid', 'Salicylic Acid', 'Lactic Acid', 'BHA', 'AHA', 'Centella', 'Green Tea', 'Hyaluronic Acid', 'PHA', 'Willow Bark', 'Panthenol', 'Niacinamide'],
        'SERUM': ['Retinol', 'Retinal', 'Vitamin C', 'Niacinamide', 'Tranexamic Acid', 'Alpha Arbutin', 'Peptides', 'Copper Peptides', 'Azelaic Acid', 'Hyaluronic Acid', 'Growth Factors', 'Bakuchiol', 'Magnesium Ascorbyl Phosphate', 'Centella', 'Panthenol', 'Polyglutamic Acid'],
        'MOISTURIZER': ['Ceramides', 'Urea', 'Peptides', 'Centella', 'Panthenol', 'Squalane', 'Hyaluronic Acid', 'Retinol', 'Niacinamide', 'Salicylic Acid', 'Vitamin C', 'Azelaic Acid', 'Bakuchiol', 'Green Tea', 'Oat'],
        'SPF': ['Zinc Oxide', 'Titanium Dioxide', 'Vitamin C', 'Niacinamide', 'Ceramides', 'Hyaluronic Acid', 'Centella'],
        'TREATMENT': ['Benzoyl Peroxide', 'Salicylic Acid', 'Adapalene', 'Azelaic Acid', 'Retinol', 'Tretinoin', 'Sulfur', 'Willow Bark']
    };

    const supportiveIngredients: Record<string, string[]> = {
        'CLEANSER': ['Glycerin', 'Prebiotics', 'Panthenol', 'Oat', 'Green Tea'],
        'TONER': ['Hyaluronic Acid', 'Rose Water', 'Chamomile'],
        'SERUM': ['Peptides', 'Ceramides', 'Vitamin E'],
        'MOISTURIZER': ['Squalane', 'Shea Butter', 'Allantoin', 'Ceramides'],
        'SPF': ['Antioxidants', 'Aloe Vera'],
        'TREATMENT': ['Sulfur', 'Zinc']
    };

    const getFormulation = (step: string): string => {
        const isOily = metrics.oiliness < 50;
        const isDry = metrics.hydration < 55 || metrics.oiliness > 80;
        const isSensitive = metrics.redness < 60;

        switch(step) {
            case 'CLEANSER':
                if (isOily) return "Foaming Gel";
                if (isDry) return "Milky Lotion";
                if (isSensitive) return "Fragrance-Free Gel";
                return "Gentle Gel";
            case 'TONER':
                if (isOily) return "Light Liquid";
                if (isDry) return "Milky Essence";
                return "Hydrating Mist";
            case 'SERUM':
                if (isOily) return "Water-based";
                if (isDry) return "Oil-in-Water Emulsion";
                return "Lightweight Fluid";
            case 'MOISTURIZER':
                if (isOily) return "Gel-Cream";
                if (isDry) return "Rich Cream or Balm";
                return "Light Cream";
            case 'SPF':
                if (isOily) return "Matte / Oil-Free";
                if (isSensitive) return "Mineral (Zinc Based)";
                return "Invisible Finish";
            case 'TREATMENT':
                return "Spot Gel";
            default: return "Standard";
        }
    };

    const sortedActiveNeeds = [...prescription.ingredients]; 

    // DYNAMIC SLOTS based on Complexity
    let slotsToFill: { key: string, type: string, time: 'AM' | 'PM' }[] = [];

    const isVeryOily = metrics.oiliness < 45;

    if (complexity === 'BASIC') {
        slotsToFill = [
             { key: 'SERUM_AM', type: 'SERUM', time: 'AM' }, 
             { key: 'SPF_AM', type: 'SPF', time: 'AM' },
             { key: 'CLEANSER_PM', type: 'CLEANSER', time: 'PM' }, 
             { key: 'CLEANSER_AM', type: 'CLEANSER', time: 'AM' }
        ];

        if (isVeryOily) {
             slotsToFill.push({ key: 'SERUM_PM', type: 'SERUM', time: 'PM' });
        } else {
             slotsToFill.push({ key: 'MOISTURIZER_PM', type: 'MOISTURIZER', time: 'PM' });
        }
    } else {
        slotsToFill = [
            { key: 'SERUM_PM', type: 'SERUM', time: 'PM' }, 
            { key: 'TREATMENT_PM', type: 'TREATMENT', time: 'PM' }, 
            { key: 'SERUM_AM', type: 'SERUM', time: 'AM' }, 
            { key: 'MOISTURIZER_PM', type: 'MOISTURIZER', time: 'PM' },
            { key: 'TONER_PM', type: 'TONER', time: 'PM' },
            { key: 'TONER_AM', type: 'TONER', time: 'AM' },
            { key: 'SPF_AM', type: 'SPF', time: 'AM' },
            { key: 'CLEANSER_PM', type: 'CLEANSER', time: 'PM' },
            { key: 'CLEANSER_AM', type: 'CLEANSER', time: 'AM' }
        ];
    }

    slotsToFill.forEach(slot => {
        const formulation = getFormulation(slot.type);

        let primary = sortedActiveNeeds.find(p => {
            const fitsVehicle = vehicleMap[slot.type]?.some(v => p.name.includes(v));
            if (!fitsVehicle) return false;

            const isPMOnly = ['Retinol', 'Retinal', 'Growth Factors', 'Glycolic Acid', 'AHA', 'Tretinoin', 'Bakuchiol'].some(x => p.name.includes(x));
            const isAMOnly = ['Vitamin C', 'SPF'].some(x => p.name.includes(x));
            if (slot.time === 'AM' && isPMOnly) return false;
            if (slot.time === 'PM' && isAMOnly) return false;

            return !usedIngredients.has(p.name);
        });

        if (primary) {
            usedIngredients.add(primary.name);
            const alternatives = vehicleMap[slot.type]?.filter(n => n !== primary?.name).slice(0, 2) || [];
            
            plan[slot.key] = {
                ingredients: [primary.name, ...alternatives],
                vehicle: slot.type,
                formulation: formulation,
                benefit: `Goal: ${primary.action.replace(/\.$/, '')}`,
                actionType: slot.type === 'CLEANSER' ? 'Wash-off Active' : 'Leave-on Active',
                isFallback: false
            };
        } else {
            let fallbackBenefit = "Maintenance";
            let fallbackIngs = supportiveIngredients[slot.type] || ['Glycerin'];
            
            if (slot.type === 'CLEANSER') {
                const isOily = metrics.oiliness < 50;
                fallbackBenefit = isOily ? 'Oil Control' : 'Gentle Cleansing';
                if (isOily) fallbackIngs = ['Tea Tree', 'Clay']; 
                else if (metrics.hydration < 55) fallbackIngs = ['Glycerin', 'Oat']; // Specific for dry skin
            }
            else if (slot.type === 'TONER') fallbackBenefit = 'pH Balance';
            else if (slot.type === 'SERUM') fallbackBenefit = slot.time === 'AM' ? 'Antioxidant Protection' : 'Repair & Recovery';
            else if (slot.type === 'MOISTURIZER') {
                fallbackBenefit = 'Barrier Support';
                if (metrics.hydration < 50) fallbackIngs = ['Ceramides', 'Squalane'];
            }
            else if (slot.type === 'SPF') fallbackBenefit = 'UV Defense';
            else if (slot.type === 'TREATMENT') fallbackBenefit = 'Targeted Correction';

            plan[slot.key] = {
                ingredients: fallbackIngs,
                vehicle: slot.type,
                formulation: formulation,
                benefit: fallbackBenefit,
                actionType: 'Key Ingredient', // Updated label from 'Essential Base'
                isFallback: true
            };
        }
    });

    return plan;
  }, [prescription, metrics, complexity]);

  const findBestMatch = (type: string, stepName: string) => {
      let candidates = shelf.filter(p => {
          if (type === 'CLEANSER') return p.type === 'CLEANSER';
          if (type === 'TONER') return p.type === 'TONER';
          if (type === 'SERUM') return p.type === 'SERUM' || p.type === 'TREATMENT';
          if (type === 'TREATMENT') return p.type === 'TREATMENT' || p.type === 'SERUM';
          if (type === 'MOISTURIZER') return p.type === 'MOISTURIZER';
          if (type === 'SPF') return p.type === 'SPF' || (p.type === 'MOISTURIZER' && p.name.toLowerCase().includes('spf'));
          return false;
      });

      if (candidates.length === 0) return null;

      const scored = candidates.map(p => {
          const audit = auditProduct(p, userProfile);
          let score = audit.adjustedScore;
          const hasPrescribed = prescription.ingredients.some(i => p.ingredients.join(' ').toLowerCase().includes(i.name.toLowerCase()));
          if (hasPrescribed) score += 15;
          return { product: p, score, audit, hasPrescribed };
      });

      scored.sort((a,b) => b.score - a.score);
      return scored[0];
  };

  const RoutineStep = ({ step, type, time }: { step: string, type: string, time: 'AM' | 'PM' }) => {
      const match = findBestMatch(type, step);
      const planKey = `${type}_${time}`;
      const rec = routinePlan[planKey] || { ingredients: ['Recommended'], vehicle: type, formulation: 'Standard', benefit: 'Care', actionType: 'Standard', isFallback: true };

      return (
          <div className="modern-card rounded-[1.5rem] p-6 relative transition-all hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl duration-300 animate-in slide-in-from-bottom-2 group cursor-default">
               <div className="flex justify-between items-start mb-4">
                   <div className="flex items-center gap-3">
                       <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 px-2 py-1 rounded-md border border-zinc-100 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
                         {step} • <span className="font-black group-hover:text-white text-zinc-700">{type}</span>
                       </span>
                       {match?.hasPrescribed && match.audit.warnings.length === 0 && (
                           <span className="pulse-ring text-[10px] font-bold text-teal-600 flex items-center gap-1 bg-teal-50 px-2 py-1 rounded-md">
                               <Sparkles size={10} /> Smart Choice
                           </span>
                       )}
                   </div>
                   {match && (
                       <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide ${match.audit.warnings.length > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                           {match.audit.warnings.length > 0 ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                           {match.audit.adjustedScore}% Match
                       </div>
                   )}
               </div>

               {match ? (
                   <div>
                       <h4 className="font-bold text-sm text-zinc-900 truncate leading-tight tracking-tight">{match.product.name}</h4>
                       <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest mb-4">{match.product.brand || 'Unknown Brand'}</p>
                       <div className="text-[11px] p-3 bg-zinc-50 rounded-xl text-zinc-600 font-medium border border-zinc-100">
                           {match.audit.warnings.length > 0 ? (
                               <p className="text-rose-600 font-bold flex gap-2 items-center"><Ban size={12}/> {match.audit.warnings[0].reason}</p>
                           ) : (
                               <p className="flex gap-2 items-center">
                                   <BrainCircuit size={12} className="text-teal-500 shrink-0" />
                                   {match.hasPrescribed ? `Contains prescribed ${prescription.ingredients.find(i => match.product.ingredients.join(' ').toLowerCase().includes(i.name.toLowerCase()))?.name || 'actives'}.` : `Safe, effective formula.`}
                               </p>
                           )}
                       </div>
                   </div>
               ) : (
                   <div className="border border-dashed border-zinc-200 rounded-xl p-5 bg-zinc-50/50 hover:bg-zinc-50 transition-colors group-hover:border-teal-200 group-hover:bg-teal-50/30">
                       <div className="flex items-center gap-2 mb-4 tech-reveal">
                           <div className="w-6 h-6 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0 text-teal-500">
                              <Target size={12} />
                           </div>
                           <span className="text-[10px] font-bold uppercase tracking-widest text-teal-700">{rec.benefit}</span>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-4 mb-4">
                           {/* Key Active Section - Now Shows Supportive Ingredients even if Fallback */}
                           <div className="tech-reveal delay-100">
                               <span className="text-[9px] font-bold text-zinc-400 uppercase block mb-1">Key Ingredient</span>
                               <div className="text-sm font-black text-zinc-900 tracking-tight flex items-center gap-2">
                                   {rec.ingredients[0]}
                               </div>
                           </div>

                           <div className="tech-reveal delay-200">
                               <span className="text-[9px] font-bold text-zinc-400 uppercase block mb-1">Recommended Formula</span>
                               <div className="text-sm font-bold text-zinc-700 tracking-tight flex items-center gap-2">
                                   {rec.formulation}
                               </div>
                           </div>
                       </div>
                       
                       <div className="pt-3 border-t border-zinc-200/50 flex items-center justify-between tech-reveal delay-300">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-zinc-400 uppercase">Or try:</span>
                                <div className="flex flex-wrap gap-1">
                                    {rec.ingredients.slice(1).map((alt, i) => (
                                        <span key={i} className="text-[9px] font-medium text-zinc-500 bg-white px-1.5 py-0.5 rounded border border-zinc-100">{alt}</span>
                                    ))}
                                </div>
                            </div>
                            <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded">{rec.actionType}</span>
                       </div>
                   </div>
               )}
          </div>
      )
  };

  const priorityColor = groupAnalysis.priorityScore > 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-rose-600 bg-rose-50 border-rose-100';
  const priorityLabel = groupAnalysis.priorityScore > 80 ? 'Maintenance' : 'Focus';

  // LOGIC FOR CLINICAL VERDICT TAG
  const isAnonymous = userProfile.isAnonymous;
  const hasHistory = userProfile.scanHistory && userProfile.scanHistory.length > 1;

  let verdictTagText = "";
  let verdictTagColor = "";
  let verdictBodyText = renderVerdict(groupAnalysis.summaryText);

  if (isAnonymous) {
      verdictTagText = "BASELINE SET";
      verdictTagColor = "bg-zinc-100 text-zinc-600 border-zinc-200";
      // Enhance body text for guest
      verdictBodyText = (
          <>
            {verdictBodyText} <span className="block mt-2 font-medium italic text-teal-600/80">Rescan regularly to build a clinical history and unlock trend analysis.</span>
          </>
      );
  } else if (!hasHistory) {
       verdictTagText = "BASELINE ESTABLISHED";
       verdictTagColor = "bg-zinc-100 text-zinc-600 border-zinc-200";
  } else {
       // Registered user with history
       const status = progressVerdict.status.toUpperCase();
       verdictTagText = status;
       
       if (status === 'IMPROVING' || status === 'MAINTAINED') {
           verdictTagColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
       } else if (status === 'DECLINING' || status === 'PERSISTENT') {
           verdictTagColor = "bg-rose-50 text-rose-700 border-rose-100";
       } else {
           verdictTagText = "STABLE";
           verdictTagColor = "bg-zinc-50 text-zinc-600 border-zinc-200";
       }
  }

  return (
    <div className="space-y-12 pb-32">
        {/* PROGRESS TRACKER OVERLAY ON HERO */}
        <div className="modern-card rounded-[2.5rem] overflow-hidden relative group hover:shadow-2xl transition-shadow duration-500">
            <div className="relative w-full overflow-hidden aspect-[4/5] sm:aspect-[16/9] bg-black">
                 {userProfile.faceImage ? (
                    <img src={userProfile.faceImage} className="w-full h-full object-cover opacity-100" alt="Clinical Scan" />
                 ) : (
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-500 font-mono text-xs uppercase">No Clinical Data</div>
                 )}
                 <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                 
                 <button onClick={onRescan} className="absolute top-6 right-6 z-20 bg-black/40 backdrop-blur-md text-white px-5 py-2.5 rounded-full flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-black/60 transition-colors border border-white/10 shadow-lg">
                    <RefreshCw size={12} /> Rescan
                 </button>

                 {/* DYNAMIC PROGRESS VERDICT UI */}
                 <div className="absolute bottom-0 left-0 right-0 p-8 text-white z-10">
                     {/* Mini Stat Row - Moved up since text is gone, kept simple */}
                     <div className="flex gap-6 border-t border-white/10 pt-4 tech-reveal delay-100">
                        <div>
                             <span className="text-[9px] font-bold text-teal-400 uppercase tracking-widest block mb-0.5">Score</span>
                             <span className="text-xl font-black text-white">{metrics.overallScore}</span>
                        </div>
                        <div>
                             <span className="text-[9px] font-bold text-teal-400 uppercase tracking-widest block mb-0.5">Priority</span>
                             <span className="text-xl font-black text-white">{groupAnalysis.priorityCategory}</span>
                        </div>
                        <div>
                             <span className="text-[9px] font-bold text-teal-400 uppercase tracking-widest block mb-0.5">Skin Type</span>
                             <span className="text-xl font-black text-white flex items-center gap-1.5">
                                {calculatedSkinType.split('+')[0].trim()}
                             </span>
                        </div>
                     </div>
                 </div>
            </div>
        </div>

        {/* CLINICAL VERDICT SECTION */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-100 tech-reveal delay-100 flex flex-col sm:flex-row gap-4">
             <div className="flex-1">
                 <div className="flex items-center justify-between mb-3">
                     <div className="flex items-center gap-2">
                        <Stethoscope size={14} className="text-teal-500" />
                        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                            Clinical Verdict
                        </h3>
                     </div>
                     <span className={`text-[9px] font-bold px-2 py-1 rounded border ${verdictTagColor}`}>
                        {verdictTagText}
                     </span>
                 </div>
                 <p className="text-sm text-zinc-600 font-normal leading-relaxed">
                    {verdictBodyText}
                 </p>
             </div>
             
             {!isAnonymous && hasHistory && onViewProgress && (
                 <button 
                    onClick={onViewProgress}
                    className="shrink-0 flex items-center justify-center gap-2 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 rounded-xl px-5 py-3 text-xs font-bold uppercase tracking-wide border border-zinc-200 transition-colors self-start sm:self-center w-full sm:w-auto"
                 >
                    <TrendingUp size={14} /> See My Progress
                 </button>
             )}
        </div>

        <div ref={chartRef} className="modern-card rounded-[2.5rem] p-10 flex flex-col items-center relative overflow-hidden animate-in slide-in-from-bottom-8 duration-700 delay-100 chart-container group cursor-crosshair">
             <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest mb-10">Balance Matrix</h3>
             
             <div className="relative w-full max-w-[260px] aspect-square chart-zoom">
                 <svg viewBox="-10 -10 140 140" className="w-full h-full">
                     {[20, 40, 60].map(r => (
                        <circle key={r} cx="60" cy="60" r={r/2} fill="none" stroke="#F4F4F5" strokeWidth="1" className={isChartVisible ? "draw-stroke" : "opacity-0"} />
                     ))}
                     
                     {[0, 60, 120, 180, 240, 300].map(deg => {
                         const rad = deg * Math.PI / 180;
                         return <line key={deg} x1="60" y1="60" x2={60 + 30*Math.cos(rad)} y2={60 + 30*Math.sin(rad)} stroke="#F4F4F5" strokeWidth="1" className={isChartVisible ? "draw-stroke" : "opacity-0"} />
                     })}
                     
                     {(() => {
                         const pts = [
                             { v: metrics.acneActive, a: -Math.PI/2 }, { v: metrics.redness, a: -Math.PI/6 },
                             { v: metrics.texture, a: Math.PI/6 }, { v: metrics.oiliness, a: Math.PI/2 },
                             { v: metrics.hydration, a: 5*Math.PI/6 }, { v: metrics.wrinkleFine, a: 7*Math.PI/6 }
                         ].map(p => {
                             const r = (p.v / 100) * 30; 
                             return { x: 60 + r * Math.cos(p.a), y: 60 + r * Math.sin(p.a) };
                         });

                         const polyPoints = pts.map(p => `${p.x},${p.y}`).join(' ');

                         return (
                            <g className={isChartVisible ? "opacity-100 transition-opacity duration-1000" : "opacity-0"}>
                                <polygon points={polyPoints} fill="rgba(13, 148, 136, 0.15)" stroke="#0F766E" strokeWidth="2" strokeLinejoin="round" className="draw-stroke" />
                                {pts.map((p, i) => (
                                    <circle key={i} cx={p.x} cy={p.y} r="2" fill="#0D9488" className="animate-pulse" />
                                ))}
                            </g>
                         )
                     })()}
                     
                     <text x="60" y="22" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#A1A1AA" letterSpacing="0.2">ACNE</text>
                     <text x="94" y="42" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#A1A1AA" letterSpacing="0.2">TONE</text>
                     <text x="94" y="78" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#A1A1AA" letterSpacing="0.2">TEXTURE</text>
                     <text x="60" y="98" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#A1A1AA" letterSpacing="0.2">OIL</text>
                     <text x="26" y="78" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#A1A1AA" letterSpacing="0.2">HYDRA</text>
                     <text x="26" y="42" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#A1A1AA" letterSpacing="0.2">AGING</text>
                 </svg>
             </div>
        </div>

        <div className="space-y-6">
             <GroupSection title="Blemishes" score={groupAnalysis.blemishScore} delayClass="delay-200">
                 <MetricRing label="Acne" value={metrics.acneActive} metricKey="acneActive" onSelect={setSelectedMetric} />
                 <MetricRing label="Scars" value={metrics.acneScars} metricKey="acneScars" onSelect={setSelectedMetric} />
                 <MetricRing label="Pores" value={metrics.poreSize} metricKey="poreSize" onSelect={setSelectedMetric} />
                 <MetricRing label="Blackheads" value={metrics.blackheads} metricKey="blackheads" onSelect={setSelectedMetric} />
             </GroupSection>

             <GroupSection title="Health" score={groupAnalysis.healthScore} delayClass="delay-300">
                 <MetricRing label="Hydration" value={metrics.hydration} metricKey="hydration" onSelect={setSelectedMetric} />
                 <MetricRing label="Oil Ctrl" value={metrics.oiliness} metricKey="oiliness" onSelect={setSelectedMetric} />
                 <MetricRing label="Redness" value={metrics.redness} metricKey="redness" onSelect={setSelectedMetric} />
                 <MetricRing label="Texture" value={metrics.texture} metricKey="texture" onSelect={setSelectedMetric} />
             </GroupSection>

             <GroupSection title="Aging" score={groupAnalysis.agingScore} delayClass="delay-500">
                 <MetricRing label="Fine Lines" value={metrics.wrinkleFine} metricKey="wrinkleFine" onSelect={setSelectedMetric} />
                 <MetricRing label="Wrinkles" value={metrics.wrinkleDeep} metricKey="wrinkleDeep" onSelect={setSelectedMetric} />
                 <MetricRing label="Firmness" value={metrics.sagging} metricKey="sagging" onSelect={setSelectedMetric} />
                 <MetricRing label="Spots" value={metrics.pigmentation} metricKey="pigmentation" onSelect={setSelectedMetric} />
                 <div className="col-span-4 mt-2 border-t border-zinc-50 pt-2 flex justify-center">
                    <div className="w-1/4">
                        <MetricRing label="Dark Circles" value={metrics.darkCircles} metricKey="darkCircles" onSelect={setSelectedMetric} />
                    </div>
                 </div>
             </GroupSection>
        </div>

        {/* PRESCRIPTION PROTOCOL CARD - REVEAL INTERACTION */}
        <div className="rounded-[2.5rem] animate-in slide-in-from-bottom-8 duration-700 delay-500 bg-gradient-to-br from-teal-500 to-teal-700 shadow-2xl shadow-teal-900/20 relative overflow-hidden text-white group p-8 min-h-[400px] flex flex-col justify-center transition-all">
             {/* Decorative Background */}
             <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none mix-blend-overlay animate-pulse"></div>
             <div className="absolute bottom-0 left-0 w-72 h-72 bg-teal-900/20 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>

             {!isPrescriptionRevealed ? (
                 <div className="relative z-10 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500">
                      <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md mb-8 relative border border-white/20 shadow-inner">
                          <div className="absolute inset-0 bg-teal-400/20 rounded-full animate-ping duration-1000"></div>
                          <Fingerprint size={48} className="text-white drop-shadow-md" strokeWidth={1.5} />
                      </div>
                      
                      <h3 className="text-3xl font-black text-white mb-3 tracking-tighter">Analysis Complete</h3>
                      <p className="text-teal-100 font-medium text-sm mb-10 max-w-[280px] mx-auto leading-relaxed opacity-90">
                          We've analyzed your biometrics and identified {prescription.ingredients.length} active ingredients that target your specific needs.
                      </p>
                      
                      <button 
                        onClick={() => setIsPrescriptionRevealed(true)}
                        className="group relative px-10 py-5 bg-white text-teal-700 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-[0_0_50px_rgba(255,255,255,0.25)] hover:shadow-[0_0_80px_rgba(255,255,255,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3 overflow-hidden"
                      >
                          <span className="relative z-10 flex items-center gap-2">
                             Reveal Formula <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                          </span>
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-teal-50/50 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                      </button>
                 </div>
             ) : (
                 <div className="relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h4 className="text-[10px] font-bold text-teal-100 uppercase tracking-widest mb-2 flex items-center gap-2 opacity-90 animate-in slide-in-from-left-4 duration-500 delay-100">
                                <Search size={14} className="text-white" /> Recommended for You
                            </h4>
                            <h2 className="text-2xl font-black text-white tracking-tight leading-none animate-in slide-in-from-left-4 duration-500 delay-200">Power Ingredients</h2>
                            <p className="text-sm text-teal-50 font-medium mt-1 opacity-90 animate-in slide-in-from-left-4 duration-500 delay-300">Look for these ingredients on product labels.</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {prescription.ingredients.map((ing, i) => (
                            <div key={i} className="bg-white/95 backdrop-blur-md rounded-2xl p-4 text-center shadow-lg transition-transform hover:scale-105 duration-300 animate-in zoom-in slide-in-from-bottom-8 flex flex-col items-center justify-center relative overflow-hidden fill-mode-backwards" style={{ animationDelay: `${400 + (i * 100)}ms` }}>
                                
                                {ing.isSafetySwap && (
                                    <div className="absolute top-0 left-0 right-0 bg-amber-50 py-1 text-[8px] font-bold text-amber-600 uppercase tracking-widest">
                                        Gentle Option
                                    </div>
                                )}

                                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 mt-2 ${ing.isSafetySwap ? 'bg-amber-100 text-amber-600' : 'bg-teal-50 text-teal-600'}`}>
                                    {getIngredientIcon(ing.name, ing.action)}
                                </div>
                                
                                <h5 className="font-bold text-sm text-zinc-900 leading-tight mb-1">{ing.name}</h5>
                                <span className="text-[10px] font-medium tracking-wide text-zinc-500 block leading-tight px-1">{ing.action}</span>
                            </div>
                        ))}
                    </div>

                    {/* INGREDIENTS TO AVOID */}
                    {prescription.avoid.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-white/20 animate-in fade-in duration-700 delay-1000">
                            <div className="flex items-start gap-3 opacity-90">
                                 <div className="mt-0.5">
                                    <Ban size={14} className="text-white" />
                                 </div>
                                 <div>
                                     <span className="text-[10px] font-bold text-white uppercase tracking-widest block mb-1">Avoid for now</span>
                                     <p className="text-xs text-teal-50 font-medium leading-relaxed">
                                         {prescription.avoid.join(', ')}
                                     </p>
                                 </div>
                            </div>
                        </div>
                    )}
                </div>
             )}
        </div>

        <div className="pt-8 animate-in slide-in-from-bottom-8 duration-700 delay-700 relative">
            <div className="absolute top-24 bottom-12 left-[2.25rem] w-px bg-zinc-200 z-0 hidden sm:block origin-top animate-[scaleY_1s_ease-out_forwards] delay-700" style={{ transform: 'scaleY(0)', animationFillMode: 'forwards' }}></div>

            <div className="flex justify-between items-center mb-8 px-2 tech-reveal">
                <div>
                    <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Daily Routine</h2>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1.5">
                        {complexity} PLAN • {activeRoutineTab}
                    </p>
                </div>
                <div className="flex bg-white border border-zinc-100 rounded-full p-1 gap-1 shadow-sm">
                    <button onClick={() => setActiveRoutineTab('AM')} className={`p-3 rounded-full transition-all ${activeRoutineTab === 'AM' ? 'bg-amber-50 text-amber-500 shadow-sm' : 'text-zinc-300 hover:text-zinc-500'}`}><Sun size={20} /></button>
                    <button onClick={() => setActiveRoutineTab('PM')} className={`p-3 rounded-full transition-all ${activeRoutineTab === 'PM' ? 'bg-indigo-50 text-indigo-500 shadow-sm' : 'text-zinc-300 hover:text-zinc-500'}`}><Moon size={20} /></button>
                </div>
            </div>

            <div className="flex justify-center mb-10 tech-reveal delay-100">
                 <div className="inline-flex bg-white border border-zinc-100 rounded-2xl p-1.5 shadow-sm">
                     <button onClick={() => setComplexity('BASIC')} className={`px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${complexity === 'BASIC' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-600'}`}>Essential</button>
                     <button onClick={() => setComplexity('ADVANCED')} className={`px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${complexity === 'ADVANCED' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-600'}`}>Complete</button>
                 </div>
            </div>

            <div className="space-y-5 relative mb-12">
                {activeRoutineTab === 'AM' ? (
                    <>
                        <RoutineStep step="01" type="CLEANSER" time="AM" />
                        {complexity === 'ADVANCED' && <RoutineStep step="02" type="TONER" time="AM" />}
                        <RoutineStep step={complexity === 'ADVANCED' ? "03" : "02"} type="SERUM" time="AM" />
                        <RoutineStep step={complexity === 'ADVANCED' ? "04" : "03"} type="SPF" time="AM" />
                    </>
                ) : (
                    <>
                         {complexity === 'ADVANCED' && <RoutineStep step="01" type="CLEANSER" time="PM" />} 
                         <RoutineStep step={complexity === 'ADVANCED' ? "02" : "01"} type="CLEANSER" time="PM" />
                         {complexity === 'ADVANCED' && <RoutineStep step="03" type="TONER" time="PM" />}
                         <RoutineStep step={complexity === 'ADVANCED' ? "04" : "02"} type="SERUM" time="PM" />
                         {complexity === 'ADVANCED' && <RoutineStep step="05" type="TREATMENT" time="PM" />}
                         {complexity === 'ADVANCED' && <RoutineStep step="06" type="MOISTURIZER" time="PM" />}
                         
                         {/* Dynamic rendering for Basic PM step */}
                         {complexity === 'BASIC' && (
                             // If a moisturizer slot was created (because skin isn't oily), render it.
                             // Otherwise, the slot will be for SERUM_PM.
                             routinePlan['MOISTURIZER_PM'] ? (
                                <RoutineStep step="03" type="MOISTURIZER" time="PM" />
                             ) : (
                                <RoutineStep step="03" type="SERUM" time="PM" />
                             )
                         )}
                    </>
                )}
            </div>

            {/* CLINICAL MENU SECTION */}
            <div className="modern-card rounded-[2.5rem] p-8 tech-reveal delay-200 bg-teal-50/20 border-teal-100/50">
                 <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-xl font-black text-zinc-900 tracking-tight">Professional Menu</h3>
                        <p className="text-xs font-bold text-teal-600 uppercase tracking-widest mt-1">Based on {groupAnalysis.priorityCategory.toLowerCase()}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600">
                        <Syringe size={18} />
                    </div>
                 </div>

                 <div className="space-y-4 mb-6">
                    {clinicalSuggestions.map((treatment, idx) => (
                        <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-100 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0 mt-1">
                                {treatment.type === 'TREATMENT' ? <Zap size={16} className="text-zinc-600" /> : 
                                 treatment.type === 'FACIAL' ? <Sparkles size={16} className="text-zinc-600" /> :
                                 <Activity size={16} className="text-zinc-600" />}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-bold text-sm text-zinc-900">{treatment.name}</h4>
                                </div>
                                <p className="text-xs text-zinc-500 font-medium mb-2 leading-relaxed">{treatment.benefit}</p>
                                <div className="flex gap-3">
                                    <span className="text-[9px] font-medium text-zinc-400 bg-zinc-50 px-2 py-1 rounded">Downtime: {treatment.downtime}</span>
                                    <span className="text-[9px] font-medium text-zinc-400 bg-zinc-50 px-2 py-1 rounded">Type: {treatment.type}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                 </div>

                 <button 
                    onClick={() => onConsultAI(`What clinical treatments like ${clinicalSuggestions[0].name} do you recommend for my ${groupAnalysis.priorityCategory.toLowerCase()}?`)}
                    className="w-full py-3 rounded-xl bg-teal-600 text-white font-bold text-xs uppercase tracking-widest shadow-md shadow-teal-600/10 hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                 >
                    <MessageCircle size={16} /> Consult AI
                 </button>
            </div>
        </div>

        {selectedMetric && (
            <MetricModal 
                metric={selectedMetric} 
                score={metrics[selectedMetric] as number} 
                age={age}
                observation={metrics.observations?.[selectedMetric]}
                onClose={() => setSelectedMetric(null)} 
            />
        )}
    </div>
  );
};

export default SkinAnalysisReport;
