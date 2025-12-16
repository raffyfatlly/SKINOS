
import React, { useEffect, useState, useMemo } from 'react';
import { getAnalyticsSummary } from '../services/analyticsService';
import { ArrowLeft, Users, DollarSign, Activity, Zap, Eye, Database, Search, X, Clock, ChevronRight, User, Fingerprint, MapPin, Globe, CreditCard, Settings, Home, BarChart3, PieChart, Menu, Check } from 'lucide-react';
import { AnalyticsEvent } from '../types';

interface AdminDashboardProps {
  onBack: () => void;
}

const DashboardCard: React.FC<{ 
    title: string; 
    value: string | number; 
    subValue?: string; 
    icon: any; 
    colorClass: string 
}> = ({ title, value, subValue, icon: Icon, colorClass }) => (
    <div className="bg-slate-800 rounded-2xl p-5 shadow-lg border border-slate-700/50 flex justify-between items-center">
        <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
            <h3 className="text-white text-2xl font-black">{value}</h3>
            {subValue && <p className="text-emerald-400 text-xs font-bold mt-1">{subValue}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClass} shadow-lg`}>
            <Icon size={24} className="text-white" />
        </div>
    </div>
);

// --- SPLINE CHART COMPONENT ---
const SplineChart: React.FC<{ data: { date: string, count: number }[] }> = ({ data }) => {
    // Normalize data for SVG
    if (!data.length) return <div className="h-full flex items-center justify-center text-slate-500">No Data</div>;
    
    const height = 200;
    const width = 500; // viewBox width
    const maxVal = Math.max(...data.map(d => d.count), 10);
    
    // Generate points
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1 || 1)) * width;
        const y = height - (d.count / maxVal) * (height - 40); // 40px padding bottom
        return `${x},${y}`;
    }).join(' ');

    // Curve logic (simple polyline for stability, could use bezier library)
    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0" />
                </linearGradient>
            </defs>
            <polyline 
                points={points} 
                fill="none" 
                stroke="#2DD4BF" 
                strokeWidth="4" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="drop-shadow-lg"
            />
            <polygon 
                points={`${0},${height} ${points} ${width},${height}`} 
                fill="url(#chartGradient)" 
                opacity="0.5"
            />
            {/* Dots */}
            {data.map((d, i) => {
                const x = (i / (data.length - 1 || 1)) * width;
                const y = height - (d.count / maxVal) * (height - 40);
                return (
                    <circle key={i} cx={x} cy={y} r="4" fill="#0F172A" stroke="#2DD4BF" strokeWidth="2" />
                )
            })}
        </svg>
    )
}

// --- USER MAP COMPONENT (Simulated) ---
const UserMap: React.FC<{ users: any[] }> = ({ users }) => {
    // Deterministic random generator for stability
    const pseudoRandom = (seed: string) => {
        let h = 0xdeadbeef;
        for(let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 2654435761);
        return ((h ^ h >>> 16) >>> 0) / 4294967296;
    }

    return (
        <div className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center border border-slate-700">
            {/* World Map Silhouette (Abstract) */}
            <div className="absolute inset-0 opacity-20">
                 <svg viewBox="0 0 1000 500" className="w-full h-full fill-slate-500">
                     {/* Rough approximation of continents */}
                     <path d="M200,150 Q300,50 400,150 T600,150 T800,100" stroke="none" fill="currentColor" opacity="0.5" />
                     <path d="M250,300 Q350,400 450,300 T650,350" stroke="none" fill="currentColor" opacity="0.5" />
                     <circle cx="800" cy="350" r="30" fill="currentColor" opacity="0.5" />
                 </svg>
            </div>
            
            {/* Grid Lines */}
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, #475569 1px, transparent 1px)', backgroundSize: '20px 20px', opacity: 0.1 }}></div>

            {/* Plot Users */}
            {users.slice(0, 50).map((u, i) => {
                const lat = pseudoRandom(u.vid + 'lat') * 80 + 10; // 10% to 90% top
                const lng = pseudoRandom(u.vid + 'lng') * 80 + 10; // 10% to 90% left
                
                return (
                    <div 
                        key={i}
                        className="absolute w-3 h-3 group"
                        style={{ top: `${lat}%`, left: `${lng}%` }}
                    >
                        <div className={`w-2 h-2 rounded-full ${u.isUser ? 'bg-teal-400' : 'bg-blue-500'} animate-pulse shadow-[0_0_10px_currentColor]`}></div>
                        {/* Tooltip */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-2 py-1 rounded border border-slate-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                            {u.isUser ? 'Member' : 'Guest'} • {u.actions} Events
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const summary = await getAnalyticsSummary(7);
      setData(summary);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const filteredUsers = useMemo(() => {
      if (!data) return [];
      if (!searchTerm) return data.userTable;
      return data.userTable.filter((u: any) => 
        u.vid.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (u.userId && u.userId.toLowerCase().includes(searchTerm.toLowerCase()))
      );
  }, [data, searchTerm]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Initializing Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-8 text-white bg-slate-950 min-h-screen">Failed to load analytics.</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex overflow-hidden">
        
        {/* --- SIDEBAR --- */}
        <div className={`fixed inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 z-50`}>
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-3 text-white">
                    <Database size={24} className="text-teal-500" />
                    <span className="font-bold text-lg tracking-tight">SkinOS Admin</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400"><X size={20}/></button>
            </div>
            
            <div className="p-4 space-y-2">
                <div className="px-4 py-3 bg-teal-500/10 text-teal-400 rounded-xl flex items-center gap-3 font-bold text-sm border border-teal-500/20">
                    <Home size={18} /> Dashboard
                </div>
                <div className="px-4 py-3 text-slate-400 hover:bg-slate-800 rounded-xl flex items-center gap-3 font-bold text-sm transition-colors cursor-not-allowed opacity-50">
                    <BarChart3 size={18} /> Tables
                </div>
                <div className="px-4 py-3 text-slate-400 hover:bg-slate-800 rounded-xl flex items-center gap-3 font-bold text-sm transition-colors cursor-not-allowed opacity-50">
                    <CreditCard size={18} /> Billing
                </div>
                <div className="px-4 py-3 text-slate-400 hover:bg-slate-800 rounded-xl flex items-center gap-3 font-bold text-sm transition-colors cursor-not-allowed opacity-50">
                    <Settings size={18} /> Settings
                </div>
            </div>

            <div className="absolute bottom-6 left-6 right-6">
                <button onClick={onBack} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
                    <ArrowLeft size={14} /> Exit Admin
                </button>
            </div>
        </div>

        {/* --- MAIN CONTENT --- */}
        <div className="flex-1 md:ml-64 h-screen overflow-y-auto bg-slate-950 relative">
            
            {/* Topbar */}
            <div className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex justify-between items-center border-b border-slate-800/50">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-slate-400 bg-slate-900 rounded-lg">
                        <Menu size={20} />
                    </button>
                    <div className="hidden sm:block">
                        <p className="text-slate-500 text-xs font-bold">Pages / <span className="text-white">Dashboard</span></p>
                        <h1 className="text-white font-bold text-sm mt-0.5">Analytics Overview</h1>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative hidden sm:block">
                        <input 
                            type="text" 
                            placeholder="Type here..." 
                            className="bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-teal-500 w-48 transition-all focus:w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                        <Settings size={18} className="hover:text-white cursor-pointer transition-colors" />
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <DashboardCard 
                        title="Est. Cost (RM)" 
                        value={`RM ${data.estimatedCost.toFixed(2)}`} 
                        subValue="+5% this week" 
                        icon={DollarSign} 
                        colorClass="bg-emerald-500" 
                    />
                    <DashboardCard 
                        title="Total Users" 
                        value={data.uniqueVisitors} 
                        subValue={`${data.registeredUsers} Registered`} 
                        icon={Users} 
                        colorClass="bg-teal-500" 
                    />
                    <DashboardCard 
                        title="New Clients" 
                        value={data.registeredUsers} 
                        subValue="-2% vs yesterday" 
                        icon={Globe} 
                        colorClass="bg-blue-500" 
                    />
                    <DashboardCard 
                        title="Total Tokens" 
                        value={`${(data.totalTokens / 1000).toFixed(1)}k`} 
                        subValue="Gemini Flash 2.5" 
                        icon={Zap} 
                        colorClass="bg-orange-500" 
                    />
                </div>

                {/* Main Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Sales Overview (Line Chart) */}
                    <div className="lg:col-span-2 bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700/50 flex flex-col">
                        <div className="mb-6">
                            <h3 className="text-white font-bold text-lg">Traffic Overview</h3>
                            <p className="text-slate-400 text-sm flex items-center gap-2">
                                <span className="text-emerald-400 font-bold">(+23%)</span> more traffic in 2025
                            </p>
                        </div>
                        <div className="flex-1 h-64 w-full">
                            <SplineChart data={data.chartData} />
                        </div>
                    </div>

                    {/* Active Users Map */}
                    <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700/50 flex flex-col">
                         <div className="mb-6">
                            <h3 className="text-white font-bold text-lg">User Locations</h3>
                            <p className="text-slate-400 text-sm">Real-time active sessions</p>
                        </div>
                        <div className="flex-1 h-64 w-full rounded-xl overflow-hidden relative">
                            <UserMap users={data.userTable} />
                            
                            {/* Stats Overlay */}
                            <div className="absolute bottom-4 left-4 right-4 flex justify-between">
                                <div className="bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-600">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Guests</span>
                                    <span className="text-white font-bold">{data.uniqueVisitors - data.registeredUsers}</span>
                                </div>
                                <div className="bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-600">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Members</span>
                                    <span className="text-emerald-400 font-bold">{data.registeredUsers}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Projects / Users Table */}
                <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700/50">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-white font-bold text-lg">Active Sessions</h3>
                            <p className="text-slate-400 text-sm flex items-center gap-1">
                                <Check size={14} className="text-emerald-400" />
                                <span className="font-bold text-slate-300">{data.userTable.length} done</span> this month
                            </p>
                        </div>
                        <button className="text-teal-400 text-sm font-bold hover:text-teal-300">See all</button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-700">
                                    <th className="pb-3 pl-2">User / Visitor</th>
                                    <th className="pb-3">Status</th>
                                    <th className="pb-3 text-center">Tokens</th>
                                    <th className="pb-3 text-center">Engagement</th>
                                    <th className="pb-3 text-right pr-2">Cost (RM)</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {filteredUsers.slice(0, 10).map((u: any, i: number) => (
                                    <tr key={i} className="group hover:bg-slate-700/30 transition-colors border-b border-slate-700/50 last:border-0">
                                        <td className="py-4 pl-2">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold ${u.isUser ? 'bg-teal-500' : 'bg-slate-600'}`}>
                                                    {u.userId ? u.userId.charAt(0).toUpperCase() : <Fingerprint size={16} />}
                                                </div>
                                                <div>
                                                    <p className="text-white font-bold text-sm">{u.userId ? 'Registered User' : `Visitor #${u.vid.slice(-4)}`}</p>
                                                    <p className="text-slate-500 text-xs font-mono">{u.vid.slice(0,12)}...</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            {u.isUser ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    Online
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300">
                                                    Guest
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4 text-center font-bold text-slate-300">
                                            {u.tokens.toLocaleString()}
                                        </td>
                                        <td className="py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <span className="text-xs font-bold text-teal-400">{u.actions * 10}%</span>
                                                <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-teal-400 rounded-full" style={{ width: `${Math.min(100, u.actions * 10)}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 text-right pr-2 font-bold text-white">
                                            {/* Cost calc: tokens / 1M * 2.5 RM */}
                                            RM {((u.tokens / 1000000) * 2.50).toFixed(4)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default AdminDashboard;
