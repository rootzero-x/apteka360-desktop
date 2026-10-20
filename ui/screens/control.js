/* Apteka 360 Desktop — AI nazorat ekranlari: AI review navbati, Video devor, Kameralar va zonalar, Jonli filial. */
(function () {
  'use strict';
  var A = window.Apteka, h = A.h, U = A.ui, icon = A.icon, clear = A.clear || function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  // ───────────── Umumiy ─────────────
  function roleIn(list) { var r = A.role(); return list.indexOf(r) >= 0; }
  var AI_ROLES = ['OWNER', 'MANAGER', 'OPERATOR'], ESC_ROLES = ['OWNER', 'FINANCE', 'OPERATOR'];
  var CAM_ADMIN = ['OWNER', 'SUPER_ADMIN', 'MANAGER'], CAM_TEST = ['OWNER', 'SUPER_ADMIN', 'MANAGER', 'OPERATOR'];
  function canAi() { return !A.readOnly() && roleIn(AI_ROLES); }
  function canCamAdmin() { return !A.readOnly() && roleIn(CAM_ADMIN); }
  function isModuleOff(e) { return e && e.code === 'module_disabled'; }
  function isEdgeOff(e) { return e && e.status === 503 && e.details && (e.details.reason === 'edge_offline' || e.details.reason === 'edge_timeout'); }
  function camErr(e) {
    if (isModuleOff(e)) return 'Kameralar moduli o‘chirilgan. Egasi uni Tizim → Modullar bo‘limida yoqishi mumkin.';
    if (isEdgeOff(e)) return e.details.reason === 'edge_timeout' ? 'Filial Edge serveri javob bermadi (15 s). Keyinroq urinib ko‘ring.' : 'Filial Edge serveri oflayn — buyruqni bajarib bo‘lmaydi.';
    if (e && e.details && e.details.reason === 'no_audio_out') return 'Kamerada karnay topilmadi.';
    if (e && e.status === 403) return e.error || 'Ruxsat yo‘q yoki kamera maxfiy.';
    return (e && e.error) || String(e);
  }
  function moduleInfo() { return A.infobar('info', 'Modul yoqilmagan.', ' «Kameralar» moduli o‘chirilgan. Egasi uni Tizim → Modullar bo‘limida yoqishi mumkin.'); }
  function safe(p, dflt) { return p.catch(function () { return dflt; }); }
  function dlgOpen() { var b = document.getElementById('dlg-back'); return !!(b && b.classList.contains('show')); }
  function short(name) { return String(name || '').split(' · ')[0]; }
  var STATUS_PILL = { online: ['ok', 'onlayn'], offline: ['crit', 'oflayn'], unknown: ['mute', 'noma’lum'] };
  var HS = { ok: ['ok', 'ishlayapti'], warn: ['warn', 'diqqat'], down: ['crit', 'uzilgan'] };
  function camStatus(c) { return c.status || (c.health === 'down' || c.rtsp === 'down' ? 'offline' : 'online'); }
  var TASKS = [['attendance', 'Davomat'], ['people_count', 'Odam sanash'], ['idle', 'Idle'], ['fraud', 'Firibgarlik'], ['audio', 'Audio'], ['flow', 'Mijoz oqimi'], ['queue', 'Navbat'], ['pose', 'Poza (yotish/o‘tirish)']];
  function taskLabel(k) { var t = TASKS.find(function (x) { return x[0] === k; }); return t ? t[1] : k; }

  /** Yengil HLS pleyer (video devor plitkasi uchun). opts: {quality, sound, onError} → {destroy, video} */
  function hlsTile(cam, host, opts) {
    var video = h('video', { playsinline: true, autoplay: true, style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#000' } });
    video.muted = !opts.sound;
    var msg = h('div', { style: { position: 'absolute', inset: '0', display: 'grid', placeItems: 'center', color: '#9a9a9a', fontSize: '12px', textAlign: 'center', padding: '8px' } }, h('div', null, h('span', { class: 'ring sm' }), h('div', { style: { marginTop: '6px' }, text: 'jonli video yuklanmoqda…' })));
    host.appendChild(video); host.appendChild(msg);
    var hls = null, dead = false, renew = null;
    function fail(t) { clear(msg); msg.style.display = 'grid'; msg.appendChild(h('div', { text: t })); }
    function start() {
      if (dead) return;
      clearTimeout(renew); if (hls) { hls.destroy(); hls = null; }
      A.cmd('cameras.streamUrl', { id: cam.id, quality: opts.quality || 'sub' }).then(function (u) {
        if (dead) return;
        var Hls = window.Hls;
        if (!Hls || !Hls.isSupported()) { if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = u.hlsUrl; video.play().catch(function () {}); msg.style.display = 'none'; } else fail('HLS qo‘llab-quvvatlanmaydi'); return; }
        hls = new Hls({ liveSyncDurationCount: 3, liveMaxLatencyDurationCount: 8, maxLiveSyncPlaybackRate: 1.2, backBufferLength: 6, maxBufferLength: 8, manifestLoadingMaxRetry: 4, levelLoadingMaxRetry: 6, fragLoadingMaxRetry: 6, enableWorker: true });
        hls.on(Hls.Events.ERROR, function (_e, d) {
          if (!d.fatal) return;
          if (d.type === Hls.ErrorTypes.MEDIA_ERROR) { hls.recoverMediaError(); return; }
          if (d.type === Hls.ErrorTypes.NETWORK_ERROR && !(d.response && d.response.code)) { hls.startLoad(); return; }
          fail('Video ochilmadi' + (d.response && d.response.code ? ' (HTTP ' + d.response.code + ')' : ''));
        });
        hls.on(Hls.Events.MANIFEST_PARSED, function () { video.play().catch(function () {}); });
        video.addEventListener('playing', function () { msg.style.display = 'none'; }, { once: true });
        hls.loadSource(u.hlsUrl); hls.attachMedia(video);
        var ms = u.expiresAt ? new Date(u.expiresAt).getTime() - Date.now() - 60000 : 240000;
        renew = setTimeout(start, Math.max(30000, ms));
      }).catch(function (e) { if (dead) return; fail(camErr(e)); if (opts.onError) opts.onError(e); });
    }
    function destroy() { dead = true; clearTimeout(renew); if (hls) hls.destroy(); hls = null; try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {} }
    start();
    return { destroy: destroy, video: video };
  }

  /** Bosib turib gapirish tugmasi (U.pushToTalk asosida) */
  function talkButton(camId, compact) {
    var talk = null, info = h('span', { style: { fontSize: '11px', color: '#cfcfcf' } });
    var btn = h('button', { class: 'btn talk' + (compact ? ' subtle' : ''), title: 'Tugmani bosib turib gapiring — ovoz kamera karnayidan chiqadi (60 s gacha, auditga yoziladi)' }, icon('mic'), compact ? null : 'Gapirish');
    function startT() {
      if (talk) return;
      talk = U.pushToTalk(camId, function (state, text) {
        btn.classList.toggle('on', state === 'talking' || state === 'starting');
        info.textContent = text || '';
        info.style.color = state === 'error' ? 'var(--crit)' : '#cfcfcf';
        if (state === 'idle' || state === 'error') talk = null;
      });
    }
    function stopT() { if (talk) talk.stop(); }
    btn.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); startT(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) { btn.addEventListener(n, stopT); });
    btn.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startT(); } });
    btn.addEventListener('keyup', stopT);
    return { el: h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } }, btn, info), stop: stopT };
  }

  // ═════════════ AI hodisalar — review navbati ═════════════
  var AI_ST = { pending: ['warn', 'Tekshiruv kutilmoqda'], confirmed: ['ok', 'Tasdiqlangan'], rejected: ['crit', 'Rad etilgan'], disputed: ['info', 'E’tiroz'] };
  var VERDICT = { confirm: ['ok', 'AI tasdiqladi'], reject: ['crit', 'AI rad etdi'], unsure: ['warn', 'AI aniq emas'] };
  var PRIO = { 'yuqori': 'crit', 'o‘rta': 'warn', 'past': 'mute' };
  var REJ_REASONS = ['Noto‘g‘ri xodim aniqlangan', 'Ruxsat etilgan tanaffus', 'Ish jarayoni (mijoz bilan ishlash)', 'Video sifati past', 'Boshqa'];
  function fmtHm(min) { min = Math.max(0, Math.round(min || 0)); return Math.floor(min / 60) + ' s ' + ('0' + (min % 60)).slice(-2) + ' daq'; }
  function confLevel(c) { return c >= 85 ? 'yuqori' : c >= 60 ? 'o‘rta' : 'past'; }

  A.screens.ai = function (page, params, ctx) {
    return Promise.all([A.get('/v1/aiEvents'), safe(A.get('/v1/employees'), []), safe(A.get('/v1/reviewedToday'), null), A.branchesCached()]).then(function (r) {
      U.guard(ctx);
      var events = r[0] || [], employees = r[1] || [], reviewed = r[2];
      var filter = params.filter || 'pending', sel = params.id || params.sel || null, br = params.branch || '', prio = '', q = '';
      var can = canAi(), canEsc = !A.readOnly() && roleIn(ESC_ROLES), busy = false;
      var sub = h('div', { class: 'sub' });
      page.classList.add('wide');
      var headEl = U.head('AI hodisalar — review navbati', null, [
        U.select(U.branchOptions(true), br, function (v) { br = v; paint(); }, '170px'),
        U.select([['', 'Barcha ustuvorlik'], ['yuqori', 'yuqori'], ['o‘rta', 'o‘rta'], ['past', 'past']], '', function (v) { prio = v; paint(); }, '150px'),
        U.search('Qidirish: hodisa, xodim, kamera', function (v) { q = v; paint(); }, '240px'),
        U.refreshBtn()]);
      headEl.firstChild.appendChild(sub);
      page.appendChild(headEl);
      function paintSub() {
        clear(sub);
        sub.appendChild(document.createTextNode('Bugun ko‘rib chiqildi: '));
        sub.appendChild(h('b', { text: reviewed == null ? '—' : String(reviewed) }));
        sub.appendChild(document.createTextNode(' · J / K — keyingi / oldingi · Y — tasdiqlash · N — rad etish · B — boshqa xodim · E — izoh'));
      }
      paintSub();
      if (A.readOnly()) page.appendChild(A.infobar('info', 'Auditor rejimi.', ' Hodisalarni faqat ko‘rish mumkin.'));
      var tabBox = h('div'), master = h('div', { class: 'card master', role: 'listbox' }), detail = h('div');
      page.appendChild(tabBox);
      page.appendChild(h('div', { class: 'md' }, master, detail));

      function emp(id) { return employees.find(function (e) { return e.id === id; }) || null; }
      function scoped() {
        return events.filter(function (e) {
          if (br && e.branchId !== br) return false;
          if (prio && e.priority !== prio) return false;
          if (q) { var en = e.empId && emp(e.empId); var s = [e.label, e.code, e.camera, e.zone, en && en.name].join(' ').toLowerCase(); if (s.indexOf(q) < 0) return false; }
          return true;
        });
      }
      function list() { return scoped().filter(function (e) { return filter === 'all' || e.status === filter; }); }
      function cur() { var l = list(); return l.find(function (e) { return e.id === sel; }) || l[0] || null; }
      function replace(ev) { if (!ev || !ev.id) return; var i = events.findIndex(function (x) { return x.id === ev.id; }); if (i >= 0) events[i] = Object.assign({}, events[i], ev); }
      function move(d) { var l = list(); if (!l.length) return; var c = cur(), i = l.findIndex(function (e) { return c && e.id === c.id; }); i = Math.max(0, Math.min(l.length - 1, (i < 0 ? 0 : i) + d)); sel = l[i].id; paint(); }
      function advance(fromId) {
        var l = list(), i = l.findIndex(function (e) { return e.id === fromId; });
        if (filter === 'pending') { var nx = i < 0 ? l[0] : (l[i + 1] || l[i - 1]); sel = nx ? nx.id : null; } else sel = fromId;
      }
      function refreshReviewed() { A.get('/v1/reviewedToday').then(function (n) { reviewed = n; paintSub(); }).catch(function () {}); }
      function wrap(p) { busy = true; return p.then(function (x) { busy = false; return x; }, function (e) { busy = false; A.toast('crit', 'Bajarilmadi', e.error || String(e)); throw e; }); }

      function setStatus(ev, status, note) {
        var input = { id: ev.id, status: status }; if (note) input.note = note;
        return wrap(A.cmd('ai.setStatus', input)).then(function (upd) { replace(upd || { id: ev.id, status: status, note: note }); refreshReviewed(); return upd; });
      }
      function doConfirm(ev, forcePenalty) {
        if (!ev || ev.status !== 'pending' || !can || busy) return;
        setStatus(ev, 'confirmed').then(function () {
          if (ev.empId) return penaltyDialog(ev);
          A.toast('ok', 'Hodisa tasdiqlandi.', 'Xodim biriktirilmagan, shuning uchun jarima taklif qilinmaydi.');
          advance(ev.id); paint();
        }).catch(function () { paint(); });
      }
      function penaltyDialog(ev) {
        var e = emp(ev.empId), amt = U.moneyInput(150000), note = h('textarea', { class: 'tb', placeholder: 'Izoh xodimga ko‘rinadi', style: { minHeight: '56px' } }), er = h('div', { class: 'err' });
        return A.dialog({
          title: 'Jarima taklif qilish — ' + (e ? e.name : ''), primary: 'Taklifni yuborish', secondary: 'Jarimasiz qoldirish',
          body: h('div', null,
            h('p', { class: 'note', text: 'Hodisa tasdiqlandi. Jarima avtomatik qo‘llanmaydi: taklif filial mudiriga boradi, tasdiqdan keyin xodim 3 kun ichida e’tiroz bildira oladi.' }),
            U.kvList([['Qoida', 'P-04 · Idle limitdan oshish']]),
            U.field('Summa (qoida bo‘yicha, o‘zgartirish mumkin), so‘m', amt), U.field('Izoh', note), er),
          onPrimary: function () {
            var n = amt.num(); if (n <= 0) { er.textContent = 'Summa 0 dan katta bo‘lishi kerak.'; return false; }
            return A.cmd('ai.proposePenalty', { eventId: ev.id, amount: n, note: note.value.trim() }).then(function () {
              A.toast('ok', 'Jarima taklifi filial mudiriga yuborildi.', 'Xodim tasdiqdan keyin 3 kun ichida e’tiroz bildira oladi.');
            }).catch(function (x) { er.textContent = x.error || String(x); return false; });
          }
        }).then(function () { advance(ev.id); paint(); });
      }
      function pickDialog(title, sub, items, primary) { // items: [{v, t, s}] → Promise<v|false>
        var chosen = null, er = h('div', { class: 'err' }), box = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '360px', overflowY: 'auto' } });
        items.forEach(function (it) {
          var b = h('button', { class: 'list-item', style: { textAlign: 'left', width: '100%', border: '1px solid var(--stroke, rgba(128,128,128,.3))', borderRadius: '6px', padding: '8px 12px', background: 'transparent', cursor: 'pointer', color: 'inherit' },
            onclick: function () { chosen = it.v; Array.prototype.forEach.call(box.children, function (x) { x.style.outline = ''; x.style.background = 'transparent'; }); b.style.outline = '2px solid var(--accent)'; b.style.background = 'var(--accent-bg, rgba(0,120,212,.08))'; },
            ondblclick: function () { chosen = it.v; var p = document.querySelector('#dlg .foot .btn.accent'); if (p) p.click(); } },
            h('div', { style: { fontWeight: '600' }, text: it.t }), it.s ? h('div', { class: 'small', style: { color: 'var(--text-2)' }, text: it.s }) : null);
          box.appendChild(b);
        });
        if (!items.length) box.appendChild(U.empty('Ro‘yxat bo‘sh'));
        return A.dialog({ title: title, primary: primary, body: h('div', null, sub ? h('p', { class: 'note', text: sub }) : null, box, er),
          onPrimary: function () { if (chosen == null) { er.textContent = 'Birini tanlang.'; return false; } return chosen; } });
      }
      function doReject(ev) {
        if (!ev || ev.status !== 'pending' || !can || busy) return;
        pickDialog('Rad etish sababi', 'Sabab AI modelini qayta o‘qitishda ishlatiladi.', REJ_REASONS.map(function (x) { return { v: x, t: x }; }), 'Rad etish').then(function (r) {
          if (!r) return;
          setStatus(ev, 'rejected', r).then(function () { A.toast('info', 'Hodisa rad etildi: ' + r + '.', 'AI modeli uchun belgi saqlandi.'); advance(ev.id); paint(); }).catch(function () {});
        });
      }
      function doOther(ev) {
        if (!ev || ev.status !== 'pending' || !can || busy) return;
        var items = employees.filter(function (e) { return e.branchId === ev.branchId && e.id !== ev.empId; }).map(function (e) { return { v: e.id, t: e.name, s: [e.position, e.status].filter(Boolean).join(' · ') }; });
        pickDialog('Boshqa xodimni tanlang', A.branchName(ev.branchId), items, 'Biriktirish').then(function (id) {
          if (!id) return;
          wrap(A.cmd('ai.reassign', { id: ev.id, empId: id })).then(function (upd) { replace(upd || { id: ev.id, empId: id }); var e = emp(id); A.toast('info', 'Hodisa ' + (e ? e.name : id) + 'ga biriktirildi.'); paint(); }).catch(function () {});
        });
      }
      function doNote(ev) {
        if (!ev || !can || busy) return;
        U.prompt('Izoh', 'Izoh', { placeholder: 'Hodisa bo‘yicha izoh — audit jurnaliga yoziladi', required: true, primary: 'Saqlash' }).then(function (t) {
          if (!t) return;
          wrap(A.cmd('ai.note', { id: ev.id, note: t })).then(function (upd) { replace(upd || { id: ev.id, note: t }); A.toast('info', 'Izoh saqlandi.'); paint(); }).catch(function () {});
        });
      }
      function doEscalate(ev) {
        if (!ev || !canEsc || busy) return;
        U.confirm('Eskalatsiya', 'Hodisa yuqori darajaga (Egasi / moliya) yuboriladi va bildirishnoma jo‘natiladi. Davom etasizmi?', 'Eskalatsiya qilish').then(function (ok) {
          if (!ok) return;
          wrap(A.cmd('ai.escalate', { id: ev.id })).then(function (upd) { replace(upd); A.toast('ok', 'Hodisa eskalatsiya qilindi.'); paint(); }).catch(function () {});
        });
      }

      function evidence(c) {
        var privacy = /dam olish/i.test(c.zone || '') && /xona/i.test(c.zone || '');
        var frames = (c.keyframes || []).filter(function (u) { return /^https?:\/\//.test(u); }).slice(0, 4);
        var clip = c.clipUrl || c.clip || null;
        var box = h('div', { style: { position: 'relative', aspectRatio: '16 / 9', background: '#101010', borderRadius: '8px', overflow: 'hidden', color: '#c8c8c8' } });
        var top = h('div', { style: { position: 'absolute', left: '0', right: '0', top: '0', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', fontFamily: 'Consolas, monospace', fontSize: '12px', zIndex: '2', background: 'linear-gradient(#000a, transparent)' } },
          h('span', { text: c.camera + ' · ' + A.branchName(c.branchId) }), h('span', { text: c.date + ' ' + c.time }));
        var tag = h('span', { style: { position: 'absolute', left: '12px', top: '34px', zIndex: '2', background: '#22a05f', color: '#fff', fontFamily: 'Consolas, monospace', fontSize: '11px', padding: '2px 6px', borderRadius: '3px' }, text: c.code + ' · ' + c.conf + '%' });
        if (privacy) box.appendChild(h('div', { style: { position: 'absolute', inset: '0', display: 'grid', placeItems: 'center', fontSize: '13px', color: '#8a8a8a', padding: '20px', textAlign: 'center' }, text: 'Maxfiylik zonasi — video ko‘rsatilmaydi, faqat AI poza tahlili' }));
        else if (clip && /^https?:\/\//.test(clip)) {
          var v = h('video', { controls: true, playsinline: true, preload: 'metadata', src: clip, style: { width: '100%', height: '100%', objectFit: 'contain', background: '#000' } });
          box.appendChild(v); box.appendChild(tag);
        } else if (frames.length) {
          var strip = h('div', { style: { position: 'absolute', inset: '0', display: 'flex', gap: '1px', background: '#000' } });
          frames.forEach(function (u, i) {
            strip.appendChild(h('img', { src: u, alt: 'Hodisa kadri ' + (i + 1), loading: 'lazy', title: 'Kattalashtirish uchun bosing', style: { flex: '1', minWidth: '0', objectFit: 'contain', cursor: 'zoom-in' },
              onclick: function () { A.dialog({ title: 'Hodisa kadri ' + (i + 1), secondary: false, primary: 'Yopish', body: h('img', { src: u, style: { maxWidth: '100%', maxHeight: '70vh', display: 'block' } }) }); },
              onerror: function () { this.style.display = 'none'; } }));
          });
          box.appendChild(strip); box.appendChild(tag);
        } else {
          box.appendChild(h('div', { style: { position: 'absolute', inset: '0', display: 'grid', placeItems: 'center', fontSize: '13px', color: '#6e6e6e', padding: '20px', textAlign: 'center' }, text: 'NVR video-klip · oldin 30 s + hodisa + keyin 30 s — klip filial Edge’dan so‘raladi (kadrlar hali kelmagan)' }));
          box.appendChild(h('div', { style: { position: 'absolute', left: '40%', top: '22%', width: '20%', height: '56%', border: '1.5px solid #60d090', borderRadius: '4px' } }));
          box.appendChild(tag);
        }
        box.appendChild(top);
        return box;
      }

      function detailView(c) {
        var ce = emp(c.empId), st = AI_ST[c.status] || ['mute', c.status], pending = c.status === 'pending' && can && !busy;
        var impact = ce && ce.idleLimit && c.idleImpact
          ? 'Tasdiqlansa idle hisobiga +' + c.idleImpact + ' daq qo‘shiladi: ' + fmtHm(ce.idleUsed) + ' → ' + fmtHm(ce.idleUsed + c.idleImpact) + ' (limit ' + fmtHm(ce.idleLimit) + ')' + (ce.idleUsed + c.idleImpact > ce.idleLimit ? '. Limitdan oshadi — jarima qoidasi P-04 taklif qilinadi.' : '.')
          : c.code === 'CASH_NO_RECEIPT' ? 'Video: kassada pul olindi, lekin shu 40 soniyada FOM’da chek yo‘q. Tasdiqlansa, moliya admin tekshiruviga yuboriladi.'
          : c.code === 'QUEUE_LONG' ? 'Xodimga bog‘lanmagan. Tasdiqlansa, filial mudiriga ikkinchi kassani ochish haqida xabar boradi.' : 'Idle hisobiga ta’sir qilmaydi.';
        function b(label, ic, fn, enabled, cls) { var x = h('button', { class: 'btn ' + (cls || ''), onclick: fn }, ic ? icon(ic) : null, label); x.disabled = !enabled; if (A.readOnly()) x.title = 'Auditor rejimi — faqat o‘qish'; return x; }
        var actions = h('div', { class: 'card pad', style: { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' } },
          b('Tasdiqlash · Y', 'ok', function () { doConfirm(c); }, pending, 'accent'),
          b('Rad etish · N', 'close', function () { doReject(c); }, pending, 'danger'),
          b('Boshqa xodim · B', 'user', function () { doOther(c); }, pending),
          b('Jarima taklif qilish', 'pay', function () { setStatus(c, 'confirmed').then(function () { return penaltyDialog(c); }).catch(function () {}); }, pending && !!c.empId),
          b('Izoh · E', 'info', function () { doNote(c); }, can && !busy, 'subtle'),
          roleIn(ESC_ROLES) ? b('Eskalatsiya', 'warn', function () { doEscalate(c); }, canEsc && !busy, 'subtle') : null,
          h('span', { style: { flex: '1' } }),
          h('button', { class: 'btn subtle', onclick: function () { move(-1); }, title: 'Oldingi (K)' }, '↑ K'),
          h('button', { class: 'btn subtle', onclick: function () { move(1); }, title: 'Keyingi (J)' }, '↓ J'));
        var bars = h('div', { style: { display: 'flex', gap: '3px' } }), col = c.conf >= 85 ? 'var(--accent)' : c.conf >= 60 ? 'var(--warn)' : 'var(--text-2)';
        for (var i = 1; i <= 5; i++) bars.appendChild(h('span', { style: { width: '20px', height: '5px', borderRadius: '2px', background: i <= Math.round(c.conf / 20) ? col : 'rgba(128,128,128,.25)' } }));
        var verdict = c.aiVerdict && VERDICT[c.aiVerdict];
        var info = U.card(null, null, h('div', { style: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' } },
          h('div', null,
            h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, U.pill('info', 'AI ANIQLADI'), h('span', { class: 'mono small', style: { color: 'var(--text-2)' }, text: c.code })),
            h('div', { style: { fontSize: '16px', fontWeight: '600', margin: '6px 0' }, text: c.label }),
            h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, U.pill(st[0], st[1]), verdict ? U.pill(verdict[0], verdict[1]) : null, c.escalated ? U.pill('crit', 'Eskalatsiya qilingan') : null),
            c.aiVerdictNote ? h('div', { class: 'small', style: { color: 'var(--text-2)', marginTop: '6px' }, text: c.aiVerdictNote + (c.aiVerdictModel ? ' · ' + c.aiVerdictModel : '') }) : null),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            h('div', null, h('div', { class: 'small', style: { color: 'var(--text-2)', marginBottom: '6px' }, text: 'AI ishonchi' }), bars),
            h('div', { style: { textAlign: 'right' } }, h('div', { style: { fontSize: '22px', fontWeight: '700' }, text: c.conf + '%' }), h('div', { class: 'small', style: { color: 'var(--text-2)' }, text: confLevel(c.conf) + (c.conf < 60 ? ' · qo‘shimcha tekshiruv' : '') }))),
          h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } },
            h('span', { class: 'avatar' }, ce ? (ce.ini || A.initials(ce.name)) : '—'),
            h('div', null, h('div', { style: { fontWeight: '600' }, text: ce ? ce.name : (c.empId ? c.empId : 'Xodim aniqlanmagan') }), h('div', { class: 'small', style: { color: 'var(--text-2)' }, text: ce ? [ce.position, ce.schedule].filter(Boolean).join(' · ') : 'Hodisa zonaga tegishli' }))),
          U.kvList([['Vaqt', c.date + ' 2026, ' + c.time], ['Davomiylik', c.dur], ['Zona', c.zone], ['Kamera', c.camera], ['Filial', A.branchName(c.branchId)], ['Ustuvorlik', U.pill(PRIO[c.priority] || 'mute', c.priority)]]),
          h('div', { class: 'note', style: { background: 'rgba(128,128,128,.1)', borderRadius: '6px', padding: '10px 12px' }, text: impact }),
          c.note ? h('div', { class: 'small', style: { color: 'var(--text-2)' }, text: 'Izoh: ' + c.note }) : null));
        var transcript = c.code === 'RUDE_SPEECH' ? U.card('Transkripsiya (AI taxmini)', U.pill('mute', 'AUDIO · MAXFIY'), h('div', { class: 'note', style: { padding: '0 16px 14px' } },
          c.transcript ? String(c.transcript) : 'Audio transkripsiya filial Edge’dan keladi; bu hodisa uchun matn mavjud emas.')) : null;
        return h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(280px,1fr)', gap: '12px', alignItems: 'start' } },
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '0' } }, evidence(c), transcript, actions), info);
      }

      function paint() {
        var all = scoped();
        clear(tabBox);
        tabBox.appendChild(U.tabs(['pending', 'confirmed', 'rejected', 'all'].map(function (k) {
          var n = k === 'all' ? all.length : all.filter(function (e) { return e.status === k; }).length;
          return [k, { pending: 'Kutilmoqda', confirmed: 'Tasdiqlangan', rejected: 'Rad etilgan', all: 'Hammasi' }[k] + ' · ' + n];
        }), filter, function (k) { filter = k; sel = null; paint(); }));
        clear(master);
        var l = list(), c = cur(); sel = c ? c.id : null;
        l.forEach(function (e) {
          var en = e.empId ? emp(e.empId) : null;
          master.appendChild(h('div', { class: 'md-item' + (c && e.id === c.id ? ' sel' : ''), role: 'option', onclick: function () { sel = e.id; paint(); } },
            h('div', { class: 'body' }, h('div', { class: 't', text: e.label }),
              h('div', { class: 's', text: (e.empId ? (en ? en.name : e.empId) : 'Xodim biriktirilmagan') }),
              h('div', { class: 's', text: A.branchName(e.branchId) + ' · ' + short(e.camera) + ' · ' + e.date + ' ' + String(e.time || '').slice(0, 5) })),
            h('div', { class: 'end' }, h('div', { style: { fontWeight: '600' }, text: e.conf + '%' }), U.pill(PRIO[e.priority] || 'mute', e.priority),
              e.aiVerdict && VERDICT[e.aiVerdict] ? h('div', { class: 'small', style: { color: 'var(--text-2)' }, text: VERDICT[e.aiVerdict][1] }) : null)));
        });
        if (!l.length) master.appendChild(h('div', { style: { padding: '24px 16px' } }, h('b', { text: filter === 'pending' ? 'Navbat bo‘sh — barcha hodisalar ko‘rib chiqildi' : 'Bu filtrda hodisa yo‘q' }),
          h('div', { class: 'note', style: { marginTop: '6px' }, text: 'Edge-server oflayn bo‘lgan filiallardan hodisa kelmaydi. Yangi hodisa tushganda «Yangilash» tugmasini bosing.' })));
        clear(detail);
        if (c) detail.appendChild(detailView(c)); else detail.appendChild(U.card(null, null, U.empty('Hodisa tanlanmagan', 'ai')));
        if (c && master.querySelector('.sel')) { try { master.querySelector('.sel').scrollIntoView({ block: 'nearest' }); } catch (x) {} }
      }
      function onKey(e) {
        var tag = (e.target && e.target.tagName) || '';
        if (['INPUT', 'TEXTAREA', 'SELECT'].indexOf(tag) >= 0 || dlgOpen() || busy || e.metaKey || e.ctrlKey || e.altKey) return;
        var k = (e.key || '').toLowerCase(), c = cur(), pend = c && c.status === 'pending' && can;
        if (k === 'j') { e.preventDefault(); move(1); }
        else if (k === 'k') { e.preventDefault(); move(-1); }
        else if (k === 'y' && pend) { e.preventDefault(); doConfirm(c); }
        else if (k === 'n' && pend) { e.preventDefault(); doReject(c); }
        else if (k === 'b' && pend) { e.preventDefault(); doOther(c); }
        else if (k === 'e' && c && can) { e.preventDefault(); doNote(c); }
      }
      document.addEventListener('keydown', onKey);
      A._dispose = function () { document.removeEventListener('keydown', onKey); };
      paint();
    });
  };

  // ═════════════ Video devor ═════════════
  A.screens.videowall = function (page, params, ctx) {
    return Promise.all([A.get('/v1/cameras'), A.branchesCached()]).then(function (r) {
      U.guard(ctx);
      var cams = r[0] || [], n = 2, pg = 0, br = params.branch || '', soundId = null, moduleOff = false;
      var tiles = [], talks = [];
      var canTalk = !A.readOnly() && roleIn(CAM_ADMIN);
      page.classList.add('wide');
      var stat = h('span');
      var pager = h('div', { class: 'seg' });
      var wall = h('div', { style: { background: '#101010', borderRadius: '8px', padding: '10px', minHeight: '200px' } });
      var banner = h('div');
      var grid = h('div', { style: { display: 'grid', gap: '6px' } });
      wall.appendChild(grid);
      page.appendChild(U.head('Video devor', 'Video filialdagi NVR’dan · markazga faqat hodisa va klip yuboriladi', [
        U.select(U.branchOptions(true), br, function (v) { br = v; pg = 0; paint(); }, '170px'),
        U.seg([[1, '1'], [2, '4'], [3, '9'], [4, '16']], n, function (v) { n = v; pg = 0; paint(); }), pager,
        h('button', { class: 'btn', onclick: function () { var f = wall.requestFullscreen || wall.webkitRequestFullscreen; if (f) f.call(wall); } }, icon('full'), 'To‘liq ekran'),
        U.refreshBtn()]));
      page.appendChild(h('div', { class: 'small', style: { color: 'var(--text-2)', margin: '-6px 0 10px' } }, stat, ' · Ovoz tugmasi plitkani HD oqimga o‘tkazadi (bir vaqtda bitta) · Esc — to‘liq ekrandan chiqish'));
      page.appendChild(banner); page.appendChild(wall);
      function stopAll() { tiles.forEach(function (t) { t.destroy(); }); tiles = []; talks.forEach(function (t) { t.stop(); }); talks = []; }
      A._dispose = stopAll;
      function onTileErr(e) { if (isModuleOff(e) && !moduleOff) { moduleOff = true; clear(banner); banner.appendChild(moduleInfo()); stopAll(); } }
      function tile(c) {
        var st = camStatus(c), off = st !== 'online';
        var box = h('div', { style: { position: 'relative', aspectRatio: '16 / 9', background: '#181818', borderRadius: '6px', overflow: 'hidden', border: '1px solid ' + (off ? '#303030' : '#2d4a3a') } });
        var media = h('div', { style: { position: 'absolute', inset: '0' } }); box.appendChild(media);
        function center(t) { media.appendChild(h('div', { style: { position: 'absolute', inset: '0', display: 'grid', placeItems: 'center', color: '#6e6e6e', fontSize: '12px', textAlign: 'center', padding: '8px' }, text: t })); }
        if (moduleOff) center('Kameralar moduli o‘chirilgan');
        else if (off) center(st === 'unknown' ? 'Holat noma’lum · Edge 90 s dan beri jim' : 'Signal yo‘q · RTSP uzilgan');
        else if (c.privacy) center('Maxfiylik zonasi · faqat poza tahlili');
        else tiles.push(hlsTile(c, media, { quality: n >= 3 && soundId !== c.id ? 'sub' : 'main', sound: soundId === c.id, onError: onTileErr }));
        var topBar = h('div', { style: { position: 'absolute', left: '0', right: '0', top: '0', display: 'flex', justifyContent: 'space-between', gap: '6px', padding: '6px 8px', fontSize: '11px', color: '#e6e6e6', background: 'linear-gradient(#000b, transparent)', pointerEvents: 'none' } },
          h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, text: A.branchName(c.branchId) + ' · ' + c.name + (c.zones ? ' · ' + c.zones : '') }),
          off ? h('span', { style: { color: '#8a8a8a' }, text: st === 'unknown' ? 'noma’lum' : 'oflayn' }) : h('span', { style: { color: '#ff8787', fontWeight: '700' }, text: '● LIVE' }));
        box.appendChild(topBar);
        if (!off && !c.privacy && !moduleOff) {
          var tools = h('div', { style: { position: 'absolute', left: '6px', bottom: '6px', right: '6px', display: 'flex', gap: '6px', alignItems: 'center' } });
          var aIn = c.audio && c.audio.in;
          var sb = h('button', { class: 'btn subtle', title: aIn ? (soundId === c.id ? 'Ovozsiz' : 'Ovoz (HD oqim)') : 'Kamerada mikrofon yo‘q', style: { background: '#000a', color: '#fff', minWidth: '0', padding: '2px 8px' },
            onclick: function () { soundId = soundId === c.id ? null : c.id; paint(); } }, icon(soundId === c.id ? 'vol' : 'mute'));
          sb.disabled = !aIn;
          tools.appendChild(sb);
          if (canTalk && c.audio && c.audio.out) { var t = talkButton(c.id, true); talks.push(t); t.el.firstChild.style.background = '#000a'; t.el.firstChild.style.color = '#fff'; tools.appendChild(t.el); }
          tools.appendChild(h('span', { style: { flex: '1' } }));
          tools.appendChild(h('button', { class: 'btn subtle', title: 'Kamera sahifasida ochish', style: { background: '#000a', color: '#fff', minWidth: '0', padding: '2px 8px' }, onclick: function () { A.go('cameras', { id: c.id }); } }, icon('ext')));
          box.appendChild(tools);
        }
        return box;
      }
      function paint() {
        stopAll();
        var all = cams.filter(function (c) { return !br || c.branchId === br; });
        var per = n * n, pages = Math.max(1, Math.ceil(all.length / per)); pg = Math.min(pg, pages - 1);
        var onl = all.filter(function (c) { return camStatus(c) === 'online'; }).length;
        stat.textContent = onl + ' / ' + all.length + ' onlayn';
        clear(pager); pager.style.display = pages > 1 ? '' : 'none';
        for (var i = 0; i < pages; i++) (function (i) { pager.appendChild(h('button', { class: i === pg ? 'on' : '', onclick: function () { pg = i; paint(); } }, String(i + 1))); })(i);
        clear(grid); grid.style.gridTemplateColumns = 'repeat(' + n + ', minmax(0,1fr))';
        if (!all.length) { grid.style.gridTemplateColumns = '1fr'; grid.appendChild(h('div', { style: { color: '#8a8a8a', padding: '40px', textAlign: 'center' }, text: 'Kamera yo‘q' })); return; }
        all.slice(pg * per, pg * per + per).forEach(function (c) { grid.appendChild(tile(c)); });
      }
      paint();
    });
  };

  // ═════════════ Kameralar va zonalar ═════════════
  function aiTaskChecks(selected, privacy) {
    var box = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '6px 12px' } }), inputs = {};
    TASKS.forEach(function (t) {
      var cb = h('input', { type: 'checkbox' }); cb.checked = (selected || []).indexOf(t[0]) >= 0; inputs[t[0]] = cb;
      box.appendChild(h('label', { class: 'chk' }, cb, t[1]));
    });
    box.values = function () { return TASKS.map(function (t) { return t[0]; }).filter(function (k) { return inputs[k].checked; }); };
    box.lockPrivacy = function (on) { TASKS.forEach(function (t) { if (t[0] !== 'pose') { inputs[t[0]].disabled = on; if (on) inputs[t[0]].checked = false; } }); };
    if (privacy) box.lockPrivacy(true);
    return box;
  }
  function switchEl(on) {
    var s = h('button', { class: 'switch' + (on ? ' on' : ''), type: 'button', role: 'switch' });
    s.value = !!on; s.onclick = function () { s.value = !s.value; s.classList.toggle('on', s.value); if (s.onchange2) s.onchange2(s.value); };
    return s;
  }
  function testResultText(res) {
    if (!res) return '—';
    if (res.ok) return 'Ulanish muvaffaqiyatli' + [res.resolution, res.codec ? res.codec.toUpperCase() : null, res.fps ? res.fps + ' fps' : null].filter(Boolean).map(function (x) { return ' · ' + x; }).join('');
    return 'Kamera javob bermadi: ' + (res.error || 'noma’lum xato');
  }
  function cameraForm(branches, init, onDone) {
    init = init || {};
    var f = { branchId: init.branchId || (branches[0] && branches[0].id) || '', kind: init.kind || 'rtsp' };
    var brSel = U.select(branches.map(function (b) { return [b.id, b.short || b.name]; }), f.branchId, function (v) { f.branchId = v; }, '100%');
    var name = U.input({ placeholder: '1-kamera', value: init.name }), zone = U.input({ placeholder: 'Kassa, zal, ombor…' });
    var rtsp = U.input({ placeholder: 'rtsp://admin:parol@192.168.1.64:554/Streaming/Channels/101' });
    var oh = U.input({ placeholder: '192.168.1.64', value: init.host }), op = U.input({ placeholder: '80', value: init.port ? String(init.port) : '', num: true }), ou = U.input({ placeholder: 'admin' }), ow = U.input({ type: 'password' });
    var priv = switchEl(false), rec = switchEl(true), tasks = aiTaskChecks([], false), er = h('div', { class: 'err' }), testOut = h('div', { class: 'note' });
    priv.onchange2 = function (v) { tasks.lockPrivacy(v); };
    var rtspBox = h('div', null, U.field('RTSP', rtsp, 'Kameraning asosiy oqimi (login va parol bilan). Faqat Edge’ga yuboriladi.'));
    var onvifBox = h('div', { class: 'form-grid' }, U.field('ONVIF host', oh), U.field('Port', op), U.field('Login', ou), U.field('Parol', ow));
    var devBox = h('p', { class: 'note', text: 'Edge serverga to‘g‘ridan-to‘g‘ri ulangan qurilma — manzil kerak emas.' });
    function showKind() { rtspBox.style.display = f.kind === 'rtsp' ? '' : 'none'; onvifBox.style.display = f.kind === 'onvif' ? '' : 'none'; devBox.style.display = f.kind === 'device' ? '' : 'none'; }
    var kindSeg = U.seg([['rtsp', 'RTSP'], ['onvif', 'ONVIF'], ['device', 'Edge qurilmasi']], f.kind, function (v) { f.kind = v; showKind(); });
    function onvifVal() { var o = { host: oh.value.trim(), username: ou.value.trim(), password: ow.value }; var p = parseInt(op.value, 10); if (p) o.port = p; return o; }
    function validate(forTest) {
      if (!f.branchId) return 'Filialni tanlang.';
      if (!forTest && !name.value.trim()) return 'Nomi majburiy.';
      if (!forTest && !zone.value.trim()) return 'Zona majburiy.';
      if (f.kind === 'rtsp' && !/^rtsps?:\/\//.test(rtsp.value.trim())) return 'RTSP manzil rtsp:// yoki rtsps:// bilan boshlanishi kerak.';
      if (f.kind === 'onvif') { var o = onvifVal(); if (!o.host || !o.username || !o.password) return 'ONVIF host, login va parol majburiy.'; }
      return '';
    }
    var testBtn = h('button', { class: 'btn', type: 'button', onclick: function () {
      var v = validate(true); if (v) { er.textContent = v; return; } er.textContent = '';
      if (f.kind === 'device') { testOut.textContent = 'Edge qurilmasini saqlangandan keyin sinab ko‘ring.'; return; }
      var input = { branchId: f.branchId }; if (f.kind === 'rtsp') input.rtspUrl = rtsp.value.trim(); else input.onvif = onvifVal();
      testBtn.disabled = true; testOut.textContent = 'Edge kamerani ochishga urinmoqda…';
      A.cmd('cameras.test', input).then(function (res) { testOut.textContent = testResultText(res); testOut.style.color = res && res.ok ? 'var(--ok)' : 'var(--crit)'; })
        .catch(function (e) { testOut.textContent = camErr(e); testOut.style.color = 'var(--crit)'; }).then(function () { testBtn.disabled = false; });
    } }, icon('http'), 'Sinab ko‘rish');
    showKind();
    var body = h('div', null, h('p', { class: 'note', text: 'Edge bir daqiqa ichida kamerani ulaydi' }),
      h('div', { class: 'form-grid' }, U.field('Filial', brSel), U.field('Nomi', name), U.field('Zona', zone)),
      U.field('Ulanish turi', kindSeg), rtspBox, onvifBox, devBox,
      U.field('AI vazifalar', tasks),
      h('div', { style: { display: 'flex', gap: '24px', margin: '8px 0' } }, h('label', { class: 'chk' }, priv, 'Maxfiy kamera (faqat poza)'), h('label', { class: 'chk' }, rec, 'Yozib olish')),
      h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, testBtn, testOut), er);
    return A.dialog({ title: 'Kamera qo‘shish', primary: 'Kamera qo‘shish', body: body, onPrimary: function () {
      var v = validate(false); if (v) { er.textContent = v; return false; }
      var input = { branchId: f.branchId, name: name.value.trim(), zone: zone.value.trim(), kind: f.kind, aiTasks: tasks.values(), privacy: !!priv.value, recording: !!rec.value };
      if (f.kind === 'rtsp') input.rtspUrl = rtsp.value.trim(); if (f.kind === 'onvif') input.onvif = onvifVal();
      return A.cmd('cameras.create', input).then(function (c) { A.toast('ok', 'Kamera qo‘shildi — Edge bir daqiqada ulaydi'); if (onDone) onDone(c); return true; })
        .catch(function (e) { er.textContent = e.status === 409 ? 'Bu qurilma filialga allaqachon qo‘shilgan' + (e.details && e.details[0] && e.details[0].cameraId ? ' (' + e.details[0].cameraId + ')' : '') + '.' : camErr(e); return false; });
    } });
  }

  A.screens.cameras = function (page, params, ctx) {
    return Promise.all([A.get('/v1/cameras'), A.get('/v1/branches').then(function (b) { A.state.branches = b; return b; }).catch(function () { return A.branchesCached(); })]).then(function (r) {
      U.guard(ctx);
      var cams = r[0] || [], branches = r[1] || [], br = params.branch || '', stf = '', q = '', sel = params.id || null, player = null;
      var admin = canCamAdmin(), canTest = !A.readOnly() && roleIn(CAM_TEST);
      var myBranches = A.role() === 'MANAGER' && A.state.me && A.state.me.branchId ? branches.filter(function (b) { return b.id === A.state.me.branchId; }) : branches;
      page.classList.add('wide');
      var online = cams.filter(function (c) { return camStatus(c) === 'online'; }).length;
      function reload(id) { if (id) sel = id; A.get('/v1/cameras').then(function (c) { cams = c || []; paint(); }).catch(function (e) { A.toast('crit', 'Yangilab bo‘lmadi', e.error || String(e)); }); }
      var addBtn = U.ro(h('button', { class: 'btn accent', onclick: function () { cameraForm(myBranches, null, function (c) { reload(c && c.id); }); } }, icon('plus'), 'Kamera qo‘shish'));
      var discBtn = U.ro(h('button', { class: 'btn', onclick: discover }, icon('search'), 'ONVIF qidirish'));
      if (!admin) { addBtn.disabled = true; discBtn.disabled = true; if (!A.readOnly()) { addBtn.title = discBtn.title = 'Faqat Egasi, Super admin va filial mudiri'; } }
      page.appendChild(U.head('Kameralar va zonalar', online + ' / ' + cams.length + ' onlayn · AI nazorat', [
        U.select(U.branchOptions(true), br, function (v) { br = v; paint(); }, '170px'),
        U.seg([['', 'Hammasi'], ['online', 'Onlayn'], ['offline', 'Oflayn'], ['unknown', 'Noma’lum']], '', function (v) { stf = v; paint(); }),
        U.search('Kamera, zona…', function (v) { q = v; paint(); }, '200px'), discBtn, addBtn, U.refreshBtn()]));
      var listBox = h('div'), detailBox = h('div');
      page.appendChild(listBox); page.appendChild(detailBox);
      A._dispose = function () { if (player) player.destroy(); player = null; };

      function discover() {
        var bsel = myBranches[0] ? myBranches[0].id : '', out = h('div', { style: { minHeight: '80px' } }), sec = U.input({ value: '8', num: true, attrs: { style: 'width:80px' } });
        var runBtn = h('button', { class: 'btn accent', type: 'button', onclick: go }, icon('search'), 'Qidirish');
        function go() {
          var t = Math.max(1, Math.min(30, parseInt(sec.value, 10) || 8));
          runBtn.disabled = true; clear(out); out.appendChild(h('div', { class: 'note' }, h('span', { class: 'ring sm' }), ' Edge filial tarmog‘ida ONVIF qurilmalarni qidirmoqda (' + t + ' s)…'));
          A.cmd('cameras.discover', { branchId: bsel, timeoutSec: t }).then(function (list) {
            clear(out);
            if (!list || !list.length) { out.appendChild(U.empty('Qurilma topilmadi', 'cam')); return; }
            out.appendChild(U.table([
              { t: 'Qurilma', render: function (d) { return h('div', null, h('b', { text: d.name || d.model || d.host }), h('div', { class: 'small', style: { color: 'var(--text-2)' }, text: [d.manufacturer, d.model].filter(Boolean).join(' · ') })); } },
              { t: 'Manzil', render: function (d) { return d.host + ':' + d.port; } },
              { t: '', r: true, render: function (d) { return d.alreadyAdded ? U.pill('mute', 'qo‘shilgan') : h('button', { class: 'btn', onclick: function () { var p = document.querySelector('#dlg .foot .btn:not(.accent)'); if (p) p.click(); setTimeout(function () { cameraForm(myBranches, { branchId: bsel, kind: 'onvif', host: d.host, port: d.port, name: d.name || d.model }, function (c) { reload(c && c.id); }); }, 50); } }, icon('plus'), 'Qo‘shish'); } }
            ], list, { bare: true }));
          }).catch(function (e) { clear(out); out.appendChild(A.infobar(isModuleOff(e) ? 'info' : 'crit', isEdgeOff(e) ? 'Edge oflayn.' : 'Qidirib bo‘lmadi.', ' ' + camErr(e))); })
            .then(function () { runBtn.disabled = false; });
        }
        A.dialog({ title: 'ONVIF qidirish', primary: 'Yopish', secondary: false, body: h('div', { style: { minWidth: '560px' } },
          h('p', { class: 'note', text: 'Filial Edge serveri mahalliy tarmoqda WS-Discovery orqali kameralarni qidiradi.' }),
          h('div', { style: { display: 'flex', gap: '10px', alignItems: 'end', marginBottom: '12px' } },
            U.field('Filial', U.select(myBranches.map(function (b) { return [b.id, b.short || b.name]; }), bsel, function (v) { bsel = v; }, '200px')), U.field('Kutish, s', sec), runBtn), out) });
      }
      function editDialog(c) {
        var name = U.input({ value: c.name }), zone = U.input({ value: c.zones }), tasks = aiTaskChecks(c.aiTasks || [], c.privacy), rec = switchEl(c.recording !== false);
        var rtsp = U.input({ placeholder: 'o‘zgartirmaslik uchun bo‘sh qoldiring' }), er = h('div', { class: 'err' });
        return A.dialog({ title: 'Kamerani tahrirlash — ' + c.name, primary: 'Saqlash', body: h('div', null,
          h('div', { class: 'form-grid' }, U.field('Nomi', name), U.field('Zona', zone, 'Kassa, zal, ombor…')),
          U.field('AI vazifalar', tasks, c.privacy ? 'Maxfiy kamerada faqat «Poza» vazifasi ruxsat etiladi.' : null),
          h('label', { class: 'chk', style: { margin: '8px 0' } }, rec, 'Yozib olish'),
          c.kind !== 'device' && c.kind !== 'onvif' ? U.field('Yangi RTSP manzil', rtsp, 'Yuborilsa saqlangan login/parol almashtiriladi (audit: maxfiy).') : null, er),
          onPrimary: function () {
            var input = { id: c.id }, nm = name.value.trim(), zn = zone.value.trim();
            if (!nm || !zn) { er.textContent = 'Nomi va zona majburiy.'; return false; }
            if (nm !== c.name) input.name = nm; if (zn !== c.zones) input.zone = zn;
            input.aiTasks = tasks.values(); input.recording = !!rec.value;
            var ru = rtsp.value.trim(); if (ru) { if (!/^rtsps?:\/\//.test(ru)) { er.textContent = 'RTSP manzil rtsp:// bilan boshlanishi kerak.'; return false; } input.rtspUrl = ru; }
            return A.cmd('cameras.update', input).then(function () { A.toast('ok', 'Saqlandi va Edge-serverga yuborildi.'); reload(c.id); return true; }).catch(function (e) { er.textContent = camErr(e); return false; });
          } });
      }
      function privacyDialog(c) {
        var to = !c.privacy;
        U.prompt(to ? 'Maxfiy kamera qilish' : 'Maxfiylikni olib tashlash', 'Sabab (kamida 3 belgi)', {
          text: to ? 'Maxfiy kamerada jonli ko‘rish o‘chiriladi, AI faqat poza tahlilini bajaradi va kadrlar AI tekshiruviga yuborilmaydi.' : 'Kamera uchun jonli ko‘rish va barcha AI vazifalar qayta ruxsat etiladi.',
          required: true, primary: to ? 'Maxfiy qilish' : 'Olib tashlash' }).then(function (reason) {
          if (!reason) return;
          if (reason.length < 3) { A.toast('crit', 'Sabab kamida 3 belgi bo‘lishi kerak'); return; }
          A.cmd('cameras.setPrivacy', { id: c.id, privacy: to, reason: reason }).then(function () { A.toast('ok', to ? 'Kamera maxfiy qilindi' : 'Maxfiylik olib tashlandi'); reload(c.id); })
            .catch(function (e) { A.toast('crit', 'Bajarilmadi', camErr(e)); });
        });
      }
      function testCam(c, btn) {
        btn.disabled = true;
        A.cmd('cameras.test', { id: c.id }).then(function (res) { A.toast(res && res.ok ? 'ok' : 'crit', c.name, testResultText(res)); })
          .catch(function (e) { A.toast(isModuleOff(e) ? 'info' : 'crit', 'Sinov bajarilmadi', camErr(e)); }).then(function () { btn.disabled = false; });
      }
      function openLive(c, host) {
        if (player) player.destroy(); clear(host);
        player = U.viewer(c, host, function () { player = null; clear(host); });
      }
      function detail(c) {
        if (player) { player.destroy(); player = null; }
        clear(detailBox); if (!c) return;
        var st = camStatus(c), sp = STATUS_PILL[st] || ['mute', st], b = branches.find(function (x) { return x.id === c.branchId; }), edgeOn = b ? b.edge === 'online' : null;
        var liveHost = h('div');
        var liveBtn = h('button', { class: 'btn accent', onclick: function () { openLive(c, liveHost); } }, icon('live'), 'Jonli ko‘rish');
        if (st !== 'online' || c.privacy) { liveBtn.disabled = true; liveBtn.title = c.privacy ? 'Maxfiy kamera — jonli ko‘rish mavjud emas' : 'Kamera onlayn emas'; }
        var testBtn = h('button', { class: 'btn' }, icon('http'), 'Sinab ko‘rish'); testBtn.onclick = function () { testCam(c, testBtn); }; if (!canTest) { testBtn.disabled = true; }
        var editBtn = h('button', { class: 'btn', onclick: function () { editDialog(c); } }, icon('gear'), 'Tahrirlash');
        var privBtn = h('button', { class: 'btn', onclick: function () { privacyDialog(c); } }, icon('key'), c.privacy ? 'Maxfiylikni olib tashlash' : 'Maxfiy qilish');
        if (!admin) { editBtn.disabled = privBtn.disabled = true; editBtn.title = privBtn.title = A.readOnly() ? 'Auditor rejimi — faqat o‘qish' : 'Faqat Egasi, Super admin va filial mudiri'; }
        var zones = String(c.zones || '').split(/\s*[,;]\s*/).filter(Boolean);
        var info = U.card('Kamera ma’lumotlari', U.pill(sp[0], sp[1]), h('div', { style: { padding: '0 16px 14px' } }, U.kvList([
          ['Nomi', c.name], ['Filial', A.branchName(c.branchId)], ['Edge', edgeOn == null ? '—' : edgeOn ? 'Edge online' : 'Edge offline'],
          ['Ulanish', c.kind ? c.kind.toUpperCase() : null], ['Host', c.host], ['RTSP', U.pill((HS[c.rtsp] || ['mute'])[0], 'RTSP ' + ((HS[c.rtsp] || [0, c.rtsp])[1]))],
          ['NVR', U.pill((HS[c.nvr] || ['mute'])[0], 'NVR ' + ((HS[c.nvr] || [0, c.nvr])[1]))], ['FPS', c.fps ? c.fps + ' fps' : '—'], ['Bitreyt', c.bitrateKbps ? A.num(c.bitrateKbps) + ' kbit/s' : null],
          ['Oxirgi kadr', c.last], ['Yozib olish', c.recording === false ? 'o‘chiq' : c.recording ? 'yoqilgan' : null],
          ['Maxfiylik', c.privacy ? U.pill('warn', 'Maxfiy · faqat poza') : 'yo‘q'],
          ['Audio', c.audio ? [c.audio.in ? 'mikrofon' : null, c.audio.out ? 'karnay' : null].filter(Boolean).join(' + ') || 'yo‘q' : null]])));
        var zoneCard = U.card('Zonalar va AI vazifalar', null, h('div', { style: { padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: '10px' } },
          h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, zones.length ? zones.map(function (z) { return U.pill('info', z); }) : h('span', { class: 'note', text: 'Zona belgilanmagan' })),
          h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, (c.aiTasks && c.aiTasks.length ? c.aiTasks.map(function (t) { return U.pill('ok', taskLabel(t)); }) : [h('span', { class: 'note', text: c.ai || 'AI vazifa yo‘q' })])),
          h('div', { class: 'note', text: c.privacy ? 'Tanaffus · idle hisoblanmaydi. Maxfiy kamerada video ko‘rsatilmaydi.' : 'Zona va vazifalarni «Tahrirlash» orqali o‘zgartiring — Edge’ga yuboriladi.' })));
        detailBox.appendChild(h('div', { class: 'section-title', text: c.name }));
        detailBox.appendChild(h('div', { class: 'toolbar', style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' } }, liveBtn, testBtn, editBtn, privBtn));
        if (edgeOn === false) detailBox.appendChild(A.infobar('warn', 'Edge offline.', ' Filial Edge serveri oflayn — jonli ko‘rish, sinov va qidiruv ishlamaydi.'));
        detailBox.appendChild(liveHost);
        detailBox.appendChild(h('div', { class: 'grid g2' }, info, zoneCard));
      }
      function paint() {
        clear(listBox);
        var shown = cams.filter(function (c) {
          var st = camStatus(c);
          if (br && c.branchId !== br) return false;
          if (stf && st !== stf) return false;
          if (q && [c.name, c.zones, c.ai, c.host].join(' ').toLowerCase().indexOf(q) < 0) return false;
          return true;
        });
        var cur = cams.find(function (c) { return c.id === sel; }) || shown[0] || null; sel = cur ? cur.id : null;
        listBox.appendChild(U.table([
          { t: 'Kamera', render: function (c) { return h('div', null, h('b', { text: c.name }), c.privacy ? h('span', { style: { marginLeft: '6px' } }, U.pill('warn', 'maxfiy')) : null); } },
          { t: 'Filial', w: '130px', render: function (c) { return A.branchName(c.branchId); } },
          { t: 'RTSP', w: '120px', render: function (c) { var x = HS[c.rtsp] || ['mute', c.rtsp]; return U.pill(x[0], x[1]); } },
          { t: 'NVR', w: '120px', render: function (c) { var x = HS[c.nvr] || ['mute', c.nvr]; return U.pill(x[0], x[1]); } },
          { t: 'FPS', w: '70px', r: true, render: function (c) { return c.fps ? c.fps + ' fps' : '—'; } },
          { t: 'Kadr', w: '80px', muted: true, k: 'last' },
          { t: 'AI vazifalar', clip: true, render: function (c) { return c.ai || (c.aiTasks || []).map(taskLabel).join(', '); } },
          { t: 'Holat', w: '110px', render: function (c) { var s = STATUS_PILL[camStatus(c)] || ['mute', c.status]; return U.pill(c.health === 'warn' && s[0] === 'ok' ? 'warn' : s[0], s[1]); } }
        ], shown, { empty: 'Kamera topilmadi', emptyIcon: 'cam', onRow: function (c) { sel = c.id; paint(); } }));
        var rows = listBox.querySelectorAll('tbody tr');
        shown.forEach(function (c, i) { if (c.id === sel && rows[i]) rows[i].style.background = 'var(--accent-bg, rgba(0,120,212,.1))'; });
        detail(cur);
      }
      paint();
    });
  };

  // ═════════════ Jonli filial ═════════════
  var EMP_ST = { 'ishda': 'ok', 'tanaffus': 'warn', 'kech qoldi': 'warn', 'kelmadi': 'crit', 'kasal': 'info', 'ta’til': 'mute', 'dam olish': 'mute' };
  function zoneOf(e) {
    if (e.status === 'tanaffus') return 'Dam olish';
    if (e.status !== 'ishda' && e.status !== 'kech qoldi') return null;
    if (e.position === 'Kassir') return 'Kassa';
    if (e.position === 'Omborchi') return 'Ombor';
    return 'Zal';
  }
  A.screens.live = function (page, params, ctx) {
    var timer = null;
    A._dispose = function () { clearInterval(timer); timer = null; };
    function load() {
      return Promise.all([A.get('/v1/branches'), safe(A.get('/v1/employees'), []), safe(A.get('/v1/cameras'), []), safe(A.get('/v1/aiEvents'), [])]);
    }
    return load().then(function (r) {
      U.guard(ctx);
      A.state.branches = r[0];
      var data = r, bid = params.branch || (A.state.me && A.state.me.branchId) || ((r[0] || [])[0] || {}).id || '', updated = new Date();
      page.classList.add('wide');
      var stamp = h('span');
      var titleT = h('span', { text: 'Jonli filial' });
      var liveDot = h('span', { style: { color: 'var(--crit)', fontWeight: '700', fontSize: '12px', marginLeft: '8px' }, text: '● JONLI' });
      var headEl = U.head('Jonli filial', null, [
        U.select(U.branchOptions(false), bid, function (v) { bid = v; paint(); }, '200px'),
        h('button', { class: 'btn', onclick: refresh }, icon('refresh'), 'Yangilash')]);
      var h1 = headEl.querySelector('h1'); clear(h1); h1.appendChild(titleT); h1.appendChild(liveDot);
      headEl.firstChild.appendChild(h('div', { class: 'sub' }, stamp, ' · har 30 soniyada avtomatik yangilanadi'));
      page.appendChild(headEl);
      var body = h('div'); page.appendChild(body);
      function refresh() {
        if (!ctx.isCurrent()) { clearInterval(timer); return; }
        load().then(function (x) { if (!ctx.isCurrent()) return; data = x; A.state.branches = x[0]; updated = new Date(); paint(); })
          .catch(function (e) { if (!ctx.isCurrent()) return; stamp.textContent = 'Yangilab bo‘lmadi: ' + (e.error || e) + ' · oxirgi: ' + A.hhmm(updated); });
      }
      timer = setInterval(refresh, 30000);
      function paint() {
        clear(body);
        stamp.textContent = 'Yangilandi ' + A.hhmm(updated);
        var branches = data[0] || [], b = branches.find(function (x) { return x.id === bid; }) || branches[0];
        if (!b) { body.appendChild(U.card(null, null, U.empty('Filial yo‘q', 'branch'))); return; }
        var emps = (data[1] || []).filter(function (e) { return e.branchId === b.id; });
        var cams = (data[2] || []).filter(function (c) { return c.branchId === b.id; });
        var evs = (data[3] || []).filter(function (e) { return e.branchId === b.id && e.status === 'pending'; });
        var inside = emps.filter(zoneOf);
        titleT.textContent = 'Jonli filial · ' + b.name;
        if (b.edge !== 'online') body.appendChild(A.infobar('crit', 'Edge-server offline — jonli joylashuv mavjud emas.', ' Xodimlar davomati mobil check-in orqali olinmoqda; kamera va AI ma’lumotlari kelmaydi.'));
        var camOn = cams.filter(function (c) { return camStatus(c) === 'online'; }).length;
        body.appendChild(h('div', { class: 'grid g4', style: { marginBottom: '12px' } },
          U.kpi('Filialda xodim', { v: (emps.length ? inside.length : (b.onShift || 0)) + ' / ' + (emps.length || b.employees || 0), u: '' }, { icon: 'people', foot: 'smenada: ' + (b.onShift != null ? b.onShift : '—') }),
          U.kpi('Mijozlar (bugun)', { v: A.num(b.traffic), u: '' }, { icon: 'user', foot: b.conversion != null ? 'konversiya ' + b.conversion + '%' : null }),
          U.kpi('Navbat (kassa)', { v: String(b.queue != null ? b.queue : '—'), u: 'kishi' }, { icon: 'clock', foot: b.desks ? b.desks + ' ta kassa' : null }),
          U.kpi('Kameralar', { v: (cams.length ? camOn : (b.camerasOnline || 0)) + ' / ' + (cams.length || b.cameras || 0), u: '' }, { icon: 'cam', foot: b.edge === 'online' ? 'Edge online' : 'Edge offline' })));
        // Zonalar xaritasi
        var zoneNames = ['Kirish', 'Kassa', 'Zal', 'Ombor', 'Dam olish'];
        var map = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px', padding: '0 16px 16px' } });
        zoneNames.forEach(function (z) {
          var here = emps.filter(function (e) { return zoneOf(e) === z; });
          var zc = cams.filter(function (c) { return String(c.zones || '').indexOf(z) >= 0; });
          var cust = z === 'Kassa' ? (b.queue || 0) : null;
          var chips = h('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' } });
          here.forEach(function (e) { chips.appendChild(h('span', { class: 'avatar sm', title: e.name + ' · ' + e.status, style: { background: e.status === 'tanaffus' ? 'var(--warn)' : 'var(--accent)', color: '#fff' }, text: e.ini || A.initials(e.name) })); });
          if (!here.length) chips.appendChild(h('span', { class: 'small', style: { color: 'var(--text-2)' }, text: 'xodim yo‘q' }));
          map.appendChild(h('div', { style: { border: '1px solid rgba(128,128,128,.3)', borderRadius: '8px', padding: '10px 12px', minHeight: '80px' } },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '6px', fontSize: '12px' } }, h('b', { text: z }),
              h('span', { style: { color: 'var(--text-2)' }, text: [cust ? cust + ' mijoz' : null, zc.length ? zc.length + ' kamera' : null].filter(Boolean).join(' · ') })), chips));
        });
        var empList = h('div', { style: { padding: '0 16px 10px' } });
        emps.forEach(function (e) {
          var z = zoneOf(e);
          empList.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(128,128,128,.18)' } },
            h('span', { class: 'avatar sm', text: e.ini || A.initials(e.name) }),
            h('div', { style: { flex: '1', minWidth: '0' } }, h('div', { style: { fontWeight: '600' }, text: e.name }), h('div', { class: 'small', style: { color: 'var(--text-2)' }, text: (e.position || '') + ' · ' + (z || 'Filialda emas') + (e.schedule ? ' · ' + e.schedule : '') })),
            U.pill(EMP_ST[e.status] || 'mute', e.status || '—')));
        });
        if (!emps.length) empList.appendChild(U.empty('Xodimlar ma’lumoti mavjud emas', 'people'));
        var camList = h('div', { style: { padding: '0 16px 10px' } });
        cams.forEach(function (c) {
          var s = STATUS_PILL[camStatus(c)] || ['mute', c.status];
          camList.appendChild(h('div', { class: 'list-item', style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', cursor: 'pointer', borderBottom: '1px solid rgba(128,128,128,.18)' }, onclick: function () { if (A.can('cameras')) A.go('cameras', { id: c.id }); } },
            icon('cam'), h('div', { style: { flex: '1', minWidth: '0' } }, h('div', { text: c.name }), h('div', { class: 'small', style: { color: 'var(--text-2)' }, text: c.ai || '' })),
            c.privacy ? U.pill('warn', 'maxfiy') : null, U.pill(s[0], s[1])));
        });
        if (!cams.length) camList.appendChild(U.empty('Kamera yo‘q', 'cam'));
        var evList = h('div', { style: { padding: '0 16px 10px' } });
        evs.slice(0, 6).forEach(function (e) {
          evList.appendChild(h('div', { style: { display: 'flex', gap: '10px', padding: '7px 0', cursor: 'pointer', borderBottom: '1px solid rgba(128,128,128,.18)' }, onclick: function () { if (A.can('ai')) A.go('ai', { id: e.id, branch: b.id }); } },
            h('div', { style: { flex: '1', minWidth: '0' } }, h('div', { text: e.label }), h('div', { class: 'small', style: { color: 'var(--text-2)' }, text: short(e.camera) + ' · ' + e.time })),
            U.pill(PRIO[e.priority] || 'mute', e.conf + '%')));
        });
        if (!evs.length) evList.appendChild(U.empty('Kutilayotgan AI hodisa yo‘q', 'ok'));
        var info = U.kvList([['Manzil', b.address], ['Ish vaqti', b.hours], ['Mudir', b.manager], ['FOM', b.fom ? (b.fom.status === 'ok' ? 'ulangan' : b.fom.status === 'delay' ? 'kechikmoqda' : 'uzilgan') + ' · ' + b.fom.lag : null], ['Salomatlik', b.health != null ? b.health + ' / 100' : null]]);
        body.appendChild(h('div', { class: 'grid g21' },
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '0' } },
            U.card('Zonalar bo‘yicha joylashuv', b.edge === 'online' ? U.pill('ok', 'Edge online') : U.pill('crit', 'Edge offline'), map),
            U.card('Kameralar', A.can('videowall') ? h('button', { class: 'btn subtle', onclick: function () { A.go('videowall', { branch: b.id }); } }, icon('wall'), 'Video devor') : null, camList),
            U.card('AI hodisalar (kutilmoqda)', evs.length ? U.pill('warn', evs.length + ' ta') : null, evList)),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '0' } },
            U.card('Smenadagi xodimlar', U.pill('info', inside.length + ' / ' + emps.length), empList),
            U.card('Filial', null, h('div', { style: { padding: '0 16px 14px' } }, info)))));
      }
      paint();
    });
  };
})();
