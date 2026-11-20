import { decodeDocumentFromUrl, encodeDocumentForUrl, type TextureDocument } from './document';

const SESSION_KEY = 'ptm.session.v1';
const HASH_PREFIX = '#doc=';

/** Last edited document (autosave). Returns raw JSON to be validated by parseDocument. */
export function loadSession(): unknown {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function saveSession(doc: TextureDocument): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(doc));
  } catch {
    // Storage full or disabled (private mode): autosave is best-effort.
  }
}

/** Raw document embedded in the URL hash, if any (throws DocumentError when corrupted). */
export function readHashDocument(): unknown {
  const hash = window.location.hash;
  if (!hash.startsWith(HASH_PREFIX)) return null;
  return decodeDocumentFromUrl(hash.slice(HASH_PREFIX.length));
}

export function clearHash(): void {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

export function shareUrl(doc: TextureDocument): string {
  const url = new URL(window.location.href);
  url.hash = HASH_PREFIX.slice(1) + encodeDocumentForUrl(doc);
  return url.toString();
}
