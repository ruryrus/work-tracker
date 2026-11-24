/* 지예 작업 현황 서비스 워커
 * - 앱 껍데기(HTML/CSS/JS/아이콘): 캐시 우선 + 뒤에서 갱신
 * - data/works.json: 네트워크 우선(최신 진행상황이 먼저) + 실패하면 캐시
 * 모든 경로는 상대경로라 https://<user>.github.io/<repo>/ 어디에 올려도 동작합니다.
 */
const VERSION = 'v2';
const SHELL_CACHE = 'work-tracker-shell-' + VERSION;
const DATA_CACHE = 'work-tracker-data-' + VERSION;

const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/favicon-64.png',
  './icons/apple-touch-icon-180.png'
];

const DATA_URL = new URL('./data/works.json', self.location.href).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => Promise.all(SHELL_FILES.map((file) =>
        fetch(new Request(file, { cache: 'reload' }))
          .then((res) => {
            if (res && res.ok) return cache.put(file, res);
            return null;
          })
          .catch(() => null)
      )))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => {
        if (key !== SHELL_CACHE && key !== DATA_CACHE) return caches.delete(key);
        return null;
      })))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 진행상황 데이터: 네트워크 우선 → 실패하면 캐시
  if (url.href.split('?')[0] === DATA_URL) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(DATA_CACHE).then((cache) => cache.put(DATA_URL, copy));
          return res;
        })
        .catch(() => caches.match(DATA_URL).then((hit) => hit || Response.error()))
    );
    return;
  }

  // 앱 껍데기: 캐시 우선 + 뒤에서 갱신
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) {
        fetch(req).then((res) => {
          if (res && res.ok) caches.open(SHELL_CACHE).then((cache) => cache.put(req, res));
        }).catch(() => null);
        return hit;
      }
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
