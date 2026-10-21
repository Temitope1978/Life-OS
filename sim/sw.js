/* Life OS — service worker (static shell only)
   Caches only the application shell/static assets. Never caches
   API responses, auth endpoints, private data, credentials, or
   tokens. HTML is network-first to avoid stale versions. */

const CACHE_NAME = 'lifeos-shell-v6';

const STATIC_ASSETS = [
  './',
  './index.html',
  './assets/css/app.css',
  './assets/js/app.js',
  './assets/js/core/actions.js',
  './assets/js/core/config.js',
  './assets/js/core/dates.js',
  './assets/js/core/demo-auth.js',
  './assets/js/core/details.js',
  './assets/js/core/identity.js',
  './assets/js/core/response-templates.js',
  './assets/js/core/oauth.js',
  './assets/js/core/providers.js',
  './assets/js/core/seam.js',
  './assets/js/core/session.js',
  './assets/js/core/store.js',
  './assets/js/core/supabase-auth.js',
  './assets/js/data/seed.js',
  './assets/js/engines/briefing.js',
  './assets/js/engines/commitment.js',
  './assets/js/engines/followup.js',
  './assets/js/engines/forgetting.js',
  './assets/js/engines/mail.js',
  './assets/js/engines/notetaker.js',
  './assets/js/engines/priority.js',
  './assets/js/engines/search.js',
  './assets/js/engines/tasks.js',
  './assets/js/ui/components.js',
  './assets/js/ui/dom.js',
  './assets/js/ui/views/auth.js',
  './assets/js/ui/views/calendar.js',
  './assets/js/ui/views/command.js',
  './assets/js/ui/views/commitments.js',
  './assets/js/ui/views/control.js',
  './assets/js/ui/views/day.js',
  './assets/js/ui/views/forget.js',
  './assets/js/ui/views/mail.js',
  './assets/js/ui/views/meetings.js',
  './assets/js/ui/views/search.js',
  './assets/js/ui/views/settings.js',
  './assets/images/life-os-logo.png',
  './assets/images/icon-192.png',
  './assets/images/icon-512.png'
];

self.addEventListener('install', function (event) {
  /* Activate immediately so the next load fetches the new app shell
     instead of being served stale JS by the previous worker. */
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS).catch(function () {
        /* Do not fail installation if an optional asset is missing. */
      });
    })
  );
});

self.addEventListener('activate', function (event) {
  /* Take control of all open clients immediately, and wait for it so
     the new worker is fully in control before the next load. */
  event.waitUntil(self.clients.claim());
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
            .map(function (key) { return caches.delete(key); })
      );
    })
  );
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);

  /* Bypass the service worker for API calls (Supabase REST API, auth, functions). */
  if (url.pathname.indexOf('/rest/') === 0 ||
      url.pathname.indexOf('/auth/') === 0 ||
      url.pathname.indexOf('/functions/') === 0) {
    return;
  }

  /* Network-first for HTML (avoid stale HTML). */
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put('./index.html', copy);
        });
        return response;
      }).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  /* Cache-first for static assets. */
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, copy);
        });
        return response;
      });
    })
  );
});
