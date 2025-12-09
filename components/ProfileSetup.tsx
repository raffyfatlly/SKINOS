
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserProfile, UserPreferences, SkinMetrics } from '../types';
import { ArrowLeft, Check, Sparkles, Target, Zap, Activity, TrendingUp, LineChart, X, Trash2, Edit2, Settings2, ChevronDown, ChevronRight, Minus, Trophy, LogOut } from 'lucide-react';
import { signOut, auth } from '../services/firebase';

interface ProfileSetupProps {
  user: UserProfile;
  onComplete: (updatedProfile: UserProfile) => void;
  onBack: () => void;
  onReset: () => void;
}

// --- SUB-COMPONENT: GOAL EDIT MODAL ---
const GoalEditModal: React.FC<{ 
    currentPreferences: UserPreferences; 
    onSave: (prefs: UserPreferences) => void; 
    onClose: () => void; 
}> = ({ currentPreferences, onSave, onClose }) => {
    const [goals, setGoals] = useState<string[]>(currentPreferences.goals || []);
    const [sensitivity, setSensitivity] = useState(currentPreferences.sensitivity || 'MILD');

    const goalOptions = [
        { label: "Clear Acne & Blemishes", icon: <Target size={16} /> },
        { label: "Smooth & Hydrated Skin", icon: <Sparkles size={16} /> },
        { label: "Look Younger & Firm", icon: <Activity size={16} /> },
        { label: "Brighten Dark Spots", icon: <Zap size={16} /> },
    ];

    const toggleGoal = (goal: string) => {
        if (goals.includes(goal)) {
            setGoals(goals.filter(g => g !== goal));
        } else {
            setGoals([...goals, goal]);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/60 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-sm bg-white rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 relative overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-black text-zinc-900">Tracking Goals</h3>
                        <p className="text-xs text-zinc-400 font-medium">Customize your analysis focus</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-zinc-50 rounded-full text-zinc-400 hover:text-zinc-900 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="space-y-6">
                    <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-3 pl-1">Select your priorities</label>
                        <div className="grid grid-cols-1 gap-2">
                            {goalOptions.map(opt => {
                                const isSelected = goals.includes(opt.label);
                                return (
                                    <button
                                        key={opt.label}
                                        onClick={() => toggleGoal(opt.label)}
                                        className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left group active:scale-[0.98] ${isSelected ? 'bg-teal-50 border-teal-500 text-teal-900' : 'bg-white border-zinc-100 text-zinc-600 hover:border-zinc-200 hover:bg-zinc-50'}`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-teal-500 text-white' : 'bg-zinc-100 text-zinc-400 group-hover:bg-white'}`}>
                                            {opt.icon}
                                        </div>
                                        <span className="font-bold text-sm">{opt.label}</span>
                                        {isSelected && <Check size={16} className="ml-auto text-teal-600" />}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div>
                         <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-3 pl-1">Skin Sensitivity</label>
                         <div className="flex bg-zinc-100/50 p-1 rounded-2xl border border-zinc-100">
                             {['NOT_SENSITIVE', 'MILD', 'VERY_SENSITIVE'].map((s) => (
                                 <button
                                    key={s}
                                    onClick={() => setSensitivity(s as any)}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase transition-all ${sensitivity === s ? 'bg-white shadow-sm text-teal-700 ring-1 ring-zinc-100' : 'text-zinc-400 hover:text-zinc-600'}`}
                                 >
                                    {s === 'NOT_SENSITIVE' ? 'Normal' : s === 'VERY_SENSITIVE' ? 'High' : 'Mild'}
                                 </button>
                             ))}
                         </div>
                    </div>

                    <button 
                        onClick={() => onSave({ ...currentPreferences, goals, sensitivity })}
                        className="w-full py-4 rounded-[1.5rem] bg-zinc-900 text-white font-bold text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-zinc-900/10"
                    >
                        Save Preferences
                    </button>
                </div>
            </div>
        </div>
    )
}

// --- SUB-COMPONENT: HISTORY DETAIL MODAL ---
const ScanDetailModal: React.FC<{ scan: SkinMetrics; onClose: () => void }> = ({ scan, onClose }) => {
    const dateStr = new Date(scan.timestamp).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    // Calculate primary concern for this specific scan
    const concerns = [
        { label: 'Acne', val: scan.acneActive },
        { label: 'Hydration', val: scan.hydration },
        { label: 'Redness', val: scan.redness },
        { label: 'Texture', val: scan.texture },
        { label: 'Wrinkles', val: scan.wrinkleFine },
    ].sort((a,b) => a.val - b.val);
    
    const primaryIssue = concerns[0];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-teal-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-white rounded-[2.5rem] p-8 relative animate-in zoom-in-95 shadow-2xl overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-teal-50 to-white pointer-events-none" />
                
                <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white rounded-full text-zinc-400 hover:text-zinc-900 transition-colors z-20 shadow-sm border border-zinc-100">
                    <X size={20} />
                </button>

                <div className="relative z-10 text-center mb-8">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-zinc-100 shadow-sm">{dateStr}</span>
                    <h2 className="text-6xl font-black text-zinc-900 mt-6 mb-2 tracking-tighter">{scan.overallScore}</h2>
                    <p className="text-sm font-bold text-teal-600 uppercase tracking-wide">Skin Health Score</p>
                </div>

                <div className="space-y-4 relative z-10">
                    <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Activity size={14} className="text-teal-500" /> Primary Analysis
                        </h4>
                        <p className="text-sm font-medium text-zinc-700 leading-relaxed">
                            {scan.analysisSummary || `During this scan, your primary concern was ${primaryIssue.label.toLowerCase()} (Score: ${primaryIssue.val}).`}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                         <div className="p-4 bg-white border border-zinc-100 rounded-2xl shadow-sm">
                             <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Hydration</span>
                             <div className="h-2 bg-zinc-100 rounded-full overflow-hidden mb-1">
                                 <div className="h-full bg-sky-400" style={{ width: `${scan.hydration}%` }} />
                             </div>
                             <span className="text-xs font-bold text-zinc-900">{scan.hydration}%</span>
                         </div>
                         <div className="p-4 bg-white border border-zinc-100 rounded-2xl shadow-sm">
                             <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Acne</span>
                             <div className="h-2 bg-zinc-100 rounded-full overflow-hidden mb-1">
                                 <div className="h-full bg-rose-400" style={{ width: `${scan.acneActive}%` }} />
                             </div>
                             <span className="text-xs font-bold text-zinc-900">{scan.acneActive}%</span>
                         </div>
                         <div className="p-4 bg-white border border-zinc-100 rounded-2xl shadow-sm">
                             <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Redness</span>
                             <div className="h-2 bg-zinc-100 rounded-full overflow-hidden mb-1">
                                 <div className="h-full bg-amber-400" style={{ width: `${scan.redness}%` }} />
                             </div>
                             <span className="text-xs font-bold text-zinc-900">{scan.redness}%</span>
                         </div>
                         <div className="p-4 bg-white border border-zinc-100 rounded-2xl shadow-sm">
                             <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Texture</span>
                             <div className="h-2 bg-zinc-100 rounded-full overflow-hidden mb-1">
                                 <div className="h-full bg-teal-400" style={{ width: `${scan.texture}%` }} />
                             </div>
                             <span className="text-xs font-bold text-zinc-900">{scan.texture}%</span>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ProfileSetup: React.FC<ProfileSetupProps> = ({ user, onComplete, onBack, onReset }) => {
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [selectedScan, setSelectedScan] = useState<SkinMetrics | null>(null);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  
  const history = useMemo(() => user.scanHistory || [user.biometrics], [user.scanHistory, user.biometrics]);

  // --- HELPER: Goal Progress ---
  const getGoalProgress = (goal: string, currentMetrics: SkinMetrics, initialMetrics: SkinMetrics) => {
      let metricKeys: (keyof SkinMetrics)[] = [];
      let label = "";

      switch(goal) {
          case "Clear Acne & Blemishes":
              metricKeys = ['acneActive', 'acneScars', 'blackheads'];
              label = "Acne & Clarity";
              break;
          case "Smooth & Hydrated Skin":
              metricKeys = ['hydration', 'texture', 'oiliness'];
              label = "Hydration & Texture";
              break;
          case "Look Younger & Firm":
              metricKeys = ['wrinkleFine', 'wrinkleDeep', 'sagging'];
              label = "Youth & Firmness";
              break;
          case "Brighten Dark Spots":
              metricKeys = ['pigmentation', 'darkCircles'];
              label = "Brightening";
              break;
          default:
              return null;
      }

      if (metricKeys.length === 0) return null;

      const currentAvg = metricKeys.reduce((acc, k) => {
          const val = currentMetrics[k];
          return acc + (typeof val === 'number' ? val : 0);
      }, 0) / metricKeys.length;

      const initialAvg = metricKeys.reduce((acc, k) => {
          const val = initialMetrics[k];
          return acc + (typeof val === 'number' ? val : 0);
      }, 0) / metricKeys.length;
      
      const delta = Math.round(currentAvg - initialAvg);
      
      return {
          label,
          current: Math.round(currentAvg),
          start: Math.round(initialAvg),
          target: 90, // Aspiration
          delta
      };
  };

  const handleGoalsSave = (newPrefs: UserPreferences) => {
      onComplete({ ...user, preferences: newPrefs });
      setIsGoalModalOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    onReset(); // Clear local state in App
  }

  // --- RENDER: OVERVIEW ---
  // History Processing
  const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);
  const latest = sortedHistory[0];
  const initial = sortedHistory[sortedHistory.length - 1]; // Baseline
  const totalProgress = latest.overallScore - initial.overallScore;

  // Group History by Month for Scalability
  const groupedHistory: Record<string, SkinMetrics[]> = {};
  sortedHistory.forEach(scan => {
      const date = new Date(scan.timestamp);
      const key = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
      if (!groupedHistory[key]) groupedHistory[key] = [];
      groupedHistory[key].push(scan);
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32 min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-50/30">
      {/* HEADER - TEAL GRADIENT */}
      <div className="px-6 pt-12 pb-8 bg-gradient-to-br from-teal-600 via-teal-700 to-teal-800 text-white rounded-b-[2.5rem] shadow-xl relative overflow-hidden border-b border-teal-500/50">
          {/* Subtle Texture Overlay */}
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>
          
          <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                  <button onClick={onBack} className="p-2 -ml-2 text-white/80 hover:text-white transition-colors">
                      <ArrowLeft size={24} />
                  </button>
                  {auth && auth.currentUser && (
                      <button 
                        onClick={handleSignOut}
                        className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
                        title="Sign Out"
                      >
                          <LogOut size={18} />
                      </button>
                  )}
              </div>

              <div className="flex items-center gap-5 mb-8">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shadow-inner border border-white/20 text-2xl font-black">
                      {user.name.charAt(0)}
                  </div>
                  <div>
                      <h1 className="text-3xl font-black tracking-tighter text-white">{user.name}</h1>
                      <p className="text-sm font-medium text-teal-100/90">{user.age} Years • {user.skinType.charAt(0) + user.skinType.slice(1).toLowerCase()} Skin</p>
                      {auth && auth.currentUser && (
                          <span className="text-[10px] font-bold bg-teal-500/40 px-2 py-0.5 rounded text-white mt-1 inline-block">Cloud Synced</span>
                      )}
                  </div>
              </div>

              <div className="flex gap-4">
                  <div className="flex-1 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-sm">
                       <span className="text-[10px] font-bold text-teal-100 uppercase tracking-widest block mb-1">Total Scans</span>
                       <span className="text-2xl font-black text-white">{history.length}</span>
                  </div>
                  <div className="flex-1 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-sm">
                       <span className="text-[10px] font-bold text-teal-100 uppercase tracking-widest block mb-1">Progress</span>
                       <span className={`text-2xl font-black flex items-center gap-1 text-white`}>
                          {totalProgress > 0 ? '+' : ''}{totalProgress}
                          {totalProgress > 0 ? <TrendingUp size={18} className="text-teal-200" /> : totalProgress < 0 ? <TrendingUp size={18} className="rotate-180 text-rose-300" /> : <Minus size={18} className="text-zinc-300" />}
                       </span>
                  </div>
              </div>
          </div>
      </div>

      {/* CONTENT CONTAINER - High Contrast */}
      <div className="space-y-6 px-6 pt-8">
          
          {/* GOAL PROGRESS CARDS */}
          <section>
               <div className="flex justify-between items-end mb-4 px-1">
                   <h3 className="text-xs font-bold text-teal-800/60 uppercase tracking-widest flex items-center gap-2">
                      <Target size={14} /> Goal Tracking
                   </h3>
                   <button 
                      onClick={() => setIsGoalModalOpen(true)}
                      className="text-[10px] font-bold text-teal-600 bg-teal-50 px-3 py-1.5 rounded-full border border-teal-100 hover:bg-teal-100 transition-colors flex items-center gap-1.5"
                   >
                      <Settings2 size={12} />
                      Customize
                   </button>
               </div>
               
               {(!user.preferences?.goals || user.preferences.goals.length === 0) && (
                  <div className="p-6 bg-white rounded-[1.5rem] text-center border border-zinc-100 shadow-sm">
                      <h4 className="font-bold text-zinc-900 mb-2">Track your progress</h4>
                      <p className="text-xs text-zinc-500 font-medium mb-4">Select skin goals to see how your metrics improve over time.</p>
                      <button 
                          onClick={() => setIsGoalModalOpen(true)}
                          className="px-6 py-3 bg-zinc-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-zinc-900/10"
                      >
                          Set Goals
                      </button>
                  </div>
               )}
               
               <div className="space-y-4">
                  {user.preferences?.goals.map(goal => {
                       const stats = getGoalProgress(goal, latest, initial);
                       if (!stats) return null;
                       const progressPercent = Math.min(100, Math.max(0, (stats.current / stats.target) * 100));
                       
                       return (
                           <div key={goal} className="bg-white border border-teal-50 p-5 rounded-[1.5rem] shadow-sm relative overflow-hidden group">
                               <div className="flex justify-between items-end mb-3 relative z-10">
                                   <div>
                                       <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">{stats.label}</span>
                                       <div className="flex items-center gap-2">
                                          <span className="text-3xl font-black text-zinc-900 tracking-tight">{stats.current}</span>
                                          <span className="text-xs font-bold text-zinc-300">/ {stats.target}</span>
                                       </div>
                                   </div>
                                   <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${stats.delta > 0 ? 'bg-emerald-50 text-emerald-600' : stats.delta < 0 ? 'bg-rose-50 text-rose-600' : 'bg-zinc-50 text-zinc-400'}`}>
                                       {stats.delta > 0 ? 'Improved' : stats.delta < 0 ? 'Declined' : 'Stable'} ({stats.delta > 0 ? '+' : ''}{stats.delta})
                                   </div>
                               </div>
                               
                               {/* Progress Bar */}
                               <div className="h-2 bg-zinc-100 rounded-full overflow-hidden relative z-10">
                                    <div className={`absolute top-0 bottom-0 left-0 rounded-full transition-all duration-1000 ${progressPercent >= 100 ? 'bg-teal-500' : 'bg-zinc-800'}`} style={{ width: `${progressPercent}%` }}></div>
                               </div>
                               
                               <div className="flex justify-between mt-2 relative z-10">
                                   <span className="text-[9px] font-bold text-zinc-400">Baseline: {stats.start}</span>
                                   {progressPercent >= 100 ? (
                                       <span className="text-[9px] font-bold text-teal-600 flex items-center gap-1"><Trophy size={10} /> Goal Met</span>
                                   ) : (
                                       <span className="text-[9px] font-bold text-zinc-400">{Math.round(100 - progressPercent)}% to go</span>
                                   )}
                               </div>
                           </div>
                       )
                  })}
               </div>
          </section>

          {/* EXPANDABLE HISTORY CHART */}
          <section className="bg-white rounded-[2rem] border border-teal-50 shadow-sm overflow-hidden transition-all duration-500">
              <div 
                  className="p-6 cursor-pointer hover:bg-teal-50/30 transition-colors"
                  onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
              >
                  <div className="flex justify-between items-center mb-4">
                       <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                          <LineChart size={14} className="text-teal-500" /> Skin Health Journey
                      </h3>
                      <div className={`w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 transition-transform duration-300 ${isHistoryExpanded ? 'rotate-180' : ''}`}>
                          <ChevronDown size={16} />
                      </div>
                  </div>
                  
                  <div className="mt-6 flex items-center justify-between text-[10px] font-medium text-zinc-400 pt-4 border-t border-zinc-50">
                      <span>Based on {history.length} scans</span>
                      <span className="text-teal-600 font-bold flex items-center gap-1">
                          {isHistoryExpanded ? 'Collapse History' : 'View Full History'}
                      </span>
                  </div>
              </div>

              {/* EXPANDABLE LIST AREA */}
              {isHistoryExpanded && (
                  <div className="border-t border-zinc-100 bg-zinc-50/50 p-6 space-y-6 animate-in slide-in-from-top-4 duration-300">
                      {Object.entries(groupedHistory).map(([monthYear, scans]) => (
                          <div key={monthYear}>
                              <h4 className="text-[10px] font-black text-teal-900/40 uppercase tracking-widest mb-3 ml-1">{monthYear}</h4>
                              <div className="space-y-3">
                                  {scans.map((entry, i) => (
                                      <button 
                                          key={entry.timestamp} 
                                          onClick={() => setSelectedScan(entry)}
                                          className="w-full bg-white border border-zinc-100 hover:border-teal-200 hover:shadow-md p-4 rounded-2xl flex items-center justify-between shadow-sm transition-all duration-200 group text-left"
                                      >
                                          <div className="flex items-center gap-4">
                                              {/* SCORE BOX */}
                                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm transition-colors border ${entry.overallScore > 80 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : entry.overallScore < 60 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                                  {entry.overallScore}
                                              </div>
                                              
                                              {/* DATE & TIME TITLE */}
                                              <div className="flex-1 min-w-0">
                                                  <span className="block text-sm font-bold text-zinc-900 mb-0.5">
                                                      {new Date(entry.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                  </span>
                                                  <p className="text-[10px] font-medium text-zinc-400 truncate w-full group-hover:text-teal-600 transition-colors">
                                                      Tap for full report
                                                  </p>
                                              </div>
                                          </div>
                                          <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover:bg-white group-hover:text-teal-500 transition-colors">
                                              <ChevronRight size={16} />
                                          </div>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </section>

          {/* DANGER ZONE */}
          <div className="mt-12 text-center pb-8">
               <button 
                  onClick={onReset}
                  className="inline-flex items-center gap-2 text-xs font-bold text-rose-400 uppercase tracking-widest hover:text-rose-600 transition-colors px-6 py-3 rounded-full hover:bg-rose-50"
               >
                   <Trash2 size={14} /> Clear Local Data
               </button>
          </div>
      </div>

      {/* MODALS */}
      {selectedScan && (
          <ScanDetailModal scan={selectedScan} onClose={() => setSelectedScan(null)} />
      )}
      
      {isGoalModalOpen && (
          <GoalEditModal 
             currentPreferences={user.preferences || {
                goals: [],
                sensitivity: 'MILD',
                complexity: 'MODERATE',
                sunscreenFrequency: 'SUNNY',
                lifestyle: [],
                buyingPriority: 'Fast Results'
             }} 
             onSave={handleGoalsSave} 
             onClose={() => setIsGoalModalOpen(false)} 
          />
      )}
    </div>
  );
};

export default ProfileSetup;
