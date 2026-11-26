/** localStorage access that never throws (private mode, disabled storage, quota). */
export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Called when a write fails (usually: the browser storage of the site is full). The app
 * warns the user: without it, saves would fail silently.
 */
let failureListener: ((key: string) => void) | null = null;

export function onStorageFailure(listener: ((key: string) => void) | null): void {
  failureListener = listener;
}

/** Writes `value`; false (and the failure listener called) when the browser refused. */
export function writeStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    failureListener?.(key);
    return false;
  }
}
