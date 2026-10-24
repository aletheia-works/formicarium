// Test-only isolation probe (never part of the site). A same-origin Worker,
// because the terminal pages' CSP allows Workers only from the same origin.
// It starts a child Worker and reports whether both are cross-origin isolated.
const child = new Worker('./isolation-child.js');
child.onmessage = (event) =>
  postMessage({
    worker:
      self.crossOriginIsolated && typeof SharedArrayBuffer === 'function',
    child: event.data[0] && event.data[1],
  });
