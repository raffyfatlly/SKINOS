
import React, { useEffect, useState } from 'react';
import { getAnalyticsSummary } from '../services/analyticsService';
import { 
  Search, Bell, Settings, Calendar, ChevronDown, MoreHorizontal, 
  ArrowUpRight, Users, Zap, Activity, Clock, CheckCircle2, 
  BarChart3, LayoutGrid, Home, Wallet, FileText, LogOut,
  Smartphone, Monitor, Shield, AlertTriangle, Database, DollarSign
} from 'lucide-react';

interface AdminDashboardProps {
  onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('Week');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getAnalyticsSummary(7);
        if (res) {
            setData(res);
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
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F7FE] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
            <p className="text-indigo-900/50 font-bold text-xs uppercase tracking-widest">Crunching Usage Data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
      return (
          <div className="min-h-screen bg-[#F4F7FE] flex items-center justify-center p-6">
              <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center border border-red-100">
                  <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                      <AlertTriangle size={32} />
                  </div>
                  <h2 className="text-xl font-black text-zinc-900 mb-2">Analytics Error</h2>
                  
                  {error === 'PERMISSION_DENIED' ? (
                      <div className="text-sm text-zinc-600 mb-6 space-y-2">
                          <p className="font-bold text-red-600">Database Permission Denied.</p>
                          <p className="text-xs bg-zinc-50 p-3 rounded-lg border border-zinc-100 text-left">
                              1. Go to <strong>Firebase Console</strong> &gt; <strong>Firestore Database</strong><br/>
                              2. Click <strong>Rules</strong> tab.<br/>
                              3. Set rules to allow read/write for <code>analytics_events</code>.<br/>
                              4. Ensure the database is actually created!
                          </p>
                      </div>
                  ) : (
                      <p className="text-sm text-zinc-600 mb-6">
                          {error || "No data returned. Ensure Firestore is created and initialized."}
                      </p>
                  )}
                  
                  <button onClick={onBack} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold text-sm">
                      Go Back
                  </button>
              </div>
          </div>
      )
  }

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

  const TrafficChart = () => {
      const chartData = data?.chartData || [];
      const displayData = Array.from({ length: 7 }).map((_, i) => {
          const dayData = chartData[i] || { date: 'Day', count: 0 };
          return {
              label: dayData.date === 'Day' ? `Day ${i+1}` : dayData.date,
              value: dayData.count,
              active: i === chartData.length - 1 
          };
      });

      const maxVal = Math.max(...displayData.map(d => d.value)) || 10; 

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
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 text-center">
                      <span className="text-3xl font-black text-zinc-900 block">{data.totalEvents}</span>
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wide">Total Events</span>
                  </div>

                  {displayData.map((d, i) => (
                      <div key={i} className="flex flex-col items-center gap-3 flex-1 group cursor-pointer">
                          <div className={`text-xs font-bold transition-all duration-300 ${d.active ? 'text-indigo-600 -translate-y-1' : 'text-zinc-300 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1'}`}>
                              {d.value}
                          </div>
                          <div className="w-full bg-zinc-50 rounded-2xl h-48 flex items-end p-1 relative overflow-hidden">
                              <div 
                                className={`w-full rounded-xl transition-all duration-1000 ease-out relative ${d.active ? 'bg-indigo-600 shadow-lg shadow-indigo-200' : 'bg-indigo-200 group-hover:bg-indigo-300'}`}
                                style={{ height: `${(d.value / maxVal) * 100}%` }}
                              ></div>
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
                    <Database size={20} strokeWidth={3} />
                </div>
                <span className="text-xl font-black text-zinc-900 tracking-tight">Admin</span>
            </div>

            <div className="px-4 space-y-2 flex-1">
                <SidebarItem icon={Home} label="Overview" active />
                <SidebarItem icon={Users} label="User Usage" />
                <SidebarItem icon={Zap} label="API Cost" />
                <SidebarItem icon={Settings} label="Config" />
            </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col h-screen overflow-y-auto">
            
            {/* TOP HEADER */}
            <div className="sticky top-0 z-30 bg-[#F4F7FE]/80 backdrop-blur-xl px-8 py-5 flex justify-between items-center">
                <div>
                    <p className="text-xs font-bold text-zinc-400 mb-1">System / Analytics</p>
                    <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Usage Dashboard</h1>
                </div>

                <div className="bg-white p-2 rounded-full shadow-sm border border-white flex items-center gap-4 pl-4">
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
                    <StatWidget icon={Activity} label="Est. Cost" value={`RM ${data.estimatedCost.toFixed(2)}`} color="bg-indigo-50 text-indigo-600" sub="Gemini API Cost" />
                    <StatWidget icon={Zap} label="Token Burn" value={(data.totalTokens / 1000).toFixed(1) + 'k'} color="bg-amber-50 text-amber-500" sub="Total Input + Output" />
                    <StatWidget icon={Users} label="Active Users" value={data.uniqueVisitors} color="bg-emerald-50 text-emerald-600" sub={`${data.registeredUsers} Registered`} />
                    <StatWidget icon={FileText} label="Events" value={data.totalEvents} color="bg-rose-50 text-rose-600" sub="Last 7 Days" />
                </div>

                {/* 2. MAIN LAYOUT GRID */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    
                    {/* LEFT COL (2/3) */}
                    <div className="xl:col-span-2 space-y-6">
                        {/* CHART */}
                        <TrafficChart />

                        {/* USAGE BREAKDOWN (Replaces old 'Active Users' widget with detailed table) */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-50">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h4 className="font-black text-zinc-900">Heavy Hitters</h4>
                                    <p className="text-xs text-zinc-400">Users by Token Consumption</p>
                                </div>
                                <button className="text-indigo-600 text-xs font-bold">Export CSV</button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-[10px] text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                                            <th className="pb-3 pl-2">User / Visitor</th>
                                            <th className="pb-3">Type</th>
                                            <th className="pb-3 text-center">Sessions</th>
                                            <th className="pb-3 text-right">Avg Tokens</th>
                                            <th className="pb-3 text-right">Total Tokens</th>
                                            <th className="pb-3 text-right pr-2">Est. Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {data.userTable.slice(0, 10).map((u: any, i: number) => (
                                            <tr key={i} className="group hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0">
                                                <td className="py-3 pl-2 font-bold text-zinc-700 font-mono text-xs">
                                                    {u.identity.length > 20 ? u.identity.substr(0,12) + '...' : u.identity}
                                                </td>
                                                <td className="py-3">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${u.isRegistered ? 'bg-indigo-50 text-indigo-600' : 'bg-zinc-100 text-zinc-500'}`}>
                                                        {u.isRegistered ? 'User' : 'Guest'}
                                                    </span>
                                                </td>
                                                <td className="py-3 font-medium text-zinc-600 text-center">{u.sessionCount}</td>
                                                <td className="py-3 font-medium text-zinc-600 text-right">{Math.round(u.avgTokensPerSession)}</td>
                                                <td className="py-3 font-bold text-indigo-600 text-right">{(u.tokens / 1000).toFixed(1)}k</td>
                                                <td className="py-3 text-right pr-2 text-xs font-bold text-emerald-600">
                                                    RM {u.estimatedCost.toFixed(4)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COL (1/3) - FEED */}
                    <div className="xl:col-span-1 space-y-6">
                        
                        {/* LIVE FEED LIST */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-50 h-[500px] overflow-hidden flex flex-col">
                            <div className="flex justify-between items-center mb-6 shrink-0">
                                <h4 className="font-black text-zinc-900">Live Stream</h4>
                                <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></div>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-6 relative pr-2">
                                <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-zinc-100"></div>
                                
                                {data.recentLog.slice(0, 15).map((log: any, i: number) => (
                                    <div key={i} className="flex gap-4 relative">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-4 border-white z-10 shadow-sm ${log.type === 'ERROR' ? 'bg-rose-100 text-rose-600' : log.type === 'CONVERSION' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                            {log.type === 'VIEW' ? <Smartphone size={16} /> : log.type === 'AI_USAGE' ? <Zap size={16} /> : log.type === 'ERROR' ? <Shield size={16} /> : <CheckCircle2 size={16} />}
                                        </div>
                                        <div>
                                            <h5 className="text-sm font-bold text-zinc-800 leading-tight">{log.name.replace(/_/g, ' ')}</h5>
                                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide mt-0.5">
                                                {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {log.tokens ? `${log.tokens} Tok` : 'Action'}
                                            </p>
                                            {log.userId && (
                                                <span className="text-[9px] text-indigo-400 block mt-0.5">User: {log.userId.substr(0,5)}...</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* TOKEN BUDGET */}
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
