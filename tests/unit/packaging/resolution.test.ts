import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

describe('package.json entry points', () => {
  let consumer: string;

  // Lay out a stand-in for an installed copy: the real package.json plus empty files at every path
  // it promises, so the test checks the mapping without needing a build.
  beforeAll(() => {
    consumer = mkdtempSync(join(tmpdir(), 'rezrov-resolution-'));
    const installed = join(consumer, 'node_modules', 'rezrov-zmachine');
    mkdirSync(join(installed, 'dist'), { recursive: true });
    writeFileSync(join(installed, 'package.json'), JSON.stringify(pkg));
    for (const name of ['index', 'node']) {
      writeFileSync(join(installed, 'dist', `${name}.d.ts`), 'export {};\n');
      writeFileSync(join(installed, 'dist', `${name}.js`), 'export {};\n');
    }
    writeFileSync(join(consumer, 'index.ts'), '');
  });

  afterAll(() => rmSync(consumer, { recursive: true, force: true }));

  const resolveFrom = (specifier: string, moduleResolution: ts.ModuleResolutionKind): string | undefined => {
    const options: ts.CompilerOptions = { moduleResolution, module: ts.ModuleKind.ESNext };
    const result = ts.resolveModuleName(specifier, join(consumer, 'index.ts'), options, ts.sys);
    return result.resolvedModule?.resolvedFileName.replace(/\\/g, '/').replace(consumer.replace(/\\/g, '/'), '');
  };

  // node10 ignores `exports` and relies on `typesVersions`; bundler resolution uses `exports`.
  it.each([
    ['Node10', ts.ModuleResolutionKind.Node10],
    ['Bundler', ts.ModuleResolutionKind.Bundler],
  ])('resolves both entry points under %s resolution', (_name, kind) => {
    expect(resolveFrom('rezrov-zmachine', kind)).toBe('/node_modules/rezrov-zmachine/dist/index.d.ts');
    expect(resolveFrom('rezrov-zmachine/node', kind)).toBe('/node_modules/rezrov-zmachine/dist/node.d.ts');
  });

  it('points every export and typesVersions target at a file the build produces', () => {
    const targets = [
      pkg.main,
      pkg.types,
      ...Object.values<Record<string, string>>(pkg.exports).flatMap((conditions) => Object.values(conditions)),
      ...Object.values<Record<string, string[]>>(pkg.typesVersions).flatMap((paths) => Object.values(paths).flat()),
    ].map((target) => target.replace(/^\.\//, ''));

    // Only meaningful after `npm run build`, which CI runs first
    const built = targets.filter((target) => existsSync(join(ROOT, target)));
    if (!existsSync(join(ROOT, 'dist', 'node.js'))) {
      expect(built).toEqual([]);
      return;
    }
    expect(built).toEqual(targets);
  });
});
