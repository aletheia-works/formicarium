export interface BrowserOutcome {
  isolated?: boolean;
  error?: string;
  /** The Worker's original error chain, when the run failed there. */
  cause?: string;
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
