/* ================================================================
   Service Worker — Painel de Cobranças Belt Correias
   Estratégia:
   - Dados do Google Sheets (google.com/gstatic.com): SEMPRE rede (nunca cacheia)
   - Documento/navegação (HTML): network-first (pega atualizações), cai p/ cache offline
   - Estáticos da mesma origem (ícones, manifest): cache-first
   - CDNs (Tailwind, Chart.js, FontAwesome, Fonts): stale-while-revalidate
   Ao publicar uma nova versão do app, incremente CACHE_VERSION.
   ================================================================ */
const CACHE_VERSION = 'v1';
const CACHE_NAME = 'belt-cobrancas-' + CACHE_VERSION;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { /* se algum item falhar, segue instalando o que der */ })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (e) { return; }

  // 1) Dados da planilha e recursos do Google: nunca cachear, sempre rede.
  if (url.hostname.indexOf('google.com') > -1 || url.hostname.indexOf('gstatic.com') > -1) {
    return; // deixa o navegador buscar direto na rede
  }

  // 2) Navegação / HTML: network-first (garante dados/layout novos), fallback offline.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) { return r || caches.match('./index.html'); });
      })
    );
    return;
  }

  // 3) Estáticos da mesma origem: cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        return cached || fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
          return res;
        });
      })
    );
    return;
  }

  // 4) CDNs cross-origin: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
