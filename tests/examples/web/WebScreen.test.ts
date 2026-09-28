// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PictureRenderer } from '../../../examples/web/src/PictureRenderer';
import { WebScreen } from '../../../examples/web/src/WebScreen';
import { Color, HeaderLocation, Logger, TextStyle, WindowProperty, type ZMachine } from '../../../src/index';

Logger.setLogToConsole(false);

interface Dom {
  gameContainer: HTMLDivElement;
  statusEl: HTMLDivElement;
  mainContent: HTMLDivElement;
  mainEl: HTMLDivElement;
  inputLine: HTMLDivElement;
  inputField: HTMLInputElement;
  canvas: HTMLCanvasElement;
  ctx: { fillRect: ReturnType<typeof vi.fn>; fillStyle: string };
}

/**
 * Build the element structure index.html provides. jsdom performs no layout, so
 * every clientWidth/offsetWidth is 0 and WebScreen falls back to its documented
 * defaults (10x16 cells over an 800x400 screen) — which makes the geometry
 * assertions below deterministic.
 */
function makeDom(): Dom {
  document.body.innerHTML = '';
  const gameContainer = document.createElement('div');
  gameContainer.id = 'game-container';

  const statusEl = document.createElement('div');
  statusEl.id = 'status-bar';

  const mainContent = document.createElement('div');
  mainContent.id = 'main-content';
  const mainEl = document.createElement('div');
  mainEl.id = 'text-output';
  mainContent.appendChild(mainEl);

  const inputLine = document.createElement('div');
  inputLine.id = 'input-line';
  const inputField = document.createElement('input');
  inputField.id = 'input-field';
  inputLine.appendChild(inputField);

  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 200;
  const ctx = { fillRect: vi.fn(), fillStyle: '' };
  canvas.getContext = vi.fn(() => ctx) as unknown as HTMLCanvasElement['getContext'];

  gameContainer.append(statusEl, mainContent, inputLine, canvas);
  document.body.appendChild(gameContainer);

  return { gameContainer, statusEl, mainContent, mainEl, inputLine, inputField, canvas, ctx };
}

function makeMachine(version = 5): ZMachine {
  return {
    logger: new Logger('TestMachine'),
    state: { version },
    memory: { getByte: vi.fn(() => 8) },
  } as unknown as ZMachine;
}

function makeScreen(dom: Dom, options?: { onQuit?: () => void }): WebScreen {
  return new WebScreen(dom.statusEl, dom.mainEl, dom.canvas, options);
}

describe('WebScreen', () => {
  let dom: Dom;
  let machine: ZMachine;
  let screen: WebScreen;

  beforeEach(() => {
    dom = makeDom();
    machine = makeMachine();
    screen = makeScreen(dom);
  });

  describe('getCapabilities', () => {
    it('should advertise the full V6 feature set the browser client supports', () => {
      expect(screen.getCapabilities()).toMatchObject({
        hasColors: true,
        hasBold: true,
        hasItalic: true,
        hasReverseVideo: true,
        hasFixedPitch: true,
        hasSplitWindow: true,
        hasDisplayStatusBar: true,
        hasPictures: true,
        hasSound: true,
        hasTimedKeyboardInput: true,
      });
    });

    it('should report character cells as units, with the font in CSS pixels, outside canvas mode', () => {
      expect(screen.getCapabilities()).toMatchObject({
        screenUnits: { width: 80, height: 25 },
        fontUnits: { width: 10, height: 16 },
      });
    });

    it('should report canvas pixels as units and a square font cell in V6 canvas mode', () => {
      screen.enableCanvasBackground();

      // 200px canvas / 25 rows = 8px cells, as in Zork Zero's 320x200 layout
      expect(screen.getCapabilities()).toMatchObject({
        screenChars: { cols: 80, rows: 25 },
        screenUnits: { width: 320, height: 200 },
        fontUnits: { width: 8, height: 8 },
      });
    });

    it('should keep the V6 text grid and font cell across a resize but re-measure them after a font change', () => {
      screen.enableCanvasBackground();
      screen.getCapabilities();

      // Shrinking the window gives fewer columns and rows. Zork Zero lays its status line out
      // from the header's character width, so reporting these would shift it after a restore.
      Object.defineProperty(dom.gameContainer, 'clientWidth', { configurable: true, value: 600 });
      Object.defineProperty(dom.gameContainer, 'clientHeight', { configurable: true, value: 800 });
      expect(screen.getCapabilities()).toMatchObject({
        screenChars: { cols: 80, rows: 25 },
        fontUnits: { width: 8, height: 8 },
      });

      screen.remeasureCellDimensions();
      expect(screen.getCapabilities()).toMatchObject({
        screenChars: { cols: 60, rows: 50 },
        fontUnits: { width: 4, height: 4 },
      });
    });

    it('should report no separate text grid outside canvas mode, so the header follows getSize()', () => {
      expect(screen.getCapabilities().screenChars).toBeUndefined();
    });
  });

  describe('getSize', () => {
    it('should derive rows and columns from the fallback screen size and cell metrics', () => {
      // 800/10 columns by 400/16 rows.
      expect(screen.getSize()).toEqual({ cols: 80, rows: 25 });
    });

    it('should never report fewer than the 40x10 floor the Z-machine assumes', () => {
      const { cols, rows } = screen.getSize();
      expect(cols).toBeGreaterThanOrEqual(40);
      expect(rows).toBeGreaterThanOrEqual(10);
    });
  });

  describe('getCellDimensions', () => {
    it('should report the measured cell size', () => {
      expect(screen.getCellDimensions()).toEqual({ width: 10, height: 16 });
    });

    it('should return the same values after a remeasure with an unchanged font', () => {
      expect(screen.remeasureCellDimensions()).toEqual(screen.getCellDimensions());
    });
  });

  describe('getPictureCanvas', () => {
    it('should expose the canvas it was constructed with', () => {
      expect(screen.getPictureCanvas()).toBe(dom.canvas);
    });
  });

  describe('colors', () => {
    it('should fall back to the client default palette before the game sets colors', () => {
      expect(screen.getForegroundColor(0)).toBe('#e0e0e0');
      expect(screen.getBackgroundColor(0)).toBe('#0a0a0a');
    });

    it.each([
      [Color.Red, '#cc0000'],
      [Color.Green, '#00cc00'],
      [Color.Blue, '#0000cc'],
      [Color.White, '#ffffff'],
      [Color.Black, '#000000'],
    ])('should map Z-machine color %i to %s', (color, css) => {
      screen.setTextColors(machine, 0, color, Color.Default);
      expect(screen.getForegroundColor(0)).toBe(css);
    });

    it('should decode a 15-bit true colour into hex', () => {
      // 0x7FFF is full red, green and blue: 31 * 8 = 248 per channel.
      screen.setTextColors(machine, 0, 0x7fff, Color.Default);
      expect(screen.getForegroundColor(0)).toBe('#f8f8f8');
    });

    it('should track colors per window', () => {
      screen.setTextColors(machine, 0, Color.Red, Color.Default);
      screen.setTextColors(machine, 1, Color.Green, Color.Default);

      expect(screen.getForegroundColor(0)).toBe('#cc0000');
      expect(screen.getForegroundColor(1)).toBe('#00cc00');
    });
  });

  describe('print to the lower window', () => {
    it('should append the text to the transcript', () => {
      screen.print(machine, 'West of House');
      expect(dom.mainEl.textContent).toBe('West of House');
    });

    it('should append rather than replace across calls', () => {
      screen.print(machine, 'West ');
      screen.print(machine, 'of House');
      expect(dom.mainEl.textContent).toBe('West of House');
    });

    it('should escape HTML so story text cannot inject markup', () => {
      screen.print(machine, '<script>alert(1)</script>');

      expect(dom.mainEl.querySelector('script')).toBeNull();
      expect(dom.mainEl.textContent).toBe('<script>alert(1)</script>');
    });

    it('should escape ampersands and quotes', () => {
      screen.print(machine, 'Tom & "Huck"');
      expect(dom.mainEl.textContent).toBe('Tom & "Huck"');
    });

    it('should render a newline as a line break', () => {
      screen.print(machine, 'one\ntwo');
      expect(dom.mainEl.querySelectorAll('br')).toHaveLength(1);
    });

    it('should apply the current foreground color to the emitted span', () => {
      screen.setTextColors(machine, 0, Color.Red, Color.Default);
      screen.print(machine, 'danger');

      expect(dom.mainEl.innerHTML).toContain('color:#cc0000');
    });

    it.each([
      [TextStyle.Bold, 'font-weight:bold'],
      [TextStyle.Italic, 'font-style:italic'],
    ])('should apply text style %i as %s', (style, css) => {
      screen.setTextStyle(machine, style);
      screen.print(machine, 'styled');

      expect(dom.mainEl.innerHTML).toContain(css);
    });

    it('should swap foreground and background for reverse video', () => {
      screen.setTextColors(machine, 0, Color.White, Color.Black);
      screen.setTextStyle(machine, TextStyle.ReverseVideo);
      screen.print(machine, 'inverse');

      expect(dom.mainEl.innerHTML).toContain('color:#000000;background:#ffffff');
    });
  });

  describe('print to the upper window', () => {
    it('should render into the status bar rather than the transcript', () => {
      screen.setOutputWindow(machine, 1);
      screen.print(machine, 'Score: 10');

      expect(dom.statusEl.textContent).toContain('Score: 10');
      expect(dom.mainEl.textContent).toBe('');
    });

    it('should grow the status bar to fit its buffered lines', () => {
      screen.splitWindow(machine, 2);
      screen.setOutputWindow(machine, 1);
      screen.print(machine, 'line one\nline two\nline three');

      expect(parseFloat(dom.statusEl.style.minHeight)).toBeGreaterThanOrEqual(3 * 16);
    });
  });

  describe('splitWindow', () => {
    it('should hide the status bar when the split is removed', () => {
      screen.splitWindow(machine, 3);
      screen.splitWindow(machine, 0);

      expect(dom.statusEl.style.display).toBe('none');
    });

    it('should show the status bar when a split is requested', () => {
      screen.splitWindow(machine, 3);
      expect(dom.statusEl.style.display).toBe('block');
    });

    it('should size the status bar in character rows outside canvas mode', () => {
      screen.splitWindow(machine, 3);
      expect(dom.statusEl.style.minHeight).toBe(`${3 * 16}px`);
    });
  });

  describe('updateStatusBar', () => {
    it('should render the location and score into the status bar', () => {
      screen.updateStatusBar('West of House', 10, 25, false);

      expect(dom.statusEl.textContent).toContain('West of House');
      expect(dom.statusEl.textContent).toContain('10');
    });

    it('should escape a location name containing markup', () => {
      screen.updateStatusBar('<b>Attic</b>', 0, 0, false);

      expect(dom.statusEl.querySelector('b')).toBeNull();
      expect(dom.statusEl.textContent).toContain('<b>Attic</b>');
    });

    it('should pad the line to the full screen width', () => {
      screen.updateStatusBar('Attic', 1, 1, false);

      const line = dom.statusEl.textContent ?? '';
      expect(line.length).toBe(screen.getSize().cols);
    });
  });

  describe('canvas clears in V6', () => {
    /** A V6 machine on Zork Zero's 320x200 screen. */
    function v6Machine(): ZMachine {
      return {
        logger: new Logger('TestMachine'),
        state: { version: 6 },
        memory: {
          getByte: vi.fn(() => 8),
          getWord: vi.fn((addr: number) =>
            addr === HeaderLocation.ScreenWidthInUnits ? 320 : addr === HeaderLocation.ScreenHeightInUnits ? 200 : 0
          ),
          getFontUnits: vi.fn(() => ({ width: 8, height: 8 })),
        },
      } as unknown as ZMachine;
    }

    function givenRenderer(): { fill: ReturnType<typeof vi.fn> } {
      const renderer = { fill: vi.fn(() => Promise.resolve()) };
      screen.setPictureRenderer(renderer as unknown as PictureRenderer);
      return renderer;
    }

    beforeEach(() => screen.enableCanvasBackground());

    it("should clear only window 0's own box when window 0 is erased", () => {
      // Zork Zero's Tower of Bozbar: text window below the tower, cleared after every move
      const v6 = v6Machine();
      const renderer = givenRenderer();
      screen.moveWindow(v6, 0, 120, 14);
      screen.resizeWindow(v6, 0, 81, 294);

      screen.clearWindow(v6, 0);

      expect(renderer.fill).toHaveBeenCalledWith('#ffffff', { x: 13, y: 119, width: 294, height: 81 });
    });

    it('should undo a narrowing of window 0 that comes without a move', () => {
      const v6 = v6Machine();
      screen.moveWindow(v6, 0, 40, 44);
      screen.resizeWindow(v6, 0, 161, 234);

      screen.resizeWindow(v6, 0, 161, 93); // Transient narrowing, never restored by the game

      expect(screen.getWindowProperty(v6, 0, WindowProperty.XSize)).toBe(234);
    });

    it('should take a new width after window 0 is moved, e.g. leaving the Tower of Bozbar', () => {
      const v6 = v6Machine();
      screen.moveWindow(v6, 0, 120, 14); // Tower layout
      screen.resizeWindow(v6, 0, 81, 294);

      screen.moveWindow(v6, 0, 40, 44); // Back to the normal layout
      screen.resizeWindow(v6, 0, 161, 234);

      expect(screen.getWindowProperty(v6, 0, WindowProperty.XSize)).toBe(234);
    });

    it('should fill the whole canvas when the screen is erased', () => {
      const v6 = v6Machine();
      const renderer = givenRenderer();

      screen.clearWindow(v6, -1);

      expect(renderer.fill).toHaveBeenCalledWith('#ffffff', undefined);
    });

    it('should draw fills directly when no picture renderer is set', () => {
      const v6 = v6Machine();
      dom.ctx.fillRect.mockClear();

      screen.clearWindow(v6, -2);

      expect(dom.ctx.fillRect).toHaveBeenCalledWith(0, 0, 320, 200);
    });
  });

  describe('clearWindow', () => {
    it('should clear the transcript and hide the status bar when unsplitting (-1)', () => {
      screen.splitWindow(machine, 2);
      screen.print(machine, 'text');

      screen.clearWindow(machine, -1);

      expect(dom.mainEl.innerHTML).toBe('');
      expect(dom.statusEl.innerHTML).toBe('');
      expect(dom.statusEl.style.display).toBe('none');
    });

    it('should drop any pending set_cursor padding when unsplitting', () => {
      dom.mainEl.style.paddingTop = '24px';
      screen.clearWindow(machine, -1);
      expect(dom.mainEl.style.paddingTop).toBe('');
    });
  });

  describe('eraseInlinePicture', () => {
    it('should report false for a picture that was never inlined', () => {
      expect(screen.eraseInlinePicture(42)).toBe(false);
    });
  });

  describe('quit', () => {
    it('should invoke the onQuit callback', () => {
      const onQuit = vi.fn();
      makeScreen(makeDom(), { onQuit }).quit();
      expect(onQuit).toHaveBeenCalledTimes(1);
    });

    it('should be safe without a callback', () => {
      expect(() => screen.quit()).not.toThrow();
    });
  });

  describe('resetCanvasLayoutStyles', () => {
    it('should strip the absolute-positioned boxes a V6 session leaves behind', () => {
      makeScreen(dom).enableCanvasBackground();
      expect(dom.inputLine.style.position).toBe('absolute');

      WebScreen.resetCanvasLayoutStyles(dom.gameContainer);

      for (const el of [dom.statusEl, dom.mainContent, dom.inputLine]) {
        expect(el.style.position).toBe('');
        expect(el.style.backgroundColor).toBe('');
        expect(el.style.height).toBe('');
      }
    });

    it('should restore the status bar and main content to stylesheet defaults', () => {
      makeScreen(dom).enableCanvasBackground();

      WebScreen.resetCanvasLayoutStyles(dom.gameContainer);

      expect(dom.statusEl.style.overflow).toBe('');
      expect(dom.statusEl.style.borderBottom).toBe('');
      expect(dom.mainContent.style.minHeight).toBe('');
      expect(dom.mainContent.style.maxHeight).toBe('');
      expect(dom.inputLine.style.borderTop).toBe('');
    });

    it('should tolerate a container missing the optional elements', () => {
      const bare = document.createElement('div');
      expect(() => WebScreen.resetCanvasLayoutStyles(bare)).not.toThrow();
    });
  });

  describe('enableCanvasBackground', () => {
    it('should make the text layers transparent so the canvas shows through', () => {
      screen.enableCanvasBackground();

      expect(dom.statusEl.style.backgroundColor).toBe('transparent');
      expect(dom.mainEl.style.backgroundColor).toBe('transparent');
      expect(dom.mainContent.style.backgroundColor).toBe('transparent');
    });

    it('should pin the input line to the bottom, outside the Z-machine window model', () => {
      screen.enableCanvasBackground();

      expect(dom.inputLine.style.position).toBe('absolute');
      expect(dom.inputLine.style.bottom).toBe('0px');
    });

    it('should clear the fallback height clamps that would fight the computed frame', () => {
      dom.mainContent.style.minHeight = '400px';
      dom.mainContent.style.maxHeight = '70vh';

      screen.enableCanvasBackground();

      expect(dom.mainContent.style.minHeight).toBe('0px');
      expect(dom.mainContent.style.maxHeight).toBe('none');
    });

    it('should keep the status bar hidden until the game splits a window', () => {
      screen.enableCanvasBackground();
      expect(dom.statusEl.style.display).toBe('none');
    });

    it('should leave printed backgrounds transparent so the canvas is not painted over', () => {
      screen.enableCanvasBackground();
      screen.setTextColors(machine, 0, Color.White, Color.Blue);
      screen.print(machine, 'over the picture');

      expect(dom.mainEl.innerHTML).toContain('background:transparent');
    });
  });

  describe('handleResize', () => {
    it('should be safe with no upper window buffer', () => {
      expect(() => screen.handleResize()).not.toThrow();
    });

    it('should keep the status bar rendered after a resize', () => {
      screen.splitWindow(machine, 1);
      screen.setOutputWindow(machine, 1);
      screen.print(machine, 'Score: 10');

      screen.handleResize();

      expect(dom.statusEl.textContent).toContain('Score: 10');
    });
  });
});
