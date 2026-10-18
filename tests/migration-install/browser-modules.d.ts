// Add C04 to the shared browser module fixture without changing U2's C03 file.
declare module '*/runtime/public.js' {
  export const ERROR_CODES: typeof import('../../runtime/public.js').ERROR_CODES;
  export const ExecutionError: typeof import('../../runtime/public.js').ExecutionError;
  export const createInstaller: typeof import('../../runtime/public.js').createInstaller;
}
declare module '*/runtime/install.js' {
  export const createInstaller: typeof import('../../runtime/install.js').createInstaller;
  export const installationTiming: typeof import('../../runtime/install.js').installationTiming;
  export const installationGuest: typeof import('../../runtime/install.js').installationGuest;
}
declare module '*/runtime/guest-validation.js' {
  export const guestSha256: typeof import('../../runtime/guest-validation.js').guestSha256;
}
