const autoTranslate = {
  dictionary: {
    en: {},
    es: {
      // Dashboard
      "Dashboard": "Panel de Control",
      "Overview of your messaging and reviews.": "Resumen de tus mensajes y reseñas.",
      "Reputation Score": "Puntuación de Reputación",
      "Marketing List": "Lista de Marketing",
      "Sent Today": "Enviados Hoy",
      "vs yesterday": "vs ayer",
      "Sent This Week": "Enviados Esta Semana",
      "+12% vs last week": "+12% vs semana pasada",
      "Recent Activity": "Actividad Reciente",
      "Real-time updates from your shop": "Actualizaciones en tiempo real de tu negocio",
      "View All": "Ver Todo",
      "Quick Send": "Envío Rápido",
      "Instantly reach a customer without leaving the dashboard.": "Contacta a un cliente sin salir del panel.",
      "PHONE NUMBER": "NÚMERO DE TELÉFONO",
      "MESSAGE": "MENSAJE",
      "Select a template...": "Selecciona una plantilla...",
      "Your device is ready for pickup...": "Tu dispositivo está listo para recoger...",
      "Send Notification": "Enviar Notificación",
      "New Message": "Nuevo Mensaje",
      "New Review Request": "Nueva Solicitud de Reseña",
      "SMS Sent": "SMS Enviado",
      "ago": "atrás",
      
      // Send SMS / New Customer Onboarding
      "New Customer Onboarding": "Registro de Nuevo Cliente",
      "Upload a receipt to auto-fill details. Review and correct AI data before saving.": "Sube un recibo para autocompletar. Revisa y corrige los datos de IA antes de guardar.",
      "Upload Receipt": "Subir Recibo",
      "Review Customer": "Revisar Cliente",
      "Send Message": "Enviar Mensaje",
      "Drag & Drop Receipt": "Arrastra y Suelta el Recibo",
      "Supports JPG, HEIC, PNG": "Soporta JPG, HEIC, PNG",
      "Browse Files": "Buscar Archivos",
      "Camera": "Cámara",
      "Import from POS": "Importar del POS",
      "Privacy First": "Privacidad Primero",
      "Receipts are processed securely by OpenAI and are discarded immediately after extraction.": "Los recibos son procesados de forma segura por OpenAI y se eliminan inmediatamente después de la extracción.",
      "DETECTED FROM RECEIPT": "DETECTADO DEL RECIBO",
      "Name:": "Nombre:",
      "Phone:": "Teléfono:",
      "Device:": "Dispositivo:",
      "Repair:": "Reparación:",
      "Customer Profile": "Perfil del Cliente",
      "Editable": "Editable",
      "Review carefully": "Revisar cuidadosamente",
      "CUSTOMER NAME": "NOMBRE DEL CLIENTE",
      "Identify from receipt...": "Identificar del recibo...",
      "PHONE NUMBER": "NÚMERO DE TELÉFONO",
      "DEVICE": "DISPOSITIVO",
      "Device Model": "Modelo del Dispositivo",
      "COST": "COSTO",
      "REPAIR TYPE": "TIPO DE REPARACIÓN",
      "Service description...": "Descripción del servicio...",
      "MESSAGE TYPE": "TIPO DE MENSAJE",
      "Google Review Request": "Solicitud de Reseña Google",
      "MESSAGE PREVIEW": "VISTA PREVIA DEL MENSAJE",
      
      // Campaigns
      "Campaigns": "Campañas",
      "Launch targeted reactivation campaigns for your customers.": "Lanza campañas de reactivación dirigidas para tus clientes.",
      "Bulk Review Sender": "Envío Masivo de Reseñas",
      "Send review requests to multiple customers": "Envía solicitudes de reseña a múltiples clientes",
      "RepairDesk Tickets": "Tickets de RepairDesk",
      "Needs Follow-up": "Necesita Seguimiento",
      "Quick Filters:": "Filtros Rápidos:",
      "High Value Repairs": "Reparaciones de Alto Valor",
      "iPhone Users": "Usuarios de iPhone",
      "Last 30 Days": "Últimos 30 Días",
      "Search device or name...": "Buscar dispositivo o nombre...",
      "Completed Only": "Solo Completados",
      "Repaired & Collected": "Reparado y Recogido",
      "In Progress": "En Progreso",
      "Never Contacted": "Nunca Contactado",
      
      // History
      "Message History": "Historial de Mensajes",
      "Track all sent messages and follow-ups": "Rastrea todos los mensajes enviados y seguimientos",
      "All Messages": "Todos los Mensajes",
      "Clicked Links": "Enlaces Clickeados",
      "With Feedback": "Con Comentarios",
      "Legend:": "Leyenda:",
      "Review": "Reseña",
      "Clicked": "Clickeado",
      "Review Posted": "Reseña Publicada",
      "Sent": "Enviado",
      "Clear Filters": "Limpiar Filtros",
      
      // Customers
      "Customer Database": "Base de Datos de Clientes",
      "Manage your customer contacts": "Administra tus contactos de clientes",
      
      // Reviews
      "Google Reviews": "Reseñas de Google",
      "AI-powered review management": "Gestión de reseñas con IA",
      "Pending Reviews": "Reseñas Pendientes",
      "Posted Replies": "Respuestas Publicadas",
      "Ignored": "Ignoradas",
      "Avg Rating": "Calificación Promedio",
      "Pending": "Pendientes",
      "Posted": "Publicadas",
      "Generate AI Reply": "Generar Respuesta IA",
      "Post Reply": "Publicar Respuesta",
      "Ignore": "Ignorar",
      
      // Feedback
      "Feedback Inbox": "Buzón de Comentarios",
      "Review and respond to customer feedback": "Revisa y responde a los comentarios de clientes",
      "Unread": "No Leídos",
      "Resolved": "Resueltos",
      "All": "Todos",
      "Mark Read": "Marcar Leído",
      "Send Apology": "Enviar Disculpa",
      "Call": "Llamar",
      "Block": "Bloquear",
      
      // Billing
      "Billing & Subscription": "Facturación y Suscripción",
      "Manage your plan and payment methods": "Administra tu plan y métodos de pago",
      "Current Plan": "Plan Actual",
      "Next Billing": "Próxima Facturación",
      "Update Payment Method": "Actualizar Método de Pago",
      "View Invoices": "Ver Facturas",
      "Change Plan": "Cambiar Plan",
      "Cancel Subscription": "Cancelar Suscripción",
      
      // Settings
      "Settings": "Configuración",
      "Configure your ReviewGuard account": "Configura tu cuenta de ReviewGuard",
      "Business Information": "Información del Negocio",
      "Business Name": "Nombre del Negocio",
      "Google Review Link": "Enlace de Reseña Google",
      "SMS Settings": "Configuración de SMS",
      "Sender Name": "Nombre del Remitente",
      "Default Template": "Plantilla Predeterminada",
      "Notifications": "Notificaciones",
      "Email Notifications": "Notificaciones por Email",
      "SMS Notifications": "Notificaciones por SMS",
      "Save Settings": "Guardar Configuración",
      "Save Changes": "Guardar Cambios",
      "Integrations": "Integraciones",
      "Telegram Bot": "Bot de Telegram",
      "Connect": "Conectar",
      "Connected": "Conectado",
      "Disconnect": "Desconectar",
      "Business Type / Industry": "Tipo de Negocio / Industria",
      
      // Common
      "Loading...": "Cargando...",
      "Save": "Guardar",
      "Cancel": "Cancelar",
      "Send": "Enviar",
      "Edit": "Editar",
      "Delete": "Eliminar",
      "Confirm": "Confirmar",
      "Close": "Cerrar",
      "Search": "Buscar",
      "Filter": "Filtrar",
      "Retry": "Reintentar",
      "Yes": "Sí",
      "No": "No",
      "OK": "OK",
      "Error": "Error",
      "Success": "Éxito",
      "Warning": "Advertencia",
      
      // Modals
      "Confirm SMS": "Confirmar SMS",
      "Send to": "Enviar a",
      "Phone number": "Número de teléfono",
      "Message preview": "Vista previa del mensaje",
      "Confirm & Send": "Confirmar y Enviar",
      "Import from RepairDesk": "Importar de RepairDesk",
      "Select a ticket to auto-fill customer details": "Selecciona un ticket para autocompletar datos del cliente",
      "Loading tickets...": "Cargando tickets...",
      "Failed to load tickets": "Error al cargar tickets",
      "No recent tickets found": "No se encontraron tickets recientes",
      "Take Photo": "Tomar Foto",
      "Capture Photo": "Capturar Foto",
      
      // Templates dropdown
      "📦 Device ready for pickup": "📦 Dispositivo listo para recoger",
      "⏳ Repair delayed - will update soon": "⏳ Reparación retrasada - actualizaremos pronto",
      "⭐ Please leave us a review": "⭐ Por favor déjanos una reseña",
      "✏️ Custom message": "✏️ Mensaje personalizado",
      "🌟 Google Review Request": "🌟 Solicitud de Reseña Google",
      
      // Notifications
      "SMS sent successfully!": "¡SMS enviado exitosamente!",
      "Failed to send SMS": "Error al enviar SMS",
      "Reminder sent successfully!": "¡Recordatorio enviado exitosamente!",
      "Settings saved successfully!": "¡Configuración guardada exitosamente!",
      "Reply posted successfully!": "¡Respuesta publicada exitosamente!",
      "Customer data loaded!": "¡Datos del cliente cargados!",
      "Feedback marked as read": "Comentario marcado como leído",
      "An error occurred": "Ocurrió un error",
      
      // HVAC / Field Service specific
      "Unit / System": "Unidad / Sistema",
      "Trane XL, AC Unit, Heater...": "Trane XL, Aire Acondicionado, Calefactor...",
      "AC Unit, Furnace, Heat Pump, etc.": "Aire Acondicionado, Calefacción, Bomba de Calor, etc.",
      "Service Performed": "Servicio Realizado",
      "Service Type": "Tipo de Servicio",
      "Seasonal Tune-up, Coil Cleaning...": "Mantenimiento estacional, Limpieza de bobina...",
      "Service Authorization Verified": "Autorización de Servicio Verificada",
      "Service Address": "Dirección del Servicio",
      "123 Main St, Miami FL": "123 Calle Principal, Miami FL",
      "Helps identify the job for field service": "Ayuda a identificar el trabajo para servicios en campo",
      "Connect ServiceTitan": "Conectar ServiceTitan",
      "✅ Service complete at your location": "✅ Servicio completado en su ubicación",
      "🔧 Parts on order - will reschedule": "🔧 Piezas en pedido - reprogramaremos",
      
      // Auto Repair specific
      "Vehicle": "Vehículo",
      "2020 Honda Civic, Ford F-150, etc.": "2020 Honda Civic, Ford F-150, etc.",
      "Vehicle Service Consent Verified": "Consentimiento de Servicio de Vehículo Verificado",
      "🚗 Your vehicle is ready for pickup": "🚗 Su vehículo está listo para recoger",
      
      // Plumbing specific
      "Issue / System": "Problema / Sistema",
      "Water heater, Drain, Pipe leak, etc.": "Calentador de agua, Drenaje, Fuga de tubería, etc.",
      "🔧 Plumbing service complete": "🔧 Servicio de plomería completado",
      
      // Field service statuses
      "Scheduled": "Programado",
      "Technician En Route": "Técnico en Camino",
      "Completed": "Completado",
      
      // In-shop statuses
      "Received": "Recibido",
      "Ready for Pickup": "Listo para Recoger",
      "Picked Up": "Recogido",
      "Checked In": "Registrado",
      "Diagnosing": "Diagnosticando",
      "Repairing": "Reparando",
      
      // Vertical selector
      "Business Type / Industry": "Tipo de Negocio / Industria",
      "In-Shop (Customer comes to you)": "En Tienda (El cliente viene a ti)",
      "Field Service (You go to customer)": "Servicio en Campo (Tú vas al cliente)",
      "Repair Shop (Electronics, Phone, Computer)": "Taller de Reparación (Electrónica, Teléfono, Computadora)",
      "Auto Repair": "Taller Automotriz",
      "HVAC / Air Conditioning": "HVAC / Aire Acondicionado",
      "Plumbing": "Plomería",
      "Changes templates and terminology to match your industry": "Cambia plantillas y terminología según tu industria",
      
      // Dynamic labels from verticalConfig
      "Technician Notes": "Notas del Técnico",
      "Job Completed": "Trabajo Completado",
      "your location": "su ubicación",
      "Service complete": "Servicio completado",
      "Device ready": "Dispositivo listo",
      
      // Dynamic POS integration strings
      "Connect ServiceTitan (Coming Soon)": "Conectar ServiceTitan (Próximamente)",
      "Connect Shop-Ware (Coming Soon)": "Conectar Shop-Ware (Próximamente)",
      "Connect Vagaro (Coming Soon)": "Conectar Vagaro (Próximamente)",
      "Connect Square (Coming Soon)": "Conectar Square (Próximamente)",
      "(Coming Soon)": "(Próximamente)",
      
      // Time
      "1d ago": "hace 1d",
      "2d ago": "hace 2d",
      "19h ago": "hace 19h",
      "today": "hoy",
      "yesterday": "ayer",
      "this week": "esta semana",
      "+5 this week": "+5 esta semana"
    }
  },

  currentLang: 'en',

  init() {
    this.currentLang = localStorage.getItem('lang') || (navigator.language.startsWith('es') ? 'es' : 'en');
    if (this.currentLang !== 'en') {
      this.translatePage();
    }
    this.observeChanges();
  },

  translatePage() {
    if (this.currentLang === 'en') return;
    
    const dict = this.dictionary[this.currentLang];
    if (!dict) return;

    this.translateElement(document.body, dict);
  },

  translateElement(root, dict) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

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
      if (dict[ph]) {
        el.placeholder = dict[ph];
      }
    });

    root.querySelectorAll('option').forEach(el => {
      const text = el.textContent.trim();
      if (dict[text]) {
        el.textContent = dict[text];
      }
    });

    root.querySelectorAll('[title]').forEach(el => {
      const title = el.title;
      if (dict[title]) {
        el.title = dict[title];
      }
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

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  },

  setLanguage(lang) {
    this.currentLang = lang;
    localStorage.setItem('lang', lang);
    
    if (typeof updatePreview === 'function') {
      setTimeout(() => updatePreview(), 100);
    }
    
    location.reload();
  },

  updateButtonStates() {
    const enBtn = document.getElementById('btn-lang-en');
    const esBtn = document.getElementById('btn-lang-es');
    
    if (enBtn && esBtn) {
      if (this.currentLang === 'en') {
        enBtn.className = 'px-2 py-1 rounded text-xs font-medium bg-accent text-white';
        esBtn.className = 'px-2 py-1 rounded text-xs font-medium bg-slate-700 text-slate-300';
      } else {
        enBtn.className = 'px-2 py-1 rounded text-xs font-medium bg-slate-700 text-slate-300';
        esBtn.className = 'px-2 py-1 rounded text-xs font-medium bg-accent text-white';
      }
    }
  }
};

window.setLanguage = (lang) => autoTranslate.setLanguage(lang);

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    autoTranslate.init();
    autoTranslate.updateButtonStates();
  }, 150);
});
