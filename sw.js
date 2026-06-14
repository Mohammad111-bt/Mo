// Mo's Summer HQ — Service Worker
const CACHE = 'mo-hq-v1';

// ── Install: cache the app shell ─────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['./index.html']))
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

// ── Fetch: serve from cache, fallback to network ─────────────────
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// ── Notification click ────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      if (list.length) return list[0].focus();
      return clients.openWindow('./index.html');
    })
  );
});

// ── Scheduled notifications via postMessage ───────────────────────
// The app sends us the schedule; we store it and fire at the right time
let timers = [];

function clearTimers() {
  timers.forEach(t => clearTimeout(t));
  timers = [];
}

function scheduleNotifications(reminders, todayType) {
  clearTimers();
  const now = new Date();

  reminders.forEach(r => {
    if (r.onlyOn && r.onlyOn !== todayType) return;

    const target = new Date();
    target.setHours(r.hour, r.min, 0, 0);
    if (target <= now) {
      // Already passed today — schedule for tomorrow
      target.setDate(target.getDate() + 1);
    }

    const delay = target - now;
    const t = setTimeout(() => {
      self.registration.showNotification(r.title, {
        body: r.body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        vibrate: [200, 100, 200],
        tag: r.title, // prevents duplicate notifications
        renotify: false,
      });
    }, delay);
    timers.push(t);
  });

  // Reschedule every day at midnight
  const midnight = new Date();
  midnight.setHours(24, 0, 5, 0);
  const t = setTimeout(() => {
    // Ask the client for fresh todayType
    self.clients.matchAll().then(list => {
      list.forEach(c => c.postMessage({ type: 'RESCHEDULE' }));
    });
  }, midnight - now);
  timers.push(t);
}

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE') {
    scheduleNotifications(e.data.reminders, e.data.todayType);
  }
});
