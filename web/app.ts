import { errorText } from '../runtime/contracts.js';
import type { ExecutionError } from '../runtime/errors.js';
// ページのスクリプト。crossOriginIsolated を表示し、URL のパラメータで選んだゲストを
// パッケージのブラウザ API（Session）で実行して、結果を <pre id="output"> と data-exit-code に出す。
//
//   ?guest=probe            probe を実行（既定）
//   ?guest=hello&arg=a      引数つきで実行
//   ?session=aube-1645      aube #1645 の手順を実行し、書き起こしを出す
//
// 結果は window.formicariumResult にも置く（Playwright のテストと計測が読む）。
import { execute, type Outcome } from './run.js';
import { parseRunRequest } from './sessions.js';

const $ = (id: string): HTMLElement => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`missing element: ${id}`);
  return element;
};
const output = $('output');
// ExecutionError の cause（Worker で起きた元のエラーの連なり、外側から）を 1 行にする
function causeText(error: unknown): string | undefined {
  const parts: string[] = [];
  let current = error instanceof Error ? error.cause : undefined;
  while (current instanceof Error && parts.length < 4) {
    const { kind } = current as { kind?: unknown };
    const name =
      typeof kind === 'string' ? `${current.name}(${kind})` : current.name;
    parts.push(
      current.message === current.name ? name : `${name}: ${current.message}`,
    );
    current = current.cause;
  }
  return parts.length ? parts.join(' <- ') : undefined;
}

function setStatus(text: string, className?: string) {
  $('status').textContent = text;
  $('status').className = className ?? '';
}

/** これを過ぎても読み込み直されなければ（worker を登録できないなど）、失敗を報告する。 */
const ISOLATION_WAIT_MS = 15 * 1000;

/**
 * crossOriginIsolated でなく、service worker がまだページを制御していなければ、
 * index.html が読むルートの coi-serviceworker.js（GitHub Pages のようにヘッダーを設定
 * できない配信先向け）が worker を登録し、active になってから 1 回だけ読み込み直す。
 * 制御されても isolated でなければ、読み込み直さずに実行へ進み、失敗を報告する。
 * @returns 読み込み直しを待つなら true
 */
function awaitingIsolation(): boolean {
  return (
    !globalThis.crossOriginIsolated &&
    globalThis.isSecureContext &&
    'serviceWorker' in navigator &&
    !navigator.serviceWorker.controller
  );
}

async function main() {
  window.formicariumDiagnostics = { stdout: '', stderr: '' };
  if (awaitingIsolation()) {
    setStatus('waiting for the isolation service worker to reload the page');
    await new Promise((resolve) => setTimeout(resolve, ISOLATION_WAIT_MS));
  }
  const isolated = Boolean(globalThis.crossOriginIsolated);
  $('isolated').textContent = String(isolated);
  $('isolated').className = isolated ? 'ok' : 'ng';

  let request: ReturnType<typeof parseRunRequest>;
  try {
    request = parseRunRequest(new URLSearchParams(location.search));
  } catch (error) {
    setStatus(`error: ${errorText(error)}`, 'ng');
    window.formicariumResult = { error: errorText(error), isolated };
    return;
  }
  $('guest').textContent =
    request.kind === 'session'
      ? `session ${request.name}`
      : [request.name, ...request.args].join(' ');
  if (!isolated) {
    setStatus(
      'error: crossOriginIsolated is false (SharedArrayBuffer unavailable)',
      'ng',
    );
    window.formicariumResult = { error: 'not crossOriginIsolated', isolated };
    return;
  }

  setStatus('running');
  const started = performance.now();
  let outcome: Outcome;
  try {
    outcome = await execute(request, (stream, text) => {
      window.formicariumDiagnostics[stream] += text;
      // 書き起こしを出す手順では、途中経過は stderr を含めて表示し、最後に置き換える
      output.append(text);
    });
  } catch (error) {
    const { code, stderr } = error as Partial<ExecutionError>;
    // ExecutionError carries a string code; other errors (a DOMException's
    // numeric code, for one) are shown with their message only.
    const message =
      typeof code === 'string'
        ? `${code}: ${errorText(error)}`
        : errorText(error);
    const cause = causeText(error);
    setStatus(`error: ${message}${cause ? ` (${cause})` : ''}`, 'ng');
    const text = stderr?.length ? new TextDecoder().decode(stderr) : '';
    if (text) output.append(`\n[core stderr]\n${text}`);
    window.formicariumResult = {
      isolated,
      error: message,
      ...(cause ? { cause } : {}),
      stderr: text,
    };
    return;
  }
  const elapsedMs = performance.now() - started;
  $('elapsed').textContent = `${(elapsedMs / 1000).toFixed(2)} s`;
  if (outcome.transcript !== undefined) output.textContent = outcome.transcript;
  output.dataset.exitCode = String(outcome.exitCode);
  setStatus(
    `done (exit ${outcome.exitCode})`,
    outcome.exitCode === 0 ? 'ok' : 'ng',
  );
  window.formicariumResult = {
    isolated,
    ...outcome,
    elapsedMs,
    visibility: document.visibilityState,
    userAgent: navigator.userAgent,
  };
}

main().catch((error) => {
  setStatus(`error: ${errorText(error)}`, 'ng');
  window.formicariumResult = { error: errorText(error) };
});
