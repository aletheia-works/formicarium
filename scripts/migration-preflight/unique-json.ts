/** JSON.parse alone silently replaces duplicate keys, including escaped aliases. */
export function parseUniqueJSON(raw: string): unknown {
  let cursor = 0;
  const space = () => {
    while (/\s/.test(raw[cursor] ?? '') && cursor < raw.length) cursor++;
  };
  const string = (): string => {
    const start = cursor++;
    while (cursor < raw.length) {
      const character = raw[cursor++];
      if (character === '\\') cursor++;
      else if (character === '"') return JSON.parse(raw.slice(start, cursor));
    }
    throw Error('unterminated JSON string');
  };
  const value = (): void => {
    space();
    if (raw[cursor] === '{') {
      cursor++;
      space();
      const keys = new Set<string>();
      if (raw[cursor] === '}') {
        cursor++;
        return;
      }
      while (true) {
        space();
        if (raw[cursor] !== '"') throw Error('JSON object key required');
        const key = string();
        if (keys.has(key)) throw Error(`duplicate JSON key: ${key}`);
        keys.add(key);
        space();
        if (raw[cursor++] !== ':') throw Error('JSON colon required');
        value();
        space();
        const delimiter = raw[cursor++];
        if (delimiter === '}') return;
        if (delimiter !== ',') throw Error('JSON object delimiter required');
      }
    }
    if (raw[cursor] === '[') {
      cursor++;
      space();
      if (raw[cursor] === ']') {
        cursor++;
        return;
      }
      while (true) {
        value();
        space();
        const delimiter = raw[cursor++];
        if (delimiter === ']') return;
        if (delimiter !== ',') throw Error('JSON array delimiter required');
      }
    }
    if (raw[cursor] === '"') {
      string();
      return;
    }
    const start = cursor;
    while (cursor < raw.length && !/[\s,\]}]/.test(raw[cursor]!)) cursor++;
    if (cursor === start) throw Error('JSON value required');
    JSON.parse(raw.slice(start, cursor));
  };
  value();
  space();
  if (cursor !== raw.length) throw Error('trailing JSON input');
  return JSON.parse(raw);
}
