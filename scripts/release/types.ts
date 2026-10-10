export interface CandidateIdentity {
  candidateId: string;
  version: string;
  sourceCommit: string;
  tarballSha256: string;
  core: { sourceCommit: string; dirty: false; buildInfoSha256: string };
  firstPartyJs: readonly { path: string; sha256: string }[];
  exclusions: readonly { path: string; reason: string }[];
}
export interface CheckEvidence {
  checkId: string;
  candidateId: string;
  tarballSha256: string;
  command: string;
  environment: string;
  status: 'passed' | 'failed' | 'unverified';
  exitCode: number | null;
  termination:
    | 'exit'
    | 'init-failure'
    | 'execution-failure'
    | 'timeout'
    | 'aborted'
    | 'not-run';
  stdoutArtifact: string | null;
  stderrArtifact: string | null;
  artifactDigests: Readonly<Record<string, string>>;
  guestBuilds: readonly {
    tool: string;
    ref: string;
    sourceCommit: string;
    sha256: string;
  }[];
  browser: string | null;
  terrarium: {
    baselineCommit: string;
    integrationCommit: string;
    diffArtifact: string;
    diffSha256: string;
    installedVersion: string;
  } | null;
  unverified: readonly string[];
}
export interface CoverageEvidence {
  candidateId: string;
  tarballSha256: string;
  inventorySha256: string;
  inventoryArtifact: string;
  binding: {
    generation: string;
    sourceIdentity: string;
    candidateSha256: string;
    executionIdentity: string;
  };
  files: readonly {
    path: string;
    totalLines: number;
    coveredLines: number;
    realms: readonly string[];
    collection: 'measured' | 'not-executed' | 'missing';
  }[];
  reportArtifact: string;
  commands: readonly string[];
}
export interface StableRcAdoption {
  rc: {
    evidenceId: string;
    evidenceSha256: string;
    candidateId: string;
    version: string;
    tarballSha256: string;
    publishedPackage: {
      version: string;
      tarballSha256: string;
      registryIntegrity: string;
    };
    requiredAcceptanceCheckIds: readonly string[];
  };
  stable: { candidateId: string; version: string; tarballSha256: string };
  diff: {
    artifact: string;
    sha256: string;
    validationCheckIds: readonly string[];
  };
  status: 'passed' | 'failed' | 'unverified';
}
export interface ReleaseEvidence {
  schemaVersion: 1;
  evidenceId: string;
  candidate: CandidateIdentity;
  checks: readonly CheckEvidence[];
  coverage: CoverageEvidence | null;
  rcAdoption?: StableRcAdoption;
}
export interface ReleaseApproval {
  approvalId: string;
  humanInput: string;
  operation:
    | 'create-public-repository'
    | 'push-public-source'
    | 'create-github-release'
    | 'publish-rc'
    | 'publish-stable';
  target: string;
  candidateId: string;
  version: string | null;
  sourceCommit: string;
  approvedAt: string;
}
export interface ReleaseDecision {
  schemaVersion: 1;
  decisionId: string;
  candidateId: string;
  approvalIds: readonly string[];
  evidenceIds: readonly string[];
  version: string;
  tag: string;
  distTag: 'next' | 'latest';
  channel: 'rc' | 'stable';
  allowed: boolean;
  missing: readonly string[];
  outcome: 'not-run' | 'blocked' | 'published' | 'failed';
}
