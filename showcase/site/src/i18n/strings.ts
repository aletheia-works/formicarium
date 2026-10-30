import type { Locale } from '../terminal/page-data.ts';

/** Tool lists in the terminal's own messages; an empty one is named. */
const listEn = (items: readonly string[]) =>
  items.length ? items.join(', ') : 'none';
const listJa = (items: readonly string[]) =>
  items.length ? items.join('、') : 'なし';
/** Tool names inside a sentence: "a", "a and b", "a, b and c". */
const sentenceEn = (items: readonly string[]) =>
  items.length > 1
    ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
    : items.join('');
/** 「a」「a と b」「a・b・c」. */
const sentenceJa = (items: readonly string[]) =>
  items.length === 2 ? items.join(' と ') : items.join('・');

/**
 * UI strings of the Astro pages and the terminal's own messages (en and ja
 * must have the same keys).
 * Tool names, versions, commands and file names are not translated.
 */
export const STRINGS = {
  en: {
    tools: {
      title: 'Tools',
      description:
        'The CLI tools you can run in this browser with formicarium.',
      intro:
        'Each card opens a terminal with the tool already installed and a small sample project. The versions are the ones accepted in the latest showcase run.',
      open: 'Open the terminal',
      emptyLink: 'Or start from an empty terminal and install a tool yourself.',
    },
    toolPage: {
      title: (label: string) => `${label} in your browser`,
      description: (label: string) =>
        `Run ${label} in a browser terminal with formicarium.`,
      intro:
        'The sample project is in /work/app and the tool is installed when the page opens. Reloading starts a fresh session; nothing is saved.',
      allTools: 'All tools',
      hints: 'Try these commands:',
    },
    terminal: {
      title: 'Empty terminal',
      description: 'An empty formicarium terminal: install a tool and run it.',
      intro:
        'Install one of the tools below, then run it. The working directory /work/app is empty.',
      hints: 'Install a tool:',
    },
    terminalHelp: [
      'Builtins: ls, cat, cd, rm -rf, cp, mv, install <tool>, clear and help.',
      'Ctrl-C cancels a running command or drops the typed line.',
      'With text selected, Ctrl-C copies it (Cmd-C on macOS); Ctrl-V (Cmd-V) pastes.',
      'Ctrl-L clears the screen; Tab moves the focus out of the terminal.',
      'An interactive tool such as nano gets Ctrl-C itself; the Stop button ends it.',
    ],
    everyPageHelp: (tools: readonly string[]) =>
      `Every page installs ${sentenceEn(tools)} when it starts, so the other tools can use them.`,
    networkHelp: (tools: readonly string[]) =>
      `${sentenceEn(tools)} can clone and fetch public repositories from github.com, for example git clone https://github.com/octocat/Hello-World. The connection goes through Aletheia Works' relay on AWS, which reaches github.com only and answers only this site.`,
    terminalStop: 'Stop',
    /** What the terminal itself prints: `help` and the mistakes it explains. */
    shell: {
      help: (installed: readonly string[], tools: readonly string[]) =>
        [
          'Builtins: ls, cat, cd, rm -rf, cp, mv, install <tool>, clear, help',
          `Installed: ${listEn(installed)}`,
          `install <tool> adds: ${listEn(tools)}`,
          'Keys: Ctrl-C cancels a run or drops the line; with text selected it copies, off macOS.',
          '      Ctrl-V / Cmd-V pastes; Ctrl-L clears the screen.',
        ].join('\n'),
      notFound: (
        name: string,
        installed: readonly string[],
        tools: readonly string[],
      ) =>
        `${name}: command not found. Installed: ${listEn(installed)}. Add a tool with install <tool> (${listEn(tools)}).`,
      notFoundStatus: (name: string) =>
        `${name}: command not found. Type help for the commands.`,
      unknownTool: (selection: string, tools: readonly string[]) =>
        `install: no tool named ${selection}. Tools: ${listEn(tools)}.`,
      unknownToolStatus: (selection: string) =>
        `No tool named ${selection}. Type help for the tools.`,
      outsideRoots: (path: string, work: string, home: string) =>
        `cd: ${path} is outside ${work} and the home directory ${home}.`,
      outsideRootsStatus: (work: string, home: string) =>
        `cd goes only inside ${work} and ${home}.`,
    },
    tool: {
      aube: {
        label: 'aube',
        summary:
          'A fast Node.js package manager. The sample project links a local package from outside its directory.',
      },
      biome: {
        label: 'Biome',
        summary:
          'A formatter and linter for web projects. The sample project has a biome.json and two scripts.',
      },
      git: {
        label: 'Git',
        summary:
          'The version control system. The sample project has a README to commit, and git clone and fetch read public repositories on github.com (no push: the page has no credentials).',
      },
      jj: {
        label: 'jj',
        summary:
          'Jujutsu, a version control system that works with Git repositories. The sample project has a note to record; jj describe opens nano (save with Ctrl-O, leave with Ctrl-X), and jj git clone and fetch read public repositories on github.com (no push: the page has no credentials).',
      },
      nano: {
        label: 'nano',
        summary:
          'A small text editor for the terminal. The sample project has a note to edit; save with Ctrl-O and leave with Ctrl-X.',
      },
      pitchfork: {
        label: 'pitchfork',
        summary:
          'A daemon manager for development. The sample project has a pitchfork.toml.',
      },
    },
  },
  ja: {
    tools: {
      title: 'ツール',
      description: 'formicarium でこのブラウザの中で動かせる CLI ツール。',
      intro:
        'カードを開くと、ツールを導入済みの端末と小さな試しの project が用意されます。版は最新の showcase の run で受け入れたものです。',
      open: '端末を開く',
      emptyLink: '空の端末から自分でツールを導入することもできます。',
    },
    toolPage: {
      title: (label: string) => `ブラウザで動く ${label}`,
      description: (label: string) =>
        `formicarium のブラウザの端末で ${label} を動かします。`,
      intro:
        '試しの project は /work/app にあり、page を開くとツールを導入します。再読み込みすると新しい session になり、何も保存しません。',
      allTools: 'ツールの一覧',
      hints: '次の command を試せます：',
    },
    terminal: {
      title: '空の端末',
      description: '空の formicarium の端末。ツールを導入して動かします。',
      intro:
        '下のツールを導入してから実行してください。作業 dir の /work/app は空です。',
      hints: 'ツールの導入：',
    },
    terminalHelp: [
      '組込みの command：ls、cat、cd、rm -rf、cp、mv、install <ツール>、clear、help。',
      'Ctrl-C で実行中の command を取り消すか、入力中の行を捨てます。',
      '文字を選択しているときは Ctrl-C で copy し（macOS では Cmd-C）、Ctrl-V（Cmd-V）で貼り付けます。',
      'Ctrl-L で画面を消し、Tab で端末の外へ focus を移します。',
      'nano のような対話的なツールには Ctrl-C が渡るので、「停止」で終わらせます。',
    ],
    everyPageHelp: (tools: readonly string[]) =>
      `${sentenceJa(tools)} は、どの page でも開いたときに導入するので、ほかのツールからも使えます。`,
    networkHelp: (tools: readonly string[]) =>
      `${sentenceJa(tools)} は github.com の公開 repository を clone・fetch できます（例：git clone https://github.com/octocat/Hello-World）。接続は Aletheia Works が AWS で動かす relay を通り、relay は github.com にだけつなぎ、このサイトにだけ応えます。`,
    terminalStop: '停止',
    shell: {
      help: (installed: readonly string[], tools: readonly string[]) =>
        [
          '組込みの command：ls、cat、cd、rm -rf、cp、mv、install <ツール>、clear、help',
          `導入済み：${listJa(installed)}`,
          `install <ツール> で導入できるもの：${listJa(tools)}`,
          'キー：Ctrl-C で実行を取り消すか、入力中の行を捨てます。macOS 以外では、文字を選択していると copy します。',
          '　　　Ctrl-V / Cmd-V で貼り付け、Ctrl-L で画面を消します。',
        ].join('\n'),
      notFound: (
        name: string,
        installed: readonly string[],
        tools: readonly string[],
      ) =>
        `${name}：command が見つかりません。導入済み：${listJa(installed)}。install <ツール> でツールを追加できます（${listJa(tools)}）。`,
      notFoundStatus: (name: string) =>
        `${name}：command が見つかりません。help で使える command を表示します。`,
      unknownTool: (selection: string, tools: readonly string[]) =>
        `install：${selection} という名前のツールはありません。ツール：${listJa(tools)}。`,
      unknownToolStatus: (selection: string) =>
        `${selection} という名前のツールはありません。help でツールの一覧を表示します。`,
      outsideRoots: (path: string, work: string, home: string) =>
        `cd：${path} は ${work} と home directory の ${home} の外にあります。`,
      outsideRootsStatus: (work: string, home: string) =>
        `cd で移れるのは ${work} と ${home} の中だけです。`,
    },
    tool: {
      aube: {
        label: 'aube',
        summary:
          '速い Node.js の package manager。試しの project は dir の外の local の package を link します。',
      },
      biome: {
        label: 'Biome',
        summary:
          'web の project の formatter と linter。試しの project に biome.json と2つの script があります。',
      },
      git: {
        label: 'Git',
        summary:
          'version control system。試しの project に commit する README があり、git clone と fetch で github.com の公開 repository を取得できます（page に認証情報がないので push はできません）。',
      },
      jj: {
        label: 'jj',
        summary:
          'Git の repository で使える version control system の Jujutsu。試しの project に記録するメモがあります。jj describe は nano を開き（Ctrl-O で保存、Ctrl-X で終了）、jj git clone と fetch で github.com の公開 repository を取得できます（page に認証情報がないので push はできません）。',
      },
      nano: {
        label: 'nano',
        summary:
          '端末で使う小さなテキストエディタ。試しの project に編集できるメモがあります。Ctrl-O で保存し、Ctrl-X で終わります。',
      },
      pitchfork: {
        label: 'pitchfork',
        summary:
          '開発用の daemon の manager。試しの project に pitchfork.toml があります。',
      },
    },
  },
} as const;

/** Commands shown under each tool page (the same in both languages). */
export const HINTS: Readonly<Record<string, readonly string[]>> = Object.freeze(
  {
    aube: [
      'aube --version',
      'ls',
      'cat package.json',
      'cat /work/outside/linked/package.json',
      'aube --help',
    ],
    biome: ['biome --version', 'ls', 'cat example.js', 'biome --help'],
    git: [
      'git --version',
      'ls',
      'cat README.md',
      'git init demo',
      'git clone https://github.com/octocat/Hello-World',
    ],
    jj: [
      'jj --version',
      'ls',
      'cat note.txt',
      'jj git init',
      'jj describe',
      'jj log',
      'jj git clone https://github.com/octocat/Hello-World',
    ],
    nano: ['nano --version', 'ls', 'cat note.txt', 'nano note.txt'],
    pitchfork: [
      'pitchfork --version',
      'ls',
      'cat pitchfork.toml',
      'pitchfork --help',
    ],
  },
);

export type Strings = (typeof STRINGS)['en'];
export const stringsFor = (locale: Locale) =>
  STRINGS[locale] as unknown as Strings;

function keyPaths(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [prefix];
  return Object.entries(value).flatMap(([key, item]) =>
    keyPaths(item, prefix ? `${prefix}.${key}` : key),
  );
}

/**
 * Problems of the string tables: en/ja key sets differ, or the tools named
 * there differ from the candidate's tools. Empty means usable.
 */
export function checkStrings(
  tools: readonly string[],
  strings: Record<string, unknown> = STRINGS,
  hints: Readonly<Record<string, readonly string[]>> = HINTS,
): string[] {
  const problems: string[] = [];
  const en = new Set(keyPaths(strings.en));
  const ja = new Set(keyPaths(strings.ja));
  for (const key of en) if (!ja.has(key)) problems.push(`ja lacks ${key}`);
  for (const key of ja) if (!en.has(key)) problems.push(`en lacks ${key}`);
  const wanted = [...tools].sort();
  for (const [name, table] of [
    ['strings', (strings.en as { tool?: object } | undefined)?.tool ?? {}],
    ['hints', hints],
  ] as const) {
    const named = Object.keys(table).sort();
    for (const tool of wanted)
      if (!named.includes(tool))
        problems.push(`${name} lack the candidate tool ${tool}`);
    for (const tool of named)
      if (!wanted.includes(tool))
        problems.push(`${name} name ${tool}, which is not in the candidate`);
  }
  return problems;
}

/** Fails the build when checkStrings finds anything. */
export function requireStrings(tools: readonly string[]): void {
  const problems = checkStrings(tools);
  if (problems.length) throw new Error(`site strings: ${problems.join('; ')}`);
}
