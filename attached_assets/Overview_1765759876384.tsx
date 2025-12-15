import React from 'react';
import { 
    Star, 
    TrendingUp, 
    Users, 
    MessageCircle, 
    Bell, 
    Plus, 
    ArrowUpRight,
    MessageSquare,
    AlertCircle,
    Send,
    MoreHorizontal
} from 'lucide-react';

interface OverviewProps {
    onViewChange: (view: string) => void;
}

export const Overview: React.FC<OverviewProps> = ({ onViewChange }) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER / TOP BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 mt-2 font-medium">Good afternoon, TechFix Pro. You have 3 pending items.</p>
        </div>
        
        <div className="flex items-center gap-4">
           {/* Notification Badge */}
           <button className="relative p-3 bg-white rounded-full text-slate-400 hover:text-slate-600 shadow-sm border border-slate-200 transition-all hover:scale-105 group">
              <Bell size={20} className="group-hover:animate-swing" />
              <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-sm"></span>
           </button>

           {/* New Message Button */}
           <button 
                onClick={() => onViewChange('ocr')}
                className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white rounded-full text-sm font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 transition-all active:scale-95"
            >
                <Plus size={18} strokeWidth={2.5} />
                New Message
           </button>
        </div>
      </div>

      {/* METRICS ROW (4 STAT CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { 
              label: 'Total SMS Sent', 
              value: '1,248', 
              change: '+12.5%', 
              trend: 'up',
              icon: MessageSquare, 
              color: 'text-[#8b5cf6]', 
              bg: 'bg-[#f3e8ff]', // Lavender
              accent: 'border-[#d8b4fe]'
          },
          { 
              label: 'Average Rating', 
              value: '4.9', 
              change: '+2.4%', 
              trend: 'up',
              icon: Star, 
              color: 'text-[#f59e0b]', 
              bg: 'bg-[#fef3c7]', // Amber
              accent: 'border-[#fcd34d]'
          },
          { 
              label: 'Active Customers', 
              value: '842', 
              change: '+5.2%', 
              trend: 'up',
              icon: Users, 
              color: 'text-[#10b981]', 
              bg: 'bg-[#d1fae5]', // Emerald
              accent: 'border-[#6ee7b7]'
          },
          { 
              label: 'Pending Actions', 
              value: '3', 
              change: 'Requires Attention', 
              trend: 'neutral',
              icon: AlertCircle, 
              color: 'text-[#f43f5e]', 
              bg: 'bg-[#ffe4e6]', // Rose
              accent: 'border-[#fda4af]'
          },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 group border border-slate-100/50">
            <div className="flex justify-between items-start mb-5">
              <div className={`p-3.5 rounded-2xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110 duration-300`}>
                <stat.icon size={24} strokeWidth={2.5} />
              </div>
              <button className="text-slate-300 hover:text-slate-500">
                  <MoreHorizontal size={20} />
              </button>
            </div>
            
            <div className="flex flex-col gap-1">
                <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight">{stat.value}</h3>
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">{stat.label}</span>
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-full flex items-center gap-1 ${
                        stat.trend === 'up' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                        {stat.trend === 'up' && <ArrowUpRight size={10} strokeWidth={3} />}
                        {stat.change}
                    </span>
                </div>
            </div>
          </div>
        ))}
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* RECENT ACTIVITY CARD (Left - 2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50 p-8 flex flex-col h-full">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Recent Activity</h3>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Real-time updates from your shop</p>
                </div>
                <button className="text-sm font-bold text-[#6366f1] hover:text-[#4f46e5] px-4 py-2 hover:bg-indigo-50 rounded-lg transition-colors">
                    View All
                </button>
            </div>

            <div className="space-y-6 flex-1">
                {[
                    { 
                        title: 'New 5-Star Review', 
                        desc: 'Sarah Jenkins posted on Google Maps', 
                        time: '2m ago',
                        icon: Star,
                        iconColor: 'text-amber-500',
                        iconBg: 'bg-amber-100'
                    },
                    { 
                        title: 'SMS Campaign Sent', 
                        desc: 'Successfully sent to 142 customers', 
                        time: '1h ago',
                        icon: MessageCircle,
                        iconColor: 'text-violet-600',
                        iconBg: 'bg-violet-100'
                    },
                    { 
                        title: 'Follow-up Required', 
                        desc: 'Negative feedback intercepted from Mike R.', 
                        time: '3h ago',
                        icon: AlertCircle,
                        iconColor: 'text-rose-500',
                        iconBg: 'bg-rose-100'
                    },
                    { 
                        title: 'New Customer Added', 
                        desc: 'iPhone 13 Screen Repair - $180', 
                        time: '5h ago',
                        icon: Users,
                        iconColor: 'text-emerald-500',
                        iconBg: 'bg-emerald-100'
                    }
                ].map((item, i) => (
                    <div key={i} className="flex items-start gap-5 group cursor-pointer hover:bg-slate-50/80 p-3 -mx-3 rounded-2xl transition-colors">
                        <div className={`p-3.5 rounded-2xl ${item.iconBg} ${item.iconColor} shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                            <item.icon size={20} fill={item.icon === Star ? "currentColor" : "none"} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 py-1">
                            <div className="flex justify-between items-start mb-1">
                                <h4 className="font-bold text-slate-900 text-[15px]">{item.title}</h4>
                                <span className="text-xs font-semibold text-slate-400">{item.time}</span>
                            </div>
                            <p className="text-slate-500 text-sm font-medium leading-snug">{item.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* QUICK SEND PANEL (Right - 1 Col) */}
        <div className="bg-gradient-to-br from-[#6366f1] to-[#a855f7] rounded-[24px] p-8 text-white shadow-xl shadow-indigo-500/20 flex flex-col relative overflow-hidden h-full">
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none mix-blend-overlay"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-900 opacity-20 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

            <div className="relative z-10 flex flex-col h-full">
                <div className="mb-8">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md shadow-inner border border-white/10">
                        <Send size={24} className="text-white" />
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight">Quick Send</h3>
                    <p className="text-indigo-100 text-sm mt-2 opacity-90 font-medium leading-relaxed">Instantly reach a customer without leaving the dashboard.</p>
                </div>

                <div className="space-y-5 flex-1">
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-indigo-100 opacity-90 pl-1">Phone Number</label>
                        <input 
                            type="text" 
                            placeholder="+1 (555) 000-0000"
                            className="w-full bg-white text-slate-900 placeholder:text-slate-400 px-5 py-3.5 rounded-xl border-none outline-none focus:ring-4 focus:ring-white/20 shadow-lg font-medium transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-indigo-100 opacity-90 pl-1">Message</label>
                        <textarea 
                            rows={4}
                            placeholder="Your device is ready for pickup..."
                            className="w-full bg-white text-slate-900 placeholder:text-slate-400 px-5 py-3.5 rounded-xl border-none outline-none focus:ring-4 focus:ring-white/20 shadow-lg resize-none font-medium transition-all"
                        ></textarea>
                    </div>
                </div>

                <button className="w-full mt-3 bg-[#0B0F2D] hover:bg-[#151a45] text-white text-xs font-bold py-2 rounded-full shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 group border border-white/10">
                    <span>Send Notification</span>
                    <ArrowUpRight size={14} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};