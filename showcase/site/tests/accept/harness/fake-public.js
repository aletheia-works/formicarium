// Test-only stand-in for formicarium's root export (never part of the site).
// It answers commands with hostile output: HTML, a terminal status query,
// an OSC 8 link and a very long line, and an error message with HTML.
const encoder = new TextEncoder();
const lines = [];
globalThis.__harnessLines = lines;
// The network option of each command, as the page passed it (relay test).
const network = [];
globalThis.__harnessNetwork = network;

const HOSTILE = [
  '<script>window.__pwned = 1</script>\n',
  '<img src=x onerror="window.__pwned = 2">\n',
  '\x1b[6n',
  '\x1b]8;;https://example.com/phish\x07click me\x1b]8;;\x07\n',
  '\x1b]0;forged title\x07',
  `${'A'.repeat(300000)}\n`,
  'end of hostile output\n',
];

export function fixtureToFsEntries(entries) {
  return entries;
}

// The tools every page installs come through the installer, which writes nothing.
export function createInstaller() {
  return {
    async install(selection) {
      lines.push(`installer ${selection}`);
      return { operationId: 'harness', tool: selection, versionOrName: '0', digest: 'd', buildKey: 'k' };
    },
  };
}

export function createCommandSession() {
  return {
    async execute(line, options = {}) {
      lines.push(line);
      network.push([line, options.network ?? null]);
      if (line === 'fail') {
        const error = new Error('<img src=x onerror="window.__pwned = 3"> \x1b[31mred');
        error.code = 'EXECUTION';
        throw error;
      }
      const bytes = encoder.encode(line === 'show' ? HOSTILE.join('') : `${line}\n`);
      for (let offset = 0, sequence = 0; offset < bytes.length; offset += 65536, sequence++)
        options.onOutput?.({ runId: 'harness', sequence, stream: 'stdout', bytes: bytes.slice(offset, offset + 65536) });
      return { kind: 'guest', exitCode: 0, stdout: bytes, stderr: new Uint8Array(), runId: 'harness' };
    },
  };
}
