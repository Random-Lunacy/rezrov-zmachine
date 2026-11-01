/**
 * Run a callback after the current call stack unwinds. Uses setImmediate where it exists (Node) and falls
 * back to setTimeout (browsers), so the library doesn't need a polyfill for it.
 */
export function defer(callback: () => void): void {
  if (typeof setImmediate === 'function') {
    setImmediate(callback);
  } else {
    setTimeout(callback, 0);
  }
}
