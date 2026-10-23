// Service worker do Nexus Defense.
// Papel: guardar o "casco" do jogo (HTML, fontes, SDK, ícones) para que ele
// abra instantaneamente e continue jogável sem internet. Chamadas à nuvem
// (Supabase) nunca passam por aqui — elas precisam de rede de verdade.

const VERSION = 'nexus-v8';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './vendor/supabase.js',
  './fonts/fonts.css',
  './fonts/sharetechmono-692586.woff2',
  './fonts/chakrapetch-500.woff2',
  './fonts/chakrapetch-700.woff2',
  './fonts/orbitron-900.woff2',
  './fonts/silkscreen-08b16d.woff2',
  './fonts/silkscreen-4d7043.woff2',
  './fonts/silkscreen-739edc.woff2',
  './fonts/silkscreen-e0d71d.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // addAll falha inteiro se um arquivo falhar; individual é mais tolerante
    await Promise.all(SHELL.map(url =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n !== VERSION).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Outra origem (API da nuvem, por exemplo): deixa passar direto
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache  = await caches.open(VERSION);
    const salvo  = await cache.match(req, { ignoreSearch: true });

    // Busca em segundo plano para manter a cópia fresca na próxima abertura
    const rede = fetch(req).then(resp => {
      if (resp && resp.ok && resp.type === 'basic') cache.put(req, resp.clone());
      return resp;
    }).catch(() => null);

    // Responde do cache na hora; sem cache, espera a rede
    if (salvo) return salvo;
    const resp = await rede;
    if (resp) return resp;

    // Offline e sem cópia: navegação cai no index
    if (req.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    return new Response('Recurso indisponível offline', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  })());
});
