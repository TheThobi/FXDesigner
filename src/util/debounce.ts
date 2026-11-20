export function debounce<A extends unknown[]>(fn: (...args: A) => void, delayMs: number) {
  let handle: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: A) => {
    if (handle !== undefined) clearTimeout(handle);
    handle = setTimeout(() => {
      handle = undefined;
      fn(...args);
    }, delayMs);
  };
  debounced.flush = (...args: A) => {
    if (handle !== undefined) clearTimeout(handle);
    handle = undefined;
    fn(...args);
  };
  return debounced;
}
