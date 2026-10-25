// Test-only (never part of the site): collects every CSP violation of the page;
// the tests require none. Playwright adds it as an init script; for Safari,
// which has no init script, the test server puts it first in <head>.
const violations = [];
globalThis.__cspViolations = violations;
document.addEventListener('securitypolicyviolation', (event) => {
  violations.push(`${event.violatedDirective} ${event.blockedURI}`);
});
