// Tampilan PDF di dalam halaman (tanpa tab baru) memakai pdf.js (Apache-2.0, dibundel lokal di lib/pdfjs/ — tanpa CDN).
(function () {
  'use strict';
  let lib = null;
  const load = () => lib || (lib = import(new URL('lib/pdfjs/pdf.min.mjs', document.baseURI).href).then(m => { m.GlobalWorkerOptions.workerSrc = new URL('lib/pdfjs/pdf.worker.min.mjs', document.baseURI).href; return m; }));
  const bytes = b64 => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  async function show(box, b64) { // gambar tiap halaman ke <canvas>; lebar mengikuti kotak
    const m = await load(), doc = await m.getDocument({ data: bytes(b64) }).promise; box.textContent = '';
    const w = Math.max((box.clientWidth || (box.parentNode && box.parentNode.clientWidth) || 0) - 12, 0) || 600, dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p), v0 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: (w / v0.width) * dpr }), c = document.createElement('canvas');
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height); c.className = 'pdfp'; c.setAttribute('aria-label', 'Halaman ' + p);
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; box.appendChild(c);
    }
    return doc.numPages;
  }
  function save(b64, name) { // simpan sebagai berkas lewat tautan sementara (tanpa membuka tab)
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes(b64)], { type: 'application/pdf' })); a.download = name || 'dokumen.pdf';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  window.PDFV = { show: show, save: save };
})();
