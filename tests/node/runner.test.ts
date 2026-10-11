// FR2.1・R-04：Node.js の Worker 上の blink でゲストを実行し、stdout・終了コードを受け取れること。
// FR4.1・FR4.2・NFR3：ゲストと手順の表（runtime/registry.js）と、その入口の検証。
// 前提：bash .mise/tasks/build-blink-wasm と bash .mise/tasks/build-guests probe を実行済み
//       （表と入口の検証のテストは、ビルド物なしで実行できる）。
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { describe, it } from 'node:test';
import {
  GUESTS as GUEST_TABLE,
  SESSIONS as SESSION_TABLE,
} from '../../runtime/registry.js';
import { parseRunRequest, SESSIONS } from '../../runtime/web/sessions.js';
import { missingArtifacts, root } from './helpers.js';

const TIMEOUT_MS = 5 * 60 * 1000;

function run(args: string[]) {
  const result = spawnSync(process.execPath, ['runtime/node/run.js', ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
  });
  if (result.error) throw result.error;
  return result;
}

describe('Node.js ランナー（runtime/node/run.js）', () => {
  it('hello ゲストは終了コード 0 と期待どおりの stdout を返す', () => {
    assert.equal(
      missingArtifacts(['dist/blink/blink.mjs', 'dist/guests/hello']),
      null,
    );
    const result = run(['dist/guests/hello', 'one', 'two words']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout,
      'hello from formicarium guest\narg: one\narg: two words\n',
    );
  });

  it('終了コード 3 のゲストの終了コードと stderr が伝わる', () => {
    assert.equal(
      missingArtifacts(['dist/blink/blink.mjs', 'dist/guests/exit3']),
      null,
    );
    const result = run(['dist/guests/exit3']);
    assert.equal(result.status, 3);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /exiting with status 3/);
  });

  it('存在しないゲストでは終了コード 127 とエラーメッセージを返す', () => {
    const result = run(['dist/guests/no-such-guest']);
    assert.equal(result.status, 127);
    assert.match(result.stderr, /guest not found: dist\/guests\/no-such-guest/);
  });

  it('不正なオプションは終了コード 2 で止まる', () => {
    const result = run(['--cwd', 'relative', 'dist/guests/hello']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /--cwd must be an absolute path/);
  });
  it('ゲスト待機期限切れでは終了コード 124 と診断を返す', () => {
    const result = run([
      '--timeout',
      '0.001',
      'dist/guests/probe',
      'mutex-condvar',
    ]);
    assert.equal(result.status, 124);
    assert.match(result.stderr, /timed out/);
  });
});

describe('ブラウザ用の手順の定義（runtime/web/sessions.js）', () => {
  it('診断フラグ -s をゲストと手順へ伝達する', () => {
    assert.deepEqual(
      parseRunRequest(new URLSearchParams('guest=probe&core-flag=-s')),
      { kind: 'guest', name: 'probe', args: [], coreFlags: ['-s'] },
    );
    assert.deepEqual(
      parseRunRequest(new URLSearchParams('session=aube-1645&core-flag=-s')),
      { kind: 'session', name: 'aube-1645', coreFlags: ['-s'] },
    );
  });
  it('未許可の診断フラグを拒否する', () => {
    assert.throws(
      () => parseRunRequest(new URLSearchParams('guest=hello&core-flag=-x')),
      /unsupported diagnostic flag/,
    );
  });
  it('通常のリクエストに診断フラグを追加しない', () => {
    assert.deepEqual(
      parseRunRequest(new URLSearchParams('guest=hello&arg=one')),
      { kind: 'guest', name: 'hello', args: ['one'] },
    );
  });
  it('aube-1645 のファイル一覧は fixtures/ の中身と一致する', () => {
    const session = SESSIONS['aube-1645'];
    const base = path.join(root, 'fixtures', 'aube-local-deps');
    const files: string[] = [];
    const walk = (dir: string, rel: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        const relative = rel ? `${rel}/${name}` : name;
        if (statSync(full).isDirectory()) walk(full, relative);
        else files.push(relative);
      }
    };
    walk(base, '');
    assert.deepEqual([...session.projectFiles].sort(), files.sort());
  });
});

/** dir 以下のファイルを、dir からの相対パス（/ 区切り）で列挙する。 */
function listFiles(dir: string): string[] {
  const files: string[] = [];
  const walk = (current: string, rel: string) => {
    for (const name of readdirSync(current)) {
      const full = path.join(current, name);
      const relative = rel ? `${rel}/${name}` : name;
      if (statSync(full).isDirectory()) walk(full, relative);
      else files.push(relative);
    }
  };
  walk(dir, '');
  return files.sort();
}

function sessionInfo(args: string[]) {
  const result = spawnSync(
    process.execPath,
    ['scripts/session-info.js', ...args],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 60 * 1000,
    },
  );
  if (result.error) throw result.error;
  return result;
}

describe('ゲストと手順の表（runtime/registry.js、FR4.1）', () => {
  it('どの手順も、手順ファイルと project のファイルが fixtures/ に実在し、一覧が中身と一致する', () => {
    assert.ok(Object.keys(SESSION_TABLE).length >= 2);
    for (const [name, session] of Object.entries(SESSION_TABLE)) {
      assert.ok(
        Object.hasOwn(GUEST_TABLE, session.guest),
        `${name}: unknown guest ${session.guest}`,
      );
      for (const file of [session.script, session.projectBase]) {
        assert.match(file, /^fixtures\//, `${name}: ${file}`);
        assert.ok(
          existsSync(path.join(root, file)),
          `${name}: ${file} がありません`,
        );
      }
      assert.match(
        session.baseline,
        /^fixtures\/baseline\/[a-z0-9-]+\.native\.txt$/,
        name,
      );
      assert.deepEqual(
        [...session.projectFiles].sort(),
        listFiles(path.join(root, session.projectBase)),
        name,
      );
      // persist は projectRoot（cwd の親）と HOME を含む
      assert.ok(session.cwd.startsWith(`${session.projectRoot}/`), name);
      assert.ok(
        session.persist.includes(session.projectRoot) &&
          session.persist.includes('/root'),
        name,
      );
    }
  });

  it('表のゲストは、すべて .mise/tasks/build-guests のビルドの対象に含まれる', () => {
    const script = readFileSync(
      path.join(root, '.mise/tasks/build-guests'),
      'utf8',
    );
    const listed = /^guests="([a-z0-9 -]+)"$/m.exec(script);
    assert.ok(listed, 'build-guests.sh に guests="..." の行がありません');
    const built = new Set(listed[1].split(' '));
    for (const name of Object.keys(GUEST_TABLE))
      assert.ok(built.has(name), `${name} がビルドの対象にありません`);
    assert.match(script, /^case \$what in probe\|aube\|pitchfork\|all\)/m);
  });

  it('ブラウザの一覧（sessions.js）は表と同じ手順を、このファイルからの相対パスで公開する', () => {
    assert.deepEqual(
      Object.keys(SESSIONS).sort(),
      Object.keys(SESSION_TABLE).sort(),
    );
    assert.equal(
      SESSIONS['pitchfork-basic'].script,
      '../../fixtures/sessions/pitchfork-basic.txt',
    );
    assert.equal(SESSIONS['pitchfork-basic'].guest, 'pitchfork');
  });
});

describe('入口の検証（FR4.2、NFR3）', () => {
  it('表にある手順は受け付ける', () => {
    assert.deepEqual(
      parseRunRequest(new URLSearchParams('session=pitchfork-basic')),
      {
        kind: 'session',
        name: 'pitchfork-basic',
      },
    );
    assert.deepEqual(
      parseRunRequest(new URLSearchParams('guest=pitchfork&arg=--version')),
      {
        kind: 'guest',
        name: 'pitchfork',
        args: ['--version'],
      },
    );
  });

  it('許可リストにないゲスト名・手順名を拒否する', () => {
    assert.throws(
      () => parseRunRequest(new URLSearchParams('guest=sh')),
      /unknown guest: sh/,
    );
    assert.throws(
      () => parseRunRequest(new URLSearchParams('guest=../../etc/passwd')),
      /unknown guest/,
    );
    assert.throws(
      () => parseRunRequest(new URLSearchParams('session=../x')),
      /unknown session: \.\.\/x/,
    );
    assert.throws(
      () => parseRunRequest(new URLSearchParams('session=pitchfork-other')),
      /unknown session: pitchfork-other/,
    );
    // Object.prototype のプロパティ名も、表にない名前として拒否する
    assert.throws(
      () => parseRunRequest(new URLSearchParams('session=constructor')),
      /unknown session/,
    );
  });

  it('scripts/session-info.js は表の手順をシェル変数で出し、未知の名前を終了コード 0 以外で拒否する', () => {
    const ok = sessionInfo(['pitchfork-basic']);
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /^GUEST='pitchfork'$/m);
    assert.match(
      ok.stdout,
      /^SCRIPT='fixtures\/sessions\/pitchfork-basic\.txt'$/m,
    );
    assert.match(ok.stdout, /^PROJECT_BASE='fixtures\/pitchfork-basic'$/m);
    assert.match(
      ok.stdout,
      /^BASELINE='fixtures\/baseline\/pitchfork-basic\.native\.txt'$/m,
    );
    assert.match(
      sessionInfo(['aube-1645']).stdout,
      /^GUEST_ENV='AUBE_NO_UPDATE_CHECK=1'$/m,
    );
    for (const name of ['no-such-session', '../x', 'constructor']) {
      const result = sessionInfo([name]);
      assert.notEqual(result.status, 0, name);
      assert.equal(result.stdout, '', name);
      assert.match(result.stderr, /unknown session/, name);
    }
    assert.equal(sessionInfo([]).status, 2);
  });
});
