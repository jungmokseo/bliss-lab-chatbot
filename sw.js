// BLISS Lab FAQ PWA Service Worker
const CACHE_NAME = 'bliss-faq-v1';
const OFFLINE_URL = 'offline.html';

// 캐싱할 핵심 파일
const PRECACHE_URLS = [
    './',
    './index.html',
    './offline.html',
    './manifest.json'
  ];

// 설치: 핵심 파일 캐시
self.addEventListener('install', event => {
    event.waitUntil(
          caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
        );
});

// 활성화: 이전 캐시 삭제
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
    // API 호출은 항상 네트워크 우선
                        if (event.request.url.includes('script.google.com') ||
                                  event.request.url.includes('api.notion.com')) {
                              event.respondWith(
                                      fetch(event.request).catch(() =>
                                                new Response(JSON.stringify({ error: '오프라인 상태입니다. 인터넷 연결을 확인해주세요.' }),
                                                             { headers: { 'Content-Type': 'application/json' } })
                                                                       )
                                    );
                              return;
                        }

                        // 일반 리소스: 캐시 우선, 네트워크 폴백
                        event.respondWith(
                              caches.match(event.request).then(cached => {
                                      if (cached) return cached;
                                      return fetch(event.request).then(response => {
                                                // 유효한 응답만 캐시
                                                                               if (response.status === 200 && response.type === 'basic') {
                                                                                           const clone = response.clone();
                                                                                           caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                                                                               }
                                                return response;
                                      });
                              }).catch(() => {
                                      // HTML 요청이면 오프라인 페이지 표시
                                             if (event.request.destination === 'document') {
                                                       return caches.match(OFFLINE_URL);
                                             }
                              })
                            );
});
