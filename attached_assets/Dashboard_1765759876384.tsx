import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ScanLine, 
  MessageSquare, 
  Settings, 
  LogOut, 
  MessageSquareText,
  Menu,
  X,
  Users,
  Bell,
  Search
} from 'lucide-react';
import { Overview } from './Overview';
import { OCRTool } from './OCRTool';
import { ReviewInbox } from './ReviewInbox';

interface DashboardProps {
  onLogout: () => void;
}

type View = 'overview' | 'ocr' | 'reviews' | 'customers' | 'settings';

export const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [currentView, setCurrentView] = useState<View>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const NAV_ITEMS = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'ocr', label: 'Send SMS', icon: ScanLine },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'reviews', label: 'Reviews', icon: MessageSquare },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const renderContent = () => {
    switch (currentView) {
      case 'overview': return <Overview onViewChange={(view) => setCurrentView(view as View)} />;
      case 'ocr': return <OCRTool />;
      case 'reviews': return <ReviewInbox />;
      default: return <div className="p-8 text-slate-500">Module pending integration...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] flex font-sans text-slate-900">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Premium Dark Gradient Theme */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-[#0B0F2D] via-[#0B0F2D] to-[#151a45] text-white transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl border-r border-white/5
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo Area */}
        <div className="h-24 flex items-center px-8 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-[#6366f1] to-[#a855f7] p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/30">
              <MessageSquareText size={22} strokeWidth={2.5} />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">
              Review<span className="text-[#a855f7]">Guard</span>
            </span>
          </div>
          <button 
            className="ml-auto lg:hidden text-slate-400 hover:text-white transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={24} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-2 py-8">
          <div className="px-4 mb-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
            Main Menu
          </div>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentView(item.id as View);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden ${
                currentView === item.id
                  ? 'bg-[#6366f1] text-white shadow-lg shadow-indigo-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {/* Active Indicator Glow */}
              {currentView === item.id && (
                  <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none"></div>
              )}
              
              <item.icon 
                size={20} 
                className={`transition-colors relative z-10 ${currentView === item.id ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} 
              />
              <span className="relative z-10">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User Profile - Dark Mode Style */}
        <div className="p-5 border-t border-white/5 bg-[#080b24]/50">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 p-[2px]">
                    <div className="w-full h-full rounded-full border-2 border-[#0B0F2D] overflow-hidden">
                        <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" alt="User" className="w-full h-full object-cover"/>
                    </div>
                </div>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#0B0F2D]"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">TechFix Pro</p>
              <p className="text-[11px] text-slate-400 truncate">admin@techfix.com</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors border border-white/5 hover:border-white/10"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Header Trigger */}
        <header className="lg:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-30 shadow-sm">
          <div className="flex items-center gap-3">
             <button 
                className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu size={24} />
              </button>
              <span className="font-semibold text-slate-900">Dashboard</span>
          </div>
          <button className="relative p-2 text-slate-400">
             <Bell size={24} />
             <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto bg-[#F8F9FC] p-4 lg:p-10 scroll-smooth">
          <div className="max-w-7xl mx-auto">
             {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};