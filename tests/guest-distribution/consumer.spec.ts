import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import type { GuestSelection } from '../../integration/guest-distribution/index.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});
async function select(
  page: Page,
  input: Omit<GuestSelection, 'base'> & { actual?: boolean },
) {
  return page.evaluate(async (input) => {
    const { resolveGuest } = await import('/modules/resolver.js');
    const selected = await resolveGuest({
      ...input,
      base: new URL(input.actual ? 'actual/' : 'synthetic/', location.href)
        .href,
    });
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest('SHA-256', new Uint8Array(selected.guest)),
      ),
      (b) => b.toString(16).padStart(2, '0'),
    ).join('');
    return {
      ref: selected.build.ref,
      commit: selected.build.source.commit,
      hash,
      expectedHash: selected.build.guest.sha256,
      cwd: selected.cwd,
      files: selected.entries
        .filter((e) => e.type === 'file')
        .map((e) => ({ path: e.path, text: new TextDecoder().decode(e.data) })),
      byteLength: selected.guest.length,
    };
  }, input);
}

test('synthetic two-ref contract returns distinct bytes/provenance with valid fixture/cwd', async ({
  page,
}) => {
  const first = await select(page, { tool: 'aube', ref: 'main' }),
    second = await select(page, { tool: 'aube', ref: 'pr-1645' });
  expect(first.hash).toBe(first.expectedHash);
  expect(second.hash).toBe(second.expectedHash);
  expect(first.hash).not.toBe(second.hash);
  expect(first.commit).not.toBe(second.commit);
  expect(first.files).toEqual([{ path: '/work/app/name', text: 'main' }]);
  expect(first.cwd).toBe('/work/app');
});

test('synthetic default ref with explicitly empty seed keeps /work cwd', async ({
  page,
}) => {
  const selected = await select(page, { tool: 'aube', fixture: '' });
  expect(selected.ref).toBe('main');
  expect(selected.files).toEqual([]);
  expect(selected.cwd).toBe('/work');
});

test('unknown selections, 404, digest tamper and redirect never execute guest', async ({
  page,
}) => {
  const reject = async (input: {
    tool: string;
    ref?: string;
    fixture?: string;
    redirect?: boolean;
  }) =>
    page.evaluate(async (input) => {
      const { resolveGuest } = await import('/modules/resolver.js');
      let executions = 0;
      try {
        await resolveGuest({
          ...input,
          tool: input.tool as GuestSelection['tool'],
          base: new URL(
            input.redirect ? 'redirect/' : 'synthetic/',
            location.href,
          ).href,
        });
        executions++;
        return { executions, error: null };
      } catch (caught) {
        const error = caught as Error;
        return {
          executions,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }, input);
  for (const input of [
    { tool: 'other' },
    { tool: 'aube', ref: 'missing' },
    { tool: 'aube', fixture: 'missing' },
  ]) {
    const result = await reject(input);
    expect(result.executions).toBe(0);
    expect(result.error).toMatch(/unknown/);
  }
  await page.route('**/guest', (route) => route.fulfill({ status: 404 }));
  expect((await reject({ tool: 'aube' })).error).toMatch(/HTTP 404/);
  await page.unroute('**/guest');
  await page.route('**/guest', (route) =>
    route.fulfill({ status: 200, body: 'tampered' }),
  );
  const tampered = await reject({ tool: 'aube' });
  expect(tampered.executions).toBe(0);
  expect(tampered.error).toMatch(/SHA-256/);
  await page.unroute('**/guest');
  const before = await (await page.request.get('stats')).json();
  const redirected = await reject({ tool: 'aube', redirect: true });
  expect(redirected.executions).toBe(0);
  expect(redirected.error).toMatch(/redirect/);
  const after = await (await page.request.get('stats')).json();
  expect(before.redirectTargetRequests).toBe(0);
  expect(after.redirectTargetRequests).toBe(before.redirectTargetRequests);
});

test('actual official aube two-release supply is distinct from synthetic fixtures', async ({
  page,
}) => {
  test.skip(
    !process.env.U2_ACTUAL_SITE,
    'Actual release assets absent; supply remains unverified',
  );
  const first = await select(page, {
    tool: 'aube',
    ref: 'v2.6.1',
    actual: true,
  });
  const second = await select(page, {
    tool: 'aube',
    ref: 'v2.7.0',
    actual: true,
  });
  expect(first.hash).toBe(first.expectedHash);
  expect(second.hash).toBe(second.expectedHash);
  expect(first.commit).toBe('bd94e42f54d3b5e3dd102716b7197f316cb5f4ed');
  const manifest = await (
    await page.request.get('actual/dist/builds.json')
  ).json();
  expect(second.commit).toBe(manifest.builds.aube['v2.7.0'].source.commit);
  expect(second.commit).toBe('d36fec01764689ef6d99a5e43de98925b571d67f');
  expect(first.hash).not.toBe(second.hash);
  expect(first.byteLength).toBeGreaterThan(1_000_000);
  expect(second.byteLength).toBeGreaterThan(1_000_000);
  expect(first.cwd).toBe('/work/app');
});

test('actual latest pitchfork patched musl supply keeps selected provenance and fixture', async ({
  page,
}) => {
  test.skip(
    !process.env.U2_ACTUAL_SITE,
    'Actual release assets absent; supply remains unverified',
  );
  const selected = await select(page, {
    tool: 'pitchfork',
    ref: 'v2.30.0',
    actual: true,
  });
  const manifest = await (
    await page.request.get('actual/dist/builds.json')
  ).json();
  expect(selected.commit).toBe(
    manifest.builds.pitchfork['v2.30.0'].source.commit,
  );
  expect(selected.commit).toBe('60e97b1c39183d56e2124f84f9a68ad550fc4011');
  expect(selected.hash).toBe(selected.expectedHash);
  expect(selected.byteLength).toBeGreaterThan(1_000_000);
  expect(selected.cwd).toBe('/work/app');
  expect(selected.files.length).toBeGreaterThan(0);
});
