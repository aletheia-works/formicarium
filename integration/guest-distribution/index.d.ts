export type FsEntry =
  | { path: string; type: 'dir'; mode: number }
  | {
      path: string;
      type: 'file';
      mode: number;
      inodeId: string;
      data: Uint8Array;
    }
  | { path: string; type: 'symlink'; target: string };
export interface GuestSelection {
  tool: 'aube' | 'pitchfork';
  ref?: string;
  fixture?: string;
  base: string;
}
export interface GuestBuild {
  schemaVersion: 1;
  tool: 'aube' | 'pitchfork';
  ref: string;
  source: { url: string; ref: string; commit: string };
  guest: { url: string; sha256: string; format: 'static-musl-x86_64' };
  fixtures: Record<string, { url: string; sha256: string }>;
  buildInfo: { url: string; sha256: string };
  built_at: string;
}
export interface SelectedGuest {
  build: GuestBuild;
  guest: Uint8Array;
  entries: readonly FsEntry[];
  cwd: string;
}
export declare function resolveGuest(
  input: GuestSelection,
): Promise<SelectedGuest>;
