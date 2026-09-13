import {
  BaseScreen,
  Capabilities,
  Color,
  ScreenSize,
  TextStyle,
  WindowProperty,
  ZMachine,
  translateFont3Text,
} from 'rezrov-zmachine';

/**
 * Render a Font 3 character directly at the target cell size using Canvas 2D drawing.
 * This avoids scaling artifacts by drawing lines and rectangles at native resolution.
 *
 * Character assignments based on Frotz sf_font3.c (the reference Z-machine interpreter).
 * All box-drawing characters use a unified center point (cx, cy) so lines connect seamlessly.
 */
function renderFont3Vector(
  ctx: CanvasRenderingContext2D,
  charCode: number,
  w: number,
  h: number,
  fg: string,
  bg: string,
  lw: number
): boolean {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const halfLw = Math.floor(lw / 2);

  // Fill background for all characters
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;

  // Helper: draw a horizontal line segment from x1 to x2 at vertical center
  const hLine = (x1: number, x2: number): void => {
    ctx.fillRect(x1, cy - halfLw, x2 - x1, lw);
  };
  // Helper: draw a vertical line segment from y1 to y2 at horizontal center
  const vLine = (y1: number, y2: number): void => {
    ctx.fillRect(cx - halfLw, y1, lw, y2 - y1);
  };
  // Helper: fill a rectangular quadrant
  const fillRect = (x: number, y: number, rw: number, rh: number): void => {
    ctx.fillRect(x, y, rw, rh);
  };

  switch (charCode) {
    // Space
    case 32:
    case 37:
      return true;

    // Arrows
    case 33: // ← left arrow
      ctx.beginPath();
      ctx.moveTo(w * 0.75, cy - h * 0.4);
      ctx.lineTo(w * 0.75, cy + h * 0.4);
      ctx.lineTo(w * 0.1, cy);
      ctx.fill();
      return true;
    case 34: // → right arrow
      ctx.beginPath();
      ctx.moveTo(w * 0.25, cy - h * 0.4);
      ctx.lineTo(w * 0.25, cy + h * 0.4);
      ctx.lineTo(w * 0.9, cy);
      ctx.fill();
      return true;

    // Diagonals
    case 35: // ╱ forward slash diagonal (bottom-left to top-right)
      ctx.lineWidth = lw;
      ctx.strokeStyle = fg;
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(w, 0);
      ctx.stroke();
      return true;
    case 36: // ╲ backslash diagonal (top-left to bottom-right)
      ctx.lineWidth = lw;
      ctx.strokeStyle = fg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, h);
      ctx.stroke();
      return true;

    // Horizontal lines
    case 38: // ─
    case 39: // ─ (alt)
      hLine(0, w);
      return true;

    // Vertical lines
    case 40: // │
    case 41: // │ (alt)
      vLine(0, h);
      return true;

    // T-junctions
    case 42: // ┴ (up + horizontal)
      vLine(0, cy + halfLw);
      hLine(0, w);
      return true;
    case 43: // ┬ (down + horizontal)
      vLine(cy - halfLw, h);
      hLine(0, w);
      return true;
    case 44: // ├ (vertical + right)
      vLine(0, h);
      hLine(cx - halfLw, w);
      return true;
    case 45: // ┤ (vertical + left)
      vLine(0, h);
      hLine(0, cx + halfLw);
      return true;

    // Corners
    case 46: // └ (up + right)
      vLine(0, cy + halfLw);
      hLine(cx - halfLw, w);
      return true;
    case 47: // ┌ (down + right)
      vLine(cy - halfLw, h);
      hLine(cx - halfLw, w);
      return true;
    case 48: // ┐ (down + left)
      vLine(cy - halfLw, h);
      hLine(0, cx + halfLw);
      return true;
    case 49: // ┘ (up + left)
      vLine(0, cy + halfLw);
      hLine(0, cx + halfLw);
      return true;

    // Corner + diagonal combos
    case 50: // └ + diagonal down-left
      vLine(0, cy + halfLw);
      hLine(cx - halfLw, w);
      ctx.lineWidth = lw;
      ctx.strokeStyle = fg;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(0, h);
      ctx.stroke();
      return true;
    case 51: // ┌ + diagonal from upper-left
      vLine(cy - halfLw, h);
      hLine(cx - halfLw, w);
      ctx.lineWidth = lw;
      ctx.strokeStyle = fg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      return true;
    case 52: // ┐ + diagonal from upper-right
      vLine(cy - halfLw, h);
      hLine(0, cx + halfLw);
      ctx.lineWidth = lw;
      ctx.strokeStyle = fg;
      ctx.beginPath();
      ctx.moveTo(w, 0);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      return true;
    case 53: // ┘ + diagonal down-right
      vLine(0, cy + halfLw);
      hLine(0, cx + halfLw);
      ctx.lineWidth = lw;
      ctx.strokeStyle = fg;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(w, h);
      ctx.stroke();
      return true;

    // Block elements
    case 54: // █ full block
      fillRect(0, 0, w, h);
      return true;
    case 55: // ▀ upper half
      fillRect(0, 0, w, cy);
      return true;
    case 56: // ▄ lower half
      fillRect(0, cy, w, h - cy);
      return true;
    case 57: // ▌ left half
      fillRect(0, 0, cx, h);
      return true;
    case 58: // ▐ right half
      fillRect(cx, 0, w - cx, h);
      return true;

    // Vert line + half block combos
    case 59: // vertical + lower half block
      vLine(0, cy);
      fillRect(0, cy, w, h - cy);
      return true;
    case 60: // vertical + upper half block
      fillRect(0, 0, w, cy);
      vLine(cy, h);
      return true;
    case 61: // left half + horizontal
      fillRect(0, 0, cx, h);
      hLine(cx, w);
      return true;
    case 62: // right half + horizontal
      fillRect(cx, 0, w - cx, h);
      hLine(0, cx);
      return true;

    // Quadrant blocks
    case 63: // ▝ upper-right quadrant
      fillRect(cx, 0, w - cx, cy);
      return true;
    case 64: // ▗ lower-right quadrant
      fillRect(cx, cy, w - cx, h - cy);
      return true;
    case 65: // ▖ lower-left quadrant
      fillRect(0, cy, cx, h - cy);
      return true;
    case 66: // ▘ upper-left quadrant
      fillRect(0, 0, cx, cy);
      return true;

    // Quadrant + diagonal combos
    case 67: // upper-right quad + diag down-left
      fillRect(cx, 0, w - cx, cy);
      ctx.lineWidth = lw;
      ctx.strokeStyle = fg;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(0, h);
      ctx.stroke();
      return true;
    case 68: // lower-right quad + diag from upper-left
      fillRect(cx, cy, w - cx, h - cy);
      ctx.lineWidth = lw;
      ctx.strokeStyle = fg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      return true;
    case 69: // lower-left quad + diag from upper-right
      fillRect(0, cy, cx, h - cy);
      ctx.lineWidth = lw;
      ctx.strokeStyle = fg;
      ctx.beginPath();
      ctx.moveTo(w, 0);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      return true;
    case 70: // upper-left quad + diag down-right
      fillRect(0, 0, cx, cy);
      ctx.lineWidth = lw;
      ctx.strokeStyle = fg;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(w, h);
      ctx.stroke();
      return true;

    // Single corner pixels
    case 71:
      fillRect(w - 1, 0, 1, 1);
      return true;
    case 72:
      fillRect(w - 1, h - 1, 1, 1);
      return true;
    case 73:
      fillRect(0, h - 1, 1, 1);
      return true;
    case 74:
      fillRect(0, 0, 1, 1);
      return true;

    // Edge lines
    case 75: // ▔ top edge
      fillRect(0, 0, w, lw);
      return true;
    case 76: // ▁ bottom edge
      fillRect(0, h - lw, w, lw);
      return true;
    case 77: // ▏ left edge
      fillRect(0, 0, lw, h);
      return true;
    case 78: // ▕ right edge
      fillRect(w - lw, 0, lw, h);
      return true;

    // Progress bar elements (79-89)
    case 79: // horizontal bars (top and bottom)
      fillRect(0, Math.round(h / 8), w, lw);
      fillRect(0, h - Math.round(h / 8) - lw, w, lw);
      return true;
    case 80:
    case 81:
    case 82:
    case 83:
    case 84:
    case 85:
    case 86:
    case 87: {
      // Progress bars: top/bottom border + fill from left
      const barY = Math.round(h / 8);
      const barH = h - 2 * barY;
      fillRect(0, barY, w, lw); // top bar
      fillRect(0, barY + barH - lw, w, lw); // bottom bar
      const fillFrac = (charCode - 79) / 8;
      const fillW = Math.round(w * fillFrac);
      if (fillW > 0) fillRect(0, barY + lw, fillW, barH - 2 * lw);
      return true;
    }
    case 88: // right bar outline
      fillRect(w - lw, Math.round(h / 8), lw, h - 2 * Math.round(h / 8));
      return true;
    case 89: // left bar outline
      fillRect(0, Math.round(h / 8), lw, h - 2 * Math.round(h / 8));
      return true;

    // Diagonal cross
    case 90: {
      ctx.lineWidth = lw;
      ctx.strokeStyle = fg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, h);
      ctx.moveTo(w, 0);
      ctx.lineTo(0, h);
      ctx.stroke();
      return true;
    }

    // Cross junction
    case 91: // ┼
      vLine(0, h);
      hLine(0, w);
      return true;

    // Arrows (up/down)
    case 92: // ↑ up arrow
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(w * 0.85, h * 0.4);
      ctx.lineTo(cx + halfLw, h * 0.4);
      ctx.lineTo(cx + halfLw, h);
      ctx.lineTo(cx - halfLw, h);
      ctx.lineTo(cx - halfLw, h * 0.4);
      ctx.lineTo(w * 0.15, h * 0.4);
      ctx.fill();
      return true;
    case 93: // ↓ down arrow
      ctx.beginPath();
      ctx.moveTo(cx, h);
      ctx.lineTo(w * 0.85, h * 0.6);
      ctx.lineTo(cx + halfLw, h * 0.6);
      ctx.lineTo(cx + halfLw, 0);
      ctx.lineTo(cx - halfLw, 0);
      ctx.lineTo(cx - halfLw, h * 0.6);
      ctx.lineTo(w * 0.15, h * 0.6);
      ctx.fill();
      return true;
    case 94: // ↕ up-down arrow
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(w * 0.85, h * 0.3);
      ctx.lineTo(cx + halfLw, h * 0.3);
      ctx.lineTo(cx + halfLw, h * 0.7);
      ctx.lineTo(w * 0.85, h * 0.7);
      ctx.lineTo(cx, h);
      ctx.lineTo(w * 0.15, h * 0.7);
      ctx.lineTo(cx - halfLw, h * 0.7);
      ctx.lineTo(cx - halfLw, h * 0.3);
      ctx.lineTo(w * 0.15, h * 0.3);
      ctx.fill();
      return true;

    // Quad border
    case 95: // ⎕
      fillRect(0, 0, w, lw);
      fillRect(0, h - lw, w, lw);
      fillRect(0, 0, lw, h);
      fillRect(w - lw, 0, lw, h);
      return true;

    default:
      return false; // Not handled — fall through to bitmap
  }
}

// prettier-ignore
// Frotz sf_font3.c bitmap data for characters that don't have vector recipes (runic etc).
// Each 8-byte Uint8Array = 8×8 monochrome bitmap, MSB = leftmost pixel.
const FONT3_BITMAP_FALLBACK: Record<number, Uint8Array> = {
  96:  new Uint8Array([0x3c, 0x66, 0x06, 0x0c, 0x18, 0x00, 0x18, 0x00]),
  97:  new Uint8Array([0xc4, 0xa8, 0x90, 0xc0, 0xa0, 0x90, 0x80, 0x00]),
  98:  new Uint8Array([0x60, 0x50, 0x48, 0x70, 0x48, 0x50, 0x60, 0x00]),
  99:  new Uint8Array([0x10, 0x18, 0x14, 0x92, 0x50, 0x30, 0x10, 0x00]),
  100: new Uint8Array([0x82, 0xc6, 0xaa, 0x92, 0xaa, 0xc6, 0x82, 0x00]),
  101: new Uint8Array([0x82, 0xc6, 0xaa, 0x92, 0x82, 0x82, 0x82, 0x00]),
  102: new Uint8Array([0x94, 0xa8, 0xd0, 0xa0, 0xc0, 0x80, 0x80, 0x00]),
  103: new Uint8Array([0x82, 0x44, 0x28, 0x10, 0x28, 0x44, 0x82, 0x00]),
  104: new Uint8Array([0xc2, 0xa2, 0xd2, 0xaa, 0x96, 0x8a, 0x86, 0x00]),
  105: new Uint8Array([0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x00]),
  106: new Uint8Array([0x10, 0x38, 0x54, 0x92, 0x54, 0x38, 0x10, 0x00]),
  107: new Uint8Array([0x10, 0x10, 0x10, 0x38, 0x54, 0x92, 0x92, 0x00]),
  108: new Uint8Array([0x10, 0x18, 0x14, 0x12, 0x10, 0x10, 0x10, 0x00]),
  109: new Uint8Array([0xc6, 0xaa, 0x92, 0xaa, 0xc6, 0x82, 0x82, 0x00]),
  110: new Uint8Array([0x90, 0x50, 0x38, 0x14, 0x12, 0x10, 0x10, 0x00]),
  111: new Uint8Array([0xc4, 0xac, 0xd4, 0xa8, 0x90, 0x80, 0x80, 0x00]),
  112: new Uint8Array([0x80, 0x80, 0x80, 0x90, 0xa8, 0xc4, 0x82, 0x00]),
  113: new Uint8Array([0x40, 0x40, 0x40, 0x78, 0x44, 0x44, 0x44, 0x00]),
  114: new Uint8Array([0x60, 0x50, 0x48, 0x50, 0x60, 0x50, 0x48, 0x00]),
  115: new Uint8Array([0x40, 0x44, 0x4c, 0x54, 0x64, 0x44, 0x04, 0x00]),
  116: new Uint8Array([0x10, 0x38, 0x54, 0x92, 0x10, 0x10, 0x10, 0x00]),
  117: new Uint8Array([0x60, 0x50, 0x48, 0x44, 0x44, 0x44, 0x44, 0x00]),
  118: new Uint8Array([0x10, 0xba, 0x54, 0x10, 0x10, 0x10, 0x10, 0x00]),
  119: new Uint8Array([0x60, 0x50, 0x48, 0x50, 0x60, 0x40, 0x40, 0x00]),
  120: new Uint8Array([0x92, 0x54, 0x38, 0x10, 0x10, 0x10, 0x10, 0x00]),
  121: new Uint8Array([0xe0, 0xd0, 0xa8, 0x94, 0x9a, 0x96, 0x92, 0x00]),
  122: new Uint8Array([0x10, 0x28, 0x44, 0x28, 0x10, 0x28, 0x44, 0x00]),
  123: new Uint8Array([0xe7, 0xc3, 0x24, 0xe7, 0xe7, 0xe7, 0xe7, 0xff]),
  124: new Uint8Array([0xe7, 0xe7, 0xe7, 0xe7, 0x24, 0xc3, 0xe7, 0xff]),
  125: new Uint8Array([0xe7, 0xc3, 0x24, 0xe7, 0x24, 0xc3, 0xe7, 0xff]),
  126: new Uint8Array([0xc3, 0x99, 0xf9, 0xf3, 0xe7, 0xff, 0xe7, 0xff]),
};

/**
 * Map Z-machine color to CSS color.
 */
function colorToCss(color: number): string {
  switch (color) {
    case Color.Black:
      return '#000000';
    case Color.Red:
      return '#cc0000';
    case Color.Green:
      return '#00cc00';
    case Color.Yellow:
      return '#cccc00';
    case Color.Blue:
      return '#0000cc';
    case Color.Magenta:
      return '#cc00cc';
    case Color.Cyan:
      return '#00cccc';
    case Color.White:
      return '#ffffff';
    case Color.Gray:
      return '#808080';
    default:
      return '#e0e0e0';
  }
}

/**
 * Convert true color (15-bit) to hex.
 */
function trueColorToHex(trueColor: number): string {
  const r = (trueColor & 0x1f) * 8;
  const g = ((trueColor >> 5) & 0x1f) * 8;
  const b = ((trueColor >> 10) & 0x1f) * 8;
  const toHex = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const DEFAULT_BG = '#0a0a0a';

export class WebScreen extends BaseScreen {
  private statusEl: HTMLDivElement;
  private mainEl: HTMLDivElement;
  private pictureCanvas: HTMLCanvasElement;
  private cellWidth: number;
  private cellHeight: number;
  private onQuitCallback?: () => void;
  /** When true the picture canvas provides backgrounds; HTML element BG colors are cleared. */
  private _useCanvasBackground: boolean = false;

  /**
   * V6 window-0 boundary tracking (canvas pixels, 0-based).
   * Updated by overridden resizeWindow/moveWindow; used to compute CSS padding so text
   * flows within the correct visual area and does not overlap canvas pictures.
   * _window0BaseLeft:  left  edge (default 0)
   * _window0BaseRight: right edge (-1 = not yet configured → fall back to canvas width)
   * _window0BaseTop:   top   edge (default 0); used to compute paddingTop from set_cursor
   */
  private _window0BaseLeft: number = 0;
  private _window0BaseRight: number = -1;
  private _window0BaseTop: number = 0;

  /**
   * Leftmost X (1-based, screen-absolute) of any right-side decorative picture drawn
   * during V6 layout.  Used to cap the right text boundary so text does not flow under
   * the right column/pillar picture.  -1 = not yet detected.
   */
  private _rightPillarX: number = -1;

  /**
   * V6 window-0 pictures rendered as inline <img> elements (instead of drawn
   * onto the fixed picture canvas), keyed by resource ID so erase_picture
   * can find and remove them.
   */
  private inlinePictures: Map<number, HTMLImageElement> = new Map();

  /**
   * V6 layout tracing. Off unless the page URL carries `?v6debug`, so the
   * coordinate diagnostics stay available for V6 work without spamming the
   * console during ordinary play.
   */
  private readonly _v6Debug: boolean =
    typeof location !== 'undefined' && new URLSearchParams(location.search).has('v6debug');

  /** Parallel buffer tracking which upper window positions are Font 3 */
  private upperWindowFontBuffer: boolean[][] = [];

  /** Cache of Font 3 bitmap data URLs keyed by "charCode:fg:bg" */
  private font3BitmapCache: Map<string, string> = new Map();

  /** Cached status bar cell dimensions for bitmap rendering */
  private statusBarCellDims: { width: number; height: number } | null = null;

  constructor(
    statusEl: HTMLDivElement,
    mainEl: HTMLDivElement,
    pictureCanvas: HTMLCanvasElement,
    options?: { cols?: number; rows?: number; onQuit?: () => void }
  ) {
    super('WebScreen', { logger: undefined });
    this.statusEl = statusEl;
    this.mainEl = mainEl;
    this.pictureCanvas = pictureCanvas;
    this.onQuitCallback = options?.onQuit;
    const { width: cellWidth, height: cellHeight } = this.measureCellDimensions();
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.applyWindowBackgrounds();
  }

  /** Emit a V6 layout trace line; no-op unless `?v6debug` is in the page URL. */
  private v6debug(message: string): void {
    if (this._v6Debug) {
      // eslint-disable-next-line no-console
      console.log(`[v6] ${message}`);
    }
  }

  /**
   * Call for V6 games where the picture canvas (z-index 0) provides visual
   * backgrounds. Clears CSS background colors on all HTML text elements so the
   * canvas shows through, while text rendered in those elements (z-index 1)
   * remains visible above the pictures.
   *
   * Also sets an ideal font size so that the number of text rows maps cleanly
   * to the canvas pixel coordinate space (targeting fontH = 8 canvas px/row,
   * matching classic Infocom V6 games designed for 320×200 with an 8×8 font).
   */
  enableCanvasBackground(): void {
    this._useCanvasBackground = true;

    // Status bar: transparent, no border, initially hidden until split_window is called
    this.statusEl.style.backgroundColor = 'transparent';
    this.statusEl.style.borderBottom = 'none';
    this.statusEl.style.display = 'none';

    // Main text area: transparent, no default padding/height constraints
    this.mainEl.style.backgroundColor = 'transparent';
    this.mainEl.style.minHeight = '0';

    const mainContent = this.mainEl.parentElement;
    if (mainContent) {
      mainContent.style.backgroundColor = 'transparent';
      mainContent.style.minHeight = '0';
      mainContent.style.maxHeight = 'none';
      mainContent.style.padding = '0';
      mainContent.style.overflowY = 'auto';
      // Take up all remaining vertical space between status bar and input line
      mainContent.style.flex = '1';
    }

    const gameContainer = this.statusEl.parentElement;
    if (gameContainer) {
      gameContainer.style.backgroundColor = 'transparent';
      // Stack children vertically so status bar + text area + input fill the container
      gameContainer.style.display = 'flex';
      gameContainer.style.flexDirection = 'column';
      // Note: we intentionally do NOT override the CSS font size here. The default 16px
      // font with the body's line-height:1.4 gives cellHeight≈22px and rows≈25, which
      // maps exactly to Zork Zero's 320×200 canvas at fontH=8 (200/8=25 rows). Changing
      // the font size would misalign split_window heights and set_cursor coordinates.
    }

    const inputLine = gameContainer?.querySelector('#input-line') as HTMLElement | null;
    if (inputLine) {
      inputLine.style.backgroundColor = 'transparent';
      inputLine.style.borderTop = 'none';
      inputLine.style.flexShrink = '0';
    }
    const inputField = gameContainer?.querySelector('#input-field') as HTMLInputElement | null;
    if (inputField) {
      inputField.style.backgroundColor = 'transparent';
      inputField.style.border = '1px solid rgba(255,255,255,0.3)';
    }

    // Remeasure cell dimensions with the new font size
    this.remeasureCellDimensions();

    // Fill canvas with white — the game's default background; pictures are drawn over this
    this.fillCanvasWithColor('#ffffff');
  }

  /**
   * Resolve a Z-machine color value to CSS hex for backgrounds.
   */
  private resolveBackgroundCss(color: number): string {
    if (color === Color.Default || color === Color.Current) return DEFAULT_BG;
    return color > 15 ? trueColorToHex(color) : colorToCss(color);
  }

  /**
   * Fill the entire picture canvas with a solid color.
   * Used to initialize the V6 canvas background and on erase_window calls.
   */
  private fillCanvasWithColor(color: string): void {
    const ctx = this.pictureCanvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, this.pictureCanvas.width, this.pictureCanvas.height);
  }

  /**
   * Get the CSS background color for V6 canvas fills.
   * Defaults to white (V6 games typically use a light background) when no
   * explicit color has been set by the game.
   */
  private getCanvasBgColor(): string {
    const bg = this.windowColors.get(0)?.background ?? Color.Default;
    if (bg === Color.Default || bg === Color.Current) return '#ffffff';
    return bg > 15 ? trueColorToHex(bg) : colorToCss(bg);
  }

  /**
   * Return the character-grid column count for the upper window in V6 canvas mode.
   * Classic Infocom V6 games use a square font (fontH = fontW), so the grid columns
   * = round(canvasW / fontH) = round(canvasW * rows / canvasH).
   * This gives 40 columns for Zork Zero (320×200 canvas, rows=25, fontH=8).
   */
  private getCanvasGridCols(): number {
    const canvasH = this.pictureCanvas.height;
    const canvasW = this.pictureCanvas.width;
    if (canvasH === 0 || canvasW === 0) return this.getSize().cols;
    const targetRows = Math.round(canvasH / 8); // fontH_design = 8 for classic Infocom
    const fontH = targetRows > 0 ? Math.max(1, Math.round(canvasH / targetRows)) : 1;
    return Math.max(1, Math.round(canvasW / fontH));
  }

  /**
   * Return the CSS pixel height per text row used for status bar sizing.
   * In canvas mode this is proportional to the canvas scale (container height / rows)
   * so that the status bar height matches the canvas picture coordinate space.
   * In non-canvas mode it is the measured CSS cell height.
   */
  private getStatusBarLineHeight(): number {
    const gameContainer = this.statusEl.parentElement;
    const cssContainerH = gameContainer?.clientHeight ?? 0;
    if (this._useCanvasBackground) {
      // In V6, split_window uses pixel units (not character rows) per the Z-machine spec.
      // Convert canvas pixels to CSS pixels so that split_window(n) → status bar is
      // n canvas-pixels tall and the lower-window text aligns with its canvas position.
      const canvasH = this.pictureCanvas.height;
      if (canvasH > 0 && cssContainerH > 0) return cssContainerH / canvasH;
    }
    const { rows } = this.getSize();
    // Return exact (non-floored) value so that Math.ceil(lines * lineHeight) aligns
    // the status bar bottom with the canvas lower-window boundary without any gap.
    return rows > 0 && cssContainerH > 0 ? cssContainerH / rows : this.cellHeight;
  }

  /**
   * Apply window background colors to DOM elements so empty areas match the game palette.
   * In canvas-background mode (V6 games) this is skipped — the picture canvas provides
   * all backgrounds and HTML elements must stay transparent so pictures show through.
   */
  private applyWindowBackgrounds(): void {
    if (this._useCanvasBackground) return;
    const upperBg = this.resolveBackgroundCss(this.windowColors.get(1)?.background ?? Color.Default);
    const lowerBg = this.resolveBackgroundCss(this.windowColors.get(0)?.background ?? Color.Default);
    this.statusEl.style.backgroundColor = upperBg;
    this.mainEl.style.backgroundColor = lowerBg;
    const mainContent = this.mainEl.parentElement;
    if (mainContent) mainContent.style.backgroundColor = lowerBg;
    const gameContainer = this.statusEl.parentElement;
    if (gameContainer) gameContainer.style.backgroundColor = lowerBg;
    const inputLine = gameContainer?.querySelector('#input-line') as HTMLElement | null;
    if (inputLine) {
      inputLine.style.backgroundColor = lowerBg;
      inputLine.style.color = this.resolveForegroundCss(this.windowColors.get(0)?.foreground ?? Color.Default);
    }
    const inputField = gameContainer?.querySelector('#input-field') as HTMLInputElement | null;
    if (inputField) {
      inputField.style.backgroundColor = lowerBg;
      inputField.style.color = this.resolveForegroundCss(this.windowColors.get(0)?.foreground ?? Color.Default);
    }
  }

  private resolveForegroundCss(color: number): string {
    if (color === Color.Default || color === Color.Current) return '#e0e0e0';
    return color > 15 ? trueColorToHex(color) : colorToCss(color);
  }

  setTextColors(machine: ZMachine, window: number, foreground: number, background: number): void {
    super.setTextColors(machine, window, foreground, background);
    this.applyWindowBackgrounds();
  }

  /**
   * Return the current background color for a window (used by PictureRenderer).
   */
  getBackgroundColor(windowId: number = 0): string {
    return this.resolveBackgroundCss(this.windowColors.get(windowId)?.background ?? Color.Default);
  }

  /**
   * Return the current foreground color for a window (used by input echo).
   */
  getForegroundColor(windowId: number = 0): string {
    return this.resolveForegroundCss(this.windowColors.get(windowId)?.foreground ?? Color.Default);
  }

  private measureCellDimensions(): { width: number; height: number } {
    const measureEl = document.createElement('span');
    measureEl.textContent = 'M';
    measureEl.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;white-space:pre;font:inherit;';
    this.mainEl.appendChild(measureEl);
    const width = measureEl.offsetWidth || 10;
    const height = measureEl.offsetHeight || 16;
    measureEl.remove();
    return { width, height };
  }

  private measureStatusBarCell(): { width: number; height: number } {
    if (this.statusBarCellDims) return this.statusBarCellDims;

    const measureEl = document.createElement('span');
    measureEl.textContent = 'M';
    measureEl.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:inherit;line-height:1;';
    this.statusEl.appendChild(measureEl);
    // Use getBoundingClientRect for sub-pixel accuracy — offsetWidth rounds to
    // integers which causes cumulative drift between text and images.
    const rect = measureEl.getBoundingClientRect();
    const width = rect.width || 10;
    const height = rect.height || 16;
    measureEl.remove();

    this.statusBarCellDims = { width, height };
    return this.statusBarCellDims;
  }

  /**
   * Render a Font 3 character at the exact target cell size.
   * Uses vector drawing for box/block/line characters (pixel-perfect at any size),
   * falls back to scaled 8x8 bitmap for runic and other complex glyphs.
   * Results are cached by charCode:fg:bg:w:h.
   * @param overrideW - Optional width (use when display must fit exact column count)
   * @param overrideH - Optional height (use when display must fit exact column count)
   */
  private getFont3DataUrl(charCode: number, fg: string, bg: string, overrideW?: number, overrideH?: number): string {
    const cell = this.measureStatusBarCell();
    const w = overrideW ?? Math.round(cell.width);
    const h = overrideH ?? Math.round(cell.height);
    const key = `${charCode}:${fg}:${bg}:${w}:${h}`;
    const cached = this.font3BitmapCache.get(key);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    // Line width: ~1/6th of cell width, minimum 2px for visibility (avoids 1px lines
    // disappearing on high-DPI displays and in map/box-drawing rendering)
    const lw = Math.max(2, Math.round(w / 6));

    // Try vector rendering first (handles codes 32-95 — box drawing, blocks, arrows)
    const handled = renderFont3Vector(ctx, charCode, w, h, fg, bg, lw);

    if (!handled) {
      // Fall back to scaled 8x8 bitmap for runic and special characters
      const bitmap = FONT3_BITMAP_FALLBACK[charCode];
      if (!bitmap) return '';

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = fg;
      const sx = w / 8;
      const sy = h / 8;
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          if (bitmap[row] & (0x80 >> col)) {
            ctx.fillRect(Math.floor(col * sx), Math.floor(row * sy), Math.ceil(sx), Math.ceil(sy));
          }
        }
      }
    }

    const dataUrl = canvas.toDataURL('image/png');
    this.font3BitmapCache.set(key, dataUrl);
    return dataUrl;
  }

  /**
   * Ensure the font buffer has enough lines and columns for the given position.
   */
  private ensureFontBuffer(lineIdx: number, screenWidth: number): void {
    while (this.upperWindowFontBuffer.length <= lineIdx) {
      this.upperWindowFontBuffer.push(new Array(screenWidth).fill(false));
    }
    const line = this.upperWindowFontBuffer[lineIdx];
    while (line.length < screenWidth) {
      line.push(false);
    }
  }

  getCapabilities(): Capabilities {
    return {
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
    };
  }

  getSize(): ScreenSize {
    // Use the scroll container (main-content) for dimensions so status bar and
    // upper window use the same width. Fall back to mainEl if parent unavailable.
    const container = this.mainEl.parentElement;
    const width = (container?.clientWidth ?? this.mainEl.clientWidth) || 800;
    // In V6 canvas mode, use the full game container height (includes status bar and
    // input area) so that row count maps the entire canvas coordinate space.
    const heightSource = this._useCanvasBackground ? this.statusEl.parentElement : container;
    const height = (heightSource?.clientHeight ?? this.mainEl.clientHeight) || 400;
    const cols = Math.max(40, Math.floor(width / this.cellWidth));
    const rows = Math.max(10, Math.floor(height / this.cellHeight));
    return { rows, cols };
  }

  protected initializeOutputPosition(): void {
    if (!this.startFromBottom || this.hasReceivedFirstOutput) return;
    this.hasReceivedFirstOutput = true;
  }

  private applyStylesAndColors(str: string): string {
    const windowColors = this.windowColors.get(this.outputWindowId);
    let fg = '#e0e0e0';
    let bg = this._useCanvasBackground ? 'transparent' : DEFAULT_BG;

    if (windowColors) {
      const fgVal = windowColors.foreground;
      if (fgVal !== Color.Default && fgVal !== Color.Current) {
        fg = fgVal > 15 ? trueColorToHex(fgVal) : colorToCss(fgVal);
      }
      // In canvas mode, bg is always transparent so the picture canvas shows through.
      if (!this._useCanvasBackground) {
        const bgVal = windowColors.background;
        if (bgVal !== Color.Default && bgVal !== Color.Current) {
          bg = bgVal > 15 ? trueColorToHex(bgVal) : colorToCss(bgVal);
        }
      }
    }

    const styles: string[] = [];
    if (this.currentStyles & TextStyle.Bold) styles.push('font-weight:bold');
    if (this.currentStyles & TextStyle.Italic) styles.push('font-style:italic');
    if (this.currentStyles & TextStyle.ReverseVideo) {
      if (this._useCanvasBackground) {
        // bg is transparent in canvas mode; use fg color as solid bg for visual contrast.
        bg = fg;
        fg = '#000000';
      } else {
        [fg, bg] = [bg, fg];
      }
    }

    const style = `color:${fg};background:${bg};${styles.join(';')}`;
    const parts = str.split('\n').map((line) => escapeHtml(line));
    return parts.map((line) => `<span style="${style}">${line}</span>`).join('<br>');
  }

  /**
   * Resolve foreground and background CSS colors for a given buffer position.
   * In canvas mode all backgrounds are transparent so the picture canvas shows through.
   */
  private resolveColors(
    runColor: { foreground: number; background: number },
    runStyle: number
  ): { fg: string; bg: string } {
    let fg = runColor.foreground > 15 ? trueColorToHex(runColor.foreground) : colorToCss(runColor.foreground);
    if (runColor.foreground === Color.Default || runColor.foreground === Color.Current) fg = '#e0e0e0';

    let bg: string;
    if (this._useCanvasBackground) {
      // Canvas provides all backgrounds — HTML elements stay transparent
      bg = 'transparent';
    } else {
      bg = runColor.background > 15 ? trueColorToHex(runColor.background) : colorToCss(runColor.background);
      if (runColor.background === Color.Default || runColor.background === Color.Current) bg = DEFAULT_BG;
    }

    if (runStyle & TextStyle.ReverseVideo) {
      if (this._useCanvasBackground) {
        // bg is transparent; use fg color as solid bg highlight with contrasting text
        bg = fg;
        fg = '#000000';
      } else {
        [fg, bg] = [bg, fg];
      }
    }
    return { fg, bg };
  }

  private renderStyledUpperWindow(): string {
    const defaultColor = { foreground: Color.Default, background: Color.Default };
    // In V6 canvas mode, use the canvas-grid column count (e.g. 40 for Zork Zero 320×200)
    // so that character cells align with canvas pixel positions. In non-canvas mode, use
    // the CSS character count from getSize().
    const cols = this._useCanvasBackground ? this.getCanvasGridCols() : this.getSize().cols;
    const cell = this.measureStatusBarCell();
    // Use the status bar's actual width (where content renders) so cols * imgW fits exactly.
    // Using main-content's width can mismatch when scrollbars differ between siblings.
    const statusBarWidth = this.statusEl.clientWidth || 800;
    const imgW = statusBarWidth / cols;
    const imgH = cell.height;
    const fontSize = parseFloat(getComputedStyle(this.statusEl).fontSize) || 16;
    const lines: string[] = [];

    for (let lineIdx = 0; lineIdx < this.upperWindowBuffer.length; lineIdx++) {
      // Normalize line to exactly screen width so all rows align consistently
      let textLine = this.upperWindowBuffer[lineIdx];
      if (textLine.length < cols) {
        textLine = textLine + ' '.repeat(cols - textLine.length);
      } else if (textLine.length > cols) {
        textLine = textLine.substring(0, cols);
      }
      const styleLine = lineIdx < this.upperWindowStyleBuffer.length ? this.upperWindowStyleBuffer[lineIdx] : [];
      const colorLine = lineIdx < this.upperWindowColorBuffer.length ? this.upperWindowColorBuffer[lineIdx] : [];
      const fontLine = lineIdx < this.upperWindowFontBuffer.length ? this.upperWindowFontBuffer[lineIdx] : [];

      let result = '';
      let runStart = 0;

      while (runStart < textLine.length) {
        const runStyle = runStart < styleLine.length ? styleLine[runStart] : 0;
        const runColor = runStart < colorLine.length ? colorLine[runStart] : defaultColor;
        const isFont3 = runStart < fontLine.length ? fontLine[runStart] : false;

        if (isFont3) {
          // Render this character as a canvas-rendered image at exact cell dimensions
          const charCode = textLine.charCodeAt(runStart);
          const { fg, bg } = this.resolveColors(runColor, runStyle);
          // Use floor so canvas is never larger than display; scaling up avoids overflow at boundaries
          const canvasW = Math.max(1, Math.floor(imgW));
          const canvasH = Math.max(1, Math.floor(imgH));
          const dataUrl = this.getFont3DataUrl(charCode, fg, bg, canvasW, canvasH);
          if (dataUrl) {
            result += `<img src="${dataUrl}" style="width:${imgW}px;height:${imgH}px;vertical-align:top;image-rendering:pixelated" />`;
          } else {
            // Fallback: render as text span
            result += `<span style="color:${fg};background:${bg}">${escapeHtml(textLine[runStart])}</span>`;
          }
          runStart++;
        } else {
          // Group consecutive non-Font3 characters with same style/color
          let runEnd = runStart + 1;
          while (runEnd < textLine.length) {
            const nextStyle = runEnd < styleLine.length ? styleLine[runEnd] : 0;
            const nextColor = runEnd < colorLine.length ? colorLine[runEnd] : defaultColor;
            const nextIsFont3 = runEnd < fontLine.length ? fontLine[runEnd] : false;
            if (
              nextIsFont3 ||
              nextStyle !== runStyle ||
              nextColor.foreground !== runColor.foreground ||
              nextColor.background !== runColor.background
            ) {
              break;
            }
            runEnd++;
          }

          const runText = escapeHtml(textLine.substring(runStart, runEnd));
          const { fg, bg } = this.resolveColors(runColor, runStyle);
          const runLen = runEnd - runStart;
          const st: string[] = [`color:${fg}`, `background:${bg}`];
          if (runStyle & TextStyle.Bold) st.push('font-weight:bold');
          if (runStyle & TextStyle.Italic) st.push('font-style:italic');
          // Fix "character short": text must use imgW per char so rows with text align with
          // rows of all-Font3 (horizontal borders). Otherwise the right │ ends up left of where
          // the horizontal lines terminate.
          st.push(`display:inline-block`, `width:${runLen * imgW}px`, `overflow:hidden`, `white-space:nowrap`);
          result += `<span style="${st.join(';')};font-size:${fontSize}px">${runText}</span>`;
          runStart = runEnd;
        }
      }

      // font-size:0 on the div eliminates inline whitespace between images;
      // each child span restores the real font-size.
      lines.push(`<div style="font-size:0;height:${imgH}px">${result}</div>`);
    }

    return lines.join('');
  }

  print(machine: ZMachine, str: string): void {
    if (this.isMemoryStreamActive()) {
      this.writeToMemoryStream(machine, str);
      return;
    }

    // Respect output_stream -1: when screen output is disabled, drop the text
    if (!this.isScreenOutputEnabled()) {
      return;
    }

    const isFont3 = this.isCurrentFontFont3();

    if (this.outputWindowId === 0) {
      // Lower window: translate Font 3 to Unicode for display
      const textToDisplay = isFont3 ? translateFont3Text(str) : str;

      if (!this.hasReceivedFirstOutput && this.startFromBottom) {
        this.initializeOutputPosition();
        this.hasReceivedFirstOutput = true;
      }

      const styled = this.applyStylesAndColors(textToDisplay);
      const span = document.createElement('span');
      span.innerHTML = styled;
      this.mainEl.appendChild(span);
      // Scroll the parent container (#main-content), not the text div
      const scrollContainer = this.mainEl.parentElement;
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    } else {
      // Upper window: store raw chars and track Font 3 positions for bitmap rendering.
      // In V6 canvas mode, buffer width uses the canvas-grid column count so character
      // positions align with canvas pixel coordinates after set_cursor conversion.
      const screenWidth = this._useCanvasBackground ? this.getCanvasGridCols() : this.getSize().cols;

      // Record font state per character position before writing to the buffer.
      // Mirror the cursor tracking from writeToUpperWindowBuffer so we know
      // exactly which positions get Font 3 characters.
      let line = this.cursorPosition.line;
      let col = this.cursorPosition.column;
      for (const char of str) {
        if (char === '\n') {
          line++;
          col = 1;
          continue;
        }
        const lineIdx = line - 1;
        const colIdx = col - 1;
        if (colIdx < screenWidth) {
          this.ensureFontBuffer(lineIdx, screenWidth);
          this.upperWindowFontBuffer[lineIdx][colIdx] = isFont3;
        }
        col = Math.min(col + 1, screenWidth + 1);
      }

      // Write raw (untranslated) text to the buffer
      this.writeToUpperWindowBuffer(str, screenWidth);

      // Expand status bar if buffer lines exceed the current split height.
      // In canvas mode, use the canvas-proportional line height so expansion
      // doesn't break the coordinate alignment set by splitWindow().
      const bufferLines = this.upperWindowBuffer.length;
      const lineHeightPx = this._useCanvasBackground ? this.getStatusBarLineHeight() : this.cellHeight;
      const currentMinHeight = Math.round(parseFloat(this.statusEl.style.minHeight || '0') / lineHeightPx);
      if (bufferLines > currentMinHeight) {
        this.statusEl.style.minHeight = `${Math.ceil(bufferLines * lineHeightPx)}px`;
      }

      this.statusEl.innerHTML = this.renderStyledUpperWindow();
    }
  }

  splitWindow(machine: ZMachine, lines: number): void {
    super.splitWindow(machine, lines);

    if (lines === 0) {
      this.statusEl.style.display = 'none';
    } else {
      this.statusEl.style.display = 'block';
      if (this._useCanvasBackground) {
        // V6: map canvas-row count to CSS pixels proportionally to canvas scaling.
        // Use Math.ceil so the status bar bottom edge is never below the canvas header boundary.
        this.statusEl.style.minHeight = `${Math.ceil(lines * this.getStatusBarLineHeight())}px`;
      } else {
        this.statusEl.style.minHeight = `${lines * this.cellHeight}px`;
      }
    }
  }

  override setCursorPosition(machine: ZMachine, line: number, column: number, windowId: number): void {
    // In V6 canvas mode, set_cursor(row, col, 0) positions the HTML text start within window 0
    // (e.g. below the room illustration drawn at the top of the window).  Intercept the raw
    // pixel coordinates here before BaseScreen converts them to character-cell units.
    if (this._useCanvasBackground && machine.state.version >= 6 && windowId === 0) {
      // line is a 1-based canvas-pixel row within window 0; make it screen-absolute.
      const canvasAbsY = this._window0BaseTop + line - 1;
      const lineHeight = this.getStatusBarLineHeight(); // CSS pixels per canvas pixel
      const cssY = canvasAbsY * lineHeight;
      const statusBarCssH = parseFloat(this.statusEl.style.minHeight || '0');
      const paddingTop = Math.max(0, cssY - statusBarCssH);
      this.mainEl.style.paddingTop = `${paddingTop.toFixed(1)}px`;
      this.v6debug(
        `[set_cursor] window=0 line=${line} col=${column} canvasAbsY=${canvasAbsY} cssY=${cssY.toFixed(1)} paddingTop=${paddingTop.toFixed(1)}`
      );
      return;
    }
    super.setCursorPosition(machine, line, column, windowId);
  }

  override setOutputWindow(machine: ZMachine, windowId: number): void {
    super.setOutputWindow(machine, windowId);
    // When switching to the lower window, re-apply any stored window-0 margins.
    // V6 games (e.g. Zork Zero) sometimes call set_margins while outputWindow is 1
    // (upper), which means the CSS padding was not applied at call time.  Reapplying
    // here ensures the margins take effect as soon as text starts flowing in window 0.
    if (this._useCanvasBackground && windowId === 0) {
      const left = this.windowManager.getWindowProperty(0, WindowProperty.LeftMargin);
      const right = this.windowManager.getWindowProperty(0, WindowProperty.RightMargin);
      this.applyLowerWindowMarginsCss(left, right);
    }
  }

  override resizeWindow(machine: ZMachine, windowId: number, height: number, width: number): void {
    super.resizeWindow(machine, windowId, height, width);
    if (this._useCanvasBackground && windowId === 0) {
      const newRight = this._window0BaseLeft + width;
      // Only advance the right boundary when the window grows wider.  V6 games
      // (e.g. Zork Zero) sometimes shrink window 0 to a narrow inline-picture
      // sub-region before drawing a floating picture, then restore it.  Using
      // the maximum width ever set prevents that temporary narrowing from
      // squeezing the text area.
      if (this._window0BaseRight < 0 || newRight > this._window0BaseRight) {
        this._window0BaseRight = newRight;
        this.v6debug(`[resize_window] window=0 h=${height} w=${width} rightEdge=${this._window0BaseRight}`);
        const left = this.windowManager.getWindowProperty(0, WindowProperty.LeftMargin);
        const right = this.windowManager.getWindowProperty(0, WindowProperty.RightMargin);
        this.applyLowerWindowMarginsCss(left, right);
      } else {
        this.v6debug(
          `[resize_window] window=0 h=${height} w=${width} (ignored – would narrow from ${this._window0BaseRight})`
        );
      }
    }
  }

  override moveWindow(machine: ZMachine, windowId: number, y: number, x: number): void {
    super.moveWindow(machine, windowId, y, x);
    if (this._useCanvasBackground && windowId === 0) {
      // x and y are 1-based; convert to 0-based canvas pixels
      const oldLeft = this._window0BaseLeft;
      this._window0BaseLeft = x - 1;
      this._window0BaseTop = y - 1;
      if (this._window0BaseRight >= 0) {
        this._window0BaseRight += this._window0BaseLeft - oldLeft;
      }
      this.v6debug(
        `[move_window] window=0 y=${y} x=${x} top=${this._window0BaseTop} left=${this._window0BaseLeft} right=${this._window0BaseRight}`
      );
      const left = this.windowManager.getWindowProperty(0, WindowProperty.LeftMargin);
      const right = this.windowManager.getWindowProperty(0, WindowProperty.RightMargin);
      this.applyLowerWindowMarginsCss(left, right);
    }
  }

  override setWindowMargins(machine: ZMachine, left: number, right: number, windowId?: number): void {
    super.setWindowMargins(machine, left, right, windowId);
    const targetWindow = windowId ?? this.outputWindowId;
    if (this._useCanvasBackground && targetWindow === 0) {
      this.applyLowerWindowMarginsCss(left, right);
    }
  }

  /**
   * Called from main.ts's pictureRenderer callback when a picture is drawn to the right
   * of the canvas centre.  Tracks the leftmost such X position (1-based, screen-absolute)
   * so that text does not flow under the decorative right-column picture.
   */
  trackRightPicture(screenX: number): void {
    if (this._rightPillarX < 0 || screenX < this._rightPillarX) {
      this._rightPillarX = screenX;
      this.v6debug(`[trackRightPicture] rightPillarX=${this._rightPillarX}`);
      // Re-apply margins with updated right boundary (margins values not re-fetched here;
      // the next set_margins call will pick up the new boundary automatically).
    }
  }

  /**
   * Insert a V6 window-0 picture as a real inline image in the scrolling
   * text flow, instead of drawing it onto the fixed picture canvas. As real
   * DOM content it scrolls with the surrounding text automatically. Floats
   * within the column the game has already narrowed via set_margins (see
   * applyLowerWindowMarginsCss), so text wraps around it the same way it
   * already wraps around canvas-drawn pictures in other windows.
   */
  async displayInlinePicture(
    resourceId: number,
    data: Buffer,
    format: string,
    x: number,
    _y: number,
    scale: number
  ): Promise<void> {
    const blob = new Blob([new Uint8Array(data).buffer], {
      type: format === 'PNG' ? 'image/png' : 'image/jpeg',
    });
    const bitmap = await createImageBitmap(blob);

    const img = document.createElement('img');
    img.src = URL.createObjectURL(blob);
    img.onload = (): void => URL.revokeObjectURL(img.src);
    img.style.imageRendering = 'pixelated';

    const canvasW = this.pictureCanvas.width;
    if (canvasW === 0) {
      this.mainEl.appendChild(img);
      this.inlinePictures.set(resourceId, img);
      return;
    }

    const scaleFactor = scale / 100;
    const widthPx = bitmap.width * scaleFactor;
    img.style.width = `${(widthPx / canvasW) * 100}%`;
    img.style.height = 'auto';

    const columnLeft = this._window0BaseLeft;
    const columnRight = this._window0BaseRight >= 0 ? this._window0BaseRight : canvasW;
    const columnMid = (columnLeft + columnRight) / 2;

    if (x <= columnMid) {
      img.style.float = 'left';
      img.style.marginLeft = `${(Math.max(0, x - columnLeft) / canvasW) * 100}%`;
    } else {
      img.style.float = 'right';
      img.style.marginRight = `${(Math.max(0, columnRight - (x + widthPx)) / canvasW) * 100}%`;
    }

    this.mainEl.appendChild(img);
    this.inlinePictures.set(resourceId, img);
  }

  /**
   * Remove a previously inserted inline picture (erase_picture for window 0).
   * Returns true if a matching inline picture was found and removed, so the
   * caller can fall back to the canvas eraser for pictures drawn elsewhere.
   */
  eraseInlinePicture(resourceId: number): boolean {
    const img = this.inlinePictures.get(resourceId);
    if (!img) return false;
    img.remove();
    this.inlinePictures.delete(resourceId);
    return true;
  }

  private applyLowerWindowMarginsCss(leftInlinePx: number, rightInlinePx: number): void {
    const canvasW = this.pictureCanvas.width;
    if (canvasW === 0) return;
    // Combine the window's own left edge (from move_window) with any inline picture
    // margin (from set_margins) to get the total left offset for text flow.
    const effectiveLeftPx = this._window0BaseLeft + leftInlinePx;
    // Right text boundary: use the window's configured right edge, but cap it at the
    // left edge of any right-side decorative picture (e.g. the right column/pillar).
    // In V6 layouts the window may be sized wider than the visual text column because
    // the original interpreter drew the pillar on top; in CSS we need explicit padding.
    const windowRight = this._window0BaseRight >= 0 ? this._window0BaseRight : canvasW;
    // _rightPillarX is 1-based screen-absolute; convert to 0-based exclusive right limit.
    const pillarRight = this._rightPillarX >= 0 ? this._rightPillarX - 1 : canvasW;
    const effectiveRight = Math.min(windowRight, pillarRight);
    const effectiveRightPx = canvasW - effectiveRight + rightInlinePx;
    // Use percentage-based padding so margins scale with the container and work
    // correctly even before the DOM has been laid out (clientWidth may be 0 during
    // the synchronous execution that processes the first set_margins opcode).
    const leftPct = (effectiveLeftPx / canvasW) * 100;
    const rightPct = (effectiveRightPx / canvasW) * 100;
    this.v6debug(
      `[margins] left=${effectiveLeftPx}px (${leftPct.toFixed(1)}%) right=${effectiveRightPx}px (${rightPct.toFixed(1)}%) canvas=${canvasW}`
    );
    this.mainEl.style.paddingLeft = `${leftPct.toFixed(2)}%`;
    this.mainEl.style.paddingRight = `${rightPct.toFixed(2)}%`;
  }

  clearWindow(machine: ZMachine, windowId: number): void {
    super.clearWindow(machine, windowId);

    // In canvas mode, fill the cleared area with the background color so the
    // canvas reflects the game's intended background (typically white for V6).
    if (this._useCanvasBackground) {
      const bgColor = this.getCanvasBgColor();
      const ctx = this.pictureCanvas.getContext('2d');
      if (ctx) {
        if (windowId === -1 || windowId === -2) {
          // Full screen clear: fill entire canvas
          this.fillCanvasWithColor(bgColor);
        } else if (windowId === 0) {
          // Lower window clear: fill only the lower window area so header pictures persist.
          // In V6 canvas mode, split_window uses pixel units, so upperWindowHeight is already
          // the canvas-pixel Y where the lower window begins — use it directly.
          ctx.fillStyle = bgColor;
          ctx.fillRect(
            0,
            this.upperWindowHeight,
            this.pictureCanvas.width,
            this.pictureCanvas.height - this.upperWindowHeight
          );
        }
      }
    }

    if (windowId === -1) {
      // Clear both windows and unsplit
      this.mainEl.innerHTML = '';
      this.mainEl.style.paddingTop = '';
      this.inlinePictures.clear();
      this.statusEl.innerHTML = '';
      this.statusEl.style.display = 'none';
      this.statusEl.style.minHeight = '';
      this.upperWindowFontBuffer = [];
    } else if (windowId === -2) {
      // Clear both windows but preserve split state
      this.mainEl.innerHTML = '';
      this.mainEl.style.paddingTop = '';
      this.inlinePictures.clear();
      this.statusEl.innerHTML = '';
      this.upperWindowFontBuffer = [];
    } else if (windowId === 0) {
      this.mainEl.innerHTML = '';
      this.mainEl.style.paddingTop = '';
      this.inlinePictures.clear();
    } else if (windowId === 1) {
      this.statusEl.innerHTML = '';
      this.upperWindowFontBuffer = [];
    }
  }

  clearLine(machine: ZMachine, value: number): void {
    // Clear font buffer for the affected positions (matching parent's clearLine behavior)
    if (this.outputWindowId === 1) {
      const lineIdx = this.cursorPosition.line - 1;
      const colIdx = this.cursorPosition.column - 1;
      if (lineIdx >= 0 && lineIdx < this.upperWindowFontBuffer.length) {
        const fontLine = this.upperWindowFontBuffer[lineIdx];
        for (let i = colIdx; i < fontLine.length; i++) {
          fontLine[i] = false;
        }
      }
    }
    super.clearLine(machine, value);
    if (this.outputWindowId === 1) {
      this.statusEl.innerHTML = this.renderStyledUpperWindow();
    }
  }

  updateStatusBar(locationName: string | null, value1: number, value2: number, isTimeMode: boolean): void {
    const width = this.getSize().cols;
    const line = this.formatStatusBarLine(locationName, value1, value2, isTimeMode, width);
    this.statusEl.innerHTML = `<div style="white-space:pre;color:#fff;background:#333;">${escapeHtml(line)}</div>`;
  }

  hideCursor(_machine: ZMachine, _windowId: number): void {
    // Cursor visibility handled by input processor
  }

  showCursor(_machine: ZMachine, _windowId: number): void {
    // Cursor visibility handled by input processor
  }

  quit(): void {
    this.onQuitCallback?.();
  }

  getPictureCanvas(): HTMLCanvasElement {
    return this.pictureCanvas;
  }

  getCellDimensions(): { width: number; height: number } {
    return { width: this.cellWidth, height: this.cellHeight };
  }

  /**
   * Resize the upper window buffer for a new screen width and redraw.
   * Called when the viewport size changes.
   */
  handleResize(): void {
    const { cols } = this.getSize();
    const resized = this.resizeUpperWindowBuffer(cols);
    if (resized !== null) {
      // Resize font buffer to match
      this.upperWindowFontBuffer = this.upperWindowFontBuffer.map((line) => {
        if (line.length < cols) {
          return [...line, ...new Array(cols - line.length).fill(false)];
        }
        return line.slice(0, cols);
      });
      this.statusEl.innerHTML = this.renderStyledUpperWindow();
    }
  }

  /**
   * Remeasure cell dimensions after a font size change.
   * Returns the new dimensions for callers that need to update (e.g. PictureRenderer).
   */
  remeasureCellDimensions(): { width: number; height: number } {
    const { width, height } = this.measureCellDimensions();
    this.cellWidth = width;
    this.cellHeight = height;
    // Clear bitmap cache and cached cell dims since font size changed
    this.font3BitmapCache.clear();
    this.statusBarCellDims = null;
    return { width, height };
  }
}
