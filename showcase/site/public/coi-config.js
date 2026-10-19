// Settings that coi-serviceworker.js reads (security-design S8). Kept outside
// the page so the terminal pages need no inline script for it. COEP stays
// require-corp in every browser: coepCredentialless left WebKit's Worker
// without isolation in U6.
window.coi = {
  shouldRegister: () => true,
  shouldDeregister: () => false,
  coepCredentialless: () => false,
  doReload: () => window.location.reload(),
  quiet: true,
};
