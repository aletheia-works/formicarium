import { errorText } from '../runtime/contracts.js';
// ページのスクリプト。crossOriginIsolated を表示し、URL のパラメータで選んだゲストを
// Worker で実行して、結果を <pre id="output"> と data-exit-code に出す。
//
//   ?guest=probe            probe を実行（既定）
//   ?guest=hello&arg=a      引数つきで実行
//   ?session=aube-1645      aube #1645 の手順を実行し、書き起こしを出す
//
// 結果は window.formicariumResult にも置く（Playwright のテストと計測が読む）。
import { parseRunRequest } from './sessions.js';

const $ = (id: string): HTMLElement => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`missing element: ${id}`);
  return element;
};
const output = $('output');

function setStatus(text: string, className?: string) {
  $('status').textContent = text;
  $('status').className = className ?? '';
}

/**
 * crossOriginIsolated でなければ、COOP/COEP を付ける service worker を登録して 1 回だけ
 * 読み込み直す（GitHub Pages のようにヘッダーを設定できない配信先向け）。
 * @returns {Promise<boolean>} 読み込み直すなら true
 */
async function ensureIsolation() {
  if (globalThis.crossOriginIsolated) return false;
  if (!('serviceWorker' in navigator)) return false;
  let reloaded = false;
  try {
    reloaded = sessionStorage.getItem('formicarium-coi-reload') === '1';
  } catch {
    // sessionStorage が使えない環境では、無限に読み込み直さないよう諦める
    return false;
  }
  if (reloaded) return false;
  try {
    await navigator.serviceWorker.register(
      new URL('./coi-sw.js', import.meta.url),
      { scope: './' },
    );
    await navigator.serviceWorker.ready;
    sessionStorage.setItem('formicarium-coi-reload', '1');
    location.reload();
    return true;
  } catch (error) {
    console.warn(`service worker registration failed: ${errorText(error)}`);
    return false;
  }
}

async function main() {
  window.formicariumDiagnostics = { stdout: '', stderr: '' };
  if (await ensureIsolation()) return;
  try {
    sessionStorage.removeItem('formicarium-coi-reload');
  } catch {
    // 使えなくても実行には影響しない
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
  const worker = new Worker(new URL('./worker.js', import.meta.url), {
    type: 'module',
  });
  worker.onmessage = ({ data }) => {
    if (data.type === 'stdout' || data.type === 'stderr') {
      window.formicariumDiagnostics[data.type as 'stdout' | 'stderr'] +=
        data.text;
      // 書き起こしを出す手順では、途中経過は stderr を含めて表示し、最後に置き換える
      output.append(data.text);
      return;
    }
    const elapsedMs = performance.now() - started;
    $('elapsed').textContent = `${(elapsedMs / 1000).toFixed(2)} s`;
    worker.terminate();
    if (data.type === 'done') {
      if (data.transcript !== undefined) output.textContent = data.transcript;
      output.dataset.exitCode = String(data.exitCode);
      setStatus(
        `done (exit ${data.exitCode})`,
        data.exitCode === 0 ? 'ok' : 'ng',
      );
      window.formicariumResult = {
        isolated,
        exitCode: data.exitCode,
        transcript: data.transcript,
        steps: data.steps,
        elapsedMs,
        visibility: document.visibilityState,
        userAgent: navigator.userAgent,
      };
    } else {
      setStatus(`error: ${data.message}`, 'ng');
      if (data.stderr)
        output.append(`
[core stderr]
${data.stderr}`);
      window.formicariumResult = {
        isolated,
        error: data.message,
        stderr: data.stderr,
      };
    }
  };
  worker.onerror = (event) => {
    worker.terminate();
    setStatus(`error: ${event.message}`, 'ng');
    window.formicariumResult = { isolated, error: event.message };
  };
  worker.postMessage(request);
}

main().catch((error) => {
  setStatus(`error: ${errorText(error)}`, 'ng');
  window.formicariumResult = { error: errorText(error) };
});
