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
        'Nothing is installed yet. Install one of the tools below, then run it. The working directory /work/app is empty.',
      hints: 'Install a tool:',
    },
    terminalHelp:
      'Builtins: ls, cat, cd, rm -rf, cp, mv and install; clear (or Ctrl-L) empties the screen. Tab moves the focus out of the terminal; Ctrl-C cancels a running command.',
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
        'まだ何も導入していません。下のツールを導入してから実行してください。作業 dir の /work/app は空です。',
      hints: 'ツールの導入：',
    },
    terminalHelp:
      '組込みの command：ls、cat、cd、rm -rf、cp、mv、install。clear（または Ctrl-L）で画面を消します。Tab で端末の外へ focus を移し、Ctrl-C で実行中の command を取り消します。',
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
