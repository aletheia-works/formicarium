import type { Locale } from '../terminal/page-data.ts';

/**
 * UI strings of the Astro pages (en and ja must have the same keys).
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
    terminalHelp:
      'Builtins: ls, cat, cd, rm -rf, cp, mv and install; clear (or Ctrl-L) empties the screen. Tab moves the focus out of the terminal; Ctrl-C cancels a running command (an interactive tool gets Ctrl-C; Stop ends it).',
    everyPageHelp: (tools: string) =>
      `Every page installs ${tools} when it starts, so other tools can open it too.`,
    networkHelp: (tools: string) =>
      `${tools} can clone from github.com, for example git clone https://github.com/octocat/Hello-World: the page asks Aletheia Works' relay on AWS for a short-lived token, and the connection goes through that relay to github.com only (the relay checks that the request comes from this site).`,
    terminalStop: 'Stop',
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
          'The version control system, built here from its signed source with curl, GnuTLS, nettle, GMP and zlib. The sample project has a README to commit; every page installs git, so jj can run it too. git clone https://github.com/<owner>/<repo> works through the relay, to github.com only.',
      },
      jj: {
        label: 'jj',
        summary:
          'Jujutsu, a version control system that works with Git repositories. The sample project has a note to record. jj describe opens nano for the message (save with Ctrl-O, leave with Ctrl-X). jj git clone https://github.com/<owner>/<repo> and jj git fetch reach github.com through the relay; push does not work, since the page has no credentials.',
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
    terminalHelp:
      '組込みの command：ls、cat、cd、rm -rf、cp、mv、install。clear（または Ctrl-L）で画面を消します。Tab で端末の外へ focus を移し、Ctrl-C で実行中の command を取り消します（対話的なツールには Ctrl-C が渡るので、「停止」で終わらせます）。',
    everyPageHelp: (tools: string) =>
      `${tools} は、どの page でも開いたときに導入するので、ほかのツールからも開けます。`,
    networkHelp: (tools: string) =>
      `${tools} は github.com から clone できます（例：git clone https://github.com/octocat/Hello-World）。page は Aletheia Works が AWS で動かす relay に短い間だけ使える token を求め、接続はその relay を通って github.com にだけつながります（relay は、要求がこのサイトから来たことを確かめます）。`,
    terminalStop: '停止',
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
          'version control system。署名された source から curl、GnuTLS、nettle、GMP、zlib と一緒にここで build しています。試しの project に commit する README があります。どの page でも git を導入するので、jj からも動かせます。git clone https://github.com/<owner>/<repo> は relay を通して github.com にだけつながります。',
      },
      jj: {
        label: 'jj',
        summary:
          'Git の repository で使える version control system の Jujutsu。試しの project に記録するメモがあります。jj describe は message を書くために nano を開きます（Ctrl-O で保存し、Ctrl-X で終わります）。jj git clone https://github.com/<owner>/<repo> と jj git fetch は relay を通して github.com につながります。page には認証情報が無いので push はできません。',
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
