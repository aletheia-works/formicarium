export interface BrowserOutcome {
  isolated?: boolean;
  error?: string;
  stderr?: string;
  exitCode?: number;
  transcript?: string;
  elapsedMs?: number;
  visibility?: string;
  userAgent?: string;
  steps?: { command: string; exitCode: number; elapsedMs: number }[];
}
declare global {
  interface Window {
    formicariumResult?: BrowserOutcome;
    formicariumDiagnostics: { stdout: string; stderr: string };
  }
}
