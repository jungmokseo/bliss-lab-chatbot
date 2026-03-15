// BLISS Lab FAQ PWA Service Worker
// v2 — 네트워크 우선 전략으로 변경 (캐시 자동 갱신)
const CACHE_NAME = 'bliss-faq-v2';
const OFFLINE_URL = 'offline.html';

// 캐싱할 핵심 파일
const PRECACHE_URLS = [
  './',
  './index.html',
  './offline.html',
  './manifest.json'
];

// 설치: 핵심 파일 캐시 + 즉시 활성화
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// 활성화: 이전 버전 캐시 전부 삭제 (v1 포함)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// 네트워크 요청 처리
self.addEventListener('fetch', event => {
  // API 호출은 항상 네트워크만
  if (event.request.url.includes('script.google.com') ||
      event.request.url.includes('api.notion.com')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({
          error: '오프라인 상태입니다. 인터넷 연결을 확인해주세요.'
        }), { headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // HTML/페이지 요청: 네트워크 우선, 실패 시 캐시
  if (event.request.destination === 'document' ||
      event.request.url.endsWith('.html') ||
      event.request.url.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // 새 응답을 캐시에 저장
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // 오프라인이면 캐시에서 제공
          return caches.match(event.request)
            .then(cached => cached || caches.match(OFFLINE_URL));
        })
    );
    return;
  }

  // 기타 정적 리소스(아이콘, manifest 등): 캐시 우선
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      if (event.request.destination === 'document') {
        return caches.match(OFFLINE_URL);
      }
    })
  );
});
