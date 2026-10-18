import {
  type AcquiredTool,
  officialBuildInfo,
  PROVENANCE_NOTE,
} from '../../scripts/acquire.ts';
import { canonicalSha256 } from '../../scripts/build-key.ts';
import type { Resolutions, ToolResolution } from '../../scripts/resolve.ts';
import { staticElf } from './elf.ts';
import { commit, sha } from './github.ts';
import { tgz } from './tar.ts';

export interface RecordFixture {
  record: AcquiredTool;
  download: Uint8Array;
  elf: Uint8Array;
  resolution: ToolResolution;
}

/** An acquired official-asset record shaped exactly like acquire.ts writes it. */
export function officialRecord(
  tool: string,
  version: string,
  format: 'elf' | 'tar.gz' = 'elf',
  marker = 1,
): RecordFixture {
  const elf = staticElf(128 + marker, marker);
  const download =
    format === 'elf' ? elf : tgz([{ name: tool, body: elf, mode: 0o755 }]);
  const name =
    format === 'elf' ? `${tool}-linux-x64-musl` : `${tool}-v${version}.tar.gz`;
  const repository = `https://github.com/example/${tool}`;
  const resolution: ToolResolution = {
    tool,
    repository,
    tag: `v${version}`,
    version,
    commit: commit(tool),
    asset: {
      name,
      url: `${repository}/releases/download/v${version}/${name}`,
      sha256: sha(download),
      size: download.length,
    },
    attestation: 'absent',
    license: {
      path: 'LICENSE',
      file: `${tool}-LICENSE`,
      sha256: sha('MIT\n'),
      spdx: 'MIT',
    },
  };
  const buildInfo = officialBuildInfo(resolution, 'b'.repeat(64), sha(elf));
  const record: AcquiredTool = {
    tool,
    version,
    format,
    ...(format === 'tar.gz' ? { archiveEntry: tool } : {}),
    downloadFile: name,
    downloadSha256: sha(download),
    downloadBytes: download.length,
    elfSha256: sha(elf),
    elfBytes: elf.length,
    buildInfo,
    buildInfoSha256: canonicalSha256(buildInfo),
    provenance: {
      kind: 'release-asset',
      assetUrl: resolution.asset!.url,
      finalUrl: 'https://objects.example/blob',
      downloadSha256: sha(download),
      attestation: 'absent',
      note: PROVENANCE_NOTE,
      reusedFromRun: null,
    },
    timing: { fetchMs: 5 },
  };
  return { record, download, elf, resolution };
}

export const resolutionsOf = (
  fixtures: readonly RecordFixture[],
): Resolutions => ({
  schemaVersion: 1,
  resolvedAt: '2026-10-18T00:00:00.000Z',
  tools: fixtures.map((fixture) => fixture.resolution),
});
