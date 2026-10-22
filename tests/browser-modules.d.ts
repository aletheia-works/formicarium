declare module '*/web/api.js' {
  export function createSession(
    options?: import('../types/index.js').SessionOptions,
  ): Promise<import('../types/index.js').Session>;
}
