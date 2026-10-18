import type { FsEntry, SessionOptions } from '../types/index.js';
import { failure, invalid } from './errors.js';
import {
  type GuestBuildInfo,
  type GuestHandle,
  guestSnapshot,
} from './guest-validation.js';
import type { Reservation } from './session-port.js';
import {
  copyEntry,
  inRoots,
  normalizePath,
  normalizeRoots,
  parentPath,
  validateEntries,
} from './validation.js';

/** This is the sole owner of a session's persistent filesystem state. */
export class SessionState {
  #entries: FsEntry[];
  #seed: FsEntry[];
  #initialCwd: string;
  cwd: string;
  home: string;
  roots: readonly string[];
  #disposed = false;
  #status: 'idle' | 'active' | 'resetting' | 'disposing' | 'disposed' = 'idle';
  #epoch = 0;
  #operation = 0;
  #active: {
    reservation: Reservation;
    controller: AbortController;
    done: Promise<void>;
    resolve: () => void;
  } | null = null;
  #legacy: Reservation | undefined;
  #guests = new Map<
    string,
    { bytes: Uint8Array<ArrayBuffer>; info: GuestBuildInfo }
  >();

  constructor({
    cwd = '/work',
    home = '/root',
    entries = [],
  }: SessionOptions = {}) {
    this.cwd = normalizePath(cwd);
    this.home = normalizePath(home);
    this.roots = Object.freeze(normalizeRoots(this.cwd, this.home));
    this.#entries = validateEntries(entries, this.roots, {
      seed: true,
      directories: [this.cwd, this.home],
    });
    this.#seed = this.#entries.map(copyEntry);
    this.#initialCwd = this.cwd;
  }

  assertIdle() {
    if (this.#disposed || this.#status === 'disposing')
      throw failure('DISPOSED', 'Session has been disposed');
    if (this.#status !== 'idle')
      throw failure('BUSY', 'Session already has an active run');
  }

  reserve() {
    this.#legacy = this.acquire('run');
    return this.snapshot(this.#legacy);
  }

  acquire(kind: 'run' | 'install' | 'fs'): Reservation {
    invalid(
      ['run', 'install', 'fs'].includes(kind),
      'reservation kind invalid',
    );
    this.assertIdle();
    const controller = new AbortController();
    let resolve!: () => void;
    const done = new Promise<void>((complete) => {
      resolve = complete;
    });
    const reservation = Object.freeze({
      token: Symbol(kind),
      epoch: this.#epoch,
      operationId: `operation-${++this.#operation}`,
      signal: controller.signal,
    });
    this.#active = { reservation, controller, done, resolve };
    this.#status = 'active';
    return reservation;
  }
  assertCurrent(reservation: Reservation): void {
    if (this.#disposed || this.#status === 'disposing')
      throw failure('DISPOSED', 'Session has been disposed');
    if (
      this.#active?.reservation !== reservation ||
      reservation.epoch !== this.#epoch ||
      reservation.signal.aborted
    )
      throw failure('ABORTED', 'Reservation is no longer current');
  }
  snapshot(reservation: Reservation): FsEntry[] {
    this.assertCurrent(reservation);
    return this.#entries.map(copyEntry);
  }
  release(reservation = this.#legacy) {
    if (!reservation || this.#active?.reservation !== reservation) return;
    const active = this.#active;
    this.#active = null;
    if (this.#status === 'active') this.#status = 'idle';
    if (this.#legacy === reservation) this.#legacy = undefined;
    active.resolve();
  }
  get isDisposed() {
    return this.#disposed || this.#status === 'disposing';
  }
  beginReset(): Promise<void> {
    if (this.isDisposed) throw failure('DISPOSED', 'Session has been disposed');
    if (this.#status !== 'resetting') {
      this.#status = 'resetting';
      this.#epoch++;
      this.#guests.clear();
      this.#active?.controller.abort();
    }
    return this.#active?.done ?? Promise.resolve();
  }
  finishReset(): void {
    if (this.isDisposed) return;
    this.#entries = this.#seed.map(copyEntry);
    this.cwd = this.#initialCwd;
    this.#status = 'idle';
  }
  beginDispose(): Promise<void> {
    if (!this.isDisposed) {
      this.#status = 'disposing';
      this.#epoch++;
      this.#guests.clear();
      this.#active?.controller.abort();
    }
    return this.#active?.done ?? Promise.resolve();
  }
  commitGuest(
    reservation: Reservation,
    tool: string,
    guest: GuestHandle,
  ): void {
    this.assertCurrent(reservation);
    invalid(
      typeof tool === 'string' &&
        /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(tool) &&
        new TextEncoder().encode(tool).length <= 64,
      'guest tool name invalid',
    );
    const snapshot = guestSnapshot(guest);
    this.assertCurrent(reservation);
    this.#guests.set(tool, snapshot);
  }
  installedGuest(
    reservation: Reservation,
    tool: string,
  ): Uint8Array<ArrayBuffer> {
    this.assertCurrent(reservation);
    const guest = this.#guests.get(tool);
    if (!guest) throw failure('NOT_FOUND', 'Guest is not registered');
    return new Uint8Array(guest.bytes);
  }

  validateSnapshot(entries: unknown): FsEntry[] {
    try {
      return validateEntries(entries, this.roots);
    } catch {
      throw failure('SNAPSHOT', 'Worker snapshot is invalid');
    }
  }

  commit(entries: unknown, reservation?: Reservation) {
    if (this.#disposed) throw failure('DISPOSED', 'Session has been disposed');
    if (reservation) this.assertCurrent(reservation);
    this.#entries = this.validateSnapshot(entries);
  }

  #path(raw: string, reservation?: Reservation) {
    if (reservation) this.assertCurrent(reservation);
    else this.assertIdle();
    const path = normalizePath(raw);
    invalid(inRoots(path, this.roots), 'path lies outside persistence roots');
    let parent = parentPath(path);
    while (inRoots(parent, this.roots)) {
      const entry = this.#entries.find(
        (candidate) => candidate.path === parent,
      );
      invalid(
        !entry || entry.type === 'dir',
        'intermediate path must be a directory',
      );
      parent = parentPath(parent);
    }
    return path;
  }

  #find(path: string) {
    const entry = this.#entries.find((candidate) => candidate.path === path);
    if (!entry) throw failure('NOT_FOUND', 'Entry does not exist');
    return entry;
  }

  readFile(raw: string, reservation?: Reservation) {
    const entry = this.#find(this.#path(raw, reservation));
    if (entry.type !== 'file')
      throw failure('NOT_FILE', 'Entry is not a regular file');
    return new Uint8Array(entry.data);
  }

  listEntries(raw = this.cwd, reservation?: Reservation) {
    const path = this.#path(raw, reservation);
    if (this.#find(path).type !== 'dir') return [];
    return this.#entries
      .filter((entry) => entry.path !== path && parentPath(entry.path) === path)
      .map(copyEntry);
  }

  remove(raw: string, reservation?: Reservation) {
    const path = this.#path(raw, reservation);
    invalid(!this.roots.includes(path), 'cannot remove a persistence root');
    this.#entries = this.#entries.filter(
      (entry) => entry.path !== path && !entry.path.startsWith(`${path}/`),
    );
  }

  setCwd(raw: string, reservation?: Reservation) {
    const path = this.#path(raw, reservation);
    if (this.#find(path).type !== 'dir')
      throw failure('NOT_FILE', 'cwd must be a directory');
    this.cwd = path;
  }

  reset() {
    this.assertIdle();
    this.#guests.clear();
    this.#epoch++;
    this.finishReset();
  }

  dispose() {
    this.#disposed = true;
    this.#status = 'disposed';
    this.#epoch++;
    this.#guests.clear();
    this.#active?.controller.abort();
    this.#entries = [];
    this.#seed = [];
  }
}
