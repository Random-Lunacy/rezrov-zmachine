/**
 * Minimal fs/promises shim for browser - FileSystemProvider uses these but we use BrowserStorageProvider.
 */
async function notAvailable(_args: unknown): Promise<never> {
  throw new Error('fs.promises is not available in browser.');
}

export default {
  readFile: notAvailable,
  writeFile: notAvailable,
  readdir: notAvailable,
  unlink: notAvailable,
  access: notAvailable,
  stat: notAvailable,
  mkdir: notAvailable,
};
