# Khitan Prime — Konsultasi Pasca Khitan (halaman pasien)

Halaman publik (GitHub Pages) tempat orang tua pasien mengirim pesan & foto ke klinik.
Tidak ada data pasien, kunci, atau password di repo ini; semua data tetap di Google Apps Script milik klinik.

- Isi `js/config.js` → `GAS_URL` = alamat Web App `/exec` (sama dengan aplikasi klinik).
- Alamat pasien: `https://USERNAME.github.io/khitanprime/?k=KODE` (kode dibuat dari aplikasi klinik: Pasien Diproses → ikon percakapan).
- Masuk: kode (dari tautan) + PIN 4 digit terakhir nomor HP orang tua pada booking.
- Percakapan & foto dihapus otomatis 90 hari setelah pesan terakhir.
