import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../../src');

const STATIC_IMPORT = /^\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm;
const SIDE_EFFECT_IMPORT = /^\s*import\s+['"]([^'"]+)['"]/gm;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const REQUIRE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Every module specifier a source file imports: static, side-effect, dynamic, require() and `import x = require()`. */
export function moduleSpecifiers(source: string): string[] {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return [STATIC_IMPORT, SIDE_EFFECT_IMPORT, DYNAMIC_IMPORT, REQUIRE].flatMap((pattern) =>
    [...stripped.matchAll(pattern)].map((match) => match[1])
  );
}

const STRIP_COMMENTS = [/\/\*[\s\S]*?\*\//g, /(?<![:'"\w])\/\/.*$/gm];
const STRIP_STRINGS = [/'(?:[^'\\\n]|\\.)*'/g, /"(?:[^"\\\n]|\\.)*"/g];

/**
 * Uses of Node-only globals in code (comments and string literals are ignored): Buffer, setImmediate,
 * __dirname, __filename and require(), plus the `process` global when it isn't behind a `typeof process` check.
 */
export function nodeGlobalUses(source: string): string[] {
  const withoutComments = STRIP_COMMENTS.reduce((text, pattern) => text.replace(pattern, ''), source);
  return withoutComments
    .split('\n')
    .filter((line) => {
      const code = STRIP_STRINGS.reduce((text, pattern) => text.replace(pattern, "''"), line);
      return (
        /\b(Buffer|setImmediate|__dirname|__filename)\b|\brequire\s*\(/.test(code) ||
        // The guard itself names 'undefined' in a string, so check it on the original line
        (/\bprocess\b/.test(code) && !/typeof process !== 'undefined'/.test(line))
      );
    })
    .map((line) => line.trim());
}

function resolveRelative(from: string, specifier: string): string {
  const base = resolve(dirname(from), specifier);
  for (const candidate of [`${base}.ts`, resolve(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`${from} imports '${specifier}', which isn't a .ts source file under src/`);
}

interface Graph {
  files: string[];
  external: string[];
}

/** Walks the import graph from `entry`, collecting the source files reached and the bare specifiers they import. */
function importGraph(entry: string): Graph {
  const seen = new Set<string>();
  const external = new Set<string>();
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const specifier of moduleSpecifiers(readFileSync(file, 'utf8'))) {
      if (specifier.startsWith('.')) {
        visit(resolveRelative(file, specifier));
      } else {
        external.add(specifier);
      }
    }
  };
  visit(entry);
  return { files: [...seen], external: [...external] };
}

describe('module scanning', () => {
  it('finds every import form', () => {
    const source = `
      import a from 'static-default';
      import { b,
        c } from 'static-multiline';
      import type { T } from 'type-only';
      export { d } from 're-export';
      export * from 'star-export';
      import 'side-effect';
      const e = await import('dynamic');
      const f = require('cjs');
      import g = require('import-equals');
      // import h from 'commented-out';
      /* import i from 'block-commented'; */
    `;

    expect(moduleSpecifiers(source).sort()).toEqual(
      [
        'cjs',
        'dynamic',
        'import-equals',
        're-export',
        'side-effect',
        'star-export',
        'static-default',
        'static-multiline',
        'type-only',
      ].sort()
    );
  });

  it('finds Node-only globals, ignoring comments and string literals', () => {
    const source = `
      const guarded = typeof process !== 'undefined' && !!process.stdout?.isTTY;
      const unguarded = process.stdout.isTTY;
      const bytes = Buffer.from(data);
      setImmediate(callback);
      const type = 'Buffer'; // Buffer and process.exit() in a comment are ignored
      const dir = __dirname;
    `;

    expect(nodeGlobalUses(source)).toEqual([
      'const unguarded = process.stdout.isTTY;',
      'const bytes = Buffer.from(data);',
      'setImmediate(callback);',
      'const dir = __dirname;',
    ]);
  });
});

describe('package entry points', () => {
  const main = importGraph(resolve(SRC, 'index.ts'));

  it('keeps the main entry free of Node built-ins, so browser bundlers need no shims', () => {
    // seedrandom is the only runtime dependency the main entry may pull in
    expect(main.external).toEqual(['seedrandom']);
  });

  it('uses no Node-only globals (Buffer, setImmediate, unguarded process) in the main entry', () => {
    // src/utils/defer.ts is where setImmediate is allowed: it checks for it and falls back to setTimeout
    const files = main.files.filter((file) => !file.endsWith('utils/defer.ts'));
    const uses = files.flatMap((file) => nodeGlobalUses(readFileSync(file, 'utf8')).map((line) => `${file}: ${line}`));

    expect(uses).toEqual([]);
  });

  it('puts the file system code behind the node entry', () => {
    const node = importGraph(resolve(SRC, 'node.ts'));

    expect(node.external).toContain('fs');
    expect(node.external).toContain('glob');
  });
});
