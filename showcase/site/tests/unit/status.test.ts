import assert from 'node:assert/strict';
import test from 'node:test';
import {
  omittedText,
  progressText,
  type Status,
  statusText,
} from '../../src/terminal/status.ts';

const progress = (processedBytes: number, totalBytes: number | null) => ({
  operationId: 'op',
  sequence: 1,
  phase: 'fetch' as const,
  processedBytes,
  totalBytes,
});

test('install progress tells an unknown total from a zero total', () => {
  assert.equal(
    progressText(progress(1024, null), 'en'),
    'downloading 1024 bytes, total unknown',
  );
  assert.equal(progressText(progress(0, 0), 'en'), 'downloading 0/0 bytes');
  assert.equal(
    progressText(progress(0, null), 'ja'),
    '取得中 0 bytes（全体の大きさは不明）',
  );
  assert.equal(progressText(null, 'en'), 'starting');
});

test('every state has an English and a Japanese sentence', () => {
  const states: Status[] = [
    { kind: 'isolating' },
    { kind: 'isolation-failed' },
    { kind: 'loading' },
    {
      kind: 'installing',
      tool: 'aube',
      version: '2.7.2',
      progress: progress(5, 10),
    },
    { kind: 'ready', tool: 'aube', version: '2.7.2' },
    { kind: 'ready', tool: null, version: null },
    { kind: 'ready-failed-install', code: 'ASSET_LOAD', message: 'HTTP 404' },
    { kind: 'running' },
    { kind: 'interactive' },
    { kind: 'no-output' },
    { kind: 'aborted' },
    { kind: 'command-failed', code: 'NOT_FOUND', message: 'no guest x' },
    {
      kind: 'failed',
      code: 'UNSUPPORTED_ENV',
      message: 'no SharedArrayBuffer',
    },
    { kind: 'line-too-long' },
    { kind: 'paste-truncated' },
  ];
  for (const state of states) {
    const en = statusText(state, 'en');
    const ja = statusText(state, 'ja');
    assert.ok(en.length > 0 && ja.length > 0, state.kind);
    assert.notEqual(en, ja, state.kind);
  }
});

test('tool names, versions and codes are not translated', () => {
  assert.equal(
    statusText({ kind: 'ready', tool: 'biome', version: '2.5.15' }, 'ja'),
    '準備完了：biome 2.5.15',
  );
  assert.equal(
    statusText(
      {
        kind: 'installing',
        tool: 'pitchfork',
        version: '2.32.0',
        progress: progress(1, 2),
      },
      'en',
    ),
    'Installing pitchfork 2.32.0: downloading 1/2 bytes',
  );
  assert.match(
    statusText(
      { kind: 'ready-failed-install', code: 'ABORTED', message: 'cancelled' },
      'ja',
    ),
    /ABORTED: cancelled/,
  );
});

test('the empty-terminal ready text and the no-output text match the design', () => {
  assert.equal(
    statusText({ kind: 'ready', tool: null, version: null }, 'en'),
    'Ready. Type install <tool> to add a tool.',
  );
  assert.equal(statusText({ kind: 'no-output' }, 'en'), '(no output)');
  assert.equal(
    statusText({ kind: 'isolating' }, 'en'),
    'Preparing cross-origin isolation…',
  );
});

test('the omitted notice names the dropped bytes and lines', () => {
  assert.equal(
    omittedText(200, 1, 'en'),
    'Earlier output omitted (200 bytes, 1 lines)',
  );
  assert.equal(
    omittedText(200, 1, 'ja'),
    '以前の出力を省略しました（200 bytes、1 行）',
  );
});
