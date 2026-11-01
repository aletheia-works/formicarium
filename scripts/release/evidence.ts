/** Checks the release scripts share. */
export const hex = (s: unknown): s is string =>
  typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
export function requireCondition(
  value: unknown,
  message: string,
): asserts value {
  if (!value) throw new Error(message);
}
export function unique(values: readonly string[], label: string) {
  requireCondition(
    new Set(values).size === values.length,
    `duplicate ${label}`,
  );
}
