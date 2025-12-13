
import React, { useMemo } from 'react';
import { Product, UserProfile } from '../types';
import { getBuyingDecision } from '../services/geminiService';
import { Check, X, AlertTriangle, ShieldCheck, Zap, AlertOctagon, TrendingUp, DollarSign, Clock, ArrowRight } from 'lucide-react';

interface BuyingAssistantProps {
  product: Product;
  user: UserProfile;
  shelf: Product[];
  onAddToShelf: () => void;
  onDiscard: () => void;
}

const BuyingAssistant: React.FC<BuyingAssistantProps> = ({ product, user, shelf, onAddToShelf, onDiscard }) => {
  
  const decisionData = useMemo(() => {
    return getBuyingDecision(product, shelf, user);
  }, [product, shelf, user]);

  const { verdict, audit, shelfConflicts, comparison } = decisionData;

  const getVerdictIcon = () => {
      switch(verdict.decision) {
          case 'BUY': 
          case 'SWAP':
          case 'GREAT FIND':
              return <Check size={20} className="text-white" />;
          case 'AVOID':
              return <X size={20} className="text-white" />;
          case 'CAUTION':
          case 'PASS':
          case 'CONSIDER':
              return <AlertTriangle size={20} className="text-white" />;
          default:
              return <Check size={20} className="text-white" />;
      }
  };

  const getVerdictGradient = () => {
      switch(verdict.color) {
          case 'emerald': return 'from-emerald-500 to-teal-600 shadow-emerald-200';
          case 'rose': return 'from-rose-500 to-red-600 shadow-rose-200';
          case 'amber': return 'from-amber-400 to-orange-500 shadow-amber-200';
          case 'zinc': return 'from-zinc-500 to-zinc-600 shadow-zinc-200';
          default: return 'from-zinc-500 to-zinc-600';
      }
  };

  const getPageBackground = () => {
      switch(verdict.color) {
          case 'emerald': return 'bg-emerald-50';
          case 'rose': return 'bg-rose-50';
          case 'amber': return 'bg-amber-50';
          default: return 'bg-zinc-50';
      }
  };

  return (
    <div className={`min-h-screen pb-32 animate-in slide-in-from-bottom-8 duration-500 ${getPageBackground()}`}>
        {/* Header Image / Brand Area */}
        <div className="pt-12 px-6 pb-6 bg-white rounded-b-[2.5rem] shadow-sm border-b border-zinc-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-100 rounded-full -mr-10 -mt-10 opacity-50"></div>
            
            <button onClick={onDiscard} className="absolute top-6 left-6 p-2 bg-zinc-100 rounded-full text-zinc-500 hover:bg-zinc-200 transition-colors z-10">
                <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center relative z-10 mt-4">
                <div className="w-16 h-16 bg-white border border-zinc-100 shadow-lg rounded-2xl flex items-center justify-center mb-4">
                     <span className="text-2xl">🧴</span>
                </div>
                <h1 className="text-xl font-black text-zinc-900 leading-tight mb-1 max-w-xs">{product.name}</h1>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{product.brand || 'Unknown Brand'}</p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-100 rounded-lg">
                    <DollarSign size={10} className="text-zinc-500" />
                    <span className="text-[10px] font-bold text-zinc-700">RM {product.estimatedPrice || 45}</span>
                </div>
            </div>
        </div>

        <div className="px-6 -mt-6 relative z-20">
            {/* VERDICT CARD */}
            <div className={`rounded-[2rem] p-5 text-white shadow-xl bg-gradient-to-br ${getVerdictGradient()} relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none"></div>
                
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shrink-0 shadow-sm">
                        {getVerdictIcon()}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-1.5 mb-0.5 opacity-90">
                            <Zap size={10} className="fill-current" />
                            <span className="text-[9px] font-bold uppercase tracking-widest">AI Verdict</span>
                        </div>
                        <h2 className="text-xl font-black tracking-tight leading-none truncate">{verdict.title}</h2>
                    </div>

                    <div className="text-right bg-black/10 px-3 py-2 rounded-xl border border-white/10 backdrop-blur-sm">
                         <span className="block text-[9px] font-bold uppercase tracking-wide opacity-80 mb-0.5">Match</span>
                         <span className="text-xl font-black leading-none">{product.suitabilityScore}%</span>
                    </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 relative z-10">
                    <p className="text-xs font-medium leading-relaxed opacity-95">
                        {verdict.description}
                    </p>
                    
                     {comparison.result !== 'NEUTRAL' && (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                             <span className="text-[10px] font-bold uppercase opacity-70">Vs Routine:</span>
                             <div className="flex items-center gap-1 text-xs font-bold">
                                <span>{comparison.result === 'BETTER' ? 'Upgrade' : 'Downgrade'}</span>
                                {comparison.result === 'BETTER' ? <TrendingUp size={12} /> : <TrendingUp size={12} className="rotate-180" />}
                             </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        <div className="px-6 space-y-4 mt-6">
             {/* CRITICAL ALERTS */}
             {audit.warnings.length > 0 && (
                 <div className="bg-white p-5 rounded-[1.5rem] border border-zinc-100 shadow-sm">
                     <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                         <AlertOctagon size={14} className="text-rose-500" /> Risk Analysis
                     </h3>
                     <div className="space-y-3">
                         {audit.warnings.map((w, i) => (
                             <div key={i} className={`flex gap-3 p-3 rounded-xl border ${w.severity === 'CRITICAL' ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}>
                                 <div className="mt-0.5">
                                     {w.severity === 'CRITICAL' ? <AlertOctagon size={16} className="text-rose-500" /> : <AlertTriangle size={16} className="text-amber-500" />}
                                 </div>
                                 <div>
                                     <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded mb-1 inline-block ${w.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                         {w.severity}
                                     </span>
                                     <p className={`text-xs font-medium leading-snug ${w.severity === 'CRITICAL' ? 'text-rose-800' : 'text-amber-800'}`}>
                                         {w.reason}
                                     </p>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             )}

             {/* CONFLICTS */}
             {shelfConflicts.length > 0 && (
                 <div className="bg-white p-5 rounded-[1.5rem] border border-zinc-100 shadow-sm">
                     <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                         <Clock size={14} className="text-indigo-500" /> Routine Conflicts
                     </h3>
                     <div className="space-y-2">
                         {shelfConflicts.map((c, i) => (
                             <div key={i} className="flex gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                                 <AlertTriangle size={16} className="text-indigo-500 mt-0.5" />
                                 <p className="text-xs font-medium text-indigo-800 leading-snug">{c}</p>
                             </div>
                         ))}
                     </div>
                 </div>
             )}

             {/* BENEFITS */}
             {product.benefits.length > 0 && (
                 <div className="bg-white p-5 rounded-[1.5rem] border border-zinc-100 shadow-sm">
                     <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                         <ShieldCheck size={14} className="text-teal-500" /> Key Benefits
                     </h3>
                     <div className="space-y-3">
                         {product.benefits.slice(0, 3).map((b, i) => {
                             const metricScore = user.biometrics[b.target] || 0;
                             const isTargeted = metricScore < 60;
                             
                             return (
                                 <div key={i} className="flex gap-3 items-start">
                                     <div className={`mt-0.5 ${isTargeted ? 'text-teal-500' : 'text-zinc-400'}`}>
                                         <Check size={16} strokeWidth={3} />
                                     </div>
                                     <div>
                                         <div className="flex items-center gap-2 mb-0.5">
                                             <span className="text-sm font-bold text-zinc-900">{b.ingredient}</span>
                                             {isTargeted && (
                                                 <span className="text-[9px] font-bold bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-100 uppercase">Targeted</span>
                                             )}
                                         </div>
                                         <p className="text-xs text-zinc-500 font-medium leading-snug">{b.description}</p>
                                     </div>
                                 </div>
                             )
                         })}
                     </div>
                 </div>
             )}
        </div>

        {/* FIXED BOTTOM BAR */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-zinc-100 z-50 pb-safe">
            <div className="flex gap-3 max-w-md mx-auto">
                <button 
                    onClick={onDiscard}
                    className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold text-sm hover:bg-zinc-200 transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={onAddToShelf}
                    className="flex-[2] py-4 bg-teal-500 text-white rounded-2xl font-bold text-sm hover:bg-teal-600 transition-colors shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2"
                >
                    Add to Routine <ArrowRight size={18} />
                </button>
            </div>
        </div>
    </div>
  );
};

export default BuyingAssistant;
