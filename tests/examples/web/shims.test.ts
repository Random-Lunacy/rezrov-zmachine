import { describe, expect, it } from 'vitest';
import { appendFileSync, readFileSync } from '../../../examples/web/src/shim-fs';
import fsPromises from '../../../examples/web/src/shim-fs-promises';
import { glob } from '../../../examples/web/src/shim-glob';
import { basename, dirname, join, sep } from '../../../examples/web/src/shim-path';

describe('web example browser shims', () => {
  describe('shim-path', () => {
    it('should join segments with a single separator', () => {
      expect(join('a', 'b', 'c')).toBe('a/b/c');
    });

    it('should collapse repeated separators introduced by the join', () => {
      expect(join('saves/', '/game.dat')).toBe('saves/game.dat');
    });

    it('should return a single segment unchanged', () => {
      expect(join('story.z6')).toBe('story.z6');
    });

    it('should return the parent directory', () => {
      expect(dirname('saves/slot1/game.dat')).toBe('saves/slot1');
    });

    it("should return '.' for a bare filename", () => {
      expect(dirname('game.dat')).toBe('.');
    });

    it("should return '.' for a root-level path, since there is no parent segment", () => {
      expect(dirname('/game.dat')).toBe('.');
    });

    it('should return the final segment', () => {
      expect(basename('saves/slot1/game.dat')).toBe('game.dat');
    });

    it('should strip a matching extension', () => {
      expect(basename('saves/game.dat', '.dat')).toBe('game');
    });

    it('should leave the name intact when the extension does not match', () => {
      expect(basename('saves/game.dat', '.sav')).toBe('game.dat');
    });

    it('should expose a posix separator', () => {
      expect(sep).toBe('/');
    });
  });

  describe('shim-fs', () => {
    it('should throw a browser-specific message from readFileSync', () => {
      expect(() => readFileSync('story.z6')).toThrow(/not available in browser/);
    });

    it('should no-op appendFileSync so library logging does not break the page', () => {
      expect(() => appendFileSync('debug.log', 'entry')).not.toThrow();
    });
  });

  describe('shim-glob', () => {
    it('should resolve to no matches, since saves live in localStorage', async () => {
      await expect(glob('saves/*.dat')).resolves.toEqual([]);
    });
  });

  describe('shim-fs-promises', () => {
    it.each(['readFile', 'writeFile', 'readdir', 'unlink', 'access', 'stat', 'mkdir'] as const)(
      'should reject from %s rather than silently resolving',
      async (method) => {
        await expect(fsPromises[method]('anything')).rejects.toThrow(/not available in browser/);
      }
    );
  });
});
