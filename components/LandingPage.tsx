import React, { useEffect, useState } from 'react';
import { ScanFace, ScanBarcode, TrendingUp, Sparkles, ArrowRight, ShieldCheck, Zap, Search, Activity, Play, Lock } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800 pb-32 selection:bg-teal-100 overflow-x-hidden">
      
      {/* NAV - Minimal & Solid */}
      <div className="fixed top-0 left-0 right-0 p-6 flex justify-between items-center z-50 bg-white/90 backdrop-blur-xl border-b border-zinc-100 transition-all duration-500">
        <div className="flex items-center gap-2">
            <span className="font-bold text-xl tracking-tight text-zinc-900">SkinOS</span>
        </div>
        <button 
            onClick={onLogin} 
            className="text-xs font-bold bg-zinc-100 text-zinc-900 px-5 py-2.5 rounded-full hover:bg-zinc-200 transition-all active:scale-95"
        >
            Log In
        </button>
      </div>

      <div className="px-5 pt-32 max-w-xl mx-auto space-y-8">
        
        {/* HERO SECTION - Big Typography */}
        <section className={`space-y-6 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h1 className="text-6xl sm:text-7xl font-black tracking-tighter leading-[0.95] text-zinc-900">
                Skin care.<br/>
                <span className="text-zinc-300">Solved.</span>
            </h1>
            
            <p className="text-lg font-medium text-zinc-500 leading-relaxed max-w-xs tracking-tight">
                The first AI dermatologist that lives in your pocket. Scan faces. Scan products. See results.
            </p>

            <div className="flex items-center gap-4 pt-4">
                 <button onClick={onGetStarted} className="bg-teal-600 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-teal-700 transition-all flex items-center gap-2">
                    Get Started <ArrowRight size={16} />
                 </button>
                 <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold">
                    <Play size={12} fill="currentColor" /> See how it works
                 </div>
            </div>
        </section>

        {/* BENTO GRID LAYOUT */}
        <div className="grid grid-cols-1 gap-5">
            
            {/* CARD 1: THE SCANNER (Large Hero Card) */}
            <div className={`bg-zinc-50 rounded-[2.5rem] p-8 relative overflow-hidden group transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                <div className="relative z-10 flex flex-col h-full justify-between min-h-[320px]">
                    <div>
                        <div className="flex items-center gap-2 mb-4 text-zinc-400">
                             <ScanBarcode size={20} />
                             <span className="text-xs font-bold uppercase tracking-widest">In-Store Companion</span>
                        </div>
                        <h2 className="text-4xl font-black text-zinc-900 tracking-tighter leading-none mb-4">
                            Don't guess.<br/>Just scan.
                        </h2>
                        <p className="text-sm text-zinc-500 font-medium leading-relaxed max-w-[220px]">
                            Instantly analyze ingredients at Watsons or Sephora to see if they match your skin profile.
                        </p>
                    </div>

                    {/* Widget UI Simulation */}
                    <div className="mt-8 bg-white rounded-3xl p-4 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-zinc-100 transform group-hover:scale-105 transition-transform duration-500 w-full max-w-[280px] self-center">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 bg-teal-50 rounded-full flex items-center justify-center text-teal-600">
                                <ShieldCheck size={20} />
                            </div>
                            <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-1 rounded-full">
                                98% MATCH
                            </span>
                        </div>
                        <div className="h-2 w-2/3 bg-zinc-100 rounded-full mb-2"></div>
                        <div className="h-2 w-1/2 bg-zinc-100 rounded-full"></div>
                    </div>
                </div>
            </div>

            {/* CARD 2 & 3: SPLIT ROW */}
            <div className="grid grid-cols-2 gap-5">
                 {/* BIOMETRICS */}
                 <div className={`bg-teal-600 text-white rounded-[2.5rem] p-6 relative overflow-hidden group transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                     <div className="relative z-10 flex flex-col h-full justify-between min-h-[200px]">
                         <ScanFace size={32} className="mb-4 opacity-80" />
                         <div>
                             <h3 className="text-xl font-bold tracking-tight leading-none mb-2">Clinical<br/>Analysis</h3>
                             <p className="text-xs text-teal-100 font-medium opacity-80">15+ biomarkers scanned instantly.</p>
                         </div>
                     </div>
                     <div className="absolute -right-4 -bottom-4 opacity-10 transform rotate-12 group-hover:scale-110 transition-transform duration-500">
                         <ScanFace size={120} />
                     </div>
                 </div>

                 {/* PROGRESS */}
                 <div className={`bg-zinc-900 text-white rounded-[2.5rem] p-6 relative overflow-hidden group transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                     <div className="relative z-10 flex flex-col h-full justify-between min-h-[200px]">
                         <TrendingUp size={32} className="mb-4 text-emerald-400" />
                         <div>
                             <h3 className="text-xl font-bold tracking-tight leading-none mb-2">Real<br/>Results</h3>
                             <p className="text-xs text-zinc-400 font-medium">Track your skin's improvement over time.</p>
                         </div>
                     </div>
                 </div>
            </div>

            {/* CARD 4: AI DERMATOLOGIST */}
            <div className={`bg-white border border-zinc-100 rounded-[2.5rem] p-8 shadow-sm transition-all duration-700 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                <div className="flex items-center gap-3 mb-4">
                     <div className="w-10 h-10 bg-teal-50 rounded-full flex items-center justify-center text-teal-600">
                         <Sparkles size={18} />
                     </div>
                     <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">AI Recommendation</span>
                </div>
                <h2 className="text-3xl font-black text-zinc-900 tracking-tighter leading-tight mb-4">
                    "This moisturizer isn't for you."
                </h2>
                <p className="text-sm text-zinc-500 font-medium leading-relaxed">
                    Our AI learns your skin type, allergies, and goals to filter out products that will cause breakouts or irritation.
                </p>
            </div>

        </div>

        {/* BOTTOM SPACER */}
        <div className="h-10"></div>
      </div>

      {/* FOOTER */}
      <div className="text-center pb-8 px-6">
          <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest flex items-center justify-center gap-2">
              <Lock size={12} /> Privacy First. Data Encrypted.
          </p>
      </div>

    </div>
  );
};

export default LandingPage;