
import React, { useEffect, useState } from 'react';
import { getAnalyticsSummary, getMockAnalyticsSummary } from '../services/analyticsService';
import { 
  Search, Bell, Settings, Calendar, ChevronDown, MoreHorizontal, 
  ArrowUpRight, Users, Zap, Activity, Clock, CheckCircle2, 
  BarChart3, LayoutGrid, Home, Wallet, FileText, LogOut,
  Smartphone, Monitor, Shield, AlertTriangle, Database, DollarSign, Filter, UserCheck, X, RotateCw, Eye, Crown, Layers, ScanFace
} from 'lucide-react';

interface AdminDashboardProps {
  onBack: () => void;
}

// Format timestamp nicely
const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const formatDate = (ts: number) => new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });

// FORMATTER FOR EVENT NAMES
const formatEventName = (name: string) => {
    switch (name) {
        case 'AI_DERM_CONSULT': return 'AI Consultation';
        case 'CHAT_SESSION_START': return 'AI Consultation'; // Legacy mapping
        case 'FACE_ANALYSIS': return 'Face Scan Analysis';
        case 'PRODUCT_ANALYSIS_VISION': return 'Product Scan';
        case 'PRODUCT_ANALYSIS_TEXT': return 'Product Search';
        case 'ROUTINE_BUILD': return 'Routine Builder';
        case 'ADD_TO_SHELF': return 'Shelf Add';
        case 'SIGNUP_COMPLETE': return 'New Registration';
        default: return name.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    }
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('Week');
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  // Filter State
  const [showRegisteredOnly, setShowRegisteredOnly] = useState(false);
  
  // User Drill-down State
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAnalyticsSummary(7);
      if (res) {
          setData(res);
          setIsDemoMode(false);
      } else {
          setError("Could not load data. Check console for details.");
      }
    } catch (e: any) {
      if (e.message === 'PERMISSION_DENIED') {
          setError("PERMISSION_DENIED");
      } else {
          setError("An error occurred while fetching analytics.");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDemoData = () => {
      setData(getMockAnalyticsSummary());
      setIsDemoMode(true);
      setError(null);
      setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
            <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-indigo-600 animate-pulse"></div>
                <div className="absolute inset-0 flex items-center justify-center text-white">
                    <Database size={24} />
                </div>
            </div>
            <p className="text-zinc-400 font-bold text-xs uppercase tracking-[0.2em]">Loading Intelligence...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
      return (
          <div className="min-h-screen bg-[#F4F7FE] flex items-center justify-center p-6">
              <div className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-md text-center border border-white/50">
                  <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-500 shadow-sm">
                      <AlertTriangle size={32} />
                  </div>
                  <h2 className="text-2xl font-black text-zinc-900 mb-3 tracking-tight">Analytics Error</h2>
                  
                  {error === 'PERMISSION_DENIED' ? (
                      <div className="text-sm text-zinc-600 mb-8 space-y-4">
                          <p className="font-bold text-rose-600 bg-rose-50 inline-block px-3 py-1 rounded-full text-xs uppercase tracking-wide">Permission Denied</p>
                          <div className="text-xs bg-zinc-50 p-4 rounded-xl border border-zinc-100 text-left space-y-2">
                              <p className="font-semibold text-zinc-900">Required Firestore Rules:</p>
                              <code className="block bg-zinc-900 text-zinc-200 p-2 rounded-lg font-mono text-[10px] overflow-x-auto">
                                match /analytics_events/&#123;id&#125; &#123; allow read, write: if true; &#125;
                              </code>
                          </div>
                      </div>
                  ) : (
                      <p className="text-sm text-zinc-500 mb-8 font-medium">
                          {error || "No data returned. Ensure Firestore is created and initialized."}
                      </p>
                  )}
                  
                  <div className="flex flex-col gap-3">
                      <div className="flex gap-3">
                          <button onClick={loadData} className="flex-1 bg-zinc-900 text-white px-4 py-3 rounded-xl font-bold text-sm hover:bg-zinc-800 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-zinc-900/10">
                              <RotateCw size={16} /> Retry
                          </button>
                          <button onClick={loadDemoData} className="flex-1 bg-white border-2 border-zinc-100 text-zinc-700 px-4 py-3 rounded-xl font-bold text-sm hover:bg-zinc-50 hover:border-zinc-200 transition-all active:scale-95 flex items-center justify-center gap-2">
                              <Eye size={16} /> Demo Mode
                          </button>
                      </div>
                      <button onClick={onBack} className="text-zinc-400 hover:text-zinc-600 text-[10px] font-bold uppercase tracking-widest mt-4">
                          Return to App
                      </button>
                  </div>
              </div>
          </div>
      )
  }

  const SidebarItem = ({ icon: Icon, label, active = false }: any) => (
      <div className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all cursor-pointer group ${active ? 'bg-zinc-900 text-white shadow-xl shadow-zinc-900/20' : 'text-zinc-400 hover:bg-white hover:text-zinc-900'}`}>
          <Icon size={20} strokeWidth={2.5} className={active ? "text-white" : "text-zinc-300 group-hover:text-zinc-900"} />
          <span className="text-sm font-bold tracking-tight">{label}</span>
          {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />}
      </div>
  );

  const StatWidget = ({ icon: Icon, label, value, sub, theme }: any) => {
      const themes = {
          indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
          amber: "bg-amber-50 text-amber-600 border-amber-100",
          emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
          rose: "bg-rose-50 text-rose-600 border-rose-100"
      };
      
      const activeTheme = themes[theme as keyof typeof themes] || themes.indigo;

      return (
        <div className="bg-white p-5 rounded-[2rem] flex items-center gap-5 shadow-sm border border-zinc-100 hover:shadow-md transition-shadow group">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${activeTheme} group-hover:scale-110 transition-transform duration-300`}>
                <Icon size={26} strokeWidth={2.5} />
            </div>
            <div>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">{label}</p>
                <h4 className="text-2xl font-black text-zinc-900 leading-none tracking-tight">{value}</h4>
                {sub && <p className="text-[10px] text-zinc-400 mt-1.5 font-medium opacity-80">{sub}</p>}
            </div>
        </div>
      );
  };

  const TrafficChart = () => {
      const chartData = data?.chartData || [];
      const displayData = Array.from({ length: 7 }).map((_, i) => {
          const dayData = chartData[i] || { date: 'Day', count: 0 };
          return {
              label: dayData.date === 'Day' ? `D${i+1}` : dayData.date.split(' ')[0], // Just Mon, Tue
              fullDate: dayData.date,
              value: dayData.count,
              active: i === chartData.length - 1 
          };
      });

      const maxVal = Math.max(...displayData.map(d => d.value)) || 10; 

      return (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-zinc-100 h-full flex flex-col relative overflow-hidden">
              <div className="flex justify-between items-start mb-10 relative z-10">
                  <div>
                      <div className="flex items-center gap-3 mb-2">
                          <div className="p-2.5 bg-zinc-900 rounded-xl text-white shadow-lg shadow-zinc-900/20">
                              <Activity size={18} />
                          </div>
                          <h3 className="text-lg font-black text-zinc-900 tracking-tight">Traffic Volume</h3>
                      </div>
                      <p className="text-zinc-400 text-xs font-medium pl-1">API Requests & User Interactions</p>
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 bg-zinc-50 rounded-full text-xs font-bold text-zinc-600 border border-zinc-100 hover:bg-white hover:shadow-sm transition-all">
                      {timeRange} <ChevronDown size={14} />
                  </button>
              </div>

              {/* Chart Bars */}
              <div className="flex-1 flex items-end justify-between gap-3 sm:gap-6 relative z-10">
                  {displayData.map((d, i) => (
                      <div key={i} className="flex flex-col items-center gap-3 flex-1 group cursor-pointer h-full justify-end">
                          <div className={`relative w-full rounded-2xl transition-all duration-1000 ease-out flex items-end justify-center overflow-hidden ${d.active ? 'bg-gradient-to-t from-indigo-600 to-violet-500 shadow-xl shadow-indigo-200' : 'bg-zinc-100 group-hover:bg-zinc-200'}`} style={{ height: `${Math.max(15, (d.value / maxVal) * 100)}%` }}>
                              <div className={`text-[10px] font-bold mb-2 transition-all ${d.active ? 'text-white' : 'text-zinc-400 opacity-0 group-hover:opacity-100'}`}>
                                  {d.value}
                              </div>
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${d.active ? 'text-indigo-600' : 'text-zinc-300'}`}>{d.label}</span>
                      </div>
                  ))}
              </div>
              
              {/* Background Decor */}
              <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
                  <Activity size={200} />
              </div>
          </div>
      );
  };

  const filteredUsers = showRegisteredOnly 
    ? data.userTable.filter((u: any) => u.isRegistered) 
    : data.userTable;

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex overflow-hidden">
        
        {/* SIDEBAR (Desktop) */}
        <div className="w-72 bg-white hidden lg:flex flex-col border-r border-zinc-100/80 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20">
            <div className="p-8 pb-10 flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                    <Database size={20} strokeWidth={3} />
                </div>
                <div>
                    <h1 className="text-lg font-black text-zinc-900 tracking-tight leading-none">Admin<span className="text-indigo-600">OS</span></h1>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Control Center</span>
                </div>
            </div>

            <div className="px-6 space-y-2 flex-1">
                <SidebarItem icon={Home} label="Overview" active />
                <SidebarItem icon={Users} label="User Base" />
                <SidebarItem icon={Zap} label="Token Usage" />
                <SidebarItem icon={Layers} label="Features" />
            </div>

            <div className="p-6">
                <div className="bg-zinc-50 rounded-2xl p-5 border border-zinc-100">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-white border border-zinc-100 flex items-center justify-center text-zinc-400 shadow-sm">
                            <Settings size={16} />
                        </div>
                        <span className="text-xs font-bold text-zinc-900">System Status</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Operational</span>
                    </div>
                </div>
            </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col h-screen overflow-y-auto">
            
            {/* TOP HEADER */}
            <div className="sticky top-0 z-30 bg-[#F8FAFC]/80 backdrop-blur-xl px-8 py-6 flex justify-between items-center border-b border-white/50">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full bg-white border border-zinc-200 text-[10px] font-bold text-zinc-500 uppercase tracking-wide shadow-sm">
                            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                        </span>
                        {isDemoMode && (
                            <span className="bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-amber-200 flex items-center gap-1">
                                <Eye size={10} /> Demo View
                            </span>
                        )}
                    </div>
                    <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Dashboard</h1>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-zinc-200/60 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-xs font-bold text-zinc-600">Live Updates</span>
                    </div>
                    
                    <button onClick={onBack} className="w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 transition-all shadow-sm" title="Exit Dashboard">
                        <LogOut size={18} />
                    </button>
                    
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-800 to-black flex items-center justify-center text-white font-bold text-xs border-2 border-white shadow-lg shadow-zinc-900/20 cursor-pointer hover:scale-105 transition-transform">
                        AD
                    </div>
                </div>
            </div>

            <div className="px-8 pb-12 space-y-8 pt-6">
                
                {/* 1. STATS ROW */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatWidget icon={DollarSign} label="Est. Cost" value={`RM ${data.estimatedCost.toFixed(2)}`} sub="Current Billing Cycle" theme="indigo" />
                    <StatWidget icon={Zap} label="Token Burn" value={(data.totalTokens / 1000).toFixed(1) + 'k'} sub="Input + Output" theme="amber" />
                    <StatWidget icon={Users} label="Total Users" value={data.uniqueVisitors} sub={`${data.registeredUsers} Registered Accounts`} theme="emerald" />
                    <StatWidget icon={FileText} label="Events Logged" value={data.totalEvents} sub="Last 7 Days Activity" theme="rose" />
                </div>

                {/* 2. MAIN LAYOUT GRID */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    
                    {/* LEFT COL (2/3) */}
                    <div className="xl:col-span-2 space-y-8">
                        {/* CHART */}
                        <div className="h-[420px]">
                            <TrafficChart />
                        </div>

                        {/* USAGE BREAKDOWN */}
                        <div className="bg-white rounded-[2.5rem] shadow-sm border border-zinc-100 overflow-hidden flex flex-col">
                            <div className="p-8 border-b border-zinc-50 flex justify-between items-center">
                                <div>
                                    <h4 className="text-lg font-black text-zinc-900 tracking-tight">User Inspector</h4>
                                    <p className="text-xs text-zinc-400 font-medium mt-1">Real-time user session tracking</p>
                                </div>
                                <button 
                                    onClick={() => setShowRegisteredOnly(!showRegisteredOnly)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${showRegisteredOnly ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                                >
                                    <Filter size={14} /> 
                                    {showRegisteredOnly ? 'Registered Only' : 'All Visitors'}
                                </button>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-zinc-50/50 border-b border-zinc-100">
                                            <th className="py-4 pl-8 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">User Identity</th>
                                            <th className="py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                                            <th className="py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Last Active</th>
                                            <th className="py-4 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Sessions</th>
                                            <th className="py-4 text-right text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Actions</th>
                                            <th className="py-4 pr-8 text-right text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Est. Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-50">
                                        {filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-12 text-center text-zinc-400 text-sm font-medium">
                                                    No users found matching current filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredUsers.slice(0, 100).map((u: any, i: number) => (
                                                <tr 
                                                    key={i} 
                                                    onClick={() => setSelectedUser(u)}
                                                    className="group hover:bg-indigo-50/30 cursor-pointer transition-colors"
                                                >
                                                    <td className="py-4 pl-8">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border ${u.isRegistered ? 'bg-indigo-100 text-indigo-600 border-indigo-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
                                                                {u.identity.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-zinc-900 text-xs group-hover:text-indigo-700 transition-colors">
                                                                    {u.identity.length > 20 ? u.identity.substr(0,20) + '...' : u.identity}
                                                                </span>
                                                                {/* DARKENED EMAIL TEXT FOR VISIBILITY OR FALLBACK */}
                                                                {u.email ? (
                                                                    <span className="text-[10px] text-zinc-500 font-bold block">{u.email}</span>
                                                                ) : u.isRegistered && (
                                                                    <span className="text-[9px] text-zinc-300 font-medium italic">Email Hidden</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-4">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wide border ${u.isRegistered ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-zinc-50 text-zinc-500 border-zinc-100'}`}>
                                                            {u.isRegistered ? <UserCheck size={10} /> : <ScanFace size={10} />}
                                                            {u.isRegistered ? 'Member' : 'Guest'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-zinc-700">{formatDate(u.lastSeen)}</span>
                                                            <span className="text-[10px] text-zinc-400 font-medium">{formatTime(u.lastSeen)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 text-center font-bold text-zinc-600 text-xs">{u.sessionCount}</td>
                                                    <td className="py-4 text-right font-bold text-zinc-600 text-xs">{u.actions}</td>
                                                    <td className="py-4 pr-8 text-right">
                                                        <span className="text-xs font-black text-zinc-900">RM {u.estimatedCost.toFixed(3)}</span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COL (1/3) - FEED */}
                    <div className="xl:col-span-1 space-y-8">
                        
                        {/* LIVE FEED LIST */}
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-zinc-100 h-[600px] overflow-hidden flex flex-col relative">
                            <div className="flex justify-between items-center mb-8 shrink-0 relative z-10">
                                <h4 className="text-lg font-black text-zinc-900 tracking-tight">Live Stream</h4>
                                <div className="flex items-center gap-2 px-3 py-1 bg-rose-50 rounded-full border border-rose-100">
                                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping"></div>
                                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wide">Live</span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-0 relative -mx-4 px-4 scroll-smooth">
                                <div className="absolute left-[27px] top-2 bottom-0 w-[2px] bg-zinc-100 z-0"></div>
                                
                                {data.recentLog.slice(0, 20).map((log: any, i: number) => (
                                    <div key={i} className="flex gap-4 relative py-3 group">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-4 border-white z-10 shadow-sm transition-transform group-hover:scale-110 ${log.type === 'ERROR' ? 'bg-rose-100 text-rose-600' : log.type === 'CONVERSION' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                            {log.type === 'VIEW' ? <Smartphone size={14} /> : log.type === 'AI_USAGE' ? <Zap size={14} /> : log.type === 'ERROR' ? <Shield size={14} /> : <CheckCircle2 size={14} />}
                                        </div>
                                        <div className="flex-1 min-w-0 pt-1 pb-2 border-b border-zinc-50 group-last:border-0">
                                            <div className="flex justify-between items-start">
                                                <h5 className="text-xs font-bold text-zinc-800 leading-tight truncate pr-2 group-hover:text-indigo-600 transition-colors">
                                                    {formatEventName(log.name)}
                                                </h5>
                                                <span className="text-[9px] font-bold text-zinc-400 whitespace-nowrap">{formatTime(log.timestamp)}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-1">
                                                <p className="text-[10px] text-zinc-400 font-medium">
                                                    {log.userId ? 'User' : 'Guest'} • {log.tokens ? `${log.tokens} tokens` : 'UI Action'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none z-20"></div>
                        </div>

                        {/* TOKEN BUDGET CARD */}
                        <div className="bg-zinc-900 p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                                <Zap size={120} />
                            </div>
                            
                            <div className="relative z-10">
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="font-bold text-sm text-zinc-400 uppercase tracking-widest">Monthly Quota</h4>
                                    <span className="px-2 py-1 bg-white/10 rounded-md text-[10px] font-bold uppercase border border-white/10">{new Date().toLocaleString('default', { month: 'short' })}</span>
                                </div>
                                
                                <div className="flex items-baseline gap-2 mb-4">
                                    <span className="text-5xl font-black tracking-tighter">{Math.round((data.totalTokens / 500000) * 100)}%</span>
                                    <span className="text-sm font-bold text-zinc-500">Consumed</span>
                                </div>

                                <div className="h-4 bg-zinc-800 rounded-full overflow-hidden mb-6 border border-zinc-700/50">
                                    <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 w-[12%] rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)] relative">
                                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                                        <span className="block text-[10px] text-zinc-500 font-bold uppercase mb-1">Total Requests</span>
                                        <span className="font-bold text-white text-lg">{data.totalEvents}</span>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                                        <span className="block text-[10px] text-zinc-500 font-bold uppercase mb-1">Errors</span>
                                        <span className="font-bold text-white text-lg">0</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* USER DETAIL MODAL */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
                        <div className="bg-zinc-50 p-8 border-b border-zinc-100 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-md ${selectedUser.isRegistered ? 'bg-gradient-to-br from-indigo-500 to-violet-600' : 'bg-gradient-to-br from-zinc-400 to-zinc-600'}`}>
                                        {selectedUser.identity.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-zinc-900 tracking-tight">{selectedUser.identity}</h3>
                                        <div className="flex items-center gap-2">
                                            {selectedUser.isRegistered ? (
                                                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-indigo-200">Registered User</span>
                                            ) : (
                                                <span className="bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-zinc-200">Guest Visitor</span>
                                            )}
                                            {selectedUser.email && <span className="text-xs text-zinc-400 font-medium">{selectedUser.email}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-6 mt-4">
                                    <div>
                                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-0.5">First Seen</span>
                                        <span className="text-xs font-bold text-zinc-700">{formatDate(selectedUser.firstSeen)}</span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block mb-0.5">Last Active</span>
                                        <span className="text-xs font-bold text-zinc-700">{formatDate(selectedUser.lastSeen)} • {formatTime(selectedUser.lastSeen)}</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setSelectedUser(null)} className="p-2 bg-white rounded-full border border-zinc-200 hover:bg-zinc-100 transition-colors shadow-sm">
                                <X size={20} className="text-zinc-400" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-8 bg-white">
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Activity size={14} /> Activity Log
                            </h4>
                            <div className="relative border-l-2 border-zinc-100 ml-3 space-y-8">
                                {selectedUser.history.map((event: any, idx: number) => (
                                    <div key={idx} className="relative pl-8 group">
                                        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-white shadow-sm transition-transform group-hover:scale-125 ${event.type === 'AI_USAGE' ? 'bg-amber-400' : event.type === 'CONVERSION' ? 'bg-emerald-500' : 'bg-indigo-400'}`}></div>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="text-sm font-bold text-zinc-900 block group-hover:text-indigo-600 transition-colors">{formatEventName(event.name)}</span>
                                                <span className="text-[10px] text-zinc-400 font-medium">{formatDate(event.timestamp)} at {formatTime(event.timestamp)}</span>
                                            </div>
                                            {event.tokens > 0 && (
                                                <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-1 rounded border border-amber-100 flex items-center gap-1">
                                                    <Zap size={10} fill="currentColor" /> {event.tokens}
                                                </span>
                                            )}
                                        </div>
                                        {/* Optional Details Rendering */}
                                        {event.details && (event.details.query || event.details.productName || event.details.tokens) && (
                                            <div className="mt-3 bg-zinc-50 p-3 rounded-xl text-[10px] text-zinc-500 font-mono border border-zinc-100">
                                                {event.details.query && <div className="mb-1"><span className="text-zinc-400">Query:</span> "{event.details.query}"</div>}
                                                {event.details.productName && <div><span className="text-zinc-400">Product:</span> "{event.details.productName}"</div>}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex justify-between items-center text-xs font-bold text-zinc-500">
                            <span>Total Lifetime Cost</span>
                            <div className="flex items-center gap-2">
                                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm">RM {selectedUser.estimatedCost.toFixed(4)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default AdminDashboard;
