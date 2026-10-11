// usage: node scripts/session-info.js <session>
// runtime/registry.js の表から手順 1 つの設定を読み、シェルで安全に読める形
// （1 行に KEY='value'、値の ' は '\'' にエスケープ）で stdout に出す（FR4.1）。
// .mise/tasks/native-baseline が eval して使う。
//
// 名前は NAME と表で検証する。手順ファイルも runtime/session.js と同じ規則で解釈して、
// Node.js・ブラウザと native で受け付ける手順が食い違わないようにする。
// 値は native の基準値のコンテナ用スクリプトにそのまま埋め込まれるので、文字の種類も検証する。
// 終了コード：0 成功、1 手順ファイルや表の値が不正、2 使い方の誤り・未知の名前。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { errorText } from '../runtime/contracts.js';

import { GUESTS, lookupSession } from '../runtime/registry.js';
import { parseSessionScript } from '../runtime/session.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** プロジェクトのルートからの相対パス（.. を含まない） */
const RELATIVE_PATH =
  /^(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._-][A-Za-z0-9._/-]*$/;
/** 仮想ファイルシステム（コンテナ）上の絶対パス（.. を含まない） */
const ABSOLUTE_PATH = /^\/(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]*$/;
const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ENV_VALUE = /^[A-Za-z0-9._:/@%+=,-]*$/;

/** シェルの単引用符で囲む。 */
function shellQuote(value: unknown) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function check(pattern: RegExp, label: string, value: unknown) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new Error(
      `invalid ${label} in runtime/registry.js: ${JSON.stringify(value)}`,
    );
  }
  return value;
}

/** 手順の設定を、シェル変数の組にする。不正な値があれば Error を投げる。 */
function sessionShellVars(name: string) {
  const session = lookupSession(name);
  const guest = GUESTS[session.guest as keyof typeof GUESTS];
  const env = Object.entries(guest.env).map(
    ([key, value]) =>
      `${check(ENV_KEY, 'env key', key)}=${check(ENV_VALUE, `env value of ${key}`, value)}`,
  );
  return {
    SESSION: name,
    GUEST: session.guest,
    GUEST_PATH: check(RELATIVE_PATH, 'guest path', guest.path),
    SCRIPT: check(RELATIVE_PATH, 'script', session.script),
    // 末尾の / は落とす（コンテナでは "$PROJECT_BASE/." として使う）
    PROJECT_BASE: check(
      RELATIVE_PATH,
      'projectBase',
      session.projectBase,
    ).replace(/\/+$/, ''),
    PROJECT_ROOT: check(ABSOLUTE_PATH, 'projectRoot', session.projectRoot),
    CWD: check(ABSOLUTE_PATH, 'cwd', session.cwd),
    BASELINE: check(RELATIVE_PATH, 'baseline', session.baseline),
    GUEST_ENV: env.join(' '),
  };
}

function main(argv: string[]) {
  if (argv.length !== 1) {
    process.stderr.write('usage: node scripts/session-info.js <session>\n');
    return 2;
  }
  let vars: ReturnType<typeof sessionShellVars>;
  try {
    vars = sessionShellVars(argv[0]!);
  } catch (error) {
    process.stderr.write(`error: ${errorText(error)}\n`);
    return /^unknown session/.test(errorText(error)) ? 2 : 1;
  }
  try {
    parseSessionScript(readFileSync(path.join(root, vars.SCRIPT), 'utf8'), {
      tool: vars.GUEST,
    });
  } catch (error) {
    process.stderr.write(`error: ${vars.SCRIPT}: ${errorText(error)}\n`);
    return 1;
  }
  for (const [key, value] of Object.entries(vars))
    process.stdout.write(`${key}=${shellQuote(value)}\n`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
