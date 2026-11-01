import { createHash } from 'node:crypto';

// Current package inventory: byte-for-byte value parity is checked against the
// package staging provider (scripts/package/stage-package.ts).
export const FIRST_PARTY_JS = Object.freeze([
  'runtime/contracts.js',
  'runtime/public.js',
  'runtime/errors.js',
  'runtime/validation.js',
  'runtime/guest-validation.js',
  'runtime/session-port.js',
  'runtime/install-catalog.js',
  'runtime/install-transfer.js',
  'runtime/install-archive.js',
  'runtime/install-lifecycle.js',
  'runtime/install.js',
  'runtime/command-parse.js',
  'runtime/command.js',
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
  'runtime/web/package-worker.bundle.js',
  'types/index.d.ts',
  'types/node.d.ts',
  'types/browser.d.ts',
  'assets/paludarium/index.mjs',
  'assets/paludarium/coordinator.mjs',
  'assets/paludarium/execution.mjs',
  'assets/paludarium/worker-support.mjs',
  'assets/paludarium/jit-support.mjs',
  'assets/paludarium/filesystem-snapshot.mjs',
  'assets/paludarium/relay-protocol.mjs',
  'assets/paludarium/paludarium.wasm',
  'assets/paludarium/build-info.json',
  'assets/paludarium/LICENSE',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'README.md',
  'package.json',
]);
export const sha256 = (bytes: string | Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
