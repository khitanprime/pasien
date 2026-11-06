// Service worker halaman pasien: hanya menampilkan notifikasi umum. Tidak ada isi pesan yang lewat layanan push.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  e.waitUntil(self.registration.showNotification('Khitan Prime', { body: 'Ada balasan dari Khitan Prime', icon: 'assets/logo.jpg', badge: 'assets/logo.jpg', tag: 'balasan', renotify: true }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow(self.registration.scope);
  }));
});
