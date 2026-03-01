/**
 * Minimal fs shim for browser - used by rezrov-zmachine.
 */
export function readFileSync(_path: string): Buffer {
  throw new Error('fs.readFileSync is not available in browser. Load story from Buffer instead.');
}

export function appendFileSync(_path: string, _data: string, _encoding?: string): void {
  // No-op in browser
}
