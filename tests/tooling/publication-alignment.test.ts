import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { parse, stringify } from 'yaml';

const { bundle, stableBundle } = (await import(
  pathToFileURL(
    resolve(process.cwd(), 'tests/release/publication-alignment-fixture.js'),
  ).href
)) as typeof import('../release/publication-alignment-fixture.js');
const { publicationCli } = (await import(
  pathToFileURL(resolve(process.cwd(), 'scripts/release/publication-cli.js'))
    .href
)) as typeof import('../../scripts/release/publication-cli.js');
const { validatePublishWorkflow } = (await import(
  pathToFileURL(resolve(process.cwd(), 'scripts/release/workflow.js')).href
)) as typeof import('../../scripts/release/workflow.js');
const { artifactBytes } = (await import(
  pathToFileURL(resolve(process.cwd(), 'scripts/release/evidence.js')).href
)) as typeof import('../../scripts/release/evidence.js');
type WorkflowMutation = {
  jobs: Record<string, { needs: string; permissions: { contents: string } }>;
  concurrency: { 'cancel-in-progress': boolean };
};
const text = await readFile('.github/workflows/publish.yml', 'utf8');
test('actual workflow uses Bun verification and native Actions artifact writers', () => {
  const workflow = validatePublishWorkflow(text);
  assert.ok(
    workflow.jobs.verify.steps.some(
      (s: { run?: string }) =>
        s.run === 'bun install --frozen-lockfile --ignore-scripts',
    ),
  );
  assert.match(
    workflow.jobs.publish.steps.at(-1).run,
    /bunx npm@latest publish/,
  );
  assert.match(workflow.jobs.release.steps.at(-1).run, /gh release create/);
  assert.doesNotMatch(text, /bootstrap|runner-manifest|runner\.mjs/);
});
test('writer install build token fallback and alternate payload refuse', () => {
  for (const step of [
    { run: 'bun install' },
    { run: 'bun run build' },
    { run: 'npm publish other.tgz' },
    { env: { NPM_TOKEN: 'fake' } },
  ]) {
    const workflow = parse(text);
    workflow.jobs.publish.steps.push(step);
    assert.throws(
      () => validatePublishWorkflow(stringify(workflow)),
      /unvalidated|token|gate/,
    );
  }
});
test('failed prerequisite cannot bypass dependencies permissions or tag serialization', () => {
  for (const mutate of [
    (w: WorkflowMutation) => (w.jobs.publish.needs = 'release'),
    (w: WorkflowMutation) => (w.jobs.release.needs = 'verify'),
    (w: WorkflowMutation) => (w.jobs.verify.permissions.contents = 'write'),
    (w: WorkflowMutation) => (w.concurrency['cancel-in-progress'] = true),
  ]) {
    const workflow = parse(text);
    mutate(workflow);
    assert.throws(
      () => validatePublishWorkflow(stringify(workflow)),
      /dependency|permissions|concurrency/,
    );
  }
});
test('normal RC and stable independently observed candidate export the correct dist tag', async (t) => {
  for (const channel of ['rc', 'stable']) {
    const f = channel === 'rc' ? await bundle(t) : await stableBundle(t);
    const output = (await publicationCli(
      ['prepare-artifact', f.root, join(f.root, 'out')],
      f.boundary,
    )) as { 'dist-tag': string };
    assert.equal(output['dist-tag'], channel === 'rc' ? 'next' : 'latest');
  }
});
test('missing candidate API ref forged producer and mutated report start zero executors', async (t) => {
  for (const name of [
    'report.json',
    'inventory.json',
    'publisher.json',
    'index.json',
  ]) {
    for (const extra of [0, 1])
      await t.test(
        `${name} secondary metadata ${extra ? 'plus one before parse' : 'exact valid'}`,
        async () => {
          const f = await bundle(t),
            entry = f.request.index.entries[0]!;
          const original =
            name === 'index.json'
              ? Buffer.from(JSON.stringify(f.request.index))
              : await readFile(join(f.root, name));
          const bytes = Buffer.concat([
            original,
            Buffer.alloc(8 * 1024 * 1024 + extra - original.length, 0x20),
          ]);
          if (name === 'report.json' || name === 'inventory.json') {
            f.e.checks[0]!.artifactDigests = {
              ...f.e.checks[0]!.artifactDigests,
              [name]: createHash('sha256').update(bytes).digest('hex'),
            };
            const envelope = Buffer.from(JSON.stringify(f.e));
            await writeFile(join(f.root, entry.artifact), envelope);
            entry.sha256 = createHash('sha256').update(envelope).digest('hex');
          }
          if (name === 'publisher.json')
            f.request.publisher.observationSha256 = createHash('sha256')
              .update(bytes)
              .digest('hex');
          await f.save();
          await writeFile(join(f.root, name), bytes);
          if (name === 'index.json') {
            if (extra)
              await assert.rejects(
                artifactBytes(f.root, name),
                /JSON_METADATA_LIMIT/,
              );
            else
              assert.equal(
                (await artifactBytes(f.root, name)).length,
                8 * 1024 * 1024,
              );
            await assert.rejects(
              readFile(join(f.root, 'out/candidate.tgz')),
              /ENOENT/,
            );
          } else if (extra) {
            await assert.rejects(
              publicationCli(
                ['prepare-artifact', f.root, join(f.root, 'out')],
                f.boundary,
              ),
              /JSON_METADATA_LIMIT/,
            );
            await assert.rejects(
              readFile(join(f.root, 'out/candidate.tgz')),
              /ENOENT/,
            );
          } else {
            await publicationCli(
              ['prepare-artifact', f.root, join(f.root, 'out')],
              f.boundary,
            );
            assert.ok(await readFile(join(f.root, 'out/candidate.tgz')));
          }
        },
      );
  }
  for (const kind of ['request', 'publication', 'evidence']) {
    for (const extra of [0, 1])
      await t.test(
        `${kind} direct metadata ${extra ? 'plus one executor zero' : 'exact full gate succeeds'}`,
        async () => {
          const f = await bundle(t);
          const entry = f.request.index.entries[0]!;
          const path = kind === 'evidence' ? entry.artifact : `${kind}.json`;
          const original = await readFile(join(f.root, path));
          const bytes = Buffer.concat([
            original,
            Buffer.alloc(8 * 1024 * 1024 + extra - original.length, 0x20),
          ]);
          if (kind === 'evidence') {
            entry.sha256 = createHash('sha256').update(bytes).digest('hex');
            await f.save();
          }
          await writeFile(join(f.root, path), bytes);
          if (extra) {
            await assert.rejects(
              publicationCli(
                ['prepare-artifact', f.root, join(f.root, 'out')],
                f.boundary,
              ),
              /JSON|METADATA|metadata|limit/i,
            );
            await assert.rejects(
              readFile(join(f.root, 'out/candidate.tgz')),
              /ENOENT/,
            );
          } else {
            await publicationCli(
              ['prepare-artifact', f.root, join(f.root, 'out')],
              f.boundary,
            );
            assert.ok(await readFile(join(f.root, 'out/candidate.tgz')));
          }
        },
      );
  }
  for (const mode of ['missing', 'producer', 'report']) {
    const f = await bundle(t);
    if (mode === 'missing') {
      delete f.request.candidateRun;
      await f.save();
    }
    const fetcher = f.boundary.fetcher;
    f.boundary.fetcher = async (input, init) => {
      const response = await fetcher(input, init);
      if (mode === 'producer' && String(input).includes('/check-runs/')) {
        const body = await response.json();
        body.app.id = 99;
        return new Response(JSON.stringify(body));
      }
      if (mode === 'report' && String(input).endsWith('/zip'))
        return new Response(Buffer.from('mutated archive'));
      return response;
    };
    await assert.rejects(
      publicationCli(
        ['prepare-artifact', f.root, join(f.root, 'out')],
        f.boundary,
      ),
      /API reference|producer|digest/,
    );
    await assert.rejects(readFile(join(f.root, 'out/candidate.tgz')), /ENOENT/);
  }
});
