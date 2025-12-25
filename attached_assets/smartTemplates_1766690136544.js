const smartTemplates = {
  templates: {
    repair: {
      completion: {
        en: "Hi {{name}}, your {{device}} is ready for pickup at {{business}}! Thanks for choosing us. Please rate your experience: {{link}}",
        es: "Hola {{name}}, tu {{device}} está listo para recoger en {{business}}. ¡Gracias por elegirnos! Por favor califica tu experiencia: {{link}}"
      },
      delayed: {
        en: "Hi {{name}}, update on your {{device}}: we're waiting on parts. We'll contact you as soon as it's ready. Thanks for your patience!",
        es: "Hola {{name}}, actualización sobre tu {{device}}: estamos esperando las piezas. Te contactaremos cuando esté listo. ¡Gracias por tu paciencia!"
      },
      review: {
        en: "Hi {{name}}! Thank you for choosing {{business}} for your {{device}} repair. We'd love your feedback: {{link}}",
        es: "¡Hola {{name}}! Gracias por elegir {{business}} para la reparación de tu {{device}}. Nos encantaría tu opinión: {{link}}"
      },
      follow_up: {
        en: "Hi {{name}}! Just checking in on your {{device}}. Is everything working well after the {{service}}? Let us know if you need anything!",
        es: "¡Hola {{name}}! Solo verificando tu {{device}}. ¿Todo funciona bien después del {{service}}? ¡Avísanos si necesitas algo!"
      }
    },
    hvac: {
      completion: {
        en: "Hi {{name}}, we've completed the {{service}} at {{address}}. Your system is running at optimal efficiency. Please rate our service: {{link}}",
        es: "Hola {{name}}, hemos completado el {{service}} en {{address}}. Tu sistema está funcionando de manera óptima. Por favor califica nuestro servicio: {{link}}"
      },
      delayed: {
        en: "Hi {{name}}, update on your {{service}} at {{address}}: we're waiting on parts and will reschedule soon. Thanks for your patience!",
        es: "Hola {{name}}, actualización sobre tu {{service}} en {{address}}: estamos esperando piezas y reprogramaremos pronto. ¡Gracias por tu paciencia!"
      },
      review: {
        en: "Hi {{name}}! Thanks for choosing {{business}} for your HVAC service at {{address}}. How did we do? {{link}}",
        es: "¡Hola {{name}}! Gracias por elegir {{business}} para tu servicio de HVAC en {{address}}. ¿Cómo lo hicimos? {{link}}"
      },
      maintenance: {
        en: "Hi {{name}}, it's been 6 months since we serviced your system at {{address}}. Time for a tune-up? Reply YES to schedule.",
        es: "Hola {{name}}, han pasado 6 meses desde que dimos servicio a tu sistema en {{address}}. ¿Es hora de un mantenimiento? Responde SÍ para agendar."
      },
      follow_up: {
        en: "Hi {{name}}! Checking in on your AC system at {{address}}. Is the temperature holding steady? Let us know if you need anything!",
        es: "¡Hola {{name}}! Verificando tu aire acondicionado en {{address}}. ¿La temperatura se mantiene bien? ¡Avísanos si necesitas algo!"
      }
    },
    plumbing: {
      completion: {
        en: "Hi {{name}}, your plumbing service at {{address}} is complete! Everything is working properly. Please rate us: {{link}}",
        es: "Hola {{name}}, ¡tu servicio de plomería en {{address}} está completo! Todo funciona correctamente. Por favor califícanos: {{link}}"
      },
      delayed: {
        en: "Hi {{name}}, update on your plumbing job at {{address}}: we need to order a part. We'll reschedule ASAP. Thanks for understanding!",
        es: "Hola {{name}}, actualización sobre tu trabajo de plomería en {{address}}: necesitamos pedir una pieza. Reprogramaremos lo antes posible. ¡Gracias por entender!"
      },
      review: {
        en: "Hi {{name}}! Thanks for choosing {{business}} for your plumbing needs. How was your experience? {{link}}",
        es: "¡Hola {{name}}! Gracias por elegir {{business}} para tus necesidades de plomería. ¿Cómo fue tu experiencia? {{link}}"
      },
      follow_up: {
        en: "Hi {{name}}! Checking in on the plumbing work at {{address}}. Is everything working properly? Let us know if you need anything!",
        es: "¡Hola {{name}}! Verificando el trabajo de plomería en {{address}}. ¿Todo funciona bien? ¡Avísanos si necesitas algo!"
      }
    },
    auto: {
      completion: {
        en: "Hi {{name}}, your {{device}} is ready for pickup! We completed the {{service}}. Please rate your experience: {{link}}",
        es: "Hola {{name}}, ¡tu {{device}} está listo para recoger! Completamos el {{service}}. Por favor califica tu experiencia: {{link}}"
      },
      delayed: {
        en: "Hi {{name}}, update on your {{device}}: the {{service}} is taking longer than expected. We'll keep you posted. Thanks!",
        es: "Hola {{name}}, actualización sobre tu {{device}}: el {{service}} está tardando más de lo esperado. Te mantendremos informado. ¡Gracias!"
      },
      review: {
        en: "Hi {{name}}! Thanks for trusting {{business}} with your {{device}}. We'd appreciate your feedback: {{link}}",
        es: "¡Hola {{name}}! Gracias por confiar en {{business}} para tu {{device}}. Apreciaríamos tu opinión: {{link}}"
      },
      follow_up: {
        en: "Hi {{name}}! Just checking in on your {{device}}. Is everything running smoothly after the {{service}}? Let us know if you need anything!",
        es: "¡Hola {{name}}! Solo verificando tu {{device}}. ¿Todo funciona bien después del {{service}}? ¡Avísanos si necesitas algo!"
      }
    }
  },

  generate(vertical, templateType, data, lang = 'en') {
    const verticalTemplates = this.templates[vertical] || this.templates.repair;
    const template = verticalTemplates[templateType];
    
    if (!template) {
      console.warn(`Template not found: ${vertical}/${templateType}`);
      return '';
    }

    let message = template[lang] || template.en;

    message = message.replace(/\{\{name\}\}/g, data.name || 'Customer');
    message = message.replace(/\{\{device\}\}/g, data.device || 'device');
    message = message.replace(/\{\{service\}\}/g, data.service || 'service');
    message = message.replace(/\{\{address\}\}/g, data.address || (lang === 'es' ? 'su ubicación' : 'your location'));
    message = message.replace(/\{\{business\}\}/g, data.business || 'our shop');
    message = message.replace(/\{\{link\}\}/g, data.link || '[review link]');
    message = message.replace(/\{\{cost\}\}/g, data.cost || '');

    return message;
  },

  getTemplateOptions(vertical, lang = 'en') {
    const labels = {
      en: {
        completion: '✅ Service/Repair Complete',
        delayed: '⏳ Delayed - Parts on Order',
        review: '⭐ Review Request',
        maintenance: '🔧 Maintenance Reminder',
        follow_up: '📞 Follow-up Check-in'
      },
      es: {
        completion: '✅ Servicio/Reparación Completa',
        delayed: '⏳ Retrasado - Piezas en Pedido',
        review: '⭐ Solicitud de Reseña',
        maintenance: '🔧 Recordatorio de Mantenimiento',
        follow_up: '📞 Seguimiento'
      }
    };

    const verticalTemplates = this.templates[vertical] || this.templates.repair;
    const options = [];

    for (const key of Object.keys(verticalTemplates)) {
      options.push({
        value: key,
        label: labels[lang]?.[key] || labels.en[key] || key
      });
    }

    return options;
  },

  updateTemplateDropdown(selectId, vertical) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const lang = localStorage.getItem('lang') || 'en';
    const options = this.getTemplateOptions(vertical, lang);

    const defaultOption = select.querySelector('option[value=""]');
    select.innerHTML = '';
    
    if (defaultOption) {
      select.appendChild(defaultOption);
    } else {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = lang === 'es' ? 'Selecciona una plantilla...' : 'Select a template...';
      select.appendChild(opt);
    }

    options.forEach(({ value, label }) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      select.appendChild(opt);
    });
  },

  bindToForm() {
    const templateSelect = document.getElementById('message-type') || document.getElementById('quick-template');
    const previewArea = document.getElementById('message-preview') || document.getElementById('quick-message');
    
    if (!templateSelect || !previewArea) return;

    templateSelect.addEventListener('change', (e) => {
      const templateType = e.target.value;
      if (!templateType) return;

      const vertical = verticalConfig?.current?.id || 'repair';
      const lang = localStorage.getItem('lang') || 'en';

      const data = {
        name: document.getElementById('customer-name')?.value || 'Customer',
        device: document.getElementById('device')?.value || '',
        service: document.getElementById('repair')?.value || '',
        address: document.getElementById('customer-address')?.value || '',
        business: document.getElementById('settings-business-name')?.value || 'our shop',
        link: document.getElementById('settings-review-link')?.value || '[review link]'
      };

      const message = this.generate(vertical, templateType, data, lang);
      
      if (previewArea.tagName === 'TEXTAREA') {
        previewArea.value = message;
      } else {
        previewArea.textContent = message;
      }
    });
  },

  init() {
    const vertical = verticalConfig?.current?.id || localStorage.getItem('vertical') || 'repair';
    
    this.updateTemplateDropdown('message-type', vertical);
    this.updateTemplateDropdown('quick-template', vertical);
    
    this.bindToForm();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => smartTemplates.init(), 200);
});

if (typeof verticalConfig !== 'undefined') {
  const originalSetVertical = verticalConfig.setVertical.bind(verticalConfig);
  verticalConfig.setVertical = function(verticalId) {
    originalSetVertical(verticalId);
    smartTemplates.updateTemplateDropdown('message-type', verticalId);
    smartTemplates.updateTemplateDropdown('quick-template', verticalId);
  };
}
