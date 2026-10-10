// scripts/release/bootstrap.ts
import { spawnSync } from 'node:child_process';
// scripts/release/publication-assets.ts
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
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
function assetDigest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
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
      `sha512-${createHash('sha512').update(bytes).digest('base64')}` ===
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

// scripts/release/bootstrap.ts
var ensure2 = (value, code) => {
  if (!value) throw Error(code);
};
async function trustedJson(root, path) {
  const bytes = await readBoundedFile(
    resolve(root, '.github/publication', path),
    ASSET_LIMITS.metadataBytes,
  );
  ensure2(bytes.length <= ASSET_LIMITS.metadataBytes, 'METADATA_LIMIT');
  return JSON.parse(bytes.toString());
}
function validatePolicy(policy) {
  ensure2(
    policy.schemaVersion === 1 &&
      policy.writerEnabled === true &&
      policy.evidence.repository === 'aletheia-works/formicarium' &&
      Number.isSafeInteger(policy.transfer.workflowId) &&
      (policy.transfer.workflowId ?? 0) > 0 &&
      Number.isSafeInteger(policy.transfer.producerAppId) &&
      (policy.transfer.producerAppId ?? 0) > 0 &&
      policy.transfer.workflowPath === '.github/workflows/publish.yml' &&
      policy.transfer.verifyJob === 'verify' &&
      policy.transfer.artifactName === 'publication-assets' &&
      Array.isArray(policy.transfer.archiveRedirectHosts),
    'TRANSFER_POLICY_INCOMPLETE',
  );
}
async function verifyTransfer(root, archive, context, observed) {
  const policy = await trustedJson(root, 'trusted-policy.json');
  validatePolicy(policy);
  ensure2(
    context.repository === policy.evidence.repository &&
      /^[a-f0-9]{40}$/.test(context.sourceSha) &&
      /^[a-f0-9]{64}$/.test(context.inputDigest) &&
      Number.isSafeInteger(context.runId) &&
      context.runId > 0 &&
      Number.isSafeInteger(context.attempt) &&
      context.attempt > 0,
    'TRANSFER_CONTEXT_INVALID',
  );
  for (const key of ['repository', 'sourceSha', 'runId', 'attempt'])
    ensure2(observed[key] === context[key], 'TRANSFER_IDENTITY_MISMATCH');
  ensure2(
    observed.workflowId === policy.transfer.workflowId &&
      observed.workflowPath === policy.transfer.workflowPath &&
      observed.producerAppId === policy.transfer.producerAppId &&
      observed.job === policy.transfer.verifyJob &&
      observed.jobState === 'success' &&
      Number.isSafeInteger(observed.artifactId) &&
      observed.artifactId > 0 &&
      observed.artifactName === policy.transfer.artifactName &&
      observed.artifactDigest === `sha256:${assetDigest(archive)}`,
    'TRANSFER_PROVENANCE_MISMATCH',
  );
  const files = unpackZip(archive);
  const allowed = [
    'runner.mjs',
    'trusted-policy.json',
    'runner-manifest.json',
    'npm.tgz',
    'inputs.tgz',
  ];
  ensure2(
    files.size === allowed.length && allowed.every((path) => files.has(path)),
    'TRANSFER_MEMBER_SET',
  );
  const trustedManifestBytes = await readBoundedFile(
    resolve(root, '.github/publication/runner-manifest.json'),
    ASSET_LIMITS.metadataBytes,
  );
  ensure2(
    files.get('runner-manifest.json')?.equals(trustedManifestBytes),
    'TRANSFER_MANIFEST_MISMATCH',
  );
  const manifest = JSON.parse(trustedManifestBytes.toString());
  ensure2(
    manifest.schemaVersion === 1 &&
      Array.isArray(manifest.files) &&
      manifest.files.length === 2 &&
      new Set(manifest.files.map((item) => item.path)).size === 2 &&
      manifest.files.every((item) =>
        ['runner.mjs', 'trusted-policy.json'].includes(item.path),
      ),
    'TRANSFER_MANIFEST_INVALID',
  );
  for (const item of manifest.files) {
    const file = files.get(item.path);
    ensure2(
      file &&
        file.length <= ASSET_LIMITS.metadataBytes &&
        file.length === item.size &&
        assetDigest(file) === item.sha256,
      'TRANSFER_ASSET_MISMATCH',
    );
    const local = await readFile(
      resolve(root, '.github/publication', item.path),
    );
    ensure2(file?.equals(local), 'TRANSFER_TAG_ASSET_MISMATCH');
  }
  const npm = files.get('npm.tgz');
  const npmMembers = npmFiles(npm);
  const inputs = files.get('inputs.tgz');
  ensure2(
    assetDigest(inputs) === context.inputDigest,
    'TRANSFER_INPUT_MISMATCH',
  );
  const inputMembers = unpackTar(
    inputs,
    ASSET_LIMITS.expandedBytes,
    ASSET_LIMITS.members,
  );
  return { runner: files.get('runner.mjs'), npmMembers, inputMembers };
}
async function executeTransfer(
  root,
  archive,
  context,
  observed,
  mode,
  executor = (executable, args, env) => {
    const result = spawnSync(executable, args, {
      env,
      stdio: 'inherit',
      shell: false,
    });
    return result.signal || result.error ? 1 : (result.status ?? 1);
  },
) {
  ensure2(['publish', 'release'].includes(mode), 'TRANSFER_OPERATION_INVALID');
  const verified = await verifyTransfer(root, archive, context, observed);
  const temporary = await mkdtemp(join(tmpdir(), 'publication-transfer-'));
  try {
    const runner = join(temporary, 'runner.mjs');
    await writeFile(runner, verified.runner, { flag: 'wx' });
    for (const [name, bytes] of verified.npmMembers) {
      const path = join(temporary, 'npm', safeAssetPath(name));
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes, { flag: 'wx' });
    }
    for (const [name, bytes] of verified.inputMembers) {
      const path = join(temporary, 'inputs', safeAssetPath(name));
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes, { flag: 'wx' });
    }
    const status = executor(
      process.execPath,
      [runner, mode, join(temporary, 'inputs')],
      {
        ...process.env,
        FORMICARIUM_NPM_CLI: join(temporary, 'npm/package/bin/npm-cli.js'),
        FORMICARIUM_TRUSTED_POLICY: resolve(
          root,
          '.github/publication/trusted-policy.json',
        ),
      },
    );
    ensure2(status === 0, 'TRANSFER_EXECUTION_FAILED_OR_UNKNOWN');
    return { status: 'completed-readback-required' };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
async function inspectTransfer(root, context, token, fetcher = fetch) {
  const policy = await trustedJson(root, 'trusted-policy.json');
  validatePolicy(policy);
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const prefix = `https://api.github.com/repos/${policy.evidence.repository}`;
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
  const run = await json(`/actions/runs/${context.runId}`);
  ensure2(
    run.id === context.runId &&
      run.run_attempt === context.attempt &&
      run.repository?.full_name === context.repository &&
      run.head_sha === context.sourceSha &&
      run.event === 'push' &&
      run.head_branch === context.tag &&
      run.workflow_id === policy.transfer.workflowId &&
      run.path === policy.transfer.workflowPath,
    'TRANSFER_RUN_MISMATCH',
  );
  const tag = await json(`/git/ref/tags/${encodeURIComponent(context.tag)}`);
  ensure2(
    tag.object?.type === 'commit' && tag.object.sha === context.sourceSha,
    'TRANSFER_TAG_MISMATCH',
  );
  const jobs = await json(
    `/actions/runs/${context.runId}/attempts/${context.attempt}/jobs?per_page=100`,
  );
  ensure2(
    jobs.total_count <= 100 && Array.isArray(jobs.jobs),
    'TRANSFER_PAGINATION_LIMIT',
  );
  const matches = jobs.jobs.filter(
    (job) => job.name === policy.transfer.verifyJob,
  );
  ensure2(
    matches.length === 1 &&
      matches[0].conclusion === 'success' &&
      matches[0].run_attempt === context.attempt,
    'TRANSFER_JOB_MISMATCH',
  );
  const checkUrl = matches[0].check_run_url;
  ensure2(
    typeof checkUrl === 'string' &&
      checkUrl.startsWith(`${prefix}/check-runs/`),
    'TRANSFER_CHECK_URL',
  );
  const check = JSON.parse(
    (
      await fetchAsset(checkUrl, ASSET_LIMITS.metadataBytes, fetcher, headers)
    ).toString(),
  );
  ensure2(
    check.head_sha === context.sourceSha &&
      check.app?.id === policy.transfer.producerAppId &&
      check.check_suite?.id === run.check_suite_id &&
      check.name === policy.transfer.verifyJob &&
      check.conclusion === 'success',
    'TRANSFER_PRODUCER_MISMATCH',
  );
  const artifacts = await json(
    `/actions/runs/${context.runId}/artifacts?per_page=100`,
  );
  ensure2(
    artifacts.total_count <= 100 && Array.isArray(artifacts.artifacts),
    'TRANSFER_PAGINATION_LIMIT',
  );
  const selected = artifacts.artifacts.filter(
    (item) =>
      item.name === policy.transfer.artifactName && item.expired === false,
  );
  ensure2(
    selected.length === 1 &&
      selected[0].workflow_run?.id === context.runId &&
      selected[0].workflow_run?.head_sha === context.sourceSha,
    'TRANSFER_ARTIFACT_MISMATCH',
  );
  const item = selected[0];
  ensure2(
    Number.isSafeInteger(item.id) &&
      item.id > 0 &&
      /^sha256:[a-f0-9]{64}$/.test(item.digest),
    'TRANSFER_ARTIFACT_DIGEST',
  );
  const archive = await fetchAsset(
    `${prefix}/actions/artifacts/${item.id}/zip`,
    ASSET_LIMITS.inputBytes,
    fetcher,
    headers,
    policy.transfer.archiveRedirectHosts,
  );
  const observed = {
    repository: context.repository,
    sourceSha: context.sourceSha,
    runId: context.runId,
    attempt: context.attempt,
    workflowId: run.workflow_id,
    workflowPath: run.path,
    producerAppId: check.app.id,
    job: check.name,
    jobState: check.conclusion,
    artifactId: item.id,
    artifactName: item.name,
    artifactDigest: item.digest,
  };
  return { archive, observed };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const mode = process.argv[2];
  try {
    ensure2(
      mode === 'publish' || mode === 'release',
      'TRANSFER_OPERATION_INVALID',
    );
    const context = {
      repository: process.env.GITHUB_REPOSITORY ?? '',
      sourceSha: process.env.GITHUB_SHA ?? '',
      tag: process.env.GITHUB_REF_NAME ?? '',
      runId: Number(process.env.GITHUB_RUN_ID),
      attempt: Number(process.env.GITHUB_RUN_ATTEMPT),
      inputDigest: process.env.FORMICARIUM_RELEASE_INPUT_SHA256 ?? '',
    };
    const root = process.cwd();
    const result = await inspectTransfer(
      root,
      context,
      process.env.GH_TOKEN ?? '',
    );
    await executeTransfer(root, result.archive, context, result.observed, mode);
  } catch {
    process.stderr.write(`PUBLICATION_BOOTSTRAP_REJECTED
`);
    process.exitCode = 1;
  }
}

export { executeTransfer, inspectTransfer, verifyTransfer };
