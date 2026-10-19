// Test-only stand-in for formicarium's /browser export (never part of the site).
export async function createSession() {
  return { async setCwd() {}, async dispose() {} };
}
