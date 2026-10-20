/* Apteka 360 Desktop — moliya ekranlari: Harajatlar, Pul oqimi, P&L, Prognoz, Analitika, Hisobotlar, Soliq. */
(function () {
  'use strict';
  var A = window.Apteka, h = A.h, U = A.ui, icon = A.icon;

  function role() { return A.role(); }
  function me() { return A.state.me || {}; }
  function isNet() { var r = role(); return r === 'OWNER' || r === 'SUPER_ADMIN' || r === 'FINANCE' || r === 'AUDITOR'; }
  function qs(o) { var p = []; Object.keys(o).forEach(function (k) { if (o[k] != null && o[k] !== '') p.push(k + '=' + encodeURIComponent(o[k])); }); return p.length ? '?' + p.join('&') : ''; }
  function mln(n) { if (n == null) return '—'; return (n < 0 ? '−' : '') + (Math.abs(n) / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 }).replace(/ /g, ' ') + ' mln'; }
  function shortDate(s) { if (!s) return '—'; var d = new Date(s); if (isNaN(d)) return s; var M = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek']; return d.getDate() + ' ' + M[d.getMonth()]; }
  function srcPill(s) { return s ? U.pill(s === 'SEED' ? 'mute' : 'info', s) : null; }
  function notConnected(text) { return A.infobar('info', 'FOM ulanmagan.', text || 'Tushum, tannarx va prognoz FOM sinxronlash agenti ulangandan keyin to‘ldiriladi.'); }
  function branchFilter(value, onchange) { return isNet() ? U.select(U.branchOptions(true), value || '', onchange, '190px') : null; }
  /** Ekranni joyida qayta chizish uchun — A.go(id, params) */
  function goSelf(id, params, patch) { A.go(id, Object.assign({}, params || {}, patch), { nohist: true }); }

  // ═════════════ Harajatlar ═════════════
  var SOURCES = ['Kassa (naqd)', 'Bank hisobi', 'Egasi kassasi'];
  var CATS = [['Xodimlar', 'tushlik, forma, o‘qitish'], ['Kommunal', 'elektr, suv, gaz, ijara'], ['IT', 'internet, uskunalar, dastur'], ['Logistika', 'yetkazish, taksi, yoqilg‘i'], ['Davlat / bank', 'soliq, komissiya, litsenziya'], ['Tijorat', 'reklama, vitrina, yorliq'], ['Vrachlar', 'kelishuv to‘lovlari · maxfiy'], ['Boshqa', 'izoh majburiy']];
  var EXP_ST = { approved: ['ok', 'Tasdiqlangan'], pending: ['warn', 'Mudir tasdig‘i'], finance: ['warn', 'Moliya tasdig‘i'], owner: ['warn', 'Egasi tasdig‘i'], rejected: ['crit', 'Rad etilgan'], cancelled: ['mute', 'Bekor qilingan'] };
  var EXP_FILTERS = [['all', 'Hammasi'], ['wait', 'Tasdiq kutilmoqda'], ['approved', 'Tasdiqlangan'], ['rejected', 'Rad etilgan'], ['cancelled', 'Bekor qilingan']];
  function canWriteExpenses() { var r = role(); return (r === 'OWNER' || r === 'SUPER_ADMIN' || r === 'FINANCE' || r === 'MANAGER') && !A.readOnly(); }
  function approvalLevel(amt, remain, st) {
    var x = st.approvalX || 2000000, y = st.approvalY || 10000000, over = amt > remain;
    if (over) return 'Egasi — kunlik limitdan oshadi';
    if (amt > y) return 'Egasi (> 10 mln)';
    if (amt > x) return 'Moliya admin (2–10 mln)';
    return 'Filial mudiri (≤ 2 mln)';
  }

  A.screens.expenses = function (page, params, ctx) {
    return Promise.all([A.get('/v1/expenses'), A.get('/v1/branches'), A.get('/v1/settings').catch(function () { return {}; })]).then(function (r) {
      U.guard(ctx);
      var all = r[0] || [], branches = r[1] || [], settings = r[2] || {};
      A.state.branches = A.state.branches || branches;
      var m = me(), own = role() === 'MANAGER' && m.branchId ? m.branchId : null;
      var scopeIds = own ? [own] : (m.branchIds && m.branchIds.length && !isNet() ? m.branchIds : null);
      function inScope(id) { return !scopeIds || scopeIds.indexOf(id) >= 0; }
      var myBranches = branches.filter(function (b) { return inScope(b.id); });
      var filter = params.f || 'all', bf = params.b || '', q = '';
      page.classList.add('wide');

      var sub = h('div', { class: 'sub' });
      var addBtn = h('button', { class: 'btn accent', onclick: function () { newExpense(myBranches, settings, bf || own || (myBranches[0] && myBranches[0].id)); } }, icon('plus'), 'Yangi harajat');
      if (!canWriteExpenses()) { addBtn.disabled = true; addBtn.title = A.readOnly() ? 'Auditor rejimi — faqat o‘qish' : 'Rolingiz harajat kirita olmaydi'; }
      var hd = U.head('Harajatlar', null, [U.search('Tavsif, kiritgan, kategoriya', function (v) { q = v; paint(); }), branchFilter(bf, function (v) { bf = v; paint(); }), U.refreshBtn(), addBtn]);
      hd.querySelector('div').appendChild(sub);
      page.appendChild(hd);

      // Kunlik limit kartalari
      var lim = h('div', { class: 'grid gauto', style: { marginBottom: '12px' } });
      myBranches.forEach(function (b) {
        var p = b.expenseLimit ? b.expensesToday / b.expenseLimit : 0;
        lim.appendChild(h('div', { class: 'card pad' },
          h('div', { class: 'muted', style: { fontSize: '12px', color: 'var(--text-2)' }, text: (b.short || b.name) + ' · bugungi limit' }),
          h('div', { style: { fontWeight: '600', margin: '4px 0 8px', fontVariantNumeric: 'tabular-nums' }, text: A.num(b.expensesToday || 0) + ' / ' + A.num(b.expenseLimit || 0) }),
          h('div', { class: 'bar' + (p > 1 ? ' crit' : p > 0.8 ? ' warn' : '') }, h('i', { style: { width: Math.min(100, Math.round(p * 100)) + '%' } }))));
      });
      if (myBranches.length) page.appendChild(lim);

      var fbar = h('div', { class: 'toolbar', style: { marginBottom: '12px' } }, U.seg(EXP_FILTERS, filter, function (v) { filter = v; paint(); }));
      page.appendChild(fbar);
      var host = h('div');
      page.appendChild(host);
      page.appendChild(h('div', { class: 'note', style: { marginTop: '8px', color: 'var(--text-3)', fontSize: '12px' }, text: 'Tasdiqlash: ≤ ' + A.moneyShort(settings.approvalX || 2000000).v + ' mln — mudir, ' + A.moneyShort(settings.approvalX || 2000000).v + '–' + A.moneyShort(settings.approvalY || 10000000).v + ' mln — moliya, > ' + A.moneyShort(settings.approvalY || 10000000).v + ' mln yoki limitdan oshsa — Egasi' }));

      function paint() {
        var rows = all.filter(function (x) { return inScope(x.branchId); })
          .filter(function (x) { return !bf || x.branchId === bf; })
          .filter(function (x) { return filter === 'all' ? true : filter === 'wait' ? ['pending', 'finance', 'owner'].indexOf(x.status) >= 0 : x.status === filter; })
          .filter(function (x) { return !q || [x.title, x.who, x.cat, x.source].join(' ').toLowerCase().indexOf(q) >= 0; });
        var sum = rows.filter(function (x) { return x.status !== 'cancelled' && x.status !== 'rejected'; }).reduce(function (a, x) { return a + (x.amount || 0); }, 0);
        sub.textContent = rows.length + ' ta yozuv · ko‘rsatilgan jami: ' + A.money(sum);
        A.clear(host);
        host.appendChild(U.table([
          { t: 'Sana', k: 'date', w: '80px', muted: true },
          { t: 'Filial', render: function (x) { return A.branchName(x.branchId); }, w: '130px' },
          { t: 'Kategoriya', k: 'cat', w: '120px' },
          { t: 'Tavsif', render: function (x) {
            return h('div', null, h('div', { text: x.title || '—', style: { fontWeight: '500', textDecoration: x.status === 'cancelled' ? 'line-through' : 'none' } }),
              x.anomaly ? h('div', { style: { fontSize: '11px', color: 'var(--warn)' }, text: x.anomaly }) : null);
          } },
          { t: 'Kiritdi', k: 'who', muted: true, w: '150px' },
          { t: 'Summa', r: true, w: '130px', render: function (x) { return h('span', { text: A.num(x.amount), style: { fontWeight: '600', textDecoration: x.status === 'cancelled' ? 'line-through' : 'none' } }); } },
          { t: 'Manba', w: '130px', render: function (x) { return h('div', null, h('div', { text: x.source, style: { fontSize: '12px' } }), h('div', { text: x.receipt ? 'chek ✓' : 'cheksiz', style: { fontSize: '11px', color: x.receipt ? 'var(--text-3)' : 'var(--warn)' } })); } },
          { t: 'Status', w: '140px', render: function (x) { var s = EXP_ST[x.status] || ['mute', x.status]; return U.pill(s[0], s[1]); } }
        ], rows, { onRow: function (x) { expenseDetail(x, branches); }, empty: 'Bu filtrda harajat yo‘q', bare: false }));
      }
      paint();
    });
  };

  function newExpense(branches, settings, defBranch) {
    if (!branches.length) { A.toast('info', 'Filial yo‘q', 'Harajat kiritish uchun filial kerak.'); return; }
    var cat = null, err = h('div', { class: 'err' });
    var catBox = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } });
    function paintCats() {
      A.clear(catBox);
      CATS.forEach(function (c) {
        catBox.appendChild(h('button', { class: 'card pad', style: { textAlign: 'left', padding: '10px 12px', border: '1px solid ' + (cat === c[0] ? 'var(--accent)' : 'var(--stroke)'), background: cat === c[0] ? 'var(--accent-subtle, var(--card))' : '' }, onclick: function () { cat = c[0]; paintCats(); upd(); } },
          h('b', { text: c[0], style: { display: 'block' } }), h('span', { text: c[1], style: { fontSize: '11px', color: 'var(--text-3)' } })));
      });
    }
    paintCats();
    var amt = U.moneyInput(), src = SOURCES[0];
    var srcSeg = U.seg(SOURCES.map(function (s) { return [s, s]; }), src, function (v) { src = v; upd(); });
    var brSel = U.select(branches.map(function (b) { return [b.id, b.name]; }), branches.some(function (b) { return b.id === defBranch; }) ? defBranch : branches[0].id, function () { upd(); }, '100%');
    var receipt = h('input', { type: 'checkbox' }), recurring = h('input', { type: 'checkbox' });
    var note = h('textarea', { class: 'tb', placeholder: 'Tavsif: nima uchun, kimga', style: { minHeight: '60px' } });
    var limLine = h('div', { class: 'hint' }), over = h('div'), lvl = h('div', { class: 'note' });
    function upd() {
      var b = branches.find(function (x) { return x.id === brSel.value; }) || branches[0], a = amt.num(), remain = (b.expenseLimit || 0) - (b.expensesToday || 0);
      limLine.textContent = 'Bugungi limit: ' + A.num(b.expensesToday || 0) + ' / ' + A.num(b.expenseLimit || 0) + ' · qoldi ' + A.num(Math.max(0, remain)) + ' so‘m';
      A.clear(over); if (a > 0 && a > remain) over.appendChild(A.infobar('warn', 'Kunlik limitdan oshadi', 'Kunlik limitdan ' + A.num(a - remain) + ' so‘m oshadi. Harajat saqlanadi, lekin to‘lov Egasi tasdig‘idan keyin amalga oshiriladi.'));
      lvl.textContent = 'Tasdiqlovchi: ' + approvalLevel(a, remain, settings) + (cat ? ' · Kategoriya: ' + cat : '');
      return { b: b, a: a, remain: remain };
    }
    amt.addEventListener('input', upd); note.addEventListener('input', function () { err.textContent = ''; });
    upd();
    var body = h('div', { style: { width: '520px', maxWidth: '100%' } },
      h('div', { class: 'section-title', text: 'Kategoriyani tanlang', style: { marginTop: '0' } }), catBox,
      h('div', { class: 'form-grid', style: { marginTop: '12px' } },
        U.field('Summa *', amt, null), U.field('Filial', brSel)),
      limLine, over,
      U.field('Pul manbasi', srcSeg),
      U.field('Izoh', note),
      h('label', { class: 'chk' }, receipt, 'Chek ilova qilingan'),
      h('label', { class: 'chk' }, recurring, 'Har oy takrorlanadigan harajat'),
      lvl, err);
    A.dialog({ title: 'Yangi harajat', body: body, primary: 'Saqlash va yuborish', onPrimary: function () {
      var s = upd();
      if (!cat) { err.textContent = 'Kategoriyani tanlang.'; return false; }
      if (!(s.a > 0)) { err.textContent = 'Summani kiriting.'; return false; }
      if (cat === 'Boshqa' && !note.value.trim()) { err.textContent = '«Boshqa» kategoriyasi uchun izoh majburiy'; return false; }
      var level = approvalLevel(s.a, s.remain, settings);
      return U.run('expenses.create', { branchId: s.b.id, cat: cat, amount: s.a, source: src, receipt: receipt.checked, note: note.value.trim(), recurring: recurring.checked })
        .then(function () { A.toast('ok', 'Harajat saqlandi', 'Tasdiqqa yuborildi: ' + level + '.'); A.render(); return true; })
        .catch(function () { return false; });
    } });
  }

  function expenseDetail(x, branches) {
    var st = EXP_ST[x.status] || ['mute', x.status];
    var canCancel = canWriteExpenses() && x.status !== 'cancelled' && x.status !== 'rejected';
    var reason = U.input({ placeholder: 'Masalan: ikki marta kiritilgan' }), err = h('div', { class: 'err' });
    var body = h('div', { style: { width: '460px', maxWidth: '100%' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' } }, h('b', { text: A.money(x.amount), style: { fontSize: '22px' } }), U.pill(st[0], st[1])),
      x.anomaly ? A.infobar('warn', 'Anomaliya (AI taxmini)', x.anomaly + ' — shu kategoriyadagi oxirgi 90 kunga nisbatan.') : null,
      U.kvList([['Sana', x.createdAt ? U.fmtDateTime(x.createdAt) : x.date], ['Filial', A.branchName(x.branchId)], ['Kategoriya', x.cat], ['Manba', x.source], ['Kiritdi', x.who],
        ['Chek', x.receipt ? 'Rasm ilova qilingan · OCR mos' : 'Ilova qilinmagan'], ['Takrorlanadi', x.recurring ? 'Har oy' : null]]),
      x.note ? h('p', { class: 'note', text: (x.status === 'cancelled' ? 'Bekor qilish sababi: ' : 'Izoh: ') + x.note }) : null,
      canCancel ? h('div', { style: { borderTop: '1px solid var(--divider)', marginTop: '12px', paddingTop: '10px' } },
        U.field('Bekor qilish sababi *', reason, 'Moliyaviy yozuv o‘chirilmaydi — «Bekor qilingan» holatida audit bilan saqlanadi.'), err) : null);
    A.dialog({ title: x.title || 'Harajat', body: body, primary: canCancel ? 'Bekor qilish' : 'Yopish', secondary: canCancel ? 'Yopish' : false, danger: canCancel,
      onPrimary: canCancel ? function () {
        var v = reason.value.trim(); if (!v) { err.textContent = 'Bekor qilish sababini yozing.'; return false; }
        return U.run('expenses.cancel', { id: x.id, reason: v }, 'Harajat bekor qilindi. Yozuv o‘chirilmadi, audit jurnalida saqlandi.').then(function () { A.render(); return true; }).catch(function () { return false; });
      } : null });
  }

  // ═════════════ Pul oqimi ═════════════
  A.screens.cashflow = function (page, params, ctx) {
    var hz = +params.hz || 30, bf = params.b || '';
    return Promise.all([A.get('/v1/finance/cashflow' + qs({ branchId: bf })), A.branchesCached()]).then(function (r) {
      U.guard(ctx);
      var d = r[0] || {}, acc = d.accounts || [], exp = d.expected || [], rw = d.runway || {};
      var total = acc.reduce(function (a, x) { return a + (x.balance || 0); }, 0);
      page.appendChild(U.head('Pul oqimi', 'Joriy qoldiq: ' + A.money(total), [
        U.seg([['30', '30 kun'], ['60', '60 kun'], ['90', '90 kun']], String(hz), function (v) { goSelf('cashflow', params, { hz: v }); }),
        branchFilter(bf, function (v) { goSelf('cashflow', params, { b: v }); }), U.refreshBtn()]));
      if (!d.connected) page.appendChild(notConnected('Kassa va terminal qoldig‘i hamda tushum prognozi FOM agenti ulangandan keyin to‘liq bo‘ladi.'));
      var ag = h('div', { class: 'grid g3' });
      acc.forEach(function (a) { ag.appendChild(U.kpi(a.label, a.balance, { icon: a.key === 'bank' ? 'pay' : a.key === 'terminal' ? 'wallet' : 'cash', foot: a.asOf ? 'holat: ' + U.fmtDateTime(a.asOf) : '' })); });
      page.appendChild(ag);

      // Runway
      var pts = [{ l: 'bugun', v: total }, { l: '30 kun', v: rw.d30 || 0 }];
      if (hz >= 60) pts.push({ l: '60 kun', v: rw.d60 || 0 });
      if (hz >= 90) pts.push({ l: '90 kun', v: rw.d90 || 0 });
      var val = hz === 90 ? rw.d90 : hz === 60 ? rw.d60 : rw.d30;
      page.appendChild(h('div', { class: 'section-title', text: 'Kassa runway — prognoz qilingan qoldiq' }));
      var g = h('div', { class: 'grid g4' },
        U.kpi('30 kundan keyin', rw.d30, { icon: 'forecast' }),
        hz >= 60 ? U.kpi('60 kundan keyin', rw.d60, { icon: 'forecast' }) : null,
        hz >= 90 ? U.kpi('90 kundan keyin', rw.d90, { icon: 'forecast' }) : null,
        rw.lowest ? U.kpi('Eng past nuqta', rw.lowest.value, { icon: 'warn', foot: U.fmtDate(rw.lowest.date) }) : null);
      page.appendChild(g);
      page.appendChild(h('div', { style: { marginTop: '12px' } }, U.card('Qoldiq dinamikasi · ' + hz + ' kun', null, h('div', { style: { padding: '4px 16px 12px' } }, U.areaChart(pts)))));
      var risk = d.risk || (val < 0 ? { level: 'crit', text: hz + ' kun ichida kassa uzilishi xavfi: ' + A.money(val) + '.' } : null);
      page.appendChild(h('div', { style: { marginTop: '12px' } }, risk ? A.infobar(risk.level === 'crit' ? 'crit' : 'warn', 'Prognoz · ogohlantirish', risk.text) : A.infobar('ok', 'Prognoz', hz + ' kun ichida kassa uzilishi xavfi yo‘q.')));

      var limitDate = U.isoDay(-hz);
      var rows = exp.filter(function (x) { return !x.date || x.date <= limitDate; });
      var inSum = rows.filter(function (x) { return x.kind === 'in'; }).reduce(function (a, x) { return a + x.amount; }, 0), outSum = rows.filter(function (x) { return x.kind !== 'in'; }).reduce(function (a, x) { return a + x.amount; }, 0);
      page.appendChild(h('div', { class: 'section-title', text: 'Kutilayotgan kirim va chiqimlar' }));
      page.appendChild(U.table([
        { t: 'Sana', w: '110px', render: function (x) { return shortDate(x.date); } },
        { t: 'Nomi', k: 'title' },
        { t: 'Turi', w: '90px', render: function (x) { return x.kind === 'in' ? 'Kirim' : 'Chiqim'; } },
        { t: 'Summa', r: true, w: '160px', render: function (x) { return h('b', { text: (x.kind === 'in' ? '+' : '−') + A.num(x.amount), style: { color: x.kind === 'in' ? 'var(--ok)' : 'var(--text-1)' } }); } },
        { t: 'Manba', w: '110px', render: function (x) { return srcPill(x.source); } }
      ], rows, { empty: 'Kutilayotgan to‘lovlar yo‘q', more: h('span', { class: 'src', text: 'kirim +' + A.moneyShort(inSum).v + ' · chiqim −' + A.moneyShort(outSum).v + ' ' + A.moneyShort(outSum).u }) }));
    });
  };

  // ═════════════ P&L ═════════════
  A.screens.pnl = function (page, params, ctx) {
    var from = params.from || U.isoDay(0).slice(0, 8) + '01', to = params.to || U.isoDay(0), gb = params.g || 'branch', bf = params.b || '';
    return A.get('/v1/finance/pnl' + qs({ from: from, to: to, groupBy: gb, branchId: bf })).then(function (d) {
      U.guard(ctx);
      page.classList.add('wide');
      var fi = U.input({ type: 'date', value: from }), ti = U.input({ type: 'date', value: to });
      fi.style.width = ti.style.width = '150px';
      function apply() { goSelf('pnl', params, { from: fi.value, to: ti.value }); }
      fi.onchange = ti.onchange = apply;
      page.appendChild(U.head('Foyda va zarar (P&L)', (bf ? A.branchName(bf) : 'Barcha filiallar') + ' · ' + U.fmtDate(d.from) + ' – ' + U.fmtDate(d.to) + ' · tushum va tannarx FOM’dan, qolgani Apteka 360 hisobidan', [
        fi, ti, U.seg([['branch', 'Filiallar'], ['month', 'Oylar']], gb, function (v) { goSelf('pnl', params, { g: v }); }),
        branchFilter(bf, function (v) { goSelf('pnl', params, { b: v }); }),
        h('button', { class: 'btn', onclick: function () { A.go('reports', { kind: 'pnl', from: from, to: to }); } }, icon('report'), 'Eksport'), U.refreshBtn()]));
      if (!d.connected) page.appendChild(notConnected('Tushum va tannarx FOM agenti ulangach to‘ladi; harajat va oylik fondi — Apteka 360 hisobidan.'));
      var cols = d.columns || [], rows = d.rows || [];
      var rev = rows.find(function (x) { return x.key === 'revenue'; });
      var tb = h('tbody');
      rows.forEach(function (r) {
        var strong = r.kind === 'sub' || r.kind === 'total';
        var tr = h('tr', { style: { background: r.kind === 'total' ? 'var(--accent-subtle, transparent)' : r.kind === 'sub' ? 'var(--layer-alt, transparent)' : '', fontWeight: strong ? '600' : '400' } }, h('td', { text: r.label }));
        (r.values || []).forEach(function (v) { tr.appendChild(h('td', { class: 'r', text: mln(v), style: { color: r.kind === 'total' ? (v < 0 ? 'var(--crit)' : 'var(--ok)') : v < 0 ? 'var(--text-2)' : '' } })); });
        var tot = r.values ? r.values[r.values.length - 1] : 0, rt = rev ? rev.values[rev.values.length - 1] : 0;
        tr.appendChild(h('td', { class: 'r muted', text: strong && rt ? (Math.round(tot / rt * 1000) / 10 + '%').replace('.', ',') : '' }));
        tb.appendChild(tr);
      });
      page.appendChild(U.card(null, null, h('div', { class: 'table-wrap' }, h('table', { class: 'dg' },
        h('thead', null, h('tr', null, [h('th', { text: 'Ko‘rsatkich' })].concat(cols.map(function (c) { return h('th', { class: 'r', text: c }); })).concat([h('th', { class: 'r', text: 'Marja' })]))), tb))));
      var net = rows.find(function (x) { return x.key === 'net'; });
      if (net && cols.length > 1) {
        page.appendChild(h('div', { class: 'section-title', text: 'Sof foyda · ' + (gb === 'month' ? 'oylar' : 'filiallar') + ' kesimida' }));
        page.appendChild(U.card(null, null, U.hbar(cols.slice(0, -1).map(function (c, i) { return { l: c, v: net.values[i] || 0 }; }), { fmt: mln })));
      }
      page.appendChild(h('div', { class: 'note', style: { marginTop: '8px', fontSize: '12px', color: 'var(--text-3)' }, text: 'Oylik fondi davr kunlariga mutanosib (fond × kun / 30). Harajatlar — rad etilgan va bekor qilinganlardan tashqari.' }));
    });
  };

  // ═════════════ Prognoz ═════════════
  A.screens.forecast = function (page, params, ctx) {
    var hz = +params.hz || 14, bf = params.b || '';
    return A.get('/v1/finance/forecast' + qs({ horizon: hz, branchId: bf })).then(function (d) {
      U.guard(ctx);
      page.appendChild(U.head('Prognozlar', 'So‘nggi 28 kunlik FOM tushumi, hafta kuni o‘rtachasi · ishonch oralig‘i 80%', [
        U.seg([['7', '7 kun'], ['14', '14 kun'], ['30', '30 kun']], String(hz), function (v) { goSelf('forecast', params, { hz: v }); }),
        branchFilter(bf, function (v) { goSelf('forecast', params, { b: v }); }), U.refreshBtn()]));
      if (!d.connected) page.appendChild(notConnected());
      (d.notes || []).forEach(function (n) { if (d.connected) page.appendChild(A.infobar('info', 'Izoh', n)); });
      var s = d.series || [];
      var sum = s.reduce(function (a, x) { return a + x.value; }, 0);
      page.appendChild(h('div', { class: 'grid g3' },
        U.kpi('Kutilgan tushum · ' + hz + ' kun', sum, { icon: 'forecast' }),
        U.kpi('Kunlik o‘rtacha', s.length ? Math.round(sum / s.length) : 0, { icon: 'chart' }),
        U.kpi('Pessimistik (80%)', s.reduce(function (a, x) { return a + x.low80; }, 0), { icon: 'warn' })));
      var chart = U.areaChart(s.map(function (x) { return { l: shortDate(x.date), v: x.value }; }), { emptyText: d.connected ? 'Prognoz uchun ma’lumot yetarli emas' : 'FOM ulanmagan — prognoz uchun ma’lumot yo‘q.' });
      page.appendChild(h('div', { style: { marginTop: '12px' } }, U.card('Tushum prognozi · ' + hz + ' kun', h('span', { class: 'src', text: 'FOM' }), h('div', { style: { padding: '4px 16px 12px' } }, chart))));
      if (s.length) {
        page.appendChild(h('div', { class: 'section-title', text: 'Kunlar bo‘yicha' }));
        page.appendChild(U.table([
          { t: 'Sana', render: function (x) { return U.fmtDate(x.date); } },
          { t: 'Prognoz', r: true, render: function (x) { return A.num(x.value); } },
          { t: 'Pastki (80%)', r: true, muted: true, render: function (x) { return A.num(x.low80); } },
          { t: 'Yuqori (80%)', r: true, muted: true, render: function (x) { return A.num(x.high80); } }
        ], s));
      }
      var RISK = { ok: ['ok', 'yetarli'], overstock: ['warn', 'ortiqcha zaxira'], unknown_stock: ['mute', 'qoldiq noma’lum'] };
      page.appendChild(h('div', { class: 'section-title', text: 'Talab prognozi · ' + hz + ' kun' }));
      page.appendChild(U.table([
        { t: 'Dori', render: function (x) { return h('div', null, h('div', { text: x.name }), h('div', { class: 'muted', style: { fontSize: '11px' }, text: x.sku })); } },
        { t: 'Filial', render: function (x) { return A.branchName(x.branchId); } },
        { t: 'Kutilgan sotuv', r: true, render: function (x) { return A.num(x.expected); } },
        { t: 'Qoldiq', r: true, render: function (x) { return A.num(x.stock); } },
        { t: 'Holat', render: function (x) { var k = RISK[x.risk] || ['mute', x.risk]; return U.pill(k[0], k[1]); } }
      ], d.demand || [], { empty: 'Talab prognozi FOM sotuvlari ulangach ko‘rinadi' }));
      page.appendChild(h('div', { style: { marginTop: '12px' } }, A.infobar('info', 'AI tavsiyasi', 'Prognoz — tavsiya. Buyurtma va to‘lov bo‘yicha qarorni mas’ul xodim qabul qiladi.')));
    });
  };

  // ═════════════ Analitika ═════════════
  var AI_CODES = { IDLE_PHONE: 'Telefon ishlatish', OUT_OF_ZONE: 'Ish zonasidan tashqarida', SITTING: 'O‘tirish', LYING: 'Yotish', ABSENT_POST: 'Postda yo‘q', CASH_NO_RECEIPT: 'Chek urilmagan savdo', RUDE_SPEECH: 'Qo‘pol ibora (audio)', QUEUE_LONG: 'Uzun navbat' };
  A.screens.analytics = function (page, params, ctx) {
    var tab = params.tab || 'filial', bf = params.b || '';
    var to = params.to || U.isoDay(0), from = params.from || U.isoDay(30);
    var path = { filial: '/v1/analytics/branches', xodim: '/v1/analytics/staff', mijoz: '/v1/analytics/traffic', ai: '/v1/analytics/ai' }[tab] || '/v1/analytics/branches';
    return Promise.all([A.get(path + qs({ from: from, to: to, branchId: bf })), A.branchesCached()]).then(function (r) {
      U.guard(ctx);
      var d = r[0] || {};
      page.classList.add('wide');
      var fi = U.input({ type: 'date', value: from }), ti = U.input({ type: 'date', value: to });
      fi.style.width = ti.style.width = '150px';
      fi.onchange = ti.onchange = function () { goSelf('analytics', params, { from: fi.value, to: ti.value }); };
      page.appendChild(U.head('Analitika', (d.from ? U.fmtDate(d.from) + ' – ' + U.fmtDate(d.to) : ''), [fi, ti, branchFilter(bf, function (v) { goSelf('analytics', params, { b: v }); }), U.refreshBtn()]));
      page.appendChild(U.tabs([['filial', 'Filiallar'], ['xodim', 'Xodimlar'], ['mijoz', 'Mijoz oqimi va heatmap'], ['ai', 'AI analitika']], tab, function (v) { goSelf('analytics', params, { tab: v }); }));
      var body = h('div', { style: { marginTop: '12px' } }); page.appendChild(body);

      if (tab === 'filial') {
        var bs = d.branches || [];
        if (!d.connected) body.appendChild(notConnected('Tushum, cheklar va marja FOM agenti ulangach to‘ladi.'));
        body.appendChild(U.table([
          { t: 'Filial', render: function (x) { return h('b', { text: x.name }); } },
          { t: 'Tushum', r: true, render: function (x) { return x.connected ? mln(x.revenue) : '—'; } },
          { t: 'Cheklar', r: true, render: function (x) { return x.connected ? A.num(x.checks) : '—'; } },
          { t: 'O‘rtacha chek', r: true, render: function (x) { return x.connected ? A.num(x.avgCheck) : '—'; } },
          { t: 'Marja', r: true, render: function (x) { return x.connected ? x.marginPct + '%' : '—'; } },
          { t: 'Tashrif', r: true, render: function (x) { return A.num(x.traffic); } },
          { t: 'Konversiya', r: true, render: function (x) { return x.conversion != null ? x.conversion + '%' : '—'; } },
          { t: 'Manba', render: function (x) { return srcPill(x.trafficSource); } },
          { t: 'Health', r: true, render: function (x) { return h('b', { text: String(x.health), style: { color: 'var(--' + (x.health >= 80 ? 'ok' : x.health >= 60 ? 'warn' : 'crit') + ')' } }); } }
        ], bs, { onRow: function (x) { A.go('branches', { id: x.branchId }); } }));
        if (bs.some(function (x) { return x.connected; })) {
          body.appendChild(h('div', { class: 'section-title', text: 'Tushum taqqoslash' }));
          body.appendChild(U.card(null, null, U.hbar(bs.map(function (x) { return { l: x.name, v: x.revenue }; }), { fmt: mln })));
        }
      } else if (tab === 'xodim') {
        var st = (d.staff || []).slice().sort(function (a, b) { return (b.kpi || 0) - (a.kpi || 0); });
        var mx = Math.max.apply(null, st.map(function (e) { return e.kpi || 0; }).concat([1]));
        if (d.salaryMasked) body.appendChild(A.infobar('info', 'Oylik ma’lumotlari yashirilgan.', 'Rolingiz uchun KPI summalari ko‘rsatilmaydi.'));
        body.appendChild(U.table([
          { t: '#', w: '40px', muted: true, render: function (e) { return String(st.indexOf(e) + 1); } },
          { t: 'Xodim', render: function (e) { return h('div', null, h('b', { text: e.name }), h('div', { class: 'muted', style: { fontSize: '11px' }, text: e.position || '' })); } },
          { t: 'Filial', render: function (e) { return A.branchName(e.branchId); } },
          { t: 'KPI', w: '200px', render: function (e) { return e.kpi == null ? '—' : h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, h('div', { class: 'bar', style: { flex: '1' } }, h('i', { style: { width: Math.round(e.kpi / mx * 100) + '%' } })), h('span', { text: A.num(e.kpi) })); } },
          { t: 'Sotuv', r: true, render: function (e) { return e.sales == null ? '—' : mln(e.sales); } },
          { t: 'Davomat', r: true, render: function (e) { return e.attendance != null ? e.attendance + '%' : '—'; } },
          { t: 'Idle', r: true, render: function (e) { return e.idlePct != null ? e.idlePct + '%' : '—'; } },
          { t: 'AI hodisa', r: true, render: function (e) { return (e.aiEvents || 0) + (e.aiConfirmed ? ' (' + e.aiConfirmed + ' tasdiq)' : ''); } },
          { t: 'Jarima', r: true, render: function (e) { return e.penalties ? A.num(e.penalties) : '—'; } }
        ], st, { empty: 'Xodimlar yo‘q' }));
        body.appendChild(h('div', { class: 'note', style: { marginTop: '8px', fontSize: '12px', color: 'var(--text-3)' }, text: 'AI bahosi taxmin hisoblanadi va jarimaga bevosita ta’sir qilmaydi.' }));
      } else if (tab === 'mijoz') {
        (d.notes || []).forEach(function (n) { body.appendChild(A.infobar('info', 'Izoh', n)); });
        var grid = h('div', { class: 'grid g2', style: { marginTop: '12px' } });
        // Heatmap
        var hm = d.heatmap, hbox = h('div', { style: { padding: '8px 16px 16px', overflowX: 'auto' } });
        if (hm && hm.length) {
          var days = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'], hmx = Math.max.apply(null, [].concat.apply([], hm).concat([1]));
          var hr = h('div', { style: { display: 'grid', gridTemplateColumns: '28px repeat(24, minmax(18px,1fr))', gap: '2px', fontSize: '10px' } }, h('span'));
          for (var i = 0; i < 24; i++) hr.appendChild(h('span', { text: ('0' + i).slice(-2), style: { textAlign: 'center', color: 'var(--text-3)' } }));
          hm.forEach(function (row, di) {
            hr.appendChild(h('span', { text: days[di], style: { color: 'var(--text-2)' } }));
            row.forEach(function (v) { hr.appendChild(h('span', { title: v + ' tashrif', text: String(v), style: { textAlign: 'center', borderRadius: '3px', padding: '3px 0', background: 'color-mix(in srgb, var(--accent) ' + Math.round(8 + v / hmx * 85) + '%, transparent)', color: v / hmx > 0.6 ? '#fff' : 'var(--text-1)' } })); });
          });
          hbox.appendChild(hr);
        } else hbox.appendChild(U.empty('Soatbay tashrif Edge sanash ulanganda ko‘rinadi', 'chart'));
        grid.appendChild(U.card('Mijoz oqimi: hafta kuni × soat', null, hbox));
        grid.appendChild(U.card('Tashrif va konversiya', null, U.table([
          { t: 'Filial', render: function (x) { return A.branchName(x.branchId); } },
          { t: 'Tashrif', r: true, render: function (x) { return A.num(x.traffic); } },
          { t: 'Konversiya', r: true, render: function (x) { return x.conversion + '%'; } },
          { t: 'Manba', render: function (x) { return srcPill(x.source); } }
        ], d.conversion || [], { bare: true })));
        var mood = d.mood, mbox = h('div', { style: { padding: '8px 16px 16px' } });
        if (mood && typeof mood === 'object') mbox.appendChild(U.kvList(Object.keys(mood).map(function (k) { var v = mood[k]; return [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]; })));
        else mbox.appendChild(U.empty('Kayfiyat tahlili audio/video AI ulanganda ko‘rinadi', 'ai'));
        grid.appendChild(U.card('Mijoz kayfiyati', h('span', { class: 'src', text: 'AI · AUDIO + VIDEO' }), mbox));
        grid.appendChild(U.card('Yo‘qotilgan talab', h('span', { class: 'src', text: 'AUDIO AI' }), U.table([
          { t: 'Dori', k: 'name' }, { t: 'So‘rov', r: true, render: function (x) { return x.count + ' so‘rov'; } }, { t: 'Filial', render: function (x) { return x.branchId ? A.branchName(x.branchId) : '—'; } }
        ], d.lostDemand || [], { bare: true, empty: 'Ma’lumot yo‘q' })));
        body.appendChild(grid);
      } else {
        var t = d.total || {};
        body.appendChild(h('div', { class: 'grid g4' },
          U.kpi('Jami hodisalar', { v: A.num(t.total || 0), u: '' }, { icon: 'ai' }),
          U.kpi('Tasdiqlangan', { v: A.num(t.confirmed || 0), u: '' }, { icon: 'ok', foot: 'rad etilgan: ' + (t.rejected || 0) }),
          U.kpi('Kutilmoqda', { v: A.num(t.pending || 0), u: '' }, { icon: 'clock', foot: t.disputed ? 'bahsli: ' + t.disputed : '' }),
          U.kpi('Aniqlik', { v: t.precision != null ? t.precision : '—', u: t.precision != null ? '%' : '' }, { icon: 'check', foot: t.avgConf != null ? 'o‘rtacha ishonch: ' + t.avgConf + '%' : '' })));
        body.appendChild(h('div', { class: 'section-title', text: 'AI hodisalar · inson tasdiqlagan ulush' }));
        body.appendChild(U.table([
          { t: 'Hodisa turi', render: function (x) { return h('div', null, h('div', { text: AI_CODES[x.code] || x.code }), h('div', { class: 'muted mono', style: { fontSize: '11px' }, text: x.code })); } },
          { t: 'Jami', r: true, k: 'total' },
          { t: 'Tasdiq', r: true, k: 'confirmed' },
          { t: 'Rad', r: true, k: 'rejected' },
          { t: 'Kutilmoqda', r: true, k: 'pending' },
          { t: 'Aniqlik', w: '200px', render: function (x) { var p = x.precision; return p == null ? h('span', { class: 'muted', text: 'baholanmagan' }) : h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, h('div', { class: 'bar' + (p >= 70 ? '' : p >= 50 ? ' warn' : ' crit'), style: { flex: '1' } }, h('i', { style: { width: p + '%' } })), h('b', { text: p + '%' })); } },
          { t: 'O‘rt. ishonch', r: true, render: function (x) { return x.avgConf != null ? x.avgConf + '%' : '—'; } }
        ], d.codes || [], { empty: 'Bu davrda AI hodisalar yo‘q' }));
        body.appendChild(h('div', { class: 'note', style: { marginTop: '8px', fontSize: '12px', color: 'var(--text-3)' }, text: 'Tasdiqlash ulushi past bo‘lsa, model ko‘p xato beradi. Bunday turlarda ishonch chegarasi oshiriladi yoki model qayta o‘qitiladi.' }));
      }
    });
  };

  // ═════════════ Hisobotlar ═════════════
  var KINDS = [
    ['daily', 'Kunlik hisobot', 'Tushum, kassa, harajat, AI', ['OWNER', 'FINANCE', 'AUDITOR', 'MANAGER']],
    ['cash', 'Kassa yopilishlari', 'Filial × kun, FOM bilan farqlar', ['OWNER', 'FINANCE', 'AUDITOR', 'MANAGER']],
    ['pnl', 'P&L oylik', 'Filiallar kesimida', ['OWNER', 'FINANCE', 'AUDITOR', 'MANAGER']],
    ['reconciliation', 'Solishtirma dalolatnoma', 'Firma bo‘yicha ledger, imzo uchun', ['OWNER', 'FINANCE', 'AUDITOR']],
    ['payroll', 'Oylik vedomost', 'Xodim × komponent, qulflangan davr', ['OWNER', 'FINANCE', 'AUDITOR', 'MANAGER']],
    ['attendance', 'Davomat tabeli', 'Xodim × kun, T-13 shakliga yaqin', ['OWNER', 'FINANCE', 'HR', 'AUDITOR', 'MANAGER']],
    ['ai', 'AI hodisalar', 'Tasdiq/rad statistikasi, aniqlik', ['OWNER', 'MANAGER', 'OPERATOR', 'AUDITOR']]
  ];
  function kindLabel(k) { var x = KINDS.find(function (y) { return y[0] === k; }); return x ? x[1] : k; }
  var REP_ST = { queued: ['info', 'Navbatda'], running: ['info', 'Tayyorlanmoqda…'], ready: ['ok', 'Tayyor'], failed: ['crit', 'Xato'] };
  function absUrl(u) { return /^https?:/i.test(u) ? u : String(A.info.api_url || '').replace(/\/$/, '') + u; }
  function downloadReport(id) {
    return A.get('/v1/reports/' + encodeURIComponent(id)).then(function (j) {
      if (j.status !== 'ready' || !j.url) { A.toast('info', 'Hali tayyor emas', REP_ST[j.status] ? REP_ST[j.status][1] : j.status); return; }
      return A.openExternal(absUrl(j.url));
    }).catch(function (e) { A.toast('crit', 'Yuklab bo‘lmadi', e.error || String(e)); });
  }

  A.screens.reports = function (page, params, ctx) {
    return A.get('/v1/reports?limit=50').then(function (list) {
      U.guard(ctx);
      page.classList.add('wide');
      var r = role();
      var allowed = KINDS.filter(function (k) { return r === 'SUPER_ADMIN' || k[3].indexOf(r) >= 0; });
      page.appendChild(U.head('Hisobotlar', 'PDF yoki XLSX fayl fonda tayyorlanadi va 7 kun saqlanadi', [U.refreshBtn()]));

      var g = h('div', { class: 'grid g2' });
      allowed.forEach(function (k) {
        g.appendChild(h('div', { class: 'card pad', style: { display: 'flex', alignItems: 'center', gap: '12px' } }, icon('report', 'lg'),
          h('div', { style: { flex: '1', minWidth: '0' } }, h('b', { text: k[1] }), h('div', { class: 'muted', style: { fontSize: '12px', color: 'var(--text-2)' }, text: k[2] })),
          h('button', { class: 'btn', onclick: function () { createReport(k[0], params); } }, 'Tayyorlash')));
      });
      if (!allowed.length) g.appendChild(U.empty('Rolingiz uchun hisobot turlari yo‘q'));
      page.appendChild(g);

      page.appendChild(h('div', { class: 'section-title', text: 'So‘nggi hisobotlar · 7 kun' }));
      page.appendChild(U.table([
        { t: 'Hisobot', render: function (x) { return h('b', { text: kindLabel(x.kind) }); } },
        { t: 'Davr', render: function (x) { return U.fmtDate(x.from) + ' – ' + U.fmtDate(x.to); } },
        { t: 'Filial', render: function (x) { return x.branchId ? A.branchName(x.branchId) : 'Barcha filiallar'; } },
        { t: 'Format', w: '70px', render: function (x) { return String(x.format || '').toUpperCase(); } },
        { t: 'Yaratildi', muted: true, render: function (x) { return U.fmtDateTime(x.createdAt) + (x.createdBy ? ' · ' + x.createdBy : ''); } },
        { t: 'Hajm', r: true, render: function (x) { return x.size ? Math.round(x.size / 1024) + ' KB' : '—'; } },
        { t: 'Status', render: function (x) { var s = REP_ST[x.status] || ['mute', x.status]; return h('span', { title: x.error || '' }, U.pill(s[0], s[1])); } },
        { t: '', r: true, w: '130px', render: function (x) { return x.status === 'ready' ? h('button', { class: 'btn subtle', onclick: function (e) { e.stopPropagation(); downloadReport(x.id); } }, icon('ext'), 'Yuklab olish') : null; } }
      ], list || [], { empty: 'Hali hisobot tayyorlanmagan' }));

      // Navbatdagilar tayyor bo'lguncha yangilab turish
      if ((list || []).some(function (x) { return x.status === 'queued' || x.status === 'running'; })) setTimeout(function () { if (ctx.isCurrent()) A.render(); }, 2500);
      if (params.kind && allowed.some(function (k) { return k[0] === params.kind; })) { var p0 = Object.assign({}, params); if (A.state.params) { delete A.state.params.kind; } createReport(p0.kind, p0); }
    });
  };

  function createReport(kind, params) {
    var fromI = U.input({ type: 'date', value: params.from || U.isoDay(0).slice(0, 8) + '01' }), toI = U.input({ type: 'date', value: params.to || U.isoDay(0) });
    var fmt = 'pdf', fmtSeg = U.seg([['pdf', 'PDF'], ['xlsx', 'XLSX']], fmt, function (v) { fmt = v; });
    var br = isNet() ? U.select(U.branchOptions(true), '', function () {}, '100%') : null, err = h('div', { class: 'err' });
    var body = h('div', { style: { width: '440px', maxWidth: '100%' } },
      h('div', { class: 'form-grid' }, U.field('Boshlanish', fromI), U.field('Tugash', toI)),
      br ? U.field('Filial', br) : h('p', { class: 'note', text: 'Filial: o‘z filialingiz' }),
      U.field('Format', fmtSeg, 'Davr ≤ 366 kun. Fayl 7 kun saqlanadi.'), err);
    A.dialog({ title: kindLabel(kind), body: body, primary: 'Tayyorlash', onPrimary: function () {
      if (!fromI.value || !toI.value || fromI.value > toI.value) { err.textContent = 'Davrni to‘g‘ri tanlang.'; return false; }
      var b = { kind: kind, from: fromI.value, to: toI.value, format: fmt }; if (br && br.value) b.branchId = br.value;
      return A.api('POST', '/v1/reports', b).then(function (job) {
        A.toast('info', 'Tayyorlanmoqda…', '«' + kindLabel(kind) + '» navbatga qo‘yildi.');
        pollReport(job.id, kindLabel(kind), 0); A.render(); return true;
      }).catch(function (e) { err.textContent = e.error || String(e); return false; });
    } });
  }
  function pollReport(id, name, n) {
    if (n > 40) return;
    setTimeout(function () {
      A.get('/v1/reports/' + encodeURIComponent(id)).then(function (j) {
        if (j.status === 'ready') {
          A.toast('ok', '«' + name + '» tayyor', 'Yuklab olish mumkin.');
          if (A.state.route === 'reports') A.render();
        } else if (j.status === 'failed') A.toast('crit', '«' + name + '» tayyorlanmadi', j.error || '');
        else pollReport(id, name, n + 1);
      }).catch(function () { /* jim */ });
    }, 1500);
  }

  // ═════════════ Soliq ═════════════
  var SQ_LV = { high: ['crit', 'Yuqori'], medium: ['warn', 'O‘rta'], low: ['mute', 'Past'] };
  function isErr(x) { return !x || (typeof x === 'object' && 'error' in x); }
  function partErr(x) { return h('div', { class: 'card pad', style: { color: 'var(--crit)' }, text: 'Bu bo‘lim olinmadi: ' + (x && x.error || '—') }); }
  A.screens.tax = function (page, params, ctx) {
    var year = +params.year || new Date().getFullYear(), refresh = params.refresh ? '&refresh=1' : '';
    return A.get('/v1/soliq/status').then(function (st) {
      U.guard(ctx);
      var on = st && st.connected, admin = (role() === 'OWNER' || role() === 'SUPER_ADMIN') && !A.readOnly();
      var tools = [];
      if (on) {
        var years = []; for (var i = 0; i < 4; i++) years.push([String(new Date().getFullYear() - i), String(new Date().getFullYear() - i)]);
        tools.push(U.select(years, String(year), function (v) { goSelf('tax', params, { year: v, refresh: null }); }, '100px'));
        tools.push(h('button', { class: 'btn', onclick: function () { goSelf('tax', params, { refresh: Date.now() }); } }, icon('refresh'), 'Yangilash'));
      }
      page.appendChild(U.head('Soliq', 'my.soliq.uz soliq kabinetidan — faqat o‘qish: kassa (OFD) savdosi, e-faktura xaridlari, soliq yuki va qarzi, xavflar.', tools));

      // Sessiya kartasi
      var actions = h('div', { style: { display: 'flex', gap: '8px' } });
      if (admin) {
        actions.appendChild(h('button', { class: 'btn' + (on ? '' : ' accent'), onclick: connectDialog }, icon('key'), 'Soliq kabinetini ulash'));
        if (on) actions.appendChild(h('button', { class: 'btn subtle', onclick: function () {
          U.confirm('Uzish', 'Soliq sessiyasi serverdan o‘chiriladi. Davom etasizmi?', 'Uzish').then(function (ok) {
            if (!ok) return;
            A.api('DELETE', '/v1/soliq/session').then(function () { A.toast('ok', 'Soliq sessiyasi o‘chirildi'); A.render(); }).catch(function (e) { A.toast('crit', 'Bajarilmadi', e.error || String(e)); });
          });
        } }, 'Uzish'));
      }
      var co = on ? st.company || {} : null;
      page.appendChild(h('div', { class: 'card pad', style: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' } }, icon('tax', 'lg'),
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, h('b', { text: 'my.soliq.uz' }), U.pill(on ? 'ok' : 'mute', on ? 'Ulangan' : 'Ulanmagan')),
          on ? h('div', { class: 'muted', style: { fontSize: '12px', color: 'var(--text-2)' }, text: 'Korxona: ' + (co.name || '—') + ' · STIR ' + (co.tin || '—') + (co.director ? ' · ' + co.director : '') + ' · Token: ' + (st.tokenMinutesLeft != null ? st.tokenMinutesLeft : '—') + ' daq · yangilash tokeni: ' + (st.refreshMinutesLeft != null ? st.refreshMinutesLeft : '—') + ' daq' }) :
            !admin ? h('div', { class: 'muted', style: { fontSize: '12px', color: 'var(--text-2)' }, text: 'Soliq kabinetini faqat egasi yoki super-admin ulay oladi.' }) : null),
        actions));
      if (!on) return;
      var holder = h('div', null, h('p', { class: 'note', text: 'Soliq portalidan olinmoqda… (40 soniyagacha)' }));
      page.appendChild(holder);
      return A.get('/v1/soliq/summary?year=' + year + refresh).then(function (s) { U.guard(ctx); A.clear(holder); soliqBody(holder, s, year); })
        .catch(function (e) { if (e && e.silent) throw e; A.clear(holder); holder.appendChild(A.errorView(e)); });
    });
  };
  function connectDialog() {
    var tok = U.input({ type: 'password', attrs: { autocomplete: 'off' } }), ref = U.input({ type: 'password', attrs: { autocomplete: 'off' } }), err = h('div', { class: 'err' });
    function paste(e) { try { var j = JSON.parse((e.clipboardData || window.clipboardData).getData('text')); if (typeof j.token === 'string' && typeof j.refresh_token === 'string') { e.preventDefault(); tok.value = j.token; ref.value = j.refresh_token; } } catch (x) { /* oddiy token */ } }
    tok.addEventListener('paste', paste); ref.addEventListener('paste', paste);
    var body = h('div', { style: { width: '480px', maxWidth: '100%' } },
      h('p', { class: 'note', text: 'my.soliq.uz ga ERI kalit bilan kiring va sessiyani (soliq_session.json fayli bilan bir xil format) oling. JSON’ni istalgan maydonga qo‘ysangiz, ikkala token o‘zi to‘ladi. Tokenlar serverda shifrlanib saqlanadi va qaytarilmaydi.' }),
      h('code', { class: 'mono', style: { display: 'block', margin: '8px 0', fontSize: '12px' }, text: '{"token": "…", "refresh_token": "…"}' }),
      U.field('Access token', tok), U.field('Refresh token', ref), err);
    A.dialog({ title: 'Soliq kabinetini ulash', body: body, primary: 'Ulash', onPrimary: function () {
      var t = tok.value.trim(), r = ref.value.trim();
      if (!t || !r) { err.textContent = 'Ikkala tokenni kiriting.'; return false; }
      return A.api('PUT', '/v1/soliq/session', { token: t, refresh_token: r }).then(function () { A.toast('ok', 'Soliq kabineti ulandi'); A.render(); return true; })
        .catch(function (e) { err.textContent = e.error || String(e); return false; });
    } });
  }
  function soliqBody(box, s, year) {
    var k = isErr(s.kassa) ? null : s.kassa, p = isErr(s.purchases) ? null : s.purchases, tax = isErr(s.tax) ? null : s.tax, ge = s.grossEstimate;
    box.appendChild(h('div', { class: 'note', style: { fontSize: '12px', color: 'var(--text-3)', marginBottom: '8px' }, text: 'Hisoblangan: ' + U.fmtDateTime(s.computedAt) + ' · kassa ma’lumoti 1 kun kechikadi' + (k && k.lastDay ? ' · ' + k.lastDay : '') }));
    box.appendChild(h('div', { class: 'grid g3' },
      U.kpi('Kassa savdosi (OFD)', k ? k.total : null, { icon: 'cash', foot: k ? 'naqd ' + mln(k.cash) + ' · karta ' + mln(k.card) : '' }),
      U.kpi('Xaridlar (e-faktura)', p ? p.total : null, { icon: 'truck', foot: p ? p.documents + ' hujjat · ' + p.parties + ' firma' : '' }),
      U.kpi('Taxminiy yalpi marja', ge ? ge.value : null, { icon: 'pl', foot: ge && ge.pctOfSales != null ? 'savdodan ' + ge.pctOfSales + '%' : '' }),
      U.kpi('Hisoblangan soliq', tax ? tax.accrued : null, { icon: 'tax', foot: tax && tax.burdenPct != null ? 'Soliq yuki: ' + tax.burdenPct + '%' : '' }),
      U.kpi('To‘langan', tax ? tax.paid : null, { icon: 'pay' }),
      U.kpi('Soliq qarzi', tax ? tax.debt : null, { icon: tax && tax.debt > 0 ? 'warn' : 'ok', foot: tax && tax.overpaid ? 'ortiqcha to‘langan: ' + mln(tax.overpaid) : '' })));

    box.appendChild(h('div', { class: 'section-title', text: 'Xavflar va ogohlantirishlar' }));
    box.appendChild(U.table([
      { t: 'Daraja', w: '100px', render: function (r) { var l = SQ_LV[r.level] || ['mute', r.level]; return U.pill(l[0], l[1]); } },
      { t: 'Mavzu', render: function (r) { return h('b', { text: r.topic }); } },
      { t: 'Tafsilot', k: 'detail', muted: true }
    ], s.risks || [], { empty: 'Ogohlantirish yo‘q', emptyIcon: 'ok' }));

    var g = h('div', { class: 'grid g2', style: { marginTop: '12px' } });
    g.appendChild(k ? U.card('Oylik kassa savdosi', h('span', { class: 'src', text: String(year) }), h('div', { style: { padding: '4px 16px 12px' } }, U.areaChart((k.months || []).map(function (x) { return { l: x.month.slice(5), v: x.total }; })))) : partErr(s.kassa));
    if (isErr(s.terminals)) g.appendChild(partErr(s.terminals));
    else {
      var tr = s.terminals;
      g.appendChild(U.card('Terminallar (filiallar) bo‘yicha', null, h('div', null,
        U.hbar((tr.terminals || []).map(function (x) { return { l: x.address || x.salePoint || x.terminalId, v: x.total }; }), { fmt: mln }),
        tr.idle && tr.idle.length ? h('div', { style: { padding: '0 20px 12px', fontSize: '12px', color: 'var(--warn)' }, text: 'Savdosiz terminallar: ' + tr.idle.map(function (x) { return x.address || x.terminalId; }).join(', ') }) : null)));
    }
    g.appendChild(p ? U.card('Eng katta ta’minotchilar (e-faktura)', p.top5Share != null ? h('span', { class: 'src', text: 'Top-5 ulushi: ' + p.top5Share + '%' }) : null, h('div', null,
      U.hbar((p.top || []).map(function (x) { return { l: x.name, v: x.sum }; }), { fmt: mln }),
      h('div', { style: { padding: '0 20px 12px', fontSize: '12px', color: 'var(--text-3)' }, text: 'Savdo − xarid; qoldiq o‘zgarishi hisobga olinmagan. Aniq marja — FOM tannarxidan.' }))) : partErr(s.purchases));
    g.appendChild(tax ? U.table([
      { t: 'Soliq', k: 'name', clip: true },
      { t: 'Hisoblangan', r: true, render: function (x) { return mln(Math.round(x.accrued)); } },
      { t: 'To‘langan', r: true, render: function (x) { return mln(Math.round(x.paid)); } },
      { t: 'Qarz', r: true, render: function (x) { return x.debt > 0 ? h('span', { style: { color: 'var(--crit)' }, text: mln(Math.round(x.debt)) }) : '—'; } }
    ], tax.taxes || [], { title: 'Soliq turlari (dalolatnoma)' }) : partErr(s.tax));
    box.appendChild(g);

    // Davr bo'yicha terminal savdosi (/v1/soliq/kassa)
    box.appendChild(h('div', { class: 'section-title', text: 'Terminal savdosi · davr bo‘yicha' }));
    var fi = U.input({ type: 'date', value: U.isoDay(30) }), ti = U.input({ type: 'date', value: U.isoDay(1) }); fi.style.width = ti.style.width = '150px';
    var out = h('div');
    function load() {
      A.clear(out); out.appendChild(h('p', { class: 'note', text: 'Olinmoqda…' }));
      A.get('/v1/soliq/kassa' + qs({ from: fi.value, to: ti.value })).then(function (kk) {
        A.clear(out);
        out.appendChild(U.table([
          { t: 'Terminal', render: function (x) { return h('div', null, h('div', { text: x.address || x.salePoint || '—' }), h('div', { class: 'muted mono', style: { fontSize: '11px' }, text: x.terminalId })); } },
          { t: 'Jami', r: true, render: function (x) { return A.num(x.total); } },
          { t: 'Naqd', r: true, render: function (x) { return A.num(x.cash); } },
          { t: 'Karta', r: true, render: function (x) { return A.num(x.card); } },
          { t: 'Qaytarish', r: true, render: function (x) { return x.refund ? A.num(x.refund) : '—'; } },
          { t: 'Ulush', r: true, render: function (x) { return x.share != null ? x.share + '%' : '—'; } }
        ], kk.terminals || [], { title: 'Jami: ' + A.money(kk.total), empty: 'Bu davrda savdo yo‘q' }));
        if (kk.idle && kk.idle.length) out.appendChild(h('div', { style: { marginTop: '8px' } }, A.infobar('warn', 'Savdosiz terminallar', kk.idle.map(function (x) { return x.address || x.salePoint || x.terminalId; }).join(', '))));
      }).catch(function (e) { A.clear(out); out.appendChild(A.infobar('crit', 'Bu bo‘lim olinmadi', e.error || String(e))); });
    }
    box.appendChild(h('div', { class: 'toolbar', style: { marginBottom: '8px' } }, fi, ti, h('button', { class: 'btn', onclick: load }, icon('search'), 'Ko‘rsatish')));
    box.appendChild(out);
    load();
  }
})();
