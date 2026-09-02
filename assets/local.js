(function () {
  'use strict';

  var AUTH_KEY = 'tdlc_auth';
  var SETTINGS_KEY = 'tdlc_settings';
  var LANG_KEY = 'tdlc_lang';

  var LS = {
    get: function (k, d) {
      try {
        var v = localStorage.getItem(k);
        return v === null || v === undefined ? d : JSON.parse(v);
      } catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  function api(path, body) {
    return fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json(); });
  }

  var cachedSettings = LS.get(SETTINGS_KEY, null) || {};
  window.AppConfig = window.AppConfig || {};
  var defaults = {
    shortClientName: 'ToshibaDLC',
    clientName: 'ToshibaDLC',
    version: '1.21.4',
    clientColor: '#A794F4',
    url: 'toshibadlc.space'
  };
  var merged = {};
  [defaults, window.AppConfig, cachedSettings].forEach(function (src) {
    for (var k in src) { if (src[k] !== undefined && src[k] !== null) merged[k] = src[k]; }
  });
  window.AppConfig = merged;

  function cacheUser(user) {
    if (user) LS.set(AUTH_KEY, { user: user });
    else LS.del(AUTH_KEY);
  }

  window.getCurrentUser = function () {
    var auth = LS.get(AUTH_KEY, null);
    return auth && auth.user ? auth.user : null;
  };

  window.loginUser = function (username, password) {
    return api('/api/login', { username: username, password: password }).then(function (res) {
      if (res.success) cacheUser(res.user);
      return res;
    });
  };

  window.registerUser = function (username, email, password) {
    return api('/api/register', { username: username, email: email, password: password });
  };

  window.logoutUser = function () {
    cacheUser(null);
    try { api('/api/logout', {}); } catch (e) {}
  };

  window.changePassword = function (username, oldPassword, newPassword) {
    return api('/api/change-password', { oldPassword: oldPassword, newPassword: newPassword });
  };

  window.changeEmail = function (username, currentPassword, newEmail) {
    return api('/api/change-email', { currentPassword: currentPassword, newEmail: newEmail });
  };

  var fakeTurnstile = {
    getResponse: function () { return 'local-token'; },
    reset: function () {},
    render: function () { return 0; },
    remove: function () {},
    execute: function () { return Promise.resolve('local-token'); }
  };
  function lockTurnstile() {
    try {
      Object.defineProperty(window, 'turnstile', { value: fakeTurnstile, writable: false, configurable: true });
    } catch (e) { window.turnstile = fakeTurnstile; }
  }
  lockTurnstile();

  function toastStyles() {
    if (document.getElementById('tdlc-toast-style')) return;
    var css = '.tdlc-toasts{position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;}' +
      '.tdlc-toast{min-width:260px;max-width:340px;padding:14px 16px;border-radius:14px;background:var(--surface,#1A1A1E);' +
      'border:1px solid var(--border-color,rgba(255,255,255,.08));box-shadow:0 10px 30px rgba(0,0,0,.4);color:var(--text-main,#fff);' +
      'font-family:var(--font-sans,sans-serif);animation:tdlcIn .25s ease;backdrop-filter:blur(12px);}' +
      '.tdlc-toast .t-title{font-weight:700;font-size:14px;margin-bottom:3px;display:flex;align-items:center;gap:8px;}' +
      '.tdlc-toast .t-msg{font-size:13px;color:var(--text-muted,#aaa);}' +
      '.tdlc-toast.success{border-color:rgba(74,222,128,.4);} .tdlc-toast.error{border-color:rgba(248,113,113,.45);}' +
      '.tdlc-toast.info{border-color:rgba(167,148,244,.45);}' +
      '.tdlc-dot{width:8px;height:8px;border-radius:50%;display:inline-block;}' +
      '.success .tdlc-dot{background:#4ade80;} .error .tdlc-dot{background:#f87171;} .info .tdlc-dot{background:#A794F4;}' +
      '@keyframes tdlcIn{from{opacity:0;transform:translateX(20px);}to{opacity:1;transform:none;}}';
    var st = document.createElement('style');
    st.id = 'tdlc-toast-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  window.showToast = function (title, message, type) {
    toastStyles();
    type = type || 'info';
    var wrap = document.querySelector('.tdlc-toasts');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'tdlc-toasts';
      document.body.appendChild(wrap);
    }
    var el = document.createElement('div');
    el.className = 'tdlc-toast ' + type;
    el.innerHTML = '<div class="t-title"><span class="tdlc-dot"></span>' +
      String(title || '').replace(/</g, '&lt;') + '</div><div class="t-msg">' +
      String(message || '').replace(/</g, '&lt;') + '</div>';
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      setTimeout(function () { el.remove(); }, 300);
    }, 3500);
  };

  var I18N = {
    ru: {
      'Home': 'Главная', 'Overview': 'Обзор', 'Buy': 'Купить', 'FAQ': 'FAQ',
      'Login': 'Вход', 'Sign In': 'Войти', 'Register': 'Регистрация', 'Create Account': 'Создать аккаунт',
      'Get Access': 'Получить доступ', 'Learn More': 'Подробнее', 'Profile': 'Профиль', 'Admin': 'Админка',
      'Logout': 'Выйти', 'Download': 'Скачать', 'Apply': 'Применить', 'Purchase': 'Покупка', 'Launch': 'Запуск',
      'Dominate': 'Доминируй', 'Username': 'Имя пользователя', 'Email': 'Email', 'Password': 'Пароль',
      'Confirm Password': 'Подтвердите пароль', 'Already have an account?': 'Уже есть аккаунт?',
      "Don't have an account?": 'Нет аккаунта?', 'Trusted by +1.500 Players': 'Нам доверяют +1500 игроков',
      '+1.000 Satisfied Customers': '+1000 довольных клиентов',
      'Unleash Your': 'Раскрой свой', 'True': 'истинный', 'Potential': 'потенциал',
      'Enter license key': 'Введите лицензионный ключ', 'No Active Sub': 'Нет активной подписки',
      'Not Linked': 'Не привязан', 'Member': 'Участник', 'Satisfied Customers': 'Довольных клиентов'
    },
    en: {}
  };

  function currentLang() { return LS.get(LANG_KEY, 'ru'); }

  function translateText(text) {
    var dict = I18N[currentLang()] || {};
    var trimmed = text.trim();
    if (dict[trimmed]) return text.replace(trimmed, dict[trimmed]);
    return text;
  }

  function applyI18n(root) {
    root = root || document.body;
    if (!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = node.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.nodeName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest('.tdlc-lang-menu')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      var translated = translateText(node.nodeValue);
      if (translated !== node.nodeValue) node.nodeValue = translated;
    });
    document.querySelectorAll('[placeholder]').forEach(function (el) {
      var ph = el.getAttribute('placeholder');
      var dict = I18N[currentLang()] || {};
      if (dict[ph]) el.setAttribute('placeholder', dict[ph]);
    });
  }

  function setLang(lang) { LS.set(LANG_KEY, lang); window.location.reload(); }

  function injectLangSwitcher() {
    var nav = document.querySelector('.nav-center') || document.querySelector('.navbar');
    if (!nav || document.querySelector('.tdlc-lang-menu')) return;
    var lang = currentLang();
    var menu = document.createElement('div');
    menu.className = 'tdlc-lang-menu';
    menu.style.cssText = 'position:relative;display:inline-flex;margin-left:8px;';
    menu.innerHTML =
      '<button class="tdlc-lang-btn" style="display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:10px;' +
      'background:var(--surface);border:1px solid var(--border-color);color:var(--text-main);cursor:pointer;font-family:inherit;' +
      'font-size:13px;font-weight:600;">' +
      '<span style="font-size:15px;">' + (lang === 'ru' ? '🇷🇺' : '🇬🇧') + '</span>' + lang.toUpperCase() + '</button>' +
      '<div class="tdlc-lang-drop" style="display:none;position:absolute;top:calc(100% + 6px);right:0;background:var(--surface);' +
      'border:1px solid var(--border-color);border-radius:10px;overflow:hidden;z-index:1000;min-width:110px;box-shadow:0 10px 30px rgba(0,0,0,.4);">' +
      '<div data-lang="ru" style="padding:9px 14px;cursor:pointer;font-size:13px;color:var(--text-main);">🇷🇺 Русский</div>' +
      '<div data-lang="en" style="padding:9px 14px;cursor:pointer;font-size:13px;color:var(--text-main);">🇬🇧 English</div>' +
      '</div>';
    nav.appendChild(menu);
    var btn = menu.querySelector('.tdlc-lang-btn');
    var drop = menu.querySelector('.tdlc-lang-drop');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      drop.style.display = drop.style.display === 'none' ? 'block' : 'none';
    });
    drop.querySelectorAll('[data-lang]').forEach(function (item) {
      item.addEventListener('mouseenter', function () { item.style.background = 'var(--surface-hover)'; });
      item.addEventListener('mouseleave', function () { item.style.background = 'transparent'; });
      item.addEventListener('click', function () { setLang(item.getAttribute('data-lang')); });
    });
    document.addEventListener('click', function () { drop.style.display = 'none'; });
  }

  function injectAdminLink() {
    var cur = window.getCurrentUser();
    if (!cur || cur.role !== 'Admin') return;
    var nav = document.querySelector('.nav-center');
    if (!nav || nav.querySelector('.tdlc-admin-link')) return;
    var base = document.querySelector('a[href="../index.html"]') ? '../' : '';
    var a = document.createElement('a');
    a.href = base + 'admin/index.html';
    a.className = 'nav-link tdlc-admin-link';
    a.style.color = 'var(--primary)';
    a.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" class="icon-xs" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M12 2L4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3z"/></svg> Admin';
    nav.appendChild(a);
  }

  function applyConfigText() {
    document.querySelectorAll('[data-config-text]').forEach(function (el) {
      if (el.tagName === 'TITLE') return;
      var key = el.getAttribute('data-config-text');
      var val = window.AppConfig[key];
      if (!val) return;
      var tn = Array.from(el.childNodes).find(function (n) { return n.nodeType === 3 && n.textContent.trim() !== ''; });
      if (tn) tn.textContent = ' ' + val;
      else el.appendChild(document.createTextNode(' ' + val));
    });
  }

  function loadSettings() {
    return fetch('/api/settings', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.success && res.settings) {
          for (var k in res.settings) window.AppConfig[k] = res.settings[k];
          LS.set(SETTINGS_KEY, res.settings);
          applyConfigText();
        }
      })
      .catch(function () {});
  }

  function refreshSession() {
    if (!window.getCurrentUser()) return;
    fetch('/api/profile', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) {
        if (r.status === 401) { cacheUser(null); return null; }
        return r.json();
      })
      .then(function (res) {
        if (res && res.success && res.user) cacheUser(res.user);
      })
      .catch(function () {});
  }

  document.addEventListener('DOMContentLoaded', function () {
    lockTurnstile();
    document.querySelectorAll('.cf-turnstile').forEach(function (el) { el.style.display = 'none'; });
    injectLangSwitcher();
    injectAdminLink();
    applyI18n(document.body);
    loadSettings();
    refreshSession();
    if (window.lucide) { try { lucide.createIcons(); } catch (e) {} }
  });
  window.addEventListener('load', lockTurnstile);

  window.tdlc = {
    setLang: setLang,
    currentLang: currentLang,
    getUser: window.getCurrentUser,
    api: api
  };
})();
