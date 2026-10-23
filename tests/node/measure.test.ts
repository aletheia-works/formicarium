// 計測結果の JSON に 4 コマンドと環境情報（ブラウザ名とバージョン、OS、前面か背面か、
// 試行回数）が揃っていることを確かめる。項目が欠けた JSON は不合格にする。
// 形式の確認には固定のサンプル（tests/fixtures/timings-*.json）を使い、
// 実際の計測結果（.artifacts/measure/aube-timings.json）は、あれば同じ検証にかける。
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  COMMANDS,
  measureHostBench,
  renderResultsMarkdown,
  summarize,
  validateTimings,
} from '../../scripts/lib/timings.js';
import { root } from './helpers.js';

const load = (name: string) =>
  JSON.parse(readFileSync(path.join(root, 'tests/fixtures', name), 'utf8'));

describe('計測結果の形式（scripts/lib/timings.js）', () => {
  it('4 コマンドと環境情報が揃った JSON は合格する', () => {
    assert.deepEqual(validateTimings(load('timings-valid.json')), []);
  });

  it('コマンドや環境情報が欠けた JSON は不合格になり、欠けた項目を挙げる', () => {
    const problems = validateTimings(load('timings-missing-fields.json'));
    assert.ok(
      problems.includes('runs[0].environment.version is missing'),
      problems.join('\n'),
    );
    assert.ok(
      problems.includes('runs[0].environment.visibility is missing'),
      problems.join('\n'),
    );
    assert.ok(
      problems.includes('runs[0].milliseconds.frozenInstall is missing'),
      problems.join('\n'),
    );
    assert.ok(
      problems.includes('runs[0].exitCodes.frozenInstall is missing'),
      problems.join('\n'),
    );
  });

  it('試行が 1 つもない JSON は不合格になる', () => {
    const doc = { ...load('timings-valid.json'), runs: [] };
    assert.deepEqual(validateTimings(doc), ['runs must be a non-empty array']);
  });

  it('表には環境ごとの中央値と CheerpX の値が並ぶ', () => {
    const doc = load('timings-valid.json');
    const [row] = summarize(doc);
    assert.equal(row.trials, 2);
    assert.equal(row.stats.version.median, 1.0);
    assert.equal(row.stats.list.min, 0.6);
    const markdown = renderResultsMarkdown(doc);
    assert.match(markdown, /\| chromium \| 140\.0 \|/);
    assert.match(markdown, /CheerpX 1\.3\.9/);
    assert.equal(Object.keys(COMMANDS).length, 4);
  });

  it('ホスト基準（hostBenchMs）があれば数値を検証し、表に列を出す', () => {
    const doc = load('timings-valid.json');
    doc.runs.forEach(
      (run: { hostBenchMs?: { before: number; after: number } }, i: number) => {
        run.hostBenchMs = { before: 300 + i * 100, after: 350 + i * 100 };
      },
    );
    assert.deepEqual(validateTimings(doc), []);
    const [row] = summarize(doc);
    assert.deepEqual(row.hostBench, { min: 300, median: 375, max: 450 });
    const markdown = renderResultsMarkdown(doc);
    assert.match(markdown, /\| list \| ホスト基準 \|/);
    assert.match(markdown, /\| 375（300–450） \|/);
  });

  it('ホスト基準が負の値や欠けた値なら不合格になる', () => {
    const doc = load('timings-valid.json');
    doc.runs[0].hostBenchMs = { before: -1 };
    const problems = validateTimings(doc);
    assert.ok(
      problems.includes('runs[0].hostBenchMs.before must be a positive number'),
      problems.join('\n'),
    );
    assert.ok(
      problems.includes('runs[0].hostBenchMs.after must be a positive number'),
      problems.join('\n'),
    );
  });

  it('ホスト基準がない JSON の表には、その列を出さない', () => {
    const markdown = renderResultsMarkdown(load('timings-valid.json'));
    assert.doesNotMatch(markdown, /ホスト基準/);
  });

  it('ホストの固定計算は正の時間を返す', () => {
    const ms = measureHostBench(1e6);
    assert.ok(Number.isFinite(ms) && ms > 0, String(ms));
  });

  it('.artifacts/measure/aube-timings.json（計測済みなら）も形式を満たす', (t) => {
    const actual = path.join(root, '.artifacts/measure/aube-timings.json');
    if (!existsSync(actual)) {
      t.diagnostic(
        '.artifacts/measure/aube-timings.json はまだない（node scripts/measure-aube.js で作る）',
      );
      return;
    }
    assert.deepEqual(
      validateTimings(JSON.parse(readFileSync(actual, 'utf8'))),
      [],
    );
  });
});
