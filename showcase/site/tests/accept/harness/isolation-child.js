// Test-only isolation probe (never part of the site): the child Worker.
postMessage([self.crossOriginIsolated, typeof SharedArrayBuffer === 'function']);
