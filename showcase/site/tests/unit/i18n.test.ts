import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkStrings,
  HINTS,
  requireStrings,
  STRINGS,
  stringsFor,
} from '../../src/i18n/strings.ts';

const TOOLS = ['aube', 'biome', 'pitchfork'];

test('the shipped strings have the same keys in en and ja and name the candidate tools', () => {
  assert.deepEqual(checkStrings(TOOLS), []);
  assert.doesNotThrow(() => requireStrings(TOOLS));
  assert.equal(stringsFor('ja').tools.title, 'ツール');
  assert.equal(
    stringsFor('en').toolPage.title('Biome'),
    'Biome in your browser',
  );
});

test('a key missing in one language is reported', () => {
  const strings = {
    en: { ...STRINGS.en, extra: 'x' },
    ja: { ...STRINGS.ja, tools: { ...STRINGS.ja.tools, open: undefined } },
  };
  const ja = strings.ja as unknown as { tools: Record<string, unknown> };
  delete ja.tools.open;
  assert.deepEqual(checkStrings(TOOLS, strings), [
    'ja lacks tools.open',
    'ja lacks extra',
  ]);
});

test('a candidate tool without strings or hints, or strings for another tool, fail', () => {
  assert.deepEqual(checkStrings([...TOOLS, 'deno']), [
    'strings lack the candidate tool deno',
    'hints lack the candidate tool deno',
  ]);
  assert.deepEqual(checkStrings(['aube', 'biome']), [
    'strings name pitchfork, which is not in the candidate',
    'hints name pitchfork, which is not in the candidate',
  ]);
  assert.throws(() => requireStrings(['aube']), /site strings: /);
});

test('hints are commands of the tool and the builtins, not translated', () => {
  for (const tool of TOOLS) {
    assert.ok(HINTS[tool]!.includes(`${tool} --version`), tool);
    assert.ok(HINTS[tool]!.includes('ls'), tool);
    assert.ok(
      HINTS[tool]!.some((hint) => hint.startsWith('cat ')),
      tool,
    );
  }
  // The builtins refuse `..`: the link target is named by its absolute path.
  assert.ok(HINTS.aube!.includes('cat /work/outside/linked/package.json'));
  for (const hints of Object.values(HINTS))
    for (const hint of hints) assert.doesNotMatch(hint, /\.\./);
});

test('status-like UI strings keep tool names untranslated in both languages', () => {
  for (const tool of TOOLS) {
    const en = (STRINGS.en.tool as Record<string, { label: string }>)[tool]!
      .label;
    const ja = (STRINGS.ja.tool as Record<string, { label: string }>)[tool]!
      .label;
    assert.equal(en, ja, tool);
  }
});
