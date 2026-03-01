/**
 * Stub for glob package - FileSystemProvider uses it but we use BrowserStorageProvider.
 */
export function glob(_pattern: string): Promise<string[]> {
  return Promise.resolve([]);
}
