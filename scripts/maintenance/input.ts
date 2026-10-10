import type { EvidenceEnvelope } from '../ci/quality-evidence.js';

export interface TrustedPolicy {
  revision: string;
  repository: string;
  allowedFormatPaths: string[];
  allowedDevDependencies: string[];
  requiredCheckProducers: { name: string; producerIdentity: string }[];
  formatterRevision: string;
  formatterConfigDigest: string;
}
export interface CommonContext {
  repository: string;
  prNumber: number;
  headSha: string;
  currentHeadSha: string;
  sameRepository: boolean;
  prOpen: boolean;
  trustedWorkflow: boolean;
  evidence: EvidenceEnvelope;
}
interface BaseRequest {
  schemaVersion: 1;
  context: CommonContext;
}
export interface FormatRequest extends BaseRequest {
  operation: 'format-push';
  changedPaths: string[];
  proposedDiffDigest: string;
  reproducedDiffDigest: string;
  trustedFormatterRevision: string;
  trustedConfigDigest: string;
  reproducible: boolean;
  formattingOnly: boolean;
  emptyDiff: boolean;
}
export interface DependencyRequest extends BaseRequest {
  operation: 'dependency-merge';
  authenticatedUpdateBot: boolean;
  directUpdates: {
    name: string;
    from: string;
    to: string;
    kind: 'patch' | 'minor' | 'major' | 'prerelease' | 'unknown';
  }[];
  devDependenciesOnly: boolean;
  mixedOrProtectedChanges: boolean;
  expectedLockDigest: string;
  reproducedLockDigest: string;
  protectedMain: boolean;
  mergeable: boolean;
}
export type MaintenanceRequest = FormatRequest | DependencyRequest;
export interface ValidationFailure {
  outcome: 'reject';
  reasons: string[];
  operation: null;
  repository: null;
  headSha: null;
  decisionId: null;
}
export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; failure: ValidationFailure };

export const failure = (reason: string): ValidationFailure => ({
  outcome: 'reject',
  reasons: [reason],
  operation: null,
  repository: null,
  headSha: null,
  decisionId: null,
});

function requireValue(value: unknown): asserts value {
  if (!value) throw Error('invalid');
}
export function identity(value: unknown, limit = 256): asserts value is string {
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
export function sha(value: unknown): asserts value is string {
  requireValue(typeof value === 'string' && /^[a-f0-9]{40}$/.test(value));
}
export function hash(value: unknown): asserts value is string {
  requireValue(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value));
}
export function positive(value: unknown): asserts value is number {
  requireValue(Number.isSafeInteger(value) && (value as number) > 0);
}
function runIdentity(value: unknown): asserts value is string {
  identity(value);
  requireValue(/^[1-9][0-9]*$/.test(value));
  positive(Number(value));
}
function boolean(value: unknown) {
  requireValue(typeof value === 'boolean');
}
export function record(value: unknown): Record<string, unknown> {
  requireValue(
    value !== null && typeof value === 'object' && !Array.isArray(value),
  );
  return value as Record<string, unknown>;
}
function collection(value: unknown, max: number): unknown[] {
  requireValue(Array.isArray(value) && value.length <= max);
  return value;
}
function unique(values: readonly string[]) {
  requireValue(new Set(values).size === values.length);
}
export function canonicalPath(value: unknown): asserts value is string {
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

/** Snapshot own data properties before inspecting them: no getter execution. */
export function snapshot(value: unknown): unknown {
  const ancestors = new Set<object>();
  let count = 0;
  function copy(item: unknown, depth: number): unknown {
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
    const output: Record<string, unknown> | unknown[] = array ? [] : {};
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

export function parseChecks(value: unknown): EvidenceEnvelope['checks'] {
  const rows = collection(value, 100).map((item) => {
    const row = record(item);
    identity(row.name);
    identity(row.producerIdentity);
    runIdentity(row.runId);
    sha(row.sourceSha);
    requireValue(
      ['success', 'failure', 'pending', 'skipped', 'cancelled'].includes(
        row.state as string,
      ),
    );
    return {
      name: row.name,
      producerIdentity: row.producerIdentity,
      runId: row.runId,
      sourceSha: row.sourceSha,
      state: row.state as EvidenceEnvelope['checks'][number]['state'],
    };
  });
  unique(rows.map((row) => row.name));
  return rows.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
export function parseProducers(
  value: unknown,
): TrustedPolicy['requiredCheckProducers'] {
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
export function parseEvidence(value: unknown): EvidenceEnvelope {
  const row = record(value);
  requireValue(row.schemaVersion === 1);
  identity(row.repository);
  sha(row.sourceSha);
  runIdentity(row.runId);
  positive(row.runAttempt);
  identity(row.workflowIdentity);
  identity(row.toolchainRevision);
  hash(row.artifactDigest);
  requireValue(
    ['ordinary-ci', 'publication-candidate'].includes(row.purpose as string),
  );
  const result: EvidenceEnvelope = {
    schemaVersion: 1,
    repository: row.repository,
    sourceSha: row.sourceSha,
    runId: row.runId,
    runAttempt: row.runAttempt,
    workflowIdentity: row.workflowIdentity,
    toolchainRevision: row.toolchainRevision,
    artifactDigest: row.artifactDigest,
    purpose: row.purpose as EvidenceEnvelope['purpose'],
    checks: parseChecks(row.checks),
  };
  if (row.coverage !== undefined) {
    const coverage = record(row.coverage);
    hash(coverage.inventoryDigest);
    hash(coverage.receiptsDigest);
    positive(coverage.totalLines);
    requireValue(
      Number.isSafeInteger(coverage.coveredLines) &&
        (coverage.coveredLines as number) >= 0 &&
        (coverage.coveredLines as number) <= coverage.totalLines,
    );
    result.coverage = {
      inventoryDigest: coverage.inventoryDigest,
      receiptsDigest: coverage.receiptsDigest,
      coveredLines: coverage.coveredLines as number,
      totalLines: coverage.totalLines,
    };
  }
  return result;
}
function strings(value: unknown, path: boolean): string[] {
  const rows = collection(value, 100);
  for (const row of rows) {
    if (path) canonicalPath(row);
    else identity(row, 214);
  }
  unique(rows as string[]);
  return (rows as string[]).sort();
}
function policy(value: unknown): TrustedPolicy {
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
function request(value: unknown): MaintenanceRequest {
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
    schemaVersion: 1 as const,
    context: {
      repository: context.repository,
      prNumber: context.prNumber,
      headSha: context.headSha,
      currentHeadSha: context.currentHeadSha,
      sameRepository: context.sameRepository as boolean,
      prOpen: context.prOpen as boolean,
      trustedWorkflow: context.trustedWorkflow as boolean,
      evidence: parseEvidence(context.evidence),
    },
  };
  if (row.operation === 'format-push') {
    const paths = collection(row.changedPaths, 500);
    for (const path of paths) canonicalPath(path);
    unique(paths as string[]);
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
      changedPaths: (paths as string[]).sort(),
      proposedDiffDigest: row.proposedDiffDigest as string,
      reproducedDiffDigest: row.reproducedDiffDigest as string,
      trustedConfigDigest: row.trustedConfigDigest as string,
      trustedFormatterRevision: row.trustedFormatterRevision,
      reproducible: row.reproducible as boolean,
      formattingOnly: row.formattingOnly as boolean,
      emptyDiff: row.emptyDiff as boolean,
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
        update.kind as string,
      ),
    );
    return {
      name: update.name,
      from: update.from,
      to: update.to,
      kind: update.kind as DependencyRequest['directUpdates'][number]['kind'],
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
    authenticatedUpdateBot: row.authenticatedUpdateBot as boolean,
    devDependenciesOnly: row.devDependenciesOnly as boolean,
    mixedOrProtectedChanges: row.mixedOrProtectedChanges as boolean,
    expectedLockDigest: row.expectedLockDigest,
    reproducedLockDigest: row.reproducedLockDigest,
    protectedMain: row.protectedMain as boolean,
    mergeable: row.mergeable as boolean,
  };
}
export function parseMaintenanceInputs(
  rawRequest: unknown,
  rawPolicy: unknown,
): ParseResult<{ request: MaintenanceRequest; policy: TrustedPolicy }> {
  let parsedPolicy: TrustedPolicy;
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
