// scripts/maintenance/runner.ts

// scripts/ci/quality-evidence.ts
import { createHash } from 'node:crypto';
import {
  readFile as readFile2,
  writeFile as writeFile2,
} from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

var digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

// scripts/maintenance/archive.ts
import { Readable } from 'node:stream';
import { createInflateRaw } from 'node:zlib';

var BYTE_LIMIT = 8 * 1024 * 1024;
var MEMBER_LIMIT = 16;

class BoundaryError extends Error {
  code;
  constructor(code) {
    super(code);
    this.code = code;
  }
}
function limitBytes(bytes, maximum = BYTE_LIMIT) {
  if (bytes.byteLength > maximum) throw new BoundaryError('BYTE_LIMIT');
  return bytes;
}
async function readBoundedStream(body, maximum = BYTE_LIMIT, signal) {
  if (!body) throw new BoundaryError('BODY_MISSING');
  const reader = body.getReader();
  const chunks = [];
  let size = 0;
  const cancel = () => {
    reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    for (;;) {
      if (signal?.aborted) throw new BoundaryError('CANCELLED');
      const row = await reader.read();
      if (signal?.aborted) throw new BoundaryError('CANCELLED');
      if (row.done) break;
      size += row.value.byteLength;
      if (size > maximum) throw new BoundaryError('BYTE_LIMIT');
      chunks.push(row.value);
    }
    const output = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return output;
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    signal?.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}
function decodeJson(bytes) {
  limitBytes(bytes);
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new BoundaryError('INVALID_JSON');
  }
}
function crc32(bytes) {
  let crc = 4294967295;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 3988292384 : 0);
  }
  return (crc ^ 4294967295) >>> 0;
}
async function inflate(bytes, maximum) {
  const decoder = createInflateRaw();
  const stream = Readable.from([bytes]).pipe(decoder);
  const chunks = [];
  let size = 0;
  try {
    for await (const raw of stream) {
      const chunk = raw;
      size += chunk.length;
      if (size > maximum) {
        decoder.destroy();
        throw new BoundaryError('BYTE_LIMIT');
      }
      chunks.push(chunk);
    }
    return new Uint8Array(Buffer.concat(chunks, size));
  } catch (error) {
    decoder.destroy();
    if (error instanceof BoundaryError) throw error;
    throw new BoundaryError('INVALID_ZIP');
  }
}
async function unpackArchive(raw, allowedNames = ['receipt.json']) {
  const bytes = limitBytes(raw);
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at) => data.getUint16(at, true);
  const u32 = (at) => data.getUint32(at, true);
  try {
    let end = -1;
    for (
      let at = bytes.length - 22;
      at >= Math.max(0, bytes.length - 65557);
      at--
    ) {
      if (u32(at) === 101010256 && at + 22 + u16(at + 20) === bytes.length) {
        end = at;
        break;
      }
    }
    if (end < 0 || u16(end + 4) || u16(end + 6))
      throw new BoundaryError('INVALID_ZIP');
    const count = u16(end + 10),
      centralSize = u32(end + 12),
      centralStart = u32(end + 16);
    if (!count || count > MEMBER_LIMIT || count !== u16(end + 8))
      throw new BoundaryError('MEMBER_LIMIT');
    if (centralStart + centralSize !== end)
      throw new BoundaryError('INVALID_ZIP');
    const result = new Map();
    let cursor = centralStart,
      expanded = 0;
    const localRanges = [];
    for (let index = 0; index < count; index++) {
      if (cursor + 46 > end || u32(cursor) !== 33639248)
        throw new BoundaryError('INVALID_ZIP');
      const flags = u16(cursor + 8),
        method = u16(cursor + 10),
        crc = u32(cursor + 16);
      const compressed = u32(cursor + 20),
        size = u32(cursor + 24);
      const nameLength = u16(cursor + 28),
        extraLength = u16(cursor + 30),
        commentLength = u16(cursor + 32);
      const local = u32(cursor + 42),
        mode = u32(cursor + 38) >>> 16;
      if (
        flags & ~2056 ||
        ![0, 8].includes(method) ||
        u16(cursor + 34) ||
        compressed === 4294967295 ||
        size === 4294967295 ||
        local === 4294967295 ||
        size > BYTE_LIMIT ||
        expanded + size > BYTE_LIMIT
      )
        throw new BoundaryError('INVALID_ZIP');
      const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
      const name = new TextDecoder('utf-8', { fatal: true }).decode(nameBytes);
      if (
        cursor + 46 + nameLength + extraLength + commentLength > end ||
        !name ||
        name.startsWith('/') ||
        name.includes('\\') ||
        name
          .split('/')
          .some((segment) => !segment || segment === '.' || segment === '..') ||
        /^[a-zA-Z]:/.test(name) ||
        !allowedNames.includes(name) ||
        result.has(name) ||
        ((mode & 61440) !== 0 && (mode & 61440) !== 32768)
      )
        throw new BoundaryError('UNSAFE_MEMBER');
      if (
        local + 30 > centralStart ||
        u32(local) !== 67324752 ||
        u16(local + 6) !== flags ||
        u16(local + 8) !== method ||
        u16(local + 26) !== nameLength
      )
        throw new BoundaryError('INVALID_ZIP');
      const localName = bytes.subarray(local + 30, local + 30 + nameLength);
      if (!Buffer.from(localName).equals(Buffer.from(nameBytes)))
        throw new BoundaryError('INVALID_ZIP');
      const start = local + 30 + nameLength + u16(local + 28),
        finish = start + compressed;
      if (finish > centralStart) throw new BoundaryError('INVALID_ZIP');
      let recordEnd = finish;
      if (flags & 8) {
        const descriptor = u32(finish) === 134695760 ? finish + 4 : finish;
        if (
          descriptor + 12 > centralStart ||
          u32(descriptor) !== crc ||
          u32(descriptor + 4) !== compressed ||
          u32(descriptor + 8) !== size
        )
          throw new BoundaryError('INVALID_ZIP');
        recordEnd = descriptor + 12;
      } else if (
        u32(local + 14) !== crc ||
        u32(local + 18) !== compressed ||
        u32(local + 22) !== size
      )
        throw new BoundaryError('INVALID_ZIP');
      localRanges.push([local, recordEnd]);
      const payload = bytes.subarray(start, finish);
      const output =
        method === 0
          ? limitBytes(payload, BYTE_LIMIT - expanded)
          : await inflate(payload, BYTE_LIMIT - expanded);
      if (output.length !== size || crc32(output) !== crc)
        throw new BoundaryError('INVALID_ZIP');
      expanded += output.length;
      result.set(name, output);
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    localRanges.sort((a, b) => a[0] - b[0]);
    let position = 0;
    for (const [start, finish] of localRanges) {
      if (start !== position) throw new BoundaryError('INVALID_ZIP');
      position = finish;
    }
    if (position !== centralStart || cursor !== end)
      throw new BoundaryError('INVALID_ZIP');
    return result;
  } catch (error) {
    if (error instanceof BoundaryError) throw error;
    throw new BoundaryError('INVALID_ZIP');
  }
}

// scripts/maintenance/github.ts
var clock = {
  now: () => Date.now(),
  schedule(callback, milliseconds) {
    const timer = setTimeout(callback, milliseconds);
    return () => clearTimeout(timer);
  },
};

class GitHubApi {
  started;
  token;
  transport;
  timing;
  signal;
  constructor(token, transport = fetch, timing = clock, signal) {
    this.token = token;
    this.transport = transport;
    this.timing = timing;
    this.signal = signal;
    this.started = timing.now();
  }
  url(path) {
    const url = new URL(path, 'https://api.github.com');
    if (
      url.origin !== 'https://api.github.com' ||
      url.username ||
      url.password ||
      url.hash ||
      !url.pathname.startsWith('/')
    )
      throw new BoundaryError('INVALID_ENDPOINT');
    return url;
  }
  async request(path, method, body, redirectHosts = []) {
    const write = method !== 'GET';
    const target = this.url(path);
    for (let attempt = 0; attempt <= (write ? 0 : 2); attempt++) {
      if (this.signal?.aborted) throw new BoundaryError('CANCELLED');
      const remaining = 60000 - (this.timing.now() - this.started);
      if (remaining <= 0) throw new BoundaryError('READ_BUDGET');
      const controller = new AbortController();
      const cancel = () => controller.abort();
      this.signal?.addEventListener('abort', cancel, { once: true });
      let timedOut = false;
      let rejectTimeout = () => {};
      const timeout = new Promise((_, reject) => {
        rejectTimeout = reject;
      });
      const unschedule = this.timing.schedule(
        () => {
          timedOut = true;
          controller.abort();
          rejectTimeout(new BoundaryError('REQUEST_TIMEOUT'));
        },
        Math.min(1e4, remaining),
      );
      try {
        const perform = async () => {
          const headers = {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${this.token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            ...(body !== undefined
              ? { 'Content-Type': 'application/json' }
              : {}),
          };
          let response = await this.transport(target.href, {
            method,
            headers,
            redirect: 'manual',
            signal: controller.signal,
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
          });
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            if (write || !redirectHosts.length)
              throw new BoundaryError('REDIRECT_REJECTED');
            const location = response.headers.get('location');
            if (!location) throw new BoundaryError('REDIRECT_REJECTED');
            const redirect = new URL(location);
            if (
              redirect.protocol !== 'https:' ||
              !redirectHosts.includes(redirect.hostname) ||
              redirect.username ||
              redirect.password
            )
              throw new BoundaryError('REDIRECT_REJECTED');
            await response.body?.cancel();
            response = await this.transport(redirect.href, {
              method: 'GET',
              redirect: 'error',
              signal: controller.signal,
            });
          }
          if (!response.ok) {
            await response.body?.cancel();
            throw new BoundaryError(
              response.status === 429 || response.status >= 500
                ? 'RETRYABLE_HTTP'
                : 'HTTP_REJECTED',
            );
          }
          return {
            bytes: await readBoundedStream(
              response.body,
              undefined,
              controller.signal,
            ),
            headers: response.headers,
          };
        };
        return await Promise.race([perform(), timeout]);
      } catch (error) {
        if (this.signal?.aborted) throw new BoundaryError('CANCELLED');
        const retry =
          error instanceof BoundaryError
            ? ['RETRYABLE_HTTP', 'REQUEST_TIMEOUT'].includes(error.code)
            : true;
        if (write || !retry || attempt === 2)
          throw error instanceof BoundaryError
            ? error
            : new BoundaryError(
                timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_UNKNOWN',
              );
      } finally {
        unschedule();
        this.signal?.removeEventListener('abort', cancel);
      }
    }
    throw new BoundaryError('READ_BUDGET');
  }
  async json(path) {
    return decodeJson((await this.request(path, 'GET')).bytes);
  }
  async bytes(path, redirectHosts = []) {
    return (await this.request(path, 'GET', undefined, redirectHosts)).bytes;
  }
  async writeJson(path, method, body) {
    return decodeJson((await this.request(path, method, body)).bytes);
  }
  async pages(path, collection) {
    let next = path;
    const rows = [];
    const first = this.url(path);
    const seen = new Set();
    for (let page = 0; next && page < 10; page++) {
      const url = this.url(next);
      if (url.pathname !== first.pathname || seen.has(url.href))
        throw new BoundaryError('PAGINATION_REJECTED');
      seen.add(url.href);
      const response = await this.request(url.href, 'GET');
      const parsed = decodeJson(response.bytes);
      const values = Array.isArray(parsed) ? parsed : parsed?.[collection];
      if (
        !Array.isArray(values) ||
        values.length > 100 ||
        rows.length + values.length > 1000
      )
        throw new BoundaryError('PAGINATION_REJECTED');
      rows.push(...values);
      const links = response.headers.get('link') ?? '';
      next = links.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
    }
    if (next) throw new BoundaryError('PAGINATION_REJECTED');
    return rows;
  }
}

// scripts/maintenance/input.ts
var failure = (reason) => ({
  outcome: 'reject',
  reasons: [reason],
  operation: null,
  repository: null,
  headSha: null,
  decisionId: null,
});
function requireValue(value) {
  if (!value) throw Error('invalid');
}
function identity(value, limit = 256) {
  requireValue(
    typeof value === 'string' &&
      value.length > 0 &&
      value.length <= limit &&
      value.trim() === value &&
      [...value].every((character) => {
        const code = character.charCodeAt(0);
        return code > 31 && code !== 127;
      }),
  );
}
function sha(value) {
  requireValue(typeof value === 'string' && /^[a-f0-9]{40}$/.test(value));
}
function hash(value) {
  requireValue(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value));
}
function positive(value) {
  requireValue(Number.isSafeInteger(value) && value > 0);
}
function runIdentity(value) {
  identity(value);
  requireValue(/^[1-9][0-9]*$/.test(value));
  positive(Number(value));
}
function boolean(value) {
  requireValue(typeof value === 'boolean');
}
function record(value) {
  requireValue(
    value !== null && typeof value === 'object' && !Array.isArray(value),
  );
  return value;
}
function collection(value, max) {
  requireValue(Array.isArray(value) && value.length <= max);
  return value;
}
function unique(values) {
  requireValue(new Set(values).size === values.length);
}
function canonicalPath(value) {
  identity(value, 1024);
  requireValue(
    !value.startsWith('/') &&
      !value.includes('\\') &&
      !/^[a-zA-Z]:/.test(value) &&
      value
        .split('/')
        .every(
          (segment) => segment !== '' && segment !== '.' && segment !== '..',
        ),
  );
}
function snapshot(value) {
  const ancestors = new Set();
  let count = 0;
  function copy(item, depth) {
    requireValue(++count <= 20000 && depth <= 16);
    if (item === null || typeof item === 'boolean') return item;
    if (typeof item === 'string') {
      requireValue(item.length <= 4096);
      return item;
    }
    if (typeof item === 'number') {
      requireValue(Number.isFinite(item));
      return item;
    }
    requireValue(typeof item === 'object' && item !== null);
    requireValue(!ancestors.has(item));
    const array = Array.isArray(item);
    const prototype = Object.getPrototypeOf(item);
    requireValue(
      array
        ? prototype === Array.prototype
        : prototype === Object.prototype || prototype === null,
    );
    const descriptors = Object.getOwnPropertyDescriptors(item);
    const keys = Reflect.ownKeys(descriptors);
    requireValue(keys.length <= 2000);
    ancestors.add(item);
    const output = array ? [] : {};
    if (array) {
      const length = descriptors.length?.value;
      requireValue(
        Number.isSafeInteger(length) && length >= 0 && length <= 2000,
      );
      requireValue(keys.length === length + 1);
    }
    for (const key of keys) {
      requireValue(typeof key === 'string');
      if (array && key === 'length') continue;
      requireValue(
        key !== '__proto__' && key !== 'constructor' && key !== 'prototype',
      );
      const descriptor = descriptors[key];
      requireValue(
        descriptor && 'value' in descriptor && descriptor.enumerable,
      );
      if (array) requireValue(/^(0|[1-9][0-9]*)$/.test(key));
      Object.defineProperty(output, key, {
        value: copy(descriptor.value, depth + 1),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    ancestors.delete(item);
    return output;
  }
  return copy(value, 0);
}
function parseChecks(value) {
  const rows = collection(value, 100).map((item) => {
    const row = record(item);
    identity(row.name);
    identity(row.producerIdentity);
    runIdentity(row.runId);
    sha(row.sourceSha);
    requireValue(
      ['success', 'failure', 'pending', 'skipped', 'cancelled'].includes(
        row.state,
      ),
    );
    return {
      name: row.name,
      producerIdentity: row.producerIdentity,
      runId: row.runId,
      sourceSha: row.sourceSha,
      state: row.state,
    };
  });
  unique(rows.map((row) => row.name));
  return rows.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
function parseProducers(value) {
  const rows = collection(value, 100).map((item) => {
    const row = record(item);
    identity(row.name);
    identity(row.producerIdentity);
    return { name: row.name, producerIdentity: row.producerIdentity };
  });
  requireValue(rows.length > 0);
  unique(rows.map((row) => row.name));
  return rows.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
function parseEvidence(value) {
  const row = record(value);
  requireValue(row.schemaVersion === 1);
  identity(row.repository);
  sha(row.sourceSha);
  runIdentity(row.runId);
  positive(row.runAttempt);
  identity(row.workflowIdentity);
  identity(row.toolchainRevision);
  hash(row.artifactDigest);
  requireValue(['ordinary-ci', 'publication-candidate'].includes(row.purpose));
  const result = {
    schemaVersion: 1,
    repository: row.repository,
    sourceSha: row.sourceSha,
    runId: row.runId,
    runAttempt: row.runAttempt,
    workflowIdentity: row.workflowIdentity,
    toolchainRevision: row.toolchainRevision,
    artifactDigest: row.artifactDigest,
    purpose: row.purpose,
    checks: parseChecks(row.checks),
  };
  if (row.coverage !== undefined) {
    const coverage = record(row.coverage);
    hash(coverage.inventoryDigest);
    hash(coverage.receiptsDigest);
    positive(coverage.totalLines);
    requireValue(
      Number.isSafeInteger(coverage.coveredLines) &&
        coverage.coveredLines >= 0 &&
        coverage.coveredLines <= coverage.totalLines,
    );
    result.coverage = {
      inventoryDigest: coverage.inventoryDigest,
      receiptsDigest: coverage.receiptsDigest,
      coveredLines: coverage.coveredLines,
      totalLines: coverage.totalLines,
    };
  }
  return result;
}
function strings(value, path) {
  const rows = collection(value, 100);
  for (const row of rows) {
    if (path) canonicalPath(row);
    else identity(row, 214);
  }
  unique(rows);
  return rows.sort();
}
function policy(value) {
  const row = record(value);
  identity(row.revision);
  identity(row.repository);
  identity(row.formatterRevision);
  hash(row.formatterConfigDigest);
  return {
    revision: row.revision,
    repository: row.repository,
    formatterRevision: row.formatterRevision,
    formatterConfigDigest: row.formatterConfigDigest,
    allowedFormatPaths: strings(row.allowedFormatPaths, true),
    allowedDevDependencies: strings(row.allowedDevDependencies, false),
    requiredCheckProducers: parseProducers(row.requiredCheckProducers),
  };
}
function request(value) {
  const row = record(value);
  requireValue(row.schemaVersion === 1);
  const context = record(row.context);
  identity(context.repository);
  positive(context.prNumber);
  sha(context.headSha);
  sha(context.currentHeadSha);
  for (const key of ['sameRepository', 'prOpen', 'trustedWorkflow'])
    boolean(context[key]);
  const base = {
    schemaVersion: 1,
    context: {
      repository: context.repository,
      prNumber: context.prNumber,
      headSha: context.headSha,
      currentHeadSha: context.currentHeadSha,
      sameRepository: context.sameRepository,
      prOpen: context.prOpen,
      trustedWorkflow: context.trustedWorkflow,
      evidence: parseEvidence(context.evidence),
    },
  };
  if (row.operation === 'format-push') {
    const paths = collection(row.changedPaths, 500);
    for (const path of paths) canonicalPath(path);
    unique(paths);
    for (const key of [
      'proposedDiffDigest',
      'reproducedDiffDigest',
      'trustedConfigDigest',
    ])
      hash(row[key]);
    identity(row.trustedFormatterRevision);
    for (const key of ['reproducible', 'formattingOnly', 'emptyDiff'])
      boolean(row[key]);
    return {
      ...base,
      operation: row.operation,
      changedPaths: paths.sort(),
      proposedDiffDigest: row.proposedDiffDigest,
      reproducedDiffDigest: row.reproducedDiffDigest,
      trustedConfigDigest: row.trustedConfigDigest,
      trustedFormatterRevision: row.trustedFormatterRevision,
      reproducible: row.reproducible,
      formattingOnly: row.formattingOnly,
      emptyDiff: row.emptyDiff,
    };
  }
  requireValue(row.operation === 'dependency-merge');
  const updates = collection(row.directUpdates, 2).map((item) => {
    const update = record(item);
    identity(update.name, 214);
    identity(update.from);
    identity(update.to);
    requireValue(
      ['patch', 'minor', 'major', 'prerelease', 'unknown'].includes(
        update.kind,
      ),
    );
    return {
      name: update.name,
      from: update.from,
      to: update.to,
      kind: update.kind,
    };
  });
  unique(updates.map((update) => update.name));
  for (const key of [
    'authenticatedUpdateBot',
    'devDependenciesOnly',
    'mixedOrProtectedChanges',
    'protectedMain',
    'mergeable',
  ])
    boolean(row[key]);
  hash(row.expectedLockDigest);
  hash(row.reproducedLockDigest);
  return {
    ...base,
    operation: 'dependency-merge',
    directUpdates: updates.sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    ),
    authenticatedUpdateBot: row.authenticatedUpdateBot,
    devDependenciesOnly: row.devDependenciesOnly,
    mixedOrProtectedChanges: row.mixedOrProtectedChanges,
    expectedLockDigest: row.expectedLockDigest,
    reproducedLockDigest: row.reproducedLockDigest,
    protectedMain: row.protectedMain,
    mergeable: row.mergeable,
  };
}
function parseMaintenanceInputs(rawRequest, rawPolicy) {
  let parsedPolicy;
  try {
    parsedPolicy = policy(snapshot(rawPolicy));
  } catch {
    return { ok: false, failure: failure('INVALID_POLICY') };
  }
  try {
    return {
      ok: true,
      value: { request: request(snapshot(rawRequest)), policy: parsedPolicy },
    };
  } catch {
    return { ok: false, failure: failure('INVALID_INPUT') };
  }
}

// scripts/maintenance/metadata.ts
function labelsForPaths(paths, rules) {
  if (paths.length > 500 || rules.length > 100)
    throw new BoundaryError('METADATA_LIMIT');
  for (const path of paths) canonicalPath(path);
  for (const rule of rules) {
    if (
      !/^[a-z][a-z0-9-]{0,49}$/.test(rule.label) ||
      !Array.isArray(rule.paths) ||
      rule.paths.length > 100
    )
      throw new BoundaryError('INVALID_LABEL_RULE');
    for (const path of rule.paths) canonicalPath(path);
  }
  return [
    ...new Set(
      rules
        .filter((rule) =>
          paths.some((path) =>
            rule.paths.some(
              (allowed) => path === allowed || path.startsWith(`${allowed}/`),
            ),
          ),
        )
        .map((rule) => rule.label),
    ),
  ].sort();
}
async function labelPullRequest(api, repository, prNumber, rules) {
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ||
    !Number.isSafeInteger(prNumber) ||
    prNumber < 1
  )
    throw new BoundaryError('INVALID_METADATA');
  const pr = await api.json(`/repos/${repository}/pulls/${prNumber}`);
  if (pr.state !== 'open') return { status: 'no-op', labels: [] };
  const files = await api.pages(
    `/repos/${repository}/pulls/${prNumber}/files?per_page=100`,
    '',
  );
  const labels = labelsForPaths(
    files.map((file) => file.filename),
    rules,
  );
  if (labels.length)
    await api.writeJson(
      `/repos/${repository}/issues/${prNumber}/labels`,
      'POST',
      { labels },
    );
  return { status: labels.length ? 'success' : 'no-op', labels };
}

// scripts/ci/quality-evidence.js
import { createHash as createHash2 } from 'node:crypto';

var digest2 = (bytes) => createHash2('sha256').update(bytes).digest('hex');
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
  if (evidence.artifactDigest !== digest2(observed.artifactBytes))
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
function validateEvidence(evidence, observed) {
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

// scripts/maintenance/input.js
var failure2 = (reason) => ({
  outcome: 'reject',
  reasons: [reason],
  operation: null,
  repository: null,
  headSha: null,
  decisionId: null,
});
function requireValue2(value) {
  if (!value) throw Error('invalid');
}
function identity2(value, limit = 256) {
  requireValue2(
    typeof value === 'string' &&
      value.length > 0 &&
      value.length <= limit &&
      value.trim() === value &&
      [...value].every((character) => {
        const code = character.charCodeAt(0);
        return code > 31 && code !== 127;
      }),
  );
}
function sha2(value) {
  requireValue2(typeof value === 'string' && /^[a-f0-9]{40}$/.test(value));
}
function hash2(value) {
  requireValue2(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value));
}
function positive2(value) {
  requireValue2(Number.isSafeInteger(value) && value > 0);
}
function runIdentity2(value) {
  identity2(value);
  requireValue2(/^[1-9][0-9]*$/.test(value));
  positive2(Number(value));
}
function boolean2(value) {
  requireValue2(typeof value === 'boolean');
}
function record2(value) {
  requireValue2(
    value !== null && typeof value === 'object' && !Array.isArray(value),
  );
  return value;
}
function collection2(value, max) {
  requireValue2(Array.isArray(value) && value.length <= max);
  return value;
}
function unique2(values) {
  requireValue2(new Set(values).size === values.length);
}
function canonicalPath2(value) {
  identity2(value, 1024);
  requireValue2(
    !value.startsWith('/') &&
      !value.includes('\\') &&
      !/^[a-zA-Z]:/.test(value) &&
      value
        .split('/')
        .every(
          (segment) => segment !== '' && segment !== '.' && segment !== '..',
        ),
  );
}
function snapshot2(value) {
  const ancestors = new Set();
  let count = 0;
  function copy(item, depth) {
    requireValue2(++count <= 20000 && depth <= 16);
    if (item === null || typeof item === 'boolean') return item;
    if (typeof item === 'string') {
      requireValue2(item.length <= 4096);
      return item;
    }
    if (typeof item === 'number') {
      requireValue2(Number.isFinite(item));
      return item;
    }
    requireValue2(typeof item === 'object' && item !== null);
    requireValue2(!ancestors.has(item));
    const array = Array.isArray(item);
    const prototype = Object.getPrototypeOf(item);
    requireValue2(
      array
        ? prototype === Array.prototype
        : prototype === Object.prototype || prototype === null,
    );
    const descriptors = Object.getOwnPropertyDescriptors(item);
    const keys = Reflect.ownKeys(descriptors);
    requireValue2(keys.length <= 2000);
    ancestors.add(item);
    const output = array ? [] : {};
    if (array) {
      const length = descriptors.length?.value;
      requireValue2(
        Number.isSafeInteger(length) && length >= 0 && length <= 2000,
      );
      requireValue2(keys.length === length + 1);
    }
    for (const key of keys) {
      requireValue2(typeof key === 'string');
      if (array && key === 'length') continue;
      requireValue2(
        key !== '__proto__' && key !== 'constructor' && key !== 'prototype',
      );
      const descriptor = descriptors[key];
      requireValue2(
        descriptor && 'value' in descriptor && descriptor.enumerable,
      );
      if (array) requireValue2(/^(0|[1-9][0-9]*)$/.test(key));
      Object.defineProperty(output, key, {
        value: copy(descriptor.value, depth + 1),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    ancestors.delete(item);
    return output;
  }
  return copy(value, 0);
}
function parseChecks2(value) {
  const rows = collection2(value, 100).map((item) => {
    const row = record2(item);
    identity2(row.name);
    identity2(row.producerIdentity);
    runIdentity2(row.runId);
    sha2(row.sourceSha);
    requireValue2(
      ['success', 'failure', 'pending', 'skipped', 'cancelled'].includes(
        row.state,
      ),
    );
    return {
      name: row.name,
      producerIdentity: row.producerIdentity,
      runId: row.runId,
      sourceSha: row.sourceSha,
      state: row.state,
    };
  });
  unique2(rows.map((row) => row.name));
  return rows.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
function parseProducers2(value) {
  const rows = collection2(value, 100).map((item) => {
    const row = record2(item);
    identity2(row.name);
    identity2(row.producerIdentity);
    return { name: row.name, producerIdentity: row.producerIdentity };
  });
  requireValue2(rows.length > 0);
  unique2(rows.map((row) => row.name));
  return rows.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
function parseEvidence2(value) {
  const row = record2(value);
  requireValue2(row.schemaVersion === 1);
  identity2(row.repository);
  sha2(row.sourceSha);
  runIdentity2(row.runId);
  positive2(row.runAttempt);
  identity2(row.workflowIdentity);
  identity2(row.toolchainRevision);
  hash2(row.artifactDigest);
  requireValue2(['ordinary-ci', 'publication-candidate'].includes(row.purpose));
  const result = {
    schemaVersion: 1,
    repository: row.repository,
    sourceSha: row.sourceSha,
    runId: row.runId,
    runAttempt: row.runAttempt,
    workflowIdentity: row.workflowIdentity,
    toolchainRevision: row.toolchainRevision,
    artifactDigest: row.artifactDigest,
    purpose: row.purpose,
    checks: parseChecks2(row.checks),
  };
  if (row.coverage !== undefined) {
    const coverage = record2(row.coverage);
    hash2(coverage.inventoryDigest);
    hash2(coverage.receiptsDigest);
    positive2(coverage.totalLines);
    requireValue2(
      Number.isSafeInteger(coverage.coveredLines) &&
        coverage.coveredLines >= 0 &&
        coverage.coveredLines <= coverage.totalLines,
    );
    result.coverage = {
      inventoryDigest: coverage.inventoryDigest,
      receiptsDigest: coverage.receiptsDigest,
      coveredLines: coverage.coveredLines,
      totalLines: coverage.totalLines,
    };
  }
  return result;
}
function strings2(value, path) {
  const rows = collection2(value, 100);
  for (const row of rows) {
    if (path) canonicalPath2(row);
    else identity2(row, 214);
  }
  unique2(rows);
  return rows.sort();
}
function policy2(value) {
  const row = record2(value);
  identity2(row.revision);
  identity2(row.repository);
  identity2(row.formatterRevision);
  hash2(row.formatterConfigDigest);
  return {
    revision: row.revision,
    repository: row.repository,
    formatterRevision: row.formatterRevision,
    formatterConfigDigest: row.formatterConfigDigest,
    allowedFormatPaths: strings2(row.allowedFormatPaths, true),
    allowedDevDependencies: strings2(row.allowedDevDependencies, false),
    requiredCheckProducers: parseProducers2(row.requiredCheckProducers),
  };
}
function request2(value) {
  const row = record2(value);
  requireValue2(row.schemaVersion === 1);
  const context = record2(row.context);
  identity2(context.repository);
  positive2(context.prNumber);
  sha2(context.headSha);
  sha2(context.currentHeadSha);
  for (const key of ['sameRepository', 'prOpen', 'trustedWorkflow'])
    boolean2(context[key]);
  const base = {
    schemaVersion: 1,
    context: {
      repository: context.repository,
      prNumber: context.prNumber,
      headSha: context.headSha,
      currentHeadSha: context.currentHeadSha,
      sameRepository: context.sameRepository,
      prOpen: context.prOpen,
      trustedWorkflow: context.trustedWorkflow,
      evidence: parseEvidence2(context.evidence),
    },
  };
  if (row.operation === 'format-push') {
    const paths = collection2(row.changedPaths, 500);
    for (const path of paths) canonicalPath2(path);
    unique2(paths);
    for (const key of [
      'proposedDiffDigest',
      'reproducedDiffDigest',
      'trustedConfigDigest',
    ])
      hash2(row[key]);
    identity2(row.trustedFormatterRevision);
    for (const key of ['reproducible', 'formattingOnly', 'emptyDiff'])
      boolean2(row[key]);
    return {
      ...base,
      operation: row.operation,
      changedPaths: paths.sort(),
      proposedDiffDigest: row.proposedDiffDigest,
      reproducedDiffDigest: row.reproducedDiffDigest,
      trustedConfigDigest: row.trustedConfigDigest,
      trustedFormatterRevision: row.trustedFormatterRevision,
      reproducible: row.reproducible,
      formattingOnly: row.formattingOnly,
      emptyDiff: row.emptyDiff,
    };
  }
  requireValue2(row.operation === 'dependency-merge');
  const updates = collection2(row.directUpdates, 2).map((item) => {
    const update = record2(item);
    identity2(update.name, 214);
    identity2(update.from);
    identity2(update.to);
    requireValue2(
      ['patch', 'minor', 'major', 'prerelease', 'unknown'].includes(
        update.kind,
      ),
    );
    return {
      name: update.name,
      from: update.from,
      to: update.to,
      kind: update.kind,
    };
  });
  unique2(updates.map((update) => update.name));
  for (const key of [
    'authenticatedUpdateBot',
    'devDependenciesOnly',
    'mixedOrProtectedChanges',
    'protectedMain',
    'mergeable',
  ])
    boolean2(row[key]);
  hash2(row.expectedLockDigest);
  hash2(row.reproducedLockDigest);
  return {
    ...base,
    operation: 'dependency-merge',
    directUpdates: updates.sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    ),
    authenticatedUpdateBot: row.authenticatedUpdateBot,
    devDependenciesOnly: row.devDependenciesOnly,
    mixedOrProtectedChanges: row.mixedOrProtectedChanges,
    expectedLockDigest: row.expectedLockDigest,
    reproducedLockDigest: row.reproducedLockDigest,
    protectedMain: row.protectedMain,
    mergeable: row.mergeable,
  };
}
function parseMaintenanceInputs2(rawRequest, rawPolicy) {
  let parsedPolicy;
  try {
    parsedPolicy = policy2(snapshot2(rawPolicy));
  } catch {
    return { ok: false, failure: failure2('INVALID_POLICY') };
  }
  try {
    return {
      ok: true,
      value: { request: request2(snapshot2(rawRequest)), policy: parsedPolicy },
    };
  } catch {
    return { ok: false, failure: failure2('INVALID_INPUT') };
  }
}

// scripts/maintenance/evidence.ts
function observation(raw, policy) {
  if (
    !raw ||
    typeof raw !== 'object' ||
    Object.getPrototypeOf(raw) !== Object.prototype
  )
    throw Error('invalid observation');
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  const artifact = descriptors.artifactBytes;
  if (
    !artifact ||
    !('value' in artifact) ||
    !(artifact.value instanceof Uint8Array) ||
    Object.getPrototypeOf(artifact.value) !== Uint8Array.prototype
  )
    throw Error('invalid artifact');
  const plain = {};
  for (const key of Reflect.ownKeys(descriptors)) {
    if (
      typeof key !== 'string' ||
      key === '__proto__' ||
      key === 'constructor' ||
      key === 'prototype'
    )
      throw Error('invalid observation');
    const descriptor = descriptors[key];
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
      throw Error('invalid observation');
    if (key !== 'artifactBytes') plain[key] = descriptor.value;
  }
  const row = record2(snapshot2(plain));
  const bytes = new Uint8Array(artifact.value);
  const parsed = parseEvidence2({
    ...row,
    schemaVersion: 1,
    artifactDigest: digest2(bytes),
  });
  const declaredRequired = parseProducers2(row.requiredChecks);
  if (
    JSON.stringify(declaredRequired) !==
    JSON.stringify(policy.requiredCheckProducers)
  )
    throw Error('required inventory differs');
  return {
    repository: parsed.repository,
    sourceSha: parsed.sourceSha,
    runId: parsed.runId,
    runAttempt: parsed.runAttempt,
    workflowIdentity: parsed.workflowIdentity,
    purpose: parsed.purpose,
    toolchainRevision: parsed.toolchainRevision,
    checks: parseChecks2(row.checks),
    requiredChecks: policy.requiredCheckProducers.map((check) => ({
      ...check,
    })),
    artifactBytes: bytes,
    ...(parsed.coverage ? { coverage: { ...parsed.coverage } } : {}),
  };
}
function adaptMaintenanceEvidence(
  rawRequest,
  rawPolicy,
  independentObservation,
) {
  const parsed = parseMaintenanceInputs2(rawRequest, rawPolicy);
  if (!parsed.ok) return parsed;
  try {
    const observed = observation(independentObservation, parsed.value.policy);
    const context = parsed.value.request.context;
    if (
      observed.repository !== context.repository ||
      observed.sourceSha !== context.headSha
    )
      throw Error('context differs');
    validateEvidence(context.evidence, observed);
    const trustedContext = { ...context, trustedWorkflow: true };
    return {
      ok: true,
      value: {
        request: { ...parsed.value.request, context: trustedContext },
        policy: parsed.value.policy,
      },
    };
  } catch {
    return { ok: false, failure: failure2('INVALID_EVIDENCE') };
  }
}

// scripts/maintenance/policy.ts
function version(value) {
  if (!/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(value))
    return null;
  const parts = value.split('.').map(Number);
  const [major, minor, patch] = parts;
  return major !== undefined &&
    minor !== undefined &&
    patch !== undefined &&
    parts.every(Number.isSafeInteger)
    ? [major, minor, patch]
    : null;
}
function stableUpdate(update) {
  const from = version(update.from);
  const to = version(update.to);
  if (!from || !to || from[0] !== to[0]) return false;
  if (to[1] > from[1]) return update.kind === 'minor';
  return to[1] === from[1] && to[2] > from[2] && update.kind === 'patch';
}
function evaluate(request, policy) {
  const context = request.context;
  const evidence = context.evidence;
  const reasons = [];
  const refuse = (condition, code) => {
    if (condition) reasons.push(code);
  };
  refuse(
    context.repository !== policy.repository ||
      evidence.repository !== policy.repository,
    'REPOSITORY_MISMATCH',
  );
  refuse(!context.sameRepository, 'FORK_REJECTED');
  refuse(!context.prOpen, 'PR_NOT_OPEN');
  refuse(
    context.headSha !== context.currentHeadSha ||
      evidence.sourceSha !== context.headSha,
    'STALE_HEAD',
  );
  refuse(!context.trustedWorkflow, 'UNTRUSTED_WORKFLOW');
  const checkSetValid =
    evidence.checks.length === policy.requiredCheckProducers.length &&
    policy.requiredCheckProducers.every((required) => {
      const row = evidence.checks.find((check) => check.name === required.name);
      return (
        row &&
        row.producerIdentity === required.producerIdentity &&
        row.sourceSha === context.headSha &&
        row.runId === evidence.runId &&
        row.state === 'success'
      );
    });
  refuse(!checkSetValid, 'CHECKS_UNSUCCESSFUL');
  if (request.operation === 'format-push') {
    refuse(
      request.trustedFormatterRevision !== policy.formatterRevision ||
        request.trustedConfigDigest !== policy.formatterConfigDigest,
      'FORMATTER_MISMATCH',
    );
    refuse(
      request.changedPaths.some(
        (path) =>
          !policy.allowedFormatPaths.some(
            (allowed) => path === allowed || path.startsWith(`${allowed}/`),
          ),
      ),
      'PATH_NOT_ALLOWED',
    );
    refuse(!request.reproducible, 'FORMAT_NOT_REPRODUCIBLE');
    refuse(!request.formattingOnly, 'NOT_FORMATTING_ONLY');
    refuse(
      request.proposedDiffDigest !== request.reproducedDiffDigest,
      'DIFF_MISMATCH',
    );
    const empty =
      request.changedPaths.length === 0 &&
      request.proposedDiffDigest === digest2('') &&
      request.reproducedDiffDigest === digest2('');
    refuse(
      request.emptyDiff !== empty ||
        (!request.emptyDiff &&
          (request.changedPaths.length === 0 ||
            request.proposedDiffDigest === digest2(''))),
      'EMPTY_DIFF_CONTRADICTION',
    );
  } else {
    refuse(!request.authenticatedUpdateBot, 'UNAUTHENTICATED_BOT');
    refuse(!request.devDependenciesOnly, 'NOT_DEV_DEPENDENCIES');
    refuse(request.directUpdates.length !== 1, 'DIRECT_UPDATE_COUNT');
    refuse(
      request.directUpdates.some(
        (update) => !policy.allowedDevDependencies.includes(update.name),
      ),
      'DEPENDENCY_NOT_ALLOWED',
    );
    refuse(
      request.directUpdates.some((update) => !stableUpdate(update)),
      'UNSAFE_DEPENDENCY_VERSION',
    );
    refuse(request.mixedOrProtectedChanges, 'MIXED_OR_PROTECTED_CHANGES');
    refuse(
      request.expectedLockDigest !== request.reproducedLockDigest,
      'LOCK_MISMATCH',
    );
    refuse(!request.protectedMain, 'MAIN_NOT_PROTECTED');
    refuse(!request.mergeable, 'NOT_MERGEABLE');
  }
  const evidenceIdentity = digest2(
    JSON.stringify({
      repository: evidence.repository,
      sourceSha: evidence.sourceSha,
      runId: evidence.runId,
      runAttempt: evidence.runAttempt,
      workflowIdentity: evidence.workflowIdentity,
      artifactDigest: evidence.artifactDigest,
      purpose: evidence.purpose,
      toolchainRevision: evidence.toolchainRevision,
    }),
  );
  return {
    schemaVersion: 1,
    decisionId: digest2(JSON.stringify({ request, policy })),
    operation: request.operation,
    repository: context.repository,
    headSha: context.headSha,
    evidenceIdentity,
    policyRevision: policy.revision,
    outcome: reasons.length
      ? 'reject'
      : request.operation === 'format-push' && request.emptyDiff
        ? 'no-op'
        : 'allow',
    reasons,
  };
}
function evaluateMaintenance(request, trustedPolicy) {
  const parsed = parseMaintenanceInputs2(request, trustedPolicy);
  return parsed.ok
    ? evaluate(parsed.value.request, parsed.value.policy)
    : parsed.failure;
}

// scripts/maintenance/receipt.ts
var REQUIRED_JOBS = ['quality', 'commit-format', 'ci-required'];
function fail(condition, code) {
  if (!condition) throw new BoundaryError(code);
}
function row(value) {
  fail(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'INVALID_API',
  );
  return value;
}
function text(value) {
  fail(
    typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 256 &&
      value.trim() === value,
    'INVALID_API',
  );
  return value;
}
function positive3(value) {
  fail(Number.isSafeInteger(value) && value > 0, 'INVALID_API');
  return value;
}
function fullSha(value) {
  fail(
    typeof value === 'string' && /^[a-f0-9]{40}$/.test(value),
    'INVALID_API',
  );
  return value;
}
function producerIdentity(policy) {
  return `${policy.producerAppId}:${policy.workflowId}:${policy.workflowPath}`;
}
function validateAcquisitionPolicy(raw) {
  const source = row(snapshot(raw));
  const repository = text(source.repository);
  fail(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository), 'INVALID_POLICY');
  const workflowPath = text(source.workflowPath);
  fail(workflowPath === '.github/workflows/ci.yml', 'INVALID_POLICY');
  fail(
    typeof source.workflowDigest === 'string' &&
      /^[a-f0-9]{64}$/.test(source.workflowDigest),
    'INVALID_POLICY',
  );
  fail(
    Array.isArray(source.protectedPaths) && source.protectedPaths.length <= 100,
    'INVALID_POLICY',
  );
  fail(
    Array.isArray(source.archiveRedirectHosts) &&
      source.archiveRedirectHosts.length <= 16,
    'INVALID_POLICY',
  );
  const protectedPaths = source.protectedPaths.map(text);
  const archiveRedirectHosts = source.archiveRedirectHosts.map(text);
  fail(
    protectedPaths.includes(workflowPath) &&
      new Set(protectedPaths).size === protectedPaths.length,
    'INVALID_POLICY',
  );
  for (const host of archiveRedirectHosts)
    fail(/^[a-z0-9.-]+$/.test(host) && !host.includes('..'), 'INVALID_POLICY');
  fail(source.updateActorType === 'Bot', 'INVALID_POLICY');
  return {
    repository,
    workflowPath,
    workflowDigest: source.workflowDigest,
    workflowId: positive3(source.workflowId),
    producerAppId: positive3(source.producerAppId),
    toolchainRevision: text(source.toolchainRevision),
    protectedPaths,
    archiveRedirectHosts,
    updateActorId: positive3(source.updateActorId),
    updateActorType: 'Bot',
  };
}
async function contentAt(api, repository, path, sha) {
  fail(
    path.length <= 1024 &&
      !path.includes('\\') &&
      !path.startsWith('/') &&
      path
        .split('/')
        .every((segment) => segment && segment !== '.' && segment !== '..'),
    'UNSAFE_PATH',
  );
  fullSha(sha);
  const response = row(
    await api.json(
      `/repos/${repository}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${sha}`,
    ),
  );
  fail(
    response.type === 'file' && response.encoding === 'base64',
    'UNKNOWN_FILE',
  );
  const content = response.content;
  fail(
    typeof content === 'string' &&
      content.length <= Math.ceil((8 * 1024 * 1024 * 4) / 3) + 1024,
    'BYTE_LIMIT',
  );
  const normalized = content.replace(/\n/g, '');
  fail(
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      normalized,
    ),
    'INVALID_API',
  );
  const bytes = limitBytes(Buffer.from(normalized, 'base64'));
  fail(response.size === bytes.length, 'INVALID_API');
  return bytes;
}
function normalizeReceipt(raw, archiveBytes, run, pr, jobs, checks, policy) {
  limitBytes(archiveBytes);
  const receipt = row(snapshot(raw));
  const head = fullSha(row(pr.head).sha),
    runId = String(positive3(run.id)),
    attempt = positive3(run.run_attempt);
  fail(
    receipt.schemaVersion === 1 &&
      receipt.repository === policy.repository &&
      receipt.sourceSha === head &&
      receipt.runId === runId &&
      receipt.runAttempt === attempt &&
      receipt.workflowIdentity === policy.workflowPath &&
      receipt.purpose === 'ordinary-ci',
    'RECEIPT_IDENTITY',
  );
  const workflowRef = text(receipt.workflowRef);
  fail(
    workflowRef.startsWith(`${policy.repository}/${policy.workflowPath}@refs/`),
    'RECEIPT_IDENTITY',
  );
  const tools = row(receipt.expectedToolchain);
  fail(
    tools.node === '24.21.0' &&
      tools.bun === '1.4.2' &&
      receipt.receiptNodeVersion === '24.21.0' &&
      typeof tools.lockDigest === 'string' &&
      /^[a-f0-9]{64}$/.test(tools.lockDigest),
    'TOOLCHAIN_MISMATCH',
  );
  const observedJobs = receipt.observedJobs;
  fail(
    Array.isArray(observedJobs) && observedJobs.length === 2,
    'RECEIPT_JOBS',
  );
  const producer = producerIdentity(policy);
  const suiteId = positive3(run.check_suite_id);
  const normalized = REQUIRED_JOBS.map((name) => {
    const selectedJobs = jobs.map(row).filter((job) => job.name === name);
    fail(selectedJobs.length === 1, 'JOB_IDENTITY');
    const job = selectedJobs[0];
    fail(
      job &&
        job.status === 'completed' &&
        job.conclusion === 'success' &&
        job.run_id === run.id &&
        job.run_attempt === attempt,
      'JOB_UNSUCCESSFUL',
    );
    const checkUrl = text(job.check_run_url);
    const checkAddress = new URL(checkUrl);
    const checkPrefix = `/repos/${policy.repository}/check-runs/`;
    const checkId = checkAddress.pathname.slice(checkPrefix.length);
    fail(
      checkAddress.origin === 'https://api.github.com' &&
        checkAddress.pathname.startsWith(checkPrefix) &&
        /^[1-9][0-9]*$/.test(checkId) &&
        !checkAddress.search &&
        !checkAddress.hash,
      'JOB_IDENTITY',
    );
    const selectedChecks = checks
      .map(row)
      .filter((check) => String(check.id) === checkId);
    fail(selectedChecks.length === 1, 'CHECK_IDENTITY');
    const check = selectedChecks[0];
    fail(
      check &&
        check.name === name &&
        check.head_sha === head &&
        check.status === 'completed' &&
        check.conclusion === 'success' &&
        row(check.app).id === policy.producerAppId &&
        row(check.check_suite).id === suiteId,
      'CHECK_UNSUCCESSFUL',
    );
    if (name !== 'ci-required') {
      const matches = observedJobs
        .map(row)
        .filter((claimed) => claimed.name === name);
      fail(
        matches.length === 1 &&
          matches[0]?.state === 'success' &&
          matches[0]?.sourceSha === head &&
          matches[0]?.runId === runId,
        'RECEIPT_JOBS',
      );
    }
    return {
      name,
      sourceSha: head,
      state: 'success',
      runId,
      producerIdentity: producer,
    };
  });
  fail(
    new Set(observedJobs.map((claimed) => row(claimed).name)).size === 2,
    'RECEIPT_JOBS',
  );
  const evidence = {
    schemaVersion: 1,
    repository: policy.repository,
    sourceSha: head,
    runId,
    runAttempt: attempt,
    workflowIdentity: policy.workflowPath,
    purpose: 'ordinary-ci',
    checks: normalized,
    artifactDigest: digest(archiveBytes),
    toolchainRevision: policy.toolchainRevision,
  };
  const observation = {
    repository: policy.repository,
    sourceSha: head,
    runId,
    runAttempt: attempt,
    workflowIdentity: policy.workflowPath,
    purpose: 'ordinary-ci',
    checks: normalized.map((check) => ({ ...check })),
    toolchainRevision: policy.toolchainRevision,
    artifactBytes: archiveBytes,
    requiredChecks: REQUIRED_JOBS.map((name) => ({
      name,
      producerIdentity: producer,
    })),
  };
  return { evidence, observation, lockDigest: tools.lockDigest };
}
async function acquireMaintenance(api, runId, rawPolicy) {
  const policy = validateAcquisitionPolicy(rawPolicy);
  positive3(runId);
  const prefix = `/repos/${policy.repository}`;
  const run = row(await api.json(`${prefix}/actions/runs/${runId}`));
  fail(
    run.id === runId &&
      row(run.repository).full_name === policy.repository &&
      run.workflow_id === policy.workflowId &&
      run.path === policy.workflowPath &&
      run.event === 'pull_request' &&
      run.status === 'completed' &&
      run.conclusion === 'success',
    'RUN_IDENTITY',
  );
  const attempt = positive3(run.run_attempt);
  const linkedPrs = run.pull_requests;
  fail(Array.isArray(linkedPrs) && linkedPrs.length === 1, 'AMBIGUOUS_PR');
  const prNumber = positive3(row(linkedPrs[0]).number);
  const pr = row(await api.json(`${prefix}/pulls/${prNumber}`));
  fail(
    pr.number === prNumber &&
      pr.state === 'open' &&
      !pr.merged &&
      row(row(pr.head).repo).full_name === policy.repository &&
      row(row(pr.base).repo).full_name === policy.repository,
    'PR_REJECTED',
  );
  const head = fullSha(row(pr.head).sha),
    baseSha = fullSha(row(pr.base).sha),
    executionSha = fullSha(run.head_sha);
  if (executionSha !== head) {
    const commit = row(await api.json(`${prefix}/git/commits/${executionSha}`));
    fail(
      Array.isArray(commit.parents) &&
        commit.parents.length === 2 &&
        row(commit.parents[0]).sha === baseSha &&
        row(commit.parents[1]).sha === head,
      'SOURCE_BINDING',
    );
  }
  const workflowBytes = await contentAt(
    api,
    policy.repository,
    policy.workflowPath,
    head,
  );
  fail(digest(workflowBytes) === policy.workflowDigest, 'UNTRUSTED_CI');
  const files = (
    await api.pages(`${prefix}/pulls/${prNumber}/files?per_page=100`, '')
  ).map((file) => {
    const value = row(file),
      path = value.filename;
    fail(typeof path === 'string' && path.length <= 1024, 'INVALID_API');
    return { path, status: text(value.status), sha: fullSha(value.sha) };
  });
  fail(
    files.length <= 500 &&
      new Set(files.map((file) => file.path)).size === files.length,
    'FILE_LIMIT',
  );
  fail(
    !files.some((file) =>
      policy.protectedPaths.some(
        (path) => file.path === path || file.path.startsWith(`${path}/`),
      ),
    ),
    'PROTECTED_CHANGE',
  );
  const jobs = await api.pages(
    `${prefix}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`,
    'jobs',
  );
  const checks = await api.pages(
    `${prefix}/commits/${head}/check-runs?per_page=100`,
    'check_runs',
  );
  const artifacts = await api.pages(
    `${prefix}/actions/runs/${runId}/artifacts?per_page=100`,
    'artifacts',
  );
  const name = `ordinary-ci-${head}-${runId}-${attempt}`;
  const selected = artifacts
    .map(row)
    .filter((artifact) => artifact.name === name && artifact.expired === false);
  fail(selected.length === 1, 'ARTIFACT_IDENTITY');
  const artifactId = positive3(selected[0]?.id);
  const artifactRun = row(selected[0]?.workflow_run);
  fail(
    artifactRun.id === runId &&
      artifactRun.repository_id === row(run.repository).id &&
      artifactRun.head_sha === executionSha,
    'ARTIFACT_IDENTITY',
  );
  const archiveBytes = await api.bytes(
    `${prefix}/actions/artifacts/${artifactId}/zip`,
    policy.archiveRedirectHosts,
  );
  const members = await unpackArchive(archiveBytes);
  const receiptBytes = members.get('receipt.json');
  fail(receiptBytes, 'RECEIPT_MISSING');
  const normalized = normalizeReceipt(
    decodeJson(receiptBytes),
    archiveBytes,
    run,
    pr,
    jobs,
    checks,
    policy,
  );
  const user = row(pr.user);
  return {
    repository: policy.repository,
    prNumber,
    headSha: head,
    branch: text(row(pr.head).ref),
    baseSha,
    runId: String(runId),
    runAttempt: attempt,
    authenticatedUpdateBot:
      user.id === policy.updateActorId && user.type === policy.updateActorType,
    files,
    evidence: normalized.evidence,
    observation: normalized.observation,
    receiptLockDigest: normalized.lockDigest,
    artifactId,
  };
}

// scripts/maintenance/operations.ts
function requireValue3(value, code) {
  if (!value) throw new BoundaryError(code);
}
function object(value) {
  requireValue3(
    value && typeof value === 'object' && !Array.isArray(value),
    'INVALID_API',
  );
  return value;
}
async function observeProtection(api, acquisition) {
  const prefix = `/repos/${acquisition.repository}`;
  const pr = object(await api.json(`${prefix}/pulls/${acquisition.prNumber}`));
  const base = object(pr.base);
  requireValue3(
    base.ref === 'main' &&
      pr.state === 'open' &&
      pr.merged !== true &&
      object(pr.head).sha === acquisition.headSha &&
      object(object(pr.head).repo).full_name === acquisition.repository,
    'PR_REJECTED',
  );
  const protection = object(
    await api.json(`${prefix}/branches/main/protection`),
  );
  const checks = object(protection.required_status_checks);
  const contexts = checks.contexts;
  const checkNames = Array.isArray(checks.checks)
    ? checks.checks.map((item) => object(item).context)
    : [];
  const enforced = object(protection.enforce_admins).enabled === true;
  const required = Array.isArray(contexts)
    ? [...contexts, ...checkNames]
    : checkNames;
  const rules = await api.pages(
    `${prefix}/rulesets?includes_parents=true&per_page=100`,
    '',
  );
  for (const item of rules) {
    const rule = object(item);
    if (rule.enforcement === 'disabled') continue;
    const id = rule.id;
    requireValue3(Number.isSafeInteger(id) && id > 0, 'PROTECTION_UNKNOWN');
    const detail = object(await api.json(`${prefix}/rulesets/${id}`));
    requireValue3(Array.isArray(detail.rules), 'PROTECTION_UNKNOWN');
    requireValue3(
      !detail.rules.some((entry) => object(entry).type === 'merge_queue'),
      'UNSUPPORTED_MERGE_QUEUE',
    );
  }
  return {
    protectedMain:
      enforced &&
      REQUIRED_JOBS.every((name) => required.includes(name)) &&
      object(protection.allow_force_pushes).enabled === false,
    mergeable:
      pr.mergeable === true &&
      pr.mergeable_state === 'clean' &&
      pr.draft !== true &&
      base.ref === 'main',
  };
}
function preparationFrom(
  request,
  changes,
  trustedBaseSha,
  preparationRunId,
  preparationAttempt,
) {
  return {
    schemaVersion: 1,
    trustedBaseSha,
    runId: Number(request.context.evidence.runId),
    runAttempt: request.context.evidence.runAttempt,
    preparationRunId,
    preparationAttempt,
    request,
    changes,
  };
}
function decodedChanges(prepared, policy) {
  requireValue3(
    Array.isArray(prepared.changes) && prepared.changes.length <= 500,
    'INVALID_PREPARATION',
  );
  const names = new Set();
  let size = 0;
  const changes = prepared.changes.map((item) => {
    canonicalPath(item.path);
    requireValue3(
      !names.has(item.path) &&
        policy.allowedFormatPaths.some(
          (allowed) =>
            item.path === allowed || item.path.startsWith(`${allowed}/`),
        ),
      'INVALID_PREPARATION',
    );
    names.add(item.path);
    requireValue3(
      /^[a-f0-9]{64}$/.test(item.originalDigest) &&
        typeof item.replacementBase64 === 'string' &&
        item.replacementBase64.length <= Math.ceil((BYTE_LIMIT * 4) / 3) &&
        /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
          item.replacementBase64,
        ),
      'INVALID_PREPARATION',
    );
    const bytes = limitBytes(Buffer.from(item.replacementBase64, 'base64'));
    size += bytes.length;
    requireValue3(size <= BYTE_LIMIT, 'BYTE_LIMIT');
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new BoundaryError('INVALID_PREPARATION');
    }
    return {
      path: item.path,
      originalDigest: item.originalDigest,
      replacementBytes: bytes,
    };
  });
  return changes.sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );
}
function artifactMatches(prepared, fresh, policy) {
  const parsed = parseMaintenanceInputs(prepared.request, policy);
  requireValue3(parsed.ok, 'INVALID_PREPARATION');
  const request = parsed.value.request;
  requireValue3(
    prepared.schemaVersion === 1 &&
      prepared.runId === Number(fresh.runId) &&
      prepared.runAttempt === fresh.runAttempt &&
      request.context.repository === fresh.repository &&
      request.context.prNumber === fresh.prNumber &&
      request.context.headSha === fresh.headSha,
    'STALE_PREPARATION',
  );
  const adapted = adaptMaintenanceEvidence(request, policy, fresh.observation);
  requireValue3(adapted.ok, 'INVALID_EVIDENCE');
  return adapted.value.request;
}
async function executeMaintenance(
  api,
  prepared,
  policy,
  acquisitionPolicy,
  expectedTrustedBaseSha,
) {
  const request = prepared.request;
  const attempt = {
    repository: policy.repository,
    prNumber: request.context.prNumber,
    headSha: request.context.headSha,
    runId: request.context.evidence.runId,
    runAttempt: request.context.evidence.runAttempt,
    operation: request.operation,
    decisionId: null,
    policyRevision: policy.revision,
    status: 'reject',
    reasons: [],
    resultingSha: null,
  };
  let fresh;
  let validated;
  let changes = [];
  try {
    requireValue3(
      /^[a-f0-9]{40}$/.test(expectedTrustedBaseSha) &&
        prepared.trustedBaseSha === expectedTrustedBaseSha,
      'UNTRUSTED_BASE',
    );
    fresh = await acquireMaintenance(api, prepared.runId, acquisitionPolicy);
    validated = artifactMatches(prepared, fresh, policy);
    if (validated.operation === 'format-push') {
      requireValue3(
        fresh.files.every(
          (file) =>
            file.status === 'modified' &&
            file.path.endsWith('.ts') &&
            !file.path.startsWith('scripts/release/') &&
            !file.path.startsWith('scripts/maintenance/') &&
            policy.allowedFormatPaths.some(
              (allowed) =>
                file.path === allowed || file.path.startsWith(`${allowed}/`),
            ),
        ),
        'MIXED_OR_PROTECTED_CHANGES',
      );
      changes = decodedChanges(prepared, policy);
      requireValue3(
        changes.every((change) =>
          fresh.files.some((file) => file.path === change.path),
        ),
        'INVALID_PREPARATION',
      );
      requireValue3(
        JSON.stringify(changes.map((item) => item.path)) ===
          JSON.stringify(validated.changedPaths),
        'INVALID_PREPARATION',
      );
      const hash = changes.length
        ? digest(
            JSON.stringify(
              changes.map((item) => ({
                path: item.path,
                originalDigest: item.originalDigest,
                replacement: Buffer.from(item.replacementBytes).toString(
                  'base64',
                ),
              })),
            ),
          )
        : digest('');
      requireValue3(
        validated.proposedDiffDigest === hash &&
          validated.reproducedDiffDigest === hash,
        'DIFF_MISMATCH',
      );
      for (const change of changes) {
        const actual = await contentAt(
          api,
          fresh.repository,
          change.path,
          fresh.headSha,
        );
        requireValue3(
          digest(actual) === change.originalDigest,
          'SOURCE_BYTES_MISMATCH',
        );
      }
    } else {
      requireValue3(prepared.changes.length === 0, 'INVALID_PREPARATION');
      requireValue3(
        fresh.files.length === 2 &&
          fresh.files.every(
            (file) =>
              ['package.json', 'bun.lock'].includes(file.path) &&
              file.status === 'modified',
          ) &&
          fresh.receiptLockDigest === validated.expectedLockDigest,
        'INVALID_PREPARATION',
      );
      const protection = await observeProtection(api, fresh);
      validated = {
        ...validated,
        authenticatedUpdateBot: fresh.authenticatedUpdateBot,
        protectedMain: protection.protectedMain,
        mergeable: protection.mergeable,
      };
    }
    const decision = evaluateMaintenance(validated, policy);
    attempt.decisionId = decision.decisionId;
    if (decision.outcome !== 'allow')
      return {
        ...attempt,
        status: decision.outcome,
        reasons: decision.reasons,
      };
    const final = await acquireMaintenance(
      api,
      prepared.runId,
      acquisitionPolicy,
    );
    requireValue3(
      final.headSha === decision.headSha &&
        final.prNumber === fresh.prNumber &&
        final.branch === fresh.branch,
      'STALE_HEAD',
    );
    requireValue3(
      JSON.stringify(final.files) === JSON.stringify(fresh.files),
      'MIXED_OR_PROTECTED_CHANGES',
    );
    if (validated.operation === 'dependency-merge') {
      const protection = await observeProtection(api, final);
      requireValue3(
        protection.protectedMain &&
          protection.mergeable &&
          final.authenticatedUpdateBot,
        'PROTECTION_UNKNOWN',
      );
    }
  } catch (error) {
    return {
      ...attempt,
      status: 'reject',
      reasons: [
        error instanceof BoundaryError ? error.code : 'PRECONDITION_FAILED',
      ],
    };
  }
  try {
    if (validated.operation === 'format-push') {
      const result = object(
        await api.writeJson('/graphql', 'POST', {
          query:
            'mutation MaintenanceCommit($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } } }',
          variables: {
            input: {
              branch: {
                repositoryNameWithOwner: fresh.repository,
                branchName: fresh.branch,
              },
              expectedHeadOid: fresh.headSha,
              message: { headline: 'style: apply trusted formatting' },
              fileChanges: {
                additions: changes.map((item) => ({
                  path: item.path,
                  contents: Buffer.from(item.replacementBytes).toString(
                    'base64',
                  ),
                })),
              },
            },
          },
        }),
      );
      requireValue3(!result.errors, 'GRAPHQL_REJECTED');
      const sha = object(
        object(object(result.data).createCommitOnBranch).commit,
      ).oid;
      requireValue3(
        typeof sha === 'string' && /^[a-f0-9]{40}$/.test(sha),
        'WRITE_RESULT_INVALID',
      );
      return { ...attempt, status: 'success', resultingSha: sha };
    }
    const result = object(
      await api.writeJson(
        `/repos/${fresh.repository}/pulls/${fresh.prNumber}/merge`,
        'PUT',
        {
          sha: fresh.headSha,
          merge_method: 'squash',
          commit_title: 'chore(deps): apply verified dependency update',
        },
      ),
    );
    requireValue3(
      result.merged === true &&
        typeof result.sha === 'string' &&
        /^[a-f0-9]{40}$/.test(result.sha),
      'MERGE_REJECTED',
    );
    return { ...attempt, status: 'success', resultingSha: result.sha };
  } catch (error) {
    if (
      error instanceof BoundaryError &&
      ['HTTP_REJECTED', 'GRAPHQL_REJECTED', 'MERGE_REJECTED'].includes(
        error.code,
      )
    )
      return { ...attempt, status: 'failure', reasons: [error.code] };
    try {
      const pr = object(
        await api.json(`/repos/${fresh.repository}/pulls/${fresh.prNumber}`),
      );
      if (validated.operation === 'dependency-merge') {
        if (pr.merged === true && typeof pr.merge_commit_sha === 'string') {
          const commit = object(
            await api.json(
              `/repos/${fresh.repository}/commits/${pr.merge_commit_sha}`,
            ),
          );
          requireValue3(
            object(pr.head).sha === fresh.headSha &&
              Array.isArray(commit.parents) &&
              commit.parents.length === 1 &&
              object(commit.parents[0]).sha === fresh.baseSha,
            'RESULT_UNKNOWN',
          );
          return {
            ...attempt,
            status: 'success',
            resultingSha: pr.merge_commit_sha,
          };
        }
      } else {
        const sha = object(pr.head).sha;
        if (typeof sha === 'string' && sha !== fresh.headSha) {
          const commit = object(
            await api.json(`/repos/${fresh.repository}/git/commits/${sha}`),
          );
          requireValue3(
            Array.isArray(commit.parents) &&
              commit.parents.length === 1 &&
              object(commit.parents[0]).sha === fresh.headSha,
            'RESULT_UNKNOWN',
          );
          for (const item of changes)
            requireValue3(
              Buffer.from(
                await contentAt(api, fresh.repository, item.path, sha),
              ).equals(item.replacementBytes),
              'RESULT_UNKNOWN',
            );
          const files = await api.pages(
            `/repos/${fresh.repository}/compare/${fresh.headSha}...${sha}`,
            'files',
          );
          requireValue3(
            files.length === changes.length &&
              files.every((file) =>
                changes.some((item) => item.path === object(file).filename),
              ),
            'RESULT_UNKNOWN',
          );
          return { ...attempt, status: 'success', resultingSha: sha };
        }
      }
    } catch {}
    return { ...attempt, status: 'unknown', reasons: ['WRITE_RESULT_UNKNOWN'] };
  }
}

// scripts/maintenance/reproduce.ts
import { spawn } from 'node:child_process';
import { createHash as createHash3 } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

var executeCommand = async (command) =>
  new Promise((resolve, reject) => {
    const child = spawn(command.executable, command.args, {
      cwd: command.cwd,
      env: command.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });
    const chunks = [];
    let size = 0,
      stderrSize = 0;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new BoundaryError('REPRODUCTION_TIMEOUT'));
    }, 1800000);
    child.stdout.on('data', (raw) => {
      size += raw.length;
      if (size > BYTE_LIMIT) {
        child.kill('SIGKILL');
        reject(new BoundaryError('BYTE_LIMIT'));
      } else chunks.push(raw);
    });
    child.stderr.on('data', (raw) => {
      stderrSize += raw.length;
      if (stderrSize > BYTE_LIMIT) {
        child.kill('SIGKILL');
        reject(new BoundaryError('BYTE_LIMIT'));
      }
    });
    child.on('error', () => {
      clearTimeout(timer);
      reject(new BoundaryError('REPRODUCTION_FAILED'));
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code !== 0 || signal)
        reject(new BoundaryError('REPRODUCTION_FAILED'));
      else resolve(new Uint8Array(Buffer.concat(chunks, size)));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(command.stdin);
  });
function rejectUnless(value, code) {
  if (!value) throw new BoundaryError(code);
}
var utf8 = (bytes) => {
  limitBytes(bytes);
  try {
    const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    rejectUnless(!value.includes('\x00'), 'BINARY_FILE');
    return value;
  } catch (error) {
    if (error instanceof BoundaryError) throw error;
    throw new BoundaryError('BINARY_FILE');
  }
};
function isolatedEnvironment(workspace) {
  return {
    PATH: process.env.PATH ?? '',
    HOME: workspace,
    TMPDIR: workspace,
    CI: 'true',
    BUN_INSTALL_CACHE_DIR: join(workspace, 'cache'),
  };
}
function command(executable, args, cwd, stdin) {
  rejectUnless(executable.startsWith('/'), 'UNTRUSTED_EXECUTABLE');
  return {
    executable,
    args,
    cwd,
    env: isolatedEnvironment(cwd),
    ...(stdin ? { stdin } : {}),
  };
}
async function fetchSourceFiles(api, acquired) {
  const treeResult = await api.json(
    `/repos/${acquired.repository}/git/trees/${acquired.headSha}?recursive=1`,
  );
  rejectUnless(
    treeResult.truncated === false &&
      Array.isArray(treeResult.tree) &&
      treeResult.tree.length <= 1e4,
    'UNKNOWN_CLASSIFICATION',
  );
  const tree = treeResult.tree;
  let size = 0;
  const result = [];
  for (const changed of acquired.files) {
    canonicalPath(changed.path);
    const matches = tree.filter((file) => file.path === changed.path);
    rejectUnless(
      matches.length === 1 &&
        matches[0]?.type === 'blob' &&
        ['100644', '100755'].includes(matches[0]?.mode ?? '') &&
        matches[0]?.sha === changed.sha &&
        changed.status === 'modified',
      'UNKNOWN_CLASSIFICATION',
    );
    const originalBytes = await contentAt(
      api,
      acquired.repository,
      changed.path,
      acquired.headSha,
    );
    size += originalBytes.length;
    rejectUnless(size <= BYTE_LIMIT && result.length < 500, 'BYTE_LIMIT');
    const blobSha = createHash3('sha1')
      .update(`blob ${originalBytes.length}\x00`)
      .update(originalBytes)
      .digest('hex');
    rejectUnless(blobSha === changed.sha, 'SOURCE_BYTES_MISMATCH');
    result.push({
      path: changed.path,
      status: changed.status,
      mode: matches[0]?.mode ?? '',
      originalBytes,
    });
  }
  return result;
}
async function reproduceFormat(
  acquisition,
  files,
  policy,
  trustedConfig,
  biomeExecutable,
  execute = executeCommand,
) {
  rejectUnless(
    digest(limitBytes(trustedConfig)) === policy.formatterConfigDigest,
    'FORMATTER_MISMATCH',
  );
  rejectUnless(
    files.length <= 500 &&
      new Set(files.map((file) => file.path)).size === files.length,
    'FILE_LIMIT',
  );
  let size = 0;
  for (const file of files) {
    canonicalPath(file.path);
    rejectUnless(
      file.status === 'modified' &&
        ['100644', '100755'].includes(file.mode) &&
        (file.path === 'index.ts' ||
          ['runtime/', 'scripts/', 'tests/'].some((prefix) =>
            file.path.startsWith(prefix),
          )) &&
        file.path.endsWith('.ts') &&
        !file.path.startsWith('scripts/release/') &&
        !file.path.startsWith('scripts/maintenance/'),
      'UNKNOWN_CLASSIFICATION',
    );
    size += limitBytes(file.originalBytes).length;
    utf8(file.originalBytes);
  }
  rejectUnless(size <= BYTE_LIMIT, 'BYTE_LIMIT');
  const workspace = await mkdtemp(join(tmpdir(), 'formicarium-format-'));
  try {
    await writeFile(join(workspace, 'biome.json'), trustedConfig);
    const version = utf8(
      await execute(command(biomeExecutable, ['--version'], workspace)),
    );
    rejectUnless(
      /^(?:Version:\s*)?2\.5\.15\s*$/.test(version),
      'FORMATTER_MISMATCH',
    );
    const changes = [];
    for (const file of files) {
      const replacementBytes = limitBytes(
        await execute(
          command(
            biomeExecutable,
            [
              'format',
              '--config-path',
              workspace,
              '--stdin-file-path',
              file.path,
            ],
            workspace,
            file.originalBytes,
          ),
        ),
      );
      utf8(replacementBytes);
      if (
        !Buffer.from(replacementBytes).equals(Buffer.from(file.originalBytes))
      )
        changes.push({
          path: file.path,
          originalDigest: digest(file.originalBytes),
          replacementBytes,
        });
    }
    changes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    rejectUnless(
      changes.reduce(
        (total, item) => total + item.replacementBytes.length,
        0,
      ) <= BYTE_LIMIT,
      'BYTE_LIMIT',
    );
    const diffDigest = changes.length
      ? digest(
          JSON.stringify(
            changes.map((item) => ({
              path: item.path,
              originalDigest: item.originalDigest,
              replacement: Buffer.from(item.replacementBytes).toString(
                'base64',
              ),
            })),
          ),
        )
      : digest('');
    const request = {
      schemaVersion: 1,
      operation: 'format-push',
      context: {
        repository: acquisition.repository,
        prNumber: acquisition.prNumber,
        headSha: acquisition.headSha,
        currentHeadSha: acquisition.headSha,
        sameRepository: true,
        prOpen: true,
        trustedWorkflow: false,
        evidence: acquisition.evidence,
      },
      changedPaths: changes.map((item) => item.path),
      proposedDiffDigest: diffDigest,
      reproducedDiffDigest: diffDigest,
      trustedFormatterRevision: policy.formatterRevision,
      trustedConfigDigest: policy.formatterConfigDigest,
      reproducible: true,
      formattingOnly: true,
      emptyDiff: changes.length === 0,
    };
    const adapted = adaptMaintenanceEvidence(
      request,
      policy,
      acquisition.observation,
    );
    rejectUnless(adapted.ok, 'INVALID_EVIDENCE');
    const decision = evaluateMaintenance(
      adapted.value.request,
      adapted.value.policy,
    );
    return {
      request: {
        ...request,
        context: { ...request.context, trustedWorkflow: true },
      },
      changes,
      decision,
    };
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}
function object2(value) {
  rejectUnless(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'INVALID_MANIFEST',
  );
  return value;
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
function stableVersion(value) {
  return (
    typeof value === 'string' &&
    /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(value) &&
    value.split('.').map(Number).every(Number.isSafeInteger)
  );
}
async function reproduceDependency(
  acquisition,
  policy,
  trustedManifest,
  trustedLock,
  candidateManifest,
  candidateLock,
  bunExecutable,
  execute = executeCommand,
  trustedRegistry,
) {
  const base = object2(snapshot(decodeJson(trustedManifest))),
    candidate = object2(snapshot(decodeJson(candidateManifest)));
  const before = object2(base.devDependencies),
    after = object2(candidate.devDependencies);
  rejectUnless(
    canonical(Object.keys(before).sort()) ===
      canonical(Object.keys(after).sort()),
    'DIRECT_UPDATE_COUNT',
  );
  const changed = Object.keys(before).filter(
    (name) => before[name] !== after[name],
  );
  rejectUnless(
    changed.length === 1 &&
      acquisition.files.length === 2 &&
      acquisition.files.every(
        (file) =>
          ['package.json', 'bun.lock'].includes(file.path) &&
          file.status === 'modified',
      ),
    'DIRECT_UPDATE_COUNT',
  );
  const name = changed[0];
  rejectUnless(
    name && policy.allowedDevDependencies.includes(name),
    'DEPENDENCY_NOT_ALLOWED',
  );
  const from = before[name],
    to = after[name];
  rejectUnless(
    stableVersion(from) && stableVersion(to),
    'UNSAFE_DEPENDENCY_VERSION',
  );
  const oldParts = from.split('.').map(Number),
    newParts = to.split('.').map(Number);
  const kind = newParts[1] !== oldParts[1] ? 'minor' : 'patch';
  rejectUnless(
    oldParts[0] === newParts[0] &&
      ((newParts[1] ?? 0) > (oldParts[1] ?? 0) ||
        (newParts[1] === oldParts[1] &&
          (newParts[2] ?? 0) > (oldParts[2] ?? 0))),
    'UNSAFE_DEPENDENCY_VERSION',
  );
  const expected = { ...base, devDependencies: { ...before, [name]: to } };
  rejectUnless(
    canonical(expected) === canonical(candidate),
    'MIXED_OR_PROTECTED_CHANGES',
  );
  const baseText = utf8(trustedManifest);
  const pattern = new RegExp(
    `("${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:\\s*)"${from.replaceAll('.', '\\.')}"`,
    'g',
  );
  const matches = [...baseText.matchAll(pattern)];
  rejectUnless(matches.length === 1, 'MIXED_OR_PROTECTED_CHANGES');
  const expectedBytes = new TextEncoder().encode(
    baseText.replace(pattern, `$1"${to}"`),
  );
  rejectUnless(
    Buffer.from(expectedBytes).equals(Buffer.from(candidateManifest)),
    'MIXED_OR_PROTECTED_CHANGES',
  );
  const workspace = await mkdtemp(join(tmpdir(), 'formicarium-dependency-'));
  try {
    const version = utf8(
      await execute(command(bunExecutable, ['--version'], workspace)),
    );
    rejectUnless(version.trim() === '1.4.2', 'TOOLCHAIN_MISMATCH');
    await writeFile(join(workspace, 'package.json'), expectedBytes);
    await writeFile(join(workspace, 'bun.lock'), limitBytes(trustedLock));
    if (trustedRegistry) {
      const registry = new URL(trustedRegistry);
      rejectUnless(
        ['https:', 'http:'].includes(registry.protocol) &&
          !registry.username &&
          !registry.password &&
          !/[\r\n]/.test(trustedRegistry),
        'UNTRUSTED_REGISTRY',
      );
      await writeFile(
        join(workspace, '.npmrc'),
        `registry=${registry.href}
`,
      );
    }
    await execute(
      command(
        bunExecutable,
        ['install', '--lockfile-only', '--ignore-scripts'],
        workspace,
      ),
    );
    const reproduced = limitBytes(await readFile(join(workspace, 'bun.lock')));
    rejectUnless(
      Buffer.from(reproduced).equals(Buffer.from(limitBytes(candidateLock))),
      'LOCK_MISMATCH',
    );
    await execute(
      command(
        bunExecutable,
        ['install', '--frozen-lockfile', '--ignore-scripts'],
        workspace,
      ),
    );
    rejectUnless(
      Buffer.from(await readFile(join(workspace, 'bun.lock'))).equals(
        Buffer.from(reproduced),
      ),
      'LOCK_MISMATCH',
    );
    const parseLock = async (bytes) =>
      object2(
        decodeJson(
          await execute(
            command(
              bunExecutable,
              [
                '-e',
                'process.stdout.write(JSON.stringify(Bun.JSONC.parse(await new Response(Bun.stdin.stream()).text())))',
              ],
              workspace,
              bytes,
            ),
          ),
        ),
      );
    const oldLock = await parseLock(trustedLock),
      newLock = await parseLock(reproduced);
    const resolved = (lock) => {
      const entry = object2(lock.packages)[name];
      rejectUnless(
        Array.isArray(entry) && typeof entry[0] === 'string',
        'UNSAFE_DEPENDENCY_VERSION',
      );
      return entry[0].slice(name.length + 1);
    };
    rejectUnless(
      resolved(oldLock) === from && resolved(newLock) === to,
      'UNSAFE_DEPENDENCY_VERSION',
    );
    rejectUnless(
      acquisition.receiptLockDigest === digest(reproduced),
      'TOOLCHAIN_MISMATCH',
    );
    const request = {
      schemaVersion: 1,
      operation: 'dependency-merge',
      context: {
        repository: acquisition.repository,
        prNumber: acquisition.prNumber,
        headSha: acquisition.headSha,
        currentHeadSha: acquisition.headSha,
        sameRepository: true,
        prOpen: true,
        trustedWorkflow: false,
        evidence: acquisition.evidence,
      },
      authenticatedUpdateBot: acquisition.authenticatedUpdateBot,
      directUpdates: [{ name, from, to, kind }],
      devDependenciesOnly: true,
      mixedOrProtectedChanges: false,
      expectedLockDigest: digest(candidateLock),
      reproducedLockDigest: digest(reproduced),
      protectedMain: acquisition.protectedMain === true,
      mergeable: acquisition.mergeable === true,
    };
    const adapted = adaptMaintenanceEvidence(
      request,
      policy,
      acquisition.observation,
    );
    rejectUnless(adapted.ok, 'INVALID_EVIDENCE');
    return {
      request: {
        ...request,
        context: { ...request.context, trustedWorkflow: true },
      },
      decision: evaluateMaintenance(
        adapted.value.request,
        adapted.value.policy,
      ),
    };
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

// scripts/maintenance/runner.ts
function ensure(value, code) {
  if (!value) throw new BoundaryError(code);
}
function obj(value) {
  ensure(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'INVALID_API',
  );
  return value;
}
var id = (value) => {
  ensure(
    value && /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value)),
    'INVALID_ID',
  );
  return Number(value);
};
async function loadConfig(root) {
  const raw = obj(
    decodeJson(
      limitBytes(
        await readFile2(resolve(root, '.github/maintenance/policy.json')),
      ),
    ),
  );
  ensure(
    raw.schemaVersion === 1 && raw.writerEnabled === true,
    'WRITER_DISABLED',
  );
  const acquisition = validateAcquisitionPolicy(raw.acquisition);
  ensure(
    Number.isSafeInteger(raw.preparationWorkflowId) &&
      raw.preparationWorkflowId > 0 &&
      raw.preparationWorkflowPath === '.github/workflows/maintenance.yml' &&
      Number.isSafeInteger(raw.preparationProducerAppId) &&
      raw.preparationProducerAppId > 0,
    'INVALID_POLICY',
  );
  return {
    schemaVersion: 1,
    writerEnabled: true,
    acquisition,
    policy: raw.policy,
    preparationWorkflowId: raw.preparationWorkflowId,
    preparationWorkflowPath: raw.preparationWorkflowPath,
    preparationProducerAppId: raw.preparationProducerAppId,
  };
}
async function verifyTrustedSupply(api, root, config, baseSha) {
  ensure(/^[a-f0-9]{40}$/.test(baseSha), 'UNTRUSTED_BASE');
  const repository = obj(
    await api.json(`/repos/${config.acquisition.repository}`),
  );
  ensure(repository.default_branch === 'main', 'UNTRUSTED_BASE');
  const ref = obj(
    await api.json(
      `/repos/${config.acquisition.repository}/git/ref/heads/main`,
    ),
  );
  ensure(obj(ref.object).sha === baseSha, 'UNTRUSTED_BASE');
  for (const path of [
    '.github/maintenance/runner.mjs',
    '.github/maintenance/policy.json',
    'biome.json',
  ]) {
    const actual = await contentAt(
      api,
      config.acquisition.repository,
      path,
      baseSha,
    );
    ensure(
      digest(actual) ===
        digest(limitBytes(await readFile2(resolve(root, path)))),
      'UNTRUSTED_SUPPLY',
    );
  }
}
async function fetchPrepared(api, config, runId, attempt, head, baseSha) {
  const prefix = `/repos/${config.acquisition.repository}`;
  const run = obj(await api.json(`${prefix}/actions/runs/${runId}`));
  ensure(
    run.id === runId &&
      run.run_attempt === attempt &&
      run.workflow_id === config.preparationWorkflowId &&
      run.path === config.preparationWorkflowPath &&
      run.event === 'workflow_run' &&
      run.head_sha === baseSha &&
      obj(run.repository).full_name === config.acquisition.repository,
    'UNTRUSTED_PREPARATION',
  );
  const jobs = await api.pages(
    `${prefix}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`,
    'jobs',
  );
  const matches = jobs.map(obj).filter((job) => job.name === 'prepare');
  ensure(
    matches.length === 1 &&
      matches[0]?.conclusion === 'success' &&
      matches[0]?.run_attempt === attempt,
    'UNTRUSTED_PREPARATION',
  );
  const checkUrl = matches[0]?.check_run_url;
  ensure(
    typeof checkUrl === 'string' &&
      checkUrl.startsWith(`https://api.github.com${prefix}/check-runs/`),
    'UNTRUSTED_PREPARATION',
  );
  const check = obj(await api.json(checkUrl));
  ensure(
    check.name === 'prepare' &&
      check.conclusion === 'success' &&
      obj(check.app).id === config.preparationProducerAppId &&
      obj(check.check_suite).id === run.check_suite_id &&
      check.head_sha === baseSha,
    'UNTRUSTED_PREPARATION',
  );
  const artifacts = await api.pages(
    `${prefix}/actions/runs/${runId}/artifacts?per_page=100`,
    'artifacts',
  );
  const selected = artifacts
    .map(obj)
    .filter(
      (item) =>
        item.name === `maintenance-${head}-${runId}-${attempt}` &&
        item.expired === false,
    );
  ensure(
    selected.length === 1 && obj(selected[0]?.workflow_run).id === runId,
    'UNTRUSTED_PREPARATION',
  );
  const artifactId = selected[0]?.id;
  ensure(
    Number.isSafeInteger(artifactId) && artifactId > 0,
    'UNTRUSTED_PREPARATION',
  );
  const bytes = await api.bytes(
    `${prefix}/actions/artifacts/${artifactId}/zip`,
    config.acquisition.archiveRedirectHosts,
  );
  const members = await unpackArchive(bytes, ['prepared.json']);
  const preparedBytes = members.get('prepared.json');
  ensure(preparedBytes, 'UNTRUSTED_PREPARATION');
  const prepared = obj(decodeJson(preparedBytes));
  const parsed = parseMaintenanceInputs(prepared.request, config.policy);
  ensure(
    parsed.ok &&
      prepared.schemaVersion === 1 &&
      prepared.preparationRunId === runId &&
      prepared.preparationAttempt === attempt &&
      prepared.trustedBaseSha === baseSha &&
      parsed.value.request.context.headSha === head &&
      Array.isArray(prepared.changes),
    'UNTRUSTED_PREPARATION',
  );
  return { ...prepared, request: parsed.value.request };
}
async function runMaintenanceCli(args, env = process.env) {
  const mode = args[0];
  if (mode === 'labels') {
    const root = resolve(args[1] ?? '.');
    const rules = obj(
      decodeJson(
        limitBytes(
          await readFile2(
            resolve(root, '.github/maintenance/label-rules.json'),
          ),
        ),
      ),
    );
    const raw = obj(
      decodeJson(
        limitBytes(
          await readFile2(resolve(root, '.github/maintenance/policy.json')),
        ),
      ),
    );
    const repository = obj(raw.acquisition).repository;
    ensure(
      typeof repository === 'string' && env.MAINTENANCE_TOKEN,
      'INVALID_METADATA',
    );
    const api = new GitHubApi(env.MAINTENANCE_TOKEN);
    const baseSha = env.TRUSTED_BASE_SHA ?? '';
    ensure(/^[a-f0-9]{40}$/.test(baseSha), 'UNTRUSTED_BASE');
    for (const path of [
      '.github/maintenance/runner.mjs',
      '.github/maintenance/label-rules.json',
    ]) {
      ensure(
        digest(await contentAt(api, repository, path, baseSha)) ===
          digest(limitBytes(await readFile2(resolve(root, path)))),
        'UNTRUSTED_SUPPLY',
      );
    }
    ensure(
      rules.schemaVersion === 1 && Array.isArray(rules.rules),
      'INVALID_LABEL_RULE',
    );
    return labelPullRequest(api, repository, id(env.PR_NUMBER), rules.rules);
  }
  ensure(
    ['prepare', 'format-write', 'dependency-merge'].includes(mode ?? ''),
    'INVALID_OPERATION',
  );
  const root = resolve(args[1] ?? '.');
  const config = await loadConfig(root);
  const token = env.MAINTENANCE_TOKEN;
  ensure(token, 'TOKEN_MISSING');
  const baseSha = env.TRUSTED_BASE_SHA ?? '';
  const api = new GitHubApi(token);
  await verifyTrustedSupply(api, root, config, baseSha);
  if (mode === 'prepare') {
    const acquisition = await acquireMaintenance(
      api,
      id(env.CI_RUN_ID),
      config.acquisition,
    );
    const files = acquisition.files;
    let prepared;
    if (
      files.length === 2 &&
      files.every((file) => ['package.json', 'bun.lock'].includes(file.path))
    ) {
      const protectedState = await observeProtection(api, acquisition);
      const result = await reproduceDependency(
        { ...acquisition, ...protectedState },
        config.policy,
        await contentAt(api, acquisition.repository, 'package.json', baseSha),
        await contentAt(api, acquisition.repository, 'bun.lock', baseSha),
        await contentAt(
          api,
          acquisition.repository,
          'package.json',
          acquisition.headSha,
        ),
        await contentAt(
          api,
          acquisition.repository,
          'bun.lock',
          acquisition.headSha,
        ),
        env.BUN_EXECUTABLE ?? '',
      );
      prepared = preparationFrom(
        result.request,
        [],
        baseSha,
        id(env.GITHUB_RUN_ID),
        id(env.GITHUB_RUN_ATTEMPT),
      );
    } else {
      const result = await reproduceFormat(
        acquisition,
        await fetchSourceFiles(api, acquisition),
        config.policy,
        await readFile2(resolve(root, 'biome.json')),
        env.BIOME_EXECUTABLE ?? '',
      );
      prepared = preparationFrom(
        result.request,
        result.changes.map((item) => ({
          path: item.path,
          originalDigest: item.originalDigest,
          replacementBase64: Buffer.from(item.replacementBytes).toString(
            'base64',
          ),
        })),
        baseSha,
        id(env.GITHUB_RUN_ID),
        id(env.GITHUB_RUN_ATTEMPT),
      );
    }
    const bytes = new TextEncoder().encode(JSON.stringify(prepared));
    ensure(bytes.length <= BYTE_LIMIT, 'BYTE_LIMIT');
    await writeFile2(resolve(root, 'prepared.json'), bytes);
    if (env.GITHUB_OUTPUT)
      await writeFile2(
        env.GITHUB_OUTPUT,
        `pr=${acquisition.prNumber}
head=${acquisition.headSha}
operation=${prepared.request.operation}
base=${baseSha}
`,
        { flag: 'a' },
      );
    return {
      status: 'prepared',
      headSha: acquisition.headSha,
      prNumber: acquisition.prNumber,
    };
  }
  const prepared = await fetchPrepared(
    api,
    config,
    id(env.PREPARATION_RUN_ID),
    id(env.PREPARATION_ATTEMPT),
    env.PREPARED_HEAD ?? '',
    baseSha,
  );
  ensure(
    prepared.request.operation ===
      (mode === 'format-write' ? 'format-push' : mode),
    'OPERATION_MISMATCH',
  );
  return executeMaintenance(
    api,
    prepared,
    config.policy,
    config.acquisition,
    baseSha,
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  runMaintenanceCli(process.argv.slice(2))
    .then((result) => {
      process.stdout.write(
        JSON.stringify(result) +
          `
`,
      );
      if (
        'status' in result &&
        ['failure', 'unknown', 'reject'].includes(result.status)
      )
        process.exitCode = 1;
    })
    .catch((error) => {
      process.stderr.write(
        JSON.stringify({
          status: 'reject',
          reasons: [
            error instanceof BoundaryError ? error.code : 'MAINTENANCE_FAILED',
          ],
        }) +
          `
`,
      );
      process.exitCode = 1;
    });
}

export { fetchPrepared, loadConfig, runMaintenanceCli };
