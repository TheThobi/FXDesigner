/**
 * Snapshot-based undo/redo. Rapid successive changes (e.g. dragging a slider) are coalesced
 * into one entry when they happen within `coalesceMs` of each other.
 */
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  private lastRecord = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly limit = 200,
    private readonly coalesceMs = 600,
  ) {}

  /** Call *before* applying a change, with the state as it was. */
  record(before: T, now: number = Date.now()): void {
    if (now - this.lastRecord > this.coalesceMs) {
      this.past.push(before);
      if (this.past.length > this.limit) this.past.shift();
    }
    this.future = [];
    this.lastRecord = now;
  }

  undo(current: T): T | undefined {
    const previous = this.past.pop();
    if (previous === undefined) return undefined;
    this.future.push(current);
    this.lastRecord = Number.NEGATIVE_INFINITY;
    return previous;
  }

  redo(current: T): T | undefined {
    const next = this.future.pop();
    if (next === undefined) return undefined;
    this.past.push(current);
    this.lastRecord = Number.NEGATIVE_INFINITY;
    return next;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}
