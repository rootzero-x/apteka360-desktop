// Apteka 360 Desktop — qobiq (shell) va panel (https://apteka.agrom24.uz) webview'lariga kiritiladigan skript.
// Placeholder'lar Rust tomonida almashtiriladi.
(function () {
  if (window.__APTEKA_DESKTOP__) return;
  var CLIENT = '__CLIENT_HEADER__', DEVICE = '__DEVICE_HEADER__', PANEL = '__PANEL_URL__', VERSION = '__APP_VERSION__';
  var isShell = location.protocol === 'tauri:' || location.hostname === 'tauri.localhost' || location.protocol === 'file:';
  window.__APTEKA_DESKTOP__ = { version: VERSION, client: CLIENT, device: DEVICE, panel: PANEL, shell: isShell };

  function invoke(cmd, args) {
    try { if (window.__TAURI__ && window.__TAURI__.core) return window.__TAURI__.core.invoke(cmd, args || {}); } catch (e) {}
    return Promise.reject(new Error('tauri yo‘q'));
  }

  // --- Klaviatura (ikkala webview'da): F11, F5, Ctrl+R, Ctrl+±/0, Alt+←/→ --------------------
  window.addEventListener('keydown', function (e) {
    var ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'F11') { e.preventDefault(); invoke('toggle_fullscreen'); }
    else if (e.key === 'F5' || (ctrl && (e.key === 'r' || e.key === 'R'))) { e.preventDefault(); invoke('panel_reload'); }
    else if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); invoke('zoom_step', { delta: 1 }); }
    else if (ctrl && e.key === '-') { e.preventDefault(); invoke('zoom_step', { delta: -1 }); }
    else if (ctrl && e.key === '0') { e.preventDefault(); invoke('zoom_step', { delta: 0 }); }
    else if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); invoke('panel_back'); }
    else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); invoke('panel_forward'); }
  }, true);

  if (isShell) return; // qolgani faqat panel uchun

  // --- 1) API so'rovlariga X-Client / X-Client-Device qo'shish -------------------------------
  function shouldTag(url) {
    try { var u = new URL(url, location.href); return /(^|\.)agrom24\.uz$/i.test(u.hostname); } catch (e) { return false; }
  }
  // --- Token ushlash: native ekranlar qobiqda shu sessiya bilan ishlaydi (refresh-cookie panelda qoladi) ---
  var API_HOST = ''; try { API_HOST = new URL('__API_URL__').host; } catch (e) {}
  var lastToken = null;
  function report(tok) { if (tok === lastToken) return; lastToken = tok; invoke('report_token', { token: tok }).catch(function () {}); }
  function isApi(url) { try { var u = new URL(url, location.href); return u.host === API_HOST || shouldTag(url); } catch (e) { return false; } }
  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      var req;
      try {
        req = new Request(input, init);
        if (isApi(req.url)) {
          if (!req.headers.has('X-Client')) req.headers.set('X-Client', CLIENT);
          if (!req.headers.has('X-Client-Device')) req.headers.set('X-Client-Device', DEVICE);
          var a = req.headers.get('Authorization'); if (a && a.indexOf('Bearer ') === 0) report(a.slice(7));
          var path = ''; try { path = new URL(req.url).pathname; } catch (e) {}
          var p = origFetch.call(this, req);
          if (/^\/v1\/auth\/(otp|device|refresh|logout)$/.test(path)) {
            p.then(function (r) {
              if (path === '/v1/auth/logout') { if (r.ok || r.status === 401) report(null); return; }
              if (path === '/v1/auth/refresh' && r.status === 401) { report(null); return; }
              if (!r.ok) return;
              r.clone().json().then(function (b) { if (b && b.accessToken) report(b.accessToken); }).catch(function () {});
            }).catch(function () {});
          }
          return p;
        }
      } catch (e) {}
      return origFetch.call(this, input, init);
    };
  }
  var xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, url) { this.__aptekaTag = shouldTag(url); return xo.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    if (this.__aptekaTag) { try { this.setRequestHeader('X-Client', CLIENT); this.setRequestHeader('X-Client-Device', DEVICE); } catch (e) {} }
    return xs.apply(this, arguments);
  };

  // --- 2) Compact rejim: panelning o'z yon paneli yashiriladi (navigatsiya desktop qobig'ida) ---
  // Qobiq `desktop-compact` localStorage kalitini boshqaradi ('0' — panel navigatsiyasini ko'rsatish).
  var STYLE_ID = 'apteka-desktop-compact';
  var CSS = 'div.grid.min-h-screen{grid-template-columns:minmax(0,1fr)!important}' +
            'div.grid.min-h-screen>:first-child:not(.flex){display:none!important}' +
            'html{scrollbar-gutter:stable}';
  function applyCompact() {
    var on = true; try { on = localStorage.getItem('desktop-compact') !== '0'; } catch (e) {}
    var el = document.getElementById(STYLE_ID);
    if (on && !el && document.head) { el = document.createElement('style'); el.id = STYLE_ID; el.textContent = CSS; document.head.appendChild(el); }
    if (!on && el) el.remove();
  }
  window.__aptekaSetCompact = function (on) { try { localStorage.setItem('desktop-compact', on ? '1' : '0'); } catch (e) {} applyCompact(); };
  if (document.head) applyCompact(); else document.addEventListener('DOMContentLoaded', applyCompact);
  new MutationObserver(function () { if (!document.getElementById(STYLE_ID)) applyCompact(); }).observe(document.documentElement, { childList: true });

  // --- 2b) Linux zaxira rejimi: panel butun oynada — ilovaga qaytish tugmasi ---------------------
  if (/Linux/i.test(navigator.platform || '') && !/Android/i.test(navigator.userAgent)) {
    var addBack = function () {
      if (!document.body || document.getElementById('apteka-home')) return;
      if (/^\/login/.test(location.pathname)) return;
      var b = document.createElement('button'); b.id = 'apteka-home'; b.textContent = '◂ Apteka 360';
      b.setAttribute('style', 'position:fixed;left:12px;bottom:12px;z-index:2147483646;height:32px;padding:0 14px;border-radius:4px;border:1px solid rgba(0,0,0,.16);background:#0f7b6c;color:#fff;font:600 13px Segoe UI,system-ui,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.2)');
      b.onclick = function () { invoke('shell_home'); }; document.body.appendChild(b);
    };
    document.addEventListener('DOMContentLoaded', addBack); setInterval(addBack, 2000);
  }

  // --- 3) Tarmoq holati → qobiq ---------------------------------------------------------------
  window.addEventListener('offline', function () { invoke('report_network', { online: false }); });
  window.addEventListener('online', function () { invoke('report_network', { online: true }); });

  // --- 4) Standart kontekst menyusini o'chirish (matn maydonlaridan tashqari) — desktop his --------
  document.addEventListener('contextmenu', function (e) {
    var t = e.target; var tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
    e.preventDefault();
  });
})();
