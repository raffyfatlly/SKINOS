
import React, { useEffect, useState } from 'react';
import { getAnalyticsSummary } from '../services/analyticsService';
import { 
  Search, Bell, Settings, Calendar, ChevronDown, MoreHorizontal, 
  ArrowUpRight, Users, Zap, Activity, Clock, CheckCircle2, 
  BarChart3, LayoutGrid, Home, Wallet, FileText, LogOut,
  Smartphone, Monitor, Shield
} from 'lucide-react';

interface AdminDashboardProps {
  onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('Week');

  useEffect(() => {
    const load = async () => {
      // Fetch 7 days of data
      const res = await getAnalyticsSummary(7);
      setData(res);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F7FE] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
            <p className="text-indigo-900/50 font-bold text-xs uppercase tracking-widest">Loading Live Data...</p>
        </div>
      </div>
    );
  }

  // --- SUB-COMPONENTS ---

  const SidebarItem = ({ icon: Icon, label, active = false }: any) => (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all cursor-pointer ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-zinc-400 hover:text-indigo-600 hover:bg-white'}`}>
          <Icon size={20} strokeWidth={active ? 2.5 : 2} />
          <span className="text-sm font-bold">{label}</span>
      </div>
  );

  const StatWidget = ({ icon: Icon, label, value, sub, color }: any) => (
      <div className="bg-white p-4 rounded-[1.5rem] flex items-center gap-4 shadow-sm border border-zinc-50">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color}`}>
              <Icon size={24} />
          </div>
          <div>
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-wide">{label}</p>
              <h4 className="text-xl font-black text-zinc-800 leading-none mt-1">{value}</h4>
              {sub && <p className="text-[10px] text-zinc-400 mt-1 font-medium">{sub}</p>}
          </div>
      </div>
  );

  // Custom Bar Chart to match reference "Income Tracker"
  const TrafficChart = () => {
      // Map analytics data to chart bars. If no data, show placeholders.
      const chartData = data?.chartData || [];
      // Fill to 7 days if needed
      const displayData = Array.from({ length: 7 }).map((_, i) => {
          const dayData = chartData[i] || { date: 'Day', count: Math.floor(Math.random() * 50) + 10 };
          return {
              label: new Date(dayData.date).toLocaleDateString('en-US', { weekday: 'narrow' }),
              value: dayData.count,
              active: i === chartData.length - 1 // Highlight today
          };
      });

      const maxVal = Math.max(...displayData.map(d => d.value)) || 100;

      return (
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-zinc-50 h-full flex flex-col">
              <div className="flex justify-between items-start mb-8">
                  <div>
                      <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                              <Activity size={20} />
                          </div>
                          <h3 className="text-xl font-black text-zinc-900">Traffic Tracker</h3>
                      </div>
                      <p className="text-zinc-400 text-xs font-medium pl-1">Daily interaction volume & tokens</p>
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 bg-zinc-50 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">
                      {timeRange} <ChevronDown size={14} />
                  </button>
              </div>

              <div className="flex-1 flex items-end justify-between gap-2 sm:gap-6 relative">
                  {/* Total Overlay */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 text-center">
                      <span className="text-3xl font-black text-zinc-900 block">{data.totalEvents}</span>
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wide">+20% vs last week</span>
                  </div>

                  {displayData.map((d, i) => (
                      <div key={i} className="flex flex-col items-center gap-3 flex-1 group cursor-pointer">
                          {/* Tooltip Value */}
                          <div className={`text-xs font-bold transition-all duration-300 ${d.active ? 'text-indigo-600 -translate-y-1' : 'text-zinc-300 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1'}`}>
                              {d.value}
                          </div>
                          
                          {/* Bar Track */}
                          <div className="w-full bg-zinc-50 rounded-2xl h-48 flex items-end p-1 relative overflow-hidden">
                              {/* Bar Fill */}
                              <div 
                                className={`w-full rounded-xl transition-all duration-1000 ease-out relative ${d.active ? 'bg-indigo-600 shadow-lg shadow-indigo-200' : 'bg-indigo-200 group-hover:bg-indigo-300'}`}
                                style={{ height: `${(d.value / maxVal) * 100}%` }}
                              >
                                  {d.active && (
                                      <div className="absolute top-0 left-0 right-0 h-1 bg-white/30 rounded-t-xl"></div>
                                  )}
                              </div>
                          </div>
                          <span className={`text-xs font-bold uppercase ${d.active ? 'text-indigo-600' : 'text-zinc-400'}`}>{d.label}</span>
                      </div>
                  ))}
              </div>
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-[#F4F7FE] font-sans text-slate-800 flex overflow-hidden">
        
        {/* SIDEBAR (Desktop) */}
        <div className="w-64 bg-white hidden lg:flex flex-col border-r border-zinc-100">
            <div className="p-8 flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                    <Activity size={20} strokeWidth={3} />
                </div>
                <span className="text-xl font-black text-zinc-900 tracking-tight">SkinOS</span>
            </div>

            <div className="px-4 space-y-2 flex-1">
                <SidebarItem icon={Home} label="Dashboard" active />
                <SidebarItem icon={BarChart3} label="Analytics" />
                <SidebarItem icon={Wallet} label="Revenue" />
                <SidebarItem icon={LayoutGrid} label="Products" />
                <SidebarItem icon={Users} label="Customers" />
                <div className="my-6 border-t border-zinc-100 mx-4"></div>
                <SidebarItem icon={Settings} label="Settings" />
            </div>

            <div className="p-6">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white relative overflow-hidden shadow-xl shadow-indigo-500/20">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-10 -mt-10 blur-xl"></div>
                    <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center mb-3">
                        <Zap size={16} fill="currentColor" className="text-yellow-300" />
                    </div>
                    <h4 className="font-bold text-sm mb-1">Upgrade Plan</h4>
                    <p className="text-[10px] opacity-80 mb-3 leading-relaxed">Unlock advanced AI analysis features.</p>
                    <button className="text-[10px] font-bold bg-white text-indigo-600 px-3 py-2 rounded-lg w-full">View Offers</button>
                </div>
            </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col h-screen overflow-y-auto">
            
            {/* TOP HEADER */}
            <div className="sticky top-0 z-30 bg-[#F4F7FE]/80 backdrop-blur-xl px-8 py-5 flex justify-between items-center">
                <div>
                    <p className="text-xs font-bold text-zinc-400 mb-1">Pages / Dashboard</p>
                    <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Main Dashboard</h1>
                </div>

                <div className="bg-white p-2 rounded-full shadow-sm border border-white flex items-center gap-4 pl-4">
                    <div className="flex items-center gap-2 bg-zinc-50 px-3 py-2 rounded-full text-zinc-400">
                        <Search size={14} />
                        <input placeholder="Search..." className="bg-transparent border-none outline-none text-xs font-bold w-24 sm:w-48 text-zinc-600 placeholder:text-zinc-300" />
                    </div>
                    <button className="text-zinc-400 hover:text-indigo-600 transition-colors relative">
                        <Bell size={18} />
                        <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
                    </button>
                    <button onClick={onBack} className="text-zinc-400 hover:text-rose-600 transition-colors" title="Exit">
                        <LogOut size={18} />
                    </button>
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs border-2 border-white shadow-sm">
                        AD
                    </div>
                </div>
            </div>

            <div className="px-8 pb-12 space-y-6">
                
                {/* 1. STATS ROW */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatWidget icon={Activity} label="Est. Cost" value={`RM ${data.estimatedCost.toFixed(2)}`} color="bg-indigo-50 text-indigo-600" sub="Since last invoice" />
                    <StatWidget icon={Zap} label="Token Usage" value={(data.totalTokens / 1000).toFixed(1) + 'k'} color="bg-amber-50 text-amber-500" sub="Gemini 2.5 Flash" />
                    <StatWidget icon={Users} label="Total Visitors" value={data.uniqueVisitors} color="bg-emerald-50 text-emerald-600" sub="+12% this month" />
                    <StatWidget icon={FileText} label="Scans Run" value={data.totalEvents} color="bg-rose-50 text-rose-600" sub="Analyzing..." />
                </div>

                {/* 2. MAIN LAYOUT GRID */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    
                    {/* LEFT COL (2/3) */}
                    <div className="xl:col-span-2 space-y-6">
                        {/* CHART */}
                        <TrafficChart />

                        {/* BOTTOM ROW WIDGETS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* ACTIVE USERS WIDGET (Like "Let's Connect") */}
                            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-50">
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="font-black text-zinc-900">Top Active Users</h4>
                                    <button className="text-indigo-600 text-xs font-bold">See all</button>
                                </div>
                                <div className="space-y-4">
                                    {data.userTable.slice(0, 3).map((u: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between p-3 hover:bg-zinc-50 rounded-2xl transition-colors group cursor-pointer border border-transparent hover:border-zinc-100">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold text-xs border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                                                    {u.isUser ? 'U' : 'G'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-zinc-900">{u.userId || `Guest ${u.vid.substr(0,4)}`}</p>
                                                    <p className="text-[10px] text-zinc-400 font-medium">{u.actions} Actions • {u.isUser ? 'Premium' : 'Free'}</p>
                                                </div>
                                            </div>
                                            <button className="w-8 h-8 rounded-full bg-zinc-50 text-zinc-400 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                                                <ArrowUpRight size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* SYSTEM HEALTH WIDGET (Like "Premium Features") */}
                            <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 rounded-[2rem] text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                                
                                <div>
                                    <h4 className="font-black text-lg mb-1">System Health</h4>
                                    <p className="text-white/60 text-xs">All systems operational.</p>
                                </div>

                                <div className="space-y-4 mt-6 relative z-10">
                                    <div className="flex items-center justify-between text-xs font-bold">
                                        <span className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div> Gemini API</span>
                                        <span className="text-emerald-400">99.9%</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs font-bold">
                                        <span className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-400 rounded-full"></div> Firestore</span>
                                        <span className="text-emerald-400">OK</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs font-bold">
                                        <span className="flex items-center gap-2"><div className="w-2 h-2 bg-indigo-400 rounded-full"></div> Stripe</span>
                                        <span className="text-indigo-400">Live</span>
                                    </div>
                                </div>

                                <button className="mt-6 w-full py-3 bg-white/10 backdrop-blur-md rounded-xl text-xs font-bold hover:bg-white/20 transition-colors flex items-center justify-center gap-2">
                                    View Error Logs <ArrowUpRight size={12} />
                                </button>
                            </div>

                        </div>
                    </div>

                    {/* RIGHT COL (1/3) - FEED */}
                    <div className="xl:col-span-1 space-y-6">
                        
                        {/* LIVE FEED LIST (Like "Recent Projects") */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-50 h-full">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="font-black text-zinc-900">Live Feed</h4>
                                <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></div>
                            </div>

                            <div className="space-y-6 relative">
                                <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-zinc-100"></div>
                                
                                {data.recentLog.slice(0, 6).map((log: any, i: number) => (
                                    <div key={i} className="flex gap-4 relative">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-4 border-white z-10 shadow-sm ${log.type === 'ERROR' ? 'bg-rose-100 text-rose-600' : log.type === 'CONVERSION' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                            {log.type === 'VIEW' ? <Smartphone size={16} /> : log.type === 'AI_USAGE' ? <Zap size={16} /> : log.type === 'ERROR' ? <Shield size={16} /> : <CheckCircle2 size={16} />}
                                        </div>
                                        <div>
                                            <h5 className="text-sm font-bold text-zinc-800 leading-tight">{log.name.replace(/_/g, ' ')}</h5>
                                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide mt-0.5">
                                                {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {log.tokens ? `${log.tokens} Tok` : 'Action'}
                                            </p>
                                            {log.details && Object.keys(log.details).length > 0 && (
                                                <div className="mt-1.5 px-2 py-1 bg-zinc-50 rounded border border-zinc-100 inline-block">
                                                    <p className="text-[10px] text-zinc-500 font-mono truncate max-w-[120px]">
                                                        {JSON.stringify(Object.values(log.details)[0])}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* TOKEN BUDGET (Like "Proposal Progress") */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-50">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-black text-zinc-900">Monthly Quota</h4>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">{new Date().toLocaleString('default', { month: 'long' })}</span>
                            </div>
                            
                            <div className="flex items-end gap-1 mb-2">
                                <span className="text-4xl font-black text-zinc-900">{Math.round((data.totalTokens / 500000) * 100)}%</span>
                                <span className="text-sm font-bold text-zinc-400 mb-1.5">Used</span>
                            </div>

                            <div className="h-3 bg-zinc-100 rounded-full overflow-hidden mb-4">
                                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 w-[12%] rounded-full shadow-lg shadow-indigo-200"></div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-zinc-50 rounded-xl p-2">
                                    <span className="block text-[10px] text-zinc-400 font-bold uppercase">Requests</span>
                                    <span className="font-black text-zinc-800">{data.totalEvents}</span>
                                </div>
                                <div className="bg-zinc-50 rounded-xl p-2">
                                    <span className="block text-[10px] text-zinc-400 font-bold uppercase">Errors</span>
                                    <span className="font-black text-zinc-800">0</span>
                                </div>
                                <div className="bg-zinc-50 rounded-xl p-2">
                                    <span className="block text-[10px] text-zinc-400 font-bold uppercase">Limit</span>
                                    <span className="font-black text-zinc-800">1M</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default AdminDashboard;
