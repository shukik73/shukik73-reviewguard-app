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
      statusFlow: ['Received', 'In Progress', 'Ready for Pickup', 'Picked Up'],
      statusFlowEs: ['Recibido', 'En Progreso', 'Listo para Recoger', 'Recogido'],
      posName: 'RepairDesk',
      posIcon: '🔧'
    },
    hvac: {
      id: 'hvac',
      name: 'HVAC / Field Service',
      itemLabel: 'Unit / System',
      itemPlaceholder: 'AC Unit, Furnace, Heat Pump, etc.',
      serviceLabel: 'Service',
      completionTemplate: '✅ Service complete at your location',
      completionTemplateEs: '✅ Servicio completado en su ubicación',
      delayedTemplate: '⏳ Technician running late - will update soon',
      delayedTemplateEs: '⏳ Técnico retrasado - actualizaremos pronto',
      statusFlow: ['Scheduled', 'Technician En Route', 'In Progress', 'Completed'],
      statusFlowEs: ['Programado', 'Técnico en Camino', 'En Progreso', 'Completado'],
      posName: 'ServiceTitan',
      posIcon: '❄️'
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
      statusFlow: ['Checked In', 'Diagnosing', 'Repairing', 'Ready for Pickup'],
      statusFlowEs: ['Registrado', 'Diagnosticando', 'Reparando', 'Listo para Recoger'],
      posName: 'Shop-Ware',
      posIcon: '🚗'
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
      statusFlow: ['Appointment Set', 'In Service', 'Completed'],
      statusFlowEs: ['Cita Programada', 'En Servicio', 'Completado'],
      posName: 'Vagaro',
      posIcon: '💅'
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
      statusFlow: ['Waiting', 'In Chair', 'Completed'],
      statusFlowEs: ['Esperando', 'En la Silla', 'Completado'],
      posName: 'Square',
      posIcon: '💈'
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

    const posBtn = document.getElementById('repairdesk-import-btn');
    if (posBtn) {
      const btnText = posBtn.querySelector('span') || posBtn;
      if (v.id === 'repair') {
        btnText.textContent = 'Import from POS';
      } else {
        btnText.textContent = `Connect ${v.posName}`;
      }
    }

    const posModalTitle = document.querySelector('#repairdesk-modal h3');
    if (posModalTitle) {
      posModalTitle.textContent = v.id === 'repair' 
        ? 'Import from RepairDesk' 
        : `Connect ${v.posName} (Coming Soon)`;
    }

    document.querySelectorAll('[data-vertical-selector]').forEach(sel => {
      sel.value = v.id;
    });

    document.body.dataset.vertical = v.id;
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
