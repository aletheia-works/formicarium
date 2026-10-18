import { expect, test } from '@playwright/test';
import { consumerInput } from '../migration-session/consumer-input.js';
import { serveDirectory } from '../package/fixtures.js';

const input = await consumerInput();
expect(['u3-install', 'u4-command']).toContain(input.candidate.unit);
let server: Awaited<ReturnType<typeof serveDirectory>>;
test.beforeAll(async () => {
  server = await serveDirectory(input.packageRoot);
});
test.afterAll(async () => {
  await server.close();
});

for (const length of [0, 3, 55, 56, 63, 64, 65, 127, 128, 129, 65537]) {
  test(`installed SHA256 binary ${length} bytes matches independent WebCrypto`, async ({
    page,
  }) => {
    await page.goto(server.url);
    const result = await page.evaluate(async (size) => {
      const { guestSha256 } = await import('/runtime/guest-validation.js');
      const bytes = Uint8Array.from(
        { length: size },
        (_, index) => (index * 197 + (index >>> 8) + 11) & 255,
      );
      const before = bytes.slice();
      const expected = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        (byte) => byte.toString(16).padStart(2, '0'),
      ).join('');
      return {
        actual: guestSha256(bytes),
        expected,
        unchanged: bytes.every((byte, index) => byte === before[index]),
      };
    }, length);
    expect(result.actual).toBe(result.expected);
    expect(result.unchanged).toBe(true);
  });
}
test('installed SHA256 published vectors and offset view preserve exact input range', async ({
  page,
}) => {
  await page.goto(server.url);
  const result = await page.evaluate(async () => {
    const { guestSha256 } = await import('/runtime/guest-validation.js');
    const backing = Uint8Array.from(
      { length: 151 },
      (_, index) => index ^ 0xa5,
    );
    const before = backing.slice();
    const bytes = backing.subarray(7, 136);
    const expected = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      (byte) => byte.toString(16).padStart(2, '0'),
    ).join('');
    return {
      empty: guestSha256(new Uint8Array()),
      abc: guestSha256(new TextEncoder().encode('abc')),
      actual: guestSha256(bytes),
      expected,
      unchanged: backing.every((byte, index) => byte === before[index]),
    };
  });
  expect(result.empty).toBe(
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  );
  expect(result.abc).toBe(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  expect(result.actual).toBe(result.expected);
  expect(result.unchanged).toBe(true);
});
