import type { Progress } from '@aletheia-works/formicarium';
import { stringsFor } from '../i18n/strings.ts';
import type { Locale } from './page-data.ts';

/** What the status line shows (StatusLine). */
export type Status =
  | { kind: 'isolating' }
  | { kind: 'isolation-failed' }
  | { kind: 'loading' }
  | {
      kind: 'installing';
      tool: string;
      version: string;
      progress: Progress | null;
    }
  | { kind: 'ready'; tool: string | null; version: string | null }
  | { kind: 'ready-failed-install'; code: string; message: string }
  | { kind: 'running' }
  | { kind: 'relay' }
  | { kind: 'relay-unreachable' }
  | { kind: 'interactive' }
  | { kind: 'no-output' }
  | { kind: 'aborted' }
  | { kind: 'command-failed'; code: string; message: string }
  /** The mistakes the terminal explains itself (see terminal-host.ts). */
  | { kind: 'command-not-found'; name: string }
  | { kind: 'unknown-tool'; selection: string }
  | { kind: 'outside-roots'; name: string; work: string; home: string }
  | { kind: 'missing-entry'; name: string }
  | { kind: 'no-shell' }
  | { kind: 'usage'; name: string }
  | { kind: 'failed'; code: string; message: string }
  | { kind: 'line-too-long' }
  | { kind: 'paste-truncated' };

const PHASES: Record<Locale, Record<Progress['phase'], string>> = {
  en: {
    fetch: 'downloading',
    extract: 'extracting',
    digest: 'checking the digest',
    validate: 'validating',
    register: 'registering',
  },
  ja: {
    fetch: '取得中',
    extract: '展開中',
    digest: 'digest の確認中',
    validate: '検証中',
    register: '登録中',
  },
};

/** totalBytes null (unknown) and 0 are different. */
export function progressText(
  progress: Progress | null,
  locale: Locale,
): string {
  if (!progress) return locale === 'ja' ? '開始しています' : 'starting';
  const phase = PHASES[locale][progress.phase] ?? progress.phase;
  if (progress.totalBytes === null)
    return locale === 'ja'
      ? `${phase} ${progress.processedBytes} bytes（全体の大きさは不明）`
      : `${phase} ${progress.processedBytes} bytes, total unknown`;
  return `${phase} ${progress.processedBytes}/${progress.totalBytes} bytes`;
}

/** The sentence for a status; tool names, versions and codes are not translated. */
export function statusText(status: Status, locale: Locale): string {
  const ja = locale === 'ja';
  switch (status.kind) {
    case 'isolating':
      return ja
        ? 'クロスオリジン分離を準備しています…'
        : 'Preparing cross-origin isolation…';
    case 'isolation-failed':
      return ja
        ? 'クロスオリジン分離を使えません。このサイトで Service Worker を許可して再読み込みしてください。'
        : 'Cross-origin isolation is unavailable. Allow service workers for this site and reload.';
    case 'loading':
      return ja ? 'formicarium を読み込んでいます…' : 'Loading formicarium…';
    case 'installing': {
      const name = status.version
        ? `${status.tool} ${status.version}`
        : status.tool;
      return ja
        ? `${name} を導入しています：${progressText(status.progress, locale)}`
        : `Installing ${name}: ${progressText(status.progress, locale)}`;
    }
    case 'ready':
      if (status.tool)
        return ja
          ? `準備完了：${status.tool} ${status.version}`
          : `Ready: ${status.tool} ${status.version}`;
      return ja
        ? '準備完了。install <ツール> でツールを導入できます。'
        : 'Ready. Type install <tool> to add a tool.';
    case 'ready-failed-install':
      return ja
        ? `導入に失敗しました（${status.code}: ${status.message}）。同じ command を打つと再試行します。`
        : `Install failed (${status.code}: ${status.message}). Type the command again to retry.`;
    case 'running':
      return ja
        ? '実行中… Ctrl-C で取り消します。'
        : 'Running… Press Ctrl-C to cancel.';
    case 'relay':
      return ja
        ? 'relay に接続の token を求めています… Ctrl-C で取り消します。'
        : 'Asking the relay for a connection token… Press Ctrl-C to cancel.';
    case 'relay-unreachable':
      return ja
        ? 'relay に届かないので、network なしで実行します。clone と fetch は失敗します。'
        : 'Relay unreachable, so this runs without the network; clone and fetch will fail.';
    case 'interactive':
      return ja
        ? '対話モードで実行中です。キー入力（Ctrl-C も）はツールに渡ります。止めるには「停止」を押してください。'
        : 'Running interactively. Keys, Ctrl-C included, go to the tool; press Stop to end it.';
    case 'no-output':
      return ja ? '（出力なし）' : '(no output)';
    case 'aborted':
      return ja ? '取り消しました（ABORTED）。' : 'Cancelled (ABORTED).';
    case 'command-failed':
      return ja
        ? `直前の command が失敗しました（${status.code}: ${status.message}）。`
        : `The last command failed (${status.code}: ${status.message}).`;
    case 'command-not-found':
      return stringsFor(locale).shell.notFoundStatus(status.name);
    case 'unknown-tool':
      return stringsFor(locale).shell.unknownToolStatus(status.selection);
    case 'outside-roots':
      return stringsFor(locale).shell.outsideRootsStatus(
        status.name,
        status.work,
        status.home,
      );
    case 'missing-entry':
      return stringsFor(locale).shell.missingStatus(status.name);
    case 'no-shell':
      return stringsFor(locale).shell.noShellStatus;
    case 'usage':
      return stringsFor(locale).shell.usageStatus(status.name);
    case 'failed':
      return ja
        ? `${status.code}: ${status.message}。再読み込みしてください。`
        : `${status.code}: ${status.message}. Reload the page to try again.`;
    case 'line-too-long':
      return ja
        ? '1行は 65536 bytes までです。それ以上は入力できません。'
        : 'A line is limited to 65536 bytes; further input is refused.';
    case 'paste-truncated':
      return ja
        ? '貼り付けた最初の行だけを入力しました（残りは捨てました）。'
        : 'Only the first pasted line was entered; the rest was discarded.';
  }
}

/** OmittedNotice text, outside the terminal. */
export function omittedText(
  bytes: number,
  lines: number,
  locale: Locale,
): string {
  return locale === 'ja'
    ? `以前の出力を省略しました（${bytes} bytes、${lines} 行）`
    : `Earlier output omitted (${bytes} bytes, ${lines} lines)`;
}
