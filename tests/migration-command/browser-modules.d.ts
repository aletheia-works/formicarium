// Add C05 to the shared browser module fixture without changing U2/U3 files.
declare module '*/runtime/public.js' {
  export const createCommandSession: typeof import('../../runtime/public.js').createCommandSession;
}
