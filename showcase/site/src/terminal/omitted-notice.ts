import type { Locale } from './page-data.ts';
import { omittedText } from './status.ts';

/**
 * OmittedNotice: a paragraph below the terminal, written with
 * textContent only, shown once the display buffer has dropped something. It
 * never goes into the terminal output itself.
 */
export function renderOmitted(
  element: { textContent: string | null; hidden: HTMLElement['hidden'] },
  dropped: { droppedBytes: number; droppedLines: number },
  locale: Locale,
): void {
  if (dropped.droppedBytes === 0 && dropped.droppedLines === 0) {
    element.hidden = true;
    element.textContent = '';
    return;
  }
  element.textContent = omittedText(
    dropped.droppedBytes,
    dropped.droppedLines,
    locale,
  );
  element.hidden = false;
}
