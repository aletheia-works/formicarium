// scripts/release/publication-cli.ts
import { execFileSync as execFileSync2 } from 'node:child_process';
// scripts/release/inventory.ts
import { createHash } from 'node:crypto';
// scripts/release/evidence.ts
import {
  lstat,
  mkdir,
  mkdir as mkdir3,
  readFile,
  readFile as readFile3,
  realpath,
  writeFile,
  writeFile as writeFile3,
} from 'node:fs/promises';
import {
  dirname as dirname2,
  isAbsolute,
  join,
  join as join2,
  resolve,
  resolve as resolve4,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';

var FIRST_PARTY_JS = Object.freeze([
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
var PACKAGE_FILES = Object.freeze([
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
var sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
var U2_FILES = ['manifest', 'fixtures', 'resolver'].map(
  (name) => `integration/terrarium/guest-distribution/${name}.js`,
);
var U3_FILES = [
  'formicarium-session',
  'catalog',
  'terminal',
  'session',
  'index',
  'npm',
]
  .map((name) => `terrarium/packages/terrarium/src/${name}.ts`)
  .concat('terrarium/web/terminal.mjs');
var FILES = Object.freeze([...FIRST_PARTY_JS, ...U2_FILES, ...U3_FILES]);
var BROWSER_TITLES = Object.freeze([
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
var PROJECTS = ['chromium', 'firefox', 'webkit'];
var u1Inventory = {
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
var REQUIRED_U1_REALMS = Object.freeze([
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

// scripts/release/publication-assets.ts
import { createHash as createHash2 } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { gunzipSync, inflateRawSync } from 'node:zlib';

var ASSET_LIMITS = Object.freeze({
  inputBytes: 256 * 1024 * 1024 - 1,
  expandedBytes: 512 * 1024 * 1024,
  members: 8192,
  npmBytes: 32 * 1024 * 1024,
  npmExpandedBytes: 64 * 1024 * 1024,
  npmMembers: 4096,
  metadataBytes: 8 * 1024 * 1024,
});
var NPM_ASSET = Object.freeze({
  version: '11.19.0',
  url: 'https://registry.npmjs.org/npm/-/npm-11.19.0.tgz',
  integrity:
    'sha512-SDd/hHg3KqHE5Ht2NHWxNYNtqCQ2pXAPLl6OtQhPyED5PHsRfrOtO199MZTIG2cQoQ1ZRI9t28shrD+2cr3AAw==',
});
function ensure(value, code) {
  if (!value) throw Error(code);
}
var openBounded = async (path) => {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    ensure((await file.stat()).isFile(), 'ASSET_FILE_REQUIRED');
  } catch (error) {
    await file.close();
    throw error;
  }
  return {
    read: async (buffer) =>
      (await file.read(buffer, 0, buffer.length, null)).bytesRead,
    close: () => file.close(),
  };
};
async function readBoundedFile(path, limit, acquire = openBounded) {
  ensure(Number.isSafeInteger(limit) && limit >= 0, 'ASSET_LIMIT_INVALID');
  const file = await acquire(path),
    chunks = [];
  let total = 0;
  try {
    while (true) {
      const chunk = Buffer.alloc(Math.min(64 * 1024, limit - total + 1));
      const count = await file.read(chunk);
      ensure(
        Number.isSafeInteger(count) && count >= 0 && count <= chunk.length,
        'ASSET_READ_INVALID',
      );
      if (!count) return Buffer.concat(chunks, total);
      total += count;
      ensure(total <= limit, 'JSON_METADATA_LIMIT');
      chunks.push(chunk.subarray(0, count));
    }
  } finally {
    await file.close();
  }
}
function safeAssetPath(path) {
  ensure(
    typeof path === 'string' &&
      /^[A-Za-z0-9_@.+/-]+$/.test(path) &&
      !path.startsWith('/') &&
      !path.includes('\\') &&
      !path
        .split('/')
        .some(
          (part) =>
            part === '..' || part === '.' || part === '' || part === '.npmrc',
        ),
    'UNSAFE_ASSET_PATH',
  );
  return path;
}
async function boundedBody(response, limit, signal) {
  ensure(response.ok && response.body, 'ASSET_DOWNLOAD_FAILED');
  const reader = response.body.getReader(),
    rows = [];
  let total = 0;
  const abort = () => {
    reader.cancel();
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      ensure(!signal?.aborted, 'ASSET_TIMEOUT');
      const next = await reader.read();
      ensure(!signal?.aborted, 'ASSET_TIMEOUT');
      if (next.done) break;
      total += next.value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw Error('ASSET_BYTE_LIMIT');
      }
      rows.push(next.value);
    }
    return Buffer.concat(rows, total);
  } finally {
    signal?.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}
async function fetchAsset(
  url,
  limit,
  fetcher = fetch,
  headers = {},
  redirectHosts = [],
  timeoutMs = 120000,
) {
  const source = new URL(url);
  ensure(
    source.protocol === 'https:' &&
      !source.username &&
      !source.password &&
      !source.hash,
    'UNSAFE_ASSET_URL',
  );
  const timer = AbortSignal.timeout(timeoutMs);
  let response = await fetcher(url, {
    headers,
    redirect: 'manual',
    signal: timer,
  });
  if (response.status === 302 || response.status === 307) {
    const location = new URL(response.headers.get('location') ?? '', source);
    ensure(
      location.protocol === 'https:' &&
        !location.username &&
        !location.password &&
        !location.hash &&
        redirectHosts.includes(location.hostname),
      'UNSAFE_ASSET_REDIRECT',
    );
    response = await fetcher(location.href, {
      redirect: 'error',
      signal: timer,
    });
  }
  return boundedBody(response, limit, timer);
}
function verifyNpmIntegrity(bytes) {
  ensure(
    bytes.byteLength <= ASSET_LIMITS.npmBytes &&
      `sha512-${createHash2('sha512').update(bytes).digest('base64')}` ===
        NPM_ASSET.integrity,
    'NPM_INTEGRITY_MISMATCH',
  );
}
function unpackTar(bytes, expandedLimit, memberLimit) {
  ensure(
    Number.isSafeInteger(expandedLimit) &&
      expandedLimit >= 0 &&
      Number.isSafeInteger(memberLimit) &&
      memberLimit >= 0,
    'ASSET_LIMIT_INVALID',
  );
  ensure(bytes.byteLength <= ASSET_LIMITS.inputBytes, 'ASSET_BYTE_LIMIT');
  const archive = gunzipSync(bytes, {
    maxOutputLength: expandedLimit + memberLimit * 1024 + 1024,
  });
  const result = new Map();
  const seen = new Set();
  let offset = 0,
    members = 0,
    total = 0;
  const string = (header, start, length) =>
    header
      .subarray(start, start + length)
      .toString('utf8')
      .split('\x00')[0] ?? '';
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      ensure(
        archive.subarray(offset).every((byte) => byte === 0),
        'TAR_TRAILING_DATA',
      );
      return result;
    }
    ensure(++members <= memberLimit, 'ASSET_MEMBER_LIMIT');
    const number = (start, length) => {
      const value = string(header, start, length).trim();
      ensure(/^[0-7]+$/.test(value), 'UNSAFE_TAR_NUMBER');
      const parsed = Number.parseInt(value, 8);
      ensure(Number.isSafeInteger(parsed), 'UNSAFE_TAR_NUMBER');
      return parsed;
    };
    const checksum = header.reduce(
      (sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte),
      0,
    );
    ensure(checksum === number(148, 8), 'TAR_CHECKSUM');
    const prefix = string(header, 345, 155),
      name = string(header, 0, 100),
      type = header[156];
    const rawPath = prefix ? `${prefix}/${name}` : name;
    const path = safeAssetPath(
      rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath,
    );
    ensure(!seen.has(path), 'ASSET_DUPLICATE_PATH');
    seen.add(path);
    const size = number(124, 12);
    ensure(
      !path.endsWith('.json') || size <= ASSET_LIMITS.metadataBytes,
      'JSON_METADATA_LIMIT',
    );
    ensure(type === 0 || type === 48 || type === 53, 'ASSET_LINK_OR_SPECIAL');
    ensure(type !== 53 || size === 0, 'UNSAFE_DIRECTORY');
    total += size;
    ensure(
      total <= expandedLimit && offset + 512 + size <= archive.length,
      'ASSET_EXPANDED_LIMIT',
    );
    if (type !== 53)
      result.set(path, archive.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  throw Error('TRUNCATED_TAR');
}
function crc32(bytes) {
  let crc = 4294967295;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 3988292384 : 0);
  }
  return (crc ^ 4294967295) >>> 0;
}
function unpackZip(
  bytes,
  expandedLimit = ASSET_LIMITS.expandedBytes,
  memberLimit = ASSET_LIMITS.members,
) {
  ensure(
    Number.isSafeInteger(expandedLimit) &&
      expandedLimit >= 0 &&
      Number.isSafeInteger(memberLimit) &&
      memberLimit >= 0,
    'ASSET_LIMIT_INVALID',
  );
  ensure(bytes.byteLength <= ASSET_LIMITS.inputBytes, 'ASSET_BYTE_LIMIT');
  const archive = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (
    let i = archive.length - 22;
    i >= Math.max(0, archive.length - 65557);
    i--
  )
    if (
      archive.readUInt32LE(i) === 101010256 &&
      i + 22 + archive.readUInt16LE(i + 20) === archive.length
    ) {
      end = i;
      break;
    }
  ensure(
    end >= 0 &&
      archive.readUInt16LE(end + 4) === 0 &&
      archive.readUInt16LE(end + 6) === 0,
    'UNSAFE_ZIP',
  );
  const count = archive.readUInt16LE(end + 10),
    start = archive.readUInt32LE(end + 16),
    length = archive.readUInt32LE(end + 12);
  ensure(
    count <= memberLimit &&
      count === archive.readUInt16LE(end + 8) &&
      start + length === end,
    'ASSET_MEMBER_LIMIT',
  );
  const result = new Map();
  let cursor = start,
    total = 0;
  for (let i = 0; i < count; i++) {
    ensure(
      cursor + 46 <= end && archive.readUInt32LE(cursor) === 33639248,
      'UNSAFE_ZIP',
    );
    const flags = archive.readUInt16LE(cursor + 8),
      method = archive.readUInt16LE(cursor + 10),
      crc = archive.readUInt32LE(cursor + 16),
      compressed = archive.readUInt32LE(cursor + 20),
      size = archive.readUInt32LE(cursor + 24),
      names = archive.readUInt16LE(cursor + 28),
      extra = archive.readUInt16LE(cursor + 30),
      comment = archive.readUInt16LE(cursor + 32),
      local = archive.readUInt32LE(cursor + 42),
      mode = archive.readUInt32LE(cursor + 38) >>> 16;
    ensure(
      cursor + 46 + names + extra + comment <= end &&
        (flags & ~2056) === 0 &&
        [0, 8].includes(method) &&
        (mode === 0 || (mode & 61440) === 32768) &&
        archive.readUInt16LE(cursor + 34) === 0,
      'ASSET_LINK_OR_SPECIAL',
    );
    const name = new TextDecoder('utf-8', { fatal: true }).decode(
      archive.subarray(cursor + 46, cursor + 46 + names),
    );
    const path = safeAssetPath(name);
    ensure(
      !path.endsWith('.json') || size <= ASSET_LIMITS.metadataBytes,
      'JSON_METADATA_LIMIT',
    );
    ensure(!result.has(path), 'ASSET_DUPLICATE_PATH');
    total += size;
    ensure(
      total <= expandedLimit && size <= expandedLimit,
      'ASSET_EXPANDED_LIMIT',
    );
    ensure(
      local + 30 <= start &&
        archive.readUInt32LE(local) === 67324752 &&
        archive.readUInt16LE(local + 6) === flags &&
        archive.readUInt16LE(local + 8) === method,
      'UNSAFE_ZIP',
    );
    const localNames = archive.readUInt16LE(local + 26),
      localExtra = archive.readUInt16LE(local + 28),
      data = local + 30 + localNames + localExtra;
    ensure(
      archive
        .subarray(local + 30, local + 30 + localNames)
        .equals(Buffer.from(name)) && data + compressed <= start,
      'UNSAFE_ZIP',
    );
    const output =
      method === 8
        ? inflateRawSync(archive.subarray(data, data + compressed), {
            maxOutputLength: Math.max(
              1,
              Math.min(
                expandedLimit - total + size,
                path.endsWith('.json')
                  ? ASSET_LIMITS.metadataBytes
                  : expandedLimit,
              ),
            ),
          })
        : archive.subarray(data, data + compressed);
    ensure(output.length === size && crc32(output) === crc, 'ZIP_SIZE_CRC');
    result.set(path, output);
    cursor += 46 + names + extra + comment;
  }
  ensure(cursor === end, 'UNSAFE_ZIP');
  return result;
}
function npmFiles(bytes) {
  verifyNpmIntegrity(bytes);
  const files = unpackTar(
    bytes,
    ASSET_LIMITS.npmExpandedBytes,
    ASSET_LIMITS.npmMembers,
  );
  ensure(
    [...files.keys()].every(
      (path) => path === 'package' || path.startsWith('package/'),
    ),
    'NPM_PATH_MISMATCH',
  );
  ensure(
    JSON.parse(files.get('package/package.json')?.toString() ?? '{}')
      .version === NPM_ASSET.version && files.has('package/bin/npm-cli.js'),
    'NPM_VERSION_MISMATCH',
  );
  return files;
}

// scripts/release/evidence.ts
var hex = (s) => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
function requireCondition(value, message) {
  if (!value) throw new Error(message);
}
function unique(values, label) {
  requireCondition(
    new Set(values).size === values.length,
    `duplicate ${label}`,
  );
}
async function artifactBytes(root, path, limit) {
  requireCondition(
    typeof path === 'string' &&
      path.length > 0 &&
      !isAbsolute(path) &&
      !path.split(/[\\/]/).some((p) => p === '..' || p === '.' || p === '') &&
      !path.includes('\\'),
    'unsafe artifact path',
  );
  const base = await realpath(root),
    target = resolve(base, path);
  requireCondition(target.startsWith(base + sep), 'artifact escapes root');
  let current = base;
  for (const part of path.split('/')) {
    current = join(current, part);
    requireCondition(
      !(await lstat(current)).isSymbolicLink(),
      'artifact symlink refused',
    );
  }
  requireCondition((await lstat(target)).isFile(), 'artifact must be a file');
  const maximum =
    limit ?? (path.endsWith('.json') ? ASSET_LIMITS.metadataBytes : undefined);
  return maximum === undefined
    ? readFile(target)
    : readBoundedFile(target, maximum);
}
async function validateEvidence(root, evidence) {
  requireCondition(
    evidence?.schemaVersion === 1 &&
      /^[a-zA-Z0-9_-]+$/.test(evidence.evidenceId),
    'invalid evidence schema/id',
  );
  const c = evidence.candidate;
  requireCondition(
    c?.candidateId &&
      c.version &&
      c.sourceCommit &&
      hex(c.tarballSha256) &&
      c.core?.dirty === false &&
      c.core.sourceCommit &&
      hex(c.core.buildInfoSha256),
    'invalid candidate/core identity',
  );
  requireCondition(
    Array.isArray(c.firstPartyJs) &&
      c.firstPartyJs.length === FILES.length &&
      c.firstPartyJs.every(
        (row) => FILES.includes(row.path) && hex(row.sha256),
      ),
    'fixed candidate inventory differs',
  );
  unique(
    c.firstPartyJs.map((row) => row.path),
    'source paths',
  );
  requireCondition(
    Array.isArray(c.exclusions) &&
      c.exclusions.every((row) => row.path && row.reason),
    'exclusions missing',
  );
  requireCondition(Array.isArray(evidence.checks), 'checks missing');
  unique(
    evidence.checks.map((row) => row.checkId),
    'checkId',
  );
  for (const check of evidence.checks) {
    requireCondition(
      check.checkId &&
        check.candidateId === c.candidateId &&
        check.tarballSha256 === c.tarballSha256 &&
        check.command?.trim() &&
        check.environment?.trim(),
      'check identity differs',
    );
    requireCondition(
      ['passed', 'failed', 'unverified'].includes(check.status) &&
        [
          'exit',
          'init-failure',
          'execution-failure',
          'timeout',
          'aborted',
          'not-run',
        ].includes(check.termination),
      'check result invalid',
    );
    requireCondition(
      check.exitCode === null || Number.isInteger(check.exitCode),
      'exit code invalid',
    );
    if (check.status === 'passed')
      requireCondition(
        check.exitCode === 0 &&
          check.termination === 'exit' &&
          check.unverified.length === 0 &&
          check.stdoutArtifact &&
          check.stderrArtifact,
        'unobserved passed check',
      );
    requireCondition(
      Array.isArray(check.guestBuilds) &&
        check.guestBuilds.every(
          (row) => row.tool && row.ref && row.sourceCommit && hex(row.sha256),
        ),
      'guest identity invalid',
    );
    for (const path of [check.stdoutArtifact, check.stderrArtifact].filter(
      (p) => p !== null,
    ))
      requireCondition(hex(check.artifactDigests[path]), 'log digest missing');
    for (const [path, digest] of Object.entries(check.artifactDigests))
      requireCondition(
        hex(digest) && sha256(await artifactBytes(root, path)) === digest,
        'artifact digest differs',
      );
    const acceptance =
      /^(terrarium|iframe)-(node|chromium|firefox|webkit)$/.test(check.checkId);
    if (check.terrarium || (acceptance && check.status === 'passed')) {
      const integration = check.terrarium;
      requireCondition(
        integration &&
          typeof integration.baselineCommit === 'string' &&
          integration.baselineCommit.trim() &&
          typeof integration.integrationCommit === 'string' &&
          integration.integrationCommit.trim() &&
          integration.installedVersion === c.version &&
          typeof integration.diffArtifact === 'string' &&
          integration.diffArtifact.trim() &&
          hex(integration.diffSha256),
        'terrarium integration metadata invalid',
      );
      requireCondition(
        check.artifactDigests[integration.diffArtifact] ===
          integration.diffSha256 &&
          sha256(await artifactBytes(root, integration.diffArtifact)) ===
            integration.diffSha256,
        'terrarium integration diff digest differs',
      );
    }
  }
  if (evidence.coverage) {
    const v = evidence.coverage;
    requireCondition(
      v.candidateId === c.candidateId &&
        v.tarballSha256 === c.tarballSha256 &&
        hex(v.inventorySha256) &&
        v.commands.length > 0,
      'coverage identity differs',
    );
    requireCondition(
      v.files.length === FILES.length &&
        v.files.every((row) => FILES.includes(row.path)),
      'coverage denominator differs',
    );
    unique(
      v.files.map((row) => row.path),
      'coverage paths',
    );
    for (const row of v.files)
      requireCondition(
        Number.isInteger(row.totalLines) &&
          Number.isInteger(row.coveredLines) &&
          row.totalLines >= 0 &&
          row.coveredLines >= 0 &&
          row.coveredLines <= row.totalLines &&
          ['measured', 'not-executed', 'missing'].includes(row.collection) &&
          (row.collection !== 'not-executed' || row.coveredLines === 0),
        'coverage counters invalid',
      );
    const bytes = await artifactBytes(
      root,
      v.reportArtifact,
      ASSET_LIMITS.metadataBytes,
    );
    const reportDigest = sha256(bytes);
    requireCondition(
      evidence.checks.some(
        (check) => check.artifactDigests[v.reportArtifact] === reportDigest,
      ),
      'coverage report digest missing',
    );
    const report = JSON.parse(bytes.toString());
    requireCondition(
      report.sourceIdentity &&
        report.candidateSha256 &&
        hex(report.executionIdentity) &&
        report.files?.length === FILES.length &&
        report.passed === true,
      'coverage report not bound',
    );
    const expected = v.binding;
    requireCondition(
      expected?.generation &&
        hex(expected.sourceIdentity) &&
        hex(expected.candidateSha256) &&
        hex(expected.executionIdentity),
      'coverage binding missing',
    );
    for (const key of [
      'generation',
      'sourceIdentity',
      'candidateSha256',
      'executionIdentity',
    ])
      requireCondition(
        report[key] === expected[key],
        'coverage report binding differs',
      );
    const inventoryBytes = await artifactBytes(
      root,
      v.inventoryArtifact,
      ASSET_LIMITS.metadataBytes,
    );
    requireCondition(
      evidence.checks.some(
        (check) =>
          check.artifactDigests[v.inventoryArtifact] === sha256(inventoryBytes),
      ),
      'coverage inventory artifact digest missing',
    );
    const inventory = JSON.parse(inventoryBytes.toString());
    requireCondition(
      inventory.generation === expected.generation &&
        inventory.sourceIdentity === expected.sourceIdentity &&
        inventory.candidate?.sha256 === expected.candidateSha256 &&
        inventory.tarballSha256 === c.tarballSha256 &&
        sha256(JSON.stringify(inventory.digests)) === expected.sourceIdentity,
      'coverage source/candidate binding differs',
    );
    requireCondition(
      Array.isArray(inventory.digests) &&
        inventory.digests.length === FILES.length,
      'coverage source inventory differs',
    );
    unique(
      inventory.digests.map((row) => row.path),
      'coverage source paths',
    );
    for (const row of c.firstPartyJs)
      requireCondition(
        inventory.digests.find((file) => file.path === row.path)
          ?.sourceSha256 === row.sha256,
        'coverage candidate source digest differs',
      );
    requireCondition(
      Array.isArray(report.freshReceipts),
      'coverage receipt realms missing',
    );
    const receipts = report.freshReceipts;
    const projects = ['chromium', 'firefox', 'webkit'];
    requireCondition(
      receipts.length === 1 + projects.length * BROWSER_TITLES.length &&
        receipts.filter((row) => row.realm === 'node-host').length === 1,
      'coverage receipt realm set differs',
    );
    const allowedRealms = new Set(['node-host']);
    for (const project of projects)
      for (const title of BROWSER_TITLES) {
        requireCondition(
          receipts.filter(
            (row) =>
              row.realm === 'browser-host' &&
              row.project === project &&
              row.title === title,
          ).length === 1,
          'coverage browser realm missing or duplicate',
        );
        allowedRealms.add(`browser-host:${project}:${title}`);
      }
    for (const row of receipts) {
      requireCondition(
        row.status === 'passed' &&
          (row.realm === 'node-host'
            ? row.exitCode === 0
            : row.realm === 'browser-host' && row.expectedStatus === 'passed'),
        'coverage receipt realm result differs',
      );
      for (const key of [
        'generation',
        'sourceIdentity',
        'candidateSha256',
        'executionIdentity',
      ])
        requireCondition(
          row[key] === expected[key],
          'coverage receipt binding differs',
        );
    }
    const imported = report.componentImport?.originalRealmNames;
    requireCondition(
      Array.isArray(imported) &&
        imported.length === REQUIRED_U1_REALMS.length &&
        new Set(imported).size === imported.length &&
        JSON.stringify([...imported].sort()) ===
          JSON.stringify([...REQUIRED_U1_REALMS].sort()),
      'coverage imported realm set differs',
    );
    for (const realm of imported) allowedRealms.add(realm);
    for (const row of v.files)
      requireCondition(
        Array.isArray(row.realms) &&
          new Set(row.realms).size === row.realms.length &&
          row.realms.every((realm) => allowedRealms.has(realm)) &&
          (row.collection !== 'measured' || row.realms.length > 0),
        'coverage file realm differs',
      );
    requireCondition(
      sha256(JSON.stringify(report.fixedInventory)) === v.inventorySha256,
      'coverage inventory digest differs',
    );
    for (const row of v.files) {
      const measured = report.files.find((f) => f.path === row.path);
      requireCondition(
        measured?.lines.total === row.totalLines &&
          measured.lines.covered === row.coveredLines,
        'coverage report counters differ',
      );
    }
  }
  return evidence;
}
async function resolveEvidence(root, index, id) {
  requireCondition(
    index?.version === 1 && Array.isArray(index.entries),
    'invalid evidence index',
  );
  unique(
    index.entries.map((e) => e.evidenceId),
    'evidenceId',
  );
  const entry = index.entries.find((e) => e.evidenceId === id);
  requireCondition(entry && hex(entry.sha256), 'unknown evidenceId');
  const bytes = await artifactBytes(
    root,
    entry.artifact,
    ASSET_LIMITS.metadataBytes,
  );
  requireCondition(sha256(bytes) === entry.sha256, 'envelope digest differs');
  const evidence = JSON.parse(bytes.toString());
  requireCondition(evidence.evidenceId === id, 'envelope ID differs');
  return validateEvidence(root, evidence);
}

// scripts/release/publication.ts
import { execFileSync } from 'node:child_process';
// scripts/release/decision.ts
import { randomUUID } from 'node:crypto';
import {
  mkdir as mkdir2,
  readFile as readFile2,
  writeFile as writeFile2,
} from 'node:fs/promises';
import { dirname, resolve as resolve2 } from 'node:path';

// scripts/release/version.ts
function publicationChannel(version) {
  requireCondition(
    typeof version === 'string' &&
      version === version.trim() &&
      /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-rc\.[1-9][0-9]*)?$/.test(
        version,
      ),
    'publication version invalid',
  );
  return version.includes('-rc.') ? 'rc' : 'stable';
}

// scripts/release/decision.ts
var RC_CHECKS = Object.freeze([
  'pack',
  'assets',
  'types',
  'consumer-node',
  'consumer-chromium',
  'consumer-firefox',
  'consumer-webkit',
  'public-source',
  'supply-chain',
  'trusted-publisher',
]);
var REGRESSION_CHECKS = Object.freeze([
  'native-baseline',
  'probe-node',
  'probe-chromium',
  'probe-firefox',
  'probe-webkit',
  'aube-node',
  'aube-chromium',
  'aube-firefox',
  'aube-webkit',
  'pitchfork-node',
  'pitchfork-chromium',
  'pitchfork-firefox',
  'pitchfork-webkit',
  'integration-ci',
]);
var ADOPTION_CHECKS = Object.freeze([
  'terrarium-node',
  'terrarium-chromium',
  'terrarium-firefox',
  'terrarium-webkit',
  'iframe-chromium',
  'iframe-firefox',
  'iframe-webkit',
]);
var DIFF_CHECKS = Object.freeze([
  'stable-pack',
  'stable-types',
  'stable-consumer-node',
  'stable-consumer-chromium',
  'stable-consumer-firefox',
  'stable-consumer-webkit',
  'stable-diff',
]);
function exact(a, b) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}
function checkPassed(e, id) {
  const row = e.checks.find((c) => c.checkId === id);
  return (
    row?.status === 'passed' &&
    row.exitCode === 0 &&
    row.termination === 'exit' &&
    row.unverified.length === 0
  );
}
function required(checks, envelopes, missing) {
  for (const id of checks) {
    const rows = envelopes.flatMap((e) =>
      e.checks.filter((c) => c.checkId === id),
    );
    if (
      !rows.length ||
      rows.some(
        (c) =>
          c.status !== 'passed' ||
          c.exitCode !== 0 ||
          c.termination !== 'exit' ||
          c.unverified.length > 0,
      )
    )
      missing.push(`check:${id}`);
  }
}
function coveragePassed(e) {
  const c = e.coverage;
  if (!c) return false;
  let total = 0,
    covered = 0;
  for (const f of c.files) {
    if (
      f.collection === 'missing' ||
      (f.collection === 'measured' && f.realms.length === 0)
    )
      return false;
    total += f.totalLines;
    covered += f.coveredLines;
  }
  return (
    total > 0 && covered / total >= 0.8 && Boolean(c.binding?.executionIdentity)
  );
}
async function adoption(root, index, e) {
  const a = e.rcAdoption;
  requireCondition(
    a?.status === 'passed' &&
      publicationChannel(e.candidate.version) === 'stable',
    'RC adoption missing',
  );
  requireCondition(
    a.stable.candidateId === e.candidate.candidateId &&
      a.stable.version === e.candidate.version &&
      a.stable.tarballSha256 === e.candidate.tarballSha256,
    'stable adoption differs',
  );
  const entry = index.entries.find((row) => row.evidenceId === a.rc.evidenceId);
  requireCondition(
    entry?.sha256 === a.rc.evidenceSha256,
    'RC envelope digest differs',
  );
  const rc = await resolveEvidence(root, index, a.rc.evidenceId);
  requireCondition(
    !rc.rcAdoption &&
      publicationChannel(rc.candidate.version) === 'rc' &&
      rc.candidate.version.split('-rc.')[0] === e.candidate.version &&
      rc.candidate.candidateId === a.rc.candidateId &&
      rc.candidate.tarballSha256 === a.rc.tarballSha256 &&
      a.rc.version === rc.candidate.version,
    'RC identity/cycle differs',
  );
  requireCondition(
    a.rc.publishedPackage.version === rc.candidate.version &&
      a.rc.publishedPackage.tarballSha256 === rc.candidate.tarballSha256 &&
      /^sha512-[A-Za-z0-9+/]+={0,2}$/.test(
        a.rc.publishedPackage.registryIntegrity,
      ),
    'published RC differs',
  );
  requireCondition(
    exact(a.rc.requiredAcceptanceCheckIds, ADOPTION_CHECKS) &&
      exact(a.diff.validationCheckIds, DIFF_CHECKS),
    'adoption required set differs',
  );
  for (const id of ADOPTION_CHECKS) {
    const c = rc.checks.find((row) => row.checkId === id);
    requireCondition(
      checkPassed(rc, id) &&
        c?.terrarium?.installedVersion === rc.candidate.version &&
        c.terrarium.baselineCommit &&
        c.terrarium.integrationCommit &&
        hex(c.terrarium.diffSha256) &&
        c.artifactDigests[c.terrarium.diffArtifact] ===
          c.terrarium.diffSha256 &&
        c.guestBuilds.length > 0 &&
        (id === 'terrarium-node' || c.browser),
      'RC acceptance incomplete',
    );
  }
  for (const id of DIFF_CHECKS)
    requireCondition(checkPassed(e, id), 'stable diff check incomplete');
  const bytes = await artifactBytes(
    root,
    a.diff.artifact,
    ASSET_LIMITS.metadataBytes,
  );
  requireCondition(sha256(bytes) === a.diff.sha256, 'diff digest differs');
  const diff = JSON.parse(bytes.toString());
  requireCondition(
    diff.rcCandidateId === rc.candidate.candidateId &&
      diff.rcTarballSha256 === rc.candidate.tarballSha256 &&
      diff.stableCandidateId === e.candidate.candidateId &&
      diff.stableTarballSha256 === e.candidate.tarballSha256 &&
      Array.isArray(diff.changed) &&
      Array.isArray(diff.unchanged),
    'diff candidate binding differs',
  );
}
async function decideRelease({
  root,
  index,
  candidate,
  evidenceIds,
  approvals,
  target,
  channel,
}) {
  const version = candidate.version,
    missing = [],
    envelopes = [];
  try {
    requireCondition(
      publicationChannel(version) === channel,
      'version/channel differs',
    );
    unique(evidenceIds, 'decision evidenceId');
    unique(
      approvals.map((a) => a.approvalId),
      'approvalId',
    );
    if (evidenceIds.length === 0) missing.push('evidence:empty');
    for (const id of evidenceIds) {
      const e = await resolveEvidence(root, index, id);
      requireCondition(
        JSON.stringify(e.candidate) === JSON.stringify(candidate) &&
          e.candidate.version === version,
        'direct candidate differs',
      );
      envelopes.push(e);
    }
    required(RC_CHECKS, envelopes, missing);
    if (channel === 'stable') {
      required(REGRESSION_CHECKS, envelopes, missing);
      required(DIFF_CHECKS, envelopes, missing);
      if (!envelopes.length || envelopes.some((e) => !coveragePassed(e)))
        missing.push('coverage:fixed-80%-realms');
      const adopters = envelopes.filter((e) => e.rcAdoption);
      requireCondition(adopters.length > 0, 'RC adoption missing');
      for (const e of adopters) await adoption(root, index, e);
    }
  } catch (error) {
    missing.push(`evidence:${error.message}`);
  }
  if (candidate.version !== version) missing.push('version');
  const operation = channel === 'rc' ? 'publish-rc' : 'publish-stable';
  const accepted = approvals.filter(
    (a) =>
      a.operation === operation &&
      a.target === target &&
      a.candidateId === candidate.candidateId &&
      a.version === version &&
      a.sourceCommit === candidate.sourceCommit &&
      a.humanInput.trim() &&
      Number.isFinite(Date.parse(a.approvedAt)),
  );
  if (!target || !accepted.length) missing.push(`approval:${operation}`);
  return {
    schemaVersion: 1,
    decisionId: randomUUID(),
    candidateId: candidate.candidateId,
    approvalIds: accepted.map((a) => a.approvalId),
    evidenceIds: [...evidenceIds],
    version,
    tag: `v${version}`,
    distTag: channel === 'rc' ? 'next' : 'latest',
    channel,
    allowed: missing.length === 0,
    missing,
    outcome: missing.length ? 'blocked' : 'not-run',
  };
}

// scripts/release/publication.ts
function validatePublicationIdentity(i) {
  requireCondition(
    i &&
      /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(
        i.repository,
      ),
    'publication repository required',
  );
  requireCondition(
    i.workflow === 'publish.yml' &&
      /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(i.environment),
    'publication workflow/environment invalid',
  );
  requireCondition(
    /^[a-f0-9]{40,64}$/.test(i.sourceCommit),
    'publication source commit invalid',
  );
  requireCondition(
    i.tag === `v${i.version}` &&
      i.distTag ===
        (publicationChannel(i.version) === 'stable' ? 'latest' : 'next'),
    'publication version/tag/dist-tag differs',
  );
  return i;
}
function members(tarball) {
  const rows = execFileSync('tar', ['-tzvf', tarball], { encoding: 'utf8' })
    .trim()
    .split(`
`);
  requireCondition(
    rows.every((row) => row[0] === '-'),
    'archive links/directories refused',
  );
  const paths = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
    .trim()
    .split(`
`);
  requireCondition(
    paths.every(
      (path) =>
        path.startsWith('package/') &&
        !path.includes('..') &&
        !path.includes('\\'),
    ),
    'unsafe archive path',
  );
  const inventory = paths.map((path) => path.slice(8));
  unique(inventory, 'archive path');
  requireCondition(
    JSON.stringify([...inventory].sort()) ===
      JSON.stringify([...PACKAGE_FILES].sort()),
    'archive inventory differs',
  );
  return inventory;
}
var extract = (path, member) =>
  execFileSync('tar', ['-xOzf', path, `package/${member}`], {
    maxBuffer: 64 * 1024 * 1024,
  });
function manifestIdentity(manifest, i) {
  requireCondition(
    manifest.name === '@aletheia-works/formicarium' &&
      manifest.version === i.version &&
      manifest.private === false,
    'public manifest identity/private differs',
  );
  requireCondition(
    manifest.repository?.type === 'git' &&
      manifest.repository.url === `git+https://github.com/${i.repository}.git`,
    'public repository differs',
  );
  requireCondition(
    manifest.publishConfig?.registry === 'https://registry.npmjs.org/' &&
      manifest.publishConfig.access === 'public',
    'public registry/access differs',
  );
  requireCondition(
    manifest.type === 'module' &&
      Object.keys(manifest.exports ?? {}).length === 6 &&
      !manifest.scripts &&
      !manifest.devDependencies,
    'public surface differs',
  );
}
async function preparePublication({
  originalManifestPath,
  originalTarballPath,
  out,
  identity,
}) {
  validatePublicationIdentity(identity);
  const original = JSON.parse(
    (
      await readBoundedFile(originalManifestPath, ASSET_LIMITS.metadataBytes)
    ).toString(),
  );
  const archive = resolve2(originalTarballPath);
  const originalSha = sha256(await readFile2(archive));
  requireCondition(
    original.tarball?.sha256 === originalSha &&
      original.blinkSourceDirty === false,
    'original candidate binding differs',
  );
  const inventory = members(archive);
  requireCondition(
    Array.isArray(original.files) && original.files.length === inventory.length,
    'original manifest inventory differs',
  );
  unique(
    original.files.map((row) => row.path),
    'original manifest path',
  );
  const contents = new Map();
  for (const path of inventory) {
    const bytes = extract(archive, path);
    requireCondition(
      original.files.find((row) => row.path === path)?.sha256 === sha256(bytes),
      'original archive digest differs',
    );
    contents.set(path, bytes);
  }
  const old = JSON.parse(contents.get('package.json').toString());
  requireCondition(
    old.name === '@aletheia-works/formicarium' &&
      old.private === true &&
      typeof old.version === 'string' &&
      !old.scripts &&
      !old.devDependencies,
    'original manifest not reviewed private candidate',
  );
  publicationChannel(old.version);
  const manifest = {
    ...old,
    version: identity.version,
    private: false,
    repository: {
      type: 'git',
      url: `git+https://github.com/${identity.repository}.git`,
    },
    publishConfig: {
      registry: 'https://registry.npmjs.org/',
      access: 'public',
    },
  };
  manifestIdentity(manifest, identity);
  contents.set(
    'package.json',
    Buffer.from(
      JSON.stringify(manifest, null, 2) +
        `
`,
    ),
  );
  const destination = resolve2(out);
  await mkdir2(destination, { recursive: false });
  for (const [path, bytes] of contents) {
    await mkdir2(dirname(resolve2(destination, path)), { recursive: true });
    await writeFile2(resolve2(destination, path), bytes, { flag: 'wx' });
  }
  const candidate = {
    schemaVersion: 1,
    identity,
    package: '@aletheia-works/formicarium',
    originalTarballSha256: originalSha,
    files: [...contents].map(([path, bytes]) => ({
      path,
      sha256: sha256(bytes),
    })),
    tarball: null,
  };
  await writeFile2(
    `${destination}.publication.json`,
    JSON.stringify(candidate, null, 2) +
      `
`,
    { flag: 'wx' },
  );
  return candidate;
}
async function validatePublication(candidate, identity, tarballPath) {
  validatePublicationIdentity(identity);
  requireCondition(
    candidate.schemaVersion === 1 &&
      candidate.package === '@aletheia-works/formicarium' &&
      hex(candidate.originalTarballSha256) &&
      JSON.stringify(candidate.identity) === JSON.stringify(identity),
    'publication candidate identity differs',
  );
  const inventory = members(tarballPath);
  requireCondition(
    candidate.files.length === inventory.length,
    'publication files differ',
  );
  unique(
    candidate.files.map((row) => row.path),
    'publication manifest path',
  );
  for (const path of inventory)
    requireCondition(
      candidate.files.find((row) => row.path === path)?.sha256 ===
        sha256(extract(tarballPath, path)),
      'publication archive digest differs',
    );
  manifestIdentity(
    JSON.parse(extract(tarballPath, 'package.json').toString()),
    identity,
  );
  const digest = sha256(await readFile2(tarballPath));
  if (candidate.tarball)
    requireCondition(
      candidate.tarball.sha256 === digest,
      'publication tarball digest differs',
    );
  return {
    ...candidate,
    tarball: { path: resolve2(tarballPath), sha256: digest },
  };
}
async function planPublication(root, request) {
  const i = validatePublicationIdentity(request.identity),
    p = request.publisher;
  requireCondition(
    request.candidate.sourceCommit === i.sourceCommit &&
      request.candidate.version === i.version,
    'publication evidence candidate differs',
  );
  requireCondition(
    p?.status === 'observed' &&
      p.authentication === 'oidc' &&
      p.allowedAction === 'publish' &&
      p.repository === i.repository &&
      p.workflow === i.workflow &&
      p.environment === i.environment &&
      Number.isFinite(Date.parse(p.observedAt)) &&
      hex(p.observationSha256),
    'publisher not observed or differs',
  );
  requireCondition(
    sha256(
      await artifactBytes(
        root,
        p.observationArtifact,
        ASSET_LIMITS.metadataBytes,
      ),
    ) === p.observationSha256,
    'publisher observation digest differs',
  );
  const observation = JSON.parse(
    (
      await artifactBytes(
        root,
        p.observationArtifact,
        ASSET_LIMITS.metadataBytes,
      )
    ).toString(),
  );
  requireCondition(
    observation.kind === 'npm-settings-observation' &&
      observation.package === '@aletheia-works/formicarium' &&
      observation.repository === i.repository &&
      observation.workflow === i.workflow &&
      observation.environment === i.environment &&
      observation.allowedAction === 'publish' &&
      observation.observedAt === p.observedAt &&
      observation.simulated === false,
    'publisher observation content differs',
  );
  const decision = await decideRelease({
    root,
    index: request.index,
    candidate: request.candidate,
    evidenceIds: request.evidenceIds,
    approvals: request.approvals,
    target: `https://registry.npmjs.org/@aletheia-works/formicarium`,
    channel: publicationChannel(i.version),
  });
  if (!decision.allowed) return decision;
  const envelopes = await Promise.all(
    request.evidenceIds.map((id) => resolveEvidence(root, request.index, id)),
  );
  const missing = [...decision.missing];
  for (const id of REGRESSION_CHECKS) {
    const rows = envelopes.flatMap((e) =>
      e.checks.filter((c) => c.checkId === id),
    );
    if (
      !rows.length ||
      rows.some(
        (c) =>
          c.status !== 'passed' ||
          c.exitCode !== 0 ||
          c.termination !== 'exit' ||
          c.unverified.length,
      )
    )
      missing.push(`publication-check:${id}`);
  }
  if (
    !envelopes.some((e) => {
      if (
        !e.coverage ||
        e.coverage.files.some(
          (f) =>
            f.collection === 'missing' ||
            (f.collection === 'measured' && !f.realms.length),
        )
      )
        return false;
      const total = e.coverage.files.reduce((sum, f) => sum + f.totalLines, 0);
      return (
        total > 0 &&
        e.coverage.files.reduce((sum, f) => sum + f.coveredLines, 0) / total >=
          0.8
      );
    })
  )
    missing.push('publication-coverage:fixed-80%-realms');
  return {
    ...decision,
    missing,
    allowed: missing.length === 0,
    outcome: missing.length ? 'blocked' : 'not-run',
  };
}

// scripts/ci/quality-evidence.ts
import { createHash as createHash3 } from 'node:crypto';
// scripts/release/publication-evidence.ts
import { resolve as resolve3 } from 'node:path';

var digest = (bytes) => createHash3('sha256').update(bytes).digest('hex');
function validateIdentity(evidence, observed) {
  if (
    evidence.schemaVersion !== 1 ||
    !/^[a-f0-9]{40}$/.test(evidence.sourceSha)
  )
    throw Error('invalid evidence schema or source SHA');
  if (!Number.isSafeInteger(evidence.runAttempt) || evidence.runAttempt < 1)
    throw Error('invalid run attempt');
  for (const key of [
    'repository',
    'sourceSha',
    'runId',
    'runAttempt',
    'workflowIdentity',
    'purpose',
    'toolchainRevision',
  ])
    if (!evidence[key] || evidence[key] !== observed[key])
      throw Error(`evidence identity differs: ${key}`);
  if (!['ordinary-ci', 'publication-candidate'].includes(evidence.purpose))
    throw Error('unknown evidence purpose');
  if (evidence.artifactDigest !== digest(observed.artifactBytes))
    throw Error('artifact digest differs');
}
function validateCheckSet(checks, observed) {
  const required = observed.requiredChecks;
  if (
    !Array.isArray(required) ||
    required.some(
      (row) =>
        !row ||
        typeof row.name !== 'string' ||
        !row.name.trim() ||
        typeof row.producerIdentity !== 'string' ||
        !row.producerIdentity.trim(),
    )
  )
    throw Error('invalid required check name or producer');
  if (
    !required.length ||
    new Set(required.map((row) => row.name)).size !== required.length
  )
    throw Error('required check policy empty or duplicated');
  for (const rows of [checks, observed.checks])
    if (
      !Array.isArray(rows) ||
      rows.some(
        (row) =>
          !row ||
          typeof row.name !== 'string' ||
          typeof row.producerIdentity !== 'string' ||
          typeof row.sourceSha !== 'string' ||
          typeof row.runId !== 'string' ||
          typeof row.state !== 'string',
      ) ||
      new Set(rows.map((row) => row.name)).size !== rows.length
    )
      throw Error('missing or duplicate check evidence');
  if (
    checks.length !== required.length ||
    observed.checks.length !== required.length
  )
    throw Error('mandatory check inventory differs');
  for (const rule of required) {
    const submitted = checks.find((row) => row.name === rule.name);
    const actual = observed.checks.find((row) => row.name === rule.name);
    for (const row of [submitted, actual])
      if (
        !row ||
        row.producerIdentity !== rule.producerIdentity ||
        row.sourceSha !== observed.sourceSha ||
        row.runId !== observed.runId ||
        row.state !== 'success'
      )
        throw Error(
          `check missing, stale, untrusted or unsuccessful: ${rule.name}`,
        );
  }
}
function validateCoverage(evidence, observed) {
  if (evidence.purpose !== 'publication-candidate') return;
  const actual = observed.coverage;
  const claimed = evidence.coverage;
  if (!actual || !claimed) throw Error('candidate coverage missing');
  for (const key of [
    'inventoryDigest',
    'receiptsDigest',
    'coveredLines',
    'totalLines',
  ])
    if (claimed[key] !== actual[key])
      throw Error(`candidate coverage differs: ${key}`);
  if (
    ![claimed.inventoryDigest, claimed.receiptsDigest].every((value) =>
      /^[a-f0-9]{64}$/.test(value),
    ) ||
    !Number.isSafeInteger(claimed.totalLines) ||
    claimed.totalLines < 1 ||
    !Number.isSafeInteger(claimed.coveredLines) ||
    claimed.coveredLines < 0 ||
    claimed.coveredLines > claimed.totalLines ||
    claimed.coveredLines / claimed.totalLines < 0.8
  )
    throw Error('fixed inventory coverage below 80% or invalid');
}
function validateEvidence2(evidence, observed) {
  if (
    !evidence ||
    !observed ||
    typeof evidence !== 'object' ||
    typeof observed !== 'object'
  )
    throw Error('evidence and trusted observation objects required');
  validateIdentity(evidence, observed);
  validateCheckSet(evidence.checks, observed);
  validateCoverage(evidence, observed);
  return evidence;
}

// scripts/ci/verification.ts
var REQUIRED_CHECKS = Object.freeze([
  'release',
  'node-regression',
  'browser-regression',
  'native-aube',
  'native-pitchfork',
  'u1-node',
  'u1-browser',
  'u3-node',
  'u3-browser',
]);
function validateChecks(results) {
  if (
    results.length !== REQUIRED_CHECKS.length ||
    new Set(results.map((row) => row.id)).size !== results.length
  )
    throw Error('mandatory check inventory differs');
  for (const id of REQUIRED_CHECKS) {
    const result = results.find((row) => row.id === id);
    if (
      result?.exitCode !== 0 ||
      result.timedOut ||
      result.skipped !== 0 ||
      result.passed < 1
    )
      throw Error(`mandatory check failed or unmeasured: ${id}`);
  }
}

// scripts/release/publication-evidence.ts
async function readPublicationPolicy(root) {
  const bytes = await readBoundedFile(
    resolve3(root, '.github/publication/trusted-policy.json'),
    ASSET_LIMITS.metadataBytes,
  );
  requireCondition(
    bytes.length <= 8 * 1024 * 1024,
    'publication policy oversized',
  );
  return JSON.parse(bytes.toString()).evidence;
}
function publicationProducer(policy) {
  requireCondition(
    policy &&
      Number.isSafeInteger(policy.workflowId) &&
      (policy.workflowId ?? 0) > 0 &&
      Number.isSafeInteger(policy.producerAppId) &&
      (policy.producerAppId ?? 0) > 0 &&
      policy.repository === 'aletheia-works/formicarium' &&
      policy.workflowIdentity === '.github/workflows/candidate-verify.yml' &&
      policy.toolchainRevision === 'bun1.4.2-node24.21.0' &&
      Array.isArray(policy.requiredChecks) &&
      policy.requiredChecks.length > 0 &&
      policy.requiredChecks.every(
        (name) =>
          typeof name === 'string' && name.trim() === name && name.length > 0,
      ) &&
      new Set(policy.requiredChecks).size === policy.requiredChecks.length,
    'publication trusted policy incomplete',
  );
  return `${policy.producerAppId}:${policy.workflowId}:${policy.workflowIdentity}`;
}
async function verifyPublicationEvidence(
  root,
  request,
  envelope,
  observation,
  policy,
) {
  const producerIdentity = publicationProducer(policy);
  requireCondition(
    envelope.purpose === 'publication-candidate' &&
      observation.purpose === 'publication-candidate',
    'publication candidate purpose required',
  );
  requireCondition(
    envelope.repository === policy.repository &&
      envelope.repository === request.identity.repository &&
      envelope.sourceSha === request.identity.sourceCommit &&
      envelope.sourceSha === request.candidate.sourceCommit &&
      envelope.workflowIdentity === policy.workflowIdentity &&
      envelope.toolchainRevision === policy.toolchainRevision,
    'publication candidate identity differs',
  );
  validateEvidence2(envelope, {
    ...observation,
    requiredChecks: policy.requiredChecks.map((name) => ({
      name,
      producerIdentity,
    })),
  });
  requireCondition(
    request.evidenceIds.length > 0,
    'publication release evidence empty',
  );
  const rows = await Promise.all(
    request.evidenceIds.map((id) => resolveEvidence(root, request.index, id)),
  );
  let matchingCoverage = false;
  for (const row of rows) {
    requireCondition(
      JSON.stringify(row.candidate) === JSON.stringify(request.candidate),
      'publication signed candidate differs',
    );
    const coverage = row.coverage;
    if (!coverage) continue;
    const report = JSON.parse(
      (
        await artifactBytes(
          root,
          coverage.reportArtifact,
          ASSET_LIMITS.metadataBytes,
        )
      ).toString(),
    );
    const totalLines = coverage.files.reduce(
      (sum, file) => sum + file.totalLines,
      0,
    );
    const coveredLines = coverage.files.reduce(
      (sum, file) => sum + file.coveredLines,
      0,
    );
    if (
      coverage.files.every(
        (file) =>
          file.collection !== 'missing' &&
          (file.collection !== 'measured' || file.realms.length > 0),
      ) &&
      envelope.coverage?.inventoryDigest === coverage.inventorySha256 &&
      envelope.coverage.receiptsDigest ===
        digest(JSON.stringify(report.freshReceipts)) &&
      envelope.coverage.totalLines === totalLines &&
      envelope.coverage.coveredLines === coveredLines
    )
      matchingCoverage = true;
  }
  requireCondition(
    matchingCoverage,
    'publication fixed inventory/realm coverage differs',
  );
  const decision = await planPublication(root, request);
  requireCondition(
    decision.allowed,
    `publication blocked: ${decision.missing.join(',')}`,
  );
  return { envelope, decision };
}
async function acquirePublicationEvidence(
  root,
  request,
  policy,
  token,
  fetcher = fetch,
) {
  const producerIdentity = publicationProducer(policy),
    candidate = request.candidateRun;
  requireCondition(
    candidate &&
      [candidate.runId, candidate.runAttempt, candidate.artifactId].every(
        (value) => Number.isSafeInteger(value) && value > 0,
      ),
    'publication candidate API reference required',
  );
  const prefix = `https://api.github.com/repos/${policy.repository}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const json = async (path) =>
    JSON.parse(
      (
        await fetchAsset(
          prefix + path,
          ASSET_LIMITS.metadataBytes,
          fetcher,
          headers,
        )
      ).toString(),
    );
  const run = await json(`/actions/runs/${candidate.runId}`);
  requireCondition(
    run.id === candidate.runId &&
      run.run_attempt === candidate.runAttempt &&
      run.repository?.full_name === policy.repository &&
      run.head_sha === request.identity.sourceCommit &&
      run.workflow_id === policy.workflowId &&
      run.path === policy.workflowIdentity &&
      run.event === 'workflow_dispatch' &&
      run.status === 'completed' &&
      run.conclusion === 'success',
    'publication candidate run differs',
  );
  const jobs = await json(
    `/actions/runs/${candidate.runId}/attempts/${candidate.runAttempt}/jobs?per_page=100`,
  );
  requireCondition(
    jobs.total_count <= 100 && Array.isArray(jobs.jobs),
    'publication candidate job pagination refused',
  );
  const checks = [];
  for (const name of policy.requiredChecks) {
    const matches = jobs.jobs.filter((job) => job.name === name);
    requireCondition(
      matches.length === 1 &&
        matches[0].conclusion === 'success' &&
        matches[0].run_attempt === candidate.runAttempt &&
        typeof matches[0].check_run_url === 'string' &&
        matches[0].check_run_url.startsWith(`${prefix}/check-runs/`),
      'publication candidate job differs',
    );
    const check = JSON.parse(
      (
        await fetchAsset(
          matches[0].check_run_url,
          ASSET_LIMITS.metadataBytes,
          fetcher,
          headers,
        )
      ).toString(),
    );
    requireCondition(
      check.name === name &&
        check.head_sha === request.identity.sourceCommit &&
        check.app?.id === policy.producerAppId &&
        check.check_suite?.id === run.check_suite_id &&
        check.status === 'completed' &&
        check.conclusion === 'success',
      'publication candidate producer differs',
    );
    checks.push({
      name,
      sourceSha: check.head_sha,
      state: 'success',
      runId: String(candidate.runId),
      producerIdentity,
    });
  }
  const item = await json(`/actions/artifacts/${candidate.artifactId}`);
  requireCondition(
    item.id === candidate.artifactId &&
      item.expired === false &&
      item.name ===
        `modernization-${request.identity.sourceCommit}-${candidate.runId}-${candidate.runAttempt}` &&
      item.workflow_run?.id === candidate.runId &&
      item.workflow_run?.head_sha === request.identity.sourceCommit &&
      /^sha256:[a-f0-9]{64}$/.test(item.digest),
    'publication candidate artifact differs',
  );
  const bytes = await fetchAsset(
    `${prefix}/actions/artifacts/${candidate.artifactId}/zip`,
    ASSET_LIMITS.inputBytes,
    fetcher,
    headers,
    policy.archiveRedirectHosts ?? [],
  );
  requireCondition(
    item.digest === `sha256:${digest(bytes)}`,
    'publication candidate API digest differs',
  );
  const files = unpackZip(bytes);
  const acceptanceBytes = files.get('ci-results/acceptance.json'),
    reportBytes = files.get('ci-coverage-fixed24/report.json');
  requireCondition(
    acceptanceBytes &&
      reportBytes &&
      acceptanceBytes.length <= ASSET_LIMITS.metadataBytes &&
      reportBytes.length <= ASSET_LIMITS.metadataBytes,
    'publication candidate receipt missing',
  );
  const acceptance = JSON.parse(acceptanceBytes.toString()),
    report = JSON.parse(reportBytes.toString());
  validateChecks(acceptance.checks);
  requireCondition(
    acceptance.passed === true &&
      acceptance.context?.repository === policy.repository &&
      acceptance.context?.commit === request.identity.sourceCommit &&
      acceptance.context?.event === 'workflow_dispatch' &&
      JSON.stringify(acceptance.coverage) === JSON.stringify(report) &&
      report.passed === true &&
      report.candidateSha256 === request.candidate.tarballSha256 &&
      Array.isArray(report.files) &&
      Array.isArray(report.fixedInventory) &&
      Array.isArray(report.freshReceipts),
    'publication candidate receipt binding differs',
  );
  const releaseRows = await Promise.all(
    request.evidenceIds.map((id) => resolveEvidence(root, request.index, id)),
  );
  let exactReport = false;
  for (const row of releaseRows) {
    if (
      row.coverage?.binding.candidateSha256 ===
        request.candidate.tarballSha256 &&
      digest(
        await artifactBytes(
          root,
          row.coverage.reportArtifact,
          ASSET_LIMITS.metadataBytes,
        ),
      ) === digest(reportBytes)
    )
      exactReport = true;
  }
  requireCondition(
    exactReport,
    'publication candidate coverage source differs',
  );
  const coverage = {
    inventoryDigest: digest(JSON.stringify(report.fixedInventory)),
    receiptsDigest: digest(JSON.stringify(report.freshReceipts)),
    totalLines: report.files.reduce((sum, row) => sum + row.lines.total, 0),
    coveredLines: report.files.reduce((sum, row) => sum + row.lines.covered, 0),
  };
  const observation = {
    repository: policy.repository,
    sourceSha: request.identity.sourceCommit,
    runId: String(candidate.runId),
    runAttempt: candidate.runAttempt,
    workflowIdentity: policy.workflowIdentity,
    purpose: 'publication-candidate',
    toolchainRevision: policy.toolchainRevision,
    checks,
    requiredChecks: policy.requiredChecks.map((name) => ({
      name,
      producerIdentity,
    })),
    artifactBytes: bytes,
    coverage,
  };
  const envelope = {
    ...observation,
    schemaVersion: 1,
    artifactDigest: digest(bytes),
  };
  return { envelope, observation };
}

// scripts/release/workflow.ts
function assertPublicationContext(i, c) {
  validatePublicationIdentity(i);
  requireCondition(
    c.event === 'push' &&
      c.repository === i.repository &&
      c.ref === `refs/tags/${i.tag}` &&
      c.sha === i.sourceCommit,
    'untrusted publication context',
  );
}
function validatePublishWorkflow(text) {
  const w = JSON.parse(text);
  requireCondition(
    JSON.stringify(w.on) === JSON.stringify({ push: { tags: ['v*'] } }),
    'publication triggers differ',
  );
  requireCondition(
    JSON.stringify(w.permissions) === JSON.stringify({ contents: 'read' }),
    'global publication permissions differ',
  );
  requireCondition(
    w.concurrency?.group === 'publication-${{ github.ref }}' &&
      w.concurrency['cancel-in-progress'] === false,
    'publication concurrency differs',
  );
  requireCondition(
    JSON.stringify(Object.keys(w.jobs).sort()) ===
      JSON.stringify(['publish', 'release', 'verify']),
    'publication jobs differ',
  );
  for (const [name, job] of Object.entries(w.jobs)) {
    requireCondition(
      job['runs-on'] === 'ubuntu-24.04' && job['timeout-minutes'] === 30,
      'publication runner/time limit differs',
    );
    const expected =
      name === 'publish'
        ? {
            contents: 'read',
            actions: 'read',
            checks: 'read',
            'id-token': 'write',
          }
        : name === 'release'
          ? { contents: 'write', actions: 'read', checks: 'read' }
          : { contents: 'read', actions: 'read', checks: 'read' };
    requireCondition(
      JSON.stringify(job.permissions) === JSON.stringify(expected),
      'job permissions differ',
    );
    requireCondition(
      job.if ===
        "github.event_name == 'push' && github.repository == 'aletheia-works/formicarium' && startsWith(github.ref, 'refs/tags/v')",
      'job origin gate differs',
    );
    if (name !== 'verify')
      requireCondition(
        job.environment === 'release' &&
          job.needs === (name === 'publish' ? 'verify' : 'publish'),
        'publication environment/dependency differs',
      );
    requireCondition(
      !JSON.stringify(job).match(
        /NODE_AUTH_TOKEN|NPM_TOKEN|_authToken|secrets\./,
      ),
      'token fallback refused',
    );
    for (const step of job.steps)
      if (step.uses)
        requireCondition(
          /^[^\s]+@[a-f0-9]{40}$/.test(step.uses),
          'action not pinned',
        );
    const checkout = job.steps.find((s) =>
      s.uses?.startsWith('actions/checkout@'),
    );
    requireCondition(
      checkout?.with?.ref === '${{ github.sha }}' &&
        checkout.with['persist-credentials'] === false,
      'trusted exact tag checkout missing',
    );
    const runs = job.steps.filter((s) => s.run).map((s) => s.run);
    if (name === 'verify') {
      requireCondition(
        runs.includes('bun install --frozen-lockfile --ignore-scripts') &&
          runs.includes('bun run build'),
        'Bun verification tasks missing',
      );
      requireCondition(
        runs.includes(
          'node .github/publication/runner.mjs gate .artifacts/publication',
        ) &&
          runs.includes(
            'node .github/publication/runner.mjs prepare-assets .artifacts/publication .artifacts/publication-assets',
          ),
        'publication gate missing',
      );
      const upload = job.steps.find((s) =>
        s.uses?.startsWith('actions/upload-artifact@'),
      );
      requireCondition(
        upload?.with?.name === 'publication-assets' &&
          upload.with.path === '.artifacts/publication-assets/*' &&
          upload.with['if-no-files-found'] === 'error',
        'transfer artifact differs',
      );
      requireCondition(
        !runs.some((r) =>
          /npm publish|bootstrap.mjs (publish|release)/.test(r),
        ),
        'writer in verification refused',
      );
    } else {
      requireCondition(
        runs.length === 1 &&
          runs[0] === `node .github/publication/bootstrap.mjs ${name}`,
        'unvalidated publication command/gate',
      );
      requireCondition(
        job.env?.AIDLC_RELEASE_OPERATION === name,
        'publication operation differs',
      );
      requireCondition(
        !job.steps.some(
          (s) =>
            s.uses && !/^(actions\/checkout|actions\/setup-node)@/.test(s.uses),
        ),
        'writer action refused',
      );
    }
  }
  return w;
}

// scripts/release/publication-cli.ts
var json = async (path) =>
  JSON.parse(
    (await readBoundedFile(path, ASSET_LIMITS.metadataBytes)).toString(),
  );
async function gatePublication(
  root,
  boundary = { policyRoot: process.cwd(), fetcher: fetch },
) {
  const request = JSON.parse(
    (
      await artifactBytes(root, 'request.json', ASSET_LIMITS.metadataBytes)
    ).toString(),
  );
  const manifest = JSON.parse(
    (
      await artifactBytes(root, 'publication.json', ASSET_LIMITS.metadataBytes)
    ).toString(),
  );
  requireCondition(
    manifest.tarball?.path === 'candidate.tgz',
    'publication tarball path differs',
  );
  const archive = await validatePublication(
    manifest,
    request.identity,
    join2(root, 'candidate.tgz'),
  );
  requireCondition(
    request.candidate.tarballSha256 === archive.tarball.sha256,
    'request tarball differs',
  );
  for (const source of request.candidate.firstPartyJs) {
    const packed = manifest.files.find((row) => row.path === source.path);
    const actual =
      packed?.sha256 ??
      sha256(await artifactBytes(root, `sources/${source.path}`));
    requireCondition(
      actual === source.sha256,
      'request first-party source differs',
    );
  }
  const buildInfoBytes = execFileSync2('tar', [
    '-xOzf',
    join2(root, 'candidate.tgz'),
    'package/assets/build-info.json',
  ]);
  const buildInfo = JSON.parse(buildInfoBytes.toString());
  requireCondition(
    sha256(buildInfoBytes) === request.candidate.core.buildInfoSha256 &&
      buildInfo.blinkSourceDirty === false &&
      buildInfo.blinkCommit === request.candidate.core.sourceCommit,
    'request core provenance differs',
  );
  assertPublicationContext(request.identity, {
    event: process.env.GITHUB_EVENT_NAME ?? '',
    repository: process.env.GITHUB_REPOSITORY ?? '',
    ref: process.env.GITHUB_REF ?? '',
    sha: process.env.GITHUB_SHA ?? '',
  });
  requireCondition(
    request.identity.repository === 'aletheia-works/formicarium' &&
      request.identity.environment === 'release',
    'publication target tuple differs',
  );
  validatePublishWorkflow(
    await readFile3('.github/workflows/publish.yml', 'utf8'),
  );
  const decision = await planPublication(root, request);
  requireCondition(
    decision.allowed,
    `publication blocked: ${decision.missing.join(',')}`,
  );
  const policy = await readPublicationPolicy(boundary.policyRoot);
  const independent = await acquirePublicationEvidence(
    root,
    request,
    policy,
    process.env.GH_TOKEN ?? '',
    boundary.fetcher,
  );
  await verifyPublicationEvidence(
    root,
    request,
    independent.envelope,
    independent.observation,
    policy,
  );
  return { request, decision, archive };
}
async function fetchBundle(out) {
  const url = process.env.FORMICARIUM_RELEASE_INPUT_URL ?? '',
    digest = process.env.FORMICARIUM_RELEASE_INPUT_SHA256;
  requireCondition(
    new URL(url).protocol === 'https:' && hex(digest),
    'reviewed release inputs missing',
  );
  const bytes = await fetchAsset(url, ASSET_LIMITS.inputBytes);
  requireCondition(
    bytes.length < 256 * 1024 * 1024 && sha256(bytes) === digest,
    'release input digest differs',
  );
  await mkdir3(dirname2(resolve4(out)), { recursive: true });
  await writeFile3(`${resolve4(out)}.tgz`, bytes, { flag: 'wx' });
  await mkdir3(resolve4(out), { recursive: false });
  for (const [name, content] of unpackTar(
    bytes,
    ASSET_LIMITS.expandedBytes,
    ASSET_LIMITS.members,
  )) {
    const path = join2(resolve4(out), safeAssetPath(name));
    await mkdir3(dirname2(path), { recursive: true });
    await writeFile3(path, content, { flag: 'wx' });
  }
}
var executePublication = (executable, args, options) => {
  execFileSync2(executable, [...args], options);
};
async function publicationCli(args, executor = executePublication, boundary) {
  const [command, ...paths] = args;
  if (command === 'prepare' && paths.length === 4)
    return preparePublication({
      originalManifestPath: paths[0],
      originalTarballPath: paths[1],
      out: paths[2],
      identity: await json(paths[3]),
    });
  if (command === 'validate' && paths.length === 3)
    return validatePublication(
      await json(paths[0]),
      await json(paths[1]),
      paths[2],
    );
  if (command === 'plan' && paths.length === 2)
    return planPublication(paths[0], await json(paths[1]));
  if (command === 'fetch' && paths.length === 1) {
    await fetchBundle(paths[0]);
    return { outcome: 'downloaded-not-published' };
  }
  if (
    ['gate', 'publish', 'release', 'prepare-assets'].includes(command ?? '') &&
    paths.length === (command === 'prepare-assets' ? 2 : 1)
  ) {
    const result = await gatePublication(paths[0], boundary);
    if (command === 'gate') return result.decision;
    if (command === 'prepare-assets') {
      const policyRoot = boundary?.policyRoot ?? process.cwd();
      const npm = await fetchAsset(
        NPM_ASSET.url,
        ASSET_LIMITS.npmBytes,
        boundary?.fetcher ?? fetch,
      );
      npmFiles(npm);
      const inputs = await readFile3(`${resolve4(paths[0])}.tgz`);
      requireCondition(
        sha256(inputs) === process.env.FORMICARIUM_RELEASE_INPUT_SHA256,
        'transfer input digest differs',
      );
      unpackTar(inputs, ASSET_LIMITS.expandedBytes, ASSET_LIMITS.members);
      const output = resolve4(paths[1]);
      await mkdir3(output);
      for (const name of [
        'runner.mjs',
        'runner-manifest.json',
        'trusted-policy.json',
      ]) {
        await writeFile3(
          join2(output, name),
          await readFile3(join2(policyRoot, '.github/publication', name)),
          { flag: 'wx' },
        );
      }
      await writeFile3(join2(output, 'npm.tgz'), npm, { flag: 'wx' });
      await writeFile3(join2(output, 'inputs.tgz'), inputs, { flag: 'wx' });
      return { outcome: 'verified-transfer-prepared-not-published' };
    }
    if (command === 'publish') {
      requireCondition(
        process.env.AIDLC_RELEASE_OPERATION === 'publish' &&
          Boolean(process.env.ACTIONS_ID_TOKEN_REQUEST_URL) &&
          !process.env.NODE_AUTH_TOKEN &&
          !process.env.NPM_TOKEN,
        'isolated OIDC publish job required',
      );
      const npmConfig = `${resolve4(paths[0])}.empty-npmrc`;
      const npmCli = process.env.FORMICARIUM_NPM_CLI ?? '';
      requireCondition(
        npmCli.startsWith('/') &&
          npmCli.endsWith('/package/bin/npm-cli.js') &&
          (await json(resolve4(dirname2(npmCli), '../package.json')))
            .version === '11.19.0',
        'fixed verified npm CLI required',
      );
      await writeFile3(npmConfig, '', { flag: 'wx' });
      const cleanEnvironment = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !/^(npm_config_|node_auth_token$|npm_token$)/i.test(key),
        ),
      );
      executor(
        process.execPath,
        [
          npmCli,
          'publish',
          join2(resolve4(paths[0]), 'candidate.tgz'),
          '--access',
          'public',
          '--registry',
          'https://registry.npmjs.org/',
          '--tag',
          result.request.identity.distTag,
          '--ignore-scripts',
        ],
        {
          cwd: resolve4(paths[0]),
          stdio: 'inherit',
          env: {
            ...cleanEnvironment,
            NPM_CONFIG_USERCONFIG: npmConfig,
            NPM_CONFIG_GLOBALCONFIG: '/dev/null',
            NPM_CONFIG_PROVENANCE: 'true',
          },
        },
      );
      return { outcome: 'publish-command-completed-readback-required' };
    }
    requireCondition(
      process.env.AIDLC_RELEASE_OPERATION === 'release',
      'isolated release job required',
    );
    requireCondition(
      result.request.approvals.some(
        (a) =>
          a.operation === 'create-github-release' &&
          a.target === result.request.identity.repository &&
          a.candidateId === result.request.candidate.candidateId &&
          a.version === result.request.identity.version &&
          a.sourceCommit === result.request.identity.sourceCommit &&
          a.humanInput.trim() &&
          Number.isFinite(Date.parse(a.approvedAt)),
      ),
      'GitHub Release approval missing',
    );
    executor(
      'gh',
      [
        'release',
        'create',
        result.request.identity.tag,
        join2(resolve4(paths[0]), 'candidate.tgz'),
        '--repo',
        result.request.identity.repository,
        '--verify-tag',
        '--title',
        `formicarium ${result.request.identity.version}`,
        '--notes',
        `Reviewed package SHA256: ${result.archive.tarball.sha256}`,
        ...(result.request.identity.distTag === 'next' ? ['--prerelease'] : []),
      ],
      { stdio: 'inherit' },
    );
    return { outcome: 'release-command-completed-readback-required' };
  }
  throw new Error(
    'usage: prepare <old-manifest> <old.tgz> <new-out> <identity>; validate <publication-manifest> <identity> <tgz>; plan <evidence-root> <request>; fetch|gate|publish|release <bundle-root>',
  );
}
if (
  process.argv[1] &&
  resolve4(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log(
    JSON.stringify(await publicationCli(process.argv.slice(2)), null, 2),
  );

export { gatePublication, publicationCli };
