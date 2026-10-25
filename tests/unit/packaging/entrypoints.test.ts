import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../../src');

/** Bare (non-relative) module specifiers reachable from `entry` through static relative imports. */
function externalImports(entry: string): Set<string> {
  const seen = new Set<string>();
  const external = new Set<string>();
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(
      /^\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm
    )) {
      const specifier = match[1] ?? match[2];
      if (!specifier.startsWith('.')) {
        external.add(specifier);
        continue;
      }
      const base = resolve(dirname(file), specifier);
      visit(existsSync(`${base}.ts`) ? `${base}.ts` : resolve(base, 'index.ts'));
    }
  };
  visit(entry);
  return external;
}

describe('package entry points', () => {
  it('keeps the main entry free of Node built-ins, so browser bundlers need no shims', () => {
    const external = [...externalImports(resolve(SRC, 'index.ts'))];

    expect(external.filter((specifier) => specifier.startsWith('node:') || specifier === 'fs')).toEqual([]);
    expect(external).not.toContain('path');
    expect(external).not.toContain('glob');
    expect(external).not.toContain('fs/promises');
    // The only runtime dependency the main entry may pull in
    expect(external).toEqual(['seedrandom']);
  });

  it('puts the file system code behind the node entry', () => {
    const external = externalImports(resolve(SRC, 'node.ts'));

    expect(external).toContain('fs');
    expect(external).toContain('glob');
  });
});
