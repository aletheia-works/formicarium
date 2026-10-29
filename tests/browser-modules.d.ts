declare module '*/web/api.js' {
  export function createSession(
    options?: import('../types/index.js').SessionOptions,
  ): Promise<import('../types/index.js').Session>;
}
declare module '*/runtime/public.js' {
  export const createCommandSession: typeof import('../types/index.js').createCommandSession;
  export const registerValidatedGuest: typeof import('../types/index.js').registerValidatedGuest;
  export const validateGuest: typeof import('../types/index.js').validateGuest;
}
