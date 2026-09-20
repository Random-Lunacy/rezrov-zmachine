import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StdioScreen } from '../../../examples/console/StdioScreen';
import { Color, Logger, TextStyle, type ZMachine } from '../../../src/index';
import { SGR, wrap } from './ansi';

Logger.setLogToConsole(false);

/**
 * StdioScreen's constructor has no side effects, so these tests touch no I/O at
 * all. Colour output relies on FORCE_COLOR=1 (set in vitest.config.ts) making
 * chalk emit level-1 escapes despite the non-TTY stdout.
 */

/** Colours need V5+: BaseScreen.setTextColors is a no-op below that. */
function makeMachine(version = 5): ZMachine {
  return {
    logger: new Logger('TestMachine'),
    state: { version },
    memory: { getByte: vi.fn(() => 8) },
  } as unknown as ZMachine;
}

/** Reach a private method without exporting it just for tests. */
function invoke<T>(screen: StdioScreen, method: string, ...args: unknown[]): T {
  return (screen as unknown as Record<string, (...a: unknown[]) => T>)[method](...args);
}

describe('StdioScreen (pure)', () => {
  let screen: StdioScreen;
  let machine: ZMachine;

  beforeEach(() => {
    screen = new StdioScreen();
    machine = makeMachine();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('chalk is actually emitting colour', () => {
    it('should produce level-1 escapes, proving FORCE_COLOR reached the worker', () => {
      screen.setTextColors(machine, 0, Color.Red, Color.Default);

      // If this fails, every other colour assertion in this file is vacuous.
      expect(screen.applyColors('x')).toContain('\x1b[');
    });
  });

  describe('getCapabilities', () => {
    it('should report terminal capabilities without pictures or sound', () => {
      const caps = screen.getCapabilities();

      expect(caps.hasColors).toBe(true);
      expect(caps.hasSplitWindow).toBe(true);
      expect(caps.hasPictures).toBe(false);
      expect(caps.hasSound).toBe(false);
    });

    it('should echo the interpreter number it was constructed with', () => {
      expect(new StdioScreen(4).getCapabilities().interpreterNumber).toBe(4);
    });

    it('should leave the interpreter number undefined when not supplied', () => {
      expect(screen.getCapabilities().interpreterNumber).toBeUndefined();
    });
  });

  describe('getSize', () => {
    // `rows`/`columns` are absent entirely on a non-TTY stdout — which is how
    // Vitest runs — so there is no getter to spy on. Define them, then restore.
    function withStdoutSize(rows: unknown, cols: unknown, assert: () => void): void {
      const had = { rows: 'rows' in process.stdout, columns: 'columns' in process.stdout };
      const prev = { rows: process.stdout.rows, columns: process.stdout.columns };
      Object.defineProperty(process.stdout, 'rows', { value: rows, configurable: true, writable: true });
      Object.defineProperty(process.stdout, 'columns', { value: cols, configurable: true, writable: true });
      try {
        assert();
      } finally {
        for (const key of ['rows', 'columns'] as const) {
          if (had[key]) {
            Object.defineProperty(process.stdout, key, { value: prev[key], configurable: true, writable: true });
          } else {
            delete (process.stdout as unknown as Record<string, unknown>)[key];
          }
        }
      }
    }

    it('should use the live terminal dimensions when reported', () => {
      withStdoutSize(40, 132, () => {
        expect(screen.getSize()).toEqual({ rows: 40, cols: 132 });
      });
    });

    it('should fall back to 25x80 when stdout reports nothing', () => {
      withStdoutSize(undefined, undefined, () => {
        expect(screen.getSize()).toEqual({ rows: 25, cols: 80 });
      });
    });

    it('should treat a zero row count as absent', () => {
      withStdoutSize(0, 0, () => {
        expect(screen.getSize()).toEqual({ rows: 25, cols: 80 });
      });
    });
  });

  describe('applyColors', () => {
    it('should leave text uncoloured before the game sets any colour', () => {
      expect(screen.applyColors('x')).toBe('x');
    });

    it.each([
      [Color.Black, 'black'],
      [Color.Red, 'red'],
      [Color.Green, 'green'],
      [Color.Yellow, 'yellow'],
      [Color.Blue, 'blue'],
      [Color.Magenta, 'magenta'],
      [Color.Cyan, 'cyan'],
      [Color.White, 'white'],
      [Color.Gray, 'gray'],
    ] as const)('should map foreground colour %i', (color, sgr) => {
      screen.setTextColors(machine, 0, color, Color.Default);

      expect(screen.applyColors('x')).toBe(wrap('x', sgr));
    });

    it.each([
      [Color.Black, 'bgBlack'],
      [Color.Red, 'bgRed'],
      [Color.Green, 'bgGreen'],
      [Color.Yellow, 'bgYellow'],
      [Color.Blue, 'bgBlue'],
      [Color.Magenta, 'bgMagenta'],
      [Color.Cyan, 'bgCyan'],
      [Color.White, 'bgWhite'],
      [Color.Gray, 'bgBlackBright'],
    ] as const)('should map background colour %i', (color, sgr) => {
      screen.setTextColors(machine, 0, Color.Default, color);

      expect(screen.applyColors('x')).toBe(wrap('x', sgr));
    });

    it('should render Gray as bright-black, not as a true grey', () => {
      screen.setTextColors(machine, 0, Color.Gray, Color.Default);

      expect(screen.applyColors('x')).toBe(`${SGR.gray[0]}x${SGR.gray[1]}`);
    });

    it('should apply the background first so the foreground nests outside it', () => {
      screen.setTextColors(machine, 0, Color.Red, Color.Blue);

      expect(screen.applyColors('x')).toBe(wrap('x', 'bgBlue', 'red'));
    });

    it('should skip the background when it is Default', () => {
      screen.setTextColors(machine, 0, Color.Red, Color.Default);

      expect(screen.applyColors('x')).toBe(wrap('x', 'red'));
    });

    it('should skip the foreground when it is Default', () => {
      screen.setTextColors(machine, 0, Color.Default, Color.Blue);

      expect(screen.applyColors('x')).toBe(wrap('x', 'bgBlue'));
    });

    it('should fall back to white for an extended V5/V6 colour', () => {
      screen.setTextColors(machine, 0, 205, Color.Default);

      expect(screen.applyColors('x')).toBe(wrap('x', 'white'));
    });

    it('should fall back to white-on-background for an extended background colour', () => {
      screen.setTextColors(machine, 0, Color.Default, 205);

      expect(screen.applyColors('x')).toBe(wrap('x', 'bgWhite'));
    });

    it('should only colour the window currently selected for output', () => {
      screen.setTextColors(machine, 1, Color.Red, Color.Default);

      expect(screen.applyColors('x')).toBe('x');
    });
  });

  describe('applyStyles', () => {
    it('should return the text unchanged when no style is set', () => {
      expect(screen.applyStyles('x')).toBe('x');
    });

    it('should render bold', () => {
      screen.setTextStyle(machine, TextStyle.Bold);

      expect(screen.applyStyles('x')).toBe(wrap('x', 'bold'));
    });

    it('should render italic', () => {
      screen.setTextStyle(machine, TextStyle.Italic);

      expect(screen.applyStyles('x')).toBe(wrap('x', 'italic'));
    });

    it('should render reverse video', () => {
      screen.setTextStyle(machine, TextStyle.ReverseVideo);

      expect(screen.applyStyles('x')).toBe(wrap('x', 'inverse'));
    });

    it('should nest combined styles inverse-then-bold-then-italic', () => {
      screen.setTextStyle(machine, TextStyle.ReverseVideo | TextStyle.Bold | TextStyle.Italic);

      expect(screen.applyStyles('x')).toBe(wrap('x', 'inverse', 'bold', 'italic'));
    });

    it('should drop styling when reset to Roman', () => {
      screen.setTextStyle(machine, TextStyle.Bold);
      screen.setTextStyle(machine, TextStyle.Roman);

      expect(screen.applyStyles('x')).toBe('x');
    });
  });

  describe('applyChalkStyle', () => {
    it('should be a no-op for style zero', () => {
      expect(invoke<string>(screen, 'applyChalkStyle', 'x', 0)).toBe('x');
    });

    it('should use the same nesting order as applyStyles', () => {
      const style = TextStyle.ReverseVideo | TextStyle.Bold | TextStyle.Italic;

      expect(invoke<string>(screen, 'applyChalkStyle', 'x', style)).toBe(wrap('x', 'inverse', 'bold', 'italic'));
    });
  });

  describe('applyChalkColors', () => {
    it('should resolve a Default foreground to white', () => {
      const out = invoke<string>(screen, 'applyChalkColors', 'x', {
        foreground: Color.Default,
        background: Color.Current,
      });

      expect(out).toBe(wrap('x', 'white'));
    });

    it('should resolve a Default background to black', () => {
      const out = invoke<string>(screen, 'applyChalkColors', 'x', {
        foreground: Color.Current,
        background: Color.Default,
      });

      expect(out).toBe(wrap('x', 'bgBlack'));
    });

    it('should skip a Current foreground and background entirely', () => {
      const out = invoke<string>(screen, 'applyChalkColors', 'x', {
        foreground: Color.Current,
        background: Color.Current,
      });

      expect(out).toBe('x');
    });

    it('should apply background before foreground', () => {
      const out = invoke<string>(screen, 'applyChalkColors', 'x', {
        foreground: Color.Red,
        background: Color.Blue,
      });

      expect(out).toBe(wrap('x', 'bgBlue', 'red'));
    });

    it('should leave an unknown extended colour unstyled', () => {
      // Note the asymmetry with applyColors, which maps unknown colours to
      // white. The upper and lower windows therefore render colour 205
      // differently — pinned here deliberately; see the PR description.
      const out = invoke<string>(screen, 'applyChalkColors', 'x', {
        foreground: 205,
        background: Color.Current,
      });

      expect(out).toBe('x');
    });
  });
});
