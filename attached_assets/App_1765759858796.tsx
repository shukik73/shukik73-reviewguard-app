import React, { useState } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Dashboard } from './components/dashboard/Dashboard';
import { Smartphone, ShieldAlert, Bot, TrendingUp } from 'lucide-react';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  if (isLoggedIn) {
    return <Dashboard onLogout={() => setIsLoggedIn(false)} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header onLoginClick={() => setIsLoggedIn(true)} />
      
      <main className="flex-grow">
        <Hero />
        
        {/* Feature Grid Filler */}
        <section id="how-it-works" className="py-20 bg-white border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
                <h2 className="text-3xl font-bold text-slate-900 mb-4">The 10 Golden Rules Engine</h2>
                <p className="text-slate-600">Our AI doesn't just reply. It optimizes for SEO, protects your reputation, and saves you hours every week.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                    { 
                        icon: Smartphone, 
                        title: "OCR Onboarding", 
                        desc: "Technicians snap a receipt. AI fills the profile instantly." 
                    },
                    { 
                        icon: ShieldAlert, 
                        title: "Smart Shield", 
                        desc: "4-5 Stars go to Google. 1-3 Stars get intercepted internally." 
                    },
                    { 
                        icon: Bot, 
                        title: "AI SEO Brain", 
                        desc: "Replies naturally include 'iPhone Repair' and location keywords." 
                    },
                    { 
                        icon: TrendingUp, 
                        title: "Rank Higher", 
                        desc: "Consistent, keyword-rich activity boosts your Local Pack ranking." 
                    }
                ].map((feature, idx) => (
                    <div key={idx} className="p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-lg hover:border-brand-100 transition-all group">
                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-brand-600 mb-4 group-hover:scale-110 transition-transform border border-slate-100">
                            <feature.icon size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                        <p className="text-slate-600 text-sm leading-relaxed">{feature.desc}</p>
                    </div>
                ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default App;