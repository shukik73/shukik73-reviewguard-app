import React, { useState, useEffect } from 'react';
import { Menu, X, MessageSquareText, Zap } from 'lucide-react';
import { NAV_LINKS } from '../constants';

interface HeaderProps {
  onLoginClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onLoginClick }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogin = () => {
    setIsMobileMenuOpen(false);
    if (onLoginClick) onLoginClick();
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/90 backdrop-blur-md shadow-sm py-3 border-b border-slate-200'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo Section */}
          <div className="flex items-center gap-2 cursor-pointer group" onClick={handleLogin}>
            <div className="bg-brand-600 p-2 rounded-lg text-white transition-transform group-hover:scale-105">
              <MessageSquareText size={24} />
            </div>
            <span className={`text-xl font-bold tracking-tight ${isScrolled ? 'text-slate-900' : 'text-slate-900'}`}>
              Review<span className="text-brand-600">Guard</span>
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            <button 
              onClick={handleLogin}
              className="text-sm font-semibold text-slate-600 hover:text-brand-600 transition-colors"
            >
              Log in
            </button>
            <button 
              onClick={handleLogin}
              className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-brand-600 transition-all hover:shadow-lg hover:shadow-brand-500/20 flex items-center gap-2"
            >
              Start Free Trial <Zap size={16} className="text-yellow-400" fill="currentColor" />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-md"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-slate-200 shadow-xl animate-in slide-in-from-top-5 duration-200">
          <div className="px-4 py-6 space-y-4 flex flex-col">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-lg font-medium text-slate-700 hover:text-brand-600 py-2 border-b border-slate-50"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-4 flex flex-col gap-3">
              <button 
                onClick={handleLogin}
                className="w-full py-3 text-slate-600 font-semibold border border-slate-200 rounded-lg"
              >
                Log in
              </button>
              <button 
                onClick={handleLogin}
                className="w-full py-3 bg-brand-600 text-white font-semibold rounded-lg shadow-md"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};