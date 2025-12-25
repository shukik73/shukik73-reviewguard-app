const verticalConfig = {
  current: null,
  
  verticals: {
    repair: {
      id: 'repair',
      name: 'Repair Shop',
      itemLabel: 'Device',
      itemPlaceholder: 'iPhone 13, Samsung TV, etc.',
      serviceLabel: 'Repair',
      completionTemplate: '📦 Device ready for pickup',
      completionTemplateEs: '📦 Dispositivo listo para recoger',
      delayedTemplate: '⏳ Repair delayed - will update soon',
      delayedTemplateEs: '⏳ Reparación retrasada - actualizaremos pronto',
      consentText: 'Standard Repair Consent Verified',
      consentTextEs: 'Consentimiento de Reparación Estándar Verificado',
      statusFlow: ['Received', 'In Progress', 'Ready for Pickup', 'Picked Up'],
      statusFlowEs: ['Recibido', 'En Progreso', 'Listo para Recoger', 'Recogido'],
      posName: 'RepairDesk',
      posIcon: '🔧',
      showAddress: false,
      showRepairDesk: true
    },
    hvac: {
      id: 'hvac',
      name: 'HVAC / Field Service',
      itemLabel: 'Unit / System',
      itemPlaceholder: 'AC Unit, Furnace, Heat Pump, etc.',
      serviceLabel: 'Service Type',
      completionTemplate: '✅ Service complete at your location',
      completionTemplateEs: '✅ Servicio completado en su ubicación',
      delayedTemplate: '🔧 Parts on order - will reschedule',
      delayedTemplateEs: '🔧 Piezas en pedido - reprogramaremos',
      consentText: 'Service Authorization Verified',
      consentTextEs: 'Autorización de Servicio Verificada',
      statusFlow: ['Scheduled', 'Technician En Route', 'In Progress', 'Completed'],
      statusFlowEs: ['Programado', 'Técnico en Camino', 'En Progreso', 'Completado'],
      posName: 'ServiceTitan',
      posIcon: '❄️',
      showAddress: true,
      showRepairDesk: false
    },
    plumbing: {
      id: 'plumbing',
      name: 'Plumbing',
      itemLabel: 'Issue / System',
      itemPlaceholder: 'Water heater, Drain, Pipe leak, etc.',
      serviceLabel: 'Service Type',
      completionTemplate: '🔧 Plumbing service complete',
      completionTemplateEs: '🔧 Servicio de plomería completado',
      delayedTemplate: '🔧 Parts on order - will reschedule',
      delayedTemplateEs: '🔧 Piezas en pedido - reprogramaremos',
      consentText: 'Service Authorization Verified',
      consentTextEs: 'Autorización de Servicio Verificada',
      statusFlow: ['Scheduled', 'Technician En Route', 'In Progress', 'Completed'],
      statusFlowEs: ['Programado', 'Técnico en Camino', 'En Progreso', 'Completado'],
      posName: 'ServiceTitan',
      posIcon: '🔧',
      showAddress: true,
      showRepairDesk: false
    },
    auto: {
      id: 'auto',
      name: 'Auto Repair',
      itemLabel: 'Vehicle',
      itemPlaceholder: '2020 Honda Civic, Ford F-150, etc.',
      serviceLabel: 'Repair',
      completionTemplate: '🚗 Your vehicle is ready for pickup',
      completionTemplateEs: '🚗 Su vehículo está listo para recoger',
      delayedTemplate: '⏳ Repair taking longer than expected',
      delayedTemplateEs: '⏳ La reparación está tardando más de lo esperado',
      consentText: 'Vehicle Service Consent Verified',
      consentTextEs: 'Consentimiento de Servicio Verificado',
      statusFlow: ['Checked In', 'Diagnosing', 'Repairing', 'Ready for Pickup'],
      statusFlowEs: ['Registrado', 'Diagnosticando', 'Reparando', 'Listo para Recoger'],
      posName: 'Shop-Ware',
      posIcon: '🚗',
      showAddress: false,
      showRepairDesk: true
    },
    beauty: {
      id: 'beauty',
      name: 'Nail Salon / Spa',
      itemLabel: 'Service',
      itemPlaceholder: 'Manicure, Pedicure, Facial, etc.',
      serviceLabel: 'Treatment',
      completionTemplate: '💅 Thanks for visiting us today!',
      completionTemplateEs: '💅 ¡Gracias por visitarnos hoy!',
      delayedTemplate: '⏳ Running a bit behind - thank you for your patience',
      delayedTemplateEs: '⏳ Estamos un poco retrasados - gracias por su paciencia',
      consentText: 'Service Consent Verified',
      consentTextEs: 'Consentimiento de Servicio Verificado',
      statusFlow: ['Appointment Set', 'In Service', 'Completed'],
      statusFlowEs: ['Cita Programada', 'En Servicio', 'Completado'],
      posName: 'Vagaro',
      posIcon: '💅',
      showAddress: false,
      showRepairDesk: false
    },
    barber: {
      id: 'barber',
      name: 'Barber Shop',
      itemLabel: 'Service',
      itemPlaceholder: 'Haircut, Beard Trim, etc.',
      serviceLabel: 'Cut',
      completionTemplate: '💈 Thanks for the visit! Looking sharp!',
      completionTemplateEs: '💈 ¡Gracias por la visita! ¡Te ves genial!',
      delayedTemplate: '⏳ Running a bit behind - thank you for waiting',
      delayedTemplateEs: '⏳ Estamos un poco retrasados - gracias por esperar',
      consentText: 'Service Consent Verified',
      consentTextEs: 'Consentimiento de Servicio Verificado',
      statusFlow: ['Waiting', 'In Chair', 'Completed'],
      statusFlowEs: ['Esperando', 'En la Silla', 'Completado'],
      posName: 'Square',
      posIcon: '💈',
      showAddress: false,
      showRepairDesk: false
    }
  },

  init() {
    this.current = this.loadVertical();
    this.applyVertical();
    this.bindVerticalSelector();
  },

  loadVertical() {
    const saved = localStorage.getItem('vertical');
    return this.verticals[saved] || this.verticals.repair;
  },

  setVertical(verticalId) {
    if (!this.verticals[verticalId]) return;
    this.current = this.verticals[verticalId];
    localStorage.setItem('vertical', verticalId);
    this.applyVertical();
  },

  applyVertical() {
    const v = this.current;
    const lang = i18n?.locale || 'en';
    const isEs = lang === 'es';

    document.querySelectorAll('[data-vertical="itemLabel"]').forEach(el => {
      el.textContent = v.itemLabel;
    });

    document.querySelectorAll('[data-vertical="itemPlaceholder"]').forEach(el => {
      el.placeholder = v.itemPlaceholder;
    });

    document.querySelectorAll('[data-vertical="serviceLabel"]').forEach(el => {
      el.textContent = v.serviceLabel;
    });

    const pickupOption = document.querySelector('option[value="pickup"]');
    if (pickupOption) {
      pickupOption.textContent = isEs ? v.completionTemplateEs : v.completionTemplate;
    }

    const delayedOption = document.querySelector('option[value="delayed"]');
    if (delayedOption) {
      delayedOption.textContent = isEs ? v.delayedTemplateEs : v.delayedTemplate;
    }

    const consentLabel = document.querySelector('#sms-consent-checkbox')?.closest('label')?.querySelector('span');
    if (consentLabel) {
      const text = isEs ? v.consentTextEs : v.consentText;
      consentLabel.childNodes[0].textContent = text + ' ';
    }

    const addressField = document.getElementById('customer-address-wrapper');
    if (addressField) {
      addressField.classList.toggle('hidden', !v.showAddress);
    } else if (v.showAddress) {
      this.injectAddressField();
    }

    const posBtn = document.getElementById('repairdesk-import-btn');
    const fakeDoorBtn = document.getElementById('servicetitan-btn');
    
    if (v.showRepairDesk) {
      if (posBtn) posBtn.classList.remove('hidden');
      if (fakeDoorBtn) fakeDoorBtn.remove();
    } else {
      if (posBtn) posBtn.classList.add('hidden');
      if (!fakeDoorBtn && posBtn) {
        this.injectFakeDoorButton(posBtn.parentNode, v);
      }
    }

    const posModalTitle = document.querySelector('#repairdesk-modal h3');
    if (posModalTitle) {
      posModalTitle.textContent = v.showRepairDesk 
        ? 'Import from RepairDesk' 
        : `Connect ${v.posName} (Coming Soon)`;
    }

    document.querySelectorAll('[data-vertical-selector]').forEach(sel => {
      sel.value = v.id;
    });

    document.body.dataset.vertical = v.id;
  },

  injectAddressField() {
    const phoneField = document.getElementById('customer-phone')?.closest('.mb-4');
    if (!phoneField) return;

    const lang = i18n?.locale || 'en';
    const isEs = lang === 'es';

    const wrapper = document.createElement('div');
    wrapper.id = 'customer-address-wrapper';
    wrapper.className = 'mb-4';
    wrapper.innerHTML = `
      <label for="customer-address" class="block text-sm font-medium text-gray-700 mb-1">
        ${isEs ? 'Dirección del Servicio' : 'Service Address'}
      </label>
      <input
        type="text"
        id="customer-address"
        placeholder="${isEs ? '123 Calle Principal, Miami FL' : '123 Main St, Miami FL'}"
        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
      />
      <p class="text-xs text-gray-500 mt-1">
        ${isEs ? 'Ayuda a identificar el trabajo para servicios en campo' : 'Helps identify the job for field service'}
      </p>
    `;

    phoneField.after(wrapper);
  },

  injectFakeDoorButton(container, v) {
    if (document.getElementById('servicetitan-btn')) return;

    const lang = i18n?.locale || 'en';
    const isEs = lang === 'es';

    const btn = document.createElement('button');
    btn.id = 'servicetitan-btn';
    btn.type = 'button';
    btn.className = 'flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white transition-colors';
    btn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      ${isEs ? 'Conectar' : 'Connect'} ${v.posName}
    `;
    btn.onclick = (e) => {
      e.preventDefault();
      const msg = isEs 
        ? `🔌 ¡Integración con ${v.posName} próximamente en Q1 2026! Has sido añadido a la lista de espera.`
        : `🔌 ${v.posName} integration coming Q1 2026! You've been added to the waitlist.`;
      alert(msg);
    };

    container.appendChild(btn);
  },

  bindVerticalSelector() {
    document.querySelectorAll('[data-vertical-selector]').forEach(sel => {
      sel.addEventListener('change', (e) => {
        this.setVertical(e.target.value);
      });
    });
  },

  getCompletionMessage(customerName) {
    const v = this.current;
    const lang = i18n?.locale || 'en';
    const template = lang === 'es' ? v.completionTemplateEs : v.completionTemplate;
    return template.replace('{{name}}', customerName || '');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => verticalConfig.init(), 100);
});
