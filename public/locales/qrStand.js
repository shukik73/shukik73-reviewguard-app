/**
 * QR Counter Stand Generator for ReviewGuard
 * Generates printable QR code stands for physical locations
 * 
 * Dependencies: qrcode.min.js (loaded via CDN)
 * Compatible with: autoTranslate.js, verticalConfig.js
 */

class QRGenerator {
  constructor() {
    this.reviewLink = localStorage.getItem('googleReviewLink') || localStorage.getItem('userReviewLink') || '';
    this.businessName = localStorage.getItem('businessName') || 'Our Business';
    this.vertical = localStorage.getItem('vertical') || 'repair';
    this.lang = localStorage.getItem('lang') || 'en';
  }

  getVerticalTitle() {
    const titles = {
      repair: {
        en: 'Love your repair?',
        es: '¿Te encantó tu reparación?'
      },
      hvac: {
        en: 'Love your service?',
        es: '¿Te encantó el servicio?'
      },
      plumbing: {
        en: 'Love your service?',
        es: '¿Te encantó el servicio?'
      },
      auto: {
        en: 'Love your car service?',
        es: '¿Te encantó el servicio de tu auto?'
      }
    };

    if (typeof verticalConfig !== 'undefined' && verticalConfig.current?.qrTitle) {
      return verticalConfig.current.qrTitle[this.lang] || verticalConfig.current.qrTitle.en;
    }

    return titles[this.vertical]?.[this.lang] || titles.repair.en;
  }

  getTranslation(key) {
    const translations = {
      scanToReview: {
        en: 'Scan to Review',
        es: 'Escanea para Reseñar'
      },
      thankYou: {
        en: 'Review us on Google – It takes 15 seconds!',
        es: '¡Reseñanos en Google – Solo toma 15 segundos!'
      },
      takes10Seconds: {
        en: 'It only takes 15 seconds',
        es: 'Solo toma 15 segundos'
      },
      helpUsGrow: {
        en: 'Your feedback helps us grow',
        es: 'Tu opinión nos ayuda a crecer'
      },
      loveOurService: {
        en: 'Love our service?',
        es: '¿Te encantó nuestro servicio?'
      },
      orVisit: {
        en: 'Or visit:',
        es: 'O visita:'
      },
      printStand: {
        en: 'Print Counter Stand',
        es: 'Imprimir Tarjeta de Mostrador'
      },
      downloadQR: {
        en: 'Download QR Code',
        es: 'Descargar Código QR'
      },
      previewStand: {
        en: 'Preview Stand',
        es: 'Vista Previa'
      }
    };

    return translations[key]?.[this.lang] || translations[key]?.en || key;
  }

  async generateQRCode(container, size = 200) {
    if (!this.reviewLink) {
      console.warn('QRGenerator: No review link configured');
      return false;
    }

    if (typeof QRCode === 'undefined') {
      console.error('QRGenerator: QRCode library not loaded');
      return false;
    }

    try {
      container.innerHTML = '';
      new QRCode(container, {
        text: this.reviewLink,
        width: size,
        height: size,
        colorDark: '#1e293b',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
      return true;
    } catch (error) {
      console.error('QRGenerator: Failed to generate QR code', error);
      return false;
    }
  }

  generateStandHTML() {
    const title = this.getVerticalTitle();
    const shortLink = this.reviewLink.replace('https://', '').replace('http://', '').substring(0, 35) + '...';

    return `
      <div id="qr-stand-print-area" class="qr-stand-container">
        <style>
          @media print {
            body * { visibility: hidden; }
            #qr-stand-print-area, #qr-stand-print-area * { visibility: visible; }
            #qr-stand-print-area { 
              position: absolute; 
              left: 50%; 
              top: 0;
              transform: translateX(-50%);
              width: 4in;
              padding: 0;
              margin: 0;
            }
            @page { 
              size: 4in 6in; 
              margin: 0.25in;
            }
          }
          
          .qr-stand-container {
            width: 4in;
            min-height: 5.5in;
            margin: 0 auto;
            padding: 0.4in;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            position: relative;
            overflow: hidden;
          }
          
          .qr-stand-container::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -50%;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            pointer-events: none;
          }
          
          .qr-stand-inner {
            background: white;
            border-radius: 12px;
            padding: 24px;
            text-align: center;
            position: relative;
            z-index: 1;
          }
          
          .qr-stand-logo {
            width: 48px;
            height: 48px;
            margin: 0 auto 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .qr-stand-logo svg {
            width: 28px;
            height: 28px;
            color: white;
          }
          
          .qr-stand-business {
            font-size: 14px;
            font-weight: 600;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }
          
          .qr-stand-title {
            font-size: 26px;
            font-weight: 800;
            color: #1e293b;
            margin-bottom: 4px;
            line-height: 1.2;
          }
          
          .qr-stand-subtitle {
            font-size: 15px;
            color: #64748b;
            margin-bottom: 20px;
          }
          
          .qr-stand-qr-wrapper {
            background: #f8fafc;
            border: 3px dashed #e2e8f0;
            border-radius: 16px;
            padding: 20px;
            margin: 0 auto 16px;
            display: inline-block;
          }
          
          .qr-stand-qr {
            width: 180px;
            height: 180px;
            margin: 0 auto;
          }
          
          .qr-stand-qr img {
            width: 100% !important;
            height: 100% !important;
          }
          
          .qr-stand-scan-text {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 10px 20px;
            border-radius: 50px;
            font-weight: 700;
            font-size: 14px;
            margin-bottom: 12px;
          }
          
          .qr-stand-time {
            font-size: 13px;
            color: #94a3b8;
            margin-bottom: 16px;
          }
          
          .qr-stand-time span {
            background: #f1f5f9;
            padding: 4px 10px;
            border-radius: 20px;
          }
          
          .qr-stand-divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, #e2e8f0, transparent);
            margin: 16px 0;
          }
          
          .qr-stand-footer {
            font-size: 12px;
            color: #94a3b8;
          }
          
          .qr-stand-url {
            font-size: 10px;
            color: #cbd5e1;
            word-break: break-all;
            margin-top: 8px;
          }
          
          .qr-stand-stars {
            color: #fbbf24;
            font-size: 24px;
            letter-spacing: 4px;
            margin: 8px 0;
          }
          
          .qr-stand-google {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-top: 12px;
            padding: 6px 12px;
            background: #f8fafc;
            border-radius: 8px;
            font-size: 12px;
            color: #64748b;
          }
          
          .qr-stand-google img {
            width: 16px;
            height: 16px;
          }
        </style>
        
        <div class="qr-stand-inner">
          <div class="qr-stand-logo" style="width: 60px; height: 60px; margin: 0 auto 12px;">
            <img src="/images/logo.png" alt="ReviewGuard" style="width: 100%; height: auto;" />
          </div>
          
          <div class="qr-stand-business">${this.businessName}</div>
          
          <div class="qr-stand-title">${title}</div>
          <div class="qr-stand-subtitle">${this.getTranslation('helpUsGrow')}</div>
          
          <div class="qr-stand-stars">★★★★★</div>
          
          <div class="qr-stand-qr-wrapper">
            <div id="qr-stand-qr-code" class="qr-stand-qr"></div>
          </div>
          
          <div class="qr-stand-scan-text">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            ${this.getTranslation('scanToReview')}
          </div>
          
          <div class="qr-stand-time">
            <span>⏱ ${this.getTranslation('takes10Seconds')}</span>
          </div>
          
          <div class="qr-stand-divider"></div>
          
          <div class="qr-stand-footer">
            ${this.getTranslation('thankYou')}
          </div>
          
          <div class="qr-stand-google">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google Reviews
          </div>
        </div>
      </div>
    `;
  }

  async renderStand(containerId = 'qr-stand-container') {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('QRGenerator: Container not found:', containerId);
      return false;
    }

    container.innerHTML = this.generateStandHTML();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const qrContainer = document.getElementById('qr-stand-qr-code');
    if (qrContainer) {
      await this.generateQRCode(qrContainer, 180);
    }

    return true;
  }

  async previewStand() {
    const modal = document.getElementById('qr-stand-modal');
    if (modal) {
      await this.renderStand('qr-stand-preview');
      modal.classList.remove('hidden');
    }
  }

  closePreview() {
    const modal = document.getElementById('qr-stand-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  async printStand() {
    const printContainer = document.getElementById('qr-stand-print-container');
    if (!printContainer) {
      console.error('QRGenerator: Print container not found');
      return;
    }

    await this.renderStand('qr-stand-print-container');
    
    await new Promise(resolve => setTimeout(resolve, 300));

    window.print();
    if (typeof posthog !== 'undefined') posthog.capture('qr_printed');
  }

  async downloadQRImage() {
    if (!this.reviewLink) {
      alert(this.lang === 'es' ? 'Configure su enlace de Google Review primero' : 'Please configure your Google Review link first');
      return;
    }

    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    document.body.appendChild(tempContainer);

    await this.generateQRCode(tempContainer, 400);

    await new Promise(resolve => setTimeout(resolve, 200));

    const canvas = tempContainer.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `${this.businessName.replace(/\s+/g, '-')}-review-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }

    document.body.removeChild(tempContainer);
  }
}

const qrGenerator = new QRGenerator();

function openQRStandModal() {
  qrGenerator.previewStand();
}

function closeQRStandModal() {
  qrGenerator.closePreview();
}

function printQRStand() {
  qrGenerator.printStand();
}

function downloadQRCode() {
  qrGenerator.downloadQRImage();
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    qrGenerator.reviewLink = localStorage.getItem('googleReviewLink') || localStorage.getItem('userReviewLink') || '';
    qrGenerator.businessName = localStorage.getItem('businessName') || 'Our Business';
    qrGenerator.vertical = localStorage.getItem('vertical') || 'repair';
    qrGenerator.lang = localStorage.getItem('lang') || 'en';
  }, 250);
});
