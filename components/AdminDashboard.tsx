
import React, { useEffect, useState } from 'react';
import { getAnalyticsSummary } from '../services/analyticsService';
import { ArrowLeft, Users, DollarSign, Activity, Zap, Eye, ShoppingBag, Clock, Database } from 'lucide-react';

interface AdminDashboardProps {
  onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const summary = await getAnalyticsSummary(7); // Last 7 days
      setData(summary);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Aggregating Data...</p>
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-8 text-white bg-slate-900 min-h-screen">Failed to load analytics.</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6 overflow-x-hidden">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                        <Database size={20} className="text-teal-500" /> Admin Command
                    </h1>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Live Analytics & Cost Tracking</p>
                </div>
            </div>
            <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">System Online</span>
                </div>
            </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 relative overflow-hidden group hover:border-teal-500/30 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Users size={40} />
                </div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Visitors</h3>
                <p className="text-3xl font-black text-white">{data.uniqueVisitors}</p>
                <div className="mt-2 text-[10px] font-medium text-slate-500">7 Day Active</div>
            </div>

            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 relative overflow-hidden group hover:border-teal-500/30 transition-colors">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <DollarSign size={40} />
                </div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Est. Cost</h3>
                <p className="text-3xl font-black text-emerald-400">${data.estimatedCost.toFixed(4)}</p>
                <div className="mt-2 text-[10px] font-medium text-slate-500">Based on Token Usage</div>
            </div>

            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 relative overflow-hidden group hover:border-teal-500/30 transition-colors">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Zap size={40} />
                </div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Tokens</h3>
                <p className="text-3xl font-black text-white">{(data.totalTokens / 1000).toFixed(1)}k</p>
                <div className="mt-2 text-[10px] font-medium text-slate-500">Gemini 2.5 Flash</div>
            </div>

             <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 relative overflow-hidden group hover:border-teal-500/30 transition-colors">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Activity size={40} />
                </div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Engagement</h3>
                <p className="text-3xl font-black text-white">{data.totalEvents}</p>
                <div className="mt-2 text-[10px] font-medium text-slate-500">Interactions Logged</div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Feature Usage Chart (Simple Bar) */}
            <div className="bg-slate-800 rounded-3xl p-6 border border-slate-700/50">
                <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                    <Eye size={16} className="text-teal-500" /> Feature Interaction
                </h3>
                <div className="space-y-4">
                    {data.topFeatures.map(([feature, count]: any, i: number) => (
                        <div key={i}>
                            <div className="flex justify-between text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">
                                <span>{feature.replace(/_/g, ' ')}</span>
                                <span>{count}</span>
                            </div>
                            <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-teal-500 rounded-full transition-all duration-1000" 
                                    style={{ width: `${(count / data.topFeatures[0][1]) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Real-time Logs */}
            <div className="bg-slate-800 rounded-3xl p-6 border border-slate-700/50 lg:col-span-2 flex flex-col">
                <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                    <Activity size={16} className="text-teal-500" /> Live Event Stream
                </h3>
                <div className="flex-1 overflow-y-auto max-h-[300px] space-y-2 pr-2 custom-scrollbar">
                    {data.recentLog.map((log: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-700/50 text-xs">
                             <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${log.type === 'AI_USAGE' ? 'bg-purple-500' : log.type === 'VIEW' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                             <div className="flex-1 min-w-0">
                                 <div className="flex justify-between mb-0.5">
                                     <span className="font-bold text-slate-200 truncate">{log.name}</span>
                                     <span className="text-slate-500 font-mono text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                 </div>
                                 <div className="flex justify-between text-slate-400">
                                     <span className="truncate max-w-[200px]">{log.visitorId.slice(0,8)}...</span>
                                     {log.tokens > 0 && <span className="text-purple-400 font-bold">{log.tokens} Tok</span>}
                                 </div>
                             </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* User Table */}
            <div className="bg-slate-800 rounded-3xl p-6 border border-slate-700/50 lg:col-span-3">
                 <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                    <Users size={16} className="text-teal-500" /> Visitor & User Breakdown
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-400">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="pb-3 pl-2 font-bold uppercase tracking-wider">Visitor ID</th>
                                <th className="pb-3 font-bold uppercase tracking-wider">Status</th>
                                <th className="pb-3 font-bold uppercase tracking-wider">Actions</th>
                                <th className="pb-3 font-bold uppercase tracking-wider">Token Usage</th>
                                <th className="pb-3 font-bold uppercase tracking-wider">Last Active</th>
                                <th className="pb-3 font-bold uppercase tracking-wider">Est. Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {data.userTable.slice(0, 10).map((u: any, i: number) => (
                                <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                                    <td className="py-3 pl-2 font-mono text-slate-300">{u.vid.slice(0, 12)}...</td>
                                    <td className="py-3">
                                        {u.isUser ? (
                                            <span className="bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded border border-teal-500/20 font-bold">Member</span>
                                        ) : (
                                            <span className="bg-slate-700 text-slate-400 px-2 py-0.5 rounded font-bold">Guest</span>
                                        )}
                                    </td>
                                    <td className="py-3 font-bold text-white">{u.actions}</td>
                                    <td className="py-3 font-mono text-purple-300">{u.tokens.toLocaleString()}</td>
                                    <td className="py-3 text-slate-500">{new Date(u.lastSeen).toLocaleString()}</td>
                                    <td className="py-3 text-emerald-400 font-mono">${((u.tokens / 1000000) * 0.50).toFixed(5)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
  );
};

export default AdminDashboard;
