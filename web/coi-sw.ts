// COOP/COEP を付ける service worker。GitHub Pages のように応答ヘッダーを設定できない
// 配信先で、ページを crossOriginIsolated にするために使う（FR2.2）。
// scripts/serve.js で配信するときはヘッダーが付くので、この service worker は不要
// （web/app.js は crossOriginIsolated でないときだけ登録する）。
const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('install', () => sw.skipWaiting());
sw.addEventListener('activate', (event) => event.waitUntil(sw.clients.claim()));

sw.addEventListener('fetch', (event) => {
  const request = event.request;
  // only-if-cached は same-origin 以外では使えず、fetch が例外になる
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin')
    return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 0) return response; // opaque な応答はそのまま返す
        const headers = new Headers(response.headers);
        headers.set('Cross-Origin-Opener-Policy', 'same-origin');
        headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
        headers.set('Cross-Origin-Resource-Policy', 'same-origin');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      })
      .catch((error: unknown) => {
        console.error(
          `coi-sw: fetch failed for ${request.url}: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }),
  );
});
