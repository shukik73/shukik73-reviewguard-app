import React from 'react';
import { MessageSquareText, Twitter, Linkedin, Github, Instagram } from 'lucide-react';
import { FOOTER_COLUMNS } from '../constants';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-300 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12 mb-12">
          {/* Brand Column (Spans 2 cols on LG) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-2 text-white">
              <div className="bg-brand-600 p-2 rounded-lg">
                <MessageSquareText size={24} />
              </div>
              <span className="text-xl font-bold tracking-tight">
                Review<span className="text-brand-400">Guard</span>
              </span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              The automated reputation engine for repair shops. Turn paper receipts into 5-star reviews on Autopilot.
            </p>
            <div className="flex gap-4">
                {[Twitter, Linkedin, Github, Instagram].map((Icon, idx) => (
                    <a key={idx} href="#" className="p-2 bg-slate-800 rounded-full hover:bg-brand-600 hover:text-white transition-all">
                        <Icon size={18} />
                    </a>
                ))}
            </div>
          </div>

          {/* Link Columns */}
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title} className="lg:col-span-1">
              <h3 className="text-white font-semibold mb-4">{column.title}</h3>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-brand-400 transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          
          {/* Status/Certification Column */}
          <div className="lg:col-span-1">
              <h3 className="text-white font-semibold mb-4">Secure & Reliable</h3>
              <div className="space-y-4">
                  <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-sm text-slate-400">System Operational</span>
                  </div>
                  <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                      <p className="text-xs font-medium text-slate-300 mb-1">Powered by</p>
                      <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-1 bg-slate-900 rounded text-[10px] border border-slate-700 text-slate-400">OpenAI</span>
                          <span className="px-2 py-1 bg-slate-900 rounded text-[10px] border border-slate-700 text-slate-400">Stripe</span>
                          <span className="px-2 py-1 bg-slate-900 rounded text-[10px] border border-slate-700 text-slate-400">Twilio</span>
                      </div>
                  </div>
              </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">
            © {currentYear} ReviewGuard Inc. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-slate-500 hover:text-slate-300">Privacy Policy</a>
            <a href="#" className="text-sm text-slate-500 hover:text-slate-300">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};