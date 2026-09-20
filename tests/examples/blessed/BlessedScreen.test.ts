import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlessedScreen } from '../../../examples/blessedConsole/BlessedScreen';
import { Color, Logger, TextStyle, type ZMachine } from '../../../src/index';
import { created, resetBlessedMock, trackStdoutResizeListeners, type MockScreen, type MockWidget } from './blessedMock';

Logger.setLogToConsole(false);

/**
 * blessed seizes the TTY and puts stdin in raw mode the moment BlessedScreen's
 * constructor calls blessed.screen(), so the real library cannot run here.
 *
 * Mocked by the path the SUT resolves to: a bare `vi.mock('blessed')` would
 * register against this file's resolution (the repo root, where blessed is not
 * installed), the ids would not match, and the real library would load.
 */
vi.mock('../../../examples/blessedConsole/node_modules/blessed', async () => {
  const { createBlessedModule } = await import('./blessedMock');
  return createBlessedModule();
});

function makeMachine(version = 5): ZMachine {
  return {
    logger: new Logger('TestMachine'),
    state: { version, memory: { getByte: vi.fn(() => 8), getWord: vi.fn(() => 0), setByte: vi.fn() } },
    memory: { getByte: vi.fn(() => 8) },
  } as unknown as ZMachine;
}

/** Reach a private method without exporting it just for tests. */
function invoke<T>(screen: BlessedScreen, method: string, ...args: unknown[]): T {
  return (screen as unknown as Record<string, (...a: unknown[]) => T>)[method](...args);
}

describe('BlessedScreen', () => {
  let screen: BlessedScreen;
  let machine: ZMachine;
  let mockScreen: MockScreen;
  let statusWindow: MockWidget;
  let mainWindow: MockWidget;
  let restoreStdout: () => void;

  beforeEach(() => {
    resetBlessedMock();
    restoreStdout = trackStdoutResizeListeners();
    screen = new BlessedScreen();
    machine = makeMachine();
    mockScreen = created.screens[0];
    [statusWindow, mainWindow] = created.boxes;
  });

  afterEach(() => {
    restoreStdout();
    vi.restoreAllMocks();
  });

  describe('construction', () => {
    it('should append the status window then the main window', () => {
      expect(mockScreen.append).toHaveBeenNthCalledWith(1, statusWindow);
      expect(mockScreen.append).toHaveBeenNthCalledWith(2, mainWindow);
    });

    it('should bind Ctrl-C for exit', () => {
      expect(mockScreen.program.key).toHaveBeenCalledWith(['C-c'], expect.any(Function));
    });

    it('should render once', () => {
      expect(mockScreen.render).toHaveBeenCalledTimes(1);
    });

    it('should listen for resize on both blessed and process.stdout', () => {
      expect(mockScreen.handlers.get('resize')).toHaveLength(1);
      expect(process.stdout.listeners('resize').length).toBeGreaterThan(0);
    });

    it('should expose the windows it built', () => {
      expect(screen.getBlessedScreen()).toBe(mockScreen);
      expect(screen.getMainWindow()).toBe(mainWindow);
      expect(screen.getStatusWindow()).toBe(statusWindow);
    });
  });

  describe('quit', () => {
    let writes: string[];

    beforeEach(() => {
      // quit() emits show-cursor / reset / clear-screen. Left unmocked these
      // reach the real terminal and wipe the developer's screen mid-run.
      writes = [];
      vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
        writes.push(String(chunk));
        return true;
      }) as typeof process.stdout.write);
      vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    });

    it('should detach its process.stdout resize listener', () => {
      const before = process.stdout.listenerCount('resize');

      screen.quit();

      expect(process.stdout.listenerCount('resize')).toBe(before - 1);
    });

    it('should destroy the blessed screen and exit', () => {
      screen.quit();

      expect(mockScreen.destroy).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should restore the real cursor before destroying', () => {
      screen.quit();

      expect(mockScreen.cursor.artificial).toBe(false);
      expect(mockScreen.cursor.shape).toBe('line');
    });

    it('should restore the terminal it took over', () => {
      screen.quit();

      expect(writes.join('')).toContain('\x1b[?25h');
    });
  });

  describe('getCapabilities', () => {
    it('should report a colour terminal with no pictures or sound', () => {
      const caps = screen.getCapabilities();

      expect(caps.hasColors).toBe(true);
      expect(caps.hasTimedKeyboardInput).toBe(true);
      expect(caps.hasPictures).toBe(false);
      expect(caps.hasSound).toBe(false);
    });

    it('should echo the interpreter number', () => {
      resetBlessedMock();
      expect(new BlessedScreen(6).getCapabilities().interpreterNumber).toBe(6);
    });
  });

  describe('getSize', () => {
    it('should report the terminal dimensions blessed gives it', () => {
      mockScreen.width = 132;
      mockScreen.height = 40;

      expect(screen.getSize()).toEqual({ cols: 132, rows: 40 });
    });

    it('should substitute defaults while blessed still reports 1x1', () => {
      // blessed reports 1x1 until it has interrogated the terminal.
      mockScreen.width = 1;
      mockScreen.height = 1;

      expect(screen.getSize()).toEqual({ cols: 80, rows: 25 });
    });

    it('should substitute a default for an implausibly narrow width alone', () => {
      mockScreen.width = 5;
      mockScreen.height = 40;

      expect(screen.getSize()).toEqual({ cols: 80, rows: 40 });
    });

    it('should fire the resize callback when valid dimensions change', () => {
      const onResize = vi.fn();
      mockScreen.width = 1;
      mockScreen.height = 1;
      screen.setResizeCallback(onResize);
      mockScreen.width = 100;
      mockScreen.height = 30;

      screen.getSize();

      expect(onResize).toHaveBeenCalledWith(100, 30);
    });

    it('should not re-fire the callback when the dimensions are unchanged', () => {
      const onResize = vi.fn();
      screen.setResizeCallback(onResize);
      onResize.mockClear();

      screen.getSize();
      screen.getSize();

      expect(onResize).not.toHaveBeenCalled();
    });
  });

  describe('setResizeCallback', () => {
    it('should fire immediately when dimensions are already known', () => {
      const onResize = vi.fn();

      screen.setResizeCallback(onResize);

      expect(onResize).toHaveBeenCalledWith(80, 25);
    });

    it('should stay quiet while blessed still reports 1x1', () => {
      resetBlessedMock();
      const fresh = new BlessedScreen();
      const freshScreen = created.screens[0];
      freshScreen.width = 1;
      freshScreen.height = 1;
      const onResize = vi.fn();

      fresh.setResizeCallback(onResize);

      expect(onResize).not.toHaveBeenCalled();
    });
  });

  describe('mapZMachineColor', () => {
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
    ] as const)('should map colour %i to the blessed name %s', (color, name) => {
      expect(invoke<string | null>(screen, 'mapZMachineColor', color)).toBe(name);
    });

    it('should return null for Current, meaning "leave it alone"', () => {
      expect(invoke<string | null>(screen, 'mapZMachineColor', Color.Current)).toBeNull();
    });

    it('should return null for Default, deferring to the terminal', () => {
      expect(invoke<string | null>(screen, 'mapZMachineColor', Color.Default)).toBeNull();
    });

    it('should convert a 15-bit true colour to hex', () => {
      // 0x7FFF is full red, green and blue.
      const result = invoke<string | null>(screen, 'mapZMachineColor', 0x7fff);

      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe('mapZMachineColorWithDefault', () => {
    it('should resolve a Default foreground to white', () => {
      expect(invoke<string | null>(screen, 'mapZMachineColorWithDefault', Color.Default, false)).toBe('white');
    });

    it('should resolve a Default background to black', () => {
      expect(invoke<string | null>(screen, 'mapZMachineColorWithDefault', Color.Default, true)).toBe('black');
    });

    it('should still return null for Current', () => {
      expect(invoke<string | null>(screen, 'mapZMachineColorWithDefault', Color.Current, false)).toBeNull();
    });

    it('should pass a named colour straight through', () => {
      expect(invoke<string | null>(screen, 'mapZMachineColorWithDefault', Color.Red, false)).toBe('red');
    });
  });

  describe('applyStylesAndColors', () => {
    // Every window starts with {Default, Default} colours, which resolve to
    // white-on-black, so colour tags always wrap the style tags.
    const DEFAULT_COLORS = ['{white-fg}{black-bg}', '{/}'] as const;

    function withDefaultColors(styled: string): string {
      return `${DEFAULT_COLORS[0]}${styled}${DEFAULT_COLORS[1]}`;
    }

    it('should still emit resolved default colours for unstyled text', () => {
      expect(invoke<string>(screen, 'applyStylesAndColors', 'x')).toBe(withDefaultColors('x'));
    });

    it('should tag bold', () => {
      screen.setTextStyle(machine, TextStyle.Bold);

      expect(invoke<string>(screen, 'applyStylesAndColors', 'x')).toBe(withDefaultColors('{bold}x{/bold}'));
    });

    it('should render italic as underline, which blessed does support', () => {
      screen.setTextStyle(machine, TextStyle.Italic);

      expect(invoke<string>(screen, 'applyStylesAndColors', 'x')).toBe(withDefaultColors('{underline}x{/underline}'));
    });

    it('should tag reverse video', () => {
      screen.setTextStyle(machine, TextStyle.ReverseVideo);

      expect(invoke<string>(screen, 'applyStylesAndColors', 'x')).toBe(withDefaultColors('{inverse}x{/inverse}'));
    });

    it('should nest combined styles bold-inside-underline-inside-inverse', () => {
      screen.setTextStyle(machine, TextStyle.Bold | TextStyle.Italic | TextStyle.ReverseVideo);

      expect(invoke<string>(screen, 'applyStylesAndColors', 'x')).toBe(
        withDefaultColors('{inverse}{underline}{bold}x{/bold}{/underline}{/inverse}')
      );
    });

    it('should emit both colour tags when foreground and background are set', () => {
      screen.setTextColors(machine, 0, Color.Red, Color.Blue);

      expect(invoke<string>(screen, 'applyStylesAndColors', 'x')).toBe('{red-fg}{blue-bg}x{/}');
    });

    it('should resolve Default colours rather than omitting them', () => {
      screen.setTextColors(machine, 0, Color.Default, Color.Default);

      expect(invoke<string>(screen, 'applyStylesAndColors', 'x')).toBe('{white-fg}{black-bg}x{/}');
    });

    it('should treat a Current background as "keep what is there"', () => {
      // Per the spec, Color.Current means leave the existing value alone, so
      // the window keeps its Default background rather than dropping the tag.
      screen.setTextColors(machine, 0, Color.Red, Color.Current);

      expect(invoke<string>(screen, 'applyStylesAndColors', 'x')).toBe('{red-fg}{black-bg}x{/}');
    });
  });

  describe('renderStyledUpperWindow', () => {
    function render(): string {
      return invoke<string>(screen, 'renderStyledUpperWindow');
    }

    it('should return an empty string with no buffered lines', () => {
      expect(render()).toBe('');
    });

    it('should emit a single run for a uniformly styled line', () => {
      screen.splitWindow(machine, 1);
      screen.setOutputWindow(machine, 1);
      screen.print(machine, 'AB');

      // The upper-window buffer is space-padded to the screen width, so the
      // single run covers the padding too.
      const result = render();
      expect(result.startsWith('{white-fg}{black-bg}AB')).toBe(true);
      expect(result.endsWith('{/}')).toBe(true);
      expect(result.split('{white-fg}').length - 1).toBe(1);
    });

    it('should split into separate runs where the style changes mid-line', () => {
      screen.splitWindow(machine, 1);
      screen.setOutputWindow(machine, 1);
      screen.setTextStyle(machine, TextStyle.Bold);
      screen.print(machine, 'AA');
      screen.setTextStyle(machine, TextStyle.Roman);
      screen.print(machine, 'BB');

      const result = render();
      expect(result).toContain('{bold}AA{/bold}');
      expect(result).not.toContain('{bold}AABB{/bold}');
    });

    it('should split into separate runs where the colour changes mid-line', () => {
      screen.splitWindow(machine, 1);
      screen.setOutputWindow(machine, 1);
      screen.setTextColors(machine, 1, Color.Red, Color.Default);
      screen.print(machine, 'AA');
      screen.setTextColors(machine, 1, Color.Green, Color.Default);
      screen.print(machine, 'BB');

      const result = render();
      expect(result).toContain('{red-fg}');
      expect(result).toContain('{green-fg}');
    });

    it('should join multiple buffered lines with a newline', () => {
      screen.splitWindow(machine, 2);
      screen.setOutputWindow(machine, 1);
      screen.print(machine, 'one\ntwo');

      expect(render()).toContain('\n');
    });
  });

  describe('splitWindow', () => {
    it('should size the status window to the requested rows', () => {
      screen.splitWindow(machine, 3);

      expect(statusWindow.height).toBe(3);
    });

    it('should push the main window below the split', () => {
      screen.splitWindow(machine, 3);

      expect(mainWindow.top).toBe(3);
    });

    it('should re-render after resizing', () => {
      mockScreen.render.mockClear();

      screen.splitWindow(machine, 2);

      expect(mockScreen.render).toHaveBeenCalled();
    });
  });

  describe('clearWindow', () => {
    it('should empty the main window for window 0', () => {
      mainWindow.setContent('old text');

      screen.clearWindow(machine, 0);

      expect(mainWindow.setContent).toHaveBeenLastCalledWith('');
    });

    it('should empty the status window for window 1', () => {
      screen.splitWindow(machine, 1);
      statusWindow.setContent('old status');

      screen.clearWindow(machine, 1);

      expect(statusWindow.setContent).toHaveBeenLastCalledWith('');
    });

    it('should clear both windows for -1', () => {
      screen.clearWindow(machine, -1);

      expect(mainWindow.setContent).toHaveBeenLastCalledWith('');
      expect(statusWindow.setContent).toHaveBeenLastCalledWith('');
    });
  });

  describe('mouse handling', () => {
    it('should translate a main-window click into 1-based Z-machine coordinates', () => {
      const onClick = vi.fn();
      screen.setMouseClickCallback(onClick);
      mainWindow.top = 1;

      mainWindow.emit('click', { x: 4, y: 9, button: 'left' });

      // x is +1; y is measured from the window's own top, then +1.
      expect(onClick).toHaveBeenCalledWith(5, 9, 1);
    });

    it('should translate a status-window click without the top offset', () => {
      const onClick = vi.fn();
      screen.setMouseClickCallback(onClick);

      statusWindow.emit('click', { x: 4, y: 0, button: 'left' });

      expect(onClick).toHaveBeenCalledWith(5, 1, 1);
    });

    it.each([
      ['left', 1],
      ['right', 2],
      ['middle', 3],
      ['other', 0],
    ] as const)('should map the %s button to %i', (button, expected) => {
      const onClick = vi.fn();
      screen.setMouseClickCallback(onClick);

      mainWindow.emit('click', { x: 0, y: 0, button });

      expect(onClick).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), expected);
    });

    it('should ignore clicks while the mouse is disabled', () => {
      const onClick = vi.fn();
      screen.setMouseClickCallback(onClick);
      screen.setMouseEnabled(false);

      mainWindow.emit('click', { x: 1, y: 1, button: 'left' });

      expect(onClick).not.toHaveBeenCalled();
    });

    it('should record the last click for getMouseState', () => {
      mainWindow.top = 0;

      mainWindow.emit('click', { x: 6, y: 2, button: 'right' });

      expect(screen.getMouseState()).toEqual({ x: 7, y: 3, button: 2 });
    });

    it('should report whether the mouse is enabled', () => {
      expect(screen.isMouseEnabled()).toBe(true);

      screen.setMouseEnabled(false);

      expect(screen.isMouseEnabled()).toBe(false);
    });
  });
});
