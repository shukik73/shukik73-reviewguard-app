import React from 'react';
import ReactDOM from 'react-dom/client';
import { ExperienceCheck } from './components/ExperienceCheck';
import './styles/globals.css';

// Get config from URL params or window object
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token') || '';

// Config can be injected by server or passed via URL
const config = {
  businessName: (window as any).__TRUSTLOOP_CONFIG__?.businessName || 'Your Business',
  googleReviewUrl: (window as any).__TRUSTLOOP_CONFIG__?.googleReviewUrl || '#',
  supportEmail: (window as any).__TRUSTLOOP_CONFIG__?.supportEmail,
  supportPhone: (window as any).__TRUSTLOOP_CONFIG__?.supportPhone,
  journeyToken: token,
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ExperienceCheck config={config} />
  </React.StrictMode>
);
