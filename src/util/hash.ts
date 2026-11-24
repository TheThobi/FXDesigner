/** FNV-1a 32-bit hash of `text`, hex, followed by its length (cheap content fingerprint). */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0') + text.length.toString(16);
}
