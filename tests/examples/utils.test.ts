import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * examples/console/utils.ts and examples/blessedConsole/utils.ts are duplicates
 * that differ only by a `@ts-expect-error` comment. Rather than extract a shared
 * module — which would break each example's `rootDir: "./"` under tsc, and
 * re-couple two deliberately standalone packages — run one suite against both
 * and pin the duplication with a sync assertion.
 */

const ROOT = join(__dirname, '../..');
const CONSOLE_UTILS = join(ROOT, 'examples/console/utils.ts');
const BLESSED_UTILS = join(ROOT, 'examples/blessedConsole/utils.ts');

const modules = [
  ['console', () => import('../../examples/console/utils')],
  ['blessedConsole', () => import('../../examples/blessedConsole/utils')],
] as const;

describe('example argument parsing', () => {
  it('should keep the two utils.ts copies identical apart from the ts-expect-error line', async () => {
    const [consoleSrc, blessedSrc] = await Promise.all([
      readFile(CONSOLE_UTILS, 'utf8'),
      readFile(BLESSED_UTILS, 'utf8'),
    ]);

    expect(blessedSrc.replace(/^\/\/ @ts-expect-error.*\r?\n/, '')).toBe(consoleSrc);
  });

  describe.each(modules)('%s/utils.ts', (_name, load) => {
    let originalArgv: string[];
    let exitSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    /** nopt reads process.argv directly; parseArguments takes no argv parameter. */
    function withArgs(...args: string[]): void {
      process.argv = ['/usr/bin/node', '/app/index.ts', ...args];
    }

    beforeEach(() => {
      originalArgv = process.argv;
      exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      process.argv = originalArgv;
      vi.restoreAllMocks();
    });

    describe('INTERPRETER_NAMES', () => {
      it('should map all eleven Infocom interpreter names to their header values', async () => {
        const { INTERPRETER_NAMES } = await load();

        expect(INTERPRETER_NAMES).toEqual({
          dec20: 1,
          'apple-iie': 2,
          mac: 3,
          amiga: 4,
          atari: 5,
          ibm: 6,
          c128: 7,
          c64: 8,
          'apple-iic': 9,
          'apple-iigs': 10,
          tandy: 11,
        });
      });
    });

    describe('defaults', () => {
      it('should report every flag as false with no arguments', async () => {
        withArgs();
        const { parseArguments } = await load();

        expect(parseArguments()).toEqual({
          debug: false,
          noExec: false,
          header: false,
          objectTree: false,
          dict: false,
          interpreter: null,
          argv: { remain: [] },
        });
      });

      it('should always expose argv.remain as an array', async () => {
        withArgs('--debug');
        const { parseArguments } = await load();

        expect(Array.isArray(parseArguments().argv.remain)).toBe(true);
      });

      it('should collect a positional story file into argv.remain', async () => {
        withArgs('story.z3');
        const { parseArguments } = await load();

        expect(parseArguments().argv.remain).toEqual(['story.z3']);
      });
    });

    describe('flags', () => {
      it.each([
        ['--debug', 'debug'],
        ['--noExec', 'noExec'],
        ['--header', 'header'],
        ['--objectTree', 'objectTree'],
        ['--dict', 'dict'],
      ] as const)('should set %s', async (flag, key) => {
        withArgs(flag);
        const { parseArguments } = await load();

        expect(parseArguments()[key]).toBe(true);
      });

      it.each([
        ['-d', 'debug'],
        ['-n', 'noExec'],
        ['-h', 'header'],
        ['-o', 'objectTree'],
        ['-t', 'dict'],
      ] as const)('should expand the %s shorthand', async (flag, key) => {
        withArgs(flag);
        const { parseArguments } = await load();

        expect(parseArguments()[key]).toBe(true);
      });

      it('should expand the nested dump shorthand to four flags', async () => {
        withArgs('--dump', 'story.z3');
        const { parseArguments } = await load();
        const parsed = parseArguments();

        // `dump` expands to ['--header', '--objectTree', '--dict', '-n'] — note
        // the nested '-n', which is itself a shorthand.
        expect(parsed.header).toBe(true);
        expect(parsed.objectTree).toBe(true);
        expect(parsed.dict).toBe(true);
        expect(parsed.noExec).toBe(true);
        expect(parsed.debug).toBe(false);
      });

      it('should return real booleans, not truthy parser values', async () => {
        withArgs('--debug');
        const { parseArguments } = await load();
        const parsed = parseArguments();

        expect(parsed.debug).toBe(true);
        expect(parsed.noExec).toBe(false);
      });
    });

    describe('interpreter selection', () => {
      it('should accept a valid interpreter name', async () => {
        withArgs('--interpreter', 'amiga');
        const { parseArguments } = await load();

        expect(parseArguments().interpreter).toBe('amiga');
      });

      it('should lowercase the interpreter name', async () => {
        withArgs('--interpreter', 'AmIgA');
        const { parseArguments } = await load();

        expect(parseArguments().interpreter).toBe('amiga');
      });

      it('should expand the -i shorthand', async () => {
        withArgs('-i', 'c64');
        const { parseArguments } = await load();

        expect(parseArguments().interpreter).toBe('c64');
      });

      it('should exit with an error for an unknown interpreter', async () => {
        withArgs('--interpreter', 'commodore-pet');
        const { parseArguments } = await load();

        parseArguments();

        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('commodore-pet'));
        expect(exitSpy).toHaveBeenCalledWith(1);
      });

      it('should list the valid names in the error message', async () => {
        withArgs('--interpreter', 'bogus');
        const { parseArguments } = await load();

        parseArguments();

        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('tandy'));
      });
    });
  });
});
