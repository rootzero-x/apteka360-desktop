/* Apteka 360 Desktop — Firmalar, To‘lov kalendari, Vrachlar, Sroklar. */
(function () {
  'use strict';
  var A = window.Apteka, h = A.h, U = A.ui, icon = A.icon, clear = A.clear || function (n) { while (n.firstChild) n.removeChild(n.firstChild); return n; };

  // ───────────── Umumiy ─────────────
  function ms(n) { var m = A.moneyShort(Math.round(n || 0)); return m.v + (m.u ? ' ' + m.u : ''); }
  function dm(d) { return d ? String(d).slice(8, 10) + '.' + String(d).slice(5, 7) : '—'; }
  function qty(n) { return A.num(Math.round((n || 0) * 100) / 100); }
  function pct2(r) { return Math.round((r || 0) * 10000) / 100; }
  function tf(s, o) { return String(s).replace(/\{(\w+)\}/g, function (_, k) { return o[k] == null ? '' : String(o[k]); }); }
  function hasRole(list) { return list.indexOf(A.role()) >= 0; }
  function parseDec(v) { var s = String(v || '').replace(/[\s  ]/g, '').replace(',', '.'); return s === '' ? undefined : Number(s); }
  function kcard(label, value, sub, tone) {
    return h('div', { class: 'card kpi' }, h('div', { class: 'lbl', text: label }),
      h('div', { class: 'val', style: tone ? { color: 'var(--' + tone + ')' } : null, text: value }),
      h('div', { class: 'foot' }, sub ? h('span', { text: sub }) : null));
  }
  function errText(e) { return (e && (e.error || e.message)) || String(e); }
  function sw(label, on, onchange) {
    var b = h('button', { type: 'button', class: 'switch' + (on ? ' on' : ''), role: 'switch' });
    b.onclick = function () { on = !on; b.classList.toggle('on', on); onchange(on); };
    return h('label', { class: 'chk', style: { cursor: 'pointer', margin: '6px 0' } }, b, h('span', { text: label }));
  }
  function note(t) { return h('div', { style: { fontSize: '12px', color: 'var(--text-2)', margin: '8px 0 12px' }, text: t }); }
  function row2(a, b) { return h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '7px 0', borderBottom: '1px solid var(--stroke)', fontSize: '13px' } }, a, b); }
  function softGet(path) { return A.get(path).then(function (r) { return { ok: true, data: r }; }, function (e) { if (e && e.silent) throw e; return { ok: false, err: e }; }); }
  function moduleOff(e) { return e && (e.status === 503 || e.status === 404 || e.code === 'module_disabled'); }

  // ═════════════ Firmalar va to‘lovlar ═════════════
  var SUP_F = [['name', 'Firma nomi', 1], ['inn', 'STIR', 1], ['manager', 'Menejer'], ['phone', 'Telefon'], ['creditLimit', 'Kredit limiti', 0, 1], ['terms', 'To‘lov sharti'],
    ['earlyRate', 'Erta to‘lov chegirmasi, %', 0, 1], ['earlyBase', 'Erta to‘lov bazasi', 0, 1], ['volumeRate', 'Hajm bonusi, %', 0, 1], ['volumeFrom', 'Hajm bonusi chegarasi', 0, 1], ['penaltyDaily', 'Kunlik penya, %', 0, 1]];
  function supplierForm(s) {
    var inputs = {}, er = h('div', { class: 'err' }), grid = h('div', { class: 'form-grid' });
    SUP_F.forEach(function (f) {
      var i = U.input({ value: s && s[f[0]] != null ? String(s[f[0]]) : '', num: !!f[3] }); inputs[f[0]] = i;
      var fl = U.field(f[1] + (f[2] ? ' *' : ''), i); if (f[0] === 'name') fl.style.gridColumn = '1 / -1'; grid.appendChild(fl);
    });
    return A.dialog({ title: s ? 'Firmani tahrirlash' : 'Firma qo‘shish', primary: 'Saqlash', body: h('div', { style: { minWidth: '520px' } }, grid, er),
      onPrimary: function () {
        var v = {}, bad = null;
        SUP_F.forEach(function (f) {
          var raw = inputs[f[0]].value.trim();
          if (f[2] && !raw) bad = f[1];
          if (!raw) return;
          if (f[3]) { var n = parseDec(raw); if (isNaN(n)) bad = f[1]; v[f[0]] = n; } else v[f[0]] = raw;
        });
        if (bad) { er.textContent = 'Maydonni to‘g‘ri to‘ldiring: ' + bad; return false; }
        if (s) v.id = s.id;
        return A.cmd('suppliers.upsert', v).then(function (r) { A.toast('ok', '«' + ((r && r.name) || v.name) + '» firmasi saqlandi'); A.render(); }, function (e) { er.textContent = errText(e); return false; });
      } });
  }
  function supplierCalc(s, amount) {
    var oc = Math.min(amount, s.overdue || 0), ee = Math.min(Math.max(0, amount - oc), s.earlyBase || 0);
    var disc = Math.round(ee * (s.earlyRate || 0)), vb = s.volumeRate && amount >= s.volumeFrom ? Math.round(amount * s.volumeRate) : 0;
    var pa = Math.round(oc * (s.penaltyDaily || 0) * 30);
    return { overdueCovered: oc, discount: disc, volumeBonus: vb, penaltyAvoided: pa, benefit: disc + vb + pa, remainingDebt: Math.max(0, (s.debt || 0) - amount - disc) };
  }

  A.screens.suppliers = function (page, params, ctx) {
    return Promise.all([A.get('/v1/suppliers'), A.get('/v1/settings').catch(function () { return {}; })]).then(function (r) {
      U.guard(ctx);
      var list = r[0] || [], st = r[1] || {}, canEdit = !A.readOnly() && hasRole(['OWNER', 'SUPER_ADMIN', 'FINANCE']);
      var canPay = !A.readOnly() && hasRole(['OWNER', 'FINANCE']);
      var apX = st.approvalX || 2000000, apY = st.approvalY || 10000000;
      page.classList.add('wide');
      var tools = [A.can('payables') ? h('button', { class: 'btn', onclick: function () { A.go('payables'); } }, icon('pay'), 'To‘lov kalendari') : null,
        canEdit ? h('button', { class: 'btn accent', onclick: function () { supplierForm(null); } }, icon('plus'), 'Firma qo‘shish') : null, U.refreshBtn()].filter(Boolean);
      page.appendChild(U.head('Firmalar va to‘lovlar', list.length + ' ta firma', tools));
      if (!list.length) { page.appendChild(U.card(null, null, U.empty('Firmalar yo‘q', 'truck'))); return; }
      var sum = function (k) { return list.reduce(function (a, x) { return a + (x[k] || 0); }, 0); };
      page.appendChild(h('div', { class: 'grid g4', style: { marginBottom: '12px' } },
        kcard('Jami qarz', A.money(sum('debt'))), kcard('Muddati o‘tgan', A.money(sum('overdue')), null, sum('overdue') ? 'crit' : null),
        kcard('7 kunda to‘lanadi', A.money(sum('dueSoon'))), kcard('Kirim · 30 kun (FOM)', A.money(sum('purchases30')))));
      var selId = (params && params.id) || list[0].id, q = '';
      var master = h('div', { class: 'card master' }), detail = h('div');
      page.appendChild(h('div', { style: { marginBottom: '8px' } }, U.search('Firma, STIR', function (v) { q = v; paintList(); })));
      page.appendChild(h('div', { class: 'md' }, master, detail));
      function status(x) { return x.overdue > 0 ? ['crit', 'Muddati o‘tgan'] : x.dueSoon > 0 ? ['warn', '7 kunda to‘lov'] : ['ok', 'Muddatida']; }
      function paintList() {
        clear(master);
        list.filter(function (x) { return !q || (x.name + ' ' + x.inn).toLowerCase().indexOf(q) >= 0; }).forEach(function (x) {
          var s = status(x), use = x.creditLimit ? x.debt / x.creditLimit : 0;
          master.appendChild(h('div', { class: 'md-item' + (x.id === selId ? ' sel' : ''), onclick: function () { selId = x.id; paintList(); paintDetail(); } },
            h('div', { class: 'body' }, h('div', { class: 't', text: x.name }),
              h('div', { class: 's', text: 'Qarz ' + ms(x.debt) + (x.overdue ? ' · o‘tgan ' + ms(x.overdue) : '') }),
              h('div', { class: 'bar' + (use > 0.7 ? ' warn' : ''), style: { marginTop: '6px' }, title: 'Kredit limiti: ' + Math.round(use * 100) + '%' }, h('i', { style: { width: Math.min(100, use * 100) + '%' } }))),
            h('div', { class: 'end' }, U.pill(s[0], s[1]))));
        });
      }
      function paintDetail() {
        clear(detail);
        var s = list.filter(function (x) { return x.id === selId; })[0] || list[0], stt = status(s);
        var agT = (s.aging || []).reduce(function (a, x) { return a + x; }, 0) || 1, agC = ['var(--accent)', '#d97706', '#dc2626', '#7d1a1f'], agL = ['0–30 kun', '31–60 kun', '61–90 kun', '90+ kun'];
        var info = h('div', { class: 'card pad' },
          h('div', { style: { display: 'flex', gap: '12px', alignItems: 'flex-start' } },
            h('div', { style: { flex: '1', minWidth: '0' } }, h('div', { style: { font: '600 20px/28px var(--font-display)' }, text: s.name }),
              h('div', { style: { fontSize: '12px', color: 'var(--text-2)' }, text: 'STIR ' + (s.inn || '—') + ' · ' + (s.manager || '—') + ' · ' + (s.phone || '—') })),
            canEdit ? h('button', { class: 'btn', onclick: function () { supplierForm(s); } }, icon('more'), 'Tahrirlash') : null, U.pill(stt[0], stt[1])),
          h('div', { class: 'grid g3', style: { margin: '14px 0' } },
            h('div', null, h('div', { class: 'muted', style: { fontSize: '12px', color: 'var(--text-2)' }, text: 'Qarz' }), h('b', { text: A.money(s.debt) })),
            h('div', null, h('div', { style: { fontSize: '12px', color: 'var(--text-2)' }, text: 'Muddati o‘tgan' }), h('b', { style: { color: 'var(--crit)' }, text: A.money(s.overdue) })),
            h('div', null, h('div', { style: { fontSize: '12px', color: 'var(--text-2)' }, text: 'Kredit limiti' }), h('b', { text: A.money(s.creditLimit) }))),
          s.terms ? A.infobar('info', 'Shartnoma shartlari: ', s.terms) : null,
          h('div', { class: 'section-title', text: 'Qarz yoshi (aging)' }),
          h('div', { style: { display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', background: 'var(--selected)' } }, (s.aging || []).map(function (v, i) { return h('span', { style: { width: (v / agT * 100) + '%', background: agC[i] } }); })),
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '6px', fontSize: '12px', color: 'var(--text-2)' } }, (s.aging || []).map(function (v, i) {
            return h('span', null, h('span', { class: 'dot', style: { background: agC[i], display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', marginRight: '5px' } }), agL[i] + ': ', h('b', { text: ms(v) }));
          })));
        var ledger = (s.ledger && s.ledger.length) ? s.ledger : [{ date: '—', doc: 'Nakladnoy (FOM)', type: 'Kirim (FOM)', debit: Math.round((s.purchases30 || 0) / 2), credit: 0 }];
        var led = U.table([
          { t: 'Sana', k: 'date', w: '70px', muted: true },
          { t: 'Hujjat', render: function (l) { return h('div', null, h('div', { text: l.doc }), h('div', { style: { fontSize: '11px', color: 'var(--text-2)' }, text: l.type })); } },
          { t: 'Manba', w: '70px', render: function (l) { return U.pill('mute', /FOM/.test(l.type || '') ? 'FOM' : 'QO‘LDA'); } },
          { t: 'Debet', r: true, render: function (l) { return l.debit ? A.num(l.debit) : ''; } },
          { t: 'Kredit', r: true, render: function (l) { return l.credit ? h('span', { style: { color: 'var(--ok)' }, text: A.num(l.credit) }) : ''; } }
        ], ledger, { title: 'Ledger', more: h('span', { style: { fontSize: '12px', color: 'var(--text-2)' }, text: 'Kirim — FOM, to‘lov — qo‘lda' }) });
        // To'lov kalkulyatori
        var amt = U.moneyInput(50000000), out = h('div'), chips = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '8px 0' } });
        [['Muddati o‘tganini yopish', s.overdue], ['50 mln', 50000000], ['Chegirma maksimal', (s.overdue || 0) + (s.earlyBase || 0)], ['To‘liq qarz', s.debt]].filter(function (c) { return c[1] > 0; }).forEach(function (c) {
          chips.appendChild(h('button', { class: 'btn subtle', style: { fontSize: '12px' }, onclick: function () { amt.value = String(c[1]); amt.dispatchEvent(new Event('input')); } }, c[0] + ' · ' + ms(c[1])));
        });
        var payBtn = h('button', { class: 'btn accent' }, icon('pay'), 'To‘lov yaratish');
        if (!canPay) { payBtn.disabled = true; payBtn.title = A.readOnly() ? 'Auditor rejimi — faqat o‘qish' : 'Faqat Egasi yoki Moliya'; }
        function calc() {
          clear(out); var P = amt.num(), c = supplierCalc(s, P), toOwner = P > apY;
          var lvl = toOwner ? 'Egasi tasdig‘i (> ' + ms(apY) + ')' : P > apX ? 'Moliya admin' : 'Filial mudiri';
          out.appendChild(A.infobar(P > 0 ? 'ok' : 'info', P > 0 ? 'Bugun ' + A.money(P) + ' to‘lasangiz, ' : 'To‘lov summasini kiriting', P > 0 ? (c.benefit > 0 ? 'jami ' + A.money(c.benefit) + ' foyda olasiz.' : 'qo‘shimcha foyda yo‘q.') : ''));
          var g = function (v) { return h('span', { style: { color: v ? 'var(--ok)' : 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }, text: v ? '+' + A.money(v) : '0' }); };
          out.appendChild(row2(h('span', { text: 'Muddati o‘tgan qarz yopiladi' }), h('span', { text: A.money(c.overdueCovered) })));
          out.appendChild(row2(h('span', { text: 'Erta to‘lov chegirmasi (' + String((s.earlyRate || 0) * 100).replace('.', ',') + '%)' }), g(c.discount)));
          out.appendChild(row2(h('span', { text: 'Hajm bonusi' + (s.volumeRate ? ' (≥ ' + ms(s.volumeFrom) + ' → 1%)' : '') }), g(c.volumeBonus)));
          out.appendChild(row2(h('span', { text: 'Oldi olingan penya (30 kun)' }), g(c.penaltyAvoided)));
          out.appendChild(row2(h('span', { text: 'Qolgan qarz' }), h('span', { text: A.money(c.remainingDebt) })));
          out.appendChild(row2(h('b', { text: 'Yakuniy foyda' }), h('b', { style: { color: 'var(--ok)' }, text: A.money(c.benefit) })));
          out.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', gap: '10px' } }, h('span', { style: { fontSize: '12px', color: 'var(--text-2)' }, text: 'Tasdiqlovchi: ' + lvl }), payBtn));
          payBtn.disabled = !canPay || P <= 0;
          payBtn.onclick = function () {
            A.dialog({ title: 'To‘lov so‘rovini yaratish', primary: 'Tasdiqqa yuborish', secondary: 'Orqaga',
              body: h('div', { style: { minWidth: '420px' } }, h('p', { class: 'note', text: 'To‘lov tasdiqlangandan keyin bank orqali qo‘lda o‘tkaziladi (1-bosqich). Ledgerga «To‘lov» yozuvi qo‘shiladi.' }),
                U.kvList([['Firma', s.name], ['Summa', A.money(P)], ['Manba', 'Bank hisobi'], ['Foyda', A.money(c.benefit)], ['Qolgan qarz', A.money(c.remainingDebt)], ['Tasdiqlovchi', toOwner ? 'Egasi' : 'Moliya admin']])),
              onPrimary: function () {
                return A.cmd('suppliers.createPayment', { supplierId: s.id, amount: P, benefit: c.benefit }).then(function () { A.toast('ok', 'To‘lov so‘rovi yaratildi va tasdiqqa yuborildi.'); },
                  function (e) { A.toast('crit', 'Bajarilmadi', errText(e)); return false; });
              } });
          };
        }
        amt.addEventListener('input', calc); calc();
        var calcCard = h('div', { class: 'card pad', style: { borderColor: 'var(--accent)' } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } }, h('b', { text: 'To‘lov kalkulyatori' }), h('span', { style: { fontSize: '12px', color: 'var(--text-2)' }, text: s.name })),
          U.field('To‘lov summasi', amt), chips, out);
        detail.appendChild(h('div', { style: { display: 'grid', gap: '12px' } }, info, calcCard, led));
      }
      paintList(); paintDetail();
    });
  };

  // ═════════════ To‘lov kalendari ═════════════
  var PAY_EDIT = ['OWNER', 'SUPER_ADMIN', 'FINANCE'], PAY_PAY = ['OWNER', 'FINANCE'];
  var REASON = { early: ['ok', 'Chegirma uchun'], penalty: ['crit', 'Penya to‘xtatish'], overdue: ['warn', 'Muddati o‘tgan'], due: ['mute', 'Muddati keldi'] };
  var payState = { days: 30, tab: 'calendar', all: false };

  A.screens.payables = function (page, params, ctx) {
    var days = payState.days;
    return A.get('/v1/payables/summary?days=' + days).then(function (s) {
      U.guard(ctx);
      var canEdit = !A.readOnly() && hasRole(PAY_EDIT);
      var sub = 'Qaysi firmaga qachon va qancha to‘lash kerak: FOM kirim nakladnoylari, firma shartlari va kiritilgan to‘lovlar asosida.';
      var tools = [s.connected && canEdit ? h('button', { class: 'btn', onclick: function () { settingsDlg(s); } }, icon('gear'), 'Sozlamalar') : null, U.refreshBtn()].filter(Boolean);
      page.classList.add('wide');
      page.appendChild(U.head('To‘lov kalendari', sub, tools));
      if (!s.connected) {
        page.appendChild(A.infobar('info', 'FOM ulanmagan. ', 'FOM agenti ulanmagan yoki kirim nakladnoylari hali kelmagan. Tizim → FOM integratsiya sahifasida agentni ulang (agent v1.2+ kerak).',
          A.can('fom') ? h('button', { class: 'btn', onclick: function () { A.go('fom'); } }, 'FOM integratsiya') : null));
        return;
      }
      var T = s.totals;
      page.appendChild(h('div', { class: 'grid gauto', style: { marginBottom: '12px' } },
        kcard('Firmalarga qarz', ms(T.debt), T.vendors + ' ta firma'),
        kcard('Muddati o‘tgan', ms(T.overdue), T.penaltyAccrued > 0 ? 'penya ' + ms(T.penaltyAccrued) : null, T.overdue > 0 ? 'crit' : null),
        kcard('7 kunda to‘lanadi', ms(T.due7), '30 kunda: ' + ms(T.due30), T.due7 > 0 ? 'warn' : null),
        kcard('Chegirma imkoni', ms(T.earlySaving), 'muddatidan oldin to‘lansa', T.earlySaving > 0 ? 'ok' : null),
        kcard('Kunlik to‘lov imkoni', ms(s.inflow.daily), 'tushumning ' + s.inflow.sharePct + '% · ' + s.inflow.basisDays + ' kunlik o‘rtacha')));
      if (T.firstGap) page.appendChild(A.infobar('crit', dm(T.firstGap) + ' dan pul yetmay qoladi. ', 'Muddatlar bo‘yicha to‘lansa, eng past nuqtada ' + ms(-T.minBalance) + ' yetishmaydi. «Tavsiya reja» bo‘limida pulni qaysi tartibda taqsimlash ko‘rsatilgan.'));
      if (T.unconfigured > 0) page.appendChild(A.infobar('warn', T.unconfigured + ' ta firma: ', 'to‘lov shartlari kiritilmagan: ular uchun standart ' + s.settings.defaultTermDays + ' kun olindi. Firmani bosib muddat, chegirma va penyani kiriting.'));
      var body = h('div'), detail = h('div');
      page.appendChild(h('div', { class: 'toolbar', style: { justifyContent: 'space-between', marginTop: '12px' } },
        U.tabs([['calendar', 'Kalendar'], ['vendors', 'Firmalar'], ['plan', 'Tavsiya reja']], payState.tab, function (v) { payState.tab = v; paint(); }),
        U.seg([14, 30, 60, 90].map(function (d) { return [d, d + ' kun']; }), days, function (v) { payState.days = v; A.render(); })));
      page.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: '12px' } }, body, detail));
      page.appendChild(note('Qarz = FOM kirim nakladnoylari (xarid narxida) − shu yerda kiritilgan to‘lovlar; to‘lov eng eski nakladnoyni yopadi. Firmaga o‘tkazilgan pul FOM’da yo‘q — to‘lovlarni o‘z vaqtida kiriting. Oxirgi nakladnoy: ' + (s.lastIncome || '—') + '.'));
      function openVendor(k) { vendorPanel(detail, k, ctx); }
      function paint() { clear(body); if (payState.tab === 'cal') calendarView(body, s, openVendor); else if (payState.tab === 'vendors') vendorsView(body, s, openVendor); else planView(body, s, openVendor); }
      paint();
      if (params && params.vendor) openVendor(params.vendor);
    }, function (e) {
      if (e && e.silent) throw e;
      if (moduleOff(e) && e.status !== 403) { U.guard(ctx); page.appendChild(U.head('To‘lov kalendari', null, [U.refreshBtn()])); page.appendChild(A.infobar('warn', 'To‘lov kalendari mavjud emas. ', errText(e))); return; }
      throw e;
    });
  };

  function calendarView(box, s, onVendor) {
    var cal = s.calendar || [];
    if (!cal.length) { box.appendChild(U.card(null, null, U.empty('Bu davrda to‘lov yo‘q', 'cal'))); return; }
    var bal = {}; (s.projection || []).forEach(function (p) { bal[p.date] = p.balance; });
    var max = Math.max.apply(null, [1].concat(cal.map(function (c) { return c.due + c.overdue; })));
    var sel = cal[0].date, gridBox = h('div'), dayBox = h('div');
    function paintGrid() {
      clear(gridBox);
      var g = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: '6px' } });
      ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'].forEach(function (w) { g.appendChild(h('div', { style: { textAlign: 'center', fontSize: '11px', color: 'var(--text-2)' }, text: w })); });
      var lead = (new Date(cal[0].date + 'T00:00:00Z').getUTCDay() + 6) % 7;
      for (var i = 0; i < lead; i++) g.appendChild(h('span'));
      cal.forEach(function (c) {
        var tot = c.due + c.overdue, b = bal[c.date] || 0, tone = c.overdue > 0 ? '#dc2626' : b < 0 ? '#d97706' : 'var(--accent)';
        var bg = tot ? 'color-mix(in srgb, ' + tone + ' ' + Math.round(8 + tot / max * 30) + '%, transparent)' : 'transparent';
        g.appendChild(h('button', { type: 'button', title: tot ? A.money(tot) : '', onclick: function () { sel = c.date; paintGrid(); paintDay(); },
          style: { minHeight: '58px', textAlign: 'left', padding: '4px 6px', borderRadius: '6px', border: '1px solid ' + (c.date === sel ? 'var(--accent)' : 'var(--stroke)'), background: bg, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: 'var(--text)', cursor: 'pointer' } },
          h('span', { style: { fontSize: '11px', color: 'var(--text-2)' }, text: dm(c.date) }),
          tot > 0 ? h('b', { style: { fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, text: A.moneyShort(tot).v + ' ' + A.moneyShort(tot).u.replace(' so‘m', '') }) : null,
          b < 0 ? h('span', { style: { height: '3px', borderRadius: '2px', background: '#d97706' } }) : null));
      });
      gridBox.appendChild(g);
      gridBox.appendChild(note('Rang qanchalik to‘q bo‘lsa, to‘lov shunchalik katta. Qizil — muddati o‘tgan, sariq chiziq — prognozda pul yetmaydi.'));
    }
    function paintDay() {
      clear(dayBox);
      var d = cal.filter(function (c) { return c.date === sel; })[0] || cal[0];
      dayBox.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' } }, h('b', { text: dm(d.date) + ' — to‘lovlar' }), h('span', { style: { fontSize: '12px', color: 'var(--text-2)' }, text: 'prognoz qoldiq: ' + ms(bal[d.date] || 0) })));
      if (d.overdue > 0) dayBox.appendChild(h('div', { style: { color: 'var(--crit)', fontSize: '12px', marginBottom: '6px' }, text: 'shundan muddati o‘tgan: ' + ms(d.overdue) }));
      if (!d.items.length) dayBox.appendChild(h('div', { style: { color: 'var(--text-2)' }, text: 'Bu kunga to‘lov yo‘q.' }));
      d.items.forEach(function (i) {
        dayBox.appendChild(h('div', { class: 'list-item', onclick: function () { onVendor(i.vendorKey); } },
          h('div', { style: { minWidth: '0', flex: '1' } }, h('div', { class: 't', text: i.vendor }), h('div', { class: 's', text: i.invoices + ' ta nakladnoy' + (i.early > 0 ? ' · erta to‘lasa −' + ms(i.early) : '') })),
          h('div', { class: 'meta' }, h('b', { text: ms(i.amount) }))));
      });
    }
    paintGrid(); paintDay();
    box.appendChild(h('div', { class: 'grid g2' }, h('div', { class: 'card pad' }, gridBox), h('div', { class: 'card pad' }, dayBox)));
  }

  function termsShort(v) {
    return v.configured ? v.termDays + ' kun' + (v.earlyRate ? ' · ' + pct2(v.earlyRate) + '%/' + v.earlyDays : '') + (v.penaltyDaily ? ' · penya ' + pct2(v.penaltyDaily) + '%' : '') : null;
  }
  function vendorsView(box, s, onVendor) {
    var tbl = h('div');
    function paint() {
      clear(tbl);
      var rows = (s.vendors || []).filter(function (v) { return payState.all || v.debt > 0; });
      tbl.appendChild(U.table([
        { t: 'Firma', render: function (v) { var k = v.overdue > 0 ? 'crit' : v.due7 > 0 ? 'warn' : 'ok'; return h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, h('span', { class: 'dot', style: { width: '8px', height: '8px', borderRadius: '50%', background: 'var(--' + k + ')', flex: 'none' } }), h('b', { text: v.name })); } },
        { t: 'Qarz', r: true, render: function (v) { return ms(v.debt); } },
        { t: 'Muddati o‘tgan', r: true, render: function (v) { return v.overdue > 0 ? h('div', { style: { color: 'var(--crit)' } }, h('div', { text: ms(v.overdue) }), h('div', { style: { fontSize: '11px' }, text: v.maxOverdueDays + ' kun kechikkan' })) : '—'; } },
        { t: '7 kunda', r: true, render: function (v) { return v.due7 > 0 ? ms(v.due7) : '—'; } },
        { t: 'Keyingi muddat', render: function (v) { return v.nextDue ? dm(v.nextDue) : '—'; } },
        { t: 'Chegirma', r: true, render: function (v) { return v.earlySaving > 0 ? h('span', { style: { color: 'var(--ok)' }, text: ms(v.earlySaving) }) : '—'; } },
        { t: 'Shartlar', render: function (v) { var t = termsShort(v); return t || h('span', { style: { color: 'var(--warn)' }, text: 'shart kiritilmagan' }); } }
      ], rows, { title: 'Firmalar', more: sw('Qarzi yo‘qlarini ham ko‘rsatish', payState.all, function (on) { payState.all = on; paint(); }), empty: 'Qarz yo‘q.', onRow: function (v) { onVendor(v.key); } }));
    }
    paint(); box.appendChild(tbl);
  }

  function planView(box, s, onVendor) {
    var p = s.plan;
    box.appendChild(h('div', { class: 'grid g4', style: { marginBottom: '8px' } },
      kcard('Rejada to‘lanadi', ms(p.paid)), kcard('Chegirmadan tejash', ms(p.saving), null, p.saving > 0 ? 'ok' : null),
      kcard('Oldi olingan penya', ms(p.penaltyAvoided), null, p.penaltyAvoided > 0 ? 'ok' : null), kcard('Muddatida to‘lanmay qoladi', ms(p.unpaidDue), null, p.unpaidDue > 0 ? 'crit' : null)));
    box.appendChild(note('Har kuni kunlik to‘lov imkoni (' + ms(s.inflow.daily) + ') qo‘shiladi, boshlang‘ich pul ' + ms(s.settings.startCash) + '. Tartib: avval chegirma muddati tugayotganlar (to‘liq), keyin penyali muddati o‘tganlar, keyin boshqa muddati o‘tganlar va shu kun muddati kelganlar.'));
    box.appendChild(U.table([
      { t: 'Sana', w: '80px', render: function (r) { return dm(r.date); } },
      { t: 'Firma', render: function (r) { return h('b', { text: r.vendor }); } },
      { t: 'Nakladnoy', muted: true, render: function (r) { return (r.number || '—') + ' · ' + dm(r.invoiceDate); } },
      { t: 'Summa', r: true, render: function (r) { return h('b', { text: ms(r.amount) }); } },
      { t: 'Sabab', render: function (r) { var x = REASON[r.reason] || ['mute', r.reason]; return h('div', null, U.pill(x[0], x[1]), r.saving > 0 ? h('div', { style: { fontSize: '11px', color: 'var(--ok)' }, text: 'tejaladi ' + ms(r.saving) }) : null); } }
    ], p.rows, { empty: 'Bu davrda to‘lov rejasi yo‘q.', onRow: function (r) { onVendor(r.vendorKey); } }));
  }

  function vendorPanel(box, key, ctx) {
    clear(box);
    var wrap = h('div', { class: 'card pad' }, h('div', { style: { color: 'var(--text-2)' }, text: 'Yuklanmoqda…' }));
    box.appendChild(wrap); wrap.scrollIntoView({ block: 'start', behavior: 'smooth' });
    A.get('/v1/payables/vendors/' + encodeURIComponent(key)).then(function (v) {
      if (!ctx.isCurrent()) return;
      clear(wrap);
      var ro = A.readOnly(), canEdit = !ro && hasRole(PAY_EDIT), canPay = !ro && hasRole(PAY_PAY), sm = v.summary;
      wrap.appendChild(h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' } },
        h('div', { style: { flex: '1', minWidth: '0' } }, h('div', { style: { font: '600 20px/28px var(--font-display)' }, text: v.name }),
          sm ? h('div', { style: { fontSize: '12px', color: 'var(--text-2)' }, text: 'qarz ' + ms(sm.debt) + ' · 30 kunda olindi ' + ms(sm.purchases30) + ' · to‘landi ' + ms(sm.paid30) }) : null),
        h('button', { class: 'btn subtle', onclick: function () { clear(box); } }, icon('close'), 'Yopish')));
      var left = h('div', { style: { display: 'grid', gap: '12px', alignContent: 'start' } }), right = h('div', { style: { display: 'grid', gap: '12px', alignContent: 'start' } });
      wrap.appendChild(h('div', { class: 'grid g2' }, left, right));
      function reload() { vendorPanel(box, key, ctx); }
      function refreshAll() { A.go('payables', { vendor: key }); }
      // To'lov kiritish
      if (canPay) {
        var amt = U.moneyInput(), date = U.input({ type: 'date', value: U.isoDay(0) }), nt = U.input({ placeholder: 'Izoh: to‘lov raqami, bank…' }), er = h('div', { class: 'err' });
        date.max = U.isoDay(0); nt.maxLength = 200;
        var save = h('button', { class: 'btn accent', onclick: function () {
          var n = amt.num(); if (n <= 0 || !date.value) { er.textContent = 'Summa va sanani kiriting.'; return; }
          save.disabled = true;
          A.api('POST', '/v1/payables/payments', { vendorKey: key, date: date.value, amount: n, note: nt.value.trim() }).then(function () { A.toast('ok', 'To‘lov kiritildi'); refreshAll(); },
            function (e) { save.disabled = false; er.textContent = errText(e); });
        } }, 'Saqlash');
        left.appendChild(h('div', { class: 'card pad', style: { background: 'var(--layer-sub)' } }, h('b', { text: 'To‘lov kiritish' }),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 160px', gap: '10px', marginTop: '8px' } }, U.field('Summa', amt), U.field('Sana', date)),
          U.field('Izoh', nt), er, h('div', { style: { textAlign: 'right' } }, save)));
      }
      // Shartlar
      if (canEdit) left.appendChild(termsForm(v, refreshAll));
      else left.appendChild(h('div', { style: { color: 'var(--text-2)' }, text: v.configured ? 'To‘lov shartlari: ' + v.terms.termDays + ' kun' : 'shart kiritilmagan' }));
      // Ochiq nakladnoylar
      var open = h('div', { class: 'card pad' }, h('b', { text: 'Ochiq nakladnoylar (' + v.open.length + ')' }));
      if (!v.open.length) open.appendChild(h('div', { style: { color: 'var(--text-2)', marginTop: '6px' }, text: 'Ochiq nakladnoy yo‘q.' }));
      v.open.forEach(function (i) {
        var meta = (i.daysToDue < 0 ? (-i.daysToDue) + ' kun kechikkan' : 'muddat ' + dm(i.due) + ' (' + i.daysToDue + ' kun)') +
          (i.penaltyAccrued > 0 ? ' · penya ' + ms(i.penaltyAccrued) : '') + (i.earlyUntil ? ' · ' + dm(i.earlyUntil) + ' gacha to‘lasa −' + ms(i.earlySaving) : '');
        open.appendChild(row2(h('div', null, h('div', { text: (i.synthetic ? 'Boshlang‘ich qoldiq' : (i.number || '—')) + ' · ' + dm(i.date) }), h('div', { style: { fontSize: '12px', color: i.daysToDue < 0 ? 'var(--crit)' : 'var(--text-2)' }, text: meta })),
          h('div', { style: { textAlign: 'right' } }, h('b', { text: ms(i.remaining) }), i.remaining < i.sum ? h('div', { style: { fontSize: '11px', color: 'var(--text-2)' }, text: '/ ' + ms(i.sum) }) : null)));
      });
      right.appendChild(open);
      // To'lovlar
      var pays = h('div', { class: 'card pad' }, h('b', { text: 'To‘lovlar (' + v.payments.length + ')' }));
      if (!v.payments.length) pays.appendChild(h('div', { style: { color: 'var(--text-2)', marginTop: '6px' }, text: 'To‘lov kiritilmagan.' }));
      v.payments.forEach(function (p) {
        var del = canPay ? h('button', { class: 'btn subtle', onclick: function () {
          U.confirm('To‘lovni o‘chirish', dm(p.date) + ' · ' + A.money(p.amount) + (p.note ? ' · ' + p.note : ''), 'O‘chirish').then(function (ok) {
            if (!ok) return;
            A.api('DELETE', '/v1/payables/payments/' + encodeURIComponent(p.id)).then(function () { A.toast('ok', 'To‘lov o‘chirildi'); refreshAll(); }, function (e) { A.toast('crit', 'Bajarilmadi', errText(e)); });
          });
        } }, 'O‘chirish') : null;
        pays.appendChild(row2(h('div', null, h('div', { text: dm(p.date) + (p.note ? ' · ' + p.note : '') }), h('div', { style: { fontSize: '12px', color: 'var(--text-2)' }, text: p.by || '' })),
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, h('b', { style: { color: 'var(--ok)' }, text: ms(p.amount) }), del)));
      });
      right.appendChild(pays);
      // Kirimlar
      var rc = h('div', { class: 'card pad' }, h('b', { text: 'Oxirgi kirimlar (FOM)' }));
      if (!v.receipts.length) rc.appendChild(h('div', { style: { color: 'var(--text-2)' }, text: '—' }));
      v.receipts.slice(0, 20).forEach(function (r) { rc.appendChild(row2(h('span', { style: { color: 'var(--text-2)' }, text: dm(r.date) + ' · ' + (r.snumber || r.number) }), h('span', { style: { color: r.sum < 0 ? 'var(--ok)' : null }, text: ms(r.sum) }))); });
      right.appendChild(rc);
      void reload;
    }, function (e) {
      if (!ctx.isCurrent()) return;
      clear(wrap); wrap.appendChild(A.infobar('crit', 'Yuklab bo‘lmadi. ', errText(e), h('button', { class: 'btn', onclick: function () { vendorPanel(box, key, ctx); } }, 'Qayta urinish')));
    });
  }

  function termsForm(v, done) {
    var t = v.terms, er = h('div', { class: 'err' }), adv = t.opening < 0, exc = !!t.excluded;
    var termDays = U.input({ value: String(t.termDays), num: true }), cl = U.moneyInput(t.creditLimit || 0);
    var ep = U.input({ value: t.earlyRate ? String(pct2(t.earlyRate)).replace('.', ',') : '', placeholder: '2', num: true });
    var ed = U.input({ value: t.earlyDays ? String(t.earlyDays) : '', placeholder: '10', num: true });
    var pp = U.input({ value: t.penaltyDaily ? String(pct2(t.penaltyDaily)).replace('.', ',') : '', placeholder: '0,1', num: true });
    var od = U.input({ type: 'date', value: t.openingDate || '' }), op = U.moneyInput(Math.abs(t.opening || 0));
    var save = h('button', { class: 'btn accent', onclick: function () {
      var n = function (i) { return parseDec(i.value) || 0; };
      if (termDays.value.trim() === '') { er.textContent = 'To‘lov muddatini kiriting.'; return; }
      save.disabled = true;
      A.api('PUT', '/v1/payables/vendors/' + encodeURIComponent(v.key), {
        termDays: Math.round(n(termDays)), earlyDays: Math.round(n(ed)), earlyRate: n(ep) / 100, penaltyDaily: n(pp) / 100,
        creditLimit: cl.num(), opening: op.num() * (adv ? -1 : 1), openingDate: od.value || null, excluded: exc
      }).then(function () { A.toast('ok', 'Shartlar saqlandi'); done(); }, function (e) { save.disabled = false; er.textContent = errText(e); });
    } }, 'Shartlarni saqlash');
    return h('div', { class: 'card pad' },
      h('div', { style: { display: 'flex', justifyContent: 'space-between' } }, h('b', { text: 'To‘lov shartlari' }), v.configured ? h('span', { style: { fontSize: '11px', color: 'var(--text-2)' }, text: t.updatedBy || '' }) : null),
      h('div', { class: 'form-grid', style: { marginTop: '8px' } },
        U.field('To‘lov muddati, kun', termDays), U.field('Kredit limiti', cl), U.field('Erta to‘lov chegirmasi, %', ep), U.field('Chegirma muddati, kun', ed),
        U.field('Penya, kuniga %', pp), U.field('Boshlang‘ich qoldiq sanasi', od, 'Bu sanadan oldingi nakladnoylar hisobga olinmaydi'), U.field('Boshlang‘ich qoldiq', op),
        h('div', null, sw('Bu avans (firma bizga qarzdor)', adv, function (x) { adv = x; }), sw('Hisobdan chiqarish (ta’minotchi emas)', exc, function (x) { exc = x; }))),
      er, h('div', { style: { textAlign: 'right' } }, save));
  }

  function settingsDlg(s) {
    var auto = s.settings.paySharePct === null, er = h('div', { class: 'err' });
    var term = U.input({ value: String(s.settings.defaultTermDays), num: true }), cash = U.moneyInput(Math.abs(s.settings.startCash || 0));
    var share = U.input({ value: String(s.settings.paySharePct != null ? s.settings.paySharePct : s.inflow.costSharePct), num: true });
    var shareF = U.field('Tushumning necha foizi firmalarga, %', share); shareF.style.display = auto ? 'none' : '';
    return A.dialog({ title: 'To‘lov kalendari sozlamalari', primary: 'Saqlash',
      body: h('div', { style: { minWidth: '440px' } }, h('p', { class: 'note', text: 'Prognoz va reja shu qiymatlar bilan hisoblanadi.' }),
        U.field('Standart to‘lov muddati, kun (shart kiritilmagan firmalar uchun)', term), U.field('Hozirgi bo‘sh pul (bank + kassa)', cash, 'Firmalarga to‘lash uchun hozir mavjud pul'),
        sw('Kunlik to‘lov imkoni = tushumning tannarx ulushi (avto, hozir ' + s.inflow.costSharePct + '%)', auto, function (x) { auto = x; shareF.style.display = x ? 'none' : ''; }), shareF, er),
      onPrimary: function () {
        if (term.value.trim() === '') { er.textContent = 'Muddatni kiriting.'; return false; }
        var sp = auto ? null : Math.min(100, Math.max(0, parseDec(share.value) || 0));
        return A.api('PUT', '/v1/payables/settings', { defaultTermDays: Math.round(parseDec(term.value) || 0), startCash: cash.num(), paySharePct: sp })
          .then(function () { A.toast('ok', 'Sozlamalar saqlandi'); A.render(); }, function (e) { er.textContent = errText(e); return false; });
      } });
  }

  // ═════════════ Vrachlar va ROI ═════════════
  var viewedDocs = {};
  function roiKind(r) { return r >= 100 ? 'ok' : r >= 0 ? 'warn' : 'crit'; }
  function fmtRoi(r) { return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r) + '%'; }
  var DOC_F = [['name', 'Vrach F.I.Sh.', 1, 0, 120], ['clinic', 'Klinika', 1, 0, 120], ['spec', 'Mutaxassislik', 1, 0, 80], ['region', 'Hudud', 1, 0, 80], ['owner', 'Mas’ul', 1, 0, 80],
    ['model', 'To‘lov modeli', 1, 0, 120], ['monthlyCost', 'Xarajat/oy, so‘m', 1, 1], ['plan', 'Reja (oyiga sotuv), so‘m', 1, 1], ['startDate', 'Boshlanish sanasi', 1, 0, 0, 'date'],
    ['branches', 'Filiallar', 0, 0, 200], ['meds', 'Dorilar', 0, 0, 500]];
  function doctorForm(d) {
    var inp = {}, er = h('div', { class: 'err' }), grid = h('div', { class: 'form-grid' });
    DOC_F.forEach(function (f) {
      var src = d ? (f[0] === 'monthlyCost' ? d.cost : d[f[0]]) : null, i;
      if (f[3]) i = U.moneyInput(src || 0); else { i = U.input({ value: src != null ? String(src) : (f[0] === 'startDate' ? U.isoDay(0) : ''), type: f[5] }); if (f[4]) i.maxLength = f[4]; }
      inp[f[0]] = i; var fl = U.field(f[1] + (f[2] ? ' *' : ''), i); if (f[0] === 'meds') fl.style.gridColumn = '1 / -1'; grid.appendChild(fl);
    });
    return A.dialog({ title: d ? 'Kelishuvni tahrirlash' : 'Yangi kelishuv', primary: 'Saqlash', body: h('div', { style: { minWidth: '540px' } }, grid, er),
      onPrimary: function () {
        var v = {}, bad = null;
        DOC_F.forEach(function (f) {
          if (f[3]) { v[f[0]] = inp[f[0]].num(); return; }
          var x = inp[f[0]].value.trim(); if (f[2] && !x) bad = f[1]; if (x) v[f[0]] = x;
        });
        if (bad) { er.textContent = 'Majburiy maydon: ' + bad; return false; }
        if (d) v.id = d.id;
        return A.cmd('doctors.upsert', v).then(function () { A.toast('ok', 'Kelishuv saqlandi', v.name); A.render(); }, function (e) { er.textContent = errText(e); return false; });
      } });
  }

  A.screens.doctors = function (page, params, ctx) {
    return Promise.all([A.get('/v1/doctors'), A.get('/v1/doctorSummaries').catch(function () { return []; })]).then(function (r) {
      U.guard(ctx);
      var docs = r[0] || [], sums = r[1] || [], canEdit = !A.readOnly() && hasRole(['OWNER', 'FINANCE']);
      page.classList.add('wide');
      var add = h('button', { class: 'btn accent', onclick: function () { doctorForm(null); } }, icon('plus'), 'Yangi kelishuv');
      if (!canEdit) { add.disabled = true; add.title = A.readOnly() ? 'Auditor rejimi — faqat o‘qish' : 'Faqat Egasi yoki Moliya'; }
      page.appendChild(U.head('Vrachlar bilan kelishuvlar', null, [U.pill('warn', 'MAXFIY · har ko‘rish auditga yoziladi'), add, U.refreshBtn()]));
      if (!docs.length) { page.appendChild(U.card(null, null, U.empty('Kelishuvlar yo‘q', 'doctor'))); return; }
      var act = docs.filter(function (d) { return d.status !== 'closed'; });
      var tc = act.reduce(function (a, d) { return a + (d.cost || 0); }, 0), tp = act.reduce(function (a, d) { return a + (d.profit || 0); }, 0);
      var review = sums.filter(function (s) { return (s.negMonths || 0) >= 2; }).length || act.filter(function (d) { return (d.months || []).length >= 2 && d.months.slice(-2).every(function (x) { return x < 0; }); }).length;
      page.appendChild(h('div', { class: 'grid g4', style: { marginBottom: '12px' } },
        kcard('Faol kelishuvlar', String(act.length), docs.length - act.length ? (docs.length - act.length) + ' ta yopilgan' : null),
        kcard('Vrach xarajati / oy', ms(tc)), kcard('Qo‘shimcha yalpi foyda', ms(tp)),
        kcard('O‘rtacha ROI', tc ? fmtRoi(Math.round((tp - tc) / tc * 100)) : '—', review ? review + ' ta qayta ko‘rish kerak' : null, tc && tp < tc ? 'crit' : null)));
      var sel = (params && params.id) || (docs[0] && docs[0].id), detail = h('div'), tblBox = h('div');
      function paintTable() {
        clear(tblBox);
        tblBox.appendChild(U.table([
          { t: 'Vrach', render: function (x) { return h('div', null, h('b', { text: x.name }), h('div', { style: { fontSize: '12px', color: 'var(--text-2)' }, text: x.clinic + ' · ' + x.spec })); } },
          { t: 'Mas’ul', k: 'owner' }, { t: 'To‘lov modeli', k: 'model', muted: true },
          { t: 'Xarajat/oy', r: true, render: function (x) { return A.num(x.cost); } }, { t: 'Qo‘sh. foyda', r: true, render: function (x) { return A.num(x.profit); } },
          { t: 'ROI', r: true, render: function (x) { return x.status === 'closed' ? U.pill('mute', 'Yopilgan') : U.pill(roiKind(x.roi), fmtRoi(x.roi)); } }
        ], docs, { onRow: function (x) { sel = x.id; paintTable(); paintDetail(); } }));
        Array.prototype.forEach.call(tblBox.querySelectorAll('tbody tr'), function (tr, i) { if (docs[i] && docs[i].id === sel) tr.style.background = 'var(--selected)'; });
      }
      function paintDetail() {
        clear(detail);
        var d = docs.filter(function (x) { return x.id === sel; })[0]; if (!d) return;
        if (!viewedDocs[d.id]) { viewedDocs[d.id] = 1; A.cmd('audit.log', { action: 'Vrach kelishuvi ko‘rildi', object: d.name, branchId: null, before: '—', after: '—', reason: '—', sensitive: true }).catch(function () {}); }
        var net = (d.profit || 0) - (d.cost || 0), closed = d.status === 'closed', months = d.months || [];
        var rec = months.length >= 2 && months.slice(-2).every(function (x) { return x < 0; });
        var acts = canEdit && !closed ? [h('button', { class: 'btn', onclick: function () { doctorForm(d); } }, icon('more'), 'Tahrirlash'),
          h('button', { class: 'btn danger', onclick: function () {
            U.prompt('Kelishuvni yopish', 'Sabab', { required: true, primary: 'Yopish', text: d.name + ' — kelishuv yopiladi, yozuv ro‘yxatda qoladi.' }).then(function (reason) {
              if (reason === false) return;
              if (reason.length < 3) { A.toast('crit', 'Sabab kamida 3 belgi'); return; }
              U.run('doctors.close', { id: d.id, reason: reason }, 'Kelishuv yopildi').then(function () { A.render(); }, function () {});
            });
          } }, icon('close'), 'Yopish')] : [];
        var pf = d.plan ? Math.round(d.fact / d.plan * 100) : 0;
        var info = h('div', { class: 'card pad' },
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' } },
            h('div', { style: { flex: '1', minWidth: '0' } }, h('div', { style: { font: '600 20px/28px var(--font-display)' }, text: d.name }), h('div', { style: { fontSize: '12px', color: 'var(--text-2)' }, text: [d.clinic, d.spec, d.region].filter(Boolean).join(' · ') })),
            acts, closed ? U.pill('mute', 'Yopilgan') : null),
          closed ? A.infobar('info', 'Kelishuv yopilgan. ', (d.closedAt ? U.fmtDate(d.closedAt) + ' · ' : '') + (d.closeReason || '')) : null,
          U.kvList([['Kelishuv davri', d.startDate ? U.fmtDate(d.startDate) + ' dan' : '—'], ['To‘lov modeli', d.model], ['Dorilar', d.meds], ['Atributsiya', d.method], ['Mas’ul · filial', (d.owner || '—') + ' · ' + (d.branches || '—')]]),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '13px' } }, h('span', { style: { color: 'var(--text-2)' }, text: 'Reja / haqiqiy (attributsiya qilingan sotuv)' }), h('b', { text: pf + '%' })),
          h('div', { class: 'bar', style: { height: '8px', margin: '6px 0' } }, h('i', { style: { width: Math.min(100, pf) + '%' } })),
          h('div', { style: { fontSize: '12px', color: 'var(--text-2)' }, text: A.money(d.fact) + ' / ' + A.money(d.plan) }));
        var mx = Math.max.apply(null, [1].concat(months.map(Math.abs)));
        var chart = h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '16px', height: '130px', borderBottom: '1px solid var(--stroke)', padding: '0 8px' } }, months.map(function (v) {
          return h('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: '4px' } },
            h('b', { style: { fontSize: '12px' }, text: fmtRoi(v) }), h('div', { style: { width: '100%', maxWidth: '56px', borderRadius: '3px 3px 0 0', height: Math.max(3, Math.abs(v) / mx * 90) + '%', background: 'var(--' + roiKind(v) + ')' } }));
        }));
        var ml = ['Avgust', 'Sentyabr', 'Oktabr'].slice(-months.length);
        var roi = h('div', { class: 'card pad' },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, h('b', { text: 'ROI · oxirgi oy' }), U.pill(roiKind(d.roi), fmtRoi(d.roi))),
          h('div', { class: 'grid g3', style: { margin: '12px 0' } },
            h('div', null, h('div', { style: { fontSize: '12px', color: 'var(--text-2)' }, text: 'Qo‘shimcha yalpi foyda' }), h('b', { text: A.money(d.profit) })),
            h('div', null, h('div', { style: { fontSize: '12px', color: 'var(--text-2)' }, text: 'Vrach xarajati' }), h('b', { text: A.money(d.cost) })),
            h('div', null, h('div', { style: { fontSize: '12px', color: 'var(--text-2)' }, text: 'Sof natija' }), h('b', { style: { color: net >= 0 ? 'var(--ok)' : 'var(--crit)' }, text: A.money(net) }))),
          chart, h('div', { style: { display: 'flex', gap: '16px', padding: '4px 8px' } }, ml.map(function (l) { return h('span', { style: { flex: '1', textAlign: 'center', fontSize: '11px', color: 'var(--text-2)' }, text: l }); })),
          rec && !closed ? h('div', { style: { marginTop: '10px' } }, A.infobar('crit', 'Kelishuvni qayta ko‘rib chiqish tavsiya etiladi. ', 'ROI 2 oy ketma-ket salbiy. Qaror Egasi tomonidan qabul qilinadi.')) : null);
        detail.appendChild(h('div', { class: 'grid g2', style: { marginTop: '12px' } }, info, roi));
      }
      page.appendChild(tblBox); page.appendChild(detail);
      paintTable(); paintDetail();
    });
  };

  // ═════════════ Sroklar ═════════════
  var expState = { tab: 'loss', branch: '', preset: 'd30', from: null, to: null, horizon: 60 };
  function range(p) { var to = U.isoDay(0); if (p === 'month') return [to.slice(0, 8) + '01', to]; return [U.isoDay({ d7: 6, d30: 29, d90: 89, d365: 364 }[p]), to]; }

  A.screens.expiry = function (page, params, ctx) {
    var S = expState, me = A.state.me || {};
    if (me.branchId && A.role() === 'MANAGER') S.branch = me.branchId;
    if (!S.from) { var rg = range(S.preset || 'd30'); S.from = rg[0]; S.to = rg[1]; }
    var bq = S.branch ? '&branchId=' + encodeURIComponent(S.branch) : '';
    var req = S.tab === 'loss' ? softGet('/v1/expiry/writeoffs?from=' + S.from + '&to=' + S.to + bq) : softGet('/v1/expiry/near?horizon=' + S.horizon + bq);
    return Promise.all([req, A.branchesCached()]).then(function (r) {
      U.guard(ctx);
      var res = r[0];
      if (!res.ok && res.err && res.err.status === 403) throw res.err;
      page.classList.add('wide');
      page.appendChild(U.head('Sroklar', 'Srogi o‘tib yozib tashlangan dorilar va zarari, srogi yaqin partiyalar va ularni qaysi filialga o‘tkazsa muddatigacha sotilib ketishi — FOM ma’lumoti asosida.', [U.refreshBtn()]));
      var bsel = U.select(U.branchOptions('Barcha filiallar'), S.branch, function (v) { S.branch = v; A.render(); }, '220px');
      if (A.role() === 'MANAGER' && me.branchId) bsel.disabled = true;
      var bar = h('div', { class: 'card pad toolbar', style: { alignItems: 'flex-end' } }, U.field('Filial', bsel));
      if (S.tab === 'loss') {
        var fi = U.input({ type: 'date', value: S.from }), ti = U.input({ type: 'date', value: S.to });
        fi.max = S.to; ti.min = S.from;
        fi.onchange = function () { if (fi.value && fi.value <= S.to) { S.from = fi.value; S.preset = null; A.render(); } };
        ti.onchange = function () { if (ti.value && ti.value >= S.from) { S.to = ti.value; S.preset = null; A.render(); } };
        bar.appendChild(U.field('Dan', fi)); bar.appendChild(U.field('Gacha', ti));
        bar.appendChild(h('div', { style: { paddingBottom: '14px' } }, U.seg([['d7', '7 kun'], ['d30', '30 kun'], ['d90', '90 kun'], ['d365', '1 yil'], ['month', 'Bu oy']], S.preset, function (k) { var x = range(k); S.preset = k; S.from = x[0]; S.to = x[1]; A.render(); })));
      } else {
        bar.appendChild(U.field('Necha kun ichida', U.seg([30, 60, 90, 120].map(function (d) { return [d, d + ' kun']; }), S.horizon, function (v) { S.horizon = v; A.render(); })));
      }
      page.appendChild(bar);
      page.appendChild(h('div', { style: { margin: '8px 0 12px' } }, U.tabs([['loss', 'Srok zarari'], ['near', 'Srogi yaqin va ko‘chirish']], S.tab, function (v) { S.tab = v; A.render(); })));
      if (!res.ok) { page.appendChild(A.infobar('warn', 'Sroklar ma’lumoti olinmadi. ', errText(res.err))); return; }
      var d = res.data, bn = function (id) { return id ? A.branchName(id) : '—'; };
      var nc = A.infobar('info', 'FOM ulanmagan. ', 'FOM agenti ulanmagan yoki sroklar ma’lumoti hali kelmagan. Tizim → FOM integratsiya sahifasida agentni ulang (agent v1.1+ kerak).',
        A.can('fom') ? h('button', { class: 'btn', onclick: function () { A.go('fom'); } }, 'FOM integratsiya') : null);
      if (S.tab === 'loss') {
        if (!d.connected) { page.appendChild(nc); return; }
        var t = d.totals;
        page.appendChild(h('div', { class: 'grid g4' }, kcard('Srok sababli zarar', ms(t.expiredCost), null, t.expiredCost > 0 ? 'crit' : null), kcard('Jami yozib tashlangan', ms(t.cost)),
          kcard('Srok sababli, dona', qty(t.expiredQty)), kcard('Yo‘qolgan savdo (chakana)', ms(t.retail))));
        page.appendChild(note('Zarar tannarx bo‘yicha. «Srok sababli» — partiya srogi yozib tashlash sanasidan 7 kun ichida tugagan (FOM’da sabab ustuni yo‘q). Srogi topilmagan: ' + qty(t.unknownQty) + ' dona.'));
        if (!d.byBranch.length) { page.appendChild(U.card(null, null, U.empty('Bu oraliqda yozuv yo‘q.', 'expire'))); return; }
        var series = d.byDay.map(function (x) { return { l: x.date.slice(5), v: x.expiredCost }; });
        page.appendChild(h('div', { class: 'grid g2', style: { marginBottom: '12px' } },
          U.card('Filiallar bo‘yicha zarar', null, U.hbar(d.byBranch.map(function (b) { return { l: bn(b.branchId), v: b.expiredCost }; }), { fmt: ms })),
          U.card('Kunlar bo‘yicha', null, h('div', { style: { padding: '8px 12px' } }, series.length > 45 ? U.areaChart(series) : U.bars(series.map(function (x) { return x.v; }), 'so‘m')))));
        page.appendChild(U.table([
          { t: 'Dori', k: 'good', clip: true }, { t: 'Filial', muted: true, render: function (g) { return bn(g.branchId); } },
          { t: 'Soni', r: true, render: function (g) { return qty(g.qty); } },
          { t: 'Srok sababli', r: true, render: function (g) { return g.expiredCost > 0 ? h('b', { style: { color: 'var(--crit)' }, text: ms(g.expiredCost) }) : '—'; } },
          { t: 'Zarar', r: true, render: function (g) { return ms(g.cost); } }
        ], d.topGoods, { title: 'Eng ko‘p zarar keltirgan dorilar' }));
      } else {
        if (!d.connected || !d.stockAt) { page.appendChild(nc); return; }
        var n = d.totals;
        page.appendChild(h('div', { class: 'grid gauto' }, kcard('Srogi yaqin tovar qiymati', ms(n.value), S.horizon + ' kun'),
          kcard('Tokchada srogi o‘tgan', ms(n.expiredOnShelfCost), null, n.expiredOnShelfCost > 0 ? 'crit' : null), kcard('Sotilmay qolish xavfi', ms(n.atRiskCost), null, n.atRiskCost > 0 ? 'warn' : null),
          kcard('Ko‘chirib saqlanadi', ms(n.savableCost), null, n.savableCost > 0 ? 'ok' : null), kcard('Baribir qoladi', ms(n.leftoverCost))));
        page.appendChild(note('Prognoz: oxirgi ' + d.lookbackDays + ' kunlik sotuv tezligi bilan. Ko‘chirishga ' + d.transitDays + ' kun yo‘l hisobga olingan. Ma’lumot: ' + U.fmtDateTime(d.stockAt) + '.'));
        var tr = h('div', { class: 'card pad', style: { marginBottom: '12px' } }, h('b', { text: 'Ko‘chirish tavsiyalari' }));
        if (!d.transfers.length) tr.appendChild(h('div', { style: { color: 'var(--text-2)', marginTop: '6px' }, text: 'Hozircha foydali ko‘chirish yo‘q.' }));
        d.transfers.slice(0, 30).forEach(function (x) {
          tr.appendChild(row2(h('div', { style: { minWidth: '0' } },
            h('div', null, h('b', { text: x.good }), h('span', { style: { color: 'var(--text-2)' }, text: ' · ' + bn(x.fromBranchId) + ' · ' + x.expiry + ' (' + x.daysLeft + ' kun)' })),
            h('div', null, qty(x.qty) + ' dona → ' + bn(x.toBranchId), h('span', { style: { fontSize: '12px', color: 'var(--text-2)' }, text: ' · u yerda kuniga ' + x.toPerDay + ' dona · ~' + x.sellDays + ' kunda sotiladi' }))),
            U.pill('ok', 'saqlanadi ' + ms(x.savedCost))));
        });
        page.appendChild(tr);
        var STT = { expired: 'crit', critical: 'warn', warning: 'mute' };
        page.appendChild(U.table([
          { t: 'Dori', render: function (x) { return h('div', null, h('div', { text: x.good }), x.series ? h('div', { style: { fontSize: '11px', color: 'var(--text-2)' }, text: x.series }) : null); } },
          { t: 'Filial', muted: true, render: function (x) { return bn(x.branchId); } },
          { t: 'Srogi', render: function (x) { return h('div', null, h('div', { text: x.expiry }), U.pill(STT[x.status] || 'mute', x.status === 'expired' ? 'Srogi o‘tgan' : x.daysLeft + ' kun')); } },
          { t: 'Soni', r: true, render: function (x) { return qty(x.qty); } }, { t: 'Kuniga sotuv', r: true, k: 'perDay' },
          { t: 'Sotiladi', r: true, render: function (x) { return qty(x.sellable); } },
          { t: 'Xavf', r: true, render: function (x) { return x.atRiskCost > 0 ? h('b', { style: { color: 'var(--crit)' }, text: ms(x.atRiskCost) }) : '—'; } },
          { t: 'Tavsiya', render: function (x) {
            return h('div', { style: { fontSize: '12px' } }, x.atRiskQty === 0 ? h('div', { style: { color: 'var(--ok)' }, text: 'O‘zi sotilib ketadi' }) : null,
              x.transfers.map(function (t2) { return h('div', { text: qty(t2.qty) + ' dona → ' + bn(t2.toBranchId) }); }),
              x.leftoverQty > 0 ? h('div', { style: { color: 'var(--warn)' }, text: qty(x.leftoverQty) + ' dona qoladi: chegirma yoki ta’minotchiga qaytarish' }) : null);
          } }
        ], d.items, { empty: 'Bu muddat ichida srogi tugaydigan partiya yo‘q.' }));
      }
    });
  };
})();
