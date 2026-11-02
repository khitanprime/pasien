// Halaman konsultasi pasien. Semua teks dari server dirender dengan textContent (tidak pernah innerHTML).
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const SS = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }, del(k) { try { sessionStorage.removeItem(k); } catch (e) {} } };
  const S = { token: '', kode: '', seq: 0, pend: [], shown: {}, fotoUrl: {}, timer: 0, idle: 0, busy: false, foto: '', gen: 0 };
  const ok = () => /^https:\/\/script\.google\.com\/.+\/exec$/.test(String(GAS_URL || ''));
  const rid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2);

  async function api(action, data, token, reqId, timeout) {
    if (!ok()) throw { code: 'CFG', message: 'Alamat server belum diisi. Hubungi klinik.' };
    const c = new AbortController(), tm = setTimeout(() => c.abort(), timeout || 25000);
    try {
      const r = await fetch(GAS_URL, { method: 'POST', redirect: 'follow', cache: 'no-store', signal: c.signal, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, token: token || '', reqId: reqId || '', data: data || {} }) });
      let j; try { j = JSON.parse(await r.text()); } catch (e) { throw { code: 'NET', message: 'Koneksi bermasalah.' }; }
      return j;
    } catch (e) { if (e && e.code) throw e; throw { code: 'NET', message: 'Koneksi bermasalah.' }; } finally { clearTimeout(tm); }
  }
  const view = n => { ['login', 'chat', 'selesai', 'verif'].forEach(x => { $(x).hidden = n !== x; }); };
  const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // ---------- Masuk ----------
  function fromUrl() {
    const u = new URL(location.href); let k = u.searchParams.get('k') || u.hash.replace(/^#\/?/, '');
    if (k) { SS.set('kp_kode', norm(k)); history.replaceState(null, '', location.pathname); } // kode tidak tertinggal di URL/riwayat
    return SS.get('kp_kode') || '';
  }
  async function masuk(kode, pin) {
    const r = await api('konsulMasuk', { k: kode, pin: pin });
    if (!r.success) { if (r.data && r.data.selesai) throw { selesai: true, message: r.message }; throw { message: r.message || 'Gagal masuk.' }; }
    return r.data;
  }
  $('fLogin').addEventListener('submit', async ev => {
    ev.preventDefault(); const b = $('bMasuk'), e = $('eLogin'); e.textContent = ''; b.disabled = true; b.textContent = 'Memeriksa…';
    try { const d = await masuk(norm($('kode').value), $('pin').value.replace(/\D/g, '')); S.kode = norm($('kode').value); SS.set('kp_kode', S.kode); $('pin').value = ''; start(d); }
    catch (x) { if (x.selesai) { SS.del('kp_tok'); SS.del('kp_ctx'); SS.del('kp_kode'); S.kode = ''; $('pin').value = ''; $('selesaiMsg').textContent = x.message; view('selesai'); } else e.textContent = x.message || 'Gagal masuk.'; } finally { b.disabled = false; b.textContent = 'Masuk'; }
  });
  $('pin').addEventListener('input', () => { $('pin').value = $('pin').value.replace(/\D/g, '').slice(0, 4); });

  function keluar(msg) {
    clearTimeout(S.timer); S.gen++; Object.values(S.fotoUrl).forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
    Object.assign(S, { token: '', seq: 0, pend: [], shown: {}, fotoUrl: {}, foto: '' }); SS.del('kp_tok'); SS.del('kp_ctx'); $('list').textContent = ''; setFoto('');
    $('kode').value = S.kode || ''; $('eLogin').textContent = msg || ''; view('login'); (S.kode ? $('pin') : $('kode')).focus();
  }
  $('bKeluar').addEventListener('click', () => { SS.del('kp_kode'); S.kode = ''; keluar(''); });

  // ---------- Percakapan ----------
  function start(d) {
    S.token = d.token; S.gen++; SS.set('kp_tok', d.token); SS.set('kp_ctx', JSON.stringify({ nama: d.nama, cabang: d.cabang, retensi: d.retensi }));
    $('hNama').textContent = 'Pasca Khitan · ' + d.nama; $('hSub').textContent = d.cabang || KLINIK_NAMA;
    $('note').textContent = 'Percakapan dihapus otomatis ' + (d.retensi || 90) + ' hari setelah pesan terakhir.';
    view('chat'); S.seq = 0; S.shown = {}; $('list').textContent = ''; render(d.pesan || [], true); S.seq = d.seq || 0; S.idle = 0; schedule(); $('teks').focus();
  }
  const fmtT = ms => { const d = new Date(ms); return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); };
  const fmtD = ms => new Date(ms).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  function render(msgs) {
    const list = $('list'), near = list.scrollHeight - list.scrollTop - list.clientHeight < 120; let added = 0;
    msgs.forEach(m => {
      if (S.shown['s' + m.seq]) return; S.shown['s' + m.seq] = 1; added++;
      // pesan sendiri yang sudah tersimpan: buang gelembung "menunggu" yang sama
      if (m.dari === 'pasien') { const i = S.pend.findIndex(p => p.rid === m.rid || (!p.err && p.teks === m.teks && !!p.foto === !!m.foto)); if (i > -1) { S.pend[i].el.remove(); S.pend.splice(i, 1); } }
      const last = list.querySelector('.m:last-of-type'), prevT = list.dataset.lastT ? +list.dataset.lastT : 0;
      if (!prevT || new Date(prevT).toDateString() !== new Date(m.waktu).toDateString()) { const d = document.createElement('div'); d.className = 'day'; d.textContent = fmtD(m.waktu); list.appendChild(d); }
      list.dataset.lastT = m.waktu; list.appendChild(bubble(m));
    });
    const e = list.querySelector('.empty'); if (e && added) e.remove();
    if (!list.children.length) { const e2 = document.createElement('div'); e2.className = 'empty'; e2.textContent = 'Belum ada pesan. Kirim foto luka atau tulis keluhan Anda, petugas klinik akan membalas.'; list.appendChild(e2); }
    if (added && (near || S.first !== false)) list.scrollTop = list.scrollHeight;
    return added;
  }
  function bubble(m, pend) {
    if (m.resep) return resepBubble(m);
    const el = document.createElement('div'), me = m.dari === 'pasien'; el.className = 'm ' + (me ? 'me' : 'them') + (pend ? ' pending' : '');
    if (!me) { const w = document.createElement('span'); w.className = 'who'; w.textContent = (m.nama || 'Klinik'); el.appendChild(w); }
    if (m.foto) { const ph = document.createElement('span'); ph.className = 'ph'; ph.textContent = 'Memuat foto…'; el.appendChild(ph); loadFoto(m.foto, ph, pend ? m.foto : null); }
    if (m.teks) { const t = document.createElement('span'); t.textContent = m.teks; el.appendChild(t); }
    const tm = document.createElement('time'); tm.textContent = pend ? 'Mengirim…' : fmtT(m.waktu); el.appendChild(tm); return el;
  }
  // ---------- Resep ----------
  function resepBubble(m) {
    if (m.teks === '[Resep dibatalkan]') { const n = document.createElement('div'); n.className = 'day'; n.textContent = 'Resep ' + m.resep + ' dibatalkan oleh ' + (m.nama || 'dokter') + '. Jangan dipakai.'; setTimeout(() => refreshResep(m.resep), 0); return n; }
    const b = document.createElement('div'); b.className = 'm them rxm'; b.dataset.rid = m.resep; const w = document.createElement('span'); w.className = 'ph'; w.textContent = 'Memuat resep…'; b.appendChild(w); loadResep(m.resep, b); return b;
  }
  async function loadResep(rid, box) {
    const gen = S.gen; try { const r = await api('konsulResep', { rid: rid }, S.token); if (gen !== S.gen) return; box.textContent = ''; if (!r.success) throw 0; box.appendChild(resepCard(r.data, true)); } catch (e) { box.textContent = 'Resep tidak dapat dimuat.'; }
  }
  function refreshResep(rid) { document.querySelectorAll('.rxm[data-rid="' + rid + '"]').forEach(b => loadResep(rid, b)); }
  function resepCard(d, aksi) {
    const t = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    const c = t('div', 'rx' + (d.status !== 'Aktif' ? ' off' : '')); c.appendChild(t('b', 'rx-k', d.klinik || KLINIK_NAMA)); if (d.alamat) c.appendChild(t('small', null, d.alamat));
    c.appendChild(t('div', 'rx-t', 'RESEP ' + d.id + (d.status !== 'Aktif' ? ' — ' + d.status.toUpperCase() + ' (jangan dipakai)' : ''))); c.appendChild(t('small', null, 'Tanggal: ' + d.tanggal + ' · Pasien: ' + d.nama));
    const ol = t('ol', 'rx-l'); d.items.forEach(i => { const li = t('li'); li.appendChild(t('b', null, i.obat + '  —  ' + i.jumlah)); li.appendChild(t('div', null, i.aturan)); ol.appendChild(li); }); c.appendChild(ol);
    if (d.catatan) c.appendChild(t('p', 'rx-n', 'Catatan: ' + d.catatan));
    const sg = t('div', 'rx-s'); if (d.ttd) { const im = t('img'); im.src = d.ttd; im.alt = 'Tanda tangan dokter'; sg.appendChild(im); } sg.appendChild(t('b', null, d.dokter)); sg.appendChild(t('small', null, 'SIP: ' + d.sip)); c.appendChild(sg);
    c.appendChild(t('small', 'rx-v', 'Kode verifikasi: ' + d.kode));
    c.appendChild(t('div', 'rx-foot', 'Resep ini dapat ditebus di klinik atau apotek terdekat. Keaslian dapat diperiksa di ' + location.origin + location.pathname + '?r=' + d.kode));
    if (aksi && d.status === 'Aktif') { const b = t('button', null, 'Cetak / simpan PDF'); b.type = 'button'; b.addEventListener('click', () => { const pr = $('printRx'); pr.textContent = ''; const cp = resepCard(d, false); pr.appendChild(cp); window.print(); }); c.appendChild(b); }
    return c;
  }
  async function verifikasi(kode) {
    view('verif'); const m = $('verifMsg'), box = $('verifBox');
    try { const r = await api('cekResep', { k: kode }); if (!r.success) { m.textContent = r.message || 'Resep tidak ditemukan.'; return; }
      m.textContent = r.data.status === 'Aktif' ? 'Resep TERDAFTAR dan masih berlaku.' : 'Resep terdaftar tetapi ' + r.data.status.toUpperCase() + '. Jangan dilayani.'; box.textContent = ''; box.appendChild(resepCard(r.data, false));
    } catch (e) { m.textContent = 'Koneksi bermasalah. Coba lagi.'; }
  }
  async function loadFoto(fid, ph, local) {
    const gen = S.gen;
    try {
      let url = S.fotoUrl[fid];
      if (!url) {
        if (local) url = local; else {
          const r = await api('konsulFoto', { fid: fid }, S.token); if (gen !== S.gen) return;
          if (!r.success) throw 0; const b = await (await fetch(r.data.foto)).blob(); url = URL.createObjectURL(b); S.fotoUrl[fid] = url;
        }
      }
      const im = document.createElement('img'); im.alt = 'Foto'; im.src = url; im.addEventListener('click', () => { $('zoomImg').src = url; $('zoom').hidden = false; }); ph.replaceWith(im);
    } catch (e) { ph.textContent = 'Foto tidak dapat dimuat.'; }
  }
  $('zoomX').addEventListener('click', () => { $('zoom').hidden = true; $('zoomImg').removeAttribute('src'); });
  $('zoom').addEventListener('click', ev => { if (ev.target === $('zoom')) $('zoomX').click(); });

  // ---------- Polling (hemat kuota: jeda memanjang saat sepi, berhenti saat tab tersembunyi) ----------
  const delay = () => document.hidden ? 60000 : S.idle < 6 ? 6000 : S.idle < 30 ? 15000 : 30000;
  function schedule() { clearTimeout(S.timer); if (S.token) S.timer = setTimeout(sync, delay()); }
  async function sync() {
    if (!S.token || S.busy) return schedule(); S.busy = true; const gen = S.gen;
    try {
      const r = await api('konsulSinkron', { after: S.seq }, S.token, '', 20000); if (gen !== S.gen) return;
      $('net').hidden = true;
      if (!r.success) { if (r.code === 'AUTH' || /Sesi/.test(r.message || '')) return reauth(); }
      else { S.first = false; if (render(r.data.pesan)) S.idle = 0; else S.idle++; S.seq = Math.max(S.seq, r.data.seq || 0); }
    } catch (e) { if (gen === S.gen) { $('net').hidden = false; S.idle = Math.min(S.idle, 5); } }
    finally { S.busy = false; if (gen === S.gen) schedule(); }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.token) { S.idle = 0; sync(); } });
  addEventListener('online', () => { if (S.token) sync(); });
  function reauth() { keluar('Sesi berakhir atau konsultasi sudah selesai. Masukkan PIN untuk melanjutkan.'); }

  // ---------- Kirim ----------
  const ta = $('teks'); ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; });
  ta.addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.shiftKey && !/Mobi|Android/i.test(navigator.userAgent)) { ev.preventDefault(); $('fKirim').requestSubmit(); } });
  $('bFoto').addEventListener('click', () => $('file').click());
  function setFoto(u) { S.foto = u; $('prev').hidden = !u; if (u) $('prevImg').src = u; else $('prevImg').removeAttribute('src'); }
  $('prevX').addEventListener('click', () => { setFoto(''); $('file').value = ''; });
  $('file').addEventListener('change', async () => {
    const f = $('file').files[0]; if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { alert('Gunakan foto JPG, PNG, atau WebP.'); $('file').value = ''; return; }
    try { setFoto(await shrink(f)); } catch (e) { alert('Foto tidak dapat diproses. Coba foto lain.'); $('file').value = ''; }
  });
  function shrink(file) { // perkecil di HP: maks 1280px, JPEG — hemat kuota & di bawah batas server
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        URL.revokeObjectURL(u); let w = im.naturalWidth, h = im.naturalHeight; const k = Math.min(1, 1280 / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
        const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
        let q = .82, out = c.toDataURL('image/jpeg', q); while (out.length > 850000 && q > .35) { q -= .1; out = c.toDataURL('image/jpeg', q); }
        out.length > 850000 ? rej(0) : res(out);
      }; im.onerror = () => { URL.revokeObjectURL(u); rej(0); }; im.src = u;
    });
  }
  $('fKirim').addEventListener('submit', ev => {
    ev.preventDefault(); const teks = ta.value.trim(), foto = S.foto; if (!teks && !foto) return;
    const p = { rid: rid(), teks: teks, foto: foto, err: false }; ta.value = ''; ta.style.height = 'auto'; setFoto(''); $('file').value = '';
    p.el = bubble({ dari: 'pasien', teks: teks, foto: foto, waktu: Date.now() }, true);
    S.pend.push(p); $('list').appendChild(p.el); $('list').scrollTop = $('list').scrollHeight; $('list').querySelector('.empty') && $('list').querySelector('.empty').remove(); kirim(p);
  });
  async function kirim(p) {
    const gen = S.gen; p.err = false; p.el.classList.remove('gagal'); p.el.classList.add('pending'); const tm = p.el.querySelector('time'); tm.textContent = 'Mengirim…';
    try {
      const r = await api('konsulKirim', { teks: p.teks, foto: p.foto }, S.token, p.rid, 60000); if (gen !== S.gen) return;
      if (r.success) { S.idle = 0; sync(); } else { if (r.code === 'AUTH') return reauth(); fail(p, r.message); }
    } catch (e) { fail(p, 'Belum terkirim.'); }
  }
  function fail(p, msg) {
    p.err = true; p.el.classList.remove('pending'); p.el.classList.add('gagal'); const tm = p.el.querySelector('time'); tm.textContent = (msg || 'Gagal') + ' ';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'retry'; b.textContent = 'Kirim ulang'; b.addEventListener('click', () => { b.remove(); kirim(p); }); tm.appendChild(b);
  }

  // ---------- Mulai ----------
  (function init() {
    const ur = new URL(location.href).searchParams.get('r'); if (ur) { history.replaceState(null, '', location.pathname); return verifikasi(norm(ur)); }
    const kode = fromUrl(); S.kode = kode; $('kode').value = kode;
    const tok = SS.get('kp_tok');
    if (tok && kode) { // pulihkan sesi saat halaman dimuat ulang (sessionStorage = hanya tab ini)
      S.token = tok; const c = JSON.parse(SS.get('kp_ctx') || '{}'); $('hNama').textContent = 'Pasca Khitan · ' + (c.nama || ''); $('hSub').textContent = c.cabang || KLINIK_NAMA; $('note').textContent = 'Percakapan dihapus otomatis ' + (c.retensi || 90) + ' hari setelah pesan terakhir.';
      view('chat'); S.first = true; api('konsulSinkron', { after: 0 }, tok).then(r => { if (!r.success) return reauth(); S.seq = 0; render(r.data.pesan); S.seq = r.data.seq || 0; S.first = false; schedule(); }).catch(() => { $('net').hidden = false; S.first = false; schedule(); });
    } else { view('login'); (kode ? $('pin') : $('kode')).focus(); }
  })();
})();
