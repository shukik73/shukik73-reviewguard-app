const i18n = {
  locale: localStorage.getItem('lang') || (navigator.language.startsWith('es') ? 'es' : 'en'),
  translations: {},
  fallback: {},

  async init() {
    await this.loadLocale('en', true);
    if (this.locale !== 'en') {
      await this.loadLocale(this.locale);
    }
    this.translatePage();
    this.bindSwitcher();
    this.updateSwitcherUI();
  },

  async loadLocale(lang, asFallback = false) {
    try {
      const res = await fetch(`/locales/${lang}.json`);
      const data = await res.json();
      if (asFallback) {
        this.fallback = data;
      } else {
        this.translations = data;
        this.locale = lang;
        localStorage.setItem('lang', lang);
        document.documentElement.lang = lang;
      }
    } catch (e) {
      console.warn(`Failed to load locale: ${lang}`, e);
    }
  },

  t(key) {
    const keys = key.split('.');
    let result = keys.reduce((o, k) => o?.[k], this.translations);
    if (result === undefined) {
      result = keys.reduce((o, k) => o?.[k], this.fallback);
    }
    return result || key;
  },

  translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const text = this.t(key);
      
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (el.placeholder) el.placeholder = text;
        if (el.dataset.i18nValue) el.value = text;
      } else if (el.tagName === 'OPTION') {
        el.textContent = text;
      } else if (el.dataset.i18nHtml) {
        el.innerHTML = text;
      } else {
        el.textContent = text;
      }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = this.t(el.dataset.i18nTitle);
    });

    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', this.t(el.dataset.i18nAria));
    });
  },

  async setLocale(lang) {
    if (lang === this.locale) return;
    await this.loadLocale(lang);
    this.translatePage();
    this.updateSwitcherUI();
  },

  bindSwitcher() {
    document.querySelectorAll('[data-lang-switch]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.setLocale(btn.dataset.langSwitch);
      });
    });
  },

  updateSwitcherUI() {
    document.querySelectorAll('[data-lang-switch]').forEach(btn => {
      const isActive = btn.dataset.langSwitch === this.locale;
      btn.classList.toggle('bg-accent', isActive);
      btn.classList.toggle('text-white', isActive);
      btn.classList.toggle('bg-slate-700', !isActive);
      btn.classList.toggle('text-slate-300', !isActive);
    });
  }
};

document.addEventListener('DOMContentLoaded', () => i18n.init());
