import type { FileCoverageData } from 'istanbul-lib-coverage';
export interface DigestRow {
  path: string;
  sourceSha256: string;
  statementMapSha256: string;
  instrumentedSha256?: string;
  compiledSha256?: string;
  original?: string;
}
export interface CoverageInventory {
  files: readonly string[];
  metadata: FileCoverageData[];
  digests: DigestRow[];
  generation?: string;
  sourceIdentity?: string;
  tarballSha256?: string;
  candidate?: {
    sha256: string;
    root?: string;
    path?: string;
    files?: { path: string; size: number; sha256: string }[];
  };
  exclusions?: Record<string, string>;
}
export interface Measurement {
  executionIdentity?: string;
  generation?: string;
  sourceIdentity?: string;
  candidateSha256?: string;
  realm: string;
  testFile?: string;
  exitCode?: number | null;
  project?: string;
  title?: string;
  status?: string;
  expectedStatus?: string;
  actualSite?: string;
  attempt?: string;
  coverage: Record<string, FileCoverageData>;
}
export interface Component {
  kind: string;
  coverage: Record<string, FileCoverageData>;
}
export interface ComponentReport {
  candidateSha256: string;
  threshold: number;
  passed: boolean;
  realmNames: string[];
  digests: DigestRow[];
  files: { path: string; lines: Record<string, number> }[];
}
export interface CounterRow {
  path: string;
  registeredOffset: number;
  offset: number;
  keys: string[];
}
export interface Realm {
  name: string;
  buffer: ArrayBufferLike;
}
