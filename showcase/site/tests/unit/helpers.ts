import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { after } from 'node:test';
import { SITE_ROOT } from '../../scripts/common.ts';

const created: string[] = [];
after(async () => {
  for (const directory of created)
    await rm(directory, { recursive: true, force: true });
});

/** A fresh directory below showcase/site/.work/tmp, removed after the file's tests. */
export async function tempDir(prefix = 'unit'): Promise<string> {
  const directory = join(
    SITE_ROOT,
    '.work',
    'tmp',
    `${prefix}-${randomUUID()}`,
  );
  await mkdir(directory, { recursive: true });
  created.push(directory);
  return directory;
}

export async function writeFiles(
  root: string,
  files: Record<string, string | Uint8Array>,
): Promise<void> {
  for (const [path, body] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), body);
  }
}

/** A Response whose body arrives in the given chunks. */
export function chunked(
  chunks: Uint8Array[],
  init: ResponseInit = { status: 200 },
): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Response(stream, init);
}

/** Manual timers: `fire()` runs every pending callback (a fake clock). */
export function fakeTimers() {
  const pending = new Map<number, () => void>();
  let next = 0;
  return {
    timers: {
      setTimeout(callback: () => void, _ms: number) {
        next += 1;
        pending.set(next, callback);
        return next;
      },
      clearTimeout(handle: unknown) {
        pending.delete(handle as number);
      },
    },
    get pending() {
      return pending.size;
    },
    fire() {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback();
    },
  };
}

/** The Pages upload step shape check-site requires (dotfiles, 7 days). */
export const WORKFLOW = `      - uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0
        with:
          path: showcase/site/dist
          retention-days: 7
          include-hidden-files: true
`;

export const SHA = 'a'.repeat(64);
export const COMMIT = 'b'.repeat(40);
