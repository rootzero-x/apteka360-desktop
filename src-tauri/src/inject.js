// Apteka 360 Desktop — har bir sahifaga (lokal va https://apteka.agrom24.uz) kiritiladigan skript.
// Placeholder'lar Rust tomonida almashtiriladi.
(function () {
  if (window.__APTEKA_DESKTOP__) return;
  var CLIENT = '__CLIENT_HEADER__';
  var DEVICE = '__DEVICE_HEADER__';
  var PANEL = '__PANEL_URL__';
  var VERSION = '__APP_VERSION__';
  window.__APTEKA_DESKTOP__ = { version: VERSION, client: CLIENT, device: DEVICE, panel: PANEL };

  function invoke(cmd, args) {
    try {
      if (window.__TAURI__ && window.__TAURI__.core) return window.__TAURI__.core.invoke(cmd, args || {});
    } catch (e) {}
    return Promise.reject(new Error('tauri yo‘q'));
  }

  // --- 1) API so'rovlariga X-Client / X-Client-Device qo'shish -------------------------------
  function shouldTag(url) {
    try {
      var u = new URL(url, location.href);
      return /(^|\.)agrom24\.uz$/i.test(u.hostname);
    } catch (e) { return false; }
  }
  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      try {
        var req = new Request(input, init);
        if (shouldTag(req.url)) {
          if (!req.headers.has('X-Client')) req.headers.set('X-Client', CLIENT);
          if (!req.headers.has('X-Client-Device')) req.headers.set('X-Client-Device', DEVICE);
          return origFetch.call(this, req);
        }
      } catch (e) {}
      return origFetch.call(this, input, init);
    };
  }
  var xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, url) { this.__aptekaTag = shouldTag(url); return xo.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    if (this.__aptekaTag) {
      try { this.setRequestHeader('X-Client', CLIENT); this.setRequestHeader('X-Client-Device', DEVICE); } catch (e) {}
    }
    return xs.apply(this, arguments);
  };

  // --- 2) Klaviatura: F11, F5, Ctrl+± / Ctrl+0 ------------------------------------------------
  window.addEventListener('keydown', function (e) {
    var ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'F11') { e.preventDefault(); invoke('toggle_fullscreen'); }
    else if (e.key === 'F5') { e.preventDefault(); location.reload(); }
    else if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); invoke('zoom_step', { delta: 1 }); }
    else if (ctrl && e.key === '-') { e.preventDefault(); invoke('zoom_step', { delta: -1 }); }
    else if (ctrl && e.key === '0') { e.preventDefault(); invoke('zoom_step', { delta: 0 }); }
  }, true);

  // --- 3) Offline overlay (web panel ichida aloqa uzilsa) -------------------------------------
  if (location.protocol === 'tauri:' || location.hostname === 'tauri.localhost' || location.protocol === 'file:') return; // lokal loader o'zi ko'rsatadi
  var overlay = null;
  function showOverlay() {
    if (overlay || !document.body) return;
    overlay = document.createElement('div');
    overlay.id = 'apteka-offline-overlay';
    overlay.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;font-family:system-ui,Segoe UI,Arial,sans-serif;text-align:center');
    overlay.innerHTML =
      '<div style="max-width:440px;padding:32px">' +
      '<div style="font-size:56px;line-height:1">📡</div>' +
      '<h1 style="font-size:22px;margin:16px 0 8px">Internet aloqasi yo‘q</h1>' +
      '<p style="color:#cbd5e1;font-size:15px;line-height:1.5">Apteka 360 serveriga ulanib bo‘lmadi. Tarmoq kabelini yoki Wi‑Fi ulanishini tekshiring. Aloqa tiklangach ilova o‘zi davom etadi.</p>' +
      '<button id="apteka-retry" style="margin-top:18px;background:#14b8a6;color:#fff;border:0;border-radius:10px;padding:12px 22px;font-size:15px;cursor:pointer">Qayta urinish</button>' +
      '<div style="margin-top:14px;font-size:12px;color:#64748b">Apteka 360 Desktop v' + VERSION + '</div></div>';
    document.body.appendChild(overlay);
    document.getElementById('apteka-retry').onclick = function () { location.reload(); };
  }
  function hideOverlay() { if (overlay) { overlay.remove(); overlay = null; } }
  window.addEventListener('offline', showOverlay);
  window.addEventListener('online', function () { hideOverlay(); });
  document.addEventListener('DOMContentLoaded', function () { if (navigator.onLine === false) showOverlay(); });
})();
