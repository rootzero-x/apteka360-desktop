/* Apteka 360 Desktop — HR ekranlari: Xodimlar, Xodim, Ish grafigi, Davomat, Oylik vedomosti, Oylik shablonlari.
 * Web manbalari: screens/Employees.tsx, DataForms.tsx, HrAi.tsx, Payroll.tsx, RulesApi.tsx (uz i18n matnlari). */
(function () {
  'use strict';
  var A = window.Apteka, h = A.h, U = A.ui, icon = A.icon, clear = A.clear;

  // 'employee' navigatsiyada yo'q — shell marshrut jadvaliga qo'shamiz.
  if (!A.routes.employee) { A.routes.employee = { id: 'employee', path: '/employees', label: 'Xodim', icon: 'user', group_label: 'HR', native: true, el: document.createElement('div') }; }

  // ───────────── Umumiy ─────────────
  function role() { return A.role() || ''; }
  function inRoles(list) { return list.indexOf(role()) >= 0; }
  function canSal() { return inRoles(['OWNER', 'FINANCE', 'MANAGER', 'AUDITOR']); }
  function canEditEmp() { return !A.readOnly() && inRoles(['OWNER', 'SUPER_ADMIN', 'HR', 'MANAGER']); }
  function canDecideSwap() { return !A.readOnly() && inRoles(['OWNER', 'MANAGER', 'HR']); }
  function canSched() { return !A.readOnly() && inRoles(['OWNER', 'MANAGER', 'HR']); }
  var MASK = '•• ••• •••';
  var DISMISSED = 'dismissed';
  var EMP_ST = { 'ishda': 'ok', 'tanaffus': 'info', 'kech qoldi': 'warn', 'kasal': 'warn', 'ta’til': 'mute', 'smena yo‘q': 'mute', dismissed: 'crit' };
  function stLabel(s) { return s === DISMISSED ? 'ishdan bo‘shagan' : s; }
  function stPill(s) { return U.pill(EMP_ST[s] || 'mute', stLabel(s)); }
  function fmt(n) { return n == null ? MASK : A.num(Math.round(n)); }
  function fmtS(n) { return n == null ? MASK + ' so‘m' : A.money(Math.round(n)); }
  function fmtDec(n) { return n == null ? '—' : String(Math.round(n * 100) / 100).replace('.', ','); }
  function fmtHm(min) { min = Math.round(min || 0); var hh = Math.floor(min / 60), mm = min % 60; return hh ? hh + ' s ' + (mm ? mm + ' daq' : '') : mm + ' daq'; }
  function shortName(n) { return String(n || '').replace(/-filial$/i, '').replace(/ filiali$/i, ''); }
  function errText(e) { return (e && (e.error || e.message)) || String(e); }
  function openEmp(id) { if (A.can('employee')) A.go('employee', { id: id }); else A.go('employees', { id: id }); }
  function avatar(e, big) { return h('span', { class: 'avatar' + (big ? '' : ' sm'), text: e.ini || A.initials(e.name), style: big ? { width: '64px', height: '64px', fontSize: '22px' } : null }); }
  function loadEmployees() { return A.get('/v1/employees?includeDismissed=1'); }
  function soft(p, dflt) { return p.catch(function () { return dflt; }); }
  function parseNum(v) { var s = String(v || '').replace(/[\s  ]/g, '').replace(',', '.'); if (!s) return undefined; var n = Number(s); return isFinite(n) ? n : NaN; }

  // Kun bo'yicha davomat belgisi (web: attendanceMark — prototip qoidasi, API'da kunlik davomat endpointi yo'q)
  function attendanceMark(e, d) {
    var sch = e.schedule || '';
    var work = sch.indexOf('5/2') === 0 ? [3, 4].indexOf((d + 2) % 7) < 0 : sch.indexOf('1/2') === 0 ? d % 3 === 1 : d % 4 < 2;
    if (d > 8) return work ? '' : '·';
    var st = work ? 'V' : '·';
    if (work && e.status === 'ta’til' && d >= 6) st = 'T';
    if (work && e.status === 'kasal' && d >= 5) st = 'B';
    if (work && st === 'V' && e.late && (d * 7 + e.late) % 5 === 0) st = 'K';
    if (work && st === 'V' && e.attendance < 90 && d === 2) st = 'Y';
    return st;
  }
  var MARK = { V: ['var(--ok-bg)', 'var(--ok)'], K: ['var(--warn-bg)', 'var(--warn)'], Y: ['var(--crit-bg)', 'var(--crit)'], T: ['var(--info-bg)', 'var(--info)'], B: ['var(--info-bg)', 'var(--info)'], '·': ['var(--layer-sub)', 'var(--text-3)'], '': ['transparent', 'var(--text-3)'] };
  var LEGEND = ['V — vaqtida', 'K — kechikdi', 'Y — kelmagan', 'T — ta’til', 'B — kasal', '· — dam olish'];

  // ───────────── Xodim formasi (employees.upsert) ─────────────
  function empForm(e, lockBranch) {
    var salaryHidden = !!e && e.oklad == null;
    var brs = (A.state.branches || []).filter(function (b) { return !lockBranch || b.id === lockBranch; });
    var init = e ? { name: e.name, position: e.position, branchId: e.branchId, phone: e.phone, oklad: e.oklad, coef: e.coef, schedule: e.schedule, hired: e.hired, fomLogin: e.fomLogin, contract: e.contract }
      : { branchId: lockBranch || (brs[0] && brs[0].id) || '', coef: '1', position: 'Farmatsevt', schedule: '2/2 · 08:00–20:00' };
    var F = {};
    function inp(k, opts) { F[k] = U.input(Object.assign({ value: init[k] != null ? String(init[k]) : '' }, opts || {})); return F[k]; }
    var bsel = h('select', { class: 'tb' }); brs.forEach(function (b) { var o = h('option', { value: b.id, text: b.name }); if (b.id === init.branchId) o.selected = true; bsel.appendChild(o); }); F.branchId = bsel;
    var er = h('div', { class: 'err' });
    var grid = h('div', { class: 'form-grid' },
      h('div', { style: { gridColumn: '1 / -1' } }, U.field('F.I.Sh. *', inp('name'))),
      U.field('Lavozim', inp('position')), U.field('Filial', bsel),
      U.field('Telefon', inp('phone', { placeholder: '+998 90 123 45 67' })),
      salaryHidden ? null : U.field('Oklad *', inp('oklad', { num: true, attrs: { inputmode: 'decimal' } })),
      salaryHidden ? null : U.field('Koeffitsient', inp('coef', { num: true, attrs: { inputmode: 'decimal' } })),
      U.field('Ish grafigi', inp('schedule')), U.field('Ishga kirgan', inp('hired', { placeholder: '2026-yil oktabr' })),
      U.field('FOM login', inp('fomLogin')), U.field('Shartnoma', inp('contract')));
    var body = h('div', { style: { minWidth: '560px' } }, salaryHidden ? A.infobar('info', 'Oylik maydonlari yashirin.', 'Sizning rolingiz oylikni ko‘rmaydi — oklad va koeffitsient o‘zgarmaydi.') : null, grid, er);
    return A.dialog({ title: e ? 'Xodimni tahrirlash' : 'Xodim qo‘shish', body: body, primary: 'Saqlash', onPrimary: function () {
      er.textContent = '';
      var out = {}, bad = null;
      Object.keys(F).forEach(function (k) {
        var raw = String(F[k].value || '').trim(); if (!raw) return;
        if (k === 'oklad' || k === 'coef') { var n = parseNum(raw); if (isNaN(n)) bad = k; out[k] = n; } else out[k] = raw;
      });
      if (!out.name) { er.textContent = 'F.I.Sh. majburiy.'; return false; }
      if (!out.branchId) { er.textContent = 'Filialni tanlang.'; return false; }
      if (!salaryHidden && out.oklad == null) { er.textContent = 'Oklad majburiy.'; return false; }
      if (bad) { er.textContent = (bad === 'oklad' ? 'Oklad' : 'Koeffitsient') + ' — son kiriting.'; return false; }
      if (e) out.id = e.id;
      return A.cmd('employees.upsert', out).then(function (r) { A.toast('ok', '«' + ((r && r.name) || out.name) + '» saqlandi'); return r || true; })
        .catch(function (x) { er.textContent = errText(x); return false; });
    } });
  }
  function dismissDialog(e) {
    var d = U.input({ type: 'date', value: U.isoDay(0) }), r = h('textarea', { class: 'tb', placeholder: 'Masalan: o‘z xohishiga ko‘ra ariza' }), er = h('div', { class: 'err' });
    return A.dialog({ title: 'Ishdan bo‘shatish', primary: 'Ishdan bo‘shatish', danger: true,
      body: h('div', null, h('p', { class: 'note', text: e.name + ' — holati «ishdan bo‘shagan» bo‘ladi. Bog‘langan foydalanuvchi hisobi bloklanadi, sessiyalari va Telegram bog‘lanishi o‘chiriladi (tiklashda qaytariladi). Tarix saqlanadi.' }),
        U.field('Sana', d), U.field('Sabab (≥ 3 belgi)', r), er),
      onPrimary: function () {
        var reason = r.value.trim(); if (reason.length < 3) { er.textContent = 'Sabab kamida 3 belgi bo‘lsin.'; return false; }
        if (!d.value) { er.textContent = 'Sanani tanlang.'; return false; }
        return A.cmd('employees.dismiss', { id: e.id, date: d.value, reason: reason }).then(function () { A.toast('ok', e.name + ' ishdan bo‘shatildi'); return true; })
          .catch(function (x) { er.textContent = errText(x); return false; });
      } });
  }
  function restoreDialog(e) {
    var r = h('textarea', { class: 'tb', placeholder: 'Masalan: qayta ishga qabul' }), er = h('div', { class: 'err' });
    return A.dialog({ title: 'Xodimni tiklash', primary: 'Tiklash',
      body: h('div', null, h('p', { class: 'note', text: e.name + ' — holati «smena yo‘q» bo‘ladi va bo‘shatishda bloklangan hisob qayta faollashadi.' }), U.field('Sabab (≥ 3 belgi)', r), er),
      onPrimary: function () {
        var reason = r.value.trim(); if (reason.length < 3) { er.textContent = 'Sabab kamida 3 belgi bo‘lsin.'; return false; }
        return A.cmd('employees.restore', { id: e.id, reason: reason }).then(function () { A.toast('ok', e.name + ' tiklandi'); return true; })
          .catch(function (x) { er.textContent = errText(x); return false; });
      } });
  }

  // ───────────── Import (data.import, kind: employees) ─────────────
  var COLS = [['name', 'F.I.Sh.'], ['position', 'Lavozim'], ['branch', 'Filial'], ['phone', 'Telefon'], ['oklad', 'Oklad'], ['coef', 'Koeffitsient'], ['schedule', 'Ish grafigi'], ['hired', 'Ishga kirgan'], ['fomLogin', 'FOM login'], ['contract', 'Shartnoma']];
  function norm(s) { return String(s).trim().toLowerCase().replace(/[‘’ʻʼ`']/g, '').replace(/[^a-z0-9а-яё]+/gi, ''); }
  function parseTable(text) {
    var src = text.replace(/^﻿/, ''), first = src.split(/\r?\n/, 1)[0] || '';
    var delim = first.indexOf('\t') >= 0 ? '\t' : ((first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',');
    var rows = [], row = [], cell = '', q = false;
    function pushRow() { row.push(cell); cell = ''; if (row.some(function (c) { return c.trim(); })) rows.push(row); row = []; }
    for (var i = 0; i < src.length; i++) {
      var ch = src[i];
      if (q) { if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
      else if (ch === '"' && cell === '') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; pushRow(); }
      else cell += ch;
    }
    pushRow();
    return rows;
  }
  function importDialog() {
    var ta = h('textarea', { class: 'tb mono', style: { minHeight: '140px', fontSize: '12px' }, placeholder: 'yoki jadvalni shu yerga qo‘ying' });
    var file = h('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv', style: { display: 'none' } });
    var info = h('div'), er = h('div', { class: 'err' }), parsed = { rows: [] };
    function parse() {
      clear(info); er.textContent = '';
      var table = parseTable(ta.value), brs = A.state.branches || [];
      parsed = { rows: [] };
      if (table.length < 2) { if (ta.value.trim()) info.appendChild(A.infobar('warn', 'Faylda ma’lumot topilmadi', '')); return; }
      var header = table[0].map(function (x) { var n = norm(x); var c = COLS.find(function (c) { return norm(c[0]) === n || norm(c[1]) === n || (c[0] === 'branch' && (n === 'branchid' || n === 'filialid')); }); return c ? c[0] : null; });
      var unknown = table[0].filter(function (_, i) { return header[i] === null && table[0][i].trim(); }), problems = [];
      parsed.rows = table.slice(1).map(function (r, n) {
        var o = {};
        header.forEach(function (k, i) {
          var v = (r[i] || '').trim(); if (!k || !v) return;
          if (k === 'branch') { var b = brs.find(function (x) { return x.id === v || norm(x.name) === norm(v) || norm(x.short || '') === norm(v); }); o.branchId = b ? b.id : v; if (!b) problems.push((n + 1) + '-qator: «' + v + '» filiali topilmadi'); }
          else o[k] = k === 'oklad' || k === 'coef' ? parseNum(v) : v;
        });
        return o;
      });
      if (unknown.length) info.appendChild(h('div', { class: 'hint', style: { color: 'var(--warn)' }, text: 'Noma’lum ustunlar e’tiborsiz qoldiriladi: ' + unknown.join(', ') }));
      if (problems.length) info.appendChild(A.infobar('warn', 'Filial topilmadi', problems.slice(0, 5).join(' · ')));
      var keys = COLS.filter(function (c) { return header.indexOf(c[0]) >= 0; });
      info.appendChild(h('b', { text: 'Ko‘rib chiqish · ' + parsed.rows.length + ' qator', style: { display: 'block', margin: '8px 0 4px' } }));
      info.appendChild(h('div', { style: { maxHeight: '220px', overflow: 'auto' } }, U.table(keys.map(function (c) { return { t: c[1], render: function (r) { var v = r[c[0] === 'branch' ? 'branchId' : c[0]]; return v == null ? '' : String(v); } }; }), parsed.rows.slice(0, 50), { bare: true })));
    }
    ta.addEventListener('input', parse);
    file.addEventListener('change', function () { var f = file.files && file.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { ta.value = String(rd.result || ''); parse(); }; rd.readAsText(f, 'utf-8'); file.value = ''; });
    var tpl = COLS.map(function (c) { return c[1]; }).join(';') + '\n' + ['Malika Rasulova', 'Kassir', 'Chilonzor 12', '+998 90 123 45 67', '4000000', '1', '2/2 · 08:00–20:00', '2026-yil oktabr', 'kassir_mr', 'Mehnat shartnomasi · muddatsiz'].join(';');
    var body = h('div', { style: { width: '720px', maxWidth: '80vw' } },
      h('p', { class: 'note', text: 'CSV fayl yuklang (Excel: «Saqlash → CSV UTF-8») yoki jadvaldan nusxa olib qo‘ying. Ustun nomlari shablondagidek bo‘lsin.' }),
      h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: function () { file.click(); } }, icon('plus'), 'Fayl tanlash'),
        h('button', { class: 'btn subtle', onclick: function () { ta.value = tpl; parse(); } }, 'Shablonni qo‘yish'), file),
      ta, h('div', { class: 'hint', text: 'Mavjud yozuvlar ID yoki xodim F.I.Sh. + filial bo‘yicha topiladi va yangilanadi. Bitta xato bo‘lsa, hech narsa saqlanmaydi.' }), info, er);
    return A.dialog({ title: 'Xodimlarni import qilish', body: body, primary: 'Import qilish', onPrimary: function () {
      er.textContent = '';
      if (!parsed.rows.length) { er.textContent = 'Import uchun qator yo‘q.'; return false; }
      return A.cmd('data.import', { kind: 'employees', rows: parsed.rows }).then(function (r) { A.toast('ok', 'Import tugadi: ' + (r.created || 0) + ' ta yangi, ' + (r.updated || 0) + ' ta yangilandi'); return true; })
        .catch(function (x) {
          if (Array.isArray(x.details)) er.textContent = 'Xatolar — hech narsa saqlanmadi: ' + x.details.slice(0, 20).map(function (d) { return d.row + '-qator: ' + d.message; }).join(' · ');
          else er.textContent = errText(x);
          return false;
        });
    } });
  }

  // ═════════════ W05 Xodimlar ═════════════
  var FILTERS = [['all', 'Hammasi'], ['ishda', 'Ishda'], ['tanaffus', 'Tanaffusda'], ['smena yo‘q', 'Smena yo‘q'], ['ta’til', 'Ta’til / kasal'], ['risk', 'Xavf belgisi'], ['arxiv', 'Arxiv']];
  A.screens.employees = function (page, params, ctx) {
    if (params && params.id) return empDetail(page, params, ctx);
    return Promise.all([loadEmployees(), A.branchesCached()]).then(function (r) {
      U.guard(ctx);
      var all = r[0] || [], me = A.state.me || {}, sal = canSal();
      var multi = (A.state.branches || []).length > 1 && (me.scope === 'all' || (me.branchIds && me.branchIds.length > 1));
      var br = params.branch || '', filter = 'all', q = '';
      var host = h('div'), sub = h('div', { class: 'sub' }), foot = h('div', { class: 'hint', style: { marginTop: '8px' } });
      function paint() {
        clear(host);
        var empIn = all.filter(function (e) { return !br || e.branchId === br; });
        var active = empIn.filter(function (e) { return e.status !== DISMISSED; });
        var rows = (filter === 'arxiv' ? empIn.filter(function (e) { return e.status === DISMISSED; }) : active).filter(function (e) {
          return filter === 'all' || filter === 'arxiv' ? true : filter === 'risk' ? !!e.risk : filter === 'ta’til' ? (e.status === 'ta’til' || e.status === 'kasal') : e.status === filter;
        });
        if (q) rows = rows.filter(function (e) { return (e.name + ' ' + e.position + ' ' + (e.fomLogin || '') + ' ' + (e.phone || '')).toLowerCase().indexOf(q) >= 0; });
        sub.textContent = active.length + ' ta faol xodim · ' + (br ? A.branchName(br) : 'barcha filiallar');
        host.appendChild(U.table([
          { t: 'Xodim', render: function (e) { return h('div', { class: 'who' }, avatar(e), h('div', null, h('div', { style: { fontWeight: '600' }, text: e.name }), h('div', { class: 'muted', style: { fontSize: '12px' }, text: e.position || '' }))); } },
          { t: 'Filial', muted: true, render: function (e) { return shortName(A.branchName(e.branchId)); } },
          { t: 'Holat', render: function (e) { return stPill(e.status); } },
          { t: 'Grafik', muted: true, k: 'schedule' },
          { t: 'Davomat', r: true, render: function (e) { return e.attendance != null ? e.attendance + '%' : '—'; } },
          { t: 'Idle', r: true, render: function (e) { if (!e.idleLimit) return '—'; var p = Math.round(e.idleUsed / e.idleLimit * 100); return h('span', { text: p + '%', style: { color: p > 90 ? 'var(--crit)' : '' } }); } },
          { t: 'Joriy oylik', r: true, render: function (e) { return sal && e.net != null ? A.num(e.net) : h('span', { class: 'muted', text: MASK, style: { letterSpacing: '.06em' } }); } },
          { t: 'Belgi', render: function (e) { var v = e.risk || (e.docs && e.docs !== 'Hammasi amalda' ? e.docs : ''); return v ? h('span', { text: v, style: { color: 'var(--crit)', fontSize: '12px' } }) : ''; } }
        ], rows, { onRow: function (e) { openEmp(e.id); }, empty: 'Filtrga mos xodim topilmadi', emptyIcon: 'search' }));
        foot.textContent = rows.length + ' / ' + empIn.length + ' ko‘rsatilmoqda · Oylik ustuni ' + (sal ? 'ko‘rinadi (maxfiy ruxsat bor)' : 'yashirilgan — maxfiy ruxsat yo‘q') + (filter === 'arxiv' ? '' : ' · Ishdan bo‘shagan xodimlar «Arxiv» filtrida turadi.');
      }
      var lock = role() === 'MANAGER' ? me.branchId : null;
      var tools = [
        canEditEmp() ? h('button', { class: 'btn', onclick: function () { importDialog().then(function (ok) { if (ok) A.render(); }); } }, icon('report'), 'Import') : null,
        canEditEmp() ? h('button', { class: 'btn accent', onclick: function () { empForm(null, lock).then(function (x) { if (x && x.id) openEmp(x.id); else if (x) A.render(); }); } }, icon('plus'), 'Yangi xodim') : null,
        U.refreshBtn()];
      var hd = U.head('Xodimlar', null, tools); hd.firstChild.appendChild(sub);
      page.appendChild(hd);
      page.appendChild(h('div', { class: 'toolbar' },
        U.search('Ism, lavozim, FOM login…', function (v) { q = v.toLowerCase(); paint(); }, '280px'),
        multi ? U.select(U.branchOptions(true), br, function (v) { br = v; paint(); }, '190px') : null,
        U.seg(FILTERS, filter, function (v) { filter = v; paint(); })));
      page.appendChild(host); page.appendChild(foot);
      paint();
    });
  };

  // ═════════════ W06 Xodim ═════════════
  var TABS = [['umumiy', 'Umumiy'], ['davomat', 'Davomat va idle'], ['oylik', 'Oylik'], ['kpi', 'KPI'], ['jarima', 'Jarimalar va AI'], ['hujjat', 'Hujjatlar'], ['audit', 'Audit']];
  var AI_ST = { pending: ['warn', 'Tekshiruv kutilmoqda'], confirmed: ['crit', 'Tasdiqlangan'], rejected: ['mute', 'Rad etilgan'], disputed: ['info', 'E’tiroz'] };
  function kpiTier(p) { return p >= 100 ? 3 : p >= 80 ? 2 : 1; }
  function empDetail(page, params, ctx) {
    var id = params.id;
    return Promise.all([loadEmployees(), A.branchesCached(), soft(A.get('/v1/aiEvents'), null), soft(A.get('/v1/audit'), null)]).then(function (r) {
      U.guard(ctx);
      var e = (r[0] || []).find(function (x) { return x.id === id; });
      var back = h('button', { class: 'btn subtle', onclick: function () { A.go('employees'); } }, icon('left'), 'Xodimlar');
      if (!e) { page.appendChild(back); page.appendChild(U.card(null, null, U.empty('Xodim topilmadi', 'user'))); return; }
      var bn = A.branchName(e.branchId), aiEvents = r[2], audit = r[3];
      var evs = (aiEvents || []).filter(function (x) { return x.empId === e.id; });
      var sal = canSal(), dismissed = e.status === DISMISSED, shown = false;
      var lock = role() === 'MANAGER' ? e.branchId : null;
      function reload(x) { if (x) A.render(); }
      var acts = [];
      if (canEditEmp()) {
        acts.push(h('button', { class: 'btn', onclick: function () { empForm(e, lock).then(reload); } }, icon('gear'), 'Tahrirlash'));
        acts.push(dismissed ? h('button', { class: 'btn accent', onclick: function () { restoreDialog(e).then(reload); } }, icon('refresh'), 'Tiklash')
          : h('button', { class: 'btn danger', onclick: function () { dismissDialog(e).then(reload); } }, icon('close'), 'Ishdan bo‘shatish'));
      } else if (A.readOnly()) acts.push(U.ro(h('button', { class: 'btn' }, 'Tahrirlash')));
      page.appendChild(h('div', { style: { marginBottom: '8px' } }, back));
      page.appendChild(h('div', { class: 'card pad', style: { display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' } },
        avatar(e, true),
        h('div', { style: { flex: '1', minWidth: '240px' } },
          h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } }, h('h1', { text: e.name, style: { margin: '0', fontSize: '24px' } }), stPill(e.status), e.risk ? U.pill('warn', e.risk) : null),
          h('div', { class: 'muted', style: { marginTop: '4px' }, text: [e.position, bn, e.schedule].filter(Boolean).join(' · ') }),
          h('div', { class: 'muted', style: { fontSize: '12px', marginTop: '2px' } }, (e.phone || '—') + ' · FOM login: ', h('span', { class: 'mono', text: e.fomLogin || '—' }), ' · Ishga kirgan: ' + (e.hired || '—'))),
        h('div', { style: { display: 'flex', gap: '8px' } }, acts)));
      if (dismissed) page.appendChild(A.infobar('warn', 'Xodim ishdan bo‘shatilgan.', 'Ma’lumotlar tarix uchun saqlanadi. «Tiklash» xodimni va uning hisobini qaytaradi.'));
      var body = h('div', { style: { marginTop: '12px' } }), tab = params.tab || 'umumiy';
      page.appendChild(U.tabs(TABS, tab, function (t) { tab = t; paint(); }));
      page.appendChild(body);

      function block(title, rows) {
        var box = h('div', { class: 'card pad' }, h('div', { class: 'section-title', text: title, style: { marginTop: '0' } }));
        var kv = h('div', { class: 'kv' });
        rows.forEach(function (x) { kv.appendChild(h('div', { text: x[0] })); kv.appendChild(h('div', { text: x[1] == null || x[1] === '' ? '—' : String(x[1]), style: { color: x[2] || '', fontWeight: '500' } })); });
        box.appendChild(kv); return box;
      }
      function paint() {
        clear(body);
        if (tab === 'umumiy') {
          var idleBad = e.idleLimit && e.idleUsed / e.idleLimit > 0.9;
          body.appendChild(h('div', { class: 'grid g3' },
            block('Shaxsiy', [['F.I.Sh.', e.name], ['Telefon', e.phone], ['Biometriya', 'Yuz shabloni · maxfiy']]),
            block('Ish', [['Lavozim', e.position], ['Filial', bn], ['Grafik', e.schedule], ['Shartnoma', e.contract], ['FOM login', e.fomLogin ? e.fomLogin + ' · bog‘langan' : '—']]),
            block('Oy ko‘rsatkichlari', [['Davomat', e.attendance != null ? e.attendance + '%' : '—'], ['Kechikish', (e.late || 0) + ' marta', e.late > 3 ? 'var(--crit)' : null],
              ['Kelmagan', e.absent != null ? e.absent + ' kun' : '—'],
              ['Idle', e.idleLimit ? fmtHm(e.idleUsed) + ' / ' + fmtHm(e.idleLimit) : 'limit yo‘q', idleBad ? 'var(--crit)' : null],
              ['AI hodisalar', aiEvents ? evs.length + ' ta (' + evs.filter(function (x) { return x.status === 'pending'; }).length + ' kutilmoqda)' : 'ruxsat yo‘q'],
              ['Hujjatlar', e.docs, e.docs === 'Hammasi amalda' ? 'var(--ok)' : 'var(--crit)']])));
        } else if (tab === 'davomat') {
          var cal = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' } });
          for (var d = 1; d <= 31; d++) {
            var mk = attendanceMark(e, d), fut = d > 8, c = fut ? ['transparent', 'var(--text-3)'] : MARK[mk];
            cal.appendChild(h('div', { title: fut ? d + ' okt · reja' : d + ' okt · ' + mk, style: { background: c[0], color: c[1], border: '1px solid ' + (fut ? 'var(--stroke)' : 'transparent'), borderRadius: '6px', aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '11px', lineHeight: '1.1' } },
              h('b', { text: String(d) }), h('span', { text: mk, style: { fontSize: '10px' } })));
          }
          var pct = e.idleLimit ? Math.min(100, e.idleUsed / e.idleLimit * 100) : 0;
          body.appendChild(h('div', { class: 'grid g2' },
            U.card('Oktabr 2026', h('span', { class: 'muted', text: 'Kamera + zaxira check-in' }), h('div', { style: { padding: '0 20px 16px' } }, cal,
              h('div', { class: 'hint', style: { marginTop: '10px', display: 'flex', gap: '12px', flexWrap: 'wrap' } }, LEGEND.map(function (l) { return h('span', { text: l }); })))),
            U.card('Bo‘sh vaqt (idle) limiti · oktabr', null, h('div', { style: { padding: '0 20px 16px' } },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, h('span', { text: e.idleLimit ? fmtHm(e.idleUsed) : '—', style: { fontSize: '28px', fontWeight: '600' } }), h('span', { class: 'muted', text: 'ruxsat: ' + (e.idleLimit ? fmtHm(e.idleLimit) : 'belgilanmagan') })),
              h('div', { class: 'bar' + (pct > 90 ? ' crit' : ''), style: { height: '8px', margin: '10px 0' } }, h('i', { style: { width: pct + '%' } })),
              h('div', { class: 'muted' }, 'Qoldi: ', h('b', { text: e.idleLimit ? fmtHm(Math.max(0, e.idleLimit - e.idleUsed)) : '—' }), ' · faqat tasdiqlangan hodisalar hisoblanadi'),
              U.kvList([['Telefon ishlatish', fmtHm(e.idleUsed * 0.55)], ['O‘tirish / yotish', fmtHm(e.idleUsed * 0.3)], ['Ish zonasidan tashqarida', fmtHm(e.idleUsed * 0.15)]])))));
          body.appendChild(h('div', { class: 'hint', style: { marginTop: '8px' }, text: 'Kunlik belgilar web-panel prototipi qoidasi bo‘yicha (API’da kunlik davomat endpointi hali yo‘q).' }));
        } else if (tab === 'oylik') {
          var box = h('div', { class: 'card pad', style: { maxWidth: '640px' } });
          var hdr = h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' } }, h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, h('b', { text: 'Oktabr · joriy hisob', style: { fontSize: '16px' } }), U.pill('warn', 'MAXFIY')));
          box.appendChild(hdr);
          var inner = h('div', { style: { marginTop: '12px' } }); box.appendChild(inner);
          if (!sal || e.oklad == null) {
            inner.appendChild(h('div', { style: { border: '1px dashed var(--stroke-strong)', borderRadius: 'var(--r)', padding: '20px', background: 'var(--layer-sub)' } }, h('b', { text: 'Ruxsat yo‘q' }),
              h('div', { class: 'muted', text: 'Oylik ma’lumotini ko‘rish uchun «Oylik — maxfiy» ruxsati kerak. Ruxsatni Egasi yoki Super admin beradi.' })));
          } else {
            var btn = h('button', { class: 'btn' }, 'Ko‘rsatish');
            hdr.appendChild(btn);
            var paintSal = function () {
              clear(inner); btn.textContent = shown ? 'Yashirish' : 'Ko‘rsatish';
              if (!shown) { inner.appendChild(h('div', { text: '•• ••• ••• so‘m', style: { fontSize: '24px', fontWeight: '600', letterSpacing: '.06em' } })); inner.appendChild(h('div', { class: 'hint', text: '«Ko‘rsatish» bosilsa, harakat audit jurnaliga yoziladi.' })); return; }
              var rows = [['Oklad', fmt(e.oklad)], ['Davomat koeffitsienti', '× ' + fmtDec(e.coef)], ['Shaxsiy KPI', '+' + fmt(e.kpi), 'var(--ok)'], ['Bonus dorilar', '+' + fmt(e.bonus), 'var(--ok)'], ['Premiya', '+' + fmt(e.premium), 'var(--ok)'],
                ['Jarimalar', e.penalties ? '−' + fmt(e.penalties) : '0', e.penalties ? 'var(--crit)' : null], ['Soliq (JShDS, sozlanadi)', '−' + fmt(e.tax)], ['Avans', e.advance ? '−' + fmt(e.advance) : '0'], ['Qarz', e.debt ? '−' + fmt(e.debt) : '0']];
              rows.forEach(function (x) { inner.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--divider)', padding: '7px 0' } }, h('span', { class: 'muted', text: x[0] }), h('span', { text: x[1], style: { color: x[2] || '', fontVariantNumeric: 'tabular-nums' } }))); });
              inner.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--divider)', padding: '9px 0', fontWeight: '600' } }, h('span', { text: 'Qo‘lga tegadi' }), h('span', { text: fmtS(e.net) })));
              inner.appendChild(h('div', { class: 'hint', text: 'Ko‘rish audit jurnaliga yozildi.' }));
            };
            btn.onclick = function () {
              if (shown) { shown = false; paintSal(); return; }
              btn.disabled = true;
              A.cmd('audit.log', { action: 'Maxfiy ma’lumot ko‘rildi', object: 'Oylik · ' + e.name, branchId: e.branchId || null, before: '—', after: '—', reason: '—', sensitive: true })
                .catch(function (x) { A.toast('warn', 'Audit yozuvi yuborilmadi', errText(x)); })
                .then(function () { btn.disabled = false; shown = true; paintSal(); });
            };
            paintSal();
          }
          body.appendChild(box);
        } else if (tab === 'kpi') {
          var plan = e.kpiPlan || 0, fact = e.kpiFact || 0, p = plan ? fact / plan * 100 : 0, tiers = { 1: '1 (1,5%)', 2: '2 (2,0%)', 3: '3 (2,5%)' };
          body.appendChild(h('div', { class: 'card pad', style: { maxWidth: '640px' } },
            h('div', { style: { display: 'flex', justifyContent: 'space-between' } }, h('b', { text: 'Shaxsiy sotuv KPI · oktabr', style: { fontSize: '16px' } }), h('span', { class: 'src', text: 'FOM' })),
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '10px 0' } }, h('span', { text: plan ? A.money(fact) : '—', style: { fontSize: '24px', fontWeight: '600' } }), h('span', { class: 'muted', text: 'reja: ' + (plan ? A.money(plan) : '—') })),
            h('div', { class: 'bar', style: { height: '8px' } }, h('i', { style: { width: Math.min(100, p) + '%' } })),
            h('div', { class: 'muted', style: { marginTop: '10px' } }, 'Bajarildi: ', h('b', { text: p.toFixed(1).replace('.', ',') + '%' }), ' · KPI pog‘onasi: ' + tiers[kpiTier(p)] + ' · hisoblangan KPI: ', h('b', { text: sal && e.kpi != null ? A.money(e.kpi) : MASK }))));
        } else if (tab === 'jarima') {
          if (!aiEvents) { body.appendChild(A.infobar('info', 'Ruxsat yo‘q.', 'AI hodisalari sizning rolingiz uchun yopiq.')); return; }
          body.appendChild(U.table([
            { t: 'Hodisa', render: function (x) { return h('div', null, h('div', null, U.pill('info', 'AI'), ' ', h('b', { text: x.label })), h('div', { class: 'muted', style: { fontSize: '12px' }, text: [x.date + ', ' + x.time, x.camera, x.dur].join(' · ') })); } },
            { t: 'Ishonch', r: true, render: function (x) { return x.conf + '%'; }, w: '90px' },
            { t: 'Holat', w: '180px', render: function (x) { var s = AI_ST[x.status] || ['mute', x.status]; return U.pill(s[0], s[1]); } }
          ], evs, { onRow: A.can('ai') ? function (x) { A.go('ai', { sel: x.id }); } : null, empty: 'Bu oy AI hodisa va jarima yo‘q' }));
        } else if (tab === 'hujjat') {
          var exp = e.docs && e.docs !== 'Hammasi amalda';
          body.appendChild(U.table([{ t: 'Hujjat', k: 'n' }, { t: 'Amal qilish', k: 'u', muted: true, w: '160px' }, { t: 'Holat', w: '160px', render: function (x) { return U.pill(x.k, x.s); } }], [
            { n: 'Pasport', u: '—', k: 'ok', s: 'Amalda' },
            { n: 'Sanitariya kitobchasi', u: '—', k: exp ? 'crit' : 'ok', s: exp ? e.docs : 'Amalda' },
            { n: 'Farmatsevt sertifikati', u: '—', k: 'ok', s: 'Amalda' },
            { n: 'Mehnat shartnomasi', u: e.contract || 'muddatsiz', k: 'ok', s: 'Imzolangan' }]));
          body.appendChild(h('div', { class: 'hint', style: { marginTop: '8px' }, text: 'Hujjatlar holati: «' + (e.docs || '—') + '». Alohida hujjat sanalari API’da hali yo‘q.' }));
        } else if (tab === 'audit') {
          if (!audit) { body.appendChild(A.infobar('info', 'Ruxsat yo‘q.', 'Audit jurnali sizning rolingiz uchun yopiq.')); return; }
          var rows = audit.filter(function (a) { return String(a.object || '').indexOf(e.name) >= 0 || a.object === e.id; });
          var list = h('div', { class: 'card' });
          rows.forEach(function (a) {
            list.appendChild(h('div', { class: 'list-item' }, h('div', null,
              h('div', null, h('b', { text: a.user }), ' ', h('span', { class: 'muted', text: a.action })),
              h('div', { class: 's', text: (a.before || '—') + ' → ' + (a.after || '—') + ' · Sabab: ' + (a.reason || '—') })), h('div', { class: 'meta', text: a.at ? U.fmtDateTime(a.at) : a.time })));
          });
          if (!rows.length) list.appendChild(U.empty('Bu xodim bo‘yicha audit yozuvi yo‘q', 'audit'));
          body.appendChild(list);
        }
      }
      paint();
    });
  }
  A.screens.employee = function (page, params, ctx) { return empDetail(page, params || {}, ctx); };

  // ═════════════ W07 Ish grafigi ═════════════
  var WEEK = ['Du 12', 'Se 13', 'Ch 14', 'Pa 15', 'Ju 16', 'Sh 17', 'Ya 18'];
  var SHIFT = {
    D: { label: '08–20', name: 'Kunduzgi (12 s)', bg: 'var(--accent-soft)', fg: 'var(--accent)' },
    N: { label: '20–08', name: 'Tungi (12 s)', bg: 'var(--info-bg)', fg: 'var(--info)' },
    F: { label: '09–18', name: 'Standart (9 s)', bg: 'var(--layer-alt)', fg: 'var(--text)' },
    X: { label: 'Dam', name: 'Dam olish', bg: 'transparent', fg: 'var(--text-3)' },
    T: { label: 'Ta’til', name: 'Ta’til / kasal', bg: 'var(--warn-bg)', fg: 'var(--warn)' }
  };
  var ORDER = ['D', 'N', 'F', 'X', 'T'];
  function defaultRow(e) {
    if (e.status === 'ta’til' || e.status === 'kasal') return ['T', 'T', 'T', 'T', 'T', 'T', 'T'];
    if ((e.schedule || '').indexOf('1/2') === 0) return ['D', 'X', 'X', 'D', 'X', 'X', 'D'];
    if ((e.schedule || '').indexOf('5/2') === 0) return ['F', 'F', 'F', 'F', 'F', 'X', 'X'];
    return ['D', 'D', 'X', 'X', 'D', 'D', 'X'];
  }
  function rowOf(e, sched) { return sched[e.id] || defaultRow(e); }
  function hoursOf(row) { return row.reduce(function (a, c) { return a + (c === 'D' || c === 'N' ? 12 : c === 'F' ? 9 : 0); }, 0); }
  var SWAP_ST = { pending: ['warn', 'Kutilmoqda'], approved: ['ok', 'Tasdiqlangan'], rejected: ['crit', 'Rad etilgan'] };

  A.screens.schedule = function (page, params, ctx) {
    return Promise.all([A.get('/v1/employees'), A.branchesCached(), A.get('/v1/schedule'), soft(A.get('/v1/swaps'), null)]).then(function (r) {
      U.guard(ctx);
      var employees = r[0] || [], branches = r[1] || [], sched = r[2] || {}, swaps = r[3], me = A.state.me || {};
      if (!branches.length) { page.appendChild(U.card(null, null, U.empty('Hali filial yo‘q — Filiallar bo‘limida qo‘shing', 'branch'))); return; }
      var bid = params.branch || (branches.some(function (b) { return b.id === me.branchId; }) ? me.branchId : branches[0].id);
      var edit = canSched(), busy = false;
      var title = h('h1'), warn = h('div'), grid = h('div'), swapsBox = h('div');
      function br() { return branches.find(function (b) { return b.id === bid; }) || branches[0]; }
      function emps() { return employees.filter(function (e) { return e.branchId === bid && e.status !== DISMISSED; }); }
      function coverage() { var es = emps(); return WEEK.map(function (_, i) { return { day: es.filter(function (e) { return ['D', 'F'].indexOf(rowOf(e, sched)[i]) >= 0; }).length, night: es.filter(function (e) { return rowOf(e, sched)[i] === 'N'; }).length }; }); }
      function badDays() { var cov = coverage(); return WEEK.filter(function (_, i) { return cov[i].day < 2; }); }
      function setCell(e, i, code) {
        return A.cmd('schedule.setCell', { empId: e.id, day: i, code: code }).then(function (row) { sched[e.id] = Array.isArray(row) ? row : (function () { var x = rowOf(e, sched).slice(); x[i] = code; return x; })(); });
      }
      function paint() {
        var b = br(); title.textContent = 'Ish grafigi · ' + b.name;
        clear(warn); var bad = badDays();
        if (bad.length) warn.appendChild(A.infobar('warn', 'Ushbu vaqtda filialda minimal 2 xodim talabi bajarilmaydi.', b.name + ' · ' + bad.join(', ') + ', 08:00–20:00. Grafikni saqlash mumkin, lekin filial mudiri va HR’ga xabar boradi.'));
        clear(grid);
        var cols = '220px repeat(7, minmax(64px, 1fr)) 70px';
        var tbl = h('div', { style: { minWidth: '820px' } });
        tbl.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: cols, gap: '6px', padding: '10px 16px', fontSize: '12px', color: 'var(--text-2)', fontWeight: '600', borderBottom: '1px solid var(--divider)' } },
          h('span', { text: 'Xodim' }), WEEK.map(function (d) { return h('span', { text: d, style: { textAlign: 'center' } }); }), h('span', { text: 'Soat', style: { textAlign: 'right' } })));
        var es = emps();
        es.forEach(function (e) {
          var row = rowOf(e, sched);
          tbl.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: cols, gap: '6px', padding: '6px 16px', alignItems: 'center', borderBottom: '1px solid var(--divider)' } },
            h('div', { style: { minWidth: '0' } }, h('div', { text: e.name, style: { fontWeight: '600', fontSize: '13px', cursor: 'pointer' }, onclick: function () { openEmp(e.id); } }), h('div', { class: 'muted', style: { fontSize: '11px' }, text: (e.position || '') + ' · ' + (e.schedule || '') })),
            row.map(function (c, i) {
              var s = SHIFT[c] || SHIFT.X;
              return h('button', { title: e.name + ' · ' + WEEK[i] + ' · ' + s.name + (edit ? ' — bosib almashtiring (o‘ng tugma: orqaga)' : ''), disabled: !edit || busy,
                style: { height: '34px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', background: s.bg, color: s.fg, border: c === 'X' ? '1px dashed var(--stroke-strong)' : '1px solid transparent', cursor: edit ? 'pointer' : 'default', fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit' },
                onclick: function () { cycle(e, i, c, 1); },
                oncontextmenu: function (ev) { ev.preventDefault(); cycle(e, i, c, -1); } }, s.label);
            }),
            h('span', { text: hoursOf(row) + ' s', style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } })));
        });
        if (!es.length) tbl.appendChild(U.empty('Bu filialda xodim yo‘q', 'people'));
        var cov = coverage();
        tbl.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: cols, gap: '6px', padding: '8px 16px', background: 'var(--layer-sub)', fontSize: '12px' } },
          h('span', { class: 'muted', text: 'Qamrov (kunduz / tun) · min 2' }),
          cov.map(function (c) { return h('span', { text: c.day + ' / ' + c.night, style: { textAlign: 'center', fontWeight: '600', borderRadius: '4px', padding: '3px 0', color: c.day < 2 ? 'var(--crit)' : '', background: c.day < 2 ? 'var(--crit-bg)' : 'transparent' } }); }), h('span')));
        grid.appendChild(h('div', { class: 'card', style: { overflow: 'auto' } }, tbl));
        paintSwaps();
      }
      function cycle(e, i, c, dir) {
        if (!edit || busy) return;
        var next = ORDER[(ORDER.indexOf(c) + dir + ORDER.length) % ORDER.length];
        busy = true;
        setCell(e, i, next).catch(function (x) { A.toast('crit', 'Bajarilmadi', errText(x)); }).then(function () { busy = false; if (ctx.isCurrent()) paint(); });
      }
      function paintSwaps() {
        clear(swapsBox);
        if (!swaps) return;
        var list = h('div', { class: 'card', style: { maxWidth: '820px' } }, h('div', { class: 'card-h' }, h('h3', { text: 'Smena almashish so‘rovlari' })));
        swaps.forEach(function (w) {
          var st = SWAP_ST[w.status] || ['mute', w.status], acts = null;
          if (w.status === 'pending' && canDecideSwap()) {
            acts = h('div', { style: { display: 'flex', gap: '6px' } },
              h('button', { class: 'btn accent', onclick: function () { decide(w, 'approved', this); } }, 'Tasdiqlash'),
              h('button', { class: 'btn', onclick: function () { decide(w, 'rejected', this); } }, 'Rad etish'));
          }
          list.appendChild(h('div', { class: 'list-item', style: { alignItems: 'center' } },
            h('div', { style: { flex: '1' } }, h('div', { class: 't', text: w.from + ' → ' + w.to + ' · ' + w.day + ' · ' + w.shift }), h('div', { class: 's', text: 'Sabab: ' + (w.note || '—') + ' · mobil ilovadan' })),
            U.pill(st[0], st[1]), acts));
        });
        if (!swaps.length) list.appendChild(U.empty('So‘rov yo‘q'));
        swapsBox.appendChild(h('div', { class: 'section-title', text: 'Almashishlar' }));
        swapsBox.appendChild(list);
      }
      function decide(w, status, btn) {
        btn.disabled = true;
        A.cmd('swaps.decide', { id: w.id, status: status }).then(function (res) {
          A.toast(status === 'approved' ? 'ok' : 'info', status === 'approved' ? 'Smena almashish tasdiqlandi. Ikkala xodimga bildirish yuborildi.' : 'Smena almashish rad etildi.');
          if (res && res.id) Object.assign(w, res); else w.status = status;
          return A.get('/v1/schedule').then(function (s) { sched = s || sched; }).catch(function () {});
        }).catch(function (x) {
          var failed = x && x.details && x.details.failed;
          A.toast('crit', 'Bajarilmadi', errText(x) + (Array.isArray(failed) && failed.length ? ' · ' + failed.map(function (f) { return f.label || f.text || f.code || f; }).join(', ') : ''));
        }).then(function () { if (ctx.isCurrent()) paint(); });
      }
      function fillTemplate() {
        var es = emps(), jobs = [];
        es.forEach(function (e) { var want = defaultRow(e), cur = rowOf(e, sched); want.forEach(function (c, i) { if (cur[i] !== c) jobs.push([e, i, c]); }); });
        if (!jobs.length) { A.toast('info', 'Grafik shablon bilan bir xil'); return; }
        U.confirm('Shablondan to‘ldirish', br().name + ': ' + jobs.length + ' ta katak xodimning grafik turi (2/2, 5/2, 1/2) bo‘yicha qayta to‘ldiriladi.', 'To‘ldirish').then(function (ok) {
          if (!ok) return;
          busy = true; paint();
          var p = Promise.resolve();
          jobs.forEach(function (j) { p = p.then(function () { return setCell(j[0], j[1], j[2]); }); });
          p.then(function () { A.toast('ok', 'Grafik shablondan to‘ldirildi', 'Saqlashni unutmang.'); }).catch(function (x) { A.toast('crit', 'Bajarilmadi', errText(x)); })
            .then(function () { busy = false; if (ctx.isCurrent()) paint(); });
        });
      }
      var saveBtn = U.ro(h('button', { class: 'btn accent', disabled: !edit, onclick: function () {
        var b = br(), bad = badDays().length; saveBtn.disabled = true;
        A.cmd('schedule.save', { branchId: b.id, branchName: b.name }).then(function () { A.toast(bad ? 'info' : 'ok', bad ? 'Grafik saqlandi. Minimal xodim talabi bo‘yicha ogohlantirish mudirga yuborildi.' : 'Grafik saqlandi.'); })
          .catch(function (x) { A.toast('crit', 'Bajarilmadi', errText(x)); }).then(function () { saveBtn.disabled = !edit; });
      } }, icon('check'), 'Saqlash'));
      var tplBtn = U.ro(h('button', { class: 'btn', disabled: !edit, onclick: fillTemplate }, icon('cal'), 'Shablondan to‘ldirish'));
      var multi = branches.length > 1;
      page.appendChild(h('div', { class: 'page-head' }, h('div', null, title, h('div', { class: 'sub', text: '12–18 oktabr 2026 · katakni bosib smena turini almashtiring (o‘ng tugma — orqaga)' })),
        h('div', { class: 'tools' }, multi ? U.select(branches.map(function (b) { return [b.id, b.short || b.name]; }), bid, function (v) { bid = v; paint(); }, '190px') : null, tplBtn, saveBtn, U.refreshBtn())));
      page.appendChild(warn);
      page.appendChild(h('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '8px 0 12px', fontSize: '12px' } }, ORDER.map(function (k) {
        var s = SHIFT[k]; return h('span', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, h('span', { text: s.label, style: { background: s.bg, color: s.fg, border: '1px solid var(--stroke)', borderRadius: '4px', padding: '2px 6px', fontWeight: '600', fontSize: '11px' } }), h('span', { class: 'muted', text: s.name }));
      })));
      if (!edit && !A.readOnly()) page.appendChild(A.infobar('info', 'Faqat ko‘rish.', 'Grafikni Egasi, filial mudiri yoki HR o‘zgartiradi.'));
      page.appendChild(grid); page.appendChild(swapsBox);
      paint();
    });
  };

  // ═════════════ W08 Davomat ═════════════
  var TIMELINE = [
    { t: '07:56', code: 'ARRIVED', label: 'Keldi', meta: 'CAM-01 · Kirish · yuz 98%', tone: 'ok' },
    { t: '08:02', code: 'ZONE_ENTER', label: 'Kassa zonasiga kirdi', meta: 'CAM-03 · Kassa 1', tone: 'mute' },
    { t: '11:40', code: 'ZONE_EXIT', label: 'Kassa zonasidan chiqdi', meta: 'Zal → Ombor · 6 daq', tone: 'mute' },
    { t: '13:00', code: 'BREAK', label: 'Tanaffus', meta: '13:00–13:30 · rejada', tone: 'info' },
    { t: '14:07', code: 'IDLE', label: 'Telefon ishlatish (AI)', meta: '12 daq · 92% · tekshiruv kutilmoqda', tone: 'warn', evidence: true },
    { t: '16:20', code: 'ZONE_ENTER', label: 'Zal', meta: 'CAM-05 · mijoz bilan', tone: 'mute' },
    { t: '20:04', code: 'LEFT', label: 'Ketdi', meta: 'CAM-01 · Kirish', tone: 'ok' }
  ];
  var TONE_C = { ok: 'var(--ok)', warn: 'var(--warn)', info: 'var(--info)', crit: 'var(--crit)', mute: 'var(--text-3)' };
  A.screens.attendance = function (page, params, ctx) {
    return Promise.all([A.get('/v1/employees'), A.branchesCached()]).then(function (r) {
      U.guard(ctx);
      var employees = (r[0] || []).filter(function (e) { return e.status !== DISMISSED; }), br = params.branch || '', q = '';
      var selId = params.emp || (employees[0] && employees[0].id);
      var canFix = !A.readOnly() && inRoles(['OWNER', 'MANAGER', 'HR']);
      var gridHost = h('div'), tlHost = h('div');
      page.appendChild(U.head('Davomat · oktabr 2026', 'Manba: kamera (yuz) · zaxira: mobil check-in (geofence + selfie) · V vaqtida · K kechikdi · Y kelmagan · T ta’til · B kasal', [U.refreshBtn()]));
      if (!employees.length) { page.appendChild(U.card(null, null, U.empty('Hali xodim yo‘q — Xodimlar bo‘limida qo‘shing yoki import qiling', 'people'))); return; }
      page.appendChild(h('div', { class: 'toolbar' }, U.search('Xodim qidirish', function (v) { q = v.toLowerCase(); paint(); }, '240px'),
        (A.state.branches || []).length > 1 ? U.select(U.branchOptions(true), br, function (v) { br = v; paint(); }, '190px') : null,
        h('span', { class: 'muted', style: { marginLeft: '8px', fontSize: '12px' } }, LEGEND.join(' · '))));
      page.appendChild(gridHost); page.appendChild(tlHost);
      function list() { return employees.filter(function (e) { return (!br || e.branchId === br) && (!q || e.name.toLowerCase().indexOf(q) >= 0); }); }
      function paint() {
        clear(gridHost);
        var es = list(), cols = '200px repeat(31, minmax(22px, 1fr)) 48px';
        var tbl = h('div', { style: { minWidth: '1100px', fontSize: '11px' } });
        var hd = h('div', { style: { display: 'grid', gridTemplateColumns: cols, gap: '3px', padding: '8px 12px', background: 'var(--layer-sub)', borderBottom: '1px solid var(--divider)', position: 'sticky', top: '0' } }, h('span', { class: 'muted', text: 'Xodim', style: { fontWeight: '600' } }));
        for (var d = 1; d <= 31; d++) hd.appendChild(h('span', { text: String(d), style: { textAlign: 'center', color: d === 8 ? 'var(--accent)' : 'var(--text-3)', fontWeight: d === 8 ? '700' : '400' } }));
        hd.appendChild(h('span', { class: 'muted', text: '%', style: { textAlign: 'right' } }));
        tbl.appendChild(hd);
        es.forEach(function (e) {
          var row = h('div', { style: { display: 'grid', gridTemplateColumns: cols, gap: '3px', padding: '4px 12px', alignItems: 'center', borderBottom: '1px solid var(--divider)', cursor: 'pointer', background: e.id === selId ? 'var(--selected)' : '' },
            onclick: function () { selId = e.id; paint(); }, ondblclick: function () { openEmp(e.id); } },
            h('div', { style: { minWidth: '0', lineHeight: '1.2' } }, h('div', { text: e.name, style: { fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }), h('div', { class: 'muted', style: { fontSize: '10px' }, text: shortName(A.branchName(e.branchId)) })));
          for (var d2 = 1; d2 <= 31; d2++) { var mk = attendanceMark(e, d2), c = d2 > 8 ? ['transparent', 'var(--text-3)'] : MARK[mk]; row.appendChild(h('span', { text: mk, style: { background: c[0], color: c[1], height: '22px', borderRadius: '4px', display: 'grid', placeItems: 'center', fontWeight: '600', fontSize: '10px' } })); }
          row.appendChild(h('span', { text: e.attendance != null ? e.attendance + '%' : '—', style: { textAlign: 'right', fontSize: '12px', fontVariantNumeric: 'tabular-nums' } }));
          tbl.appendChild(row);
        });
        if (!es.length) tbl.appendChild(U.empty('Hech narsa topilmadi', 'search'));
        gridHost.appendChild(h('div', { class: 'card', style: { overflow: 'auto', maxHeight: 'calc(100vh - 420px)', minHeight: '200px' } }, tbl));
        paintTl();
      }
      function paintTl() {
        clear(tlHost);
        var ae = employees.find(function (e) { return e.id === selId; }) || list()[0];
        if (!ae) return;
        var fixBtn = U.ro(h('button', { class: 'btn', disabled: !canFix, onclick: function () {
          fixBtn.disabled = true;
          A.cmd('attendance.requestFix', { empId: ae.id }).then(function () { A.toast('ok', 'Tuzatish so‘rovi HR + filial mudiri tasdig‘iga yuborildi.'); })
            .catch(function (x) { A.toast('crit', 'Bajarilmadi', errText(x)); }).then(function () { fixBtn.disabled = !canFix; });
        } }, icon('check'), 'Tuzatish kiritish'));
        var box = h('div', { class: 'card', style: { maxWidth: '880px', marginTop: '12px' } },
          h('div', { class: 'card-h' }, h('div', null, h('h3', { text: 'Kun timeline’i' }), h('div', { class: 'muted', style: { fontSize: '12px' }, text: ae.name + ' · ' + A.branchName(ae.branchId) + ' · 8 okt · idle: ' + (ae.idleLimit ? fmtHm(ae.idleUsed) + ' / ' + fmtHm(ae.idleLimit) : 'limit yo‘q') })), h('div', { class: 'more' }, fixBtn)));
        TIMELINE.forEach(function (x) {
          box.appendChild(h('div', { class: 'list-item', style: { alignItems: 'center' } },
            h('b', { text: x.t, style: { width: '48px', fontVariantNumeric: 'tabular-nums' } }),
            h('span', { style: { width: '10px', height: '10px', borderRadius: '50%', background: TONE_C[x.tone], flex: 'none' } }),
            h('div', { style: { flex: '1' } }, h('div', null, h('span', { class: 'mono muted', text: x.code, style: { fontSize: '11px' } }), ' · ' + x.label), h('div', { class: 's', text: x.meta })),
            x.evidence && A.can('ai') ? h('button', { class: 'btn subtle', onclick: function () { A.go('ai', { sel: 'ai1', filter: 'all' }); } }, 'Dalilni ko‘rish') : null));
        });
        box.appendChild(h('div', { class: 'hint', style: { padding: '8px 20px 12px' }, text: 'Timeline va kunlik belgilar web-panel prototipi ma’lumoti (API’da kunlik davomat/timeline endpointi hali yo‘q).' }));
        tlHost.appendChild(box);
      }
      paint();
    });
  };

  // ═════════════ W18 Oylik vedomosti ═════════════
  var P_STATUS = ['Qoralama', 'Hisoblangan', 'Mudirlar tekshiruvida', 'Egasi tasdig‘ida', 'Qulflangan', 'To‘langan'];
  var P_STEPS = ['Qoralama', 'Hisoblangan', 'Mudirlar tekshiruvi', 'Egasi tasdig‘i', 'Qulflangan', 'To‘lov'];
  function effStage(stage, reviewed) { var v = Object.keys(reviewed || {}).map(function (k) { return reviewed[k]; }); return stage === 2 && v.every(Boolean) ? 3 : stage; }
  A.screens.payroll = function (page, params, ctx) {
    return Promise.all([A.get('/v1/payroll'), A.get('/v1/employees'), A.branchesCached(), soft(A.get('/v1/aiEvents'), [])]).then(function (r) {
      U.guard(ctx);
      var run = r[0] || {}, me = A.state.me || {}, rl = role(), ro = A.readOnly(), sal = canSal();
      var pe = (r[1] || []).filter(function (e) { return e.status !== DISMISSED; }), aiEvents = r[3] || [];
      var reviewed = run.reviewed || {}, stage = effStage(run.stage || 0, reviewed);
      var scopeBranch = rl === 'MANAGER' ? me.branchId : null;
      var brs = (r[2] || []).filter(function (b) { return !scopeBranch || b.id === scopeBranch; });
      function sum(f) { return pe.reduce(function (a, e) { return a + (f(e) || 0); }, 0); }
      var tg = sum(function (e) { return e.gross; }), tn = sum(function (e) { return e.net; }), tded = sum(function (e) { return (e.penalties || 0) + (e.tax || 0) + (e.advance || 0) + (e.debt || 0); });
      var reviewedN = Object.keys(reviewed).filter(function (k) { return reviewed[k]; }).length;
      function money(n) { return sal ? A.money(n) : MASK; }
      function after(okText) { return function () { A.toast('ok', okText); A.render(); }; }
      function fail(btn) { return function (x) { if (btn) btn.disabled = false; A.toast('crit', 'Bajarilmadi', errText(x)); }; }

      var kind = stage >= 5 ? 'ok' : stage === 4 ? 'info' : 'warn';
      var hd = U.head('Oylik vedomosti', (run.period || 'Oktabr 2026') + ' · soliq: JShDS (sozlanadi)', [U.refreshBtn()]);
      hd.querySelector('h1').appendChild(h('span', { style: { marginLeft: '10px', verticalAlign: 'middle' } }, U.pill(kind, P_STATUS[stage] || String(stage))));
      page.appendChild(hd);

      // Stepper
      var meta = ['Tizim', '', reviewedN + ' / ' + Object.keys(reviewed).length + ' filial', 'Egasi', 'tasdiqdan keyin', 'Moliya'];
      var steps = h('div', { class: 'card pad', style: { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: '12px', marginBottom: '12px' } });
      P_STEPS.forEach(function (n, i) {
        var done = i < stage || stage === 5, cur = i === stage && stage !== 5;
        steps.appendChild(h('div', { style: { minWidth: '0' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
            h('span', { text: done ? '✓' : String(i + 1), style: { width: '24px', height: '24px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: '700', flex: 'none',
              background: done ? 'var(--accent)' : cur ? 'var(--warn-bg)' : 'transparent', color: done ? 'var(--on-accent)' : cur ? 'var(--warn)' : 'var(--text-3)', border: '1px solid ' + (done ? 'var(--accent)' : cur ? 'var(--warn)' : 'var(--stroke-strong)') } }),
            h('span', { style: { flex: '1', height: '2px', background: i < stage ? 'var(--accent)' : 'var(--divider)' } })),
          h('div', { text: n, style: { fontWeight: '600', marginTop: '6px', fontSize: '13px' } }), h('div', { class: 'muted', style: { fontSize: '12px' }, text: i === 4 && stage >= 4 ? 'qulflangan' : i === 5 && stage >= 5 ? 'to‘langan' : meta[i] })));
      });
      page.appendChild(steps);

      // Harakat
      var act = null;
      if (!ro) {
        if (rl === 'FINANCE' && stage <= 3) act = { title: 'Vedomostni qayta hisoblash', text: 'Davomat, KPI (FOM), bonus dorilar, tasdiqlangan jarimalar, avans va qarzlar qayta olinadi. Mudirlar tekshiruvi qaytadan boshlanadi.', btn: 'Qayta hisoblash', cls: 'btn', go: function (b) { A.cmd('payroll.recalc', {}).then(after('Vedomost qayta hisoblandi. Filial mudirlari tekshiruvi qayta boshlandi.')).catch(fail(b)); } };
        else if (rl === 'FINANCE' && stage === 4) act = { title: 'To‘lovni belgilash', text: 'Vedomost qulflangan. To‘lov bank orqali o‘tkazilgandan so‘ng belgilang — xodimlarga payslip yuboriladi.', btn: 'To‘landi deb belgilash', go: function (b) {
          U.confirm('To‘lovni belgilash', 'Vedomost to‘langan deb belgilanadi va ' + pe.length + ' xodimga payslip yuboriladi.', 'To‘landi').then(function (ok) { if (!ok) { b.disabled = false; return; } A.cmd('payroll.markPaid', {}).then(after('Vedomost to‘langan deb belgilandi. ' + pe.length + ' xodimga payslip Telegram va mobil ilovaga yuborildi.')).catch(fail(b)); }); } };
        else if (rl === 'MANAGER' && scopeBranch && !reviewed[scopeBranch] && stage <= 3) act = { title: A.branchName(scopeBranch) + ' vedomostini tekshiring', text: pe.length + ' xodim · jami ' + money(tn) + '. Qatorni bosib har bir xodim payslipini ko‘ring.', btn: 'Tekshirildi — Egasiga yuborish', go: function (b) { A.cmd('payroll.review', { branchId: scopeBranch }).then(after(A.branchName(scopeBranch) + ' tekshirildi.')).catch(fail(b)); } };
        else if (rl === 'OWNER' && stage <= 1) act = { title: 'Vedomostni qayta hisoblash', text: 'Davomat, KPI, bonus, jarima, avans va qarzlar qayta olinadi.', btn: 'Qayta hisoblash', cls: 'btn', go: function (b) { A.cmd('payroll.recalc', {}).then(after('Vedomost qayta hisoblandi.')).catch(fail(b)); } };
        else if (rl === 'OWNER' && stage === 2) act = { title: 'Egasi tasdig‘i hali ochilmagan', text: 'Filial mudirlari tekshiruvi kutilmoqda.', btn: 'Tasdiqlash va qulflash', disabled: true };
        else if (rl === 'OWNER' && stage === 3) act = { title: 'Vedomost tasdiqingizni kutmoqda', text: 'Barcha filial mudirlari tekshirdi. Tasdiqlangandan so‘ng vedomost qulflanadi.', btn: 'Tasdiqlash va qulflash', go: function (b) { lockDialog().then(function (ok) { if (ok) A.render(); else b.disabled = false; }); } };
        else if (rl === 'OWNER' && stage === 4) act = { title: 'To‘lovni belgilash', text: 'Vedomost qulflangan. To‘lov o‘tkazilgandan so‘ng belgilang.', btn: 'To‘landi deb belgilash', go: function (b) { A.cmd('payroll.markPaid', {}).then(after('Vedomost to‘langan deb belgilandi.')).catch(fail(b)); } };
      }
      function lockDialog() {
        var er = h('div', { class: 'err' }), disputes = aiEvents.filter(function (x) { return x.status === 'disputed'; }).length;
        return A.dialog({ title: 'Vedomostni tasdiqlash', primary: 'Tasdiqlash va qulflash',
          body: h('div', null, h('p', { class: 'note', text: 'Vedomost tasdiqlangandan so‘ng o‘zgartirish qulflanadi.' }),
            U.kvList([['Jami to‘lov', money(tn)], ['Xodimlar', pe.length + ' xodim · ' + brs.length + ' filial'], ['Ko‘rib chiqilayotgan e’tirozlar', disputes + ' ta'], ['Mas’ul', 'Egasi · ' + ((A.state.me || {}).name || '')]]), er),
          onPrimary: function () { return A.cmd('payroll.lock', {}).then(function () { A.toast('ok', 'Vedomost tasdiqlandi va qulflandi. Moliya admin to‘lovni belgilaydi.'); return true; }).catch(function (x) { er.textContent = errText(x); return false; }); } });
      }
      var actBox = h('div', { class: 'card pad' });
      if (act) {
        var ab = h('button', { class: act.cls || 'btn accent', disabled: !!act.disabled }, act.btn);
        ab.onclick = function () { ab.disabled = true; act.go(ab); };
        actBox.appendChild(h('b', { text: act.title, style: { fontSize: '14px' } }));
        actBox.appendChild(h('p', { class: 'note', text: act.text }));
        actBox.appendChild(ab);
      }
      var bl = h('div', { style: { marginTop: act ? '12px' : '0' } });
      brs.forEach(function (b) {
        var bs = pe.filter(function (e) { return e.branchId === b.id; }).reduce(function (a, e) { return a + (e.net || 0); }, 0);
        bl.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: '10px', alignItems: 'center', borderTop: '1px solid var(--divider)', padding: '7px 0' } },
          h('div', null, h('div', { text: b.name }), h('div', { class: 'muted', style: { fontSize: '12px' }, text: b.manager || '' })),
          h('span', { class: 'muted', text: money(bs) }), reviewed[b.id] ? U.pill('ok', 'Tekshirildi') : U.pill('warn', 'Kutilmoqda')));
      });
      actBox.appendChild(bl);
      page.appendChild(h('div', { class: 'grid g2', style: { marginBottom: '12px' } },
        h('div', { class: 'grid g2' }, U.kpi('Hisoblangan (gross)', { v: money(tg) }, { icon: 'wallet' }), U.kpi('Ushlanmalar', { v: sal ? '−' + A.money(tded) : MASK }, { icon: 'pay' }),
          U.kpi('To‘lanadi (net)', { v: money(tn) }, { icon: 'cash' }), U.kpi('Xodimlar', { v: String(pe.length), u: 'ta' }, { icon: 'people' })),
        actBox));
      if (stage >= 4) page.appendChild(A.infobar('ok', 'Vedomost qulflangan.', 'O‘zgartirish faqat «Tuzatish vedomosti» orqali, Egasi tasdig‘i bilan amalga oshiriladi.'));
      if (!sal) page.appendChild(A.infobar('info', 'Oylik summalari yashirilgan.', 'Sizning rolingizda «Oylik — maxfiy» ruxsati yo‘q.'));

      function m(v) { return v == null ? MASK : A.num(v); }
      page.appendChild(U.table([
        { t: 'Xodim', render: function (e) { return h('b', { text: e.name, style: { fontWeight: '500' } }); } },
        { t: 'Filial', muted: true, render: function (e) { return shortName(A.branchName(e.branchId)); } },
        { t: 'Oklad', r: true, render: function (e) { return m(e.oklad); } },
        { t: 'Koef.', r: true, render: function (e) { return h('span', { text: fmtDec(e.coef), style: { color: e.coef != null && e.coef < 1 ? 'var(--warn)' : '' } }); } },
        { t: 'KPI', r: true, render: function (e) { return m(e.kpi); } },
        { t: 'Bonus + prem.', r: true, render: function (e) { return e.bonus == null ? MASK : A.num((e.bonus || 0) + (e.premium || 0)); } },
        { t: 'Jarima', r: true, render: function (e) { return e.penalties == null ? MASK : h('span', { text: e.penalties ? '−' + A.num(e.penalties) : '0', style: { color: e.penalties ? 'var(--crit)' : 'var(--text-3)' } }); } },
        { t: 'Soliq', r: true, render: function (e) { return e.tax == null ? MASK : '−' + A.num(e.tax); } },
        { t: 'Avans + qarz', r: true, render: function (e) { if (e.advance == null) return MASK; var v = (e.advance || 0) + (e.debt || 0); return v ? '−' + A.num(v) : '0'; } },
        { t: 'Qo‘lga', r: true, render: function (e) { return h('b', { text: m(e.net) }); } }
      ], pe, { onRow: function (e) { payslip(e); }, empty: 'Hali xodim yo‘q' }));
      page.appendChild(h('div', { class: 'total-row', style: { display: 'flex', justifyContent: 'flex-end', gap: '24px', padding: '10px 4px', fontVariantNumeric: 'tabular-nums' } },
        h('span', { class: 'muted' }, 'Gross: ', h('b', { text: sal ? A.num(tg) : MASK })), h('span', { class: 'muted' }, 'Qo‘lga jami: ', h('b', { text: money(tn) }))));

      function payslip(e) {
        var ev = aiEvents.find(function (x) { return x.empId === e.id && x.status === 'confirmed'; }) || aiEvents.find(function (x) { return x.empId === e.id; });
        var lines = [
          ['Oklad × davomat koef.', e.oklad == null ? MASK : A.num(Math.round(e.oklad * (e.coef || 0))), e.oklad == null ? '' : A.num(e.oklad) + ' × ' + fmtDec(e.coef)],
          ['Shaxsiy KPI', e.kpi == null ? MASK : '+' + A.num(e.kpi), 'FOM sotuvlari asosida', 'var(--ok)'],
          ['Bonus dorilar', e.bonus == null ? MASK : '+' + A.num(e.bonus), 'FOM bonus ro‘yxati', 'var(--ok)'],
          ['Premiya', e.premium == null ? MASK : '+' + A.num(e.premium), 'mudir taklifi', 'var(--ok)'],
          ['Jarimalar', e.penalties == null ? MASK : e.penalties ? '−' + A.num(e.penalties) : '0', e.penalties ? (ev ? ev.label + ' · ' + ev.conf + '% · ' + ev.date + ', ' + ev.time : 'qo‘lda kiritilgan') : 'yo‘q', e.penalties ? 'var(--crit)' : 'var(--text-3)'],
          ['Soliq (JShDS, sozlanadi)', e.tax == null ? MASK : '−' + A.num(e.tax), 'gross − jarima'],
          ['Avans', e.advance == null ? MASK : e.advance ? '−' + A.num(e.advance) : '0', ''],
          ['Qarz', e.debt == null ? MASK : e.debt ? '−' + A.num(e.debt) : '0', e.debt ? 'tovar qarzi' : '—']];
        var box = h('div', { style: { width: '460px', maxWidth: '80vw' } },
          h('div', { class: 'muted', text: (e.position || '') + ' · ' + A.branchName(e.branchId) }),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 0' } }, h('span', { class: 'muted', text: 'Qo‘lga tegadi' }), h('b', { text: fmtS(e.net), style: { fontSize: '24px' } })));
        lines.forEach(function (l) {
          box.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '8px', borderTop: '1px solid var(--divider)', padding: '8px 0' } },
            h('div', null, h('div', { text: l[0] }), l[2] ? h('div', { class: 'muted', style: { fontSize: '11px' }, text: l[2] }) : null),
            h('b', { text: l[1], style: { color: l[3] || '', fontVariantNumeric: 'tabular-nums' } })));
        });
        box.appendChild(h('div', { class: 'hint', text: 'Xodim shu payslipni mobil ilovada ko‘radi.' }));
        A.dialog({ title: 'Payslip · ' + e.name, body: box, primary: 'Xodim kartasi', secondary: 'Yopish' }).then(function (ok) { if (ok) openEmp(e.id); });
      }
    });
  };

  // ═════════════ W16 Oylik shablonlari va formula ═════════════
  var VARS = ['oklad', 'coef', 'kpi', 'bonus', 'premium', 'penalties', 'advance', 'debt'];
  var VAR_N = { oklad: 'Oklad', coef: 'Koeffitsient', kpi: 'KPI', bonus: 'Bonus', premium: 'Premiya', penalties: 'Jarimalar', advance: 'Avans', debt: 'Qarz' };
  var OPS = [['+', '+'], ['-', '−'], ['*', '×'], ['/', '÷'], ['(', '('], [')', ')']];
  function shown(t) { if (t.kind === 'op') { var o = OPS.find(function (x) { return x[0] === t.value; }); return o ? o[1] : t.value; } return t.value; }
  var prState = { tplId: null };
  A.screens.payrollRules = function (page, params, ctx) {
    return Promise.all([A.get('/v1/payrollRules'), soft(A.get('/v1/employees'), [])]).then(function (r) {
      U.guard(ctx);
      var tpls = (r[0] && r[0].templates) || [], employees = (r[1] || []).filter(function (e) { return e.status !== DISMISSED; });
      var rl = role(), ro = A.readOnly();
      var canWrite = !ro && (rl === 'OWNER' || rl === 'FINANCE'), canTest = !ro && (rl === 'OWNER' || rl === 'FINANCE' || rl === 'HR'), isOwner = !ro && rl === 'OWNER';
      page.appendChild(U.head('Oylik shablonlari va formula', 'Formula serverda tekshiriladi; faollashtirilgan versiya keyingi qayta hisobdan qo‘llanadi.', [U.refreshBtn()]));
      if (!tpls.length) { page.appendChild(U.card(null, null, U.empty('Shablon yo‘q'))); return; }
      var tpl = null, toks = null, test = null, empId = employees[0] && employees[0].id;
      var master = h('div', { class: 'card master' }), detail = h('div', { style: { minWidth: '0' } });
      page.appendChild(h('div', { class: 'md', style: { gridTemplateColumns: '260px minmax(0,1fr)' } }, master, detail));
      function pick() { tpl = tpls.find(function (x) { return x.id === prState.tplId; }) || tpls.find(function (x) { return x.active; }) || tpls[0]; prState.tplId = tpl.id; }
      function base() { var v = tpl.versions.find(function (x) { return x.active; }) || tpl.versions[tpl.versions.length - 1]; return v ? v.formula.slice() : []; }
      function formula() { return toks || base(); }
      function set(n) { toks = n; test = null; paintDetail(); }
      function reload(selId) {
        return A.get('/v1/payrollRules').then(function (d) { if (!ctx.isCurrent()) return; tpls = (d && d.templates) || tpls; if (selId) prState.tplId = selId; pick(); toks = null; test = null; paintMaster(); paintDetail(); });
      }
      function paintMaster() {
        clear(master);
        tpls.forEach(function (x) {
          master.appendChild(h('div', { class: 'md-item' + (x.id === tpl.id ? ' sel' : ''), onclick: function () { prState.tplId = x.id; pick(); toks = null; test = null; paintMaster(); paintDetail(); } },
            h('div', { class: 'body' }, h('div', { class: 't', text: x.name, title: x.name }), h('div', { class: 's', text: x.versions.length + ' versiya' + (x.active ? ' · faol' : '') })),
            x.active ? U.pill('ok', 'faol') : null));
        });
        if (canWrite) {
          var nm = U.input({ placeholder: 'Yangi shablon nomi' });
          var nb = h('button', { class: 'btn full', style: { marginTop: '6px' } }, icon('plus'), 'Yangi shablon');
          nb.onclick = function () {
            var name = nm.value.trim(); if (!name) { nm.focus(); return; }
            nb.disabled = true;
            A.cmd('payrollRules.createTemplate', { name: name, baseTemplateId: tpl.id }).then(function (x) { A.toast('ok', '«' + x.name + '» shabloni yaratildi'); return reload(x.id); })
              .catch(function (x) { A.toast('crit', 'Bajarilmadi', errText(x)); }).then(function () { nb.disabled = false; });
          };
          master.appendChild(h('div', { style: { borderTop: '1px solid var(--divider)', padding: '10px 8px 6px', marginTop: '4px' } }, U.field('Yangi shablon (joriy shablondan nusxa)', nm), nb));
        }
      }
      function paintDetail() {
        clear(detail);
        var f = formula(), dirty = toks !== null;
        // Formula
        var chips = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '44px', padding: '10px', background: 'var(--layer-sub)', border: '1px solid var(--stroke)', borderRadius: 'var(--r)' } });
        f.forEach(function (tk, i) {
          chips.appendChild(h('button', { class: 'mono', disabled: !canTest, title: canTest ? 'Bosib o‘chiring' : null, onclick: function () { set(f.filter(function (_, j) { return j !== i; })); },
            style: { height: '30px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--stroke)', fontWeight: '600', fontSize: '12px', cursor: canTest ? 'pointer' : 'default', background: tk.kind === 'var' ? 'var(--accent-soft)' : 'var(--layer)', color: tk.kind === 'var' ? 'var(--accent)' : 'var(--text)' } }, tk.kind === 'var' ? (VAR_N[tk.value] || tk.value) : shown(tk)));
        });
        if (!f.length) chips.appendChild(h('span', { class: 'muted', text: 'Formula bo‘sh' }));
        var fcard = h('div', { class: 'card pad' },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' } }, h('b', { text: 'Formula · ' + tpl.name, style: { fontSize: '15px' } }), h('span', { class: 'hint', text: 'token ustiga bosib o‘chiring · pastdan o‘zgaruvchi qo‘shing' })),
          chips);
        if (canTest) {
          var last = f[f.length - 1], needOp = last && (last.kind === 'var' || last.kind === 'num' || (last.kind === 'paren' && last.value === ')'));
          var add = function (x) { set(needOp && (x.kind === 'var' || x.kind === 'num' || (x.kind === 'paren' && x.value === '(')) ? f.concat([{ kind: 'op', value: '+' }, x]) : f.concat([x])); };
          fcard.appendChild(h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '10px' } }, h('span', { class: 'muted', style: { fontSize: '12px', marginRight: '4px' }, text: 'Amallar:' }),
            OPS.map(function (o) { return h('button', { class: 'btn mono', style: { minWidth: '32px', padding: '0 8px' }, onclick: function () { set(f.concat([{ kind: o[0] === '(' || o[0] === ')' ? 'paren' : 'op', value: o[0] }])); } }, o[1]); })));
          fcard.appendChild(h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' } }, h('span', { class: 'muted', style: { fontSize: '12px', marginRight: '4px' }, text: 'O‘zgaruvchilar:' }),
            VARS.map(function (v) { return h('button', { class: 'btn', style: { borderStyle: 'dashed', fontSize: '12px' }, onclick: function () { add({ kind: 'var', value: v }); } }, '+ ' + VAR_N[v]); })));
          var numIn = U.input({ placeholder: 'Son', attrs: { inputmode: 'decimal', style: 'width:140px' } });
          var addNum = h('button', { class: 'btn', onclick: function () { var v = numIn.value.replace(',', '.').trim(); if (!/^\d{1,12}(\.\d{1,6})?$/.test(v)) { numIn.focus(); A.toast('warn', 'Son noto‘g‘ri'); return; } add({ kind: 'num', value: v }); } }, 'Son qo‘shish');
          fcard.appendChild(h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', marginTop: '8px' } }, numIn, addNum,
            h('button', { class: 'btn subtle', disabled: !dirty, onclick: function () { toks = null; test = null; paintDetail(); } }, 'Joriy versiyaga qaytarish')));
        }
        detail.appendChild(fcard);

        // Test + versiyalar
        var te = employees.find(function (e) { return e.id === empId; }) || employees[0];
        var tcard = h('div', { class: 'card pad', style: { border: '1px solid var(--accent)' } });
        var esel = te ? U.select(employees.map(function (e) { return [e.id, e.name]; }), te.id, function (v) { empId = v; test = null; paintDetail(); }, '220px') : null;
        tcard.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' } }, h('b', { text: 'Formula test' }), esel));
        if (test && test.ok) tcard.appendChild(h('div', { style: { background: 'var(--accent-soft)', borderRadius: 'var(--r)', padding: '10px 12px', marginTop: '10px' } },
          h('div', { style: { fontSize: '12px', color: 'var(--accent)' }, text: 'Natija' }), h('b', { text: A.money(test.gross), style: { fontSize: '20px' } }),
          h('div', { class: 'muted', style: { fontSize: '12px' }, text: 'Soliq ' + A.num(test.tax) + ' · qo‘lga ' + A.num(test.net) }),
          te && te.net != null ? h('div', { class: 'hint', text: 'Joriy vedomost: ' + A.money(te.net) }) : null));
        if (test && !test.ok) tcard.appendChild(h('div', { class: 'err', style: { marginTop: '10px' }, text: 'Formula xato: ' + test.error }));
        var runBtn = h('button', { class: 'btn', disabled: !te || !canTest, style: { marginTop: '10px' } }, icon('check'), 'Testni ishga tushirish');
        runBtn.onclick = function () {
          runBtn.disabled = true;
          A.cmd('payrollRules.test', { formula: f, employeeId: te.id }).then(function (x) { test = x; })
            .catch(function (x) { test = { ok: false, error: String(errText(x)).replace(/^Formula xato:\s*/, '') + (x.details && x.details.at != null ? ' (token #' + (x.details.at + 1) + ')' : '') }; })
            .then(function () { if (ctx.isCurrent()) paintDetail(); });
        };
        tcard.appendChild(U.ro(runBtn));
        if (canWrite) {
          var note = U.input({ placeholder: 'Masalan: KPI ulushi oshirildi' });
          var sv = h('button', { class: 'btn accent', disabled: !dirty || !(test && test.ok) }, 'Yangi versiya saqlash');
          sv.onclick = function () {
            sv.disabled = true;
            A.cmd('payrollRules.saveVersion', { templateId: tpl.id, formula: f, note: note.value.trim() }).then(function () { A.toast('ok', 'Yangi versiya saqlandi. Faollashtirilgach keyingi qayta hisobdan amal qiladi.'); return reload(tpl.id); })
              .catch(function (x) { var who = x.details && x.details.employeeId ? ' · xodim: ' + (employees.find(function (e) { return e.id === x.details.employeeId; }) || {}).name : ''; A.toast('crit', 'Saqlanmadi', errText(x) + (who || '')); sv.disabled = false; });
          };
          tcard.appendChild(h('div', { style: { marginTop: '12px' } }, U.field('Versiya izohi', note), sv));
          if (!(test && test.ok)) tcard.appendChild(h('div', { class: 'hint', text: 'Saqlashdan oldin formulani xodimda server orqali sinab ko‘ring (barcha xodimlarda ham tekshiriladi).' }));
        } else if (!canTest) tcard.appendChild(h('div', { class: 'hint', text: 'Faqat ko‘rish rejimi.' }));

        var tiers = h('div', { class: 'card pad' }, h('b', { text: 'KPI pog‘onalari (shaxsiy sotuvdan %)' }));
        (tpl.kpiTiers || []).forEach(function (x) { tiers.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--divider)', padding: '6px 0', marginTop: '4px' } }, h('span', { class: 'muted', text: x.maxPct == null ? '≥ ' + x.minPct + '%' : x.minPct + '–' + x.maxPct + '%' }), h('b', { text: String(x.ratePct).replace('.', ',') + '%' }))); });
        var reason = U.input({ placeholder: 'Faollashtirish sababi (≥ 3 belgi)' });
        var vers = h('div', { class: 'card pad', style: { marginTop: '12px' } }, h('b', { text: 'Versiyalar tarixi' }));
        tpl.versions.slice().reverse().forEach(function (v) {
          var end;
          if (v.active && tpl.active) end = U.pill('ok', 'faol');
          else if (isOwner) {
            end = h('button', { class: 'btn' }, 'Faollashtirish');
            end.onclick = function () {
              var rs = reason.value.trim(); if (rs.length < 3) { reason.focus(); A.toast('warn', 'Faollashtirish sababini yozing (≥ 3 belgi)'); return; }
              var b = this; b.disabled = true;
              A.cmd('payrollRules.activate', { templateId: tpl.id, version: v.version, reason: rs }).then(function () { A.toast('ok', 'Versiya faollashtirildi — keyingi qayta hisobdan qo‘llanadi.'); return reload(tpl.id); })
                .catch(function (x) { b.disabled = false; A.toast('crit', 'Bajarilmadi', errText(x)); });
            };
          } else end = U.pill('mute', 'nofaol');
          vers.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) auto', gap: '8px', alignItems: 'center', borderTop: '1px solid var(--divider)', padding: '6px 0', marginTop: '4px' } },
            h('b', { class: 'mono', text: 'v' + v.version }),
            h('div', { style: { minWidth: '0' } }, h('div', { text: (v.note || '—') + ' · ' + (v.createdBy || ''), title: v.note || '', style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
              h('div', { class: 'muted mono', style: { fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, text: (v.formula || []).map(shown).join(' ') + (v.createdAt ? ' · ' + U.fmtDate(v.createdAt) : '') })),
            end));
        });
        if (isOwner) vers.appendChild(h('div', { style: { marginTop: '8px' } }, U.field('Faollashtirish sababi (≥ 3 belgi)', reason)));
        vers.appendChild(h('div', { class: 'hint', text: 'Faqat Egasi faollashtiradi; o‘zgarish audit jurnaliga maxfiy yozuv sifatida tushadi.' }));
        detail.appendChild(h('div', { class: 'grid g2', style: { marginTop: '12px', alignItems: 'start' } }, tcard, h('div', null, tiers, vers)));

        detail.appendChild(h('div', { style: { marginTop: '12px' } }, U.table([
          { t: 'Kod', w: '70px', render: function (x) { return h('b', { class: 'mono', text: x.code }); } }, { t: 'Qoida', k: 'name' },
          { t: 'Asos', w: '160px', render: function (x) { return x.basis || (x.amount != null ? A.money(x.amount) : '—'); } }, { t: 'Manba', k: 'source', muted: true, w: '190px' }
        ], tpl.penaltyRules || [], { title: 'Jarima qoidalari', more: h('span', { class: 'muted', text: 'AI hodisalari faqat inson tasdig‘idan keyin qo‘llanadi' }) })));
      }
      pick(); paintMaster(); paintDetail();
    });
  };
})();
