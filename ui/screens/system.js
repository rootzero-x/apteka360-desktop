/* Apteka 360 Desktop — «Tizim» bo'limi native ekranlari: FOM integratsiya, Tizim holati, Foydalanuvchilar, Rollar,
 * Modullar, AI sozlamalari, Sozlamalar, Profil va Filiallar (boshqaruv bilan). Matnlar web panelning uz i18n'idan. */
(function () {
  'use strict';
  var A = window.Apteka, h = A.h, U = A.ui, icon = A.icon, clear = A.clear;
  var head = U.head, card = U.card, pill = U.pill, field = U.field, input = U.input, guard = U.guard;

  var ROLE_CODES = ['OWNER', 'SUPER_ADMIN', 'FINANCE', 'MANAGER', 'HR', 'OPERATOR', 'EMPLOYEE', 'AUDITOR'];
  var ROLE = { OWNER: 'Egasi', SUPER_ADMIN: 'Super admin', FINANCE: 'Moliya admin', MANAGER: 'Filial mudiri', HR: 'HR menejer', OPERATOR: 'Video operator', EMPLOYEE: 'Xodim', AUDITOR: 'Auditor' };
  var SCOPES = { OWNER: 'Barcha filiallar', SUPER_ADMIN: 'Barcha filiallar', FINANCE: 'Bir nechta filial', MANAGER: 'Bitta filial (o‘z filiali)', HR: 'Bir nechta filial', OPERATOR: 'Bir nechta filial', EMPLOYEE: 'Faqat o‘zi', AUDITOR: 'Barcha filiallar' };

  // ───────────── Yordamchilar ─────────────
  function tf(s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v[k] == null ? '' : String(v[k]); }); }
  function isAdmin() { var r = A.role(); return (r === 'OWNER' || r === 'SUPER_ADMIN') && !A.readOnly(); }
  function errText(e) {
    if (!e) return 'Xato';
    var t = e.error || String(e), d = e.details;
    if (d && d.blockers && d.blockers.length && t.indexOf(d.blockers[0].text || '\u0000') < 0) t += ' — ' + d.blockers.map(function (b) { return b.text || (b.kind + ': ' + b.count); }).join('; ');
    else if (Array.isArray(d) && d.length && d[0] && d[0].message) t += ' — ' + d.slice(0, 3).map(function (x) { return (x.path || x.row || '') + ' ' + x.message; }).join('; ');
    return t;
  }
  function fail(e) { A.toast('crit', 'Bajarilmadi', errText(e)); }
  function copy(value, okText) {
    var p;
    try { p = navigator.clipboard.writeText(value); } catch (e) { p = Promise.reject(e); }
    return Promise.resolve(p).then(function () { A.toast('ok', okText || 'Nusxalandi'); }, function () { A.toast('info', 'Nusxalab bo‘lmadi', value); });
  }
  function copyRow(label, value, okText) {
    return h('div', { style: { marginTop: '12px' } },
      h('div', { class: 'muted', style: { fontSize: '12px', color: 'var(--text-2)', marginBottom: '4px' }, text: label }),
      h('div', { style: { display: 'flex', gap: '8px', alignItems: 'flex-start' } },
        h('div', { class: 'secret mono', style: { flex: '1', minWidth: '0', whiteSpace: 'pre-wrap' }, text: value }),
        h('button', { class: 'btn', style: { minWidth: '0' }, onclick: function () { copy(value, okText); } }, 'Nusxalash')));
  }
  /** Fluent toggle. onchange(v) → Promise|void; Promise rad etilsa holat qaytariladi. */
  function sw(on, onchange, disabled) {
    var b = h('button', { class: 'switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': on ? 'true' : 'false' });
    b.disabled = !!disabled; b.value_ = !!on;
    b.set = function (v) { b.value_ = !!v; b.classList.toggle('on', !!v); b.setAttribute('aria-checked', v ? 'true' : 'false'); };
    b.onclick = function () {
      var v = !b.value_; b.set(v);
      var r = onchange && onchange(v);
      if (r && r.then) { b.disabled = true; r.then(function () { b.disabled = !!disabled; }, function () { b.set(!v); b.disabled = !!disabled; }); }
    };
    return b;
  }
  /** Windows Sozlamalar uslubidagi qator: ikonka · sarlavha/izoh · boshqaruv */
  function srow(title, desc, control, ic, extra) {
    return h('div', { class: 'list-item', style: { alignItems: 'center' } },
      ic ? (function () { var i = icon(ic); i.style.cssText = 'width:20px;height:20px;color:var(--text-2);flex:none'; return i; })() : null,
      h('div', { style: { minWidth: '0', flex: '1' } }, h('div', { class: 't', style: { fontWeight: '400' } }, title), desc ? h('div', { class: 's', text: desc }) : null, extra || null),
      control ? h('div', { style: { marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center', flex: 'none' } }, control) : null);
  }
  function selectEl(options, value, width) {
    var s = h('select', { class: 'tb', style: { width: width || '100%' } });
    options.forEach(function (o) { var op = h('option', { value: o[0], text: o[1] }); if (o[0] === value) op.selected = true; s.appendChild(op); });
    return s;
  }
  function errBox() { return h('div', { class: 'err' }); }
  /** Kengroq dialog (forma uchun). */
  function wideDialog(o, w) {
    var d = document.getElementById('dlg'); if (d) d.style.width = w || '600px';
    return A.dialog(o).then(function (v) { if (d) d.style.width = ''; return v; });
  }
  function pad(el) { el.style.padding = '16px 20px'; return el; }
  function sectionCard(title, sub, body, more) {
    return h('div', { class: 'card', style: { marginBottom: '12px' } },
      h('div', { class: 'card-h' }, h('div', null, h('h3', { text: title }), sub ? h('div', { style: { fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }, text: sub }) : null), more ? h('div', { class: 'more' }, more) : null),
      body);
  }
  function apiUrl() {
    var D = window.__APTEKA_DESKTOP__ || {};
    if (D.api_url) return String(D.api_url).replace(/\/$/, '');
    var st = document.getElementById('st-server'); var host = st && st.textContent.trim();
    return host && host !== '—' ? 'https://' + host : '<server manzili>';
  }

  // ═════════════ FOM integratsiya ═════════════
  var FOM_ST = { ok: ['ok', 'Onlayn'], delay: ['warn', 'Kechikmoqda'], down: ['crit', 'Uzilgan'] };
  function secretDialog(id, secret) {
    var ini = '[apteka360]\napi_url = ' + apiUrl() + '\nagent_id = ' + id + '\nsecret = ' + secret + '\n\n[fapteka]\nurl = http://127.0.0.1:8765\notdels =\ndays = 31\n\n[agent]\ninterval = 120';
    return wideDialog({
      title: 'Agent kaliti — faqat hozir ko‘rinadi', primary: 'Tushunarli', secondary: false,
      body: h('div', null, h('p', { class: 'note', text: 'Bu qiymatlarni dorixona kompyuteridagi fom_agent.ini fayliga qo‘ying. Kalit qayta ko‘rsatilmaydi; yo‘qolsa «Kalitni yangilash» tugmasini bosing.' }),
        copyRow('agent_id', id), copyRow('secret', secret), copyRow('fom_agent.ini', ini))
    }, '620px');
  }
  A.screens.fom = function (page, params, ctx) {
    var admin = isAdmin();
    return Promise.all([A.get('/v1/fom/agents'), A.branchesCached(), A.get('/v1/fomMap').catch(function () { return null; })]).then(function (r) {
      guard(ctx);
      var agents = r[0] || [], br = r[1] || [], map = r[2];
      var addBtn = admin ? h('button', { class: 'btn accent', onclick: addAgent }, icon('plus'), 'Agent qo‘shish') : null;
      page.appendChild(head('FOM integratsiya', 'FOM (F-Apteka) bazasi dorixona kompyuterida turadi. U yerda ishlaydigan agent har 2 daqiqada savdoni imzolangan holda yuboradi — SQL Server tarmoqqa ochilmaydi.', [addBtn, U.refreshBtn()]));
      if (A.readOnly()) page.appendChild(A.infobar('info', 'Auditor rejimi.', 'Faqat ko‘rish — agentlarni egasi yoki super-admin boshqaradi.'));
      if (!agents.length) page.appendChild(card(null, null, U.empty('Hali agent yo‘q. «Agent qo‘shish» bilan boshlang, keyin tools/fom-agent ni dorixona kompyuteriga o‘rnating.', 'refresh')));
      agents.forEach(function (a) { page.appendChild(agentCard(a)); });

      if (map && map.length) {
        var box = h('div');
        map.forEach(function (row, i) {
          var btn = row.done ? pill('ok', '✓ bog‘landi') : U.ro(h('button', { class: 'btn', disabled: !admin, onclick: function () {
            btn.disabled = true;
            A.cmd('fom.link', { index: i }).then(function (x) { A.toast('ok', 'Bog‘landi', row.name); row.done = !x || x.done !== false; A.render(); }).catch(function (e) { btn.disabled = false; fail(e); });
          } }, 'Bog‘lash'));
          box.appendChild(srow(h('span', null, h('b', { text: row.name }), ' ', h('span', { class: 'mono', style: { color: 'var(--text-3)' }, text: row.fom })),
            row.conf ? (row.guess + ' · ' + tf('AI taklifi {n}%', { n: row.conf })) : 'mos topilmadi', btn, 'refresh'));
        });
        page.appendChild(sectionCard('Moslashtirish (mapping)', 'FOM yozuvlarini Apteka 360 obyektlariga bog‘lash', box));
      }
      page.appendChild(A.infobar('info', 'Qanday ulanadi', h('ol', { style: { margin: '6px 0 0', paddingLeft: '18px' } }, [
        'Dorixona kompyuterida FAPTEKA xizmati ishlashi kerak (http://127.0.0.1:8765).',
        '«Agent qo‘shish» — agent_id va secret ni oling.',
        'tools/fom-agent papkasini kompyuterga qo‘ying, fom_agent.ini ni to‘ldiring, run_agent.bat ni avtostartga qo‘shing.',
        'Bitta bazada bir nechta filial bo‘lsa — bitta agent hammasini yuboradi. Har filialda alohida server bo‘lsa — har biriga alohida agent.',
        'Har bir FOM filialini (OTDEL) shu yerda Apteka 360 filialiga bog‘lang.'].map(function (s) { return h('li', { text: s }); }))));

      function addAgent() {
        var nm = input({ placeholder: 'Masalan: Markaziy server yoki Chilonzor 12 kompyuteri', attrs: { maxlength: '80' } }), er = errBox();
        A.dialog({ title: 'Agent qo‘shish', primary: 'Yaratish', body: h('div', null, field('Agent nomi', nm), er), onPrimary: function () {
          var v = nm.value.trim(); if (!v) { er.textContent = 'Majburiy maydon.'; return false; }
          return A.api('POST', '/v1/fom/agents', { name: v }).catch(function (e) { er.textContent = errText(e); return false; });
        } }).then(function (res) { if (res && res.agent) secretDialog(res.agent.id, res.secret).then(A.render); });
      }
      function agentCard(a) {
        var st = FOM_ST[a.status] || ['info', a.status];
        var meta = [a.lastSyncAt ? 'Oxirgi sinxron: ' + U.fmtDateTime(a.lastSyncAt) : 'hali ulanmagan'];
        var dbNode = a.db ? h('span', null, ' · FOM bazasi' + (a.db.database ? ' ' + a.db.database : '') + ': ',
          h('b', { style: { color: a.db.ok ? 'var(--ok)' : 'var(--crit)' }, text: a.db.ok ? 'ulangan · ' + (a.db.latencyMs == null ? '—' : a.db.latencyMs) + ' ms' : 'ulanmagan' })) : null;
        var tools = admin ? [
          h('button', { class: 'btn', onclick: function () {
            U.confirm('Kalitni yangilash', 'Yangi kalit beriladi — eski kalit darhol ishlamay qoladi. Davom etasizmi?', 'Yangilash').then(function (ok) {
              if (!ok) return;
              A.api('POST', '/v1/fom/agents/' + encodeURIComponent(a.id) + '/rotate', {}).then(function (x) { secretDialog(a.id, x.secret); }).catch(fail);
            });
          } }, icon('key'), 'Kalitni yangilash'),
          h('button', { class: 'btn danger', onclick: function () {
            U.confirm('O‘chirish', 'Rostdan o‘chirasizmi? Bog‘langan filiallar FOM ma’lumotini olmay qoladi.', 'O‘chirish').then(function (ok) {
              if (!ok) return;
              A.api('DELETE', '/v1/fom/agents/' + encodeURIComponent(a.id)).then(function () { A.toast('ok', 'Agent o‘chirildi'); A.state.branches = null; A.render(); }).catch(fail);
            });
          } }, 'O‘chirish')] : null;
        var hd = h('div', { class: 'card-h', style: { alignItems: 'flex-start' } },
          h('div', { style: { minWidth: '0' } },
            h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, h('h3', { text: a.name }), pill(st[0], st[1]), h('span', { class: 'mono', style: { color: 'var(--text-3)' }, text: a.id })),
            h('div', { style: { fontSize: '12px', color: 'var(--text-2)', marginTop: '4px' } }, meta[0], dbNode, a.agentVersion ? ' · Agent v' + a.agentVersion : ''),
            a.lastError ? h('div', { style: { fontSize: '12px', color: 'var(--crit)', marginTop: '4px' }, text: a.lastError }) : null),
          tools ? h('div', { class: 'more', style: { display: 'flex', gap: '8px' } }, tools) : null);
        var body;
        if (!a.otdels || !a.otdels.length) body = h('div', { style: { padding: '0 20px 16px', color: 'var(--text-2)' }, text: 'Agent hali ma’lumot yubormadi. Dorixona kompyuterida: python fom_agent.py --once' });
        else body = U.table([
          { t: 'FOM filiali (OTDEL)', render: function (o) { return h('div', null, h('div', { style: { fontWeight: '600' }, text: o.name }), h('div', { class: 'mono', style: { color: 'var(--text-3)' }, text: o.otdel ? 'OTDEL ' + o.otdel : 'Butun baza' })); } },
          { t: 'Bugun', r: true, w: '170px', render: function (o) { return h('div', null, h('div', { style: { fontWeight: '600' }, text: A.money(o.revenueToday) }), h('div', { style: { fontSize: '11px', color: 'var(--text-3)' }, text: o.checksToday + ' chek' })); } },
          { t: 'Apteka 360 filiali', w: '260px', render: function (o) {
            var s = selectEl([['', '— bog‘lanmagan —']].concat(br.map(function (b) { return [b.id, b.name]; })), o.branchId || '');
            s.disabled = !admin;
            s.onchange = function () {
              s.disabled = true;
              A.api('PUT', '/v1/fom/agents/' + encodeURIComponent(a.id) + '/map', { otdel: o.otdel, branchId: s.value || null })
                .then(function () { A.toast('ok', 'Filial bog‘landi'); A.state.branches = null; o.branchId = s.value || null; s.disabled = false; })
                .catch(function (e) { fail(e); s.value = o.branchId || ''; s.disabled = false; });
            };
            return s;
          } }], a.otdels, { bare: true });
        var c = h('div', { class: 'card', style: { marginBottom: '12px' } }, hd, body);
        return c;
      }
    });
  };

  // ═════════════ Tizim holati ═════════════
  A.screens.health = function (page, params, ctx) {
    var role = A.role(), fomOk = ['OWNER', 'SUPER_ADMIN', 'FINANCE', 'AUDITOR'].indexOf(role) >= 0;
    var t0 = Date.now();
    return Promise.all([
      A.get('/v1/branches'),
      A.get('/v1/edges').catch(function (e) { return { __err: e }; }),
      fomOk ? A.get('/v1/fom/agents').catch(function (e) { return { __err: e }; }) : Promise.resolve(null)
    ]).then(function (r) {
      guard(ctx);
      var br = r[0] || [], edges = r[1], agents = r[2], ms = Date.now() - t0;
      A.state.branches = br;
      var edgeList = Array.isArray(edges) ? edges : [], edgeBy = {};
      edgeList.forEach(function (e) { edgeBy[e.branchId] = e; });
      page.appendChild(head('Tizim holati', 'Server, FOM sinxronlash, Edge serverlar va kameralar', [U.refreshBtn()]));

      var camsOn = 0, cams = 0, fomOkN = 0, edgeOn = 0;
      br.forEach(function (b) {
        cams += b.cameras || 0; camsOn += b.camerasOnline || 0;
        if (b.fom && b.fom.status === 'ok') fomOkN++;
        var e = edgeBy[b.id]; if (e ? e.online : b.edge === 'online') edgeOn++;
      });
      function svc(name, meta, kind, word) {
        return h('div', { class: 'card pad', style: { display: 'flex', gap: '12px', alignItems: 'flex-start', justifyContent: 'space-between' } },
          h('div', { style: { minWidth: '0' } }, h('div', { style: { fontWeight: '600' }, text: name }), h('div', { style: { fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }, text: meta })),
          pill(kind, word));
      }
      var W = { ok: 'Sog‘lom', warn: 'Ogohlantirish', crit: 'Kritik', mute: 'Offline' };
      function lvl(ok, total) { return !total ? 'mute' : ok === total ? 'ok' : ok === 0 ? 'crit' : 'warn'; }
      var tiles = [svc('API server', 'Javob: ' + ms + ' ms', ms < 1500 ? 'ok' : 'warn', ms < 1500 ? W.ok : W.warn)];
      var kF = lvl(fomOkN, br.length); tiles.push(svc('FOM sinxronlash', fomOkN + ' / ' + br.length + ' filial sinxron', kF, W[kF]));
      if (agents && Array.isArray(agents)) {
        var aOn = agents.filter(function (a) { return a.status === 'ok'; }).length, kA = lvl(aOn, agents.length);
        tiles.push(svc('FOM agentlar', agents.length ? aOn + ' / ' + agents.length + ' onlayn' : 'Agent qo‘shilmagan', kA, W[kA]));
      }
      var kE = lvl(edgeOn, br.length); tiles.push(svc('Edge serverlar', edgeOn + ' / ' + br.length + ' onlayn', kE, W[kE]));
      var kC = lvl(camsOn, cams); tiles.push(svc('Kameralar', camsOn + ' / ' + cams + ' onlayn', kC, W[kC]));
      page.appendChild(h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', marginBottom: '16px' } }, tiles));
      if (edges && edges.__err && edges.__err.status !== 403) page.appendChild(A.infobar('warn', 'Edge holatini olib bo‘lmadi.', edges.__err.error));

      page.appendChild(U.table([
        { t: 'Filial', render: function (b) { return h('div', { class: 'who' }, h('span', { class: 'dot ' + (b.health >= 80 ? 'ok' : b.health >= 60 ? 'warn' : 'crit') }), h('span', { text: b.short || b.name })); } },
        { t: 'Health', r: true, w: '80px', render: function (b) { return b.health + '%'; } },
        { t: 'FOM', render: function (b) { var f = b.fom || {}; return h('div', null, pill(f.status === 'ok' ? 'ok' : f.status === 'down' ? 'crit' : 'warn', f.status === 'ok' ? 'sinxron' : f.status === 'down' ? 'uzilgan' : (f.status || '—')), h('span', { class: 'muted', style: { marginLeft: '8px', color: 'var(--text-2)' }, text: f.lag || f.last || '' })); } },
        { t: 'Edge', render: function (b) {
          var e = edgeBy[b.id], on = e ? e.online : b.edge === 'online';
          var extra = e ? ['v' + e.version, 'oxirgi: ' + U.fmtDateTime(e.lastSeen), e.gpu && e.gpu.model ? e.gpu.model + (e.gpu.loadPct != null ? ' ' + e.gpu.loadPct + '%' : '') : null, e.tempC != null ? e.tempC + '°C' : null, e.disk ? 'disk ' + e.disk.usedGb + '/' + e.disk.totalGb + ' GB' : null].filter(Boolean).join(' · ') : '';
          return h('div', null, pill(on ? 'ok' : 'crit', on ? 'onlayn' : 'oflayn'), extra ? h('div', { style: { fontSize: '12px', color: 'var(--text-2)', marginTop: '4px' }, text: extra }) : null);
        } },
        { t: 'Kameralar', r: true, w: '120px', render: function (b) { return h('span', { style: { color: b.camerasOnline < b.cameras ? 'var(--crit)' : '' }, text: b.camerasOnline + ' / ' + b.cameras }); } },
        { t: 'NVR', w: '150px', render: function (b) { var e = edgeBy[b.id]; return e && e.nvr ? (e.nvr.retentionDays != null ? e.nvr.retentionDays + ' kun · ' : '') + (e.nvr.usedGb != null ? e.nvr.usedGb + '/' + e.nvr.totalGb + ' GB' : '') : '—'; } }
      ], br, { title: 'Filiallar bo‘yicha', onRow: A.can('branches') ? function (b) { A.go('branches', { id: b.id }); } : null }));
    });
  };

  // ═════════════ Telegram'ga ulash (profil va foydalanuvchilar) ═════════════
  function tgCard(opts) {
    opts = opts || {};
    var me = A.state.me || {}, role = A.role(), ro = A.readOnly();
    var admin = !ro && (role === 'OWNER' || role === 'SUPER_ADMIN');
    var body = h('div', { style: { padding: '0 20px 16px' } }, h('div', { class: 'muted', style: { color: 'var(--text-2)' }, text: 'Yuklanmoqda…' }));
    var c = sectionCard('Telegram’ga ulash', 'Bot orqali so‘rovlarni tasdiqlash va bildirishlarni olish.', body);
    var users = opts.users || null, issued = null, target = '__self__';
    function load() {
      return Promise.all([A.get('/v1/telegram').catch(function (e) { return { __err: e }; }), admin && !users ? A.get('/v1/admin/users').catch(function () { return []; }) : Promise.resolve(users)]).then(function (r) {
        users = r[1] || []; paint(r[0]);
      });
    }
    function nameOf(id) { var u = (users || []).find(function (x) { return x.id === id; }); return u && u.name; }
    function paint(tg) {
      clear(body);
      if (tg && tg.__err) { body.appendChild(A.infobar(tg.__err.status === 403 ? 'warn' : 'crit', 'Telegram holatini olib bo‘lmadi.', tg.__err.error)); return; }
      var links = (tg && tg.links) || [], pending = (tg && tg.pending) || [];
      body.appendChild(h('div', { class: 'section-title', style: { margin: '0 0 4px', fontSize: '12px', color: 'var(--text-2)' }, text: 'Ulangan chatlar' }));
      if (!links.length) body.appendChild(h('div', { style: { color: 'var(--text-2)', padding: '4px 0 8px' }, text: 'Hali ulangan Telegram chat yo‘q.' }));
      links.forEach(function (l) {
        var un = !ro ? h('button', { class: 'btn subtle', onclick: function () {
          un.disabled = true;
          A.cmd('tg.unlink', { chatId: l.chatId }).then(function () { A.toast('ok', 'Telegram ulanishi uzildi'); load(); }).catch(function (e) { un.disabled = false; fail(e); });
        } }, 'Uzish') : null;
        body.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderTop: '1px solid var(--stroke)' } },
          h('span', { style: { flex: '1' } }, l.name, h('span', { style: { color: 'var(--text-3)' }, text: ' · chat ' + l.chatId })), pill('ok', ROLE[l.role] || l.role), un));
      });
      if (pending.length) {
        body.appendChild(h('div', { class: 'section-title', style: { margin: '12px 0 4px', fontSize: '12px', color: 'var(--text-2)' }, text: 'Ishlatilmagan havolalar' }));
        pending.forEach(function (p) {
          var rv = h('button', { class: 'btn subtle', onclick: function () {
            rv.disabled = true;
            A.cmd('tg.revokeToken', { id: p.id }).then(function () { A.toast('ok', 'Havola bekor qilindi'); load(); }).catch(function (e) { rv.disabled = false; fail(e); });
          } }, 'Bekor qilish');
          body.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderTop: '1px solid var(--stroke)' } },
            h('span', { style: { flex: '1' } }, nameOf(p.accountId) || ROLE[p.role] || p.role, h('span', { style: { color: 'var(--text-3)' }, text: ' · ' + (p.createdByName || '—') + ' yaratgan · ' + U.fmtDateTime(p.expiresAt) + ' gacha' })), rv));
        });
      }
      if (ro) { body.appendChild(h('div', { class: 'small', text: 'Auditor rejimida Telegram ulash mavjud emas.' })); return; }
      var targets = admin ? (users || []).filter(function (u) { return u.status === 'active' && u.role !== 'AUDITOR' && (role === 'OWNER' || u.role !== 'OWNER') && u.id !== me.id; }) : [];
      var row = h('div', { style: { display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: '12px' } });
      var sel = null;
      if (targets.length) {
        sel = selectEl([['__self__', tf('O‘zim · {role}', { role: ROLE[role] })]].concat(targets.map(function (u) { return [u.id, u.name + ' · ' + (ROLE[u.role] || u.role)]; })), target, '300px');
        sel.onchange = function () { target = sel.value; issued = null; paintIssued(); };
        row.appendChild(h('div', null, h('div', { style: { fontSize: '12px', color: 'var(--text-2)', marginBottom: '4px' }, text: 'Kim uchun havola' }), sel));
      }
      var mk = h('button', { class: 'btn accent', onclick: function () {
        mk.disabled = true;
        A.cmd('tg.createLinkToken', target === '__self__' ? {} : { userId: target }).then(function (out) {
          var u = targets.find(function (x) { return x.id === target; });
          issued = { token: out.token, name: u ? u.name : me.name, self: !u }; mk.disabled = false; mk.textContent = 'Yangi havola'; paintIssued(); load();
        }).catch(function (e) { mk.disabled = false; fail(e); });
      } }, issued ? 'Yangi havola' : 'Havola yaratish');
      row.appendChild(mk); body.appendChild(row);
      var issuedBox = h('div'); body.appendChild(issuedBox);
      function paintIssued() {
        clear(issuedBox); if (!issued) return;
        var D = window.__APTEKA_DESKTOP__ || {}, bot = String(D.tg_bot || D.tgBot || '').replace(/^@/, '');
        var url = bot ? 'https://t.me/' + bot + '?start=' + issued.token : null;
        issuedBox.appendChild(h('div', { style: { marginTop: '12px', padding: '12px', border: '1px solid var(--stroke)', borderRadius: 'var(--r)' } },
          url ? h('div', { class: 'secret mono', text: url }) : h('div', null, 'Bot nomi sozlanmagan. Botga quyidagini yuboring: ', h('span', { class: 'secret mono', style: { display: 'inline-block', padding: '2px 8px' }, text: '/start ' + issued.token })),
          h('div', { style: { display: 'flex', gap: '8px', marginTop: '8px' } },
            url ? h('button', { class: 'btn accent', onclick: function () { A.openExternal(url); } }, icon('ext'), 'Telegram’da ochish') : null,
            h('button', { class: 'btn', onclick: function () { copy(url || '/start ' + issued.token, 'Havola nusxalandi'); } }, 'Nusxa olish')),
          h('div', { class: 'small', text: 'Havola bir marta ishlaydi va 24 soat amal qiladi. Telefonda oching, so‘ng Start bosing.' }),
          !issued.self ? h('div', { style: { fontSize: '12px', color: 'var(--warn)', marginTop: '6px' }, text: tf('Bu havola «{role}» uchun. Faqat shu xodimga yuboring: havola orqali ulangan chat uning huquqlarini oladi.', { role: issued.name }) }) : null));
      }
      paintIssued();
    }
    load().catch(function (e) { clear(body); body.appendChild(A.infobar('crit', 'Xato', errText(e))); });
    return c;
  }

  // ═════════════ Foydalanuvchilar ═════════════
  function needsBranch(r) { return r === 'MANAGER' || r === 'EMPLOYEE'; }
  function userForm(acc, onDone) {
    var me = A.role(), br = A.state.branches || [];
    var roles = ROLE_CODES.filter(function (r) { return me === 'OWNER' || r !== 'OWNER'; });
    var name = input({ value: acc ? acc.name : '' }), roleS = selectEl(roles.map(function (r) { return [r, ROLE[r]]; }), acc ? acc.role : 'MANAGER');
    var branchS = selectEl(br.map(function (b) { return [b.id, b.name]; }), acc && acc.branchId ? acc.branchId : (br[0] && br[0].id));
    var title = input({ value: acc && acc.title ? acc.title : '' });
    var phone = input({ value: acc ? acc.phone || '' : '', placeholder: '+998 90 123 45 67' }), email = input({ value: acc ? acc.email || '' : '', type: 'email' });
    var pw = input({ type: 'password', attrs: { autocomplete: 'new-password' } }), er = errBox();
    var slot = h('div');
    function swap() { clear(slot); slot.appendChild(needsBranch(roleS.value) ? field('Filial', branchS) : field('Lavozim (ixtiyoriy)', title)); }
    roleS.onchange = swap; swap();
    var body = h('div', null, acc ? h('p', { class: 'note', text: 'Rol yoki filial o‘zgarsa, foydalanuvchi qaytadan kiradi.' }) : null,
      field('F.I.Sh.', name), h('div', { class: 'form-grid' }, field('Rol', roleS), slot, field('Telefon', phone), field('E-pochta', email)),
      acc ? null : field('Boshlang‘ich parol', pw, 'Kamida 8 ta belgi. Foydalanuvchiga xavfsiz yo‘l bilan yetkazing — kirgach, o‘zi almashtirishi mumkin.'), er);
    return wideDialog({ title: acc ? 'Foydalanuvchini tahrirlash' : 'Foydalanuvchi qo‘shish', primary: 'Saqlash', body: body, onPrimary: function () {
      var v = { name: name.value.trim(), role: roleS.value, phone: phone.value.trim(), email: email.value.trim() };
      if (!v.name || !v.phone || !v.email) { er.textContent = 'F.I.Sh., telefon va e-pochta majburiy.'; return false; }
      if (needsBranch(v.role)) v.branchId = branchS.value || null; else { v.branchId = null; if (title.value.trim()) v.title = title.value.trim(); }
      if (acc) v.id = acc.id; else { if (pw.value.length < 8) { er.textContent = 'Parol kamida 8 ta belgi bo‘lsin.'; return false; } v.password = pw.value; }
      return A.cmd(acc ? 'users.update' : 'users.create', v).then(function (a) {
        A.toast('ok', acc ? tf('«{name}» saqlandi', { name: a.name }) : tf('«{name}» qo‘shildi. Endi u telefon yoki e-pochta va parol bilan kira oladi.', { name: a.name }));
        return a;
      }).catch(function (e) { er.textContent = errText(e); return false; });
    } }, '600px').then(function (r) { if (r && onDone) onDone(r); });
  }
  A.screens.users = function (page, params, ctx) {
    var role = A.role(), manage = (role === 'OWNER' || role === 'SUPER_ADMIN') && !A.readOnly();
    return Promise.all([A.get('/v1/admin/users'), A.branchesCached()]).then(function (r) {
      guard(ctx);
      var list = r[0] || [], q = '', rf = '', box = h('div');
      page.classList.add('wide');
      var add = manage ? h('button', { class: 'btn accent', onclick: function () { userForm(null, A.render); } }, icon('plus'), 'Foydalanuvchi qo‘shish') : null;
      page.appendChild(head('Foydalanuvchilar', list.length + ' ta foydalanuvchi', [U.search('Ism, telefon yoki e-pochta', function (v) { q = v; paint(); }),
        U.select([['', 'Barcha rollar']].concat(ROLE_CODES.map(function (c) { return [c, ROLE[c]]; })), '', function (v) { rf = v; paint(); }, '170px'), add, U.refreshBtn()]));
      if (role === 'AUDITOR') page.appendChild(A.infobar('info', 'Ko‘rish rejimi.', 'Foydalanuvchilarni faqat Egasi va Super admin boshqaradi.'));
      page.appendChild(box);
      function canTouch(a) { return manage && (role === 'OWNER' || a.role !== 'OWNER'); }
      function paint() {
        clear(box);
        var rows = list.filter(function (a) { return (!rf || a.role === rf) && (!q || [a.name, a.phone, a.email, a.title].join(' ').toLowerCase().indexOf(q) >= 0); });
        box.appendChild(U.table([
          { t: 'Foydalanuvchi', render: function (a) { return h('div', { class: 'who', style: { opacity: a.status === 'blocked' ? '.6' : '1' } }, h('span', { class: 'avatar sm', text: A.initials(a.name) }), h('div', null, h('div', { style: { fontWeight: '600' }, text: a.name }), h('div', { style: { fontSize: '12px', color: 'var(--text-3)' }, text: [a.title, a.demo ? 'demo' : null, a.telegram ? 'Telegram' : null].filter(Boolean).join(' · ') }))); } },
          { t: 'Rol', w: '130px', render: function (a) { return ROLE[a.role] || a.role; } },
          { t: 'Filial', w: '130px', muted: true, render: function (a) { return a.branchId ? A.branchName(a.branchId) : '—'; } },
          { t: 'Telefon / e-pochta', render: function (a) { return h('div', { style: { fontSize: '12px' } }, h('div', { text: a.phone || '—' }), h('div', { style: { color: 'var(--text-3)' }, text: a.email || '' })); } },
          { t: 'Oxirgi kirish', w: '130px', muted: true, render: function (a) { return a.lastLoginAt ? U.fmtDateTime(a.lastLoginAt) : 'Kirmagan'; } },
          { t: 'Holat', w: '110px', render: function (a) { return pill(a.status === 'active' ? 'ok' : 'crit', a.status === 'active' ? 'Faol' : 'Bloklangan'); } },
          { t: '', w: '300px', r: true, render: function (a) {
            if (!canTouch(a)) return '';
            return h('div', { style: { display: 'flex', gap: '4px', justifyContent: 'flex-end', flexWrap: 'wrap' } },
              h('button', { class: 'btn subtle', onclick: function () { userForm(a, A.render); } }, 'Tahrirlash'),
              h('button', { class: 'btn subtle', onclick: function () { resetPw(a); } }, 'Parolni almashtirish'),
              a.status === 'active' ? h('button', { class: 'btn subtle danger', onclick: function () { block(a); } }, 'Bloklash')
                : h('button', { class: 'btn subtle', onclick: function () { U.run('users.setStatus', { id: a.id, status: 'active' }, tf('«{name}» faollashtirildi', { name: a.name })).then(A.render, function () {}); } }, 'Faollashtirish'));
          } }
        ], rows, { empty: 'Foydalanuvchi topilmadi', emptyIcon: 'people' }));
      }
      function resetPw(a) {
        var pw = input({ type: 'password', attrs: { autocomplete: 'new-password' } }), er = errBox();
        A.dialog({ title: 'Parolni almashtirish', primary: 'Saqlash', body: h('div', null, h('p', { class: 'note', text: a.name }), field('Yangi parol', pw, 'Kamida 8 ta belgi. Foydalanuvchiga xavfsiz yo‘l bilan yetkazing — kirgach, o‘zi almashtirishi mumkin.'), er), onPrimary: function () {
          if (pw.value.length < 8) { er.textContent = 'Kamida 8 ta belgi.'; return false; }
          return A.cmd('users.resetPassword', { id: a.id, password: pw.value }).then(function (x) { A.toast('ok', tf('«{name}» paroli almashtirildi, sessiyalari yopildi', { name: x.name })); }).catch(function (e) { er.textContent = errText(e); return false; });
        } });
      }
      function block(a) {
        var rs = input(), er = errBox();
        A.dialog({ title: 'Bloklash', primary: 'Bloklash', body: h('div', null, h('p', { class: 'note', text: a.name }), field('Bloklash sababi', rs), er), onPrimary: function () {
          var v = { id: a.id, status: 'blocked' }; if (rs.value.trim()) v.reason = rs.value.trim();
          return A.cmd('users.setStatus', v).then(function (x) { A.toast('ok', tf('«{name}» bloklandi — barcha sessiyalari yopildi', { name: x.name })); }).catch(function (e) { er.textContent = errText(e); return false; });
        } }).then(function (ok) { if (ok) A.render(); });
      }
      paint();
      if (manage) { var t = tgCard({ users: list }); t.style.marginTop = '16px'; page.appendChild(t); }
    });
  };

  // ═════════════ Rollar va ruxsatlar ═════════════
  A.screens.roles = function (page, params, ctx) {
    return A.get('/v1/roles').then(function (doc) {
      guard(ctx);
      var me = A.role(), sel = params.role || 'MANAGER', draft = { actions: {}, sensitive: {} };
      var reason = input({ placeholder: 'Kamida 3 belgi — audit jurnaliga yoziladi' }); reason.style.width = '280px';
      var saveBtn = h('button', { class: 'btn accent', onclick: save }, 'O‘zgarishlarni saqlash');
      var tools = me === 'OWNER' && !A.readOnly() ? [reason, saveBtn] : [U.refreshBtn()];
      page.appendChild(head('Rollar va ruxsatlar', 'Jadval faqat cheklay oladi: rolning asosiy huquqidan tashqari ruxsat qo‘shib bo‘lmaydi.', tools));
      page.appendChild(U.tabs(ROLE_CODES.map(function (c) { return [c, ROLE[c]]; }), sel, function (v) { sel = v; draft = { actions: {}, sensitive: {} }; paint(); }));
      var box = h('div'); page.appendChild(box);
      reason.oninput = state;
      function cur() { return doc.roles.find(function (x) { return x.code === sel; }) || { actions: {}, sensitive: {}, locked: true }; }
      function canEdit() { return !A.readOnly() && me === 'OWNER' && !cur().locked; }
      function changed() { return Object.keys(draft.actions).length + Object.keys(draft.sensitive).length > 0; }
      function state() { saveBtn.disabled = !canEdit() || !changed() || reason.value.trim().length < 3; reason.disabled = !canEdit(); }
      function toggle(kind, key, base) {
        return function (v) { if (v === !!base) delete draft[kind][key]; else draft[kind][key] = v; state(); };
      }
      function paint() {
        clear(box); var r = cur(), ed = canEdit();
        if (r.locked) box.appendChild(A.infobar('info', 'Egasi roli o‘zgartirilmaydi.', 'Egasi barcha ruxsatlarga ega. Ruxsatlarni cheklash uchun alohida rol yarating.'));
        else if (me !== 'OWNER') box.appendChild(A.infobar('info', 'Faqat ko‘rish.', 'Ruxsatlarni faqat Egasi o‘zgartiradi.'));
        var groups = [];
        doc.actions.forEach(function (a) { if (groups.indexOf(a.group) < 0) groups.push(a.group); });
        var left = h('div');
        groups.forEach(function (g) {
          var list = h('div');
          doc.actions.filter(function (a) { return a.group === g; }).forEach(function (a) {
            var on = a.key in draft.actions ? draft.actions[a.key] : !!r.actions[a.key];
            list.appendChild(srow(a.label, a.key, sw(on, toggle('actions', a.key, r.actions[a.key]), !ed)));
          });
          left.appendChild(sectionCard(g, null, list));
        });
        var sens = h('div');
        doc.sensitive.forEach(function (s) {
          var on = s.key in draft.sensitive ? draft.sensitive[s.key] : !!r.sensitive[s.key];
          sens.appendChild(srow(s.label, null, sw(on, toggle('sensitive', s.key, r.sensitive[s.key]), !ed)));
        });
        var right = h('div', null,
          h('div', { class: 'card pad', style: { marginBottom: '12px' } }, h('div', { style: { fontSize: '12px', color: 'var(--text-2)' }, text: 'Filial doirasi' }), h('div', { style: { fontWeight: '600', margin: '4px 0' }, text: SCOPES[sel] }), h('div', { style: { fontSize: '12px', color: 'var(--text-3)' }, text: 'Bitta / bir nechta / barcha filiallar — foydalanuvchi profilida belgilanadi.' })),
          sectionCard('Maxfiy ruxsatlar', 'Maxfiy ma’lumotni har bir ko‘rish audit jurnaliga yoziladi.', sens, pill('warn', 'AUDIT')),
          r.updatedAt ? h('div', { class: 'small', text: tf('Oxirgi o‘zgarish: {by} · {at}', { by: r.updatedBy || '—', at: U.fmtDateTime(r.updatedAt) }) }) : null);
        box.appendChild(h('div', { class: 'grid g21', style: { alignItems: 'start' } }, left, right));
        state();
      }
      function save() {
        saveBtn.disabled = true;
        A.cmd('roles.update', { code: sel, actions: draft.actions, sensitive: draft.sensitive, reason: reason.value.trim() }).then(function (rp) {
          A.toast('ok', 'Ruxsatlar saqlandi.', 'Foydalanuvchilar keyingi so‘rovda yangi ruxsat bilan ishlaydi.');
          var i = doc.roles.findIndex(function (x) { return x.code === sel; }); if (i >= 0 && rp && rp.code) doc.roles[i] = rp;
          draft = { actions: {}, sensitive: {} }; reason.value = ''; paint();
        }).catch(function (e) { fail(e); state(); });
      }
      paint();
    });
  };

  // ═════════════ Modullar ═════════════
  var MODULES = ['ops', 'expiry', 'hr', 'suppliers', 'doctors', 'vision', 'analytics', 'tax', 'admin', 'cameras', 'aiVerify'];
  var OFF_BY_DEFAULT = ['cameras', 'aiVerify'];
  var MOD_NAME = { dashboard: 'Dashboard', system: 'Tizim', ops: 'Operatsiyalar', hr: 'HR', suppliers: 'Firmalar', doctors: 'Vrachlar', vision: 'AI nazorat', analytics: 'Analitika', expiry: 'Sroklar', tax: 'Soliq', admin: 'Boshqaruv', cameras: 'Kameralar (ulash va jonli video)', aiVerify: 'AI tekshiruv' };
  var MOD_DESC = {
    dashboard: 'Bosh sahifa, KPI va grafiklar', system: 'Foydalanuvchilar, rollar, sozlamalar, modullar',
    ops: 'Filiallar, kassa yopilishi, harajatlar, pul oqimi', hr: 'Xodimlar, grafik, davomat, jonli filial, oylik', suppliers: 'Firmalar, qarzlar va to‘lovlar',
    doctors: 'Vrachlar bilan kelishuvlar va ROI (maxfiy)', vision: 'Kamera va Edge-AI hodisalari, video devor', analytics: 'P&L, analitika, prognoz, hisobotlar', expiry: 'Srogi o‘tgan/yaqin dorilar, zarar va filiallar orasida ko‘chirish', tax: 'my.soliq.uz: kassa savdosi, e-faktura, soliq qarzi va xavflar',
    admin: 'Tasdiqlar, bildirishlar, audit jurnali',
    cameras: 'Kamera qo‘shish, ulanishni tekshirish, tarmoqdan qidirish va jonli video (desktop/mobil). Filialda Edge server va media shlyuz kerak.',
    aiVerify: 'Edge-AI hodisalarini video kadrlar bo‘yicha vision model bilan tekshirish (AI sozlamalaridagi vision modeli). Maxfiy kameralar yuborilmaydi.'
  };
  var MOD_ICON = { dashboard: 'home', system: 'gear', ops: 'branch', hr: 'people', suppliers: 'truck', doctors: 'doctor', vision: 'ai', analytics: 'pl', tax: 'tax', expiry: 'expire', admin: 'check', cameras: 'cam', aiVerify: 'ai' };
  var MOD_SCREENS = { ops: 'Filiallar, Kassa, Harajatlar, Pul oqimi', hr: 'Xodimlar, Ish grafigi, Davomat, Jonli filial, Oylik, Oylik qoidalari', suppliers: 'Firmalar, To‘lov kalendari', doctors: 'Vrachlar', vision: 'AI hodisalar, Video devor, Kameralar', analytics: 'P&L, Analitika, Prognoz, Hisobotlar', tax: 'Soliq', expiry: 'Sroklar', admin: 'Tasdiqlar, Bildirishlar, Audit jurnali' };
  var THEME_KEYS = ['accent', 'info', 'success', 'warning', 'danger', 'sidebar', 'chartPanel', 'page'];
  var THEME_LABEL = { accent: 'Asosiy rang (tugmalar, grafiklar)', info: 'Ma’lumot', success: 'Muvaffaqiyat', warning: 'Ogohlantirish', danger: 'Xavf', sidebar: 'Menyu foni', chartPanel: 'Grafik paneli foni', page: 'Sahifa foni' };
  var THEME_DEF = { accent: '#1b8a55', info: '#2a5bc4', success: '#167346', warning: '#8a5a00', danger: '#c42f37', sidebar: '#0b0c0c', chartPanel: '#0b0c0c', page: '#f3f4f1' };
  function modOn(ws, m) { return OFF_BY_DEFAULT.indexOf(m) >= 0 ? ws.modules[m] === true : ws.modules[m] !== false; }
  A.screens.modules = function (page, params, ctx) {
    return A.get('/v1/workspace').then(function (ws) {
      guard(ctx);
      var canEdit = isAdmin();
      page.appendChild(head('Modullar', 'Har bir funksional bo‘lim — alohida modul. Keraksizini o‘chirsangiz, u menyudan, dashboarddan va qidiruvdan yo‘qoladi. Ma’lumotlar o‘chmaydi — modulni qayta yoqsangiz, hammasi joyida.', [U.refreshBtn()]));
      if (!canEdit) page.appendChild(A.infobar('info', 'Faqat ko‘rish.', 'Modullarni faqat egasi yoki super-admin yoqib-o‘chira oladi.'));
      var list = h('div');
      function row(id, core) {
        var on = core || modOn(ws, id);
        var ctl = core ? pill('mute', 'Asosiy modul — o‘chirilmaydi') : sw(on, function (v) {
          return A.api('POST', '/v1/workspace/apply', { actions: [{ type: 'setModule', module: id, enabled: v }] }).then(function (nws) {
            ws = nws || ws; A.toast(v ? 'ok' : 'info', tf(v ? '«{m}» moduli yoqildi' : '«{m}» moduli o‘chirildi', { m: MOD_NAME[id] }));
          }).catch(function (e) { fail(e); throw e; });
        }, !canEdit);
        list.appendChild(srow(h('b', { text: MOD_NAME[id] }), MOD_DESC[id], ctl, MOD_ICON[id], !core && MOD_SCREENS[id] ? h('div', { style: { fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }, text: 'Ekranlar: ' + MOD_SCREENS[id] }) : null));
      }
      row('dashboard', true); MODULES.forEach(function (m) { row(m, false); }); row('system', true);
      page.appendChild(h('div', { class: 'card', style: { marginBottom: '8px' } }, list));
      page.appendChild(h('div', { class: 'small', style: { marginBottom: '16px' }, text: 'Modul o‘chirilishi faqat web-paneldagi ko‘rinishga ta’sir qiladi. Telegram bot, mobil ilovalar va backend ishlashda davom etadi.' }));

      // Ranglar
      var draft = Object.assign({}, ws.theme || {}), grid = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', padding: '0 20px 16px' } });
      var saveB = h('button', { class: 'btn accent', onclick: function () { saveTheme(draft); } }, 'Saqlash');
      var resetB = h('button', { class: 'btn', onclick: function () { saveTheme({}); } }, 'Standart ranglar');
      function dirty() { return JSON.stringify(draft) !== JSON.stringify(ws.theme || {}); }
      function paintTheme() {
        clear(grid);
        THEME_KEYS.forEach(function (k) {
          var ci = h('input', { type: 'color', style: { width: '40px', height: '32px', padding: '0', border: '1px solid var(--stroke)', borderRadius: 'var(--r)', background: 'none' } });
          ci.value = draft[k] || THEME_DEF[k]; ci.disabled = !canEdit;
          var lbl = h('span', { class: 'mono', style: { color: 'var(--text-2)' }, text: draft[k] || 'standart · ' + THEME_DEF[k] });
          ci.oninput = function () { draft[k] = ci.value; lbl.textContent = ci.value; saveB.disabled = !dirty(); };
          var def = canEdit && draft[k] ? h('button', { class: 'btn subtle', onclick: function () { delete draft[k]; paintTheme(); } }, 'standart') : null;
          grid.appendChild(h('div', null, h('div', { style: { fontSize: '13px', marginBottom: '6px' }, text: THEME_LABEL[k] }), h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, ci, lbl, def)));
        });
        saveB.disabled = !dirty(); resetB.disabled = !Object.keys(ws.theme || {}).length;
      }
      function saveTheme(theme) {
        saveB.disabled = resetB.disabled = true;
        A.api('PUT', '/v1/workspace', { version: ws.version, widgets: ws.widgets, theme: theme, modules: ws.modules }).then(function (nws) {
          ws = nws; draft = Object.assign({}, ws.theme || {}); A.toast('ok', 'Ranglar saqlandi', 'Web panelda qo‘llanadi.'); paintTheme();
        }).catch(function (e) { fail(e); paintTheme(); });
      }
      paintTheme();
      page.appendChild(sectionCard('Ranglar', 'Platforma ranglarini o‘zgartiring. Matn o‘qilishi uchun cheklovlar bor: sahifa foni och, menyu foni to‘q bo‘lishi kerak.',
        h('div', null, grid, canEdit ? h('div', { style: { display: 'flex', gap: '8px', padding: '0 20px 16px' } }, saveB, resetB) : null)));
    });
  };

  // ═════════════ AI sozlamalari ═════════════
  A.screens.aiSettings = function (page, params, ctx) {
    return Promise.all([A.get('/v1/ai/settings'), A.get('/v1/ai/models').catch(function () { return { local: [] }; })]).then(function (r) {
      guard(ctx);
      var s = r[0], found = (r[1] && r[1].local) || [], canEdit = isAdmin();
      var mode = s.mode, hasOa = !!s.openai;
      page.appendChild(head('AI sozlamalari', 'AI-yordamchining «miyasi». Lokal LLM (Ollama, LM Studio) ma’lumotni kompyuteringizdan chiqarmaydi; u bo‘lmasa OpenRouter orqali bulutdagi modellar ishlatiladi.', [U.refreshBtn()]));
      if (!canEdit) page.appendChild(A.infobar('info', 'Faqat ko‘rish.', 'AI sozlamalarini faqat egasi yoki super-admin o‘zgartira oladi.'));
      function inp(v, ph, type) { var i = input({ value: v || '', placeholder: ph, type: type }); i.disabled = !canEdit; if (type === 'password') i.setAttribute('autocomplete', 'off'); return i; }
      var temp = inp(String(s.temperature), '0.2', 'number'); temp.setAttribute('min', '0'); temp.setAttribute('max', '1.5'); temp.setAttribute('step', '0.1');
      var baseUrl = inp(s.local.baseUrl, 'http://localhost:11434/v1'), localModel = inp(s.local.model, 'qwen2.5:7b');
      var oaModel = hasOa ? inp(s.openai.model || 'gpt-4o-mini', 'gpt-4o-mini') : null, oaKey = hasOa ? inp('', s.openai.hasKey ? '••••••••' : 'sk-proj-…', 'password') : null, visionOa = hasOa ? inp(s.openai.visionModel, 'gpt-4o-mini') : null;
      var orModel = inp(s.openrouter.model, 'openai/gpt-4o-mini'), orKey = inp('', s.openrouter.hasKey ? '••••••••' : 'sk-or-v1-…', 'password');
      var visionLocal = inp(s.visionModel, 'qwen2.5vl:7b'), visionOr = inp(s.openrouter.visionModel, 'openai/gpt-4o-mini');
      var MODES = [['auto', 'Avto — avval lokal, keyin OpenAI, keyin OpenRouter'], ['local', 'Faqat lokal LLM']].concat(hasOa ? [['openai', 'Faqat OpenAI']] : []).concat([['openrouter', 'Faqat OpenRouter']]);
      var modeBox = h('div');
      MODES.forEach(function (m) {
        var rb = h('input', { type: 'radio', name: 'ai-mode', value: m[0] }); rb.checked = m[0] === mode; rb.disabled = !canEdit;
        rb.onchange = function () { mode = m[0]; dim(); };
        modeBox.appendChild(h('label', { class: 'chk', style: { display: 'flex', padding: '6px 0' } }, rb, m[1]));
      });
      function payload(k, ok) {
        var p = { mode: mode, local: { baseUrl: baseUrl.value.trim(), model: localModel.value.trim() },
          openrouter: { model: orModel.value.trim(), visionModel: visionOr.value.trim() || null }, temperature: Number(temp.value) || 0, visionModel: visionLocal.value.trim() || null };
        if (k !== undefined) p.openrouter.key = k;
        if (hasOa) { p.openai = { model: oaModel.value.trim() || 'gpt-4o-mini', visionModel: visionOa.value.trim() || null }; if (ok !== undefined) p.openai.key = ok; }
        return p;
      }
      function keys() { return [orKey.value.trim() || undefined, hasOa ? (oaKey.value.trim() || undefined) : undefined]; }
      function save(p, quiet) {
        return A.api('PUT', '/v1/ai/settings', p).then(function (ns) { if (!quiet) A.toast('ok', 'AI sozlamalari saqlandi'); orKey.value = ''; if (oaKey) oaKey.value = ''; s = ns || s; return ns; })
          .catch(function (e) { fail(e); throw e; });
      }
      function testBtn(target, needKey) {
        var res = h('span', { style: { fontSize: '13px' } });
        var b = h('button', { class: 'btn', onclick: function () {
          if (needKey && !needKey()) { res.textContent = 'Kalit kiritilmagan'; res.style.color = 'var(--crit)'; return; }
          b.disabled = true; res.style.color = 'var(--text-2)'; res.textContent = 'Tekshirilmoqda…';
          var k = keys();
          save(payload(k[0], k[1]), true).then(function () { return A.api('POST', '/v1/ai/test', { target: target }); }).then(function (t) {
            if (t.ok) { res.style.color = 'var(--ok)'; res.textContent = tf('Ishlayapti · {model} · {ms} ms', { model: t.model || '', ms: t.ms }); }
            else { res.style.color = 'var(--crit)'; res.textContent = tf('Xato: {e}', { e: t.error || '' }); }
          }).catch(function (e) { res.style.color = 'var(--crit)'; res.textContent = tf('Xato: {e}', { e: (e && e.error) || String(e) }); }).then(function () { b.disabled = false; });
        } }, 'Tekshirish');
        return canEdit ? h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', marginTop: '14px' } }, b, res) : null;
      }
      function removeKeyBtn(has, which) {
        if (!canEdit || !has) return null;
        return h('button', { class: 'btn danger', onclick: function () { save(which === 'or' ? payload(null) : payload(undefined, null)).then(A.render, function () {}); } }, 'Kalitni o‘chirish');
      }
      function keyHint(x) { return x.hasKey ? tf('Kalit saqlangan: {hint}', { hint: x.keyHint || '' }) : 'Kalit kiritilmagan'; }
      var chips = null;
      if (found.length) {
        chips = h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' } }, found.map(function (m) {
          return h('button', { class: 'pill-btn', disabled: !canEdit, onclick: function () { localModel.value = m; } }, m);
        }));
      }
      var cLocal = sectionCard('Lokal LLM', 'Ollama: http://localhost:11434/v1 · LM Studio: http://localhost:1234/v1', pad(h('div', null,
        field('Server manzili', baseUrl), field('Model', localModel),
        found.length ? h('div', { class: 'field' }, h('div', { style: { fontSize: '12px', color: 'var(--text-2)' }, text: 'Serverda topilgan modellar:' }), chips)
          : h('div', { class: 'small', text: 'Lokal server javob bermadi — Ollama yoki LM Studio ishga tushirilganini tekshiring.' }),
        testBtn('local'))));
      var cOa = hasOa ? sectionCard('OpenAI', 'Masalan: gpt-4o-mini (arzon, rasmli tekshiruv uchun yetarli), gpt-4o, gpt-4.1-mini', pad(h('div', null,
        field('Model', oaModel), field('API kalit', oaKey, keyHint(s.openai)),
        h('div', { class: 'small', text: 'Kalitni platform.openai.com → API keys sahifasidan oling. Serverda shifrlangan holda saqlanadi, qaytarilmaydi. Kadrlar «low» sifatda yuboriladi (hodisaga ≈ 0,1 sent).' }),
        field('OpenAI vision modeli (bo‘sh — yuqoridagi model)', visionOa),
        h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, testBtn('openai', function () { return oaKey.value.trim() || s.openai.hasKey; }), removeKeyBtn(s.openai.hasKey, 'oa'))))) : null;
      var cOr = sectionCard('OpenRouter', 'Masalan: openai/gpt-4o-mini, anthropic/claude-sonnet-4.5, google/gemini-2.5-flash, qwen/qwen-2.5-72b-instruct', pad(h('div', null,
        field('Model', orModel), field('API kalit', orKey, keyHint(s.openrouter)),
        h('div', { class: 'small', text: 'Kalitni openrouter.ai/keys sahifasidan oling. U serverda shifrlangan holda saqlanadi va hech qachon qaytarilmaydi.' }),
        h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, testBtn('openrouter', function () { return orKey.value.trim() || s.openrouter.hasKey; }), removeKeyBtn(s.openrouter.hasKey, 'or')))));
      var cVis = sectionCard('Vision modeli (AI tekshiruv)', 'Edge-AI hodisalarini kamera kadrlari bo‘yicha tekshiradi («AI tekshiruv» moduli). Avto rejimda avval lokal vision modeli, keyin OpenAI, keyin OpenRouter. Lokal model bo‘sh bo‘lsa lokal o‘tkazib yuboriladi.', pad(h('div', null,
        field('Lokal vision modeli', visionLocal), field('OpenRouter vision modeli (bo‘sh — yuqoridagi model)', visionOr), testBtn('vision'))));
      function dim() {
        cLocal.style.opacity = mode === 'openrouter' || mode === 'openai' ? '.6' : '1';
        if (cOa) cOa.style.opacity = mode === 'local' || mode === 'openrouter' ? '.6' : '1';
        cOr.style.opacity = mode === 'local' || mode === 'openai' ? '.6' : '1';
      }
      dim();
      var saveAll = canEdit ? h('button', { class: 'btn accent', onclick: function () { saveAll.disabled = true; var k = keys(); save(payload(k[0], k[1])).then(A.render, function () { saveAll.disabled = false; }); } }, 'Saqlash') : null;
      var left = h('div', null, sectionCard('Ishlash tartibi', null, pad(h('div', null, modeBox, field('Ijodkorlik (temperature)', temp)))), cLocal, cOa, cOr, cVis, saveAll ? h('div', null, saveAll) : null);
      var right = A.infobar('info', 'Xavfsizlik qolipi', h('ul', { style: { margin: '6px 0 0', paddingLeft: '18px' } }, [
        'AI kod, HTML yoki skript yozmaydi — faqat ruxsat etilgan amallarni taklif qiladi (vidjet qo‘shish/olib tashlash, o‘lcham, rang, modul).',
        'Har bir amal serverda tekshiriladi va siz «Qo‘llash» tugmasini bosmaguningizcha bajarilmaydi. Har o‘zgarish audit jurnaliga yoziladi va bekor qilinadi.',
        'AI faqat foydalanuvchining roli ko‘rishi mumkin bo‘lgan ma’lumotlarni oladi. Vrachlar ma’lumoti faqat ruxsati borlarga.',
        'Platformani faqat egasi va super-admin sozlay oladi; boshqa rollar AI’dan faqat ma’lumot so‘raydi.'].map(function (x) { return h('li', { text: x, style: { marginBottom: '4px' } }); })));
      page.appendChild(h('div', { class: 'grid g21', style: { alignItems: 'start' } }, left, h('div', null, right)));
    });
  };

  // ═════════════ Profil kartalari (profil + sozlamalar → xavfsizlik) ═════════════
  function sessionsCard() {
    var body = h('div'), btn = h('button', { class: 'btn danger', onclick: function () {
      btn.disabled = true;
      A.cmd('auth.revokeOthers', {}).then(function (r) { A.toast('ok', tf('{n} ta boshqa sessiya yakunlandi', { n: r && r.ended != null ? r.ended : 0 })); load(); }).catch(function (e) { btn.disabled = false; fail(e); });
    } }, 'Boshqa qurilmalardan chiqish');
    var c = sectionCard('Faol sessiyalar', null, body, btn);
    function load() {
      A.get('/v1/auth/sessions').then(function (list) {
        clear(body); list = list || []; btn.disabled = list.length < 2;
        list.forEach(function (s) {
          var kick = s.current ? pill('ok', 'Shu qurilma') : h('button', { class: 'btn subtle', onclick: function () {
            kick.disabled = true;
            A.cmd('auth.revokeSession', { sid: s.sid }).then(function () { A.toast('ok', 'Sessiya yakunlandi'); load(); }).catch(function (e) { kick.disabled = false; fail(e); });
          } }, 'Chiqarish');
          body.appendChild(srow(s.device, s.ip + ' · kirgan: ' + U.fmtDateTime(s.createdAt) + ' · oxirgi faollik ' + U.fmtDateTime(s.lastSeen), kick, 'key'));
        });
        if (list.length < 2) body.appendChild(h('div', { class: 'list-item', style: { color: 'var(--text-2)', fontSize: '13px' }, text: 'Boshqa faol sessiya yo‘q' }));
      }).catch(function (e) { clear(body); body.appendChild(pad(A.infobar('crit', 'Xato', errText(e)))); });
    }
    load(); return c;
  }
  function loginsCard() {
    var body = h('div'), RES = { ok: ['ok', 'Muvaffaqiyatli'], failed: ['warn', 'Parol noto‘g‘ri'], blocked: ['crit', 'Bloklandi · yangi qurilma'] };
    A.get('/v1/auth/logins').then(function (list) {
      list = list || [];
      if (!list.length) { body.appendChild(h('div', { class: 'list-item', style: { color: 'var(--text-2)' }, text: 'Hali kirishlar yo‘q' })); return; }
      body.appendChild(U.table([
        { t: 'Vaqt', w: '150px', muted: true, render: function (x) { return U.fmtDateTime(x.at); } },
        { t: 'Qurilma', render: function (x) { return x.device + ' · ' + x.ip; } },
        { t: 'Natija', w: '200px', render: function (x) { var k = RES[x.result] || ['info', x.result]; return pill(k[0], k[1]); } }], list, { bare: true }));
    }).catch(function (e) { body.appendChild(pad(A.infobar('crit', 'Xato', errText(e)))); });
    return sectionCard('Kirish tarixi', null, body);
  }
  function profileCards(me) {
    var name = input({ value: me.name || '' }), phone = input({ value: me.phone || '' }), email = input({ value: me.email || '', type: 'email' }), er = errBox();
    var sv = h('button', { class: 'btn accent', onclick: function () {
      var v = { name: name.value.trim(), phone: phone.value.trim(), email: email.value.trim() };
      if (v.name.length < 3) { er.textContent = 'F.I.Sh. kamida 3 belgi.'; return; }
      sv.disabled = true; er.textContent = '';
      A.cmd('profile.update', v).then(function () {
        A.toast('ok', 'Profil saqlandi');
        return A.get('/v1/me').then(function (m) {
          A.state.me = Object.assign(A.state.me || {}, m);
          var n = document.getElementById('acct-name'), av = document.getElementById('acct-av');
          if (n) n.textContent = m.name; if (av) av.textContent = m.ini || A.initials(m.name);
          A.render();
        });
      }).catch(function (e) { er.textContent = errText(e); sv.disabled = false; });
    } }, 'Saqlash');
    var c1 = sectionCard('Shaxsiy ma’lumotlar', null, pad(h('div', null,
      h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center' } }, h('span', { class: 'avatar', style: { width: '56px', height: '56px', fontSize: '18px' }, text: me.ini || A.initials(me.name) }),
        h('div', null, h('div', { style: { font: '600 18px/24px var(--font-display)' }, text: me.name }), h('div', { style: { color: 'var(--text-2)' }, text: [me.title, me.title === ROLE[me.role] ? null : ROLE[me.role], me.branchId ? A.branchName(me.branchId) : null].filter(Boolean).join(' · ') }))),
      h('div', { class: 'form-grid' }, field('F.I.Sh.', name), field('Telefon', phone)), field('E-pochta', email), er, h('div', { style: { marginTop: '8px' } }, sv))));
    var cur = input({ type: 'password', attrs: { autocomplete: 'current-password' } }), nx = input({ type: 'password', attrs: { autocomplete: 'new-password' } }), rp = input({ type: 'password', attrs: { autocomplete: 'new-password' } }), er2 = errBox();
    var pb = h('button', { class: 'btn accent', onclick: function () {
      er2.textContent = '';
      if (!cur.value) { er2.textContent = 'Joriy parolni kiriting.'; return; }
      if (nx.value.length < 8) { er2.textContent = 'Kamida 8 ta belgi.'; return; }
      if (nx.value !== rp.value) { er2.textContent = 'Yangi parollar mos emas'; return; }
      pb.disabled = true;
      A.cmd('profile.changePassword', { current: cur.value, next: nx.value }).then(function () {
        A.toast('ok', 'Parol almashtirildi.', 'Boshqa qurilmalardagi sessiyalar yopildi.'); cur.value = nx.value = rp.value = ''; pb.disabled = false;
      }).catch(function (e) { er2.textContent = errText(e); pb.disabled = false; });
    } }, 'Saqlash');
    var c2 = sectionCard('Parolni almashtirish', null, pad(h('div', null, field('Joriy parol', cur), h('div', { class: 'form-grid' }, field('Yangi parol', nx, 'Kamida 8 ta belgi.'), field('Yangi parolni takrorlang', rp)), er2, h('div', { style: { marginTop: '8px' } }, pb))));
    return [c1, c2];
  }

  // ═════════════ Profil ═════════════
  A.screens.profile = function (page, params, ctx) {
    return A.get('/v1/me').then(function (me) {
      guard(ctx);
      page.appendChild(head('Profil', 'Shaxsiy ma’lumotlar, parol, sessiyalar va Telegram', [U.refreshBtn()]));
      if (me.role === 'EMPLOYEE') page.appendChild(A.infobar('info', 'Asosiy ilova — mobil.', 'Xodimlar uchun ish grafigi, davomat, so‘rovlar va bildirishlar Apteka 360 mobil ilovasida. Desktopda faqat profil sozlamalari mavjud.'));
      profileCards(me).forEach(function (c) { page.appendChild(c); });
      page.appendChild(tgCard());
      page.appendChild(sessionsCard());
      page.appendChild(loginsCard());
    });
  };

  // ═════════════ Ma'lumot importi ═════════════
  var IMPORT_ROLES = { branches: ['OWNER', 'SUPER_ADMIN'], employees: ['OWNER', 'SUPER_ADMIN', 'HR', 'MANAGER'], suppliers: ['OWNER', 'SUPER_ADMIN', 'FINANCE'] };
  var IMPORT_KIND = { branches: 'Filiallar', employees: 'Xodimlar', suppliers: 'Firmalar' };
  var COLUMNS = {
    branches: [['name', 'Filial nomi'], ['short', 'Qisqa nomi'], ['address', 'Manzil'], ['hours', 'Ish vaqti'], ['manager', 'Mudir'], ['expenseLimit', 'Kunlik harajat limiti'], ['desks', 'Kassalar soni']],
    employees: [['name', 'F.I.Sh.'], ['position', 'Lavozim'], ['branch', 'Filial'], ['phone', 'Telefon'], ['oklad', 'Oklad'], ['coef', 'Koeffitsient'], ['schedule', 'Ish grafigi'], ['hired', 'Ishga kirgan'], ['fomLogin', 'FOM login'], ['contract', 'Shartnoma']],
    suppliers: [['name', 'Firma nomi'], ['inn', 'STIR'], ['manager', 'Menejer'], ['phone', 'Telefon'], ['creditLimit', 'Kredit limiti'], ['terms', 'To‘lov sharti'], ['earlyRate', 'Erta to‘lov chegirmasi'], ['earlyBase', 'Erta to‘lov bazasi'], ['volumeRate', 'Hajm bonusi'], ['volumeFrom', 'Hajm bonusi chegarasi'], ['penaltyDaily', 'Kunlik penya']]
  };
  var NUMERIC = ['expenseLimit', 'desks', 'oklad', 'coef', 'creditLimit', 'earlyRate', 'earlyBase', 'volumeRate', 'volumeFrom', 'penaltyDaily'];
  var EXAMPLE = {
    branches: ['Olmazor 3-filial', 'Olmazor 3', 'Olmazor tumani, 3-uy', '08:00–22:00', 'Ism Familiya', '5000000', '2'],
    employees: ['Malika Rasulova', 'Kassir', 'Chilonzor 12', '+998 90 123 45 67', '4000000', '1', '2/2 · 08:00–20:00', '2026-yil oktabr', 'kassir_mr', 'Mehnat shartnomasi · muddatsiz'],
    suppliers: ['Yangi Farm MChJ', '301222333', 'Ism Familiya', '+998 71 200 00 00', '100000000', '30 kun', '2', '50000000', '1', '200000000', '0.1']
  };
  function norm(s) { return String(s).trim().toLowerCase().replace(/[‘’ʻʼ`']/g, '').replace(/[^a-z0-9а-яё]+/gi, ''); }
  function parseNum(v) { var s = String(v).replace(/[\s  ]/g, '').replace(',', '.'); if (!s) return undefined; var n = Number(s); return isFinite(n) ? n : NaN; }
  function parseTable(text) {
    var src = text.replace(/^﻿/, ''), first = src.split(/\r?\n/, 1)[0] || '';
    var delim = first.indexOf('\t') >= 0 ? '\t' : ((first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',');
    var rows = [], row = [], cell = '', q = false;
    function nonEmpty(r) { return r.some(function (c) { return c.trim(); }); }
    for (var i = 0; i < src.length; i++) {
      var ch = src[i];
      if (q) { if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
      else if (ch === '"' && cell === '') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; row.push(cell); cell = ''; if (nonEmpty(row)) rows.push(row); row = []; }
      else cell += ch;
    }
    row.push(cell); if (nonEmpty(row)) rows.push(row);
    return rows;
  }
  function importPanel(initialKind) {
    var role = A.role(), kinds = Object.keys(IMPORT_ROLES).filter(function (k) { return IMPORT_ROLES[k].indexOf(role) >= 0; });
    if (A.readOnly() || !kinds.length) return A.infobar('warn', 'Ruxsat yo‘q.', 'Sizning rolingiz bu turdagi ma’lumotni kirita olmaydi.');
    var kind = kinds.indexOf(initialKind) >= 0 ? initialKind : kinds[0], errors = [];
    var ta = h('textarea', { class: 'tb mono', style: { height: '140px' }, placeholder: 'yoki jadvalni shu yerga qo‘ying', spellcheck: 'false' });
    var out = h('div');
    var kindS = selectEl(kinds.map(function (k) { return [k, IMPORT_KIND[k]]; }), kind, '200px');
    kindS.onchange = function () { kind = kindS.value; errors = []; paint(); };
    var file = h('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv', style: { display: 'none' } });
    file.onchange = function () { var f = file.files && file.files[0]; if (!f) return; f.text().then(function (t) { ta.value = t; errors = []; paint(); }); file.value = ''; };
    ta.oninput = function () { errors = []; paint(); };
    function template() {
      var csv = [COLUMNS[kind].map(function (c) { return c[1]; }), EXAMPLE[kind]].map(function (r) { return r.map(function (c) { return '"' + c.replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
      ta.value = csv; paint(); copy(csv, 'Shablon nusxalandi');
    }
    function parse() {
      var branches = A.state.branches || [], table = parseTable(ta.value);
      if (table.length < 2) return { rows: [], unknown: [], problems: [], header: [] };
      var cols = COLUMNS[kind];
      var header = table[0].map(function (hd) {
        var n = norm(hd), f = cols.find(function (c) { return norm(c[0]) === n || norm(c[1]) === n || (c[0] === 'branch' && (n === 'branchid' || n === 'filialid')); });
        return f ? f[0] : null;
      });
      var unknown = table[0].filter(function (x, i) { return header[i] === null && x.trim(); }), problems = [];
      var rows = table.slice(1).map(function (r, n) {
        var o = {};
        header.forEach(function (k, i) {
          var v = (r[i] || '').trim(); if (!k || !v) return;
          if (k === 'branch') {
            var b = branches.find(function (x) { return x.id === v || norm(x.name) === norm(v) || norm(x.short || '') === norm(v); });
            if (b) o.branchId = b.id; else { o.branchId = v; problems.push(tf('{n}-qator: «{b}» filiali topilmadi', { n: n + 1, b: v })); }
          } else o[k] = NUMERIC.indexOf(k) >= 0 ? parseNum(v) : v;
        });
        return o;
      });
      return { rows: rows, unknown: unknown, problems: problems, header: header.filter(Boolean) };
    }
    function paint() {
      clear(out); var p = parse();
      if (ta.value.trim() && !p.rows.length) out.appendChild(A.infobar('warn', 'Faylda ma’lumot topilmadi', ''));
      if (p.unknown.length) out.appendChild(h('div', { style: { fontSize: '12px', color: 'var(--warn)', marginTop: '6px' }, text: tf('Noma’lum ustunlar e’tiborsiz qoldiriladi: {cols}', { cols: p.unknown.join(', ') }) }));
      if (p.problems.length) out.appendChild(A.infobar('warn', 'Diqqat.', p.problems.slice(0, 5).join(' · ')));
      if (errors.length) out.appendChild(A.infobar('crit', 'Xatolar — hech narsa saqlanmadi', h('div', null, errors.slice(0, 20).map(function (e) { return h('div', { text: tf('{n}-qator', { n: e.row }) + ': ' + e.message }); }))));
      if (!p.rows.length) return;
      var labels = COLUMNS[kind].filter(function (c) { return p.header.indexOf(c[0]) >= 0; });
      out.appendChild(h('div', { style: { fontWeight: '600', margin: '12px 0 6px' }, text: tf('Ko‘rib chiqish · {n} qator', { n: p.rows.length }) }));
      var tbl = U.table(labels.map(function (c) { return { t: c[1], render: function (r) { var v = r[c[0] === 'branch' ? 'branchId' : c[0]]; return v == null ? '' : String(v); } }; }), p.rows.slice(0, 50), { bare: true });
      tbl.style.maxHeight = '300px'; tbl.style.overflow = 'auto'; tbl.style.border = '1px solid var(--stroke)'; tbl.style.borderRadius = 'var(--r)';
      var trs = tbl.querySelectorAll('tbody tr');
      errors.forEach(function (e) { var tr = trs[e.row - 1]; if (tr) tr.style.background = 'var(--crit-bg, rgba(196,47,55,.12))'; });
      out.appendChild(tbl);
      var go = h('button', { class: 'btn accent', style: { marginTop: '12px' }, onclick: function () {
        go.disabled = true; errors = [];
        A.cmd('data.import', { kind: kind, rows: p.rows }).then(function (r) {
          A.toast('ok', tf('Import tugadi: {c} ta yangi, {u} ta yangilandi', { c: r.created, u: r.updated })); ta.value = '';
          if (kind === 'branches' || kind === 'employees') A.state.branches = null;
          paint();
        }).catch(function (e) { if (Array.isArray(e.details)) { errors = e.details; paint(); } else { fail(e); go.disabled = false; } });
      } }, tf('{n} qatorni import qilish', { n: p.rows.length }));
      out.appendChild(h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, go, pill('mute', IMPORT_KIND[kind])));
    }
    paint();
    return sectionCard('Ma’lumotlarni import qilish', 'CSV fayl yuklang (Excel: «Saqlash → CSV UTF-8») yoki jadvaldan nusxa olib qo‘ying. Ustun nomlari shablondagidek bo‘lsin.', pad(h('div', null,
      h('div', { style: { display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' } },
        h('div', null, h('div', { style: { fontSize: '12px', color: 'var(--text-2)', marginBottom: '4px' }, text: 'Ma’lumot turi' }), kindS),
        h('button', { class: 'btn', onclick: function () { file.click(); } }, 'Fayl tanlash'), file,
        h('button', { class: 'btn subtle', onclick: template }, 'Shablonni nusxalash')),
      h('div', { style: { marginTop: '12px' } }, ta),
      h('div', { class: 'small', text: 'Mavjud yozuvlar ID, filial nomi, xodim F.I.Sh. + filial yoki firma STIR bo‘yicha topiladi va yangilanadi. Bitta xato bo‘lsa, hech narsa saqlanmaydi.' }),
      out)));
  }

  // ═════════════ Sozlamalar ═════════════
  var STABS = [['tashkilot', 'Tashkilot va brending', 'branch'], ['limitlar', 'Limitlar va tasdiqlar', 'wallet'], ['idle', 'Idle limitlar', 'clock'], ['kategoriya', 'Harajat kategoriyalari', 'tax'],
    ['bildirish', 'Bildirishlar', 'bell'], ['lokal', 'Lokalizatsiya', 'info'], ['xavfsizlik', 'Xavfsizlik', 'key'], ['profil', 'Profil', 'user'], ['import', 'Ma’lumot kiritish', 'report']];
  A.screens.settings = function (page, params, ctx) {
    return A.get('/v1/settings').then(function (st) {
      guard(ctx);
      var ro = !isAdmin(), tab = params.tab || 'tashkilot';
      if (tab === 'profil') { A.go('profile'); throw { silent: true }; }
      var nav = h('div', { class: 'card', style: { padding: '4px', position: 'sticky', top: '0' } }), content = h('div', { style: { minWidth: '0', maxWidth: '860px' } });
      STABS.forEach(function (t) {
        nav.appendChild(h('div', { class: 'md-item' + (t[0] === tab ? ' sel' : ''), style: { cursor: 'default' }, onclick: function () {
          if (t[0] === 'profil') { A.go('profile'); return; }
          A.go('settings', { tab: t[0] });
        } }, icon(t[2]), h('div', { class: 'body' }, h('div', { class: 't', style: { fontWeight: t[0] === tab ? '600' : '400' }, text: t[1] }))));
      });
      page.classList.add('wide');
      page.appendChild(head('Sozlamalar', STABS.find(function (t) { return t[0] === tab; })[1], [U.refreshBtn()]));
      if (A.readOnly()) page.appendChild(A.infobar('info', 'Auditor rejimi.', 'Sozlamalarni faqat ko‘rish mumkin.'));
      page.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: '240px minmax(0,1fr)', gap: '20px', alignItems: 'start' } }, nav, content));
      var R = { tashkilot: org, limitlar: limits, idle: idle, kategoriya: cats, bildirish: notif, lokal: lokal, xavfsizlik: sec, import: function () { content.appendChild(importPanel(params.kind)); } };
      (R[tab] || org)();

      function dis(i) { i.disabled = ro; return i; }
      function org() {
        content.appendChild(sectionCard('Tashkilot va brending', null, pad(h('div', null,
          h('div', { style: { display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' } },
            h('div', { style: { width: '72px', height: '72px', border: '1px dashed var(--stroke-strong)', borderRadius: '12px', display: 'grid', placeItems: 'center', fontSize: '11px', color: 'var(--text-3)', textAlign: 'center' } }, 'logo', h('br'), '1:1'),
            h('div', { style: { width: '200px', height: '52px', border: '1px dashed var(--stroke-strong)', borderRadius: '8px', display: 'grid', placeItems: 'center', fontSize: '11px', color: 'var(--text-3)' }, text: 'to‘liq logo 4:1' }),
            h('div', { style: { maxWidth: '300px', fontSize: '12px', color: 'var(--text-3)' }, text: 'SVG yoki PNG, kamida 128 px. Logotip yuklanmasa, Apteka 360 belgisi ko‘rsatiladi. Status ranglari barcha tashkilotlarda bir xil qoladi.' })),
          h('div', { class: 'form-grid' }, field('Tashkilot nomi', dis(input({ value: 'Shifo Farm tarmog‘i' }))), field('STIR', dis(input({ value: '309 441 027' })))),
          h('div', { class: 'small', text: 'Web panelda ham bu maydonlar hozircha saqlanmaydi (server buyrug‘i yo‘q).' })))));
      }
      function limits() {
        var base = st.limitBase || 'Naqd + karta', mode = st.limitMode || 'Ogohlantirish + Egasi tasdig‘i';
        var coef = dis(input({ value: String(st.limitCoef == null ? 10 : st.limitCoef), attrs: { inputmode: 'numeric', maxlength: '3' } })); coef.style.width = '100px'; coef.classList.add('num');
        var prev = h('span', { style: { color: 'var(--text-2)', fontSize: '13px' } });
        function upd() { var c = parseInt(coef.value.replace(/\D/g, '') || '0', 10), b = base === 'Faqat naqd' ? 18450000 : 40790000; prev.textContent = tf('Chilonzor 12, bugun: ({base}) × {coef}% = {v}', { base: base === 'Faqat naqd' ? 'naqd 18 450 000' : 'naqd + karta 40 790 000', coef: c, v: A.money(Math.round(b * c / 100)) }); }
        coef.oninput = function () { coef.value = coef.value.replace(/\D/g, '').slice(0, 3); upd(); };
        var baseSeg = U.seg([['Faqat naqd', 'Faqat naqd'], ['Naqd + karta', 'Naqd + karta']], base, function (v) { base = v; upd(); });
        var modeSeg = U.seg(['Bloklash', 'Ogohlantirish + Egasi tasdig‘i', 'Faqat ogohlantirish'].map(function (x) { return [x, x]; }), mode, function (v) { mode = v; });
        if (ro) [baseSeg, modeSeg].forEach(function (s) { Array.prototype.forEach.call(s.children, function (b) { b.disabled = true; }); });
        var sv = U.ro(h('button', { class: 'btn accent', onclick: function () {
          var c = parseInt(coef.value || '0', 10); if (c > 100) { A.toast('crit', 'Koeffitsient 0–100% oralig‘ida bo‘lsin'); return; }
          sv.disabled = true;
          U.run('settings.saveLimits', { limitBase: base, limitCoef: c, limitMode: mode }, 'Limitlar saqlandi. Ertangi kundan amal qiladi.').then(function (ns) { if (ns) st = ns; sv.disabled = false; }, function () { sv.disabled = false; });
        } }, 'Saqlash'));
        if (ro) sv.disabled = true;
        function moneyRO(v) { var i = input({ value: A.num(v) }); i.disabled = true; i.classList.add('num'); return i; }
        upd();
        content.appendChild(sectionCard('Ertangi kun harajat limiti', null, pad(h('div', null,
          h('div', { class: 'field' }, h('label', { text: 'Limit bazasi' }), baseSeg),
          h('div', { class: 'field' }, h('label', { text: 'Koeffitsient, %' }), h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' } }, coef, prev)),
          h('div', { class: 'field' }, h('label', { text: 'Limitdan oshganda' }), modeSeg),
          h('div', { style: { marginTop: '16px' } }, sv)))));
        content.appendChild(sectionCard('Tasdiqlash zanjiri', 'Qiymatlar serverdan; bu chegaralar hozircha faqat ko‘rish uchun (settings.saveLimits ularni qabul qilmaydi).', pad(h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' } },
          field('Filial mudiri — gacha (X)', moneyRO(st.approvalX), 'so‘m'), field('Moliya admin — gacha (Y)', moneyRO(st.approvalY), 'so‘m'), field('Kassa farqi chegarasi', moneyRO(st.cashThreshold), 'dan oshsa sabab majburiy')))));
      }
      function listCard(title, cols, rows, note) {
        var c = U.table(cols.map(function (t, i) { return { t: t, render: function (r) { return r[i]; }, w: i ? '170px' : null }; }), rows, { title: title });
        content.appendChild(c); if (note) content.appendChild(h('div', { class: 'small', text: note }));
      }
      function idle() {
        listCard('Idle limitlari (oy davomida jarimasiz) · standart 8 soat', ['Lavozim', 'Limit', 'Jarima qoidasi'],
          [['Farmatsevt', '8 soat', 'P-04 · 150 000'], ['Katta farmatsevt', '8 soat', 'P-04 · 150 000'], ['Kassir', '6 soat', 'P-04 · 150 000'], ['Omborchi', '10 soat', 'P-04 · 100 000'], ['Filial mudiri', 'hisoblanmaydi', '—']],
          'Rejadagi tanaffus va dam olish xonasidagi vaqt idle hisoblanmaydi. Faqat inson tasdiqlagan AI hodisalari hisobga olinadi.');
      }
      function cats() {
        listCard('Harajat kategoriyalari va byudjet', ['Kategoriya', 'Byudjet', 'Holat'],
          [['Xodimlar', '12 mln/oy', 'faol'], ['Kommunal', '18 mln/oy', 'faol'], ['IT', '8 mln/oy', 'faol'], ['Logistika', '6 mln/oy', 'faol'], ['Davlat / bank', '4 mln/oy', 'faol'], ['Tijorat', '5 mln/oy', 'faol'], ['Vrachlar', 'maxfiy', 'faol'], ['Boshqa', '2 mln/oy', 'izoh majburiy']]);
      }
      function notif() {
        var rows = [['Kassa farqi > chegara', true, true, false], ['FOM sync uzilishi > 15 daq', true, true, true], ['AI hodisa (yuqori ustuvorlik)', true, true, false], ['Tasdiq kutilmoqda', true, true, false], ['Firma: chegirma muddati', true, false, true], ['Hujjat muddati tugaydi', false, true, true], ['Kunlik hisobot 23:30', true, false, false]];
        var box = h('div');
        box.appendChild(h('div', { class: 'list-item', style: { fontSize: '12px', color: 'var(--text-2)', alignItems: 'center' } }, h('div', { style: { flex: '1' }, text: 'Hodisa' }), ['Telegram', 'Push', 'E-pochta'].map(function (c) { return h('div', { style: { width: '72px', textAlign: 'center' }, text: c }); })));
        rows.forEach(function (r) {
          box.appendChild(h('div', { class: 'list-item', style: { alignItems: 'center' } }, h('div', { style: { flex: '1' }, text: r[0] }), [1, 2, 3].map(function (j) { return h('div', { style: { width: '72px', display: 'flex', justifyContent: 'center' } }, sw(r[j], null, ro)); })));
        });
        content.appendChild(sectionCard('Bildirishlar', 'Kanallar bo‘yicha bildirish turlari', box));
        content.appendChild(h('div', { class: 'small', text: 'Web panelda ham bu jadval hozircha serverga saqlanmaydi.' }));
      }
      function lokal() {
        content.appendChild(sectionCard('Interfeys tili', null, h('div', null,
          srow('O‘zbek (lotin)', 'Desktop ilova hozircha faqat o‘zbek (lotin) tilida', pill('ok', 'Tanlangan'), 'info'),
          srow('Ўзбек (кирилл)', 'Web panelda mavjud', pill('mute', 'Web panel'), 'info'),
          srow('Русский', 'Web panelda mavjud', pill('mute', 'Web panel'), 'info'))));
        content.appendChild(sectionCard('Ko‘rinish testi — uzun yorliqlar va katta summalar', null, h('div', null,
          srow('Bugungi tushum', null, h('b', { text: A.money(1248920000) })), srow('Ta’minotchiga qarz', null, h('b', { text: A.money(412600000) })))));
        content.appendChild(h('div', { class: 'small', text: 'Sana: 08.10.2026 · son: 1 248 920,50 · valyuta: so‘m / сўм / сум. Til har bir foydalanuvchi uchun alohida saqlanadi.' }));
      }
      function sec() {
        content.appendChild(sectionCard('Ikki bosqichli tasdiqlash (2FA)', null, srow('Yoqilgan · SMS + Telegram', 'Egasi, Moliya admin va Super admin uchun majburiy. Biometrik kirish (Face ID / barmoq izi) faqat mobil ilovada.', sw(true, null, true), 'key')));
        content.appendChild(sessionsCard());
        content.appendChild(loginsCard());
      }
    });
  };

  // ═════════════ Filiallar (master-detail + boshqaruv) ═════════════
  function branchForm(b) {
    var F = [['name', 'Filial nomi', true], ['short', 'Qisqa nomi'], ['address', 'Manzil', false, true], ['hours', 'Ish vaqti'], ['manager', 'Mudir'], ['expenseLimit', 'Kunlik harajat limiti', false, false, 'money'], ['desks', 'Kassalar soni', false, false, 'int']];
    var ins = {}, er = errBox(), grid = h('div', { class: 'form-grid' }), wide = h('div');
    F.forEach(function (f) {
      var v = b ? b[f[0]] : null, el;
      if (f[4] === 'money') el = U.moneyInput(v || 0);
      else { el = input({ value: v == null ? '' : String(v) }); if (f[4] === 'int') { el.classList.add('num'); el.setAttribute('inputmode', 'numeric'); } }
      ins[f[0]] = el;
      (f[3] ? wide : grid).appendChild(field(f[1] + (f[2] ? ' *' : ''), el));
    });
    return wideDialog({ title: b ? 'Filialni tahrirlash' : 'Filial qo‘shish', primary: 'Saqlash', body: h('div', null, grid, wide, er), onPrimary: function () {
      var out = {};
      if (!ins.name.value.trim()) { er.textContent = 'Majburiy maydon: Filial nomi'; return false; }
      ['name', 'short', 'address', 'hours', 'manager'].forEach(function (k) { var v = ins[k].value.trim(); if (v) out[k] = v; });
      if (ins.expenseLimit.value.trim()) out.expenseLimit = ins.expenseLimit.num();
      if (ins.desks.value.trim()) { var d = parseInt(ins.desks.value, 10); if (isNaN(d) || d < 0) { er.textContent = 'Kassalar soni — butun son.'; return false; } out.desks = d; }
      if (b) out.id = b.id;
      return A.cmd('branches.upsert', out).then(function (x) { A.toast('ok', tf('«{name}» filiali saqlandi', { name: x.name })); return x; }).catch(function (e) { er.textContent = errText(e); return false; });
    } }, '620px');
  }
  function branchDelete(b) {
    var rs = input(), er = errBox();
    return wideDialog({ title: 'Filialni o‘chirish', primary: 'O‘chirish', danger: true, body: h('div', null,
      h('p', { class: 'note' }, h('b', { text: b.name })),
      A.infobar('warn', 'Diqqat.', 'Filial ro‘yxatdan butunlay o‘chiriladi. Unda faol xodimlar, kameralar, FOM bog‘lanishi, biriktirilgan foydalanuvchilar yoki yakunlanmagan so‘rov va harajatlar bo‘lsa, server o‘chirishga ruxsat bermaydi va nimani avval hal qilish kerakligini aytadi. Tarix (audit, yopilgan harajatlar) saqlanib qoladi.'),
      field('Sabab *', rs), er), onPrimary: function () {
      var v = rs.value.trim(); if (v.length < 3) { er.textContent = 'Sabab kamida 3 belgi.'; return false; }
      return A.cmd('branches.delete', { id: b.id, reason: v }).then(function (x) { A.toast('ok', tf('«{name}» filiali o‘chirildi', { name: x.name || b.name })); return x; })
        .catch(function (e) {
          clear(er);
          var bl = e && e.details && e.details.blockers;
          if (bl && bl.length) er.appendChild(h('div', null, h('div', { text: String(e.error || '').split(' — ')[0] }), h('ul', { style: { margin: '4px 0 0', paddingLeft: '18px' } }, bl.map(function (x) { return h('li', { text: x.text || (x.kind + ': ' + x.count) }); }))));
          else er.textContent = errText(e);
          return false;
        });
    } }, '560px');
  }
  function edgeKeyCard(b) {
    var slot = h('div', { style: { marginTop: '8px' } });
    function show() {
      clear(slot);
      var btn = h('button', { class: 'btn', onclick: function () {
        btn.disabled = true;
        A.get('/v1/edges/key?branchId=' + encodeURIComponent(b.id)).then(function (r) {
          clear(slot);
          slot.appendChild(h('div', { style: { display: 'flex', gap: '8px', alignItems: 'flex-start' } }, h('div', { class: 'secret mono', style: { flex: '1', minWidth: '0' }, text: r.edgeSecret }),
            h('button', { class: 'btn', style: { minWidth: '0' }, onclick: function () { copy(r.edgeSecret, 'Kalit nusxalandi'); } }, 'Nusxa'),
            h('button', { class: 'btn subtle', onclick: show }, 'Yashirish')));
        }).catch(function (e) { btn.disabled = false; fail(e); });
      } }, icon('key'), 'Kalitni ko‘rsatish');
      slot.appendChild(btn);
    }
    show();
    var c = card('Edge kaliti', null, h('div', { style: { padding: '0 20px 16px' } }, h('div', { style: { fontSize: '12px', color: 'var(--text-2)' }, text: 'Shu filial Edge kompyuteri uchun (edge_agent.ini → edge_secret). Ko‘rish audit jurnaliga yoziladi.' }), slot));
    c.style.marginTop = '12px'; return c;
  }
  function branchDetail(b, manage, onChanged) {
    var kpi = U.kpi, bars = U.bars;
    var dlt = b.revenueYesterday ? Math.round((b.revenueToday - b.revenueYesterday) / b.revenueYesterday * 1000) / 10 : null;
    var expPct = b.expenseLimit ? Math.round(b.expensesToday / b.expenseLimit * 100) : 0;
    var fomK = b.fom && b.fom.status === 'ok' ? 'ok' : b.fom && b.fom.status === 'down' ? 'crit' : 'warn';
    var mg = manage ? h('div', { style: { display: 'flex', gap: '8px', marginTop: '12px' } },
      h('button', { class: 'btn', onclick: function () { branchForm(b).then(function (x) { if (x) onChanged(x.id || b.id); }); } }, 'Tahrirlash'),
      h('button', { class: 'btn danger', onclick: function () { branchDelete(b).then(function (x) { if (x) onChanged(null); }); } }, 'O‘chirish')) : null;
    return h('div', null,
      h('div', { class: 'card pad', style: { marginBottom: '12px' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' } },
          h('div', null, h('div', { style: { font: '600 20px/28px var(--font-display)' }, text: b.name }), h('div', { class: 'muted', style: { color: 'var(--text-2)' }, text: [b.address, b.hours, b.manager ? 'Mudir: ' + b.manager : null].filter(Boolean).join(' · ') })),
          h('div', { style: { marginLeft: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' } },
            pill(b.closing === 'open' ? 'info' : b.closing === 'closed' ? 'ok' : 'warn', b.closing === 'open' ? 'Kassa ochiq' : b.closing === 'closed' ? 'Kassa yopilgan' : 'Kassa: ' + b.closing),
            pill(fomK, 'FOM · ' + (b.fom ? b.fom.lag || b.fom.status : '—')),
            pill(b.edge === 'online' ? 'ok' : 'crit', 'Edge · ' + (b.edge === 'online' ? 'onlayn' : 'oflayn')))),
        mg),
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
        var c = card('Ma’lumotlar', null, h('div', { style: { padding: '0 20px 8px' } }, U.kvList([
          ['Mudir', b.manager || '—'], ['Manzil', b.address || '—'], ['Ish vaqti', b.hours || '—'], ['Kunlik harajat limiti', A.money(b.expenseLimit)], ['Kassalar soni', String(b.desks == null ? '—' : b.desks)],
          ['FOM oxirgi sinx.', b.fom ? (b.fom.last + ' · ' + (b.fom.lag || '')) : '—'], ['Bugungi AI hodisalar', String(b.aiToday == null ? '—' : b.aiToday)]])));
        c.style.marginTop = '12px'; return c;
      })(),
      manage ? edgeKeyCard(b) : null,
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' } },
        A.can('cash') ? h('button', { class: 'btn', onclick: function () { A.go('cash', { branch: b.id }); } }, icon('cash'), 'Kassa') : null,
        A.can('cameras') ? h('button', { class: 'btn', onclick: function () { A.go('cameras', { branch: b.id }); } }, icon('cam'), 'Kameralar') : null,
        A.can('employees') ? h('button', { class: 'btn', onclick: function () { A.go('employees', { branch: b.id }); } }, icon('people'), 'Xodimlar') : null));
  }
  A.screens.branches = function (page, params, ctx) {
    return A.get('/v1/branches').then(function (br) {
      guard(ctx); A.state.branches = br;
      var manage = isAdmin();
      page.classList.add('wide');
      function changed(id) { A.state.branches = null; A.go('branches', id ? { id: id } : null); }
      var add = manage ? h('button', { class: 'btn accent', onclick: function () { branchForm(null).then(function (x) { if (x) changed(x.id); }); } }, icon('plus'), 'Filial qo‘shish') : null;
      var imp = manage && A.can('settings') ? h('button', { class: 'btn', onclick: function () { A.go('settings', { tab: 'import', kind: 'branches' }); } }, 'Import') : null;
      var emp = br.reduce(function (a, b) { return a + (b.employees || 0); }, 0), cams = br.reduce(function (a, b) { return a + (b.cameras || 0); }, 0);
      page.appendChild(head('Filiallar', br.length + ' ta filial · ' + emp + ' xodim · ' + cams + ' kamera', [add, imp, U.refreshBtn()]));
      if (!br.length) { page.appendChild(card(null, null, U.empty('Filial yo‘q', 'branch'))); return; }
      var sel = params.id && br.some(function (x) { return x.id === params.id; }) ? params.id : br[0].id, master = h('div', { class: 'card master' }), detail = h('div');
      function paint() {
        clear(master);
        br.forEach(function (b) {
          master.appendChild(h('div', { class: 'md-item' + (b.id === sel ? ' sel' : ''), onclick: function () { sel = b.id; paint(); } },
            h('span', { class: 'dot ' + (b.health >= 80 ? 'ok' : b.health >= 60 ? 'warn' : 'crit') }),
            h('div', { class: 'body' }, h('div', { class: 't', text: b.short || b.name }), h('div', { class: 's', text: [b.manager, b.address].filter(Boolean).join(' · ') })),
            h('div', { class: 'end' }, h('div', { text: A.moneyShort(b.revenueToday).v + ' mln' }), h('div', { text: b.health + '%' }))));
        });
        var b = br.find(function (x) { return x.id === sel; }); clear(detail); if (b) detail.appendChild(branchDetail(b, manage, changed));
      }
      paint();
      page.appendChild(h('div', { class: 'md' }, master, detail));
    });
  };
})();
