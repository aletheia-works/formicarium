import type { CommandResult, OutputChunk } from '@aletheia-works/formicarium';

export interface OutputSink {
  write(text: string): void;
}

const isControl = (code: number) =>
  (code < 0x20 && code !== 0x09 && code !== 0x0a) ||
  (code >= 0x7f && code <= 0x9f);
/** Control characters other than LF and TAB, shown as U+FFFD in error lines. */
export const plainText = (text: string) =>
  [...text]
    .map((character) => (isControl(character.charCodeAt(0)) ? '�' : character))
    .join('');

/**
 * Output of one command (BR3.6): guest output arrives only through onOutput
 * and its result bytes are not written again; builtin and install results
 * are written once from their stdout/stderr; empty writes nothing. Anything
 * after `cancel()` (or for an old generation) is dropped.
 */
export class CommandOutput {
  readonly #sink: OutputSink;
  readonly #decoders = { stdout: new TextDecoder(), stderr: new TextDecoder() };
  #active = true;
  #wrote = false;
  #endsWithLf = true;

  constructor(sink: OutputSink) {
    this.#sink = sink;
  }

  get wrote(): boolean {
    return this.#wrote;
  }

  #write(text: string): void {
    if (!this.#active || text === '') return;
    this.#sink.write(text);
    this.#wrote = true;
    this.#endsWithLf = text.endsWith('\n');
  }

  /** CommandOptions.onOutput: UTF-8 stream decoding per stream. */
  readonly onOutput = (chunk: OutputChunk): void => {
    if (!this.#active) return;
    const decoder = this.#decoders[chunk.stream];
    if (decoder) this.#write(decoder.decode(chunk.bytes, { stream: true }));
  };

  /** Writes the result once by its kind; a nonzero exit code gets one line. */
  finish(result: CommandResult): void {
    if (!this.#active) return;
    if (result.kind === 'guest') {
      this.#write(this.#decoders.stdout.decode());
      this.#write(this.#decoders.stderr.decode());
    } else if (result.kind === 'builtin' || result.kind === 'install') {
      this.#write(new TextDecoder().decode(result.stdout));
      this.#write(new TextDecoder().decode(result.stderr));
    }
    if (result.exitCode !== 0)
      this.#write(
        `${this.#endsWithLf ? '' : '\n'}exit code ${result.exitCode}\n`,
      );
    this.#active = false;
  }

  /** ExecutionError and other failures: `<code>: <message>` as plain text. */
  fail(error: unknown): { code: string; message: string } {
    const code = plainText(
      String((error as { code?: unknown } | null)?.code ?? 'EXECUTION'),
    );
    const message = plainText(
      error instanceof Error ? error.message : String(error),
    );
    if (this.#active)
      this.#write(`${this.#endsWithLf ? '' : '\n'}${code}: ${message}\n`);
    this.#active = false;
    return { code, message };
  }

  /** Ctrl-C or pagehide: later chunks and results are not shown. */
  cancel(): void {
    this.#active = false;
  }
}
