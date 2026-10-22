export interface TimingRun {
  environment: Record<string, string>;
  trial: number;
  trials: number;
  milliseconds: Record<string, number>;
  exitCodes: Record<string, number>;
  hostBenchMs?: { before: number; after: number };
  toolVersion?: string;
  userAgent?: string;
}
export interface TimingDocument {
  schemaVersion: number;
  generatedAt: string;
  runs: TimingRun[];
  core?: { name?: string; commit?: string; emcc?: string };
  tool?: { version?: string; commit?: string };
  host?: { os?: string; cpu?: string; node?: string };
}
// aube の計測結果（docs/results/aube-timings.json）の形式と、表への整形（FR6・NFR3）。
// scripts/measure-aube.js が書き、tests/node/measure.test.js が形式を確かめる。

/** 計測する 4 コマンド（FR6.1）。キーは JSON の項目名。 */
export const COMMANDS = {
  version: 'aube --version',
  install: 'aube install（初回）',
  frozenInstall: 'aube install --frozen-lockfile',
  list: 'aube list',
};

/**
 * 背景資料（docs/research/cheerpx-oss.md）にある CheerpX 1.3.9 上の値。
 * 単位は秒。4 回のページ読み込み、ページは背面。i586 glibc の aube に statx の回避策を入れたもの。
 */
export const CHEERPX_REFERENCE = {
  source: 'docs/research/cheerpx-oss.md',
  environment:
    'CheerpX 1.3.9, WebVM Debian image, localhost, page hidden, 4 page loads',
  seconds: {
    version: [0.3, 0.7],
    install: [1.8, 5.7],
    frozenInstall: [1.3, 3.6],
    list: [0.17, 0.65],
  },
  notes: [
    'CheerpX の install は node --version の起動（0.5–1.3 s）を含む',
    'CheerpX はネットワークなし（registry の名前解決が即座に失敗する）',
    'CheerpX の aube は i586 glibc ビルド、formicarium は x86-64 static-musl ビルド',
  ],
};

const ENVIRONMENT_FIELDS = ['kind', 'name', 'version', 'os', 'visibility'];

/**
 * 計測結果の JSON を検証する。問題の一覧を返す（空なら妥当）。
 * NFR3：各値にブラウザ名とバージョン、OS、前面か背面か、試行回数が添えられていること。
 */
export function validateTimings(doc: TimingDocument) {
  const problems = [];
  if (!doc || typeof doc !== 'object') return ['document is not an object'];
  if (doc.schemaVersion !== 1) problems.push('schemaVersion must be 1');
  if (
    typeof doc.generatedAt !== 'string' ||
    Number.isNaN(Date.parse(doc.generatedAt))
  ) {
    problems.push('generatedAt must be an ISO date string');
  }
  if (!Array.isArray(doc.runs) || doc.runs.length === 0) {
    problems.push('runs must be a non-empty array');
    return problems;
  }
  doc.runs.forEach((run, i) => {
    const where = `runs[${i}]`;
    for (const field of ENVIRONMENT_FIELDS) {
      if (
        typeof run?.environment?.[field] !== 'string' ||
        run.environment[field] === ''
      ) {
        problems.push(`${where}.environment.${field} is missing`);
      }
    }
    if (!Number.isInteger(run?.trial) || run.trial < 1)
      problems.push(`${where}.trial must be a positive integer`);
    if (!Number.isInteger(run?.trials) || run.trials < run?.trial) {
      problems.push(`${where}.trials must be an integer >= trial`);
    }
    for (const key of Object.keys(COMMANDS)) {
      const ms = run?.milliseconds?.[key];
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) {
        problems.push(`${where}.milliseconds.${key} is missing`);
      }
      if (!Number.isInteger(run?.exitCodes?.[key]))
        problems.push(`${where}.exitCodes.${key} is missing`);
    }
    // hostBenchMs は任意。あれば、試行の前後に測ったホストの固定計算の時間（ms）であること。
    if (run?.hostBenchMs !== undefined) {
      for (const side of ['before', 'after'] as const) {
        const ms = run.hostBenchMs?.[side];
        if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) {
          problems.push(
            `${where}.hostBenchMs.${side} must be a positive number`,
          );
        }
      }
    }
  });
  return problems;
}

/**
 * ホストの速さの目安：1 スレッドの固定計算にかかった時間（ms）を返す。
 * このマシンでは、同じ計算の時間が 2.4 倍ほど変動することがある（docs/results/failures.md の U-2）。
 * 計測の前後に測って記録し、遅い時間帯に当たった試行を見分けられるようにする。
 */
export function measureHostBench(iterations = 1e8) {
  const started = process.hrtime.bigint();
  let h = 0;
  for (let i = 0; i < iterations; i++) h = (Math.imul(h, 31) + i) | 0;
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  // 計算結果を使い、最適化で計算そのものが消えないようにする
  return h === 0.5 ? ms + 1 : ms;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** 環境ごとに、各コマンドの最小・中央値・最大（秒）をまとめる。 */
export function summarize(doc: TimingDocument) {
  const groups = new Map<
    string,
    { environment: TimingRun['environment']; runs: TimingRun[] }
  >();
  for (const run of doc.runs) {
    const env = run.environment;
    const key = `${env.kind}:${env.name}:${env.version}:${env.visibility}`;
    if (!groups.has(key)) groups.set(key, { environment: env, runs: [] });
    groups.get(key)?.runs.push(run);
  }
  return [...groups.values()].map(({ environment, runs }) => {
    const stats: Record<string, { min: number; median: number; max: number }> =
      {};
    for (const key of Object.keys(COMMANDS)) {
      const seconds = runs.map((r) => r.milliseconds[key]! / 1000);
      stats[key] = {
        min: Math.min(...seconds),
        median: median(seconds),
        max: Math.max(...seconds),
      };
    }
    const failed = runs.filter((r) =>
      Object.values(r.exitCodes).some((c) => c !== 0),
    ).length;
    const bench = runs
      .filter((r) => r.hostBenchMs)
      .flatMap((r) => [r.hostBenchMs!.before, r.hostBenchMs!.after]);
    const hostBench = bench.length
      ? {
          min: Math.min(...bench),
          median: median(bench),
          max: Math.max(...bench),
        }
      : undefined;
    return {
      environment,
      trials: runs.length,
      stats,
      failedRuns: failed,
      hostBench,
    };
  });
}

const fmt = (s: number) => (s < 1 ? s.toFixed(2) : s.toFixed(1));

/** docs/results/README.md の本文を作る。 */
export function renderResultsMarkdown(doc: TimingDocument) {
  const rows = summarize(doc);
  const lines = [];
  lines.push('# 計測結果：aube の 4 コマンド（FR6）');
  lines.push('');
  lines.push(
    `このファイルは \`scripts/measure-aube.js\` が \`docs/results/aube-timings.json\` から生成する。手で編集しない。`,
  );
  lines.push('');
  lines.push(`- 生成日時：${doc.generatedAt}`);
  lines.push(
    `- コア：${doc.core?.name ?? '?'}（commit ${doc.core?.commit ?? '?'}、${doc.core?.emcc ?? ''}）`,
  );
  lines.push(
    `- aube：${doc.tool?.version ?? '?'}（commit ${doc.tool?.commit ?? '?'}、x86-64 static-musl）`,
  );
  lines.push(
    `- ホスト：${doc.host?.os ?? '?'}、${doc.host?.cpu ?? '?'}、Node.js ${doc.host?.node ?? '?'}`,
  );
  lines.push(
    '- 値は秒。「中央値（最小–最大）」。各値は、コアの起動（wasm の読み込みと初期化）を含む、そのコマンド 1 回の実時間。',
  );
  const withBench = rows.some((r) => r.hostBench);
  if (withBench) {
    lines.push(
      '- 「ホスト基準」は、各試行の前後に測ったホストの 1 スレッドの固定計算の時間（ms）。値が大きいほど、その試行の間ホストが遅かった。',
    );
  }
  lines.push('');
  lines.push(
    `| 環境 | 版 | OS | ページ | 試行 | --version | 初回 install | frozen install | list |${withBench ? ' ホスト基準 |' : ''}`,
  );
  lines.push(`|---|---|---|---|---|---|---|---|---|${withBench ? '---|' : ''}`);
  for (const row of rows) {
    const e = row.environment;
    const cells = Object.keys(COMMANDS).map(
      (k) =>
        `${fmt(row.stats[k]!.median)}（${fmt(row.stats[k]!.min)}–${fmt(row.stats[k]!.max)}）`,
    );
    if (withBench) {
      const b = row.hostBench;
      cells.push(
        b
          ? `${Math.round(b.median)}（${Math.round(b.min)}–${Math.round(b.max)}）`
          : '—',
      );
    }
    const trials = row.failedRuns
      ? `${row.trials}（失敗 ${row.failedRuns}）`
      : String(row.trials);
    lines.push(
      `| ${e.name} | ${e.version} | ${e.os} | ${e.visibility} | ${trials} | ${cells.join(' | ')} |`,
    );
  }
  const c = CHEERPX_REFERENCE;
  const range = (k: keyof typeof COMMANDS) =>
    `${c.seconds[k][0]}–${c.seconds[k][1]}`;
  lines.push(
    `| CheerpX 1.3.9（背景資料） | 1.3.9 | — | hidden | 4 | ${range('version')} | ${range('install')} | ${range('frozenInstall')} | ${range('list')} |${withBench ? ' — |' : ''}`,
  );
  lines.push('');
  lines.push('## 比べるときの差異');
  lines.push('');
  for (const note of c.notes) lines.push(`- ${note}`);
  lines.push(
    '- formicarium の値は、コマンドごとに blink を起動し直す（ファイルシステムの中身は JS 側で引き継ぐ）。CheerpX は 1 つの VM の中で続けて実行する。',
  );
  lines.push(
    '- ネットワークの扱い（registry への接続の試み）が両者の時間にどう効いているかは、まだ確かめていない（未検証）。',
  );
  lines.push(`- CheerpX の値の出典：\`${c.source}\`（${c.environment}）。`);
  lines.push(
    '- JIT を後回しにするかどうかの閾値は、この結果を見てユーザーが決める（意図書「Success Metrics」）。',
  );
  lines.push('');
  return `${lines.join('\n')}`;
}
