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
/** Validate the native Actions dependency and artifact boundaries. */
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
    same(Object.keys(w.jobs).sort(), ['publish', 'release', 'verify']),
    'publication jobs differ',
  );
  const origin =
    "github.event_name == 'push' && github.repository == 'aletheia-works/formicarium' && startsWith(github.ref, 'refs/tags/v')";
  for (const [name, job] of Object.entries(w.jobs) as [string, any][]) {
    requireCondition(
      job['runs-on'] === 'ubuntu-latest' && job['timeout-minutes'] === 30,
      'publication runner/time limit differs',
    );
    const expected =
      name === 'verify'
        ? { contents: 'read', actions: 'read', checks: 'read' }
        : name === 'publish'
          ? { contents: 'read', 'id-token': 'write' }
          : { contents: 'write' };
    requireCondition(same(job.permissions, expected), 'job permissions differ');
    requireCondition(
      job.if ===
        origin +
          (name === 'release'
            ? " && needs.verify.outputs.release-approved == 'true'"
            : ''),
      'job origin/approval gate differs',
    );
    requireCondition(
      !JSON.stringify(job).match(
        /NODE_AUTH_TOKEN|NPM_TOKEN|_authToken|secrets\./,
      ),
      'token fallback refused',
    );
    for (const step of job.steps) {
      if (step.uses)
        requireCondition(
          /^[^\s]+@[a-f0-9]{40}$/.test(step.uses),
          'action not pinned',
        );
      requireCondition(
        step.if === undefined && step['continue-on-error'] === undefined,
        'conditional publication step refused',
      );
    }
    requireCondition(
      job['continue-on-error'] === undefined,
      'failed gate bypass refused',
    );
    const runs = job.steps.filter((s: any) => s.run);
    if (name === 'verify') {
      requireCondition(
        same(
          runs.map((s: any) => s.run),
          [
            'bun install --frozen-lockfile --ignore-scripts',
            'bun scripts/release/publication-cli.ts fetch .artifacts/publication',
            'bun scripts/release/publication-cli.ts prepare-artifact .artifacts/publication .artifacts/publication-package',
          ],
        ) && runs[2].id === 'candidate',
        'publication gate missing',
      );
      const checkout = job.steps.find((s: any) =>
        s.uses?.startsWith('actions/checkout@'),
      );
      requireCondition(
        checkout?.with?.ref === '${{ github.sha }}' &&
          checkout.with['persist-credentials'] === false,
        'trusted exact tag checkout missing',
      );
      for (const key of [
        'version',
        'tag',
        'dist-tag',
        'sha256',
        'release-approved',
      ])
        requireCondition(
          job.outputs?.[key] === '${{ steps.candidate.outputs.' + key + ' }}',
          'verified output differs',
        );
      const upload = job.steps.find((s: any) =>
        s.uses?.startsWith('actions/upload-artifact@'),
      );
      requireCondition(
        upload?.with?.name === 'publication-package' &&
          upload.with.path === '.artifacts/publication-package/candidate.tgz' &&
          upload.with['if-no-files-found'] === 'error' &&
          job.steps.indexOf(upload) > job.steps.indexOf(runs[2]),
        'transfer artifact differs',
      );
    } else {
      requireCondition(
        job.environment === 'release',
        'publication environment differs',
      );
      requireCondition(
        same(job.needs, name === 'publish' ? 'verify' : ['verify', 'publish']),
        'publication dependency differs',
      );
      const download = job.steps.find((s: any) =>
        s.uses?.startsWith('actions/download-artifact@'),
      );
      requireCondition(
        download?.with?.name === 'publication-package' &&
          download.with.path === '.artifacts/publication-package' &&
          !download.with['run-id'] &&
          !download.with['repository'] &&
          !download.with['github-token'] &&
          job.steps.indexOf(download) < job.steps.indexOf(runs[0]),
        'same-run artifact required',
      );
      requireCondition(
        job.env.EXPECTED_SHA256 === '${{ needs.verify.outputs.sha256 }}' &&
          job.env.DIST_TAG === '${{ needs.verify.outputs.dist-tag }}',
        'verified identity output differs',
      );
      requireCondition(
        runs.length === 2 &&
          runs[0].id === 'digest' &&
          runs[0].run.trim() ===
            `set -euo pipefail
[[ "$EXPECTED_SHA256" =~ ^[a-f0-9]{64}$ ]]
printf '%s  candidate.tgz\\n' "$EXPECTED_SHA256" | sha256sum --check --strict`,
        'artifact digest gate missing',
      );
      for (const step of runs)
        requireCondition(
          step.shell === 'bash' &&
            step['working-directory'] === '.artifacts/publication-package',
          'unvalidated publication directory',
        );
      const command =
        name === 'publish'
          ? `set -euo pipefail
[[ "$DIST_TAG" == next || "$DIST_TAG" == latest ]]
bunx npm@latest publish ./candidate.tgz --provenance --access public --registry https://registry.npmjs.org/ --tag "$DIST_TAG" --ignore-scripts`
          : `set -euo pipefail
if gh release view "$RELEASE_TAG" --repo "$GITHUB_REPOSITORY" > /dev/null 2>&1; then
  gh release upload "$RELEASE_TAG" ./candidate.tgz --repo "$GITHUB_REPOSITORY"
else
  flags=(--verify-tag)
  if [[ "$DIST_TAG" == next ]]; then flags+=(--prerelease); fi
  gh release create "$RELEASE_TAG" ./candidate.tgz --repo "$GITHUB_REPOSITORY" --title "formicarium $VERSION" --notes "Reviewed package SHA256: $EXPECTED_SHA256" "\${flags[@]}"
fi`;
      requireCondition(
        runs[1].run.trim() === command,
        'unvalidated publication command',
      );
      if (name === 'release') {
        requireCondition(
          job.env.RELEASE_TAG === '${{ needs.verify.outputs.tag }}' &&
            job.env.VERSION === '${{ needs.verify.outputs.version }}',
          'release identity differs',
        );
      }
    }
  }
  return w;
}
