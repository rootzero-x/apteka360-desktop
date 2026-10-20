/* Apteka 360 Desktop — native qobiq yadrosi: navigatsiya, sessiya, API, dialoglar, kirish.
 * Ekranlar screens.js da (Apteka.screens). Ma'lumot to'g'ridan-to'g'ri API'dan (Rust `api` buyrug'i orqali) olinadi;
 * native bo'lmagan bo'limlar web paneldan (child-webview «panel») ochiladi. */
(function () {
  'use strict';
  var T = window.__TAURI__, core = T && T.core, ev = T && T.event;
  var invoke = function (c, a) { return core ? core.invoke(c, a || {}) : Promise.reject(new Error('tauri yo‘q')); };
  var D = window.__APTEKA_DESKTOP__ || {};
  var $ = function (id) { return document.getElementById(id); };
  var dbg = function (m) { try { invoke('debug_log', { msg: String(m) }).catch(function () {}); } catch (e) {} };

  // ───────────── DOM yordamchilari ─────────────
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k]; if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  // Fluent uslubidagi chiziqli ikonkalar (16×16)
  var P = {
    home: 'M2.5 7.5 8 3l5.5 4.5V13H10V9.5H6V13H2.5z', branch: 'M2 13.5h12M3 13.5V6l5-3 5 3v7.5M6.5 13.5v-4h3v4',
    people: 'M6 7a2.2 2.2 0 1 0 0-4.4A2.2 2.2 0 0 0 6 7zM2 13c0-2.4 1.8-4 4-4s4 1.6 4 4M11 7.5a1.8 1.8 0 1 0 0-3.6M11.5 9.3c1.5.3 2.5 1.6 2.5 3.4',
    clock: 'M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM8 5v3.2l2 1.3', cal: 'M3 3.5h10a1 1 0 0 1 1 1V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1zM2 6.5h12M5.5 2v3M10.5 2v3',
    cash: 'M2 4.5h12v7H2zM8 9.6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM4.3 8h.01M11.7 8h.01', chart: 'M2 13.5h12M4 11V7.5M7 11V4M10 11V8.5M13 11V6',
    wallet: 'M2.5 5a1 1 0 0 1 1-1h8.5v2M2.5 5v7a1.5 1.5 0 0 0 1.5 1.5h10V7.5H4A1.5 1.5 0 0 1 2.5 6zM11 10.5h.01', pay: 'M3 12.5 8 3l5 9.5M5 9.5h6',
    pl: 'M2 12l3.5-4 2.5 2.5 3.5-5 2.5 2.5M2 14h12', tax: 'M3.5 2.5h9v11l-2.2-1.4-2.3 1.4-2.3-1.4-2.2 1.4zM6 6h4M6 8.5h3', flow: 'M2 5h7.5a2.5 2.5 0 0 1 0 5H6.5a2.5 2.5 0 0 0 0 5H14M11.5 2.5 14 5l-2.5 2.5',
    forecast: 'M2 12c1.8-3.3 3.6-5 6-5s4.2 2.4 6 .8M2 14h12M11.5 5.5 14 5l-.5 2.5', cam: 'M2 4.8h8a1 1 0 0 1 1 1v4.4a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5.8a1 1 0 0 1 1-1zM11 7.2 15 5v6l-4-2.2',
    live: 'M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM4 4a5.6 5.6 0 0 0 0 8M12 4a5.6 5.6 0 0 1 0 8', wall: 'M2.5 2.5h4.5V7H2.5zM9 2.5h4.5V7H9zM2.5 9H7v4.5H2.5zM9 9h4.5v4.5H9z',
    ai: 'M8 2l1.3 3.6L13 7l-3.7 1.4L8 12l-1.3-3.6L3 7l3.7-1.4zM12.6 11l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z', check: 'M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM5.3 8.3l1.9 1.9 3.6-4',
    audit: 'M4 2h6l2.5 2.5V14H4zM9.5 2v3h3M6.5 8h4M6.5 10.5h4', expire: 'M8 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM8 7v2l1.3 1M6.5 1.5h3',
    truck: 'M1.5 4h8v6.5h-8zM9.5 6.5h3l2 2.5v1.5h-5zM4.5 12.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zM11.5 12.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z',
    doctor: 'M8 6.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 14c0-2.6 2.2-4.5 5-4.5s5 1.9 5 4.5M8 9.5v4M6.5 12h3', report: 'M3.5 2h6.5l2.5 2.5V14h-9zM5.8 7.5h4.4M5.8 9.8h4.4M5.8 12h2.6',
    bell: 'M4 11.5h8l-1.2-1.6V7a2.8 2.8 0 0 0-5.6 0v2.9zM6.8 13.2a1.2 1.2 0 0 0 2.4 0', gear: 'M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1',
    user: 'M8 7.5a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4zM3 14c0-2.7 2.2-4.6 5-4.6s5 1.9 5 4.6', key: 'M5.5 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM7.6 7.9 13.5 2M11.5 4l1.5 1.5M10 5.5l1.3 1.3',
    health: 'M1.5 8h3l1.5-3.5 2.5 7 1.5-3.5h4.5', module: 'M2.5 2.5h4.5V7H2.5zM9 2.5h4.5V7H9zM2.5 9H7v4.5H2.5zM11.2 9v4.5M9 11.2h4.5',
    menu: 'M2.5 4h11M2.5 8h11M2.5 12h11', left: 'M10 3 5 8l5 5', right: 'M6 3l5 5-5 5', refresh: 'M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3',
    full: 'M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10', more: 'M3.5 8h.01M8 8h.01M12.5 8h.01', search: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM10.6 10.6 14 14',
    info: 'M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM8 7.2V11M8 5h.01', warn: 'M8 2.2 14.3 13H1.7zM8 6.5v3M8 11.3h.01', crit: 'M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM6 6l4 4M10 6l-4 4',
    ok: 'M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM5.3 8.2l1.9 1.9 3.6-4', ext: 'M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5v4H2.5V4h4', mic: 'M8 10.5a2.5 2.5 0 0 0 2.5-2.5V4a2.5 2.5 0 0 0-5 0v4A2.5 2.5 0 0 0 8 10.5zM3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5',
    vol: 'M2.5 6h2.5l3.5-3v10L5 10H2.5zM11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.5a6 6 0 0 1 0 9', mute: 'M2.5 6h2.5l3.5-3v10L5 10H2.5zM11 6l3.5 4M14.5 6 11 10',
    close: 'M3.5 3.5l9 9M12.5 3.5l-9 9', logout: 'M6 2.5H3v11h3M10.5 11 14 8l-3.5-3M14 8H6', filter: 'M2 3h12l-4.5 5.5V13l-3-1.5V8.5z', plus: 'M8 3v10M3 8h10',
    chev: 'M6 4l4 4-4 4', inbox: 'M2 9.5 3.8 3.5h8.4L14 9.5V13H2zM2 9.5h3.5l1 1.5h3l1-1.5H14'
  };
  function icon(name, cls) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 16 16'); s.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', P[name] || P.home);
    s.appendChild(p); return s;
  }

  // ───────────── Formatlash ─────────────
  function group(n) { var s = String(Math.round(Math.abs(n))); return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function money(n) { if (n == null) return '—'; return (n < 0 ? '−' : '') + group(n) + ' so‘m'; }
  function moneyShort(n) {
    if (n == null) return { v: '—', u: '' };
    var a = Math.abs(n), sg = n < 0 ? '−' : '';
    if (a >= 1e9) return { v: sg + (a / 1e9).toFixed(1).replace('.', ','), u: 'mlrd so‘m' };
    if (a >= 1e6) return { v: sg + (a / 1e6).toFixed(1).replace('.', ','), u: 'mln so‘m' };
    return { v: sg + group(a), u: 'so‘m' };
  }
  function num(n) { return n == null ? '—' : (n < 0 ? '−' : '') + group(n); }
  function pct(n) { return n == null ? '—' : (n > 0 ? '+' : '') + String(n).replace('.', ',') + '%'; }
  function initials(name) { return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); }
  function uuid() { try { return crypto.randomUUID(); } catch (e) { return 'q-' + Date.now() + '-' + Math.random().toString(36).slice(2); } }
  var MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
  var DAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
  function longDate(d) { d = d || new Date(); return d.getDate() + '-' + MONTHS[d.getMonth()] + ', ' + DAYS[d.getDay()]; }
  function hhmm(d) { d = d || new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }

  // ───────────── Navigatsiya xaritasi ─────────────
  // native: true — ilovaning o'z ekrani; aks holda web paneldan ochiladi.
  var NAV = [
    { group: 'Asosiy' },
    { id: 'dashboard', path: '/dashboard', label: 'Bosh sahifa', icon: 'home', native: true, alias: ['/'] },
    { id: 'branches', path: '/branches', label: 'Filiallar', icon: 'branch', native: true },
    { id: 'employees', path: '/employees', label: 'Xodimlar', icon: 'people', native: true },
    { id: 'attendance', path: '/attendance', label: 'Davomat', icon: 'clock' },
    { id: 'schedule', path: '/schedule', label: 'Ish jadvali', icon: 'cal' },
    { group: 'Moliya' },
    { id: 'cash', path: '/cash', label: 'Kassa', icon: 'cash', native: true },
    { id: 'fom', path: '/fom', label: 'FOM hisobot', icon: 'chart' },
    { id: 'expenses', path: '/expenses', label: 'Xarajatlar', icon: 'wallet' },
    { id: 'tolovlar', path: '/tolovlar', label: 'To‘lovlar', icon: 'pay' },
    { id: 'payroll', path: '/payroll', label: 'Oylik maosh', icon: 'user' },
    { id: 'pnl', path: '/pnl', label: 'Foyda va zarar', icon: 'pl' },
    { id: 'cashflow', path: '/cashflow', label: 'Pul oqimi', icon: 'flow' },
    { id: 'soliq', path: '/soliq', label: 'Soliq', icon: 'tax' },
    { id: 'forecast', path: '/forecast', label: 'Prognoz', icon: 'forecast' },
    { group: 'Nazorat' },
    { id: 'cameras', path: '/cameras', label: 'Kameralar', icon: 'cam', native: true },
    { id: 'videowall', path: '/videowall', label: 'Video devor', icon: 'wall' },
    { id: 'ai', path: '/ai', label: 'AI hodisalar', icon: 'ai' },
    { id: 'approvals', path: '/approvals', label: 'Tasdiqlashlar', icon: 'check', native: true },
    { id: 'audit', path: '/audit', label: 'Audit jurnali', icon: 'audit', native: true },
    { id: 'sroklar', path: '/sroklar', label: 'Muddatlar', icon: 'expire' },
    { group: 'Ma’lumotnoma' },
    { id: 'suppliers', path: '/suppliers', label: 'Ta’minotchilar', icon: 'truck' },
    { id: 'doctors', path: '/doctors', label: 'Shifokorlar', icon: 'doctor' },
    { id: 'reports', path: '/reports', label: 'Hisobotlar', icon: 'report' },
    { id: 'analytics', path: '/analytics', label: 'Analitika', icon: 'chart' }
  ];
  var FOOT = [
    { id: 'notifications', path: '/notifications', label: 'Bildirishnomalar', icon: 'bell', native: true },
    { id: 'settings', path: '/settings', label: 'Sozlamalar', icon: 'gear' }
  ];
  var ROUTES = {}, ALL = [];
  function renderNav() {
    var host = clear($('navlist')), foot = clear($('navfoot')), g = 'Apteka 360';
    function item(it, parent) {
      it.group_label = g; ROUTES[it.id] = it; ALL.push(it);
      var b = h('button', { class: 'nav-item', title: it.label, onclick: function () { go(it.id); } },
        icon(it.icon), h('span', { class: 'lbl', text: it.label }),
        it.native ? null : icon('ext', 'ext'));
      if (it.id === 'notifications') { it.badge = h('span', { class: 'badge', style: { display: 'none' } }); b.insertBefore(it.badge, b.lastChild && b.lastChild.nodeName === 'svg' && !it.native ? b.lastChild : null); }
      it.el = b; parent.appendChild(b);
    }
    NAV.forEach(function (it) { if (it.group) { g = it.group; host.appendChild(h('div', { class: 'nav-group', text: it.group })); } else item(it, host); });
    g = 'Tizim'; FOOT.forEach(function (it) { item(it, foot); });
  }
  function routeOfPath(path) {
    var found = null;
    ALL.forEach(function (it) { if (path === it.path || path.indexOf(it.path + '/') === 0 || (it.alias || []).indexOf(path) >= 0) { if (!found || it.path.length > found.path.length) found = it; } });
    return found;
  }

  // ───────────── Holat ─────────────
  var S = { online: null, authed: false, me: null, route: null, params: null, mode: 'native', hist: [], fwd: [], branches: null, panelVisible: null, panelPath: '', loginShown: false, compact: true, prefs: { autostart: false, close_to_tray: true } };
  try { S.compact = localStorage.getItem('panel-compact') !== '0'; } catch (e) {}

  // ───────────── Panel (child-webview) joylashuvi ─────────────
  function layout() {
    var r = $('content').getBoundingClientRect();
    invoke('set_panel_bounds', { x: r.left, y: r.top, width: r.width, height: r.height }).catch(function () {});
  }
  function showPanel(v) {
    if (S.panelVisible === v) return; S.panelVisible = v;
    invoke('set_panel_visible', { visible: v }).catch(function () {}); if (v) layout();
  }

  // ───────────── Overlay'lar ─────────────
  function overlay(id) {
    ['ov-loading', 'ov-offline', 'ov-login'].forEach(function (o) { $(o).classList.toggle('show', o === id); });
    document.body.classList.toggle('bare', id === 'ov-login' || (id === 'ov-loading' && !S.authed));
    if (id) showPanel(false); else if (S.mode === 'web') showPanel(true);
    layout();
  }

  // ───────────── API ─────────────
  var pending = {};
  function bridge(path, body) { // auth so'rovlari — panel webview konteksti (refresh-cookie)
    return new Promise(function (resolve, reject) {
      var id = 'r' + Date.now() + Math.random().toString(36).slice(2, 7);
      var t = setTimeout(function () { delete pending[id]; reject({ error: 'Server javob bermadi. Qayta urinib ko‘ring.', code: 'timeout' }); }, 20000);
      pending[id] = function (r) { clearTimeout(t); dbg('bridge ' + path + ' → ' + r.status + ' ' + (r.body && r.body.error ? r.body.error : '')); if (r.status >= 200 && r.status < 300) resolve(r.body || {}); else reject(r.body && r.body.error ? Object.assign({ status: r.status }, r.body) : { error: r.status ? 'Server xatosi: ' + r.status : 'Server bilan aloqa yo‘q', code: 'unavailable', status: r.status }); };
      invoke('panel_api', { id: id, path: path, body: body || {} }).catch(function (e) { clearTimeout(t); delete pending[id]; reject({ error: String(e), code: 'bridge' }); });
    });
  }
  var refreshing = null;
  function refresh() {
    refreshing = refreshing || bridge('/v1/auth/refresh', {}).catch(function (e) {
      if (e && e.status === 401) return new Promise(function (r) { setTimeout(r, 700); }).then(function () { return bridge('/v1/auth/refresh', {}); });
      throw e;
    }).then(function () {
      return new Promise(function (res) { var n = 0; (function wait() { invoke('has_token').then(function (ok) { if (ok || n++ > 10) res(ok); else setTimeout(wait, 100); }); })(); });
    }).catch(function () { return false; }).then(function (ok) { refreshing = null; return ok; });
    return refreshing;
  }
  function api(method, path, body, opts) {
    opts = opts || {};
    var idem = method === 'POST' ? (opts.idem || uuid()) : null;
    function once() { return invoke('api', { method: method, path: path, body: body == null ? null : body, idem: idem }); }
    return once().then(function (r) {
      if (r.status === 401) return refresh().then(function (ok) { if (!ok) { sessionLost(); throw { status: 401, error: 'Sessiya tugadi. Qaytadan kiring.', code: 'unauthorized' }; } return once(); });
      return r;
    }).then(function (r) {
      if (r.status >= 200 && r.status < 300) { markSync(); return r.body; }
      var b = r.body || {};
      if (r.status === 0) setConn(false, b.detail || b.error);
      throw { status: r.status, error: b.error || ('Server xatosi: ' + r.status), code: b.code || 'unavailable', details: b.details };
    });
  }
  function get(path) { return api('GET', path); }
  function cmd(name, body, opts) { return api('POST', '/v1/commands/' + name, body || {}, opts); }
  function markSync() { $('st-sync').textContent = 'Yangilandi ' + hhmm(); }
  function branchesCached() { if (S.branches) return Promise.resolve(S.branches); return get('/v1/branches').then(function (b) { S.branches = b; return b; }).catch(function () { return []; }); }
  function branchName(id) { var b = (S.branches || []).find(function (x) { return x.id === id; }); return b ? (b.short || b.name) : (id ? id : 'Tarmoq'); }

  // ───────────── Router ─────────────
  function go(id, params, opts) {
    opts = opts || {};
    var it = ROUTES[id]; if (!it) return;
    if (!opts.nohist && S.route && (S.route !== id || JSON.stringify(S.params) !== JSON.stringify(params || null))) { S.hist.push({ id: S.route, params: S.params }); S.fwd = []; }
    S.route = id; S.params = params || null;
    ALL.forEach(function (x) { x.el.classList.toggle('active', x === it); });
    $('crumb-group').textContent = it.group_label; $('crumb-page').textContent = it.label;
    $('back').disabled = !S.hist.length; $('fwd').disabled = !S.fwd.length;
    try { localStorage.setItem('last-route', id); } catch (e) {}
    if (it.native) {
      S.mode = 'native'; showPanel(false);
      render();
    } else {
      S.mode = 'web'; clear($('view'));
      invoke('panel_navigate', { path: it.path }).catch(function () {});
      document.body.classList.add('loading');
      showPanel(true);
    }
  }
  var renderSeq = 0;
  function render() {
    var it = ROUTES[S.route]; if (!it || !it.native) return;
    var seq = ++renderSeq, view = $('view');
    if (Apteka._dispose) { try { Apteka._dispose(); } catch (e) {} Apteka._dispose = null; }
    clear(view); view.scrollTop = 0;
    var page = h('div', { class: 'page' }); view.appendChild(page);
    var fn = Apteka.screens[it.id];
    if (!fn) { page.appendChild(h('div', { class: 'empty', text: 'Ekran topilmadi' })); return; }
    document.body.classList.add('loading');
    Promise.resolve(fn(page, S.params || {}, { isCurrent: function () { return seq === renderSeq; } })).catch(function (e) {
      if (seq !== renderSeq || (e && e.silent)) return;
      clear(page); page.appendChild(errorView(e));
    }).then(function () { if (seq === renderSeq) document.body.classList.remove('loading'); });
  }
  function errorView(e) {
    var code = e && e.code, st = e && e.status;
    if (code === 'module_disabled') return infobar('info', 'Modul yoqilmagan.', e.error);
    if (st === 403) return infobar('warn', 'Ruxsat yo‘q.', (e.error || 'Bu bo‘lim sizning rolingiz uchun yopiq.'));
    var box = h('div', null, infobar('crit', 'Ma’lumotni yuklab bo‘lmadi.', (e && e.error) || String(e)),
      h('button', { class: 'btn', onclick: render }, icon('refresh'), 'Qayta urinish'));
    return box;
  }
  function infobar(kind, title, text, action) {
    return h('div', { class: 'infobar ' + kind }, icon(kind === 'ok' ? 'ok' : kind === 'crit' ? 'crit' : kind === 'warn' ? 'warn' : 'info'),
      h('div', null, h('b', { text: title }), text || ''), action ? h('div', { class: 'act' }, action) : null);
  }
  function back() {
    if (S.mode === 'web' && !S.hist.length) { invoke('panel_back'); return; }
    var p = S.hist.pop(); if (!p) return; S.fwd.push({ id: S.route, params: S.params }); go(p.id, p.params, { nohist: true });
  }
  function forward() { var p = S.fwd.pop(); if (!p) return; S.hist.push({ id: S.route, params: S.params }); go(p.id, p.params, { nohist: true }); }

  // ───────────── Dialog / toast ─────────────
  function dialog(o) {
    return new Promise(function (resolve) {
      var dlg = clear($('dlg')), back = $('dlg-back');
      var body = h('div', { class: 'body' }, h('h2', { text: o.title }), o.body || null);
      var primary = h('button', { class: 'btn ' + (o.danger ? 'accent' : 'accent') }, o.primary || 'OK');
      var secondary = h('button', { class: 'btn' }, o.secondary || 'Bekor qilish');
      var foot = h('div', { class: 'foot' }, primary, o.secondary === false ? null : secondary);
      dlg.appendChild(body); dlg.appendChild(foot); back.classList.add('show');
      showPanel(false);
      function close(v) { back.classList.remove('show'); document.removeEventListener('keydown', key, true); if (S.mode === 'web' && S.authed) showPanel(true); resolve(v); }
      function key(e) { if (e.key === 'Escape') { e.preventDefault(); close(false); } }
      document.addEventListener('keydown', key, true);
      primary.onclick = function () {
        if (!o.onPrimary) return close(true);
        primary.disabled = true;
        Promise.resolve(o.onPrimary()).then(function (r) { if (r !== false) close(r === undefined ? true : r); else primary.disabled = false; })
          .catch(function () { primary.disabled = false; });
      };
      secondary.onclick = function () { close(false); };
      setTimeout(function () { var f = dlg.querySelector('input,textarea,select'); (f || primary).focus(); }, 30);
    });
  }
  function toast(kind, title, text) {
    var t = h('div', { class: 'toast ' + kind }, icon(kind === 'ok' ? 'ok' : kind === 'crit' ? 'crit' : 'info'), h('div', null, h('b', { text: title }), text ? h('div', { text: text }) : null));
    $('toasts').appendChild(t); setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 320); }, 4200);
  }

  // ───────────── Ulanish ─────────────
  var timer = null, left = 0;
  function setConn(ok, msg) {
    var was = S.online; S.online = ok;
    $('st-dot').className = 'dot ' + (ok ? 'ok' : 'crit'); $('st-conn').textContent = ok ? 'Serverga ulangan' : 'Aloqa yo‘q';
    if (ok) { clearInterval(timer); if (was === false) { overlay(S.authed ? null : (S.loginShown ? 'ov-login' : 'ov-loading')); if (S.authed && S.mode === 'native') render(); } }
    else { overlay('ov-offline'); $('err').textContent = msg ? 'Tafsilot: ' + msg : ''; left = 15; tick(); clearInterval(timer); timer = setInterval(tick, 1000); }
  }
  function tick() { $('countdown').textContent = left > 0 ? 'Avtomatik qayta urinish: ' + left + ' s' : ''; if (left-- <= 0) { clearInterval(timer); attempt(true); } }
  function attempt(reload) {
    clearInterval(timer);
    if (S.online === false) { overlay('ov-loading'); $('ov-loading-t').textContent = 'Serverga ulanmoqda…'; }
    dbg('attempt');
    return invoke('check_online').then(function (ok) { dbg('check_online=' + ok);
      if (!ok) return setConn(false, 'server javob bermadi');
      var was = S.online; setConn(true);
      if (was !== true && reload) invoke('panel_reload');
      else if (was !== true) {
        if (S.panelPath) resolveSession();
        else setTimeout(function () { if (!S.panelPath) probeSession(); }, 1500); // panel hodisasi qobiqdan oldin kelgan bo'lishi mumkin
      }
    }).catch(function (e) { setConn(false, String(e && e.message || e)); });
  }

  // ───────────── Sessiya ─────────────
  function onAuthed() {
    dbg('onAuthed');
    if (S.authed) return; S.authed = true; S.loginShown = false;
    overlay('ov-loading'); $('ov-loading-t').textContent = 'Ma’lumotlar yuklanmoqda…';
    Promise.all([get('/v1/me'), branchesCached()]).then(function (r) {
      S.me = r[0]; paintAccount();
      overlay(null);
      var last = 'dashboard'; try { last = localStorage.getItem('last-route') || 'dashboard'; } catch (e) {}
      var act = null;
      if (Apteka.info && Apteka.info.selftest_route) { var sp = Apteka.info.selftest_route.split('#'); last = sp[0]; act = sp[1] || null; }
      if (act) setTimeout(function () { // diagnostika: berilgan matnli tugmani bosish (masalan approvals#Tasdiqlash)
        var confirm = /!$/.test(act); act = act.replace(/!$/, '').replace(/_/g, ' ');
        if (act === 'Kassani yopish') document.querySelectorAll('#view .cash-row input').forEach(function (i, n) { i.value = ['18 400 000', '22 340 000', '5 060 000'][n]; i.dispatchEvent(new Event('input')); }), (document.querySelector('#view textarea') || {}).value = 'Qayta sanoq (sinov)';
        var b = Array.prototype.find.call(document.querySelectorAll('#view button'), function (x) { return x.textContent.trim() === act; });
        dbg('selftest act "' + act + '" found=' + !!b); if (b) b.click();
        if (confirm) setTimeout(function () { var p = document.querySelector('#dlg .foot .btn.accent'); dbg('selftest confirm ' + !!p); if (p) p.click(); }, 1200);
      }, 4000);
      if (!ROUTES[last] || !ROUTES[last].native) last = 'dashboard';
      S.hist = []; S.fwd = []; S.route = null;
      go(last, null, { nohist: true });
      pollBadges();
    }).catch(function (e) {
      S.authed = false;
      if (e && e.status === 401) return showLogin();
      overlay('ov-loading'); $('ov-loading-t').textContent = (e && e.error) || 'Xatolik';
      setTimeout(function () { refresh().then(function (ok) { if (ok) onAuthed(); else showLogin(); }); }, 2000);
    });
  }
  // Panel qaysi sahifada ekaniga qarab sessiya holatini aniqlash (panel hodisasi va ulanish tiklanganda chaqiriladi)
  var resolveT = null;
  function resolveSession(path) {
    path = path || S.panelPath; if (!path || S.online !== true) return;
    var isLogin = path === '/login' || path.indexOf('/login/') === 0;
    clearTimeout(resolveT);
    if (isLogin) {
      // Panel kirish sahifasida: sessiya yo'q (yoki tugagan) → native kirish
      resolveT = setTimeout(function () { if (S.panelPath === path) invoke('has_token').then(function (ok) { if (!ok) sessionLost(); else if (!S.authed) onAuthed(); }); }, 600);
    } else if (!S.authed) {
      resolveT = setTimeout(function () { invoke('has_token').then(function (ok) { if (ok) onAuthed(); else refresh().then(function (k) { if (k) onAuthed(); else showLogin(); }); }); }, 800);
    }
  }
  function probeSession() {
    if (S.authed || S.loginShown || S.online !== true) return;
    invoke('has_token').then(function (ok) { if (ok) onAuthed(); else refresh().then(function (k) { if (k) onAuthed(); else if (!S.authed) showLogin(); }); });
  }
  function sessionLost() { if (!S.authed && S.loginShown) return; S.authed = false; S.me = null; S.mode = 'native'; showLogin(); }
  function showLogin() { dbg('showLogin'); S.loginShown = true; S.authed = false; clear($('view')); overlay('ov-login'); L.reset(); }
  function paintAccount() {
    var m = S.me || {};
    $('acct-av').textContent = m.ini || initials(m.name); $('acct-name').textContent = m.name || '—';
    $('acct-role').textContent = [m.title, m.branchId ? branchName(m.branchId) : (m.scope === 'all' ? 'Butun tarmoq' : '')].filter(Boolean).join(' · ');
  }
  function logout() {
    dialog({ title: 'Hisobdan chiqish', body: h('p', { class: 'note', text: 'Ushbu kompyuterdagi sessiya yakunlanadi. Keyingi safar qaytadan kirishingiz kerak bo‘ladi.' }), primary: 'Chiqish' })
      .then(function (yes) {
        if (!yes) return;
        bridge('/v1/auth/logout', {}).catch(function () {}).then(function () {
          invoke('report_token', { token: null }).catch(function () {});
          S.authed = false; S.me = null; S.mode = 'native';
          invoke('panel_navigate', { path: '/login' }).catch(function () {});
          showLogin();
        });
      });
  }
  var badgeTimer = null;
  function pollBadges() {
    clearTimeout(badgeTimer);
    if (!S.authed) return;
    get('/v1/notifications').then(function (list) {
      var n = (list || []).filter(function (x) { return !x.readByMe && !x.read; }).length, b = ROUTES.notifications.badge;
      b.textContent = n > 99 ? '99+' : String(n); b.style.display = n ? '' : 'none';
    }).catch(function () {}).then(function () { badgeTimer = setTimeout(pollBadges, 60000); });
  }

  // ───────────── Native login ─────────────
  function deviceId() { try { var id = localStorage.getItem('a360-device-id'); if (!id) { id = uuid(); localStorage.setItem('a360-device-id', id); } return id; } catch (e) { return 'desktop'; } }
  var L = (function () {
    var challenge = null, device = null, resendAt = 0, timerR = null;
    function step(id) {
      ['s-creds', 's-otp', 's-device', 's-forgot', 's-reset'].forEach(function (s) { $(s).classList.toggle('show', s === id); });
      var f = { 's-creds': 'f-login', 's-otp': 'f-otp', 's-forgot': 'f-flogin', 's-reset': 'f-rcode' }[id]; if (f) setTimeout(function () { $(f).focus(); }, 50);
    }
    function busy(b) { $('login-box').classList.toggle('busy', b); }
    function err(id, msg) { $(id).textContent = msg || ''; }
    function fail(e) { return (e && e.error) || (e && e.message) || String(e); }
    function startResend(sec) {
      resendAt = Date.now() + sec * 1000; clearInterval(timerR);
      function paint() { var l = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)), t = l > 0 ? 'Kodni qayta yuborish (' + l + ' s)' : 'Kodni qayta yuborish'; $('a-resend').textContent = t; $('a-resend2').textContent = t; if (l <= 0) clearInterval(timerR); }
      paint(); timerR = setInterval(paint, 1000);
    }
    function reset() { challenge = null; device = null; ['e-creds', 'e-otp', 'e-device', 'e-forgot', 'e-reset'].forEach(function (i) { err(i); }); $('f-pass').value = ''; $('f-otp').value = ''; busy(false); step('s-creds'); }
    function done() {
      busy(false);
      invoke('panel_navigate', { path: '/dashboard' }).catch(function () {});
      var n = 0; (function wait() { invoke('has_token').then(function (ok) { if (ok) onAuthed(); else if (n++ < 30) setTimeout(wait, 100); else refresh().then(function (k) { if (k) onAuthed(); else { reset(); err('e-creds', 'Sessiyani ochib bo‘lmadi. Qayta urinib ko‘ring.'); } }); }); })();
    }
    $('b-login').onclick = function () {
      var login = $('f-login').value.trim(), pass = $('f-pass').value;
      if (!login || !pass) { err('e-creds', 'Login va parolni kiriting.'); return; }
      err('e-creds'); busy(true);
      bridge('/v1/auth/login', { login: login, password: pass }).then(function (r) {
        challenge = r.challengeId; busy(false); $('f-otp').value = ''; err('e-otp'); startResend(r.resendInSec || 60); step('s-otp');
      }).catch(function (e) { busy(false); err('e-creds', fail(e)); });
    };
    $('b-otp').onclick = function () {
      var code = $('f-otp').value.replace(/\D/g, ''); if (code.length !== 6) { err('e-otp', '6 xonali kodni kiriting.'); return; }
      err('e-otp'); busy(true);
      bridge('/v1/auth/otp', { challengeId: challenge, code: code, deviceId: $('f-remember').checked ? deviceId() : ('tmp-' + uuid()) }).then(function (r) {
        if (r.newDevice) { device = r.newDevice; $('d-device').textContent = device.device || ''; $('d-loc').textContent = device.location || ''; $('d-ip').textContent = device.ip || ''; busy(false); step('s-device'); }
        else done();
      }).catch(function (e) { busy(false); err('e-otp', fail(e)); if (e && e.details && e.details.attemptsLeft === 0) { step('s-creds'); err('e-creds', fail(e)); } });
    };
    $('b-trust').onclick = function () { busy(true); bridge('/v1/auth/device', { confirmId: device.confirmId, decision: 'trust' }).then(done).catch(function (e) { busy(false); err('e-device', fail(e)); }); };
    $('b-block').onclick = function () { busy(true); bridge('/v1/auth/device', { confirmId: device.confirmId, decision: 'block' }).catch(function () {}).then(function () { reset(); err('e-creds', 'Qurilma bloklandi. Agar bu siz bo‘lmasangiz, parolni o‘zgartiring.'); }); };
    function resend() { if (Date.now() < resendAt || !challenge) return; busy(true); bridge('/v1/auth/otp/resend', { challengeId: challenge }).then(function (r) { busy(false); startResend(r.resendInSec || 60); }).catch(function (e) { busy(false); err($('s-otp').classList.contains('show') ? 'e-otp' : 'e-reset', fail(e)); if (e && e.details && e.details.resendInSec) startResend(e.details.resendInSec); }); }
    $('a-resend').onclick = resend; $('a-resend2').onclick = resend;
    $('a-forgot').onclick = function () { $('f-flogin').value = $('f-login').value; err('e-forgot'); step('s-forgot'); };
    $('a-back1').onclick = reset; $('a-back2').onclick = reset; $('a-back3').onclick = function () { step('s-forgot'); };
    $('b-forgot').onclick = function () {
      var login = $('f-flogin').value.trim(); if (!login) { err('e-forgot', 'Telefon yoki e-pochtani kiriting.'); return; }
      busy(true); bridge('/v1/auth/password/forgot', { login: login }).then(function (r) { challenge = r.challengeId; busy(false); startResend(r.resendInSec || 60); step('s-reset'); }).catch(function (e) { busy(false); err('e-forgot', fail(e)); });
    };
    $('b-reset').onclick = function () {
      var code = $('f-rcode').value.trim(), p1 = $('f-pw1').value, p2 = $('f-pw2').value;
      if (code.length !== 6) { err('e-reset', '6 xonali kodni kiriting.'); return; }
      if (p1.length < 8) { err('e-reset', 'Parol kamida 8 ta belgidan iborat bo‘lsin.'); return; }
      if (p1 !== p2) { err('e-reset', 'Parollar mos emas.'); return; }
      busy(true); bridge('/v1/auth/password/reset', { challengeId: challenge, code: code, password: p1 }).then(function () { reset(); $('f-login').value = $('f-flogin').value; err('e-creds', 'Parol o‘zgartirildi. Yangi parol bilan kiring.'); }).catch(function (e) { busy(false); err('e-reset', fail(e)); });
    };
    ['f-login', 'f-pass'].forEach(function (i) { $(i).addEventListener('keydown', function (e) { if (e.key === 'Enter') $('b-login').click(); }); });
    $('f-otp').addEventListener('input', function () { this.value = this.value.replace(/\D/g, '').slice(0, 6); if (this.value.length === 6) $('b-otp').click(); });
    $('f-otp').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('b-otp').click(); });
    ['f-rcode', 'f-pw1', 'f-pw2'].forEach(function (i) { $(i).addEventListener('keydown', function (e) { if (e.key === 'Enter') $('b-reset').click(); }); });
    $('f-flogin').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('b-forgot').click(); });
    return { reset: reset, step: step, fill: function (l, p) { $('f-login').value = l; $('f-pass').value = p; } };
  })();

  // ───────────── Start ─────────────
  function start() {
    $('burger').appendChild(icon('menu', 'lg')); $('nav-q-i').appendChild(icon('search'));
    $('back').appendChild(icon('left')); $('fwd').appendChild(icon('right')); $('reload').appendChild(icon('refresh'));
    $('fs').appendChild(icon('full')); $('more').appendChild(icon('more', 'lg'));
    renderNav();
    try { if (localStorage.getItem('nav-compact') === '1') document.body.classList.add('nav-compact'); } catch (e) {}

    $('burger').onclick = function () { document.body.classList.toggle('nav-compact'); try { localStorage.setItem('nav-compact', document.body.classList.contains('nav-compact') ? '1' : '0'); } catch (e) {} };
    $('nav-q').addEventListener('input', function () {
      var q = this.value.trim().toLowerCase();
      ALL.forEach(function (it) { it.el.classList.toggle('hidden', !!q && it.label.toLowerCase().indexOf(q) < 0); });
      document.querySelectorAll('.nav-group').forEach(function (g) { g.style.display = q ? 'none' : ''; });
    });
    $('nav-q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { var f = ALL.find(function (it) { return !it.el.classList.contains('hidden'); }); if (f) { go(f.id); this.value = ''; this.dispatchEvent(new Event('input')); } } });
    $('acct').onclick = function () { var r = this.getBoundingClientRect(); invoke('show_more_menu', { x: r.left + 8, y: r.bottom, compact: S.compact }); };
    $('back').onclick = back; $('fwd').onclick = forward;
    $('reload').onclick = function () { if (S.mode === 'web') invoke('panel_reload'); else render(); };
    $('fs').onclick = function () { invoke('toggle_fullscreen'); };
    $('zoom').onclick = function () { invoke('zoom_step', { delta: 0 }); };
    $('more').onclick = function () { var r = this.getBoundingClientRect(); invoke('show_more_menu', { x: r.left, y: r.bottom + 2, compact: S.compact }); };
    $('retry').onclick = function () { attempt(true); };
    new ResizeObserver(layout).observe($('content'));
    window.addEventListener('resize', layout);
    window.addEventListener('online', function () { attempt(true); });
    window.addEventListener('offline', function () { setConn(false, 'tarmoq uzildi'); });
    window.addEventListener('keydown', function (e) {
      var c = e.ctrlKey || e.metaKey, k = e.key;
      if (c && (k === 'b' || k === 'B')) { e.preventDefault(); $('burger').click(); }
      else if (c && (k === 'q' || k === 'Q')) { e.preventDefault(); invoke('quit_app'); }
      else if (c && (k === 'f' || k === 'F') && !document.body.classList.contains('bare')) { e.preventDefault(); $('nav-q').focus(); }
      else if (e.altKey && k === 'Home') { e.preventDefault(); if (S.authed) go('dashboard'); }
      else if (e.altKey && k === 'ArrowLeft') { e.preventDefault(); back(); }
      else if (e.altKey && k === 'ArrowRight') { e.preventDefault(); forward(); }
      else if (k === 'F5' || (c && (k === 'r' || k === 'R'))) { e.preventDefault(); $('reload').click(); }
    }, true);

    if (ev) {
      ev.listen('panel', function (e) {
        var p = e.payload || {}, path = '/'; dbg('panel ' + p.kind + ' ' + p.url + ' authed=' + S.authed + ' online=' + S.online);
        try { path = new URL(p.url).pathname; } catch (x) {}
        S.panelPath = path;
        var isLogin = path === '/login' || path.indexOf('/login/') === 0;
        if (p.kind === 'navigate' || p.kind === 'started') { if (S.mode === 'web') document.body.classList.add('loading'); }
        if (p.kind === 'finished') {
          if (S.mode === 'web') {
            document.body.classList.remove('loading');
            var it = routeOfPath(path);
            if (it && !isLogin) { ALL.forEach(function (x) { x.el.classList.toggle('active', x === it); }); $('crumb-group').textContent = it.group_label; $('crumb-page').textContent = it.label; }
            if (!S.compact) invoke('panel_eval_compact', { on: false }).catch(function () {});
          }
          resolveSession(path);
        }
      });
      ev.listen('token', function (e) {
        // Panel o'zi sessiyani tiklasa (token keldi) — kirish ekrani ochiq bo'lsa ham, foydalanuvchi hali kod kiritmagan bo'lsa davom etamiz
        if (e.payload === true && !S.authed && S.online === true && !$('login-box').classList.contains('busy') && !$('s-otp').classList.contains('show') && !$('s-device').classList.contains('show')) onAuthed();
        if (e.payload === false && S.authed) sessionLost();
      });
      ev.listen('network', function (e) { if (e.payload === false) setConn(false, 'tarmoq uzildi'); else attempt(true); });
      ev.listen('zoom', function (e) { $('zoom').textContent = Math.round(e.payload) + '%'; });
      ev.listen('prefs', function (e) { S.prefs = e.payload || S.prefs; });
      ev.listen('api', function (e) { var r = e.payload || {}; var cb = pending[r.id]; if (cb) { delete pending[r.id]; cb(r); } });
      ev.listen('menu', function (e) {
        if (e.payload === 'compact') { S.compact = !S.compact; try { localStorage.setItem('panel-compact', S.compact ? '1' : '0'); } catch (x) {} invoke('panel_eval_compact', { on: S.compact }).catch(function () {}); }
        if (e.payload === 'logout') { if (S.authed) logout(); }
        if (e.payload === 'native-home') { if (S.authed) go('dashboard'); }
      });
    }
    invoke('get_prefs').then(function (p) { S.prefs = p; }).catch(function () {});
    invoke('get_client_info').then(function (i) {
      $('st-host').textContent = i.hostname; $('st-ver').textContent = 'v' + i.version; $('login-foot').textContent = 'Apteka 360 Desktop v' + i.version + '  ·  ' + i.hostname;
      try { $('st-server').textContent = new URL(i.api_url).host; } catch (e) {}
      Apteka.info = i;
      if (i.selftest) selftest();
    }).catch(function () {});
    function clock() { var d = new Date(); $('st-clock').textContent = ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear() + '  ' + hhmm(d); }
    clock(); setInterval(clock, 15000);

    dbg('start ok, tauri=' + !!core + ' ev=' + !!ev);
    showPanel(false); overlay('ov-loading'); layout(); attempt(false);
    // Panel hech qanday sahifa yuklamasa (masalan, server sekin) — 8 s dan keyin sessiyani o'zimiz tekshiramiz
    setTimeout(probeSession, 8000);
  }

  // Diagnostika: APTEKA_SELFTEST=1 — lokal dev API bilan login → OTP 123456 → qurilma → ekranlarni aylanib chiqish
  function selftest() {
    var steps = (Apteka.info && Apteka.info.selftest_route) || '';
    var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    (function loop(n) {
      if (S.loginShown && $('s-creds').classList.contains('show')) {
        L.fill('owner@apteka360.uz', 'x'); $('b-login').click();
        wait(1500).then(function () { $('f-otp').value = '123456'; $('b-otp').click(); return wait(1500); })
          .then(function () { if ($('s-device').classList.contains('show')) $('b-trust').click(); });
        return;
      }
      if (!S.authed && n < 60) setTimeout(function () { loop(n + 1); }, 500);
    })(0);
  }

  window.Apteka = {
    start: start, h: h, add: add, clear: clear, icon: icon, invoke: invoke, api: api, get: get, cmd: cmd,
    money: money, moneyShort: moneyShort, num: num, pct: pct, initials: initials, uuid: uuid, longDate: longDate, hhmm: hhmm,
    infobar: infobar, errorView: errorView, dialog: dialog, toast: toast, go: go, render: render, branchesCached: branchesCached, branchName: branchName,
    state: S, routes: ROUTES, screens: {}, _dispose: null
  };
})();
