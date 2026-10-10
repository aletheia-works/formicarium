import { createHash } from 'node:crypto';

// Fixed publication inventory: byte-for-byte value parity is checked against the existing provider.
export const FIRST_PARTY_JS = Object.freeze([
  'runtime/contracts.js',
  'runtime/public.js',
  'runtime/errors.js',
  'runtime/validation.js',
  'runtime/state.js',
  'runtime/lifecycle.js',
  'runtime/protocol.js',
  'runtime/worker-execution.js',
  'runtime/core.js',
  'runtime/guest-io.js',
  'runtime/node/api.js',
  'runtime/node/package-worker.js',
  'runtime/web/api.js',
  'runtime/web/package-worker.js',
]);
export const PACKAGE_FILES = Object.freeze([
  ...FIRST_PARTY_JS,
  'types/index.d.ts',
  'types/node.d.ts',
  'types/browser.d.ts',
  'assets/blink.mjs',
  'assets/blink.wasm',
  'assets/build-info.json',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'README.md',
  'package.json',
]);
export const sha256 = (bytes: string | Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

export const U2_FILES = ['manifest', 'fixtures', 'resolver'].map(
  (name) => `integration/terrarium/guest-distribution/${name}.js`,
);
export const U3_FILES = [
  'formicarium-session',
  'catalog',
  'terminal',
  'session',
  'index',
  'npm',
]
  .map((name) => `terrarium/packages/terrarium/src/${name}.ts`)
  .concat('terrarium/web/terminal.mjs');
export const FILES = Object.freeze([
  ...FIRST_PARTY_JS,
  ...U2_FILES,
  ...U3_FILES,
]);
export const BROWSER_TITLES = Object.freeze([
  'latest aube ready fields, events and actual Worker version',
  'latest pitchfork uses common runtime actual Worker version',
  'nested cwd keeps /work sibling before and after actual guest',
  'empty fixture and empty command have no added exit event',
  'normal nonzero exit and unsupported syntax error once; queue recovers',
  'run attributes and concurrent calls retain serial command order',
  'keyboard focus deletion arrows history and Ctrl-C preserve terminal controls',
  'tool switch resets attributes and suppresses prior queued run notifications',
  'disconnect invalidates old work and reconnect creates independent session',
  'boot error rejects ready once without creating any guest Worker',
  ...['same-origin', 'cross-origin', 'missing-isolation'].map(
    (condition) =>
      `iframe condition ${condition}: exact origins and guest marker oracle`,
  ),
  'invalid opaque wildcard and unknown parent origins never connect or notify',
  'unapproved parent origin cannot run or receive notifications even when syntax is valid',
]);
const PROJECTS = ['chromium', 'firefox', 'webkit'];

const u1Inventory = {
  version: 1,
  threshold: 80,
  files: [
    'runtime/contracts.js',
    'runtime/public.js',
    'runtime/errors.js',
    'runtime/validation.js',
    'runtime/state.js',
    'runtime/lifecycle.js',
    'runtime/protocol.js',
    'runtime/worker-execution.js',
    'runtime/core.js',
    'runtime/guest-io.js',
    'runtime/node/api.js',
    'runtime/node/package-worker.js',
    'runtime/web/api.js',
    'runtime/web/package-worker.js',
  ],
  node: {
    host: 1,
    workers: 25,
    workerBreakdown: {
      nodeApi: 4,
      nodeWorker: 3,
      realConsumer: 18,
    },
  },
  browserProjects: ['chromium', 'firefox', 'webkit'],
  browserCases: {
    'browser API owns copied filesystem seed and reset without core startup': 0,
    'browser session rejects malformed roots, assets and seed before ownership changes': 0,
    'invalid ELF and pre-aborted run create no browser Worker': 0,
    'isolation deficiency is UNSUPPORTED_ENV and guest never starts': 0,
    'cross-origin Worker is explicitly rejected instead of blob fallback': 0,
    'CPU-bound browser Worker timeout releases BUSY reservation after termination': 1,
    'actual browser package Worker removes Atomics.waitAsync before core import': 1,
    'actual browser Worker rejects unsupported protocol major': 1,
    'actual browser Worker rejects unknown request type': 1,
    'actual browser Worker classifies missing assets without serializing arbitrary diagnostics': 1,
    'browser asset reader returns exact fetched bytes in the Worker realm': 1,
    'browser asset reader rejects HTTP404 instead of accepting its response body': 1,
    'real installed browser archive normal and nonzero byte guest': 34,
    'real browser snapshot restores links/modes/deletion to next fresh core': 34,
    'real browser pthread guest exits normally before next fresh run': 34,
    'real browser CPU-bound timeout releases session for immediate run': 34,
    'real browser CPU-bound abort releases session for immediate run': 34,
    'host descendant broker validates valid and preserves ports': 2,
    'host descendant broker validates invalid-url and preserves ports': 1,
    'host descendant broker validates invalid-options and preserves ports': 1,
    'installed real loader mutation never executes unverified original URL bytes': 17,
    'verified browser loader obeys explicit CSP blob permission true': 17,
    'verified browser loader obeys explicit CSP blob permission false': 1,
    'host releases every verified Blob after normal abort timeout and disposal': 85,
    'public removed nested cwd is recreated by real guest run': 17,
    'host descendant broker validates resource-valid and preserves ports': 1,
    'host descendant broker validates resource-stale and preserves ports': 1,
    'host descendant broker validates resource-duplicate and preserves ports': 1,
    'host descendant broker validates resource-invalid-version and preserves ports': 1,
    'host descendant broker validates resource-invalid-bytes and preserves ports': 1,
    'host descendant broker validates invalid-resource and preserves ports': 1,
    'host descendant broker validates blob-url and preserves ports': 1,
    'removed cwd snapshot rollback next-run and reset preserve seed state': 51,
  },
  exclusions: {
    'generated blink loader/wasm':
      'third-party generated assets checked by hashes/provenance/real consumers',
    types: 'declarations checked by strict fixtures',
    'guest ELF': 'external/native fixtures',
    'scripts/tests/CLI/registry':
      'development-only, excluded from distribution',
  },
};
export const REQUIRED_U1_REALMS = Object.freeze([
  'node-host',
  ...Array.from(
    { length: u1Inventory.node.workers },
    (_, index) => `node-worker-${index + 1}`,
  ),
  ...PROJECTS.flatMap((project) =>
    Object.entries(u1Inventory.browserCases).flatMap(([title, workers]) => [
      `${project}:${title}:browser-host`,
      ...Array.from(
        { length: Number(workers) },
        (_, index) => `${project}:${title}:browser-worker-${index + 1}`,
      ),
    ]),
  ),
]);
