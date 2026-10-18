/** C11 TransferPolicy. These values are contract inputs and are never relaxed. */
export const TRANSFER_POLICY = Object.freeze({
  fetchDeadlineMs: 120000,
  installDeadlineMs: 180000,
  maxDownloadBytes: 134217728,
  maxExpandedBytes: 268435456,
  maxElfBytes: 134217728,
  maxArchiveEntries: 4096,
  maxMetadataBytes: 1048576,
  maxCatalogBytes: 4194304,
  maxCommandBytes: 65536,
  maxPathBytes: 4096,
  buildDeadlineMs: 14400000,
});
export const MAX_REDIRECTS = 5;

/**
 * The showcase job timeout for source builds (180 min) is shorter than the C11
 * 4 h build limit, so the in-process deadline leaves 15 min for process-group
 * termination and staging removal before the job itself is cut.
 */
export const SOURCE_BUILD_DEADLINE_MS = 165 * 60 * 1000;
export const BUILD_KILL_GRACE_MS = 10000;

/** Finite bounds for an upstream source tarball (codeload) used by a build. */
export const SOURCE_ARCHIVE_LIMITS = Object.freeze({
  maxDownloadBytes: 268435456,
  maxExpandedBytes: 1073741824,
  maxArchiveEntries: 65536,
  maxPathBytes: 4096,
});

/** Bounds for a reused candidate artifact (Actions zip) and GitHub API bodies. */
export const ARTIFACT_LIMITS = Object.freeze({
  maxDownloadBytes: 536870912,
  maxExpandedBytes: 1073741824,
  maxArchiveEntries: 4096,
  maxPathBytes: 4096,
});
export const MAX_API_BODY_BYTES = 8388608;

export interface ArchiveLimits {
  maxExpandedBytes: number;
  maxArchiveEntries: number;
  maxPathBytes: number;
}
export const ASSET_ARCHIVE_LIMITS: ArchiveLimits = Object.freeze({
  maxExpandedBytes: TRANSFER_POLICY.maxExpandedBytes,
  maxArchiveEntries: TRANSFER_POLICY.maxArchiveEntries,
  maxPathBytes: TRANSFER_POLICY.maxPathBytes,
});
