
import React, { useEffect, useState } from 'react';
import { getAnalyticsSummary, getMockAnalyticsSummary } from '../services/analyticsService';
import { 
  Search, Bell, Settings, Calendar, ChevronDown, MoreHorizontal, 
  ArrowUpRight, Users, Zap, Activity, Clock, CheckCircle2, 
  BarChart3, LayoutGrid, Home, Wallet, FileText, LogOut,
  Smartphone, Monitor, Shield, AlertTriangle, Database, DollarSign, Filter, UserCheck, X, RotateCw, Eye
} from 'lucide-react';

interface AdminDashboardProps {
  onBack: () => void;
}

// Format timestamp nicely
const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const formatDate = (ts: number) => new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });

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
                      <div className="text-sm text-zinc-600 mb-6 space-y-4">
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
                  
                  <div className="flex flex-col gap-3">
                      <div className="flex gap-3">
                          <button onClick={loadData} className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                              <RotateCw size={16} /> Retry
                          </button>
                          <button onClick={loadDemoData} className="flex-1 bg-zinc-100 text-zinc-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2">
                              <Eye size={16} /> View Demo
                          </button>
                      </div>
                      <button onClick={onBack} className="text-zinc-400 hover:text-zinc-600 text-xs font-bold uppercase tracking-widest mt-2">
                          Go Back
                      </button>
                  </div>
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

  const filteredUsers = showRegisteredOnly 
    ? data.userTable.filter((u: any) => u.isRegistered) 
    : data.userTable;

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
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-bold text-zinc-400">System / Analytics</p>
                        {isDemoMode && (
                            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-amber-200">Demo Mode</span>
                        )}
                    </div>
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

                        {/* USAGE BREAKDOWN */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-50">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h4 className="font-black text-zinc-900">User Inspector</h4>
                                    <p className="text-xs text-zinc-400">Click a user to see detailed logs</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => setShowRegisteredOnly(!showRegisteredOnly)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${showRegisteredOnly ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-500'}`}
                                    >
                                        <Filter size={14} /> 
                                        {showRegisteredOnly ? 'Registered Only' : 'All Visitors'}
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-[10px] text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                                            <th className="pb-3 pl-2">User Identity</th>
                                            <th className="pb-3">Last Active</th>
                                            <th className="pb-3 text-center">Sessions</th>
                                            <th className="pb-3 text-right">Events</th>
                                            <th className="pb-3 text-right">Total Tokens</th>
                                            <th className="pb-3 text-right pr-2">Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-8 text-center text-zinc-400 text-sm">
                                                    No users found matching filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            // INCREASED LIMIT TO 100 TO SHOW FULL LIST
                                            filteredUsers.slice(0, 100).map((u: any, i: number) => (
                                                <tr 
                                                    key={i} 
                                                    onClick={() => setSelectedUser(u)}
                                                    className="group hover:bg-indigo-50/50 cursor-pointer transition-colors border-b border-zinc-50 last:border-0"
                                                >
                                                    <td className="py-3 pl-2">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-zinc-900 text-sm group-hover:text-indigo-700">
                                                                {u.identity.length > 25 ? u.identity.substr(0,25) + '...' : u.identity}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${u.isRegistered ? 'bg-indigo-100 text-indigo-600' : 'bg-zinc-100 text-zinc-500'}`}>
                                                                    {u.isRegistered ? <UserCheck size={8} /> : null}
                                                                    {u.isRegistered ? 'User' : 'Guest'}
                                                                </span>
                                                                {u.email && (
                                                                    <span className="text-[10px] text-zinc-400 font-medium">{u.email}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3">
                                                        <div className="text-xs text-zinc-600">
                                                            <span className="font-bold block text-zinc-800">{formatDate(u.lastSeen)}</span>
                                                            <span className="text-zinc-400 text-[10px]">{formatTime(u.lastSeen)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 font-medium text-zinc-600 text-center">{u.sessionCount}</td>
                                                    <td className="py-3 font-medium text-zinc-600 text-right">{u.actions}</td>
                                                    <td className="py-3 font-bold text-indigo-600 text-right">{(u.tokens / 1000).toFixed(1)}k</td>
                                                    <td className="py-3 text-right pr-2 text-xs font-bold text-emerald-600">
                                                        RM {u.estimatedCost.toFixed(4)}
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
                                                {formatTime(log.timestamp)} • {log.tokens ? `${log.tokens} Tok` : 'Action'}
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

            {/* USER DETAIL MODAL */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/60 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
                        <div className="bg-zinc-50 p-6 border-b border-zinc-100 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-xl font-black text-zinc-900">{selectedUser.identity}</h3>
                                    {selectedUser.isRegistered && <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Registered</span>}
                                </div>
                                {selectedUser.email && <p className="text-sm text-zinc-500 font-medium mb-1">{selectedUser.email}</p>}
                                <div className="flex gap-4 mt-2">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">First Seen: {formatDate(selectedUser.firstSeen)}</span>
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Last Seen: {formatTime(selectedUser.lastSeen)}</span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedUser(null)} className="p-2 bg-white rounded-full border border-zinc-100 hover:bg-zinc-100 transition-colors">
                                <X size={20} className="text-zinc-400" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 bg-white">
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Activity Log</h4>
                            <div className="relative border-l-2 border-zinc-100 ml-3 space-y-6">
                                {selectedUser.history.map((event: any, idx: number) => (
                                    <div key={idx} className="relative pl-6">
                                        <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${event.type === 'AI_USAGE' ? 'bg-amber-400' : event.type === 'CONVERSION' ? 'bg-emerald-500' : 'bg-indigo-400'}`}></div>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="text-xs font-bold text-zinc-900 block">{event.name.replace(/_/g, ' ')}</span>
                                                <span className="text-[10px] text-zinc-400 font-medium">{formatDate(event.timestamp)} at {formatTime(event.timestamp)}</span>
                                            </div>
                                            {event.tokens > 0 && (
                                                <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-1 rounded border border-amber-100">
                                                    {event.tokens} Tok
                                                </span>
                                            )}
                                        </div>
                                        {/* Optional Details Rendering */}
                                        {event.details && (event.details.query || event.details.productName) && (
                                            <div className="mt-2 bg-zinc-50 p-2 rounded text-[10px] text-zinc-500 font-mono border border-zinc-100">
                                                {event.details.query && `Query: "${event.details.query}"`}
                                                {event.details.productName && `Product: "${event.details.productName}"`}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex justify-between items-center text-xs font-bold text-zinc-500">
                            <span>Total Lifetime Cost</span>
                            <span className="text-emerald-600 text-lg">RM {selectedUser.estimatedCost.toFixed(4)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default AdminDashboard;
