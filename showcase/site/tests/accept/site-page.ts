import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type Browser,
  type BrowserContext,
  test as base,
  type Page,
} from '@playwright/test';
import { createSession, webdriver } from '../../../tests/webdriver.ts';
import { SITE_ROOT } from '../../scripts/common.ts';

/** Keys the tests press. */
export type Key =
  | 'Enter'
  | 'Tab'
  | 'Alt+Tab'
  | 'Control+c'
  | 'Control+x'
  | 'q'
  // The platform's copy and paste keys (paste.spec.ts).
  | 'Control+v'
  | 'Control+Shift+v'
  | 'Control+Shift+c'
  | 'Meta+c'
  | 'Meta+v';

/**
 * One browser tab as the site acceptance sees it. Playwright drives Chromium,
 * Firefox and WebKit; safaridriver drives the Safari that ships with macOS.
 * The tests use only what both can do, so the same 28 run in each.
 */
export interface SitePage {
  readonly project: string;
  goto(url: string): Promise<void>;
  reload(): Promise<void>;
  /** Runs `fn` in the page (its source only: no closure) and returns its JSON result. */
  evaluate<R, A = undefined>(
    fn: (arg: A) => R | Promise<R>,
    arg?: A,
  ): Promise<R>;
  /** Key presses into the focused element. */
  type(text: string): Promise<void>;
  press(key: Key): Promise<void>;
  /** Puts text into the focused element at once. */
  insertText(text: string): Promise<void>;
  /** A left-button drag between two viewport points (to select text). */
  drag(
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): Promise<void>;
  setViewportSize(width: number, height: number): Promise<void>;
  title(): Promise<string>;
  /** Top-level windows or tabs open in this test (popups included). */
  windowCount(): Promise<number>;
}

/** Collects every CSP violation of a page from its first script on. */
export const CSP_LISTENER = join(import.meta.dirname, 'harness', 'csp.js');
export const COVERAGE_DIR = join(SITE_ROOT, '.work', 'coverage', 'v8');
const COLLECT_COVERAGE = process.env.SHOWCASE_SITE_COVERAGE === '1';

class PlaywrightPage implements SitePage {
  readonly project: string;
  readonly context: BrowserContext;
  readonly page: Page;
  constructor(project: string, context: BrowserContext, page: Page) {
    this.project = project;
    this.context = context;
    this.page = page;
  }
  async goto(url: string) {
    await this.page.goto(url);
  }
  async reload() {
    await this.page.reload();
  }
  evaluate<R, A = undefined>(fn: (arg: A) => R | Promise<R>, arg?: A) {
    return this.page.evaluate(fn as (arg: unknown) => R | Promise<R>, arg);
  }
  type(text: string) {
    return this.page.keyboard.type(text);
  }
  press(key: Key) {
    return this.page.keyboard.press(key);
  }
  insertText(text: string) {
    return this.page.keyboard.insertText(text);
  }
  async drag(from: { x: number; y: number }, to: { x: number; y: number }) {
    await this.page.mouse.move(from.x, from.y);
    await this.page.mouse.down();
    await this.page.mouse.move(to.x, to.y, { steps: 8 });
    await this.page.mouse.up();
  }
  setViewportSize(width: number, height: number) {
    return this.page.setViewportSize({ width, height });
  }
  title() {
    return this.page.title();
  }
  async windowCount() {
    return this.context.pages().length;
  }
}

/** WebDriver key code points (https://w3c.github.io/webdriver/#keyboard-actions). */
const WEBDRIVER_KEYS: Readonly<Record<string, string>> = Object.freeze({
  Enter: '\uE007',
  Tab: '\uE004',
  Control: '\uE009',
  Alt: '\uE00A',
  Shift: '\uE008',
  Meta: '\uE03D',
});
const keyActions = (keys: string[]) => [
  ...keys.map((value) => ({ type: 'keyDown', value })),
  ...keys.toReversed().map((value) => ({ type: 'keyUp', value })),
];

class SafariPage implements SitePage {
  readonly project = 'safari';
  readonly session: string;
  constructor(session: string) {
    this.session = session;
  }
  call(method: string, path: string, body?: unknown) {
    return webdriver(method, `/session/${this.session}${path}`, body);
  }
  async goto(url: string) {
    await this.call('POST', '/url', { url });
  }
  async reload() {
    await this.call('POST', '/refresh', {});
  }
  async evaluate<R, A = undefined>(fn: (arg: A) => R | Promise<R>, arg?: A) {
    // The source goes into the WebDriver script, which the page CSP does not
    // govern; eval in the page would be refused (no 'unsafe-eval').
    const reply = (await this.call('POST', '/execute/async', {
      script: `const [arg, done] = arguments;
Promise.resolve().then(() => (${fn.toString()})(arg)).then(
  (value) => done({ value: value === undefined ? null : value }),
  (error) => done({ error: String(error?.stack ?? error) }),
);`,
      args: [arg ?? null],
    })) as { value?: R; error?: string } | null;
    if (!reply || 'error' in reply)
      throw Error(`evaluate in Safari: ${reply?.error ?? 'no result'}`);
    return reply.value as R;
  }
  async drag(from: { x: number; y: number }, to: { x: number; y: number }) {
    const point = (at: { x: number; y: number }) => ({
      type: 'pointerMove',
      origin: 'viewport',
      x: Math.round(at.x),
      y: Math.round(at.y),
    });
    await this.call('POST', '/actions', {
      actions: [
        {
          type: 'pointer',
          id: 'mouse',
          parameters: { pointerType: 'mouse' },
          actions: [
            point(from),
            { type: 'pointerDown', button: 0 },
            { ...point(to), duration: 200 },
            { type: 'pointerUp', button: 0 },
          ],
        },
      ],
    });
    await this.call('DELETE', '/actions');
  }
  private async keys(actions: { type: string; value: string }[]) {
    await this.call('POST', '/actions', {
      actions: [{ type: 'key', id: 'keyboard', actions }],
    });
    await this.call('DELETE', '/actions');
  }
  type(text: string) {
    return this.keys([...text].flatMap((key) => keyActions([key])));
  }
  press(key: Key) {
    return this.keys(
      keyActions(key.split('+').map((part) => WEBDRIVER_KEYS[part] ?? part)),
    );
  }
  async insertText(text: string) {
    const active = (await this.call('GET', '/element/active')) as Record<
      string,
      string
    >;
    const [element] = Object.values(active);
    await this.call('POST', `/element/${element}/value`, { text });
  }
  /** Sizes the window so that the viewport (not the window) has this size. */
  async setViewportSize(width: number, height: number) {
    const viewport = () =>
      this.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    const window = (await this.call('GET', '/window/rect')) as {
      width: number;
      height: number;
    };
    const inner = await viewport();
    await this.call('POST', '/window/rect', {
      width: width + window.width - inner.width,
      height: height + window.height - inner.height,
    });
    const sized = await viewport();
    if (sized.width !== width || sized.height !== height)
      throw Error(
        `Safari keeps the viewport at ${sized.width}x${sized.height}, not ${width}x${height}`,
      );
  }
  async title() {
    return (await this.call('GET', '/title')) as string;
  }
  async windowCount() {
    return ((await this.call('GET', '/window/handles')) as string[]).length;
  }
  async close() {
    await webdriver('DELETE', `/session/${this.session}`);
  }
}

/**
 * `site`: a fresh browser state per test (the first visit registers the
 * service worker). Playwright opens a new context; Safari a new WebDriver
 * session, which starts without website data. In CI Firefox uses the profile
 * that trusts the job CA, as in the showcase acceptance; Safari trusts it
 * through the keychain.
 */
export const test = base.extend<
  { site: SitePage },
  { launched: () => Promise<Browser> }
>({
  // Launched on first use only, so the Safari project starts no Playwright browser.
  launched: [
    async ({ playwright, browserName, headless, launchOptions }, use) => {
      let browser: Promise<Browser> | undefined;
      await use(() => {
        browser ??= playwright[browserName].launch({
          ...launchOptions,
          headless,
        });
        return browser;
      });
      if (browser) await (await browser).close();
    },
    { scope: 'worker' },
  ],
  site: async (
    {
      launched,
      playwright,
      viewport,
      userAgent,
      deviceScaleFactor,
      isMobile,
      hasTouch,
    },
    use,
    info,
  ) => {
    const project = info.project.name;
    if (project === 'safari') {
      const session = await createSession();
      const page = new SafariPage(session.id);
      try {
        await page.call('POST', '/timeouts', {
          script: 30000,
          pageLoad: 60000,
        });
        await info.attach('browser', {
          contentType: 'application/json',
          body: JSON.stringify(session),
        });
        await use(page);
      } finally {
        await page.close();
      }
      return;
    }
    const profile = process.env.SHOWCASE_FIREFOX_PROFILE;
    const context =
      project === 'firefox' && profile
        ? await playwright.firefox.launchPersistentContext(profile, {
            ignoreHTTPSErrors: false,
            firefoxUserPrefs: { 'security.enterprise_roots.enabled': true },
          })
        : await (await launched()).newContext({
            viewport,
            userAgent,
            deviceScaleFactor,
            isMobile,
            hasTouch,
            ignoreHTTPSErrors: false,
          });
    try {
      await context.addInitScript({ path: CSP_LISTENER });
      const page = context.pages()[0] ?? (await context.newPage());
      const collect = COLLECT_COVERAGE && project === 'chromium';
      if (collect)
        await page.coverage.startJSCoverage({ resetOnNavigation: false });
      await use(new PlaywrightPage(project, context, page));
      // Chromium V8 coverage of the site scripts for merge-coverage.ts.
      if (collect && info.status === info.expectedStatus) {
        const entries = (await page.coverage.stopJSCoverage()).filter((entry) =>
          entry.url.includes('/_astro/'),
        );
        await mkdir(COVERAGE_DIR, { recursive: true });
        await writeFile(
          join(COVERAGE_DIR, `${info.testId}.json`),
          JSON.stringify(entries),
        );
      }
    } finally {
      await context.close();
    }
  },
});
