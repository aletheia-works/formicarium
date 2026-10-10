import { digest } from '../ci/quality-evidence.ts';
import { BoundaryError, BYTE_LIMIT, limitBytes } from './archive.ts';
import { adaptMaintenanceEvidence } from './evidence.ts';
import type { GitHubApi } from './github.ts';
import {
  canonicalPath,
  type MaintenanceRequest,
  parseMaintenanceInputs,
  type TrustedPolicy,
} from './input.ts';
import { evaluateMaintenance } from './policy.ts';
import {
  type Acquisition,
  type AcquisitionPolicy,
  acquireMaintenance,
  contentAt,
  REQUIRED_JOBS,
} from './receipt.ts';

export interface PreparedMaintenance {
  schemaVersion: 1;
  trustedBaseSha: string;
  runId: number;
  runAttempt: number;
  preparationRunId: number;
  preparationAttempt: number;
  request: MaintenanceRequest;
  changes: {
    path: string;
    originalDigest: string;
    replacementBase64: string;
  }[];
}
export interface MaintenanceAttempt {
  repository: string;
  prNumber: number;
  headSha: string;
  runId: string;
  runAttempt: number;
  operation: MaintenanceRequest['operation'];
  decisionId: string | null;
  policyRevision: string;
  status: 'success' | 'failure' | 'unknown' | 'reject' | 'no-op';
  reasons: string[];
  resultingSha: string | null;
}
function requireValue(value: unknown, code: string): asserts value {
  if (!value) throw new BoundaryError(code);
}
function object(value: unknown): Record<string, unknown> {
  requireValue(
    value && typeof value === 'object' && !Array.isArray(value),
    'INVALID_API',
  );
  return value as Record<string, unknown>;
}
export async function observeProtection(
  api: GitHubApi,
  acquisition: Acquisition,
): Promise<{ protectedMain: boolean; mergeable: boolean }> {
  const prefix = `/repos/${acquisition.repository}`;
  const pr = object(await api.json(`${prefix}/pulls/${acquisition.prNumber}`));
  const base = object(pr.base);
  requireValue(
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
  // Unsupported queue/stacked states are rejected rather than bypassed.
  const rules = await api.pages(
    `${prefix}/rulesets?includes_parents=true&per_page=100`,
    '',
  );
  for (const item of rules) {
    const rule = object(item);
    if (rule.enforcement === 'disabled') continue;
    const id = rule.id;
    requireValue(
      Number.isSafeInteger(id) && (id as number) > 0,
      'PROTECTION_UNKNOWN',
    );
    const detail = object(await api.json(`${prefix}/rulesets/${id}`));
    requireValue(Array.isArray(detail.rules), 'PROTECTION_UNKNOWN');
    requireValue(
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
export function preparationFrom(
  request: MaintenanceRequest,
  changes: PreparedMaintenance['changes'],
  trustedBaseSha: string,
  preparationRunId: number,
  preparationAttempt: number,
): PreparedMaintenance {
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
function decodedChanges(prepared: PreparedMaintenance, policy: TrustedPolicy) {
  requireValue(
    Array.isArray(prepared.changes) && prepared.changes.length <= 500,
    'INVALID_PREPARATION',
  );
  const names = new Set<string>();
  let size = 0;
  const changes = prepared.changes.map((item) => {
    canonicalPath(item.path);
    requireValue(
      !names.has(item.path) &&
        policy.allowedFormatPaths.some(
          (allowed) =>
            item.path === allowed || item.path.startsWith(`${allowed}/`),
        ),
      'INVALID_PREPARATION',
    );
    names.add(item.path);
    requireValue(
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
    requireValue(size <= BYTE_LIMIT, 'BYTE_LIMIT');
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
function artifactMatches(
  prepared: PreparedMaintenance,
  fresh: Acquisition,
  policy: TrustedPolicy,
) {
  const parsed = parseMaintenanceInputs(prepared.request, policy);
  requireValue(parsed.ok, 'INVALID_PREPARATION');
  const request = parsed.value.request;
  requireValue(
    prepared.schemaVersion === 1 &&
      prepared.runId === Number(fresh.runId) &&
      prepared.runAttempt === fresh.runAttempt &&
      request.context.repository === fresh.repository &&
      request.context.prNumber === fresh.prNumber &&
      request.context.headSha === fresh.headSha,
    'STALE_PREPARATION',
  );
  // Property order and set order are normalized by parsing before C2 verification.
  const adapted = adaptMaintenanceEvidence(request, policy, fresh.observation);
  requireValue(adapted.ok, 'INVALID_EVIDENCE');
  return adapted.value.request;
}
export async function executeMaintenance(
  api: GitHubApi,
  prepared: PreparedMaintenance,
  policy: TrustedPolicy,
  acquisitionPolicy: AcquisitionPolicy,
  expectedTrustedBaseSha: string,
): Promise<MaintenanceAttempt> {
  const request = prepared.request;
  const attempt: MaintenanceAttempt = {
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
  let fresh: Acquisition;
  let validated: MaintenanceRequest;
  let changes: ReturnType<typeof decodedChanges> = [];
  try {
    requireValue(
      /^[a-f0-9]{40}$/.test(expectedTrustedBaseSha) &&
        prepared.trustedBaseSha === expectedTrustedBaseSha,
      'UNTRUSTED_BASE',
    );
    fresh = await acquireMaintenance(api, prepared.runId, acquisitionPolicy);
    validated = artifactMatches(prepared, fresh, policy);
    if (validated.operation === 'format-push') {
      requireValue(
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
      requireValue(
        changes.every((change) =>
          fresh.files.some((file) => file.path === change.path),
        ),
        'INVALID_PREPARATION',
      );
      requireValue(
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
      requireValue(
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
        requireValue(
          digest(actual) === change.originalDigest,
          'SOURCE_BYTES_MISMATCH',
        );
      }
    } else {
      requireValue(prepared.changes.length === 0, 'INVALID_PREPARATION');
      requireValue(
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
    // A final independent full acquisition closes the preparation-to-write interval.
    const final = await acquireMaintenance(
      api,
      prepared.runId,
      acquisitionPolicy,
    );
    requireValue(
      final.headSha === decision.headSha &&
        final.prNumber === fresh.prNumber &&
        final.branch === fresh.branch,
      'STALE_HEAD',
    );
    requireValue(
      JSON.stringify(final.files) === JSON.stringify(fresh.files),
      'MIXED_OR_PROTECTED_CHANGES',
    );
    if (validated.operation === 'dependency-merge') {
      const protection = await observeProtection(api, final);
      requireValue(
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
      requireValue(!result.errors, 'GRAPHQL_REJECTED');
      const sha = object(
        object(object(result.data).createCommitOnBranch).commit,
      ).oid;
      requireValue(
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
    requireValue(
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
    // Never retry a write whose completion is unknown. Read only reconciliation.
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
          requireValue(
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
          requireValue(
            Array.isArray(commit.parents) &&
              commit.parents.length === 1 &&
              object(commit.parents[0]).sha === fresh.headSha,
            'RESULT_UNKNOWN',
          );
          for (const item of changes)
            requireValue(
              Buffer.from(
                await contentAt(api, fresh.repository, item.path, sha),
              ).equals(item.replacementBytes),
              'RESULT_UNKNOWN',
            );
          const files = await api.pages(
            `/repos/${fresh.repository}/compare/${fresh.headSha}...${sha}`,
            'files',
          );
          requireValue(
            files.length === changes.length &&
              files.every((file) =>
                changes.some((item) => item.path === object(file).filename),
              ),
            'RESULT_UNKNOWN',
          );
          return { ...attempt, status: 'success', resultingSha: sha };
        }
      }
    } catch {
      /* A failed reconciliation must remain unknown; never resend. */
    }
    return { ...attempt, status: 'unknown', reasons: ['WRITE_RESULT_UNKNOWN'] };
  }
}
