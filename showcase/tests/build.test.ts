import assert from 'node:assert/strict';
import { access, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { validateGuest } from '@aletheia-works/formicarium';
import type { AcquiredTool } from '../scripts/acquire.ts';
import {
  type BuildPlan,
  buildEnvironment,
  compilePlan,
  fetchSource,
  installRust,
  prepareBuild,
  runInGroup,
  selectNode,
  selectToolchain,
  sourceBuildInfo,
  verifyTagCommit,
  withStaging,
} from '../scripts/build.ts';
import {
  readConfigFile,
  type ToolConfig,
  validateToolsConfig,
} from '../scripts/config.ts';
import { causeOf } from '../scripts/errors.ts';
import { createGitHubApi } from '../scripts/github.ts';
import type { ToolResolution } from '../scripts/resolve.ts';
import { staticElf } from './fixtures/elf.ts';
import { bytes, commit, fakeFetch, json, sha } from './fixtures/github.ts';
import { pax, tgz } from './fixtures/tar.ts';
import { MAIN_ALLOWED, withLayout } from './fixtures/work.ts';

const rejects = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error) => causeOf(error) === code);
const throwsCause = (run: () => unknown, code: string) =>
  assert.throws(run, (error) => causeOf(error) === code);
const tools = validateToolsConfig(
  await readConfigFile('tools.json'),
  JSON.parse(MAIN_ALLOWED),
);
const pitchfork = tools.tools.find(
  (item) => item.tool === 'pitchfork',
) as ToolConfig;
const sourceCommit = commit('pitchfork');
const resolution: ToolResolution = {
  tool: 'pitchfork',
  repository: 'https://github.com/jdx/pitchfork',
  tag: 'v2.30.0',
  version: '2.30.0',
  commit: sourceCommit,
  asset: null,
  attestation: null,
  license: {
    path: 'LICENSE',
    file: 'pitchfork-LICENSE',
    sha256: 'a'.repeat(64),
    spdx: 'MIT',
  },
};
const refUrl =
  'https://api.github.com/repos/jdx/pitchfork/git/ref/tags/v2.30.0';
const codeload = `https://codeload.github.com/jdx/pitchfork/tar.gz/${sourceCommit}`;
const sourceTgz = (comment = sourceCommit) =>
  tgz([
    { name: 'pax_global_header', type: 'g', body: pax({ comment }) },
    { name: 'pitchfork-x', type: '5' },
    { name: 'pitchfork-x/Cargo.lock', body: 'lock' },
    { name: 'pitchfork-x/ui', type: '5' },
    { name: 'pitchfork-x/ui/package.json', body: '{}' },
  ]);

async function tree(files: Record<string, string>, root: string) {
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}

test('toolchains follow upstream declarations, else the latest stable', async () => {
  await withLayout(async (layout) => {
    const ui =
      pitchfork.acquire.kind === 'source-build' ? pitchfork.acquire.ui! : null;
    const declared = await tree(
      {
        'rust-toolchain.toml': '[toolchain]\nchannel = "1.88.0"\n',
        'ui/.node-version': 'v24.1.0\n',
      },
      join(layout.root, 'a'),
    );
    assert.deepEqual(await selectToolchain(declared, ui), {
      rustChannel: '1.88.0',
      rustDeclaredBy: 'rust-toolchain.toml',
      nodeVersion: '24.1.0',
      nodeDeclaredBy: 'ui/.node-version',
    });
    const plain = await tree(
      {
        'rust-toolchain': 'nightly-2026-01-01\n',
        'mise.toml': '[tools]\nnode = "22.3.0"\n',
      },
      join(layout.root, 'b'),
    );
    const selected = await selectToolchain(plain, ui);
    assert.equal(selected.rustChannel, 'nightly-2026-01-01');
    assert.equal(selected.nodeDeclaredBy, 'mise.toml');
    const none = await tree(
      { 'ui/package.json': '{"engines":{"node":">=20"}}' },
      join(layout.root, 'c'),
    );
    assert.deepEqual(await selectToolchain(none, ui), {
      rustChannel: 'stable',
      rustDeclaredBy: null,
      nodeVersion: null,
      nodeDeclaredBy: null,
    });
    assert.deepEqual(selectNode(null), {
      nodeBin: join(process.execPath, '..'),
      nodeVersion: process.versions.node,
    });
  });
});

test('a commit the tag no longer names, or a source archive of another commit, is refused', async () => {
  const moved = createGitHubApi({
    fetchImpl: fakeFetch({
      [refUrl]: json({
        ref: 'refs/tags/v2.30.0',
        object: { type: 'commit', sha: commit('other') },
      }),
    }),
  });
  await rejects(verifyTagCommit(moved, resolution), 'commit-unreachable');
  await withLayout(async (layout) => {
    await rejects(
      fetchSource(
        resolution,
        join(layout.root, 's'),
        fakeFetch({ [codeload]: bytes(sourceTgz(commit('other'))) }),
      ),
      'commit-unreachable',
    );
  });
});

test('Rust is installed through rustup by absolute path; failures are classified', () => {
  const calls: string[][] = [];
  const exec = (file: string, args: readonly string[]) => {
    calls.push([file, ...args]);
    if (args[0] === 'which') return `/opt/rust/${args[3]}`;
    return 'rustc 1.99.0 (fake)';
  };
  assert.deepEqual(installRust('stable', exec, '/opt/rustup'), {
    cargo: '/opt/rust/cargo',
    rustc: '/opt/rust/rustc',
    rustcVersion: 'rustc 1.99.0 (fake)',
  });
  assert.deepEqual(calls[0]!.slice(0, 4), [
    '/opt/rustup',
    'toolchain',
    'install',
    'stable',
  ]);
  throwsCause(
    () => installRust('stable', () => 'relative/cargo', '/opt/rustup'),
    'toolchain-unavailable',
  );
  throwsCause(
    () =>
      installRust(
        'stable',
        () => {
          throw Error('no rustup');
        },
        '/opt/rustup',
      ),
    'toolchain-unavailable',
  );
  throwsCause(
    () => selectNode('1.2.3', () => 'relative'),
    'toolchain-unavailable',
  );
});

test('the build environment is an allow list that refuses tokens', () => {
  const env = buildEnvironment(
    { RUSTC: '/opt/rustc' },
    { HOME: '/home/x', GITHUB_TOKEN: 'secret', PATH: '/x' },
  );
  assert.equal(env.HOME, '/home/x');
  assert.equal(env.GITHUB_TOKEN, undefined);
  assert.equal(env.MISE_AUTO_INSTALL, '0');
  throwsCause(() => buildEnvironment({ NPM_TOKEN: 'x' }, {}), 'config-invalid');
});

const groupGone = (pid: number) => {
  try {
    process.kill(-pid, 0);
    return false;
  } catch {
    return true;
  }
};

test('a deadline ends the whole process group and staging is removed afterwards', async () => {
  await withLayout(async (layout) => {
    const pidFile = join(layout.root, 'pid');
    await mkdir(layout.root, { recursive: true });
    let staged = '';
    await rejects(
      withStaging(layout, 'probe', async (directory) => {
        staged = directory;
        await writeFile(join(directory, 'partial'), 'x');
        await runInGroup({
          command: '/bin/sh',
          args: ['-c', `echo $$ > '${pidFile}'; sleep 30 & sleep 30`],
          cwd: directory,
          env: buildEnvironment({}),
          deadlineMs: 300,
          graceMs: 100,
        });
      }),
      'build-timeout',
    );
    const pid = Number(await readFile(pidFile, 'utf8'));
    assert.ok(groupGone(pid));
    await assert.rejects(access(staged));
  });
});

test('cancellation also ends the group; a nonzero exit is a build failure', async () => {
  await withLayout(async (layout) => {
    await mkdir(layout.root, { recursive: true });
    const pidFile = join(layout.root, 'pid');
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 150);
    await rejects(
      runInGroup({
        command: '/bin/sh',
        args: ['-c', `echo $$ > '${pidFile}'; sleep 30`],
        cwd: layout.root,
        env: buildEnvironment({}),
        deadlineMs: 60000,
        graceMs: 100,
        signal: controller.signal,
      }),
      'build-failed',
    );
    assert.ok(groupGone(Number(await readFile(pidFile, 'utf8'))));
    await rejects(
      runInGroup({
        command: '/bin/sh',
        args: ['-c', 'exit 3'],
        cwd: layout.root,
        env: buildEnvironment({}),
        deadlineMs: 5000,
      }),
      'build-failed',
    );
  });
});

const aubeRecord = {
  tool: 'aube',
  format: 'tar.gz',
  downloadFile: 'aube.tar.gz',
  elfSha256: 'd'.repeat(64),
  buildInfo: {
    source: {
      repository: 'https://github.com/aubepkg/aube',
      commit: commit('aube'),
    },
  },
} as unknown as AcquiredTool;

test('prepare fixes source, toolchain, dependencies and buildKey before any compile', async () => {
  await withLayout(async (layout) => {
    const api = createGitHubApi({
      fetchImpl: fakeFetch({
        [refUrl]: json({
          ref: 'refs/tags/v2.30.0',
          object: { type: 'commit', sha: sourceCommit },
        }),
      }),
    });
    const exec = (_file: string, args: readonly string[]) =>
      args[0] === 'which' ? `/opt/rust/${args[3]}` : 'rustc 1.99.0 (fake)';
    const plan = await prepareBuild({
      config: pitchfork,
      resolution,
      layout,
      api,
      acquired: [aubeRecord],
      fetchImpl: fakeFetch({ [codeload]: bytes(sourceTgz()) }),
      exec,
    });
    assert.equal(plan.toolchain?.rustChannel, 'stable');
    assert.deepEqual(
      plan.dependencies.map((item) => item.tool),
      ['cargo-lock', 'aube'],
    );
    assert.equal(plan.dependencies[0]!.digest, sha('lock'));
    assert.equal(plan.runner?.elfPath, join(layout.acquired, 'aube', 'guest'));
    assert.match(plan.buildKey, /^[a-f0-9]{64}$/);
    const again = await prepareBuild({
      config: pitchfork,
      resolution,
      layout: { ...layout, sources: join(layout.root, 'sources-2') },
      api,
      acquired: [aubeRecord],
      fetchImpl: fakeFetch({ [codeload]: bytes(sourceTgz()) }),
      exec,
    });
    assert.equal(again.buildKey, plan.buildKey);
  });
});

test('compile runs the builder without a token and validates through the public API', async () => {
  await withLayout(async (layout) => {
    const elf = staticElf(160, 9);
    const source = join(layout.root, 'source');
    await mkdir(source, { recursive: true });
    await writeFile(join(layout.root, 'guest.elf'), elf);
    const cargo = join(layout.root, 'cargo');
    await writeFile(
      cargo,
      `#!/bin/sh\nset -e\ntest -z "$GITHUB_TOKEN"\nmkdir -p "$CARGO_TARGET_DIR/x86_64-unknown-linux-musl/release"\ncp '${join(layout.root, 'guest.elf')}' "$CARGO_TARGET_DIR/x86_64-unknown-linux-musl/release/pitchfork"\n`,
    );
    await chmod(cargo, 0o755);
    const plan: BuildPlan = {
      builder: 'cargo',
      tool: 'pitchfork',
      version: '2.30.0',
      tag: 'v2.30.0',
      repository: resolution.repository,
      commit: sourceCommit,
      sourceDir: source,
      binary: 'pitchfork',
      package: null,
      ui: null,
      toolchain: {
        rustChannel: 'stable',
        rustDeclaredBy: null,
        nodeVersion: null,
        nodeDeclaredBy: null,
      },
      cargo,
      rustc: '/opt/rust/rustc',
      rustcVersion: 'rustc 1.99.0 (fake)',
      nodeBin: null,
      nodeVersion: null,
      runner: null,
      gnu: null,
      dependencies: [
        {
          tool: 'cargo-lock',
          repository: resolution.repository,
          commit: sourceCommit,
          digest: sha('lock'),
        },
      ],
      builderHash: 'b'.repeat(64),
      buildKey: '',
    };
    plan.buildKey = sourceBuildInfo(plan, '0'.repeat(64)).buildKey;
    const record = await compilePlan(plan, { layout, validate: validateGuest });
    assert.equal(record.elfSha256, sha(elf));
    assert.equal(record.provenance.kind, 'source-build');
    assert.equal(record.provenance.reusedFromRun, null);
    assert.deepEqual(
      new Uint8Array(
        await readFile(join(layout.acquired, 'pitchfork', 'pitchfork')),
      ),
      elf,
    );
    await rejects(
      compilePlan(
        { ...plan, cargo: join(layout.root, 'missing-cargo') },
        { layout, validate: validateGuest },
      ),
      'build-failed',
    );
  });
});

/** GNU tarballs whose configure writes a Makefile; the program copies an ELF. */
function gnuBuildTarball(name: string, elfPath: string | null) {
  const make = elfPath
    ? `all:\n\tmkdir -p src && cp '${elfPath}' src/${name}\n`
    : 'all:\n\ttrue\ninstall:\n\ttrue\n';
  return tgz([
    { name: `${name}-1.0`, type: '5' },
    { name: `${name}-1.0/COPYING`, body: 'license\n' },
    {
      name: `${name}-1.0/configure`,
      mode: 0o755,
      body:
        '#!/bin/sh\nset -e\ntest -z "$GITHUB_TOKEN"\ntest "$CC" = musl-gcc\n' +
        'for a in "$@"; do echo "$a" >> configure.args; done\n' +
        `printf '%s' '${make.replaceAll("'", "'\\''")}' > Makefile\n`,
    },
  ]);
}

async function gnuResolution(layout: { tarballs: string; root: string }) {
  const elf = staticElf(170, 7);
  await mkdir(layout.root, { recursive: true });
  await writeFile(join(layout.root, 'nano.elf'), elf);
  await mkdir(layout.tarballs, { recursive: true });
  const tarball = async (name: string, elfPath: string | null) => {
    const body = gnuBuildTarball(name, elfPath);
    const file = `${name}-1.0.tar.gz`;
    await writeFile(join(layout.tarballs, file), body);
    return {
      name: file,
      url: `https://ftp.gnu.org/gnu/${name}/${file}`,
      sha256: sha(body),
      size: body.length,
      signatureUrl: `https://ftp.gnu.org/gnu/${name}/${file}.sig`,
      signatureSha256: sha('sig'),
      signer: 'A'.repeat(40),
    };
  };
  const license = (name: string) => ({
    path: 'COPYING',
    file: `${name}-COPYING`,
    sha256: sha('license\n'),
    spdx: 'X11',
  });
  const nanoResolution: ToolResolution = {
    tool: 'nano',
    repository: 'https://git.savannah.gnu.org/git/nano.git',
    tag: 'v9.3',
    version: '9.3',
    commit: commit('nano'),
    asset: null,
    attestation: null,
    license: license('nano'),
    gnu: {
      tarball: await tarball('nano', join(layout.root, 'nano.elf')),
      libraries: [
        {
          package: 'ncurses',
          repository: 'https://github.com/ThomasDickey/ncurses-snapshots',
          tag: 'v6_6',
          version: '6.6',
          commit: commit('ncurses'),
          tarball: await tarball('ncurses', null),
          license: license('ncurses'),
        },
      ],
    },
  };
  return { elf, resolution: nanoResolution };
}

const nanoConfig = tools.tools.find((item) => item.tool === 'nano')!;
const ncursesApi = () =>
  createGitHubApi({
    fetchImpl: fakeFetch({
      'https://api.github.com/repos/ThomasDickey/ncurses-snapshots/git/ref/tags/v6_6':
        json({
          ref: 'refs/tags/v6_6',
          object: { type: 'commit', sha: commit('ncurses') },
        }),
    }),
  });
const gnuExecFor =
  (libc: string) => (file: string, args: readonly string[]) => {
    if (file === 'git') return `${commit('nano')}\trefs/tags/v9.3^{}`;
    if (file === 'musl-gcc' && args[0] === '--version')
      return 'gcc (Ubuntu 13.3.0) 13.3.0\nCopyright';
    if (file === 'musl-gcc') return libc;
    throw Error(`unexpected ${file}`);
  };

test('a gnu-source plan unpacks the checked tarballs, libraries first', async () => {
  await withLayout(async (layout) => {
    const { resolution: nanoResolution } = await gnuResolution(layout);
    const libc = join(layout.root, 'libc.a');
    await writeFile(libc, 'musl libc');
    const plan = await prepareBuild({
      config: nanoConfig,
      resolution: nanoResolution,
      layout,
      api: ncursesApi(),
      acquired: [],
      exec: gnuExecFor(libc),
    });
    assert.equal(plan.builder, 'autotools');
    assert.equal(plan.rustcVersion, null);
    assert.deepEqual(
      plan.gnu?.steps.map((step) => step.package),
      ['ncurses', 'nano'],
    );
    assert.deepEqual(plan.gnu?.cc, {
      compiler: 'gcc (Ubuntu 13.3.0) 13.3.0',
      muslLibcSha256: sha('musl libc'),
    });
    assert.deepEqual(
      plan.dependencies.map((item) => [item.tool, item.commit, item.digest]),
      [
        [
          'ncurses',
          commit('ncurses'),
          nanoResolution.gnu!.libraries[0]!.tarball.sha256,
        ],
        ['source-tarball', commit('nano'), nanoResolution.gnu!.tarball.sha256],
      ],
    );
    await access(join(plan.gnu!.steps[1]!.sourceDir, 'configure'));
    const info = sourceBuildInfo(plan, '0'.repeat(64));
    assert.equal(info.rustc, null);
    assert.equal((info.provenance as { builder: string }).builder, 'autotools');
    // A moved tag, a changed tarball and a missing toolchain stop prepare.
    for (const [changes, code] of [
      [
        { exec: () => `${commit('moved')}\trefs/tags/v9.3` },
        'commit-unreachable',
      ],
      [
        {
          resolution: {
            ...nanoResolution,
            gnu: {
              ...nanoResolution.gnu!,
              tarball: {
                ...nanoResolution.gnu!.tarball,
                sha256: 'f'.repeat(64),
              },
            },
          },
        },
        'checksum-mismatch',
      ],
      [
        {
          exec: (file: string, args: readonly string[]) => {
            if (file === 'musl-gcc') throw Error('not installed');
            return gnuExecFor(libc)(file, args);
          },
        },
        'toolchain-unavailable',
      ],
    ] as const)
      await rejects(
        prepareBuild({
          config: nanoConfig,
          resolution: nanoResolution,
          layout: { ...layout, sources: join(layout.root, `s-${code}`) },
          api: ncursesApi(),
          acquired: [],
          exec: gnuExecFor(libc),
          ...changes,
        } as never),
        code,
      );
  });
});

test('an autotools compile builds each package without a token and validates the ELF', async () => {
  await withLayout(async (layout) => {
    const { elf, resolution: nanoResolution } = await gnuResolution(layout);
    const libc = join(layout.root, 'libc.a');
    await writeFile(libc, 'musl libc');
    const plan = await prepareBuild({
      config: nanoConfig,
      resolution: nanoResolution,
      layout,
      api: ncursesApi(),
      acquired: [],
      exec: gnuExecFor(libc),
    });
    const record = await compilePlan(plan, { layout, validate: validateGuest });
    assert.equal(record.elfSha256, sha(elf));
    assert.equal(record.buildInfo.rustc, null);
    const args = await readFile(
      join(plan.gnu!.steps[1]!.sourceDir, 'configure.args'),
      'utf8',
    );
    assert.match(args, /^--prefix=\/.+\/prefix\n--disable-nls\n/);
    assert.match(args, /NCURSESW_CFLAGS=-I\/.+\/prefix\/include\/ncursesw\n/);
  });
});
