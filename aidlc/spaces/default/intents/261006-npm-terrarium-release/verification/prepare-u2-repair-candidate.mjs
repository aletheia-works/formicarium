import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const previous = resolve('.artifacts/u2-guest-distribution/site-v2');
const manifest = JSON.parse(await readFile(join(previous, 'dist/builds.json'), 'utf8'));
const builds = [];
for (const [tool, refs] of Object.entries(manifest.builds)) {
  for (const [ref, build] of Object.entries(refs)) {
    for (const asset of [build.guest, build.buildInfo, ...Object.values(build.fixtures)]) {
      const bytes = await readFile(join(previous, asset.url));
      if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) {
        throw new Error(`Prior asset digest differs: ${tool}/${ref}/${asset.url}`);
      }
    }
    builds.push({ tool, ref, guestPath: join(previous, build.guest.url),
      buildInfoPath: join(previous, build.buildInfo.url),
      fixturePaths: Object.fromEntries(Object.entries(build.fixtures).map(([name, asset]) => [name, join(previous, asset.url)])) });
  }
}
// The old tools.json is absent. These explicit local validation defaults are
// not a recovered upstream catalogue or evidence of external deployment.
const input = {
  tools: {
    aube: { default: 'v2.7.0', fixture: 'aube-local-deps', cwd: '/work/app' },
    pitchfork: { default: 'v2.30.0', fixture: 'pitchfork-basic', cwd: '/work/app' }
  },
  manifest: { builds: {} }, builds
};
const output = 'aidlc/spaces/default/intents/261006-npm-terrarium-release/verification/u2-repair-stage-input.json';
await writeFile(output, JSON.stringify(input, null, 2) + '\n');
console.log(JSON.stringify({ input: output, priorAssetDigestsVerified: builds.length, tools: 'explicit local validation defaults; prior catalogue missing' }));
