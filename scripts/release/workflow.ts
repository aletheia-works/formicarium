import { parse } from 'yaml';
import { requireCondition } from './evidence.ts';
import type { PublicationIdentity } from './publication.ts';
import { validatePublicationIdentity } from './publication.ts';

export interface PublicationContext {
  event: string;
  repository: string;
  ref: string;
  sha: string;
}
export function assertPublicationContext(
  i: PublicationIdentity,
  c: PublicationContext,
) {
  validatePublicationIdentity(i);
  requireCondition(
    c.event === 'push' &&
      c.repository === i.repository &&
      c.ref === `refs/tags/${i.tag}` &&
      c.sha === i.sourceCommit,
    `untrusted publication context: reviewed inputs require ${i.repository}@${i.sourceCommit} refs/tags/${i.tag}; observed ${c.repository}@${c.sha} ${c.ref} (${c.event}). Prepare matching RC/stable inputs and complete release preflight before publication; do not reuse another version's inputs.`,
  );
}
/** Read-only readiness check; never accepts a PR/fork or a different candidate source. */
export function assertReleasePreflightContext(
  i: PublicationIdentity,
  c: PublicationContext,
  packageVersion: string,
) {
  validatePublicationIdentity(i);
  requireCondition(
    c.event === 'workflow_dispatch' &&
      c.repository === 'aletheia-works/formicarium' &&
      c.repository === i.repository &&
      c.ref === 'refs/heads/main' &&
      c.sha === i.sourceCommit &&
      packageVersion === i.version,
    'untrusted release preflight context',
  );
}
/** Check the YAML-owned automatic publication boundary. Legacy evidence tools remain local. */
export function validatePublishWorkflow(text: string) {
  const w = parse(text);
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
      'publish',
      'release',
      'verify',
    ]),
    'publication jobs differ',
  );
  const origin =
    "github.event_name == 'push' && github.repository == 'aletheia-works/formicarium' && startsWith(github.ref, 'refs/tags/v')";
  const auth = w.jobs.authorize;
  requireCondition(
    auth.if === origin &&
      same(auth.permissions, {
        contents: 'read',
        actions: 'read',
        'pull-requests': 'read',
      }),
    'authorization permissions/origin differ',
  );
  const authorization = auth.steps.find((s: any) => s.run)?.run ?? '';
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
    w.jobs.verify.needs === 'authorize' &&
      w.jobs.verify.uses === './.github/workflows/ci.yml' &&
      same(w.jobs.verify.permissions, {
        contents: 'read',
        actions: 'read',
        'pull-requests': 'read',
      }),
    'verification dependency/permissions differ',
  );
  for (const name of ['publish', 'release']) {
    const job = w.jobs[name];
    requireCondition(
      job.if === origin && job.environment === 'release',
      'publication environment/origin differs',
    );
    requireCondition(
      same(job.needs, name === 'publish' ? 'verify' : ['verify', 'publish']),
      'publication dependency differs',
    );
    requireCondition(
      same(
        job.permissions,
        name === 'publish'
          ? { contents: 'read', 'id-token': 'write' }
          : { contents: 'write' },
      ),
      'writer permissions differ',
    );
    requireCondition(
      job.env.EXPECTED_SHA256 ===
        '${{ needs.verify.outputs.candidate-sha256 }}' &&
        job.env.DIST_TAG === '${{ needs.verify.outputs.candidate-dist-tag }}',
      'verified identity output differs',
    );
    const download = job.steps.find((s: any) =>
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
    const digest = job.steps.find((s: any) => s.id === 'digest');
    requireCondition(
      digest?.run.includes('sha256sum --check --strict') &&
        digest.run.includes('$EXPECTED_SHA256') &&
        job.steps.indexOf(download) < job.steps.indexOf(digest),
      'artifact digest gate missing',
    );
    const selector = job.steps.find((s: any) => s.id === 'select-package');
    requireCondition(
      selector?.run.trim() ===
        'mkdir -p .artifacts/publication-package\ncp .artifacts/downloaded-candidate/release-candidate/candidate.tgz .artifacts/publication-package/candidate.tgz' &&
        job.steps.indexOf(download) < job.steps.indexOf(selector) &&
        job.steps.indexOf(selector) < job.steps.indexOf(digest),
      'artifact selection differs',
    );
    requireCondition(
      job.steps.filter((s: any) => s.run).length ===
        (name === 'publish' ? 4 : 3),
      'unvalidated publication steps',
    );
    if (name === 'publish') {
      const registry = job.steps.find((s: any) => s.id === 'registry');
      requireCondition(
        registry &&
          job.steps.indexOf(digest) < job.steps.indexOf(registry) &&
          registry.run.includes('digest !== process.env.EXPECTED_SHA256') &&
          job.steps.at(-1).if === "steps.registry.outputs.skip == 'false'",
        'registry integrity gate missing',
      );
    }
    const writer = job.steps.at(-1);
    requireCondition(
      job.steps.indexOf(digest) < job.steps.indexOf(writer) &&
        writer.run.includes(
          name === 'publish'
            ? 'bunx npm@latest publish ./candidate.tgz --provenance --access public --registry https://registry.npmjs.org/ --tag "$DIST_TAG" --ignore-scripts'
            : 'gh release upload "$RELEASE_TAG" ./candidate.tgz',
        ),
      'unvalidated publication command',
    );
    // Every release is stable (no RCs); the stored 0.1.0 evidence still
    // types next, so both writers refuse any other dist-tag themselves.
    requireCondition(
      writer.run.includes(
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
