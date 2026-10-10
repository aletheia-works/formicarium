import { digest } from '../ci/quality-evidence.js';
import {
  type DependencyRequest,
  type MaintenanceRequest,
  parseMaintenanceInputs,
  type TrustedPolicy,
  type ValidationFailure,
} from './input.js';

export interface Decision {
  schemaVersion: 1;
  decisionId: string;
  operation: MaintenanceRequest['operation'];
  repository: string;
  headSha: string;
  evidenceIdentity: string;
  policyRevision: string;
  outcome: 'allow' | 'reject' | 'no-op';
  reasons: string[];
}
function version(value: string): [number, number, number] | null {
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
function stableUpdate(
  update: DependencyRequest['directUpdates'][number],
): boolean {
  const from = version(update.from);
  const to = version(update.to);
  if (!from || !to || from[0] !== to[0]) return false;
  if (to[1] > from[1]) return update.kind === 'minor';
  return to[1] === from[1] && to[2] > from[2] && update.kind === 'patch';
}
function evaluate(
  request: MaintenanceRequest,
  policy: TrustedPolicy,
): Decision {
  const context = request.context;
  const evidence = context.evidence;
  const reasons: string[] = [];
  const refuse = (condition: boolean, code: string) => {
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
      request.proposedDiffDigest === digest('') &&
      request.reproducedDiffDigest === digest('');
    refuse(
      request.emptyDiff !== empty ||
        (!request.emptyDiff &&
          (request.changedPaths.length === 0 ||
            request.proposedDiffDigest === digest(''))),
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
  const evidenceIdentity = digest(
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
    decisionId: digest(JSON.stringify({ request, policy })),
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

// Valid C3 inputs return a Decision. Raw callers also receive ValidationFailure;
// neither failure shape is a reusable authorization token.
export function evaluateMaintenance(
  request: MaintenanceRequest,
  trustedPolicy: TrustedPolicy,
): Decision;
export function evaluateMaintenance(
  request: unknown,
  trustedPolicy: unknown,
): Decision | ValidationFailure;
export function evaluateMaintenance(
  request: unknown,
  trustedPolicy: unknown,
): Decision | ValidationFailure {
  const parsed = parseMaintenanceInputs(request, trustedPolicy);
  return parsed.ok
    ? evaluate(parsed.value.request, parsed.value.policy)
    : parsed.failure;
}
