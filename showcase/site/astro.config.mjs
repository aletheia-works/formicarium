import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { satteri } from '@astrojs/markdown-satteri';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

const SITE_ROOT = dirname(fileURLToPath(import.meta.url));
// notices.ts reads this list: the modules whose code reaches the built site.
const MODULE_LIST =
  process.env.SHOWCASE_SITE_MODULES ??
  join(SITE_ROOT, '.work', 'build', 'bundle-modules.json');

/**
 * Records the module ids of every client chunk, and the style modules of the
 * other environments (Astro extracts component CSS in the prerender build).
 */
function recordBundleModules() {
  const found = new Set();
  return {
    name: 'formicarium-showcase-bundle-modules',
    generateBundle(_options, bundle) {
      const client = this.environment?.name === 'client';
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const id of Object.keys(output.modules))
          if (client || /\.css$|[?&]type=style/.test(id))
            found.add(id.replace(/\?.*$/, ''));
      }
    },
    // After generateBundle of each environment (buildEnd would run before it).
    writeBundle() {
      mkdirSync(dirname(MODULE_LIST), { recursive: true });
      writeFileSync(
        MODULE_LIST,
        `${JSON.stringify([...found].sort(), null, 2)}\n`,
      );
    },
  };
}

const label = (en, ja) => ({ label: en, translations: { ja } });

/** Japanese characters: kanji, kana with their punctuation, full-width forms. */
const CJK = /[\p{sc=Han}\u3000-\u30ff\uff00-\uffef]/u;
const CJK_BREAK = new RegExp(
  `(${CJK.source})[ \\t]*\\n[ \\t]*(?=${CJK.source})`,
  'gu',
);
/** The first (0) or last (-1) character of an inline node's text. */
const edge = (node, at) =>
  node === undefined
    ? ''
    : typeof node.value === 'string'
      ? (node.value.at(at) ?? '')
      : node.children?.length
        ? edge(node.children.at(at), at)
        : '';
const LEADING_BREAK = new RegExp(`^[ \\t]*\\n[ \\t]*(?=${CJK.source})`, 'u');
const TRAILING_BREAK = new RegExp(`(${CJK.source})[ \\t]*\\n[ \\t]*$`, 'u');

/**
 * Joins the source lines of a Japanese sentence: a browser shows the line
 * break between two Japanese characters as a space. A break next to Latin
 * text stays, since the docs put a space there. A Sätteri mdast plugin.
 */
const joinCjkLines = {
  name: 'formicarium-showcase-join-cjk-lines',
  text(node, ctx) {
    const siblings = ctx.parent(node)?.children ?? [];
    const index = ctx.indexOf(node) ?? -1;
    let value = node.value.replace(CJK_BREAK, '$1');
    if (CJK.test(edge(siblings[index - 1], -1)))
      value = value.replace(LEADING_BREAK, '');
    if (CJK.test(edge(siblings[index + 1], 0)))
      value = value.replace(TRAILING_BREAK, '$1');
    if (value !== node.value) ctx.setProperty(node, 'value', value);
  },
};

export default defineConfig({
  site: 'https://aletheia-works.github.io',
  base: '/formicarium',
  output: 'static',
  trailingSlash: 'always',
  // The API pages moved from the Development group; keep the old links working.
  redirects: {
    '/development/install-api/': '/formicarium/guides/install-api/',
    '/development/command-api/': '/formicarium/guides/command-api/',
    '/ja/development/install-api/': '/formicarium/ja/guides/install-api/',
    '/ja/development/command-api/': '/formicarium/ja/guides/command-api/',
  },
  // The unit tests build a small site into their own directories.
  publicDir: process.env.SHOWCASE_SITE_PUBLIC ?? './public',
  outDir: process.env.SHOWCASE_SITE_OUT ?? './dist',
  markdown: { processor: satteri({ mdastPlugins: [joinCjkLines] }) },
  integrations: [
    starlight({
      title: 'formicarium',
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        ja: { label: '日本語', lang: 'ja' },
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/aletheia-works/formicarium',
        },
      ],
      sidebar: [
        { ...label('Tools', 'ツール'), link: '/tools/' },
        { ...label('Empty terminal', '空の端末'), link: '/terminal/' },
        {
          ...label('Guides', 'ガイド'),
          items: [
            {
              ...label('Getting started', 'はじめに'),
              link: '/guides/getting-started/',
            },
            { ...label('Embedding', '組込み'), link: '/guides/embedding/' },
            {
              ...label('Install API', 'install API'),
              link: '/guides/install-api/',
            },
            {
              ...label('Command API', 'command API'),
              link: '/guides/command-api/',
            },
            {
              ...label('Error codes', 'エラーコード'),
              link: '/guides/errors/',
            },
            {
              ...label('Source builds', 'source build'),
              link: '/guides/source-builds/',
            },
            { ...label('Releases', '公開と配布'), link: '/guides/releases/' },
            {
              ...label('Architecture', '構成'),
              link: '/guides/architecture/',
            },
            {
              ...label('Maintenance', '保守'),
              link: '/guides/maintenance/',
            },
          ],
        },
        {
          ...label('Development', '開発'),
          items: [
            {
              ...label('Runtime architecture', 'ランタイムの構成'),
              link: '/development/architecture/',
            },
            {
              ...label('Package releases', 'パッケージの公開'),
              link: '/development/releases/',
            },
            {
              ...label('Core license', 'コアのライセンス'),
              link: '/development/licenses/',
            },
            {
              ...label('Architecture decisions', '設計上の決定'),
              items: [{ autogenerate: { directory: 'development/decisions' } }],
            },
          ],
        },
      ],
    }),
  ],
  vite: {
    // hidden: the .map files are written for coverage but no bundle names them.
    build: { sourcemap: 'hidden' },
    plugins: [recordBundleModules()],
  },
});
