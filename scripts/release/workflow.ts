import { parse } from 'yaml';
import { requireCondition } from './evidence.ts';

/**
 * One step of a GitHub Actions job, with the fields the release checks read.
 * A parsed workflow is only cast to these types; the checks below still test
 * every value they rely on.
 */
export interface WorkflowStep {
  id?: string;
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
  'working-directory'?: string;
  'continue-on-error'?: boolean;
}

/** One job; a job that calls a reusable workflow has `uses` and no steps. */
export interface WorkflowJob {
  if?: string;
  needs?: string | string[];
  uses?: string;
  environment?: string;
  permissions?: Record<string, string>;
  env?: Record<string, string>;
  strategy?: unknown;
  steps: WorkflowStep[];
}

/** A parsed GitHub Actions workflow file. */
export interface Workflow {
  on?: Record<string, unknown>;
  permissions?: Record<string, string>;
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean };
  jobs: Record<string, WorkflowJob>;
}

/** Parses a workflow file as a {@link Workflow}. */
export const parseWorkflow = (text: string) => parse(text) as Workflow;

/** Check the YAML-owned automatic publication boundary. */
export function validatePublishWorkflow(text: string) {
  const w = parseWorkflow(text);
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);
  requireCondition(
    same(w.on, { push: { tags: ['v*'] } }),
    'publication triggers differ',
  );
  requireCondition(
    same(w.permissions, { contents: 'read' }),
    'global publication permissions differ',
  );
  requireCondition(
    w.concurrency?.group === 'publication-${{ github.ref }}' &&
      w.concurrency['cancel-in-progress'] === false,
    'publication concurrency differs',
  );
  requireCondition(
    same(Object.keys(w.jobs).sort(), [
      'authorize',
      'jsr',
      'publish',
      'release',
      'verify',
    ]),
    'publication jobs differ',
  );
  // The check above leaves exactly these jobs.
  const jobs = w.jobs as Record<
    'authorize' | 'jsr' | 'publish' | 'release' | 'verify',
    WorkflowJob
  >;
  const origin =
    "github.event_name == 'push' && github.repository == 'aletheia-works/formicarium' && startsWith(github.ref, 'refs/tags/v')";
  const auth = jobs.authorize;
  requireCondition(
    auth.if === origin &&
      same(auth.permissions, {
        contents: 'read',
        actions: 'read',
        'pull-requests': 'read',
      }),
    'authorization permissions/origin differ',
  );
  const authorization = auth.steps.find((s) => s.run)?.run ?? '';
  for (const term of [
    '.merge_commit_sha == $sha',
    '.base.ref == "main"',
    '.head.repo.full_name == $repo',
    '.user.login == "aletheia-works-bot[bot]"',
    '.head.ref == "release-please--branches--main--components--formicarium"',
    '.head_sha == $sha',
    '.workflow_id == $workflow',
    '.conclusion == "success"',
  ])
    requireCondition(
      authorization.includes(term),
      'merged release PR CI gate missing',
    );
  requireCondition(
    jobs.verify.needs === 'authorize' &&
      jobs.verify.uses === './.github/workflows/ci.yml' &&
      same(jobs.verify.permissions, {
        contents: 'read',
        actions: 'read',
        'pull-requests': 'read',
      }),
    'verification dependency/permissions differ',
  );
  // Both registries take the verified tarball over OIDC; JSR gets it after npm.
  const NEEDS: Record<string, unknown> = {
    publish: 'verify',
    jsr: ['verify', 'publish'],
    release: ['verify', 'publish'],
  };
  const WRITERS: Record<string, string> = {
    publish:
      'bunx npm@latest publish ./candidate.tgz --provenance --access public --registry https://registry.npmjs.org/ --tag "$DIST_TAG" --ignore-scripts',
    jsr: 'bunx jsr@latest publish',
    release: 'gh release upload "$RELEASE_TAG" ./candidate.tgz',
  };
  for (const name of ['publish', 'jsr', 'release'] as const) {
    const job = jobs[name];
    // A missing step is at -1, as indexOf(undefined) would answer.
    const at = (step: WorkflowStep | undefined) =>
      step ? job.steps.indexOf(step) : -1;
    const registry = name !== 'release';
    requireCondition(
      job.if === origin && job.environment === 'release',
      'publication environment/origin differs',
    );
    requireCondition(
      same(job.needs, NEEDS[name]),
      'publication dependency differs',
    );
    requireCondition(
      same(
        job.permissions,
        registry
          ? { contents: 'read', 'id-token': 'write' }
          : { contents: 'write' },
      ),
      'writer permissions differ',
    );
    requireCondition(
      job.env?.EXPECTED_SHA256 ===
        '${{ needs.verify.outputs.candidate-sha256 }}' &&
        job.env?.DIST_TAG === '${{ needs.verify.outputs.candidate-dist-tag }}',
      'verified identity output differs',
    );
    const download = job.steps.find((s) =>
      s.uses?.startsWith('actions/download-artifact@'),
    );
    requireCondition(
      download?.with?.name ===
        '${{ needs.verify.outputs.candidate-artifact }}' &&
        !download.with['run-id'] &&
        !download.with['github-token'] &&
        !download.with.repository,
      'same-run artifact required',
    );
    const digest = job.steps.find((s) => s.id === 'digest');
    requireCondition(
      digest?.run?.includes('sha256sum --check --strict') &&
        digest.run.includes('$EXPECTED_SHA256') &&
        at(download) < at(digest),
      'artifact digest gate missing',
    );
    const selector = job.steps.find((s) => s.id === 'select-package');
    requireCondition(
      selector?.run?.trim() ===
        'mkdir -p .artifacts/publication-package\ncp .artifacts/downloaded-candidate/release-candidate/candidate.tgz .artifacts/publication-package/candidate.tgz' &&
        at(download) < at(selector) &&
        at(selector) < at(digest),
      'artifact selection differs',
    );
    requireCondition(
      job.steps.filter((s) => s.run).length ===
        { publish: 4, jsr: 5, release: 3 }[name],
      'unvalidated publication steps',
    );
    if (name === 'jsr') {
      // JSR publishes the files of the checked tarball, never the checkout.
      const unpack = job.steps.find((s) => s.id === 'unpack');
      requireCondition(
        unpack?.run?.includes('tar -xzf candidate.tgz') &&
          at(digest) < at(unpack) &&
          job.steps.every((s) => !s.uses?.startsWith('actions/checkout@')) &&
          job.steps
            .slice(at(unpack) + 1)
            .every(
              (s) =>
                s['working-directory'] ===
                '.artifacts/publication-package/package',
            ),
        'verified JSR files required',
      );
      // No flag may let JSR publish more than jsr.json names.
      requireCondition(
        job.steps
          .at(-1)
          ?.run?.split('\n')
          .map((line: string) => line.trim())
          .filter((line: string) => line.startsWith('bunx '))
          .join('\n') === WRITERS.jsr,
        'unvalidated publication command',
      );
    }
    if (registry) {
      const lookup = job.steps.find((s) => s.id === 'registry');
      requireCondition(
        lookup &&
          at(digest) < at(lookup) &&
          lookup.run?.includes(
            name === 'publish'
              ? 'digest !== process.env.EXPECTED_SHA256'
              : 'manifest[path].checksum !== expected[path].checksum',
          ) &&
          job.steps.at(-1)?.if === "steps.registry.outputs.skip == 'false'",
        'registry integrity gate missing',
      );
    }
    const writer = job.steps.at(-1);
    requireCondition(
      at(digest) < at(writer) && writer?.run?.includes(WRITERS[name] as string),
      'unvalidated publication command',
    );
    // Every release is stable (no RCs) and goes to latest, so every writer
    // refuses any other dist-tag itself.
    requireCondition(
      writer?.run?.includes(
        '[[ "$DIST_TAG" == latest ]] || { echo "dist-tag must be latest, got $DIST_TAG" >&2; exit 1; }',
      ),
      'latest-only guard missing',
    );
    for (const step of job.steps) {
      requireCondition(
        !step['continue-on-error'],
        'failed gate bypass refused',
      );
      requireCondition(
        !JSON.stringify(step).match(
          /NODE_AUTH_TOKEN|NPM_TOKEN|_authToken|secrets\./,
        ),
        'token fallback refused',
      );
      if (step.uses)
        requireCondition(
          /^[^\s]+@[a-f0-9]{40}$/.test(step.uses),
          'action not pinned',
        );
    }
  }
  return w;
}
