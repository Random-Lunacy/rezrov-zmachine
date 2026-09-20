import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StdioScreen } from '../../../examples/console/StdioScreen';
import { Color, Logger, TextStyle, type ZMachine } from '../../../src/index';
import { wrap } from './ansi';

Logger.setLogToConsole(false);

/**
 * StdioScreen talks to the terminal exclusively through process.stdout, so the
 * ANSI it emits is fully observable from a write spy. Screen geometry is pinned
 * to 25x80 (stdout reports no size under Vitest, and getSize falls back to
 * exactly that), which keeps every escape sequence below deterministic.
 */

const ROWS = 25;
const COLS = 80;

function makeMachine(version = 5): ZMachine {
  return {
    logger: new Logger('TestMachine'),
    state: { version },
    memory: { getByte: vi.fn(() => 8) },
  } as unknown as ZMachine;
}

describe('StdioScreen (terminal output)', () => {
  let screen: StdioScreen;
  let machine: ZMachine;
  let writes: string[];

  function out(): string {
    return writes.join('');
  }

  /**
   * StdioScreen bottom-aligns its first lower-window output, emitting a
   * one-time `ESC[<rows-1>;1H` before the text. Strip it so colour/style
   * assertions read cleanly; the behaviour itself is covered separately.
   */
  function body(): string {
    return out().replace(/^\x1b\[\d+;1H/, '');
  }

  beforeEach(() => {
    writes = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write);
    screen = new StdioScreen();
    machine = makeMachine();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('print to the lower window', () => {
    it('should write the text to stdout', () => {
      screen.print(machine, 'West of House');

      expect(out()).toContain('West of House');
    });

    it('should emit no styling for unstyled default-coloured text', () => {
      screen.print(machine, 'plain');

      expect(body()).toBe('plain');
    });

    it('should bottom-align the first lower-window output', () => {
      screen.print(machine, 'first');

      // rows(25) - 1, so the opening text sits on the last usable line.
      expect(out().startsWith(`\x1b[${ROWS - 1};1H`)).toBe(true);
    });

    it('should bottom-align only once', () => {
      screen.print(machine, 'first');
      writes = [];

      screen.print(machine, 'second');

      expect(out()).toBe('second');
    });

    it('should drop output while the screen stream is disabled', () => {
      screen.disableOutputStream(machine, 1, 0, 0);

      screen.print(machine, 'invisible');

      expect(out()).toBe('');
    });

    it('should resume once the screen stream is re-enabled', () => {
      screen.disableOutputStream(machine, 1, 0, 0);
      screen.enableOutputStream(machine, 1, 0, 0);

      screen.print(machine, 'visible');

      expect(out()).toContain('visible');
    });

    it('should apply the active colour to printed text', () => {
      screen.setTextColors(machine, 0, Color.Red, Color.Default);

      screen.print(machine, 'danger');

      expect(body()).toBe(wrap('danger', 'red'));
    });

    it('should apply style and colour together', () => {
      screen.setTextStyle(machine, TextStyle.Bold);
      screen.setTextColors(machine, 0, Color.Red, Color.Default);

      screen.print(machine, 'x');

      expect(body()).toBe(wrap(wrap('x', 'bold'), 'red'));
    });

    it('should not write lower-window text when output is directed at window 1', () => {
      screen.splitWindow(machine, 1);
      writes = [];
      screen.setOutputWindow(machine, 1);

      screen.print(machine, 'Score: 10');

      expect(out()).not.toBe('Score: 10');
    });
  });

  describe('renderUpperWindow', () => {
    beforeEach(() => {
      screen.splitWindow(machine, 2);
      screen.setOutputWindow(machine, 1);
      writes = [];
    });

    it('should wrap the render in a cursor save/restore pair', () => {
      screen.print(machine, 'hi');

      expect(out().startsWith('\x1b7')).toBe(true);
      expect(out().endsWith('\x1b8')).toBe(true);
    });

    it('should reset the scroll region before touching the upper window', () => {
      screen.print(machine, 'hi');

      expect(out().indexOf('\x1b[r')).toBeLessThan(out().indexOf('\x1b[1;1H'));
    });

    it('should position and clear the buffered line', () => {
      screen.print(machine, 'hi');

      expect(out()).toContain('\x1b[1;1H\x1b[K');
    });

    it('should render one positioned line per buffered line, not per split row', () => {
      // The loop walks upperWindowBuffer, so a 2-row split with only one line
      // written emits one line; writing a second fills the second row.
      screen.print(machine, 'one\ntwo');

      expect(out()).toContain('\x1b[1;1H\x1b[K');
      expect(out()).toContain('\x1b[2;1H\x1b[K');
    });

    it('should pad a short line out to the full screen width', () => {
      screen.print(machine, 'hi');

      // 'hi' plus padding, emitted as one unstyled run of exactly COLS chars.
      expect(out()).toContain('hi'.padEnd(COLS, ' '));
    });

    it('should emit a single run when style and colour are uniform', () => {
      screen.print(machine, 'hi');

      const padded = 'hi'.padEnd(COLS, ' ');
      expect(out().split(padded).length - 1).toBe(1);
    });

    it('should restore the scroll region below the upper window', () => {
      screen.print(machine, 'hi');

      expect(out()).toContain(`\x1b[3;${ROWS}r`);
    });

    it('should split the line into separate runs when the style changes mid-line', () => {
      screen.setTextStyle(machine, TextStyle.Bold);
      screen.print(machine, 'AA');
      screen.setTextStyle(machine, TextStyle.Roman);
      writes = [];
      screen.print(machine, 'BB');

      // The bold run must be emitted separately from the unstyled remainder.
      expect(out()).toContain(wrap('AA', 'bold'));
    });
  });

  describe('splitWindow', () => {
    it('should emit nothing when the height is unchanged', () => {
      screen.splitWindow(machine, 3);
      writes = [];

      screen.splitWindow(machine, 3);

      expect(out()).toBe('');
    });

    it('should clear and inverse-fill each new upper-window line', () => {
      screen.splitWindow(machine, 2);

      expect(out()).toContain('\x1b[1;1H\x1b[K');
      expect(out()).toContain('\x1b[2;1H\x1b[K');
      expect(out()).toContain(wrap(''.padEnd(COLS, ' '), 'inverse'));
    });

    it('should set the scroll region to start below the upper window', () => {
      screen.splitWindow(machine, 3);

      expect(out()).toContain(`\x1b[4;${ROWS}r`);
    });

    it('should park the cursor at the top of the scroll region', () => {
      screen.splitWindow(machine, 3);

      expect(out()).toContain('\x1b[4;1H');
    });

    it('should reset to full-screen scrolling when the split is removed', () => {
      screen.splitWindow(machine, 3);
      writes = [];

      screen.splitWindow(machine, 0);

      expect(out()).toContain('\x1b[r');
    });

    it('should wrap the whole operation in a cursor save/restore', () => {
      screen.splitWindow(machine, 2);

      expect(out().startsWith('\x1b7')).toBe(true);
      expect(out().endsWith('\x1b8')).toBe(true);
    });
  });

  describe('clearWindow', () => {
    /**
     * clearWindow branches on isTTY and, on the TTY path, calls cursorTo and
     * clearScreenDown. None of the three exist on the non-TTY stdout Vitest
     * gives us, so define them for the duration and restore afterwards.
     */
    function withTTY(
      isTTY: boolean,
      assert: (tty: { cursorTo: ReturnType<typeof vi.fn>; clearScreenDown: ReturnType<typeof vi.fn> }) => void
    ): void {
      const keys = ['isTTY', 'cursorTo', 'clearScreenDown'] as const;
      const prev = keys.map((k) => [k, Object.getOwnPropertyDescriptor(process.stdout, k)] as const);
      const tty = { cursorTo: vi.fn(), clearScreenDown: vi.fn() };

      Object.defineProperty(process.stdout, 'isTTY', { value: isTTY, configurable: true, writable: true });
      Object.defineProperty(process.stdout, 'cursorTo', { value: tty.cursorTo, configurable: true, writable: true });
      Object.defineProperty(process.stdout, 'clearScreenDown', {
        value: tty.clearScreenDown,
        configurable: true,
        writable: true,
      });

      try {
        assert(tty);
      } finally {
        for (const [key, descriptor] of prev) {
          if (descriptor) Object.defineProperty(process.stdout, key, descriptor);
          else delete (process.stdout as unknown as Record<string, unknown>)[key];
        }
      }
    }

    it('should reset the scroll region and clear the screen for -1 (non-TTY)', () => {
      withTTY(false, () => {
        screen.clearWindow(machine, -1);

        expect(out()).toContain('\x1b[r');
        expect(out()).toContain('\x1b[2J\x1b[H');
      });
    });

    it('should use the cursor API for -1 on a real TTY', () => {
      withTTY(true, ({ cursorTo, clearScreenDown }) => {
        screen.clearWindow(machine, -1);

        expect(cursorTo).toHaveBeenCalledWith(0, 0);
        expect(clearScreenDown).toHaveBeenCalled();
      });
    });

    it('should clear from below the upper window for window 0 (non-TTY)', () => {
      screen.splitWindow(machine, 3);
      writes = [];

      withTTY(false, () => {
        screen.clearWindow(machine, 0);

        expect(out()).toContain('\x1b[4;1H\x1b[J');
      });
    });

    it('should position at the split row for window 0 on a real TTY', () => {
      screen.splitWindow(machine, 3);

      withTTY(true, ({ cursorTo }) => {
        screen.clearWindow(machine, 0);

        expect(cursorTo).toHaveBeenCalledWith(0, 3);
      });
    });

    it('should clear and inverse-fill each upper-window line for window 1', () => {
      screen.splitWindow(machine, 2);
      writes = [];

      screen.clearWindow(machine, 1);

      expect(out()).toContain('\x1b[1;1H\x1b[K');
      expect(out()).toContain(wrap(''.padEnd(COLS, ' '), 'inverse'));
      expect(out()).toContain(`\x1b[3;${ROWS}r`);
    });
  });

  describe('clearLine', () => {
    it('should return to column one and erase to end of line', () => {
      screen.clearLine(machine, 0);

      expect(out()).toContain('\r\x1b[K');
    });
  });

  describe('cursor visibility', () => {
    it('should emit the ANSI hide-cursor sequence', () => {
      screen.hideCursor(machine, 0);

      expect(out()).toBe('\x1b[?25l');
    });

    it('should emit the ANSI show-cursor sequence', () => {
      screen.showCursor(machine, 0);

      expect(out()).toBe('\x1b[?25h');
    });
  });

  describe('updateStatusBar', () => {
    it('should move to the top-left before writing', () => {
      screen.updateStatusBar('West of House', 10, 25, false);

      expect(out()).toContain('\x1b[H');
    });

    it('should show the location and score', () => {
      screen.updateStatusBar('West of House', 10, 25, false);

      expect(out()).toContain('West of House');
      expect(out()).toContain('10');
    });

    it('should render the line in inverse video', () => {
      screen.updateStatusBar('Attic', 1, 1, false);

      expect(out()).toContain('\x1b[7m');
    });

    it('should save the cursor before and restore it after', () => {
      screen.updateStatusBar('Attic', 0, 0, false);

      expect(out().indexOf('\x1b7')).toBeLessThan(out().indexOf('\x1b8'));
    });

    it('should leave the scroll region starting below the status line', () => {
      screen.updateStatusBar('Attic', 0, 0, false);

      expect(out()).toContain(`\x1b[2;${ROWS}r`);
    });
  });

  describe('quit', () => {
    it('should exit the process', () => {
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

      screen.quit();

      expect(exit).toHaveBeenCalledWith(0);
    });
  });
});
