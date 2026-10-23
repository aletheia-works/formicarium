import { readBrowserAsset } from '../../../runtime/web/package-worker.js';

self.addEventListener('message', async ({ data }) => {
  if (data.type !== 'probe-fetch') return;
  try {
    self.postMessage({
      type: 'asset',
      bytes: await readBrowserAsset(data.url),
    });
  } catch {
    self.postMessage({ type: 'asset', failed: true });
  }
});
