import React from 'react';
import { ScanLine, Star, ShieldCheck, MessageCircle, ArrowRight } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden relative">
      {/* Background Decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[20%] w-[40rem] h-[40rem] bg-brand-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-[10%] right-[20%] w-[35rem] h-[35rem] bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          
          {/* Left Content */}
          <div className="flex-1 text-center lg:text-left space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-sm font-medium mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
              </span>
              New: Telegram Bot Integration Live
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
              Turn Paper Receipts into <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-purple-600">
                5-Star Google Reviews
              </span>
            </h1>
            
            <p className="text-lg text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Snap a photo of the receipt. Our AI extracts customer data, sends an SMS, and routes happy customers to Google while intercepting negative feedback.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <button className="w-full sm:w-auto px-8 py-4 bg-brand-600 text-white rounded-xl font-semibold shadow-lg shadow-brand-500/30 hover:bg-brand-700 transition-all flex items-center justify-center gap-2">
                Start Free Trial <ArrowRight size={18} />
              </button>
              <button className="w-full sm:w-auto px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition-all">
                View Demo
              </button>
            </div>
            
            <div className="pt-6 flex items-center gap-4 justify-center lg:justify-start text-sm text-slate-500">
                <div className="flex -space-x-2">
                    {[1,2,3,4].map(i => (
                        <div key={i} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-xs overflow-hidden">
                             <img src={`https://picsum.photos/50/50?random=${i}`} alt="User" />
                        </div>
                    ))}
                </div>
                <p>Trusted by 500+ Repair Shops</p>
            </div>
          </div>

          {/* Right Visual (Product Mockup) */}
          <div className="flex-1 relative w-full max-w-lg lg:max-w-none">
            {/* Floating Badge 1: OCR */}
            <div className="absolute -left-8 top-10 bg-white p-4 rounded-xl shadow-xl border border-slate-100 z-20 hidden md:block animate-bounce-slow">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                        <ScanLine size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium">OCR Status</p>
                        <p className="text-sm font-bold text-slate-800">Receipt Analyzed</p>
                    </div>
                </div>
            </div>

            {/* Floating Badge 2: Smart Routing */}
            <div className="absolute -right-4 bottom-20 bg-white p-4 rounded-xl shadow-xl border border-slate-100 z-20 hidden md:block animate-bounce-slow animation-delay-1000">
                <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-lg text-green-600">
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium">Feedback Shield</p>
                        <p className="text-sm font-bold text-slate-800">3-Star Intercepted</p>
                    </div>
                </div>
            </div>

            {/* Main Card */}
            <div className="relative bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden aspect-[4/3] flex flex-col">
                {/* Fake Browser Header */}
                <div className="bg-slate-800 px-4 py-3 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <div className="ml-4 bg-slate-900/50 px-3 py-1 rounded-md text-xs text-slate-400 font-mono flex-1">
                        dashboard.reviewguard.com/feed
                    </div>
                </div>
                
                {/* Dashboard Mock UI */}
                <div className="p-6 flex-1">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-white font-semibold">Recent Activity</h3>
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Live</span>
                    </div>
                    
                    <div className="space-y-4">
                        {/* Item 1 */}
                        <div className="bg-slate-800/50 p-3 rounded-lg flex items-start gap-3 border border-slate-700">
                            <div className="bg-blue-500/20 p-2 rounded text-blue-400 mt-1">
                                <MessageCircle size={16} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between">
                                    <p className="text-sm text-white font-medium">iPhone 13 Screen Repair</p>
                                    <span className="text-xs text-slate-500">2m ago</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">AI drafted reply: "Thanks for choosing us for your screen repair in downtown..."</p>
                            </div>
                        </div>

                         {/* Item 2 */}
                         <div className="bg-slate-800/50 p-3 rounded-lg flex items-start gap-3 border border-slate-700">
                            <div className="bg-yellow-500/20 p-2 rounded text-yellow-400 mt-1">
                                <Star size={16} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between">
                                    <p className="text-sm text-white font-medium">New Google Review</p>
                                    <span className="text-xs text-slate-500">15m ago</span>
                                </div>
                                <div className="flex gap-0.5 mt-1">
                                    {[1,2,3,4,5].map(s => <Star key={s} size={12} className="text-yellow-400 fill-yellow-400"/>)}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Bot Prompt */}
                    <div className="mt-6 pt-4 border-t border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400"></div>
                            <div className="space-y-1">
                                <div className="h-2 w-24 bg-slate-700 rounded"></div>
                                <div className="h-2 w-16 bg-slate-700 rounded"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};