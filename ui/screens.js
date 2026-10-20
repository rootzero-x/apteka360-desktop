/* Apteka 360 Desktop — native ekranlar. Har bir ekran: (page, params, ctx) => Promise. */
(function () {
  'use strict';
  var A = window.Apteka, h = A.h, icon = A.icon, clear = A.clear;

  // ───────────── Umumiy bo'laklar ─────────────
  function head(title, sub, tools) {
    return h('div', { class: 'page-head' },
      h('div', null, h('h1', { text: title }), sub ? h('div', { class: 'sub', text: sub }) : null),
      tools ? h('div', { class: 'tools' }, tools) : null);
  }
  function refreshBtn() { return h('button', { class: 'btn', onclick: A.render }, icon('refresh'), 'Yangilash'); }
  function card(title, more, body, cls) {
    return h('div', { class: 'card ' + (cls || '') }, title ? h('div', { class: 'card-h' }, h('h3', { text: title }), more ? h('div', { class: 'more' }, more) : null) : null, body);
  }
  function empty(text, ic) { return h('div', { class: 'empty' }, icon(ic || 'inbox'), h('div', { text: text })); }
  function pill(kind, text) { return h('span', { class: 'pill ' + kind, text: text }); }
  function seg(options, value, onchange) {
    var box = h('div', { class: 'seg' });
    options.forEach(function (o) {
      box.appendChild(h('button', { class: o[0] === value ? 'on' : '', onclick: function () { Array.prototype.forEach.call(box.children, function (b) { b.classList.remove('on'); }); this.classList.add('on'); onchange(o[0]); } }, o[1]));
    });
    return box;
  }
  function select(options, value, onchange, width) {
    var s = h('select', { class: 'tb', style: { width: width || '200px' }, onchange: function () { onchange(this.value); } });
    options.forEach(function (o) { var op = h('option', { value: o[0], text: o[1] }); if (o[0] === value) op.selected = true; s.appendChild(op); });
    return s;
  }
  function search(placeholder, oninput, width) {
    return h('div', { style: { position: 'relative', width: width || '260px' } },
      h('input', { class: 'tb', placeholder: placeholder, spellcheck: 'false', oninput: function () { oninput(this.value.trim().toLowerCase()); } }),
      (function () { var i = icon('search'); i.style.cssText = 'position:absolute;right:10px;top:8px;color:var(--text-2);pointer-events:none'; return i; })());
  }
  function svg(tag, attrs) { var e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function spark(values, w, hgt) {
    w = w || 96; hgt = hgt || 26; var s = svg('svg', { viewBox: '0 0 ' + w + ' ' + hgt, class: 'spark', preserveAspectRatio: 'none' });
    if (!values || values.length < 2) return s;
    var mn = Math.min.apply(null, values), mx = Math.max.apply(null, values), rg = mx - mn || 1;
    var pts = values.map(function (v, i) { return (i * w / (values.length - 1)).toFixed(1) + ',' + (hgt - 2 - (v - mn) / rg * (hgt - 4)).toFixed(1); });
    s.appendChild(svg('polyline', { points: pts.join(' '), fill: 'none', stroke: 'var(--accent)', 'stroke-width': '1.5', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    return s;
  }
  function areaChart(series, opts) {
    opts = opts || {};
    var W = 760, H = 220, pl = 56, pb = 24, pt = 10, pr = 10, s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, style: 'width:100%;height:' + H + 'px;display:block' });
    var vals = series.map(function (p) { return p.v; }), mx = Math.max.apply(null, vals.concat([0])), mn = Math.min.apply(null, vals.concat([0]));
    if (mx === 0 && mn === 0) {
      var e = h('div', { class: 'empty', style: { height: H + 'px', display: 'grid', placeItems: 'center' } }, h('div', null, icon('chart'), h('div', { text: opts.emptyText || 'Bu davr uchun ma’lumot yo‘q' })));
      return e;
    }
    var rg = mx - mn || 1, iw = W - pl - pr, ih = H - pt - pb;
    var x = function (i) { return pl + (series.length < 2 ? 0 : i * iw / (series.length - 1)); }, y = function (v) { return pt + ih - (v - mn) / rg * ih; };
    for (var g = 0; g <= 4; g++) {
      var gv = mn + rg * g / 4, gy = y(gv);
      s.appendChild(svg('line', { x1: pl, x2: W - pr, y1: gy, y2: gy, stroke: 'var(--divider)', 'stroke-width': '1' }));
      var t = svg('text', { x: pl - 8, y: gy + 4, 'text-anchor': 'end', 'font-size': '11', fill: 'var(--text-3)' }); t.textContent = A.moneyShort(gv).v; s.appendChild(t);
    }
    series.forEach(function (p, i) {
      if (i % Math.ceil(series.length / 6) !== 0 && i !== series.length - 1) return;
      var t = svg('text', { x: x(i), y: H - 6, 'text-anchor': i === series.length - 1 ? 'end' : i === 0 ? 'start' : 'middle', 'font-size': '11', fill: 'var(--text-3)' }); t.textContent = p.l; s.appendChild(t);
    });
    var line = series.map(function (p, i) { return x(i).toFixed(1) + ',' + y(p.v).toFixed(1); }).join(' ');
    var defs = svg('defs', {}), grad = svg('linearGradient', { id: 'ag', x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.appendChild(svg('stop', { offset: '0', 'stop-color': 'var(--accent)', 'stop-opacity': '.22' })); grad.appendChild(svg('stop', { offset: '1', 'stop-color': 'var(--accent)', 'stop-opacity': '0' }));
    defs.appendChild(grad); s.appendChild(defs);
    if (series.length > 1) {
      s.appendChild(svg('polygon', { points: x(0) + ',' + (pt + ih) + ' ' + line + ' ' + x(series.length - 1) + ',' + (pt + ih), fill: 'url(#ag)' }));
      s.appendChild(svg('polyline', { points: line, fill: 'none', stroke: 'var(--accent)', 'stroke-width': '2', 'stroke-linejoin': 'round' }));
    }
    return s;
  }
  function bars(values, unit) {
    var W = 600, H = 140, s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, style: 'width:100%;height:' + H + 'px;display:block' });
    var mx = Math.max.apply(null, values.concat([1])), bw = W / values.length;
    values.forEach(function (v, i) {
      var bh = Math.max(2, v / mx * (H - 20)), r = svg('rect', { x: (i * bw + 2).toFixed(1), y: (H - 16 - bh).toFixed(1), width: (bw - 4).toFixed(1), height: bh.toFixed(1), rx: '2', fill: i === values.length - 1 ? 'var(--accent)' : 'var(--stroke-strong)' });
      var tt = svg('title', {}); tt.textContent = v + ' ' + (unit || ''); r.appendChild(tt); s.appendChild(r);
    });
    var t1 = svg('text', { x: 0, y: H - 2, 'font-size': '11', fill: 'var(--text-3)' }); t1.textContent = values.length + ' kun oldin'; s.appendChild(t1);
    var t2 = svg('text', { x: W, y: H - 2, 'font-size': '11', fill: 'var(--text-3)', 'text-anchor': 'end' }); t2.textContent = 'bugun'; s.appendChild(t2);
    return s;
  }
  function deltaBadge(d) {
    if (d == null) return null;
    return h('span', { class: 'delta ' + (d > 0 ? 'up' : d < 0 ? 'down' : 'flat'), text: A.pct(d) });
  }
  function kpi(label, value, opts) {
    opts = opts || {}; var m = typeof value === 'object' && value && 'v' in value ? value : A.moneyShort(value);
    return h('div', { class: 'card kpi' },
      h('div', { class: 'lbl' }, opts.icon ? icon(opts.icon) : null, label, opts.src ? h('span', { class: 'src', text: opts.src, style: { marginLeft: 'auto' } }) : null),
      h('div', { class: 'val' }, m.v, m.u ? h('small', { text: m.u }) : null),
      h('div', { class: 'foot' }, deltaBadge(opts.delta), opts.foot ? h('span', { text: opts.foot }) : null, opts.spark && opts.spark.length > 1 ? spark(opts.spark) : null));
  }
  function levelKind(l) { return l === 'crit' || l === 'kritik' || l === 'yuqori' || l === 'down' ? 'crit' : l === 'warn' || l === 'o‘rta' ? 'warn' : l === 'ok' || l === 'past' ? 'ok' : 'info'; }
  function linkTo(path) {
    var m = /^\/branches\/([^/]+)/.exec(path || '');
    if (m) return A.go('branches', { id: m[1] });
    var it = Object.keys(A.routes).map(function (k) { return A.routes[k]; }).find(function (r) { return r.path === path; });
    if (it) A.go(it.id);
  }
  function guard(ctx) { if (!ctx.isCurrent()) throw { silent: true }; }

  // ═════════════ Bosh sahifa ═════════════
  A.screens.dashboard = function (page, params, ctx) {
    var me = A.state.me || {}, hr = new Date().getHours();
    var greet = (hr < 11 ? 'Xayrli tong' : hr < 18 ? 'Xayrli kun' : 'Xayrli kech') + ', ' + String(me.name || '').split(' ')[0];
    var opt = function (p) { return A.get(p).catch(function () { return null; }); };
    return Promise.all([A.get('/v1/dashboard').catch(function (e) { return { __err: e }; }), A.branchesCached(), opt('/v1/approvals'),
      A.can('suppliers') || A.can('payables') ? opt('/v1/suppliers') : null, opt('/v1/fomCashToday'), A.can('ai') ? opt('/v1/aiEvents') : null]).then(function (r) {
      guard(ctx);
      var d = r[0], br = r[1] || [], ap = (r[2] || []).filter(function (a) { return a.status === 'pending'; }), sup = r[3] || [], fomToday = r[4] || {}, aiEv = r[5] || [];
      page.appendChild(head(greet, A.longDate() + ' · so‘nggi 30 kun', [refreshBtn()]));
      if (d.__err) {
        if (d.__err.status !== 403) throw d.__err;
        page.appendChild(A.infobar('info', 'Tarmoq ko‘rsatkichlari sizning rolingiz uchun yopiq.', 'Quyidagi bo‘limlardan foydalanishingiz mumkin.'));
        page.appendChild(quickLinks());
        return;
      }
      if (!d.connected) page.appendChild(A.infobar('info', 'FOM ulanmagan.', 'Tushum, foyda va kassa qoldig‘i FOM sinxronlash agenti ulangandan keyin ko‘rinadi.', A.can('fom') ? h('a', { class: 'link', onclick: function () { A.go('fom'); }, text: 'FOM integratsiya' }) : null));
      var K = { revenue: ['Tushum', 'chart'], grossProfit: ['Yalpi foyda', 'pl'], netProfit: ['Sof foyda', 'pl'], cash: ['Kassadagi pul', 'cash'], payroll: ['Oylik fondi', 'user'], expenses: ['Harajatlar', 'wallet'], supplierDebt: ['Firmalarga qarz', 'truck'], payments7d: ['7 kunda to‘lanadi', 'pay'] };
      // FOM'ga bog'liq qiymat 0 bo'lsa — boshqa haqiqiy manba yoki «FOM ulanmagan»
      var supDebt = sup.reduce(function (a, x) { return a + (x.debt || 0); }, 0), supDue = sup.reduce(function (a, x) { return a + (x.dueSoon || 0) + (x.overdue || 0); }, 0), supOver = sup.reduce(function (a, x) { return a + (x.overdue || 0); }, 0);
      var todayCash = Object.keys(fomToday).reduce(function (a, k) { var f = fomToday[k] || {}; return a + (f.naqd || 0); }, 0);
      var grid = h('div', { class: 'grid g4' });
      (d.kpis || []).forEach(function (k) {
        var m = K[k.key] || [k.key, 'chart'], val = k.value, foot = k.prev != null && k.prev !== 0 ? 'oldingi davr: ' + A.moneyShort(k.prev).v + ' ' + A.moneyShort(k.prev).u.replace(' so‘m', '') : '', src = k.source;
        if (!val && k.key === 'supplierDebt' && supDebt) { val = supDebt; src = 'FIRMALAR'; foot = 'muddati o‘tgan: ' + A.moneyShort(supOver).v + ' ' + A.moneyShort(supOver).u; }
        else if (!val && k.key === 'payments7d' && supDue) { val = supDue; src = 'FIRMALAR'; foot = 'muddati o‘tgan + yaqin to‘lovlar'; }
        else if (!val && k.key === 'cash' && todayCash) { val = todayCash; src = 'FOM BUGUN'; foot = 'bugungi naqd tushum (kassalar)'; }
        var noData = !val && src === 'FOM' && !d.connected;
        grid.appendChild(kpi(m[0], noData ? { v: '—', u: '' } : val, { icon: m[1], delta: noData ? null : k.deltaPct, spark: noData ? null : k.spark, src: src, foot: noData ? 'FOM ulanmagan' : foot }));
      });
      page.appendChild(grid);

      var series = (d.revenueSeries || []).map(function (p) { var dt = new Date(p.date); return { l: dt.getDate() + '.' + ('0' + (dt.getMonth() + 1)).slice(-2), v: p.actual || 0 }; });
      var alerts = h('div', null);
      (d.alerts || []).forEach(function (a) {
        alerts.appendChild(h('div', { class: 'list-item', onclick: function () { linkTo(a.link); } },
          (function () { var i = icon(levelKind(a.level) === 'crit' ? 'crit' : levelKind(a.level) === 'warn' ? 'warn' : 'info'); i.style.color = 'var(--' + levelKind(a.level) + ')'; i.style.marginTop = '2px'; return i; })(),
          h('div', null, h('div', { class: 't', text: a.title }), h('div', { class: 's', text: a.text })),
          icon('chev')));
      });
      if (!d.alerts || !d.alerts.length) alerts.appendChild(empty('Ogohlantirishlar yo‘q', 'ok'));
      var row = h('div', { class: 'grid g21', style: { marginTop: '12px' } },
        card('Tushum dinamikasi', h('span', { class: 'src', text: '30 kun' }), h('div', { style: { padding: '4px 16px 12px' } }, areaChart(series, { emptyText: d.connected ? 'Bu davr uchun tushum yo‘q' : 'FOM ulangach tushum grafigi shu yerda ko‘rinadi' }))),
        card('Diqqat talab qiladi', ap.length ? h('a', { class: 'link', onclick: function () { A.go('approvals'); }, text: ap.length + ' ta tasdiqlash' }) : null, alerts));
      page.appendChild(row);

      // Filiallar jadvali
      var tb = h('tbody');
      br.forEach(function (b) {
        var dlt = b.revenueYesterday ? Math.round((b.revenueToday - b.revenueYesterday) / b.revenueYesterday * 1000) / 10 : null;
        tb.appendChild(h('tr', { class: 'click', onclick: function () { A.go('branches', { id: b.id }); } },
          h('td', null, h('div', { class: 'who' }, h('span', { class: 'dot ' + (b.health >= 80 ? 'ok' : b.health >= 60 ? 'warn' : 'crit') }), h('b', { text: b.short || b.name }))),
          h('td', { class: 'muted', text: b.manager }),
          h('td', { class: 'r', text: A.money(b.revenueToday) }),
          h('td', { class: 'r' }, deltaBadge(dlt)),
          h('td', null, h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, h('div', { class: 'bar ' + (b.health < 60 ? 'crit' : b.health < 80 ? 'warn' : ''), style: { width: '80px' } }, h('i', { style: { width: b.health + '%' } })), h('span', { class: 'muted', text: b.health + '%' }))),
          h('td', null, pill(b.fom && b.fom.status === 'ok' ? 'ok' : b.fom && b.fom.status === 'down' ? 'crit' : 'warn', 'FOM · ' + (b.fom ? b.fom.lag || b.fom.status : '—'))),
          h('td', { class: 'r muted', text: b.camerasOnline + '/' + b.cameras })));
      });
      page.appendChild(h('div', { class: 'section-title', text: 'Filiallar bugun' }));
      page.appendChild(card(null, null, h('div', { class: 'table-wrap' }, h('table', { class: 'dg' },
        h('thead', null, h('tr', null, ['Filial', 'Mudir', 'Tushum', 'Kechaga nisbatan', 'Holat', 'FOM', 'Kameralar'].map(function (t, i) { return h('th', { class: i === 2 || i === 3 || i === 6 ? 'r' : '', text: t }); }))), tb))));

      var mini = h('div', { class: 'grid g2', style: { marginTop: '12px' } });
      if (A.can('approvals')) {
        var apBox = h('div'); ap.slice(0, 5).forEach(function (a) { apBox.appendChild(h('div', { class: 'list-item', onclick: function () { A.go('approvals', { id: a.id }); } }, h('div', { style: { minWidth: '0' } }, h('div', { class: 't', text: a.title }), h('div', { class: 's', text: a.requester + ' · ' + A.branchName(a.branchId) })), h('div', { class: 'meta' }, h('div', { text: a.amount != null ? A.moneyShort(a.amount).v + ' ' + A.moneyShort(a.amount).u : '' })))); });
        if (!ap.length) apBox.appendChild(empty('Kutilayotgan tasdiq yo‘q', 'ok'));
        mini.appendChild(card('Tasdiqlar', h('a', { class: 'link', onclick: function () { A.go('approvals'); }, text: 'Hammasi' }), apBox));
      }
      if (A.can('ai')) {
        var aiBox = h('div'), open = aiEv.filter(function (x) { return x.status === 'pending' || x.status === 'new' || x.status === 'review'; });
        open.slice(0, 5).forEach(function (x) { aiBox.appendChild(h('div', { class: 'list-item', onclick: function () { A.go('ai', { id: x.id }); } }, h('div', { style: { minWidth: '0' } }, h('div', { class: 't', text: x.label || x.code || 'AI hodisa' }), h('div', { class: 's', text: [x.camera, A.branchName(x.branchId), x.date + ' ' + x.time].filter(Boolean).join(' · ') })), h('div', { class: 'meta' }, x.conf != null ? pill(x.priority === 'yuqori' ? 'warn' : 'info', x.conf + '%') : null))); });
        if (!open.length) aiBox.appendChild(empty('Ko‘rib chiqiladigan AI hodisa yo‘q', 'ok'));
        mini.appendChild(card('AI hodisalar', h('a', { class: 'link', onclick: function () { A.go('ai'); }, text: 'Review navbati' }), aiBox));
      }
      if (mini.children.length) page.appendChild(mini);

      if (d.runway) {
        page.appendChild(h('div', { class: 'section-title', text: 'Pul zaxirasi prognozi' }));
        page.appendChild(h('div', { class: 'grid g3' },
          kpi('30 kundan keyin', d.connected ? d.runway.d30 : { v: '—', u: '' }, { icon: 'forecast', foot: d.connected ? '' : 'FOM ulanmagan' }), kpi('60 kundan keyin', d.connected ? d.runway.d60 : { v: '—', u: '' }, { icon: 'forecast', foot: d.connected ? '' : 'FOM ulanmagan' }),
          kpi('Eng past nuqta', d.connected && d.runway.lowest ? d.runway.lowest.value : { v: '—', u: '' }, { icon: 'warn', foot: d.connected && d.runway.lowest ? d.runway.lowest.date : 'FOM ulanmagan' })));
      }
    });
  };
  function quickLinks() {
    var g = h('div', { class: 'grid g3' });
    ['cash', 'cameras', 'approvals', 'notifications', 'employees', 'audit', 'ai', 'schedule', 'attendance', 'profile'].forEach(function (id) {
      var r = A.routes[id]; if (!r || !A.can(id)) return;
      g.appendChild(h('button', { class: 'card pad', style: { textAlign: 'left', display: 'flex', gap: '12px', alignItems: 'center' }, onclick: function () { A.go(id); } }, icon(r.icon, 'lg'), h('b', { text: r.label })));
    });
    return g;
  }

  // ═════════════ Filiallar ═════════════
  A.screens.branches = function (page, params, ctx) {
    return A.get('/v1/branches').then(function (br) {
      guard(ctx); A.state.branches = br;
      page.classList.add('wide');
      page.appendChild(head('Filiallar', br.length + ' ta filial', [refreshBtn()]));
      var sel = params.id || (br[0] && br[0].id), master = h('div', { class: 'card master' }), detail = h('div');
      function paint() {
        clear(master);
        br.forEach(function (b) {
          master.appendChild(h('div', { class: 'md-item' + (b.id === sel ? ' sel' : ''), onclick: function () { sel = b.id; paint(); } },
            h('span', { class: 'dot ' + (b.health >= 80 ? 'ok' : b.health >= 60 ? 'warn' : 'crit') }),
            h('div', { class: 'body' }, h('div', { class: 't', text: b.short || b.name }), h('div', { class: 's', text: b.manager + ' · ' + b.address })),
            h('div', { class: 'end' }, h('div', { text: A.moneyShort(b.revenueToday).v + ' mln' }), h('div', { text: b.health + '%' }))));
        });
        var b = br.find(function (x) { return x.id === sel; }); clear(detail); if (b) detail.appendChild(branchDetail(b));
      }
      paint();
      page.appendChild(h('div', { class: 'md' }, master, detail));
    });
  };
  function branchDetail(b) {
    var dlt = b.revenueYesterday ? Math.round((b.revenueToday - b.revenueYesterday) / b.revenueYesterday * 1000) / 10 : null;
    var expPct = b.expenseLimit ? Math.round(b.expensesToday / b.expenseLimit * 100) : 0;
    var fomK = b.fom && b.fom.status === 'ok' ? 'ok' : b.fom && b.fom.status === 'down' ? 'crit' : 'warn';
    return h('div', null,
      h('div', { class: 'card pad', style: { marginBottom: '12px' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' } },
          h('div', null, h('div', { style: { font: '600 20px/28px var(--font-display)' }, text: b.name }), h('div', { class: 'muted', style: { color: 'var(--text-2)' }, text: b.address + ' · ' + b.hours })),
          h('div', { style: { marginLeft: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' } },
            pill(b.closing === 'open' ? 'info' : b.closing === 'closed' ? 'ok' : 'warn', b.closing === 'open' ? 'Kassa ochiq' : b.closing === 'closed' ? 'Kassa yopilgan' : 'Kassa: ' + b.closing),
            pill(fomK, 'FOM · ' + (b.fom ? b.fom.lag || b.fom.status : '—')),
            pill(b.edge === 'online' ? 'ok' : 'crit', 'Edge · ' + (b.edge === 'online' ? 'onlayn' : 'oflayn'))))),
      h('div', { class: 'grid gauto' },
        kpi('Bugungi tushum', b.revenueToday, { icon: 'chart', delta: dlt, foot: 'kecha: ' + A.moneyShort(b.revenueYesterday).v }),
        kpi('Yalpi foyda', b.grossToday, { icon: 'pl', foot: 'marja ' + b.margin + '%' }),
        h('div', { class: 'card kpi' }, h('div', { class: 'lbl' }, icon('wallet'), 'Xarajatlar'), h('div', { class: 'val' }, A.moneyShort(b.expensesToday).v, h('small', { text: A.moneyShort(b.expensesToday).u })),
          h('div', { class: 'foot', style: { flexDirection: 'column', alignItems: 'stretch', gap: '4px' } }, h('div', { class: 'bar ' + (expPct > 100 ? 'crit' : expPct > 80 ? 'warn' : '') }, h('i', { style: { width: Math.min(100, expPct) + '%' } })), h('span', { text: expPct + '% · limit ' + A.moneyShort(b.expenseLimit).v + ' mln' }))),
        kpi('Smenada', { v: b.onShift + ' / ' + b.employees, u: 'xodim' }, { icon: 'people', foot: b.desks + ' ta kassa' })),
      h('div', { class: 'grid gauto', style: { marginTop: '12px' } },
        kpi('Kameralar', { v: b.camerasOnline + ' / ' + b.cameras, u: 'onlayn' }, { icon: 'cam' }),
        kpi('Tashrif', { v: A.num(b.traffic), u: 'kishi' }, { icon: 'people' }),
        kpi('Konversiya', { v: b.conversion + '%', u: '' }, { icon: 'chart' }),
        kpi('Navbat', { v: String(b.queue), u: 'kishi' }, { icon: 'clock' })),
      (function () { var c = card('Tushum · 30 kun', h('span', { class: 'src', text: 'mln so‘m' }), h('div', { style: { padding: '8px 20px 16px' } }, bars(b.revenue30 || [], 'mln so‘m'))); c.style.marginTop = '12px'; return c; })(),
      (function () {
        var c = card('Ma’lumotlar', null, h('div', { class: 'kv', style: { padding: '0 20px 8px' } },
          h('div', { text: 'Mudir' }), h('div', { text: b.manager }), h('div', { text: 'Manzil' }), h('div', { text: b.address }),
          h('div', { text: 'Ish vaqti' }), h('div', { text: b.hours }), h('div', { text: 'FOM oxirgi sinx.' }), h('div', { text: b.fom ? (b.fom.last + ' · ' + (b.fom.lag || '')) : '—' }),
          h('div', { text: 'Bugungi AI hodisalar' }), h('div', { text: String(b.aiToday == null ? '—' : b.aiToday) })));
        c.style.marginTop = '12px'; return c;
      })(),
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '12px' } },
        h('button', { class: 'btn', onclick: function () { A.go('cash', { branch: b.id }); } }, icon('cash'), 'Kassa'),
        h('button', { class: 'btn', onclick: function () { A.go('cameras', { branch: b.id }); } }, icon('cam'), 'Kameralar'),
        h('button', { class: 'btn', onclick: function () { A.go('employees', { branch: b.id }); } }, icon('people'), 'Xodimlar')));
  }

  // ═════════════ Xodimlar ═════════════
  var EMP_ST = { 'ishda': 'ok', 'tanaffus': 'info', 'kech qoldi': 'warn', 'kasal': 'warn', 'ta’til': 'mute', 'smena yo‘q': 'mute' };
  A.screens.employees = function (page, params, ctx) {
    return Promise.all([A.get('/v1/employees'), A.branchesCached()]).then(function (r) {
      guard(ctx);
      var list = r[0] || [], q = '', br = params.branch || '', st = '';
      var tb = h('tbody'), count = h('span');
      function paint() {
        clear(tb); var n = 0;
        list.filter(function (e) {
          return (!br || e.branchId === br) && (!st || e.status === st) && (!q || (e.name + ' ' + e.position + ' ' + (e.phone || '')).toLowerCase().indexOf(q) >= 0);
        }).forEach(function (e) {
          n++;
          tb.appendChild(h('tr', { class: 'click', ondblclick: function () { empDialog(e); }, onclick: function () { empDialog(e); } },
            h('td', null, h('div', { class: 'who' }, h('span', { class: 'avatar sm', text: e.ini || A.initials(e.name) }), h('div', null, h('div', { style: { fontWeight: '600' }, text: e.name }), h('div', { class: 'muted', style: { fontSize: '12px' }, text: e.position })))),
            h('td', { class: 'muted', text: A.branchName(e.branchId) }),
            h('td', null, pill(EMP_ST[e.status] || 'mute', e.status)),
            h('td', { class: 'muted', text: e.schedule || '—' }),
            h('td', { class: 'r', text: e.attendance != null ? e.attendance + '%' : '—' }),
            h('td', { class: 'r muted', text: e.late != null ? String(e.late) : '—' }),
            h('td', null, e.risk ? pill('warn', e.risk) : h('span', { class: 'muted', text: '—' })),
            h('td', { class: 'muted', text: e.phone || '' })));
        });
        count.textContent = n + ' ta xodim';
        if (!n) tb.appendChild(h('tr', null, h('td', { colspan: '8' }, empty('Hech narsa topilmadi', 'search'))));
      }
      var branches = [['', 'Barcha filiallar']].concat((A.state.branches || []).map(function (b) { return [b.id, b.short || b.name]; }));
      var statuses = [['', 'Barcha holatlar']].concat(Object.keys(EMP_ST).map(function (s) { return [s, s[0].toUpperCase() + s.slice(1)]; }));
      page.appendChild(head('Xodimlar', null, [search('Ism, lavozim yoki telefon', function (v) { q = v; paint(); }), select(branches, br, function (v) { br = v; paint(); }, '180px'), select(statuses, '', function (v) { st = v; paint(); }, '160px'), refreshBtn()]));
      page.querySelector('.page-head > div').appendChild(h('div', { class: 'sub' }, count));
      page.appendChild(card(null, null, h('div', { class: 'table-wrap' }, h('table', { class: 'dg' },
        h('thead', null, h('tr', null, ['Xodim', 'Filial', 'Holat', 'Jadval', 'Davomat', 'Kechikish', 'Xavf', 'Telefon'].map(function (t, i) { return h('th', { class: i === 4 || i === 5 ? 'r' : '', text: t }); }))), tb))));
      paint();
    });
  };
  function empDialog(e) {
    var rows = [['Lavozim', e.position], ['Filial', A.branchName(e.branchId)], ['Holat', e.status], ['Ish jadvali', e.schedule], ['Telefon', e.phone], ['Ishga kirgan', e.hired], ['Shartnoma', e.contract],
      ['Davomat', e.attendance != null ? e.attendance + '% · kechikish ' + e.late + ' · kelmagan ' + e.absent : null], ['Hujjatlar', e.docs], ['FOM login', e.fomLogin]];
    if (e.oklad != null) rows = rows.concat([['Oklad', A.money(e.oklad)], ['KPI + bonus', A.money((e.kpi || 0) + (e.bonus || 0))], ['Hisoblangan', A.money(e.gross)], ['Qo‘lga', A.money(e.net)]]);
    var kv = h('div', { class: 'kv' }); rows.forEach(function (r) { if (r[1] == null || r[1] === '') return; kv.appendChild(h('div', { text: r[0] })); kv.appendChild(h('div', { text: String(r[1]) })); });
    A.dialog({ title: e.name, body: h('div', null, h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' } }, h('span', { class: 'avatar', text: e.ini || A.initials(e.name) }), e.risk ? pill('warn', e.risk) : null), kv), primary: 'Yopish', secondary: false });
  }

  // ═════════════ Kassa ═════════════
  A.screens.cash = function (page, params, ctx) {
    var me = A.state.me || {}, network = me.scope === 'all' || (me.branchIds && me.branchIds.length > 1);
    return Promise.all([A.branchesCached(), A.get('/v1/fomCashToday').catch(function () { return {}; }), A.get('/v1/settings').catch(function () { return {}; })]).then(function (r) {
      guard(ctx);
      var br = r[0] || [], fomAll = r[1] || {}, settings = r[2] || {}, threshold = settings.cashThreshold || 50000;
      var bid = params.branch || me.branchId || (br[0] && br[0].id);
      var body = h('div');
      page.appendChild(head('Kassa', 'Kunlik yopilish va FOM bilan solishtirish', [
        network ? select(br.map(function (b) { return [b.id, b.short || b.name]; }), bid, function (v) { bid = v; load(); }, '200px') : null, refreshBtn()]));
      page.appendChild(body);
      function load() {
        clear(body); body.appendChild(h('div', { class: 'empty' }, h('span', { class: 'ring' })));
        A.get('/v1/desktop' + (network ? '?branchId=' + encodeURIComponent(bid) : '')).then(function (desk) {
          if (!ctx.isCurrent()) return;
          clear(body); paint(desk || {});
        }).catch(function (e) { clear(body); body.appendChild(A.errorView(e)); });
      }
      function paint(desk) {
        var b = br.find(function (x) { return x.id === (desk.branchId || bid); }) || {};
        var fom = fomAll[desk.branchId || bid] || null;
        if (desk.serverEdit) body.appendChild(A.infobar('warn', 'Web-panelda tahrir bor.', desk.serverEdit.by + ' · ' + desk.serverEdit.time + ' · naqd ' + A.money(desk.serverEdit.naqd) + (desk.serverEdit.note ? ' · «' + desk.serverEdit.note + '»' : '')));
        // FOM bugun
        if (fom) {
          var tot = (fom.naqd || 0) + (fom.karta || 0) + (fom.qr || 0);
          body.appendChild(h('div', { class: 'grid g4' }, kpi('Naqd (FOM)', fom.naqd, { icon: 'cash' }), kpi('Karta (FOM)', fom.karta, { icon: 'pay' }), kpi('QR (FOM)', fom.qr, { icon: 'module' }), kpi('Jami (FOM)', tot, { icon: 'chart', foot: b.short || '' })));
        } else body.appendChild(A.infobar('info', 'FOM ma’lumoti yo‘q.', 'Bu filial uchun bugungi FOM yig‘indisi kelmagan — kiritilgan summalar solishtirilmaydi.'));

        // Yopish formasi
        var inputs = {}, diffs = {}, totalDiff = h('span'), reasonBox, reason = h('textarea', { class: 'tb', placeholder: 'Masalan: terminal cheki chiqmagan 2 ta savdo' });
        var kassaSel = select(Array.apply(null, { length: Math.max(1, b.desks || 1) }).map(function (_, i) { return ['Kassa ' + (i + 1), 'Kassa ' + (i + 1)]; }), 'Kassa 1', function () {}, '160px');
        function parse(v) { return parseInt(String(v).replace(/\D/g, ''), 10) || 0; }
        function fmt(el) { var n = parse(el.value); var pos = el.value.length - el.selectionStart; el.value = n ? A.num(n) : ''; try { var p = Math.max(0, el.value.length - pos); el.setSelectionRange(p, p); } catch (e) {} }
        function recalc() {
          var sum = 0;
          ['naqd', 'karta', 'qr'].forEach(function (k) {
            var raw = inputs[k].value.trim(), v = parse(raw), f = fom ? fom[k] || 0 : null, d = f == null || !raw ? null : v - f;
            if (d == null) { diffs[k].textContent = '—'; diffs[k].className = 'diff'; }
            else { diffs[k].textContent = (d > 0 ? '+' : '') + A.num(d); diffs[k].className = 'diff ' + (Math.abs(d) > threshold ? 'bad' : 'ok'); sum += d; }
          });
          var any = ['naqd', 'karta', 'qr'].some(function (k) { return inputs[k].value.trim(); });
          if (any && fom) ['naqd', 'karta', 'qr'].forEach(function (k) { if (!inputs[k].value.trim()) sum -= fom[k] || 0; });
          totalDiff.textContent = fom && any ? ((sum > 0 ? '+' : '') + A.money(sum)) : '—';
          totalDiff.style.color = !any ? 'var(--text-2)' : fom && Math.abs(sum) > threshold ? 'var(--crit)' : 'var(--ok)';
          var need = fom && any && Math.abs(sum) > threshold; reasonBox.querySelector('label').textContent = need ? 'Sabab (majburiy — farq chegaradan katta)' : 'Izoh (ixtiyoriy)';
          return { sum: sum, need: need };
        }
        var rows = h('div');
        [['naqd', 'Naqd'], ['karta', 'Karta'], ['qr', 'QR / Click / Payme']].forEach(function (x) {
          inputs[x[0]] = h('input', { class: 'tb num', inputmode: 'numeric', placeholder: '0', oninput: function () { fmt(this); recalc(); } });
          diffs[x[0]] = h('span', { class: 'diff', text: '—' });
          rows.appendChild(h('div', { class: 'cash-row' }, h('span', { class: 'lbl', text: x[1] }), inputs[x[0]], h('span', { class: 'fom', text: fom ? 'FOM: ' + A.num(fom[x[0]] || 0) : 'FOM: —' }), diffs[x[0]]));
        });
        reasonBox = h('div', { class: 'field' }, h('label', { text: 'Izoh (ixtiyoriy)' }), reason, h('div', { class: 'hint', text: 'Chegara: ' + A.money(threshold) + '. Undan katta farqda sabab majburiy va yopilish moliya tasdig‘iga tushadi.' }));
        var errEl = h('div', { class: 'err' });
        var submit = h('button', { class: 'btn accent' }, icon('check'), 'Kassani yopish');
        submit.onclick = function () {
          errEl.textContent = '';
          var c = recalc(), input = { queueId: A.uuid(), kassa: kassaSel.value, naqd: parse(inputs.naqd.value), karta: parse(inputs.karta.value), qr: parse(inputs.qr.value), reason: reason.value.trim() || null, offline: false };
          if (desk.version != null) input.baseVersion = desk.version;
          if (network) input.branchId = desk.branchId || bid;
          if (!input.naqd && !input.karta && !input.qr) { errEl.textContent = 'Kamida bitta summani kiriting.'; return; }
          if (c.need && !input.reason) { errEl.textContent = 'Farq chegaradan katta — sabab majburiy.'; reason.focus(); return; }
          var sumTxt = A.money(input.naqd + input.karta + input.qr);
          A.dialog({
            title: input.kassa + ' yopilsinmi?',
            body: h('div', null, h('div', { class: 'kv' }, h('div', { text: 'Filial' }), h('div', { text: b.short || b.name || '' }), h('div', { text: 'Naqd' }), h('div', { text: A.money(input.naqd) }), h('div', { text: 'Karta' }), h('div', { text: A.money(input.karta) }), h('div', { text: 'QR' }), h('div', { text: A.money(input.qr) }), h('div', { text: 'Jami' }), h('div', { style: { fontWeight: '600' }, text: sumTxt }), h('div', { text: 'FOM bilan farq' }), h('div', { text: fom ? A.money(c.sum) : '—' }))),
            primary: 'Yopish',
            onPrimary: function () {
              return A.cmd('desk.cashClose', input, { idem: input.queueId }).then(function (res) {
                A.toast('ok', 'Kassa yopildi', input.kassa + ' · ' + sumTxt + (res && res.status === 'review' ? ' · moliya tasdig‘iga yuborildi' : ''));
                load();
              }).catch(function (e) {
                if (e.status === 409 && e.details && e.details.naqd != null) { setTimeout(function () { conflict(input, e.details); }, 50); return; }
                errEl.textContent = e.error || String(e);
              });
            }
          });
        };
        var form = card('Kassani yopish', kassaSel, h('div', { style: { padding: '4px 20px 20px' } }, rows,
          h('div', { class: 'total-row' }, h('span', { text: 'FOM bilan umumiy farq' }), totalDiff), reasonBox, errEl,
          h('div', { style: { display: 'flex', gap: '8px', marginTop: '12px' } }, submit, h('button', { class: 'btn', onclick: function () { ['naqd', 'karta', 'qr'].forEach(function (k) { inputs[k].value = ''; }); reason.value = ''; recalc(); } }, 'Tozalash'))));
        form.style.marginTop = '12px';
        var closings = h('div');
        (desk.closings || []).forEach(function (c) {
          var st = c.status === 'accepted' ? ['ok', 'Qabul qilindi'] : c.status === 'review' ? ['warn', 'Tasdiqda'] : c.status === 'synced' ? ['ok', 'Sinxronlandi'] : ['mute', c.status];
          closings.appendChild(h('div', { class: 'list-item' }, icon('cash'), h('div', null, h('div', { class: 't', text: c.kassa + ' · ' + A.money((c.naqd || 0) + (c.karta || 0) + (c.qr || 0)) }), h('div', { class: 's', text: (c.by || '') + (c.reason ? ' · ' + c.reason : '') })), h('div', { class: 'meta' }, pill(st[0], st[1]))));
        });
        if (!desk.closings || !desk.closings.length) closings.appendChild(empty('Bugun hali yopilish yo‘q', 'cash'));
        var cl = card('Bugungi yopilishlar', null, closings); cl.style.marginTop = '12px';
        body.appendChild(h('div', { class: 'grid g21' }, form, cl));
        recalc();
        setTimeout(function () { inputs.naqd.focus(); }, 50);
      }
      function conflict(input, srv) {
        var how = null;
        var opts = h('div', null,
          h('p', { class: 'note', text: 'Bu kassa yopilishi web-panelda ham kiritilgan. Qaysi versiyani saqlash kerak?' }),
          h('div', { class: 'grid g2', style: { marginTop: '12px' } },
            h('div', { class: 'card pad' }, h('b', { text: 'Bu kompyuterda' }), h('div', { text: 'Naqd: ' + A.money(input.naqd) }), h('div', { class: 'muted', style: { color: 'var(--text-2)' }, text: 'Desktop ilova' })),
            h('div', { class: 'card pad' }, h('b', { text: 'Serverda' }), h('div', { text: 'Naqd: ' + A.money(srv.naqd) }), h('div', { style: { color: 'var(--text-2)' }, text: (srv.by || '') + ' · ' + (srv.time || '') + (srv.note ? ' · «' + srv.note + '»' : '') }))),
          h('div', { class: 'field' }, h('label', { text: 'Tanlov' }), select([['local', 'Kompyuterdagini saqlash (mudir/Egasi)'], ['server', 'Serverdagini qabul qilish'], ['both', 'Ikkalasini moliya tasdig‘iga yuborish']], 'both', function (v) { how = v; }, '100%')));
        how = 'both';
        A.dialog({ title: 'Ziddiyat: ikki joyda kiritilgan', body: opts, primary: 'Davom etish', onPrimary: function () {
          return A.cmd('desk.resolveConflict', { queueId: A.uuid(), how: how, local: input }).then(function (r) { A.toast('ok', 'Ziddiyat hal qilindi', r && r.status === 'review' ? 'Moliya tasdig‘iga yuborildi' : 'Sinxronlandi'); load(); })
            .catch(function (e) { A.toast('crit', 'Bajarilmadi', e.error || String(e)); return false; });
        } });
      }
      load();
    });
  };

  // ═════════════ Kameralar ═════════════
  A.screens.cameras = function (page, params, ctx) {
    return Promise.all([A.get('/v1/cameras'), A.branchesCached()]).then(function (r) {
      guard(ctx);
      var cams = r[0] || [], br = params.branch || '', stf = '', viewerBox = h('div'), gridBox = h('div');
      var online = cams.filter(function (c) { return c.status === 'online'; }).length;
      page.classList.add('wide');
      page.appendChild(head('Kameralar', online + ' / ' + cams.length + ' onlayn', [
        select([['', 'Barcha filiallar']].concat((A.state.branches || []).map(function (b) { return [b.id, b.short || b.name]; })), br, function (v) { br = v; paint(); }, '180px'),
        seg([['', 'Hammasi'], ['online', 'Onlayn'], ['offline', 'Oflayn']], '', function (v) { stf = v; paint(); }), refreshBtn()]));
      page.appendChild(viewerBox); page.appendChild(gridBox);
      var player = null;
      A._dispose = function () { if (player) player.destroy(); };
      function open(c) { if (player) player.destroy(); clear(viewerBox); player = viewer(c, viewerBox, function () { player = null; clear(viewerBox); }); document.getElementById('view').scrollTop = 0; }
      function paint() {
        clear(gridBox);
        var groups = {};
        cams.filter(function (c) { return (!br || c.branchId === br) && (!stf || (stf === 'online' ? c.status === 'online' : c.status !== 'online')); })
          .forEach(function (c) { (groups[c.branchId] = groups[c.branchId] || []).push(c); });
        var keys = Object.keys(groups);
        if (!keys.length) gridBox.appendChild(card(null, null, empty('Kamera topilmadi', 'cam')));
        keys.forEach(function (bid) {
          gridBox.appendChild(h('div', { class: 'section-title', text: A.branchName(bid) + ' · ' + groups[bid].length + ' ta' }));
          var g = h('div', { class: 'cam-grid' });
          groups[bid].forEach(function (c) {
            var ok = c.status === 'online';
            g.appendChild(h('button', { class: 'card cam', style: { textAlign: 'left', padding: '0' }, onclick: function () { if (ok) open(c); else A.toast('info', c.name, 'Kamera oflayn — oxirgi aloqa: ' + (c.last || '—')); } },
              h('div', { class: 'thumb' }, icon('cam'), h('span', { class: 'st' }, pill(ok ? (c.health === 'warn' ? 'warn' : 'ok') : 'crit', ok ? (c.fps ? c.fps + ' fps' : 'onlayn') : 'oflayn'))),
              h('div', { class: 'meta' }, h('div', { class: 't', text: c.name }), h('div', { class: 's', text: [c.zones, c.ai].filter(Boolean).join(' · ') || '—' }))));
          });
          gridBox.appendChild(g);
        });
      }
      paint();
    });
  };
  function viewer(c, host, onClose) {
    var video = h('video', { playsinline: true, muted: true, autoplay: true }), msg = h('div', { class: 'msg' }, h('div', null, h('span', { class: 'ring' }), h('div', { style: { marginTop: '10px' }, text: 'Oqim ochilmoqda…' })));
    var box = h('div', { class: 'viewer' }, video, msg, h('span', { class: 'live', text: 'JONLI' }));
    var quality = 'sub', hls = null, dead = false, renew = null, audio = null, sound = false, talk = null;
    var soundBtn = h('button', { class: 'btn', disabled: true }, icon('mute'), 'Ovoz');
    var talkBtn = h('button', { class: 'btn talk', disabled: true, title: 'Bosib turing va gapiring' }, icon('mic'), 'Gapirish');
    var talkInfo = h('span', { class: 'muted', style: { color: 'var(--text-2)', fontSize: '12px' } });
    var qSeg = seg([['sub', 'Tez (SD)'], ['main', 'Sifatli (HD)']], quality, function (v) { quality = v; start(); });
    var bar = h('div', { class: 'viewer-bar' }, h('b', { text: c.name, style: { marginRight: '8px' } }), qSeg, soundBtn, talkBtn, talkInfo, h('span', { class: 'spacer', style: { flex: '1' } }),
      h('button', { class: 'btn', onclick: function () { (box.requestFullscreen || box.webkitRequestFullscreen).call(box); } }, icon('full'), 'To‘liq ekran'),
      h('button', { class: 'btn subtle', onclick: function () { destroy(); onClose(); }, title: 'Yopish' }, icon('close')));
    var wrap = h('div', { class: 'card pad', style: { marginBottom: '16px' } }, box, bar);
    host.appendChild(wrap);
    function fail(t) { clear(msg); msg.style.display = ''; msg.appendChild(h('div', { text: t })); }
    function start() {
      if (dead) return;
      clearTimeout(renew); if (hls) { hls.destroy(); hls = null; }
      msg.style.display = ''; clear(msg); msg.appendChild(h('div', null, h('span', { class: 'ring' }), h('div', { style: { marginTop: '10px' }, text: 'Oqim ochilmoqda…' })));
      A.cmd('cameras.streamUrl', { id: c.id, quality: quality }).then(function (u) {
        if (dead) return;
        audio = u.audio || null;
        soundBtn.disabled = !(audio && audio.in); talkBtn.disabled = !(audio && audio.out);
        if (!audio || !audio.in) soundBtn.title = 'Kamerada mikrofon yo‘q'; if (!audio || !audio.out) talkBtn.title = 'Kamerada karnay yo‘q';
        var Hls = window.Hls;
        if (!Hls || !Hls.isSupported()) { if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = u.hlsUrl; video.play().catch(function () {}); msg.style.display = 'none'; } else fail('Bu kompyuterda HLS qo‘llab-quvvatlanmaydi'); return; }
        hls = new Hls({ lowLatencyMode: false, liveSyncDurationCount: 3, liveMaxLatencyDurationCount: 8, maxLiveSyncPlaybackRate: 1.2, backBufferLength: 10, maxBufferLength: 12, manifestLoadingMaxRetry: 4, levelLoadingMaxRetry: 6, fragLoadingMaxRetry: 6, enableWorker: true });
        hls.on(Hls.Events.ERROR, function (_e, d) {
          if (!d.fatal) return;
          if (d.type === Hls.ErrorTypes.MEDIA_ERROR) { hls.recoverMediaError(); return; }
          if (d.type === Hls.ErrorTypes.NETWORK_ERROR && !(d.response && d.response.code)) { hls.startLoad(); return; }
          fail('Oqim xatosi: ' + (d.response && d.response.code ? 'HTTP ' + d.response.code : d.details));
        });
        hls.on(Hls.Events.MANIFEST_PARSED, function () { video.play().catch(function () {}); });
        video.addEventListener('playing', function () { msg.style.display = 'none'; }, { once: true });
        hls.loadSource(u.hlsUrl); hls.attachMedia(video);
        var ms = u.expiresAt ? new Date(u.expiresAt).getTime() - Date.now() - 60000 : 240000;
        renew = setTimeout(start, Math.max(30000, ms));
      }).catch(function (e) {
        var r = e.details && e.details.reason;
        fail(r === 'edge_offline' ? 'Filial Edge serveri oflayn — jonli ko‘rish mavjud emas.' : e.status === 403 ? (e.error || 'Bu kamera maxfiy yoki ruxsat yo‘q.') : (e.error || 'Oqimni ochib bo‘lmadi'));
      });
    }
    soundBtn.onclick = function () {
      sound = !sound; video.muted = !sound; if (sound) video.play().catch(function () {});
      clear(soundBtn); soundBtn.appendChild(icon(sound ? 'vol' : 'mute')); soundBtn.appendChild(document.createTextNode(sound ? 'Ovozsiz' : 'Ovoz'));
      if (sound && quality !== 'main') { quality = 'main'; Array.prototype.forEach.call(qSeg.children, function (b, i) { b.classList.toggle('on', i === 1); }); start(); }
    };
    // Bosib turib gapirish: mikrofon → 8 kHz PCM16 → Edge (cameras.talk imzolagan URL)
    function talkStart() {
      if (talk || talkBtn.disabled) return;
      talk = pushToTalk(c.id, function (state, text) {
        talkBtn.classList.toggle('on', state === 'talking' || state === 'starting');
        talkInfo.textContent = text || ''; talkInfo.style.color = state === 'error' ? 'var(--crit)' : 'var(--text-2)';
        if (state === 'idle' || state === 'error') talk = null;
      });
    }
    function talkStop() { if (talk) talk.stop(); }
    talkBtn.addEventListener('pointerdown', function (e) { e.preventDefault(); talkStart(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) { talkBtn.addEventListener(n, talkStop); });
    talkBtn.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); talkStart(); } });
    talkBtn.addEventListener('keyup', talkStop);
    function destroy() { dead = true; clearTimeout(renew); if (hls) hls.destroy(); hls = null; talkStop(); try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {} }
    start();
    return { destroy: destroy };
  }
  function pushToTalk(camId, onState) {
    var RATE = 8000, CHUNK_MS = 200, stream = null, ctx = null, url = '', chain = Promise.resolve(), dead = false, timer = null, startedAt = Date.now(), maxSec = 60;
    function post(suffix, body) {
      return fetch(url + suffix, { method: 'POST', body: body, headers: body ? { 'Content-Type': 'application/octet-stream' } : undefined, keepalive: !body }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (out) { if (!r.ok) throw Object.assign(new Error(out.error || 'HTTP ' + r.status), { code: r.status, reason: out.reason }); return out; });
      });
    }
    function stop(why) {
      if (dead) return; dead = true; clearInterval(timer);
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      if (ctx) ctx.close().catch(function () {});
      if (url) chain.then(function () { return post('&op=stop'); }).catch(function () {});
      onState(why ? 'error' : 'idle', why || '');
    }
    onState('starting', 'Ulanmoqda…');
    navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (s) {
      stream = s; return A.cmd('cameras.talk', { id: camId });
    }).then(function (t) {
      if (dead) return; url = t.talkUrl; maxSec = t.maxSec || 60; return post('&op=start');
    }).then(function () {
      if (dead) return;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      var src = ctx.createMediaStreamSource(stream), proc = ctx.createScriptProcessor(4096, 1, 1), ratio = ctx.sampleRate / RATE, acc = [], carry = 0;
      proc.onaudioprocess = function (e) {
        var input = e.inputBuffer.getChannelData(0), pos = carry;
        while (pos + ratio <= input.length) { var sum = 0, n = 0; for (var i = Math.floor(pos); i < pos + ratio; i++) { sum += input[i]; n++; } acc.push(Math.max(-1, Math.min(1, sum / n))); pos += ratio; }
        carry = pos - input.length;
        if (acc.length >= RATE * CHUNK_MS / 1000) {
          var pcm = new Int16Array(acc.length); for (var j = 0; j < acc.length; j++) pcm[j] = acc[j] < 0 ? acc[j] * 0x8000 : acc[j] * 0x7fff; acc = [];
          chain = chain.then(function () { return post('', pcm.buffer); }).catch(function (er) { stop(er.reason === 'max' ? 'Seans tugadi (60 s)' : 'Uzildi: ' + er.message); });
        }
      };
      src.connect(proc); proc.connect(ctx.destination);
      onState('talking', 'Gapiryapsiz · 0 s');
      timer = setInterval(function () { var s = Math.floor((Date.now() - startedAt) / 1000); onState('talking', 'Gapiryapsiz · ' + s + ' s'); if (s >= maxSec) stop('Seans tugadi (60 s)'); }, 500);
    }).catch(function (e) {
      var why = e && (e.name === 'NotAllowedError' || e.name === 'NotFoundError') ? 'Mikrofonga ruxsat yo‘q yoki mikrofon topilmadi' : e && (e.code === 409 || e.status === 409) ? 'Kameraga hozir boshqa xodim gapiryapti' : 'Gapirish ishlamadi: ' + ((e && (e.error || e.message)) || e);
      dead = false; stop(why);
    });
    return { stop: function () { stop(); } };
  }

  // ═════════════ Tasdiqlashlar ═════════════
  var RISK = { 'yuqori': 'crit', 'o‘rta': 'warn', 'past': 'ok' };
  var AP_ST = { pending: ['warn', 'Kutilmoqda'], approved: ['ok', 'Tasdiqlangan'], rejected: ['crit', 'Rad etilgan'], changes: ['info', 'O‘zgartirish so‘ralgan'] };
  A.screens.approvals = function (page, params, ctx) {
    return Promise.all([A.get('/v1/approvals'), A.branchesCached()]).then(function (r) {
      guard(ctx);
      var list = r[0] || [], filter = 'pending', sel = params.id || null, master = h('div', { class: 'card master' }), detail = h('div');
      var pend = list.filter(function (a) { return a.status === 'pending'; }).length;
      page.classList.add('wide');
      page.appendChild(head('Tasdiqlashlar', pend + ' ta kutilmoqda', [seg([['pending', 'Kutilmoqda'], ['all', 'Hammasi']], filter, function (v) { filter = v; paint(); }), refreshBtn()]));
      function paint() {
        clear(master);
        var shown = list.filter(function (a) { return filter === 'all' || a.status === 'pending'; });
        if (!sel || !shown.find(function (a) { return a.id === sel; })) sel = shown[0] && shown[0].id;
        shown.forEach(function (a) {
          master.appendChild(h('div', { class: 'md-item' + (a.id === sel ? ' sel' : ''), onclick: function () { sel = a.id; paint(); } },
            h('div', { class: 'body' }, h('div', { class: 't', text: a.title }), h('div', { class: 's', text: a.requester + ' · ' + A.branchName(a.branchId) + ' · ' + a.time })),
            h('div', { class: 'end' }, h('div', { style: { fontWeight: '600', color: 'var(--text)' }, text: a.amount != null ? A.moneyShort(a.amount).v + ' ' + A.moneyShort(a.amount).u : '' }), pill(RISK[a.risk] || 'mute', a.risk))));
        });
        if (!shown.length) master.appendChild(empty('Kutilayotgan tasdiqlash yo‘q', 'ok'));
        clear(detail); var a = list.find(function (x) { return x.id === sel; }); if (a) detail.appendChild(apDetail(a, function (upd) { var i = list.findIndex(function (x) { return x.id === upd.id; }); if (i >= 0) list[i] = upd; paint(); }));
      }
      paint();
      page.appendChild(h('div', { class: 'md' }, master, detail));
    });
  };
  function apDetail(a, onUpdate) {
    var st = AP_ST[a.status] || ['mute', a.status];
    var tl = h('ul', { class: 'timeline' }); (a.history || []).forEach(function (x) { tl.appendChild(h('li', { text: x })); });
    function decide(status) {
      var t = { approved: 'Tasdiqlash', rejected: 'Rad etish', changes: 'O‘zgartirish so‘rash' }[status];
      var cm = h('textarea', { class: 'tb', placeholder: status === 'approved' ? 'Izoh (ixtiyoriy)' : 'Sabab (majburiy)' }), er = h('div', { class: 'err' });
      A.dialog({
        title: t + ': ' + a.type, primary: t,
        body: h('div', null, h('p', { class: 'note', text: a.title + (a.amount != null ? ' · ' + A.money(a.amount) : '') }), h('div', { class: 'field' }, h('label', { text: status === 'approved' ? 'Izoh' : 'Sabab' }), cm), er),
        onPrimary: function () {
          var c = cm.value.trim(); if (status !== 'approved' && !c) { er.textContent = 'Sababni yozing.'; return false; }
          return A.cmd('approvals.decide', { id: a.id, status: status, comment: c }).then(function (upd) { A.toast('ok', t + ' bajarildi', a.title); onUpdate(upd || Object.assign({}, a, { status: status })); })
            .catch(function (e) { er.textContent = e.error || String(e); return false; });
        }
      });
    }
    return h('div', { class: 'card pad' },
      h('div', { style: { display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' } },
        h('div', null, h('div', { class: 'muted', style: { color: 'var(--text-2)', fontSize: '12px' }, text: a.type }), h('div', { style: { font: '600 20px/28px var(--font-display)' }, text: a.title })),
        h('div', { style: { marginLeft: 'auto', textAlign: 'right' } }, a.amount != null ? h('div', { style: { font: '600 24px/32px var(--font-display)', color: a.amount < 0 ? 'var(--crit)' : 'var(--text)' }, text: A.money(a.amount) }) : null, pill(st[0], st[1]))),
      h('div', { class: 'kv', style: { marginTop: '12px' } },
        h('div', { text: 'So‘rovchi' }), h('div', { text: a.requester }), h('div', { text: 'Filial' }), h('div', { text: A.branchName(a.branchId) }),
        h('div', { text: 'Vaqt' }), h('div', { text: a.time }), h('div', { text: 'Tasdiq darajasi' }), h('div', { text: a.level || '—' }),
        h('div', { text: 'Xavf' }), h('div', null, pill(RISK[a.risk] || 'mute', a.risk || '—'))),
      a.evidence ? h('div', null, h('div', { class: 'section-title', text: 'Dalil' }), h('div', { text: a.evidence })) : null,
      a.recommended ? h('div', { style: { marginTop: '12px' } }, A.infobar('info', 'Tavsiya:', a.recommended)) : null,
      a.history && a.history.length ? h('div', null, h('div', { class: 'section-title', text: 'Tarix' }), tl) : null,
      a.status === 'pending' ? h('div', { style: { display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' } },
        h('button', { class: 'btn accent', onclick: function () { decide('approved'); } }, icon('check'), 'Tasdiqlash'),
        h('button', { class: 'btn', onclick: function () { decide('changes'); } }, 'O‘zgartirish so‘rash'),
        h('button', { class: 'btn danger', onclick: function () { decide('rejected'); } }, icon('close'), 'Rad etish')) : null);
  }

  // ═════════════ Bildirishnomalar ═════════════
  A.screens.notifications = function (page, params, ctx) {
    return Promise.all([A.get('/v1/notifications'), A.branchesCached()]).then(function (r) {
      guard(ctx);
      var list = r[0] || [], filter = 'all', box = h('div');
      var unread = function () { return list.filter(function (n) { return !n.readByMe && !n.read; }).length; };
      var sub = h('div', { class: 'sub' });
      var markAll = h('button', { class: 'btn', onclick: function () {
        A.cmd('notifications.markAllRead', {}).then(function () { list.forEach(function (n) { n.readByMe = true; }); paint(); A.toast('ok', 'Hammasi o‘qildi'); }).catch(function (e) { A.toast('crit', 'Bajarilmadi', e.error); });
      } }, icon('check'), 'Hammasini o‘qilgan deb belgilash');
      var hd = head('Bildirishnomalar', null, [seg([['all', 'Hammasi'], ['unread', 'O‘qilmagan']], filter, function (v) { filter = v; paint(); }), markAll, refreshBtn()]);
      hd.querySelector('div').appendChild(sub);
      page.appendChild(hd); page.appendChild(card(null, null, box));
      function paint() {
        clear(box); var u = unread(); sub.textContent = u ? u + ' ta o‘qilmagan' : 'Hammasi o‘qilgan'; markAll.disabled = !u;
        var b = A.routes.notifications.badge; if (b) { b.textContent = String(u); b.style.display = u ? '' : 'none'; }
        var shown = list.filter(function (n) { return filter === 'all' || (!n.readByMe && !n.read); });
        shown.forEach(function (n) {
          var isUnread = !n.readByMe && !n.read, k = n.pr === 'kritik' ? 'crit' : n.pr === 'yuqori' ? 'warn' : 'info';
          var ic = icon(k === 'crit' ? 'crit' : k === 'warn' ? 'warn' : 'info'); ic.style.color = 'var(--' + k + ')'; ic.style.marginTop = '2px';
          box.appendChild(h('div', { class: 'list-item', onclick: function () {
            if (!isUnread) return;
            A.cmd('notifications.markRead', { id: n.id }).then(function () { n.readByMe = true; paint(); }).catch(function () {});
          } }, ic,
            h('div', { style: { minWidth: '0' } }, h('div', { class: 't', style: { fontWeight: isUnread ? '600' : '400' }, text: n.title }), h('div', { class: 's', text: [n.cat, n.source, n.branchId ? A.branchName(n.branchId) : null].filter(Boolean).join(' · ') })),
            h('div', { class: 'meta' }, h('div', { text: n.time }), h('div', { style: { marginTop: '4px' } }, pill(k, n.pr)), isUnread ? h('span', { class: 'dot', style: { background: 'var(--accent)', marginTop: '6px' } }) : null)));
        });
        if (!shown.length) box.appendChild(empty('Bildirishnoma yo‘q', 'bell'));
      }
      paint();
    });
  };

  // ═════════════ Audit jurnali ═════════════
  A.screens.audit = function (page, params, ctx) {
    return Promise.all([A.get('/v1/audit'), A.branchesCached()]).then(function (r) {
      guard(ctx);
      var list = r[0] || [], q = '', onlySens = false, tb = h('tbody'), count = h('span');
      page.classList.add('wide');
      function paint() {
        clear(tb); var n = 0;
        list.filter(function (x) { return (!onlySens || x.sensitive) && (!q || [x.user, x.action, x.object, x.device, x.reason].join(' ').toLowerCase().indexOf(q) >= 0); }).forEach(function (x) {
          n++;
          var when = x.at ? new Date(x.at) : null;
          tb.appendChild(h('tr', null,
            h('td', { class: 'muted', text: when ? (('0' + when.getDate()).slice(-2) + '.' + ('0' + (when.getMonth() + 1)).slice(-2) + ' ' + A.hhmm(when)) : x.time }),
            h('td', null, h('div', { class: 'who' }, h('span', { class: 'avatar sm', text: A.initials(x.user) }), x.user)),
            h('td', { class: 'clip', style: { maxWidth: '300px' }, title: x.action }, h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, x.sensitive ? pill('warn', 'sezgir') : null, h('span', { text: x.action, style: { overflow: 'hidden', textOverflow: 'ellipsis' } }))),
            h('td', { class: 'muted clip', text: x.object, title: x.object }),
            h('td', { class: 'muted', text: x.branchId ? A.branchName(x.branchId) : 'Tarmoq' }),
            h('td', { class: 'muted clip', text: x.before && x.before !== '—' || x.after && x.after !== '—' ? (x.before + ' → ' + x.after) : '—', title: x.before + ' → ' + x.after + (x.reason && x.reason !== '—' ? '\nSabab: ' + x.reason : '') }),
            h('td', { class: 'muted clip', text: x.device, title: x.device })));
        });
        count.textContent = n + ' ta yozuv';
        if (!n) tb.appendChild(h('tr', null, h('td', { colspan: '7' }, empty('Yozuv topilmadi', 'search'))));
      }
      var chk = h('label', { class: 'chk' }, h('input', { type: 'checkbox', onchange: function () { onlySens = this.checked; paint(); } }), 'Faqat sezgir');
      var hd = head('Audit jurnali', null, [search('Foydalanuvchi, amal, obyekt', function (v) { q = v; paint(); }), chk, refreshBtn()]);
      hd.querySelector('div').appendChild(h('div', { class: 'sub' }, count));
      page.appendChild(hd);
      page.appendChild(A.infobar('info', 'O‘zgarmas jurnal.', 'Audit yozuvlarini o‘chirib yoki tahrirlab bo‘lmaydi — har bir moliyaviy va xavfsizlik amali shu yerda qayd etiladi.'));
      page.appendChild(card(null, null, h('div', { class: 'table-wrap' }, h('table', { class: 'dg' },
        h('thead', null, h('tr', null, ['Vaqt', 'Foydalanuvchi', 'Amal', 'Obyekt', 'Filial', 'O‘zgarish', 'Qurilma'].map(function (t) { return h('th', { text: t }); }))), tb))));
      paint();
    });
  };
  // ───────────── Umumiy UI yordamchilari (boshqa ekran fayllari uchun: ui/screens/*.js) ─────────────
  /** Jadval. cols: [{ t: 'Sarlavha', k: 'maydon' | render: fn(row) → Node|string, r: true (o'ngga), w: '120px', clip: true }] */
  function table(cols, rows, opts) {
    opts = opts || {};
    var tb = h('tbody');
    (rows || []).forEach(function (row) {
      var tr = h('tr', { class: opts.onRow ? 'click' : '', onclick: opts.onRow ? function () { opts.onRow(row, tr); } : null });
      cols.forEach(function (c) {
        var v = c.render ? c.render(row) : row[c.k];
        var td = h('td', { class: (c.r ? 'r ' : '') + (c.muted ? 'muted ' : '') + (c.clip ? 'clip' : ''), style: c.w ? { width: c.w } : null, title: c.clip && typeof v === 'string' ? v : null });
        if (v != null && v.nodeType) td.appendChild(v); else td.textContent = v == null || v === '' ? '—' : String(v);
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    if (!rows || !rows.length) tb.appendChild(h('tr', null, h('td', { colspan: String(cols.length) }, empty(opts.empty || 'Ma’lumot yo‘q', opts.emptyIcon || 'inbox'))));
    var t = h('table', { class: 'dg' }, h('thead', null, h('tr', null, cols.map(function (c) { return h('th', { class: c.r ? 'r' : '', text: c.t, style: c.w ? { width: c.w } : null }); }))), tb);
    var wrap = h('div', { class: 'table-wrap' }, t);
    return opts.bare ? wrap : card(opts.title || null, opts.more || null, wrap);
  }
  /** Tablar (Fluent Pivot). items: [[id, label]] */
  function tabs(items, value, onchange) {
    var box = h('div', { class: 'pivot' });
    items.forEach(function (it) {
      box.appendChild(h('button', { class: it[0] === value ? 'on' : '', onclick: function () { Array.prototype.forEach.call(box.children, function (b) { b.classList.remove('on'); }); this.classList.add('on'); onchange(it[0]); } }, it[1]));
    });
    return box;
  }
  function field(label, control, hint) { return h('div', { class: 'field' }, h('label', { text: label }), control, hint ? h('div', { class: 'hint', text: hint }) : null); }
  function input(opts) { opts = opts || {}; var i = h('input', Object.assign({ class: 'tb' + (opts.num ? ' num' : ''), spellcheck: 'false' }, opts.attrs || {})); if (opts.value != null) i.value = opts.value; if (opts.placeholder) i.placeholder = opts.placeholder; if (opts.type) i.type = opts.type; return i; }
  /** So'm kiritish maydoni (1 234 567 formatida); .num() — qiymat */
  function moneyInput(value) {
    var i = h('input', { class: 'tb num', inputmode: 'numeric', placeholder: '0' });
    function fmt() { var n = parseInt(i.value.replace(/\D/g, ''), 10) || 0; i.value = n ? A.num(n) : ''; }
    i.addEventListener('input', fmt); if (value) { i.value = String(value); fmt(); }
    i.num = function () { return parseInt(i.value.replace(/\D/g, ''), 10) || 0; };
    return i;
  }
  function kvList(rows) { var kv = h('div', { class: 'kv' }); rows.forEach(function (r) { if (r == null || r[1] == null || r[1] === '') return; kv.appendChild(h('div', { text: r[0] })); var v = r[1]; kv.appendChild(v && v.nodeType ? h('div', null, v) : h('div', { text: String(v) })); }); return kv; }
  /** Tasdiq dialogi: confirm('Sarlavha', 'Matn', 'Ha') → Promise<boolean> */
  function confirm(title, text, primary) { return A.dialog({ title: title, body: h('p', { class: 'note', text: text }), primary: primary || 'Ha' }); }
  /** Izoh/sabab so'raydigan dialog → Promise<string|false> */
  function prompt(title, label, opts) {
    opts = opts || {};
    var ta = h('textarea', { class: 'tb', placeholder: opts.placeholder || '' }), er = h('div', { class: 'err' });
    if (opts.value) ta.value = opts.value;
    return A.dialog({ title: title, primary: opts.primary || 'Saqlash', body: h('div', null, opts.text ? h('p', { class: 'note', text: opts.text }) : null, field(label, ta), er),
      onPrimary: function () { var v = ta.value.trim(); if (opts.required && !v) { er.textContent = 'Majburiy maydon.'; return false; } return v || ''; } });
  }
  /** Buyruqni bajarish + toast; xatoni ko'rsatadi. run('cmd', input, 'Bajarildi') → Promise */
  function run(cmd, input, okText) {
    return A.cmd(cmd, input).then(function (r) { if (okText) A.toast('ok', okText); return r; })
      .catch(function (e) { A.toast('crit', 'Bajarilmadi', e.error || String(e)); throw e; });
  }
  function fmtDate(v) {
    if (!v) return '—'; var d = new Date(v); if (isNaN(d)) return String(v);
    return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear();
  }
  function fmtDateTime(v) { if (!v) return '—'; var d = new Date(v); if (isNaN(d)) return String(v); return fmtDate(v) + ' ' + A.hhmm(d); }
  function isoDay(offset) { var d = new Date(Date.now() - (offset || 0) * 86400000); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  /** Faqat o'qish (AUDITOR) bo'lsa tugmani o'chirish */
  function ro(btn) { if (A.readOnly()) { btn.disabled = true; btn.title = 'Auditor rejimi — faqat o‘qish'; } return btn; }
  function branchOptions(all) { return (all ? [['', all === true ? 'Barcha filiallar' : all]] : []).concat((A.state.branches || []).map(function (b) { return [b.id, b.short || b.name]; })); }
  function hbar(items, opts) { // gorizontal ustunli diagramma: [{l, v}]
    opts = opts || {}; var mx = Math.max.apply(null, items.map(function (x) { return Math.abs(x.v); }).concat([1])), box = h('div', { style: { padding: '8px 20px 16px' } });
    items.forEach(function (x) {
      box.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: '160px 1fr 120px', gap: '12px', alignItems: 'center', padding: '5px 0' } },
        h('span', { text: x.l, style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
        h('div', { class: 'bar' + (x.v < 0 ? ' crit' : ''), style: { height: '8px' } }, h('i', { style: { width: Math.round(Math.abs(x.v) / mx * 100) + '%' } })),
        h('span', { class: 'r', style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }, text: opts.fmt ? opts.fmt(x.v) : A.num(x.v) })));
    });
    if (!items.length) box.appendChild(empty('Ma’lumot yo‘q'));
    return box;
  }

  A.ui = {
    head: head, refreshBtn: refreshBtn, card: card, empty: empty, pill: pill, seg: seg, select: select, search: search, svg: svg,
    spark: spark, areaChart: areaChart, bars: bars, hbar: hbar, deltaBadge: deltaBadge, kpi: kpi, levelKind: levelKind, linkTo: linkTo, guard: guard,
    viewer: viewer, pushToTalk: pushToTalk, table: table, tabs: tabs, field: field, input: input, moneyInput: moneyInput, kvList: kvList,
    confirm: confirm, prompt: prompt, run: run, fmtDate: fmtDate, fmtDateTime: fmtDateTime, isoDay: isoDay, ro: ro, branchOptions: branchOptions,
    empDialog: empDialog, apDetail: apDetail
  };
})();
