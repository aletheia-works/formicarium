import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

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
test('actual workflow uses Bun development and trusted tag bootstrap writers', () => {
  const workflow = validatePublishWorkflow(text);
  assert.ok(
    workflow.jobs.verify.steps.some(
      (s: { run?: string }) =>
        s.run === 'bun install --frozen-lockfile --ignore-scripts',
    ),
  );
  for (const name of ['publish', 'release'])
    assert.equal(
      workflow.jobs[name].steps.at(-1).run,
      `node .github/publication/bootstrap.mjs ${name}`,
    );
});
test('writer install build token fallback and alternate payload refuse', () => {
  for (const step of [
    { run: 'bun install' },
    { run: 'bun run build' },
    { run: 'npm publish other.tgz' },
    { env: { NPM_TOKEN: 'fake' } },
  ]) {
    const workflow = JSON.parse(text);
    workflow.jobs.publish.steps.push(step);
    assert.throws(
      () => validatePublishWorkflow(JSON.stringify(workflow)),
      /unvalidated|token/,
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
    const workflow = JSON.parse(text);
    mutate(workflow);
    assert.throws(
      () => validatePublishWorkflow(JSON.stringify(workflow)),
      /dependency|permissions|concurrency/,
    );
  }
});
test('normal RC and stable independently observed full candidate invoke Node fixed npm exactly once', async (t) => {
  for (const channel of ['rc', 'stable']) {
    const f = channel === 'rc' ? await bundle(t) : await stableBundle(t);
    await publicationCli(['publish', f.root], f.executor, f.boundary);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].executable, process.execPath);
    assert.deepEqual(f.calls[0].args, [
      f.npmCli,
      'publish',
      f.tarball,
      '--access',
      'public',
      '--registry',
      'https://registry.npmjs.org/',
      '--tag',
      channel === 'rc' ? 'next' : 'latest',
      '--ignore-scripts',
    ]);
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
            assert.equal(f.calls.length, 0);
          } else if (extra) {
            await assert.rejects(
              publicationCli(['publish', f.root], f.executor, f.boundary),
              /JSON_METADATA_LIMIT/,
            );
            assert.equal(f.calls.length, 0);
          } else {
            await publicationCli(['publish', f.root], f.executor, f.boundary);
            assert.equal(f.calls.length, 1);
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
              publicationCli(['publish', f.root], f.executor, f.boundary),
              /JSON|METADATA|metadata|limit/i,
            );
            assert.equal(f.calls.length, 0);
          } else {
            await publicationCli(['publish', f.root], f.executor, f.boundary);
            assert.equal(f.calls.length, 1);
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
      publicationCli(['publish', f.root], f.executor, f.boundary),
      /API reference|producer|digest/,
    );
    assert.equal(f.calls.length, 0);
  }
});
test('unknown writer result propagates once without automatic resend', async (t) => {
  const f = await bundle(t);
  let writes = 0;
  await assert.rejects(
    publicationCli(
      ['publish', f.root],
      () => {
        writes++;
        throw Error('unknown external result');
      },
      f.boundary,
    ),
    /unknown external result/,
  );
  assert.equal(writes, 1);
});
