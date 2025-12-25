/**
 * Landing Page Auto-Translator
 * Add this script to your landing page HTML:
 * <script src="/locales/landingTranslate.js" defer></script>
 * 
 * Add language switcher buttons:
 * <button onclick="setLandingLang('en')">EN</button>
 * <button onclick="setLandingLang('es')">ES</button>
 */

const landingTranslate = {
  dictionary: {
    en: {},
    es: {
      // Navigation
      "Features": "Características",
      "How it Works": "Cómo Funciona",
      "Pricing": "Precios",
      "Integration": "Integración",
      "Log in": "Iniciar Sesión",
      "Get More Customers ⚡": "Obtén Más Clientes ⚡",
      "Get Started": "Comenzar",
      
      // Hero Section
      "New: Telegram Bot Integration Live": "Nuevo: Integración con Bot de Telegram Activa",
      "Automate Your Reputation & Revenue from a Single Photo.": "Automatiza Tu Reputación e Ingresos desde una Sola Foto.",
      "Snap a receipt. Our AI extracts the data, builds your SMS list,": "Toma una foto del recibo. Nuestra IA extrae los datos, construye tu lista de SMS,",
      "gets the 5-star review, and protects you from bad days.": "obtiene reseñas de 5 estrellas y te protege de los días malos.",
      "Snap a receipt. Our AI extracts the data, builds your SMS list, gets the 5-star review, and protects you from bad days.": "Toma una foto del recibo. Nuestra IA extrae los datos, construye tu lista de SMS, obtiene reseñas de 5 estrellas y te protege de los días malos.",
      "View Demo": "Ver Demo",
      "Generating $2M+ in Repair Revenue": "Generando $2M+ en Ingresos de Reparación",
      
      // Dashboard Preview Cards
      "OCR Status": "Estado OCR",
      "Receipt Analyzed": "Recibo Analizado",
      "Resolution Flow": "Flujo de Resolución",
      "3-Star Routed to Inbox": "3 Estrellas Enviado al Buzón",
      "Database Builder": "Constructor de Base de Datos",
      "Phone Captured": "Teléfono Capturado",
      "Recent Activity": "Actividad Reciente",
      "Live": "En Vivo",
      "iPhone 13 Screen Repair": "Reparación de Pantalla iPhone 13",
      "2m ago": "hace 2m",
      "15m ago": "hace 15m",
      "AI drafted reply: \"Thanks for choosing us for your screen repair in downtown...\"": "IA redactó respuesta: \"Gracias por elegirnos para tu reparación de pantalla en el centro...\"",
      "New Google Review": "Nueva Reseña de Google",
      
      // 10 Golden Rules Section
      "The 10 Golden Rules Engine": "El Motor de las 10 Reglas de Oro",
      "Our AI doesn't just reply. It optimizes for SEO, protects your": "Nuestra IA no solo responde. Optimiza para SEO, protege tu",
      "reputation, and saves you hours every week.": "reputación y te ahorra horas cada semana.",
      "Our AI doesn't just reply. It optimizes for SEO, protects your reputation, and saves you hours every week.": "Nuestra IA no solo responde. Optimiza para SEO, protege tu reputación y te ahorra horas cada semana.",
      
      // Feature Cards
      "OCR Onboarding": "Registro con OCR",
      "Technicians snap a receipt. AI fills the profile instantly.": "Los técnicos toman foto del recibo. La IA completa el perfil al instante.",
      
      "Feedback Resolution": "Resolución de Comentarios",
      "Instantly detect unhappy customers. Our system prompts dissatisfied clients to message management privately, protecting your public rating.": "Detecta clientes insatisfechos al instante. Nuestro sistema invita a los clientes descontentos a enviar mensajes privados a gerencia, protegiendo tu calificación pública.",
      
      "Smart Routing": "Enrutamiento Inteligente",
      "The 'Review Funnel' guides 5-star experiences to Google Maps while keeping service complaints in your internal inbox for rapid recovery.": "El 'Embudo de Reseñas' guía las experiencias de 5 estrellas a Google Maps mientras mantiene las quejas de servicio en tu buzón interno para una rápida recuperación.",
      
      "Rank Higher": "Posiciónate Más Alto",
      "Consistent, keyword-rich activity boosts your Local Pack": "La actividad consistente y rica en palabras clave mejora tu Local Pack",
      "ranking.": "posicionamiento.",
      "Consistent, keyword-rich activity boosts your Local Pack ranking.": "La actividad consistente y rica en palabras clave mejora tu posicionamiento en el Local Pack.",
      
      // Footer - Brand
      "The automated reputation engine for repair shops. Turn paper": "El motor de reputación automatizado para talleres de reparación. Convierte",
      "receipts into 5-star reviews on Autopilot.": "recibos de papel en reseñas de 5 estrellas en Autopilot.",
      "The automated reputation engine for repair shops. Turn paper receipts into 5-star reviews on Autopilot.": "El motor de reputación automatizado para talleres de reparación. Convierte recibos de papel en reseñas de 5 estrellas en Autopilot.",
      
      // Footer - Product
      "Product": "Producto",
      "Review Routing": "Enrutamiento de Reseñas",
      "AI Auto-Reply": "Respuesta Automática con IA",
      "Telegram Bot": "Bot de Telegram",
      
      // Footer - Company
      "Company": "Empresa",
      "About Us": "Sobre Nosotros",
      "Careers": "Empleos",
      "Blog": "Blog",
      "Contact": "Contacto",
      
      // Footer - Resources
      "Resources": "Recursos",
      "Help Center": "Centro de Ayuda",
      "API Documentation": "Documentación de API",
      "System Status": "Estado del Sistema",
      "Privacy Policy": "Política de Privacidad",
      "Terms of Service": "Términos de Servicio",
      
      // Footer - Bottom
      "Secure & Reliable": "Seguro y Confiable",
      "System Operational": "Sistema Operacional",
      "Powered by": "Impulsado por",
      "© 2025 ReviewGuard Inc. All rights reserved.": "© 2025 ReviewGuard Inc. Todos los derechos reservados.",
      "Cookie Policy": "Política de Cookies",
      
      // Login Modal
      "Welcome Back": "Bienvenido de Nuevo",
      "Sign in to your account": "Inicia sesión en tu cuenta",
      "Email Address": "Correo Electrónico",
      "Password": "Contraseña",
      "Forgot Password?": "¿Olvidaste tu Contraseña?",
      "Sign In": "Iniciar Sesión",
      "New here?": "¿Eres nuevo?",
      "Create an Account": "Crear una Cuenta",
      
      // Additional UI elements
      "Loading...": "Cargando...",
      "Error": "Error",
      "Success": "Éxito",
      "Close": "Cerrar",
      "Submit": "Enviar",
      "Cancel": "Cancelar"
    }
  },

  currentLang: 'en',

  init() {
    this.currentLang = localStorage.getItem('lang') || (navigator.language.startsWith('es') ? 'es' : 'en');
    if (this.currentLang !== 'en') {
      this.translatePage();
    }
    this.updateButtonStates();
    this.observeChanges();
  },

  translatePage() {
    if (this.currentLang === 'en') return;
    const dict = this.dictionary[this.currentLang];
    if (!dict) return;
    this.translateElement(document.body, dict);
  },

  translateElement(root, dict) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    textNodes.forEach(textNode => {
      const text = textNode.textContent.trim();
      if (text && dict[text]) {
        textNode.textContent = textNode.textContent.replace(text, dict[text]);
      }
    });

    root.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
      const ph = el.placeholder;
      if (dict[ph]) el.placeholder = dict[ph];
    });

    root.querySelectorAll('button, a').forEach(el => {
      const text = el.textContent.trim();
      if (dict[text]) el.textContent = dict[text];
    });

    root.querySelectorAll('[title]').forEach(el => {
      if (dict[el.title]) el.title = dict[el.title];
    });

    root.querySelectorAll('[alt]').forEach(el => {
      if (dict[el.alt]) el.alt = dict[el.alt];
    });
  },

  observeChanges() {
    const observer = new MutationObserver((mutations) => {
      if (this.currentLang === 'en') return;
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.translateElement(node, this.dictionary[this.currentLang]);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  },

  setLanguage(lang) {
    this.currentLang = lang;
    localStorage.setItem('lang', lang);
    location.reload();
  },

  updateButtonStates() {
    const enBtn = document.getElementById('btn-lang-en');
    const esBtn = document.getElementById('btn-lang-es');
    if (enBtn && esBtn) {
      if (this.currentLang === 'en') {
        enBtn.classList.add('bg-indigo-600', 'text-white');
        enBtn.classList.remove('bg-gray-200', 'text-gray-700');
        esBtn.classList.remove('bg-indigo-600', 'text-white');
        esBtn.classList.add('bg-gray-200', 'text-gray-700');
      } else {
        esBtn.classList.add('bg-indigo-600', 'text-white');
        esBtn.classList.remove('bg-gray-200', 'text-gray-700');
        enBtn.classList.remove('bg-indigo-600', 'text-white');
        enBtn.classList.add('bg-gray-200', 'text-gray-700');
      }
    }
  }
};

window.setLandingLang = (lang) => landingTranslate.setLanguage(lang);

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => landingTranslate.init(), 100);
});
