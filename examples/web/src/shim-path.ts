/**
 * Minimal path shim for browser.
 */
export function join(...args: string[]): string {
  return args.join('/').replace(/\/+/g, '/');
}

export function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i <= 0 ? '.' : path.substring(0, i);
}

export function basename(path: string, ext?: string): string {
  const i = path.lastIndexOf('/');
  const name = i < 0 ? path : path.substring(i + 1);
  if (ext && name.endsWith(ext)) {
    return name.substring(0, name.length - ext.length);
  }
  return name;
}

export const sep = '/';
