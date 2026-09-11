import { Buffer } from 'buffer';
(globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;

// Polyfill process for browser (Logger checks process.stdout.isTTY)
if (typeof (globalThis as unknown as { process?: unknown }).process === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).process = { stdout: { isTTY: false } };
}

// Polyfill setImmediate for browser (Executor uses it to defer input setup)
if (typeof (globalThis as unknown as Record<string, unknown>).setImmediate === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).setImmediate = (cb: () => void) => setTimeout(cb, 0);
}

import {
  BlorbMultimediaHandler,
  BlorbParser,
  BrowserStorageProvider,
  HeaderLocation,
  Logger,
  LogLevel,
  MemoryStorageProvider,
  ZMachine,
} from 'rezrov-zmachine';
import { PictureRenderer } from './PictureRenderer';
import { SoundPlayer } from './SoundPlayer';
import { WebInputProcessor } from './WebInputProcessor';
import { WebScreen } from './WebScreen';

function bufferFromArrayBuffer(ab: ArrayBuffer): Buffer {
  return Buffer.from(new Uint8Array(ab));
}

function isBlorb(data: ArrayBuffer | Buffer): boolean {
  const buf = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  if (buf.length < 12) return false;
  const form = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
  const type = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
  return form === 'FORM' && type === 'IFRS';
}

function getBasename(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(0, lastDot) : filename;
}

async function readFileAsBuffer(file: File): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(bufferFromArrayBuffer(reader.result as ArrayBuffer));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

interface GameSession {
  machine: ZMachine;
  inputProcessor: WebInputProcessor;
  pictureRenderer: PictureRenderer;
  soundPlayer: SoundPlayer;
  resizeObserver: ResizeObserver;
}

let currentSession: GameSession | null = null;

function stopSession(): void {
  if (!currentSession) return;

  const { machine, inputProcessor, pictureRenderer, soundPlayer, resizeObserver } = currentSession;

  machine.quit();
  inputProcessor.cancelInput(machine);
  resizeObserver.disconnect();
  pictureRenderer.clear((machine.screen as import('./WebScreen').WebScreen).getBackgroundColor(0));
  soundPlayer.stopSound(0); // 0 = stop all sounds

  currentSession = null;
}

function setupGame(
  storyData: Buffer,
  blorbData: Buffer | null,
  statusEl: HTMLDivElement,
  mainEl: HTMLDivElement,
  pictureCanvas: HTMLCanvasElement,
  inputEl: HTMLInputElement
): void {
  Logger.setLevel(LogLevel.INFO);

  const screen = new WebScreen(statusEl, mainEl, pictureCanvas, {
    onQuit: stopSession,
  });
  const inputProcessor = new WebInputProcessor(screen, inputEl, mainEl);

  // PictureRenderer uses direct pixel coordinates; no cell dimensions needed.
  const pictureRenderer = new PictureRenderer(pictureCanvas);
  const soundPlayer = new SoundPlayer();

  let multimediaHandler: BlorbMultimediaHandler | undefined;
  let blorbMap: ReturnType<typeof BlorbParser.parse> | null = null;

  if (blorbData && isBlorb(blorbData)) {
    blorbMap = BlorbParser.parse(blorbData);
    const webScreen = screen as import('./WebScreen').WebScreen;
    multimediaHandler = new BlorbMultimediaHandler(blorbMap, blorbData, {
      pictureRenderer: async (resourceId, data, format, x, y, scale) => {
        // Track right-side pictures synchronously (before async image load) so that
        // the right text boundary is set before any subsequent set_margins opcode runs.
        if (x > pictureCanvas.width / 2) {
          webScreen.trackRightPicture(x);
        }
        await pictureRenderer.displayPicture(resourceId, data, format, x, y, scale);
      },
      pictureEraser: (resourceId) => pictureRenderer.erasePicture(resourceId, webScreen.getBackgroundColor(0)),
      soundPlayer: (resourceId, data, format, volume, repeats) =>
        soundPlayer.playSound(resourceId, data, format, volume, repeats),
    });
  }

  const storageProvider =
    typeof localStorage !== 'undefined' ? new BrowserStorageProvider() : new MemoryStorageProvider();
  const machine = new ZMachine(storyData, screen, inputProcessor, multimediaHandler, storageProvider);

  if (blorbMap && blorbData && multimediaHandler) {
    machine.setBlorb(blorbMap, blorbData, multimediaHandler);
  }

  // For V6 games the picture canvas (z-index 0) provides all visual backgrounds.
  // Make the HTML text elements transparent so pictures show through them while
  // their text content remains visible above via z-index 1.
  if (machine.state.version >= 6) {
    screen.enableCanvasBackground();
  }

  // After the HTML change the canvas is a direct child of #game-container.
  const gameContainerEl = pictureCanvas.parentElement as HTMLElement;

  const resizeObserver = new ResizeObserver(() => {
    const { rows, cols } = screen.getSize();
    const version = machine.state.version;
    machine.memory.setByte(HeaderLocation.ScreenHeightInLines, rows);
    machine.memory.setByte(HeaderLocation.ScreenWidthInChars, cols);
    if (version >= 5) {
      if (version < 6) {
        // V5: units are character cells — update when char count changes.
        machine.memory.setWord(HeaderLocation.ScreenWidthInUnits, cols);
        machine.memory.setWord(HeaderLocation.ScreenHeightInUnits, rows);
      }
      // V6: pixel-based units stay fixed at the canvas's initial pixel dimensions.
    }
    screen.handleResize();
  });

  resizeObserver.observe(gameContainerEl);

  // Set initial dimensions in header before execution (ZMachine constructor may
  // have run before layout; ResizeObserver callback is async).
  const { rows, cols } = screen.getSize();
  const { width: cellWidth, height: cellHeight } = screen.getCellDimensions();
  machine.memory.setByte(HeaderLocation.ScreenHeightInLines, rows);
  machine.memory.setByte(HeaderLocation.ScreenWidthInChars, cols);
  if (machine.state.version >= 5) {
    const isV6 = machine.state.version >= 6;
    // V6: units are pixels — report the canvas's actual pixel dimensions.
    // V5: units are character cells.
    machine.memory.setWord(HeaderLocation.ScreenWidthInUnits, isV6 ? pictureCanvas.width : cols);
    machine.memory.setWord(HeaderLocation.ScreenHeightInUnits, isV6 ? pictureCanvas.height : rows);
    if (isV6) {
      // V6: font dimensions are in canvas pixel units (screen units = pixels).
      // fontH = canvas height / row count derived from CSS layout at the current font size.
      // fontW = fontH (classic Infocom V6 games use a square 8×8 character grid, e.g. Zork Zero
      // at 320×200 with 25 rows × 40 cols). This ensures set_cursor pixel coordinates convert
      // to character cells correctly in BaseScreen.setCursorPosition().
      const fontH = rows > 0 ? Math.max(1, Math.round(pictureCanvas.height / rows)) : 1;
      const fontW = fontH; // Square font assumption for classic Infocom V6 games
      machine.memory.setByte(HeaderLocation.FontWidthInUnits, Math.min(255, fontW));
      machine.memory.setByte(HeaderLocation.FontHeightInUnits, Math.min(255, fontH));
    } else {
      // V5: font dimensions in CSS pixels (character cells).
      machine.memory.setByte(HeaderLocation.FontWidthInUnits, Math.min(255, Math.round(cellWidth)));
      machine.memory.setByte(HeaderLocation.FontHeightInUnits, Math.min(255, Math.round(cellHeight)));
    }
  }

  currentSession = {
    machine,
    inputProcessor,
    pictureRenderer,
    soundPlayer,
    resizeObserver,
  };

  machine.execute();
}

function findCompanionBlorb(files: File[]): { story: File; blorb: File } | null {
  const storyExt = ['.z1', '.z2', '.z3', '.z4', '.z5', '.z6', '.z7', '.z8'];
  const blorbExt = ['.blb', '.blorb'];

  for (const file of files) {
    const ext = file.name.includes('.') ? '.' + file.name.split('.').pop()?.toLowerCase() : '';
    if (!storyExt.includes(ext)) continue;

    const base = getBasename(file.name);
    const companion = files.find((f) => {
      const e = f.name.includes('.') ? '.' + f.name.split('.').pop()?.toLowerCase() : '';
      return blorbExt.includes(e) && getBasename(f.name) === base;
    });

    if (companion) {
      return { story: file, blorb: companion };
    }
  }
  return null;
}

function findStoryAndBlorb(files: File[]): { story: File; blorb: File | null } | null {
  const pair = findCompanionBlorb(files);
  if (pair) return pair;

  const storyExt = ['.z1', '.z2', '.z3', '.z4', '.z5', '.z6', '.z7', '.z8'];
  const story = files.find((f) => {
    const ext = f.name.includes('.') ? '.' + f.name.split('.').pop()?.toLowerCase() : '';
    return storyExt.includes(ext);
  });
  if (story) return { story, blorb: null };

  return null;
}

async function handleFileSelect(files: FileList | null): Promise<void> {
  if (!files || files.length === 0) return;

  stopSession();

  const statusEl = document.getElementById('status-bar') as HTMLDivElement;
  const mainEl = document.getElementById('text-output') as HTMLDivElement;
  const pictureCanvas = document.getElementById('picture-layer') as HTMLCanvasElement;
  const inputEl = document.getElementById('input-field') as HTMLInputElement;
  const gameContainer = document.getElementById('game-container') as HTMLDivElement;

  gameContainer.style.display = 'block';
  // Reset game container height (may have been set by a previous V6 game)
  gameContainer.style.height = '';
  mainEl.innerHTML = '';
  statusEl.innerHTML = '';
  // Reset status bar styles from previous game (e.g. multi-line upper window)
  statusEl.style.minHeight = '';
  statusEl.style.display = '';
  inputEl.value = '';
  inputEl.placeholder = '';
  inputEl.disabled = false;

  let storyData: Buffer;
  let blorbData: Buffer | null = null;
  let blorbMap: ReturnType<typeof BlorbParser.parse> | null = null;

  if (files.length === 1) {
    const file = files[0];
    const data = await readFileAsBuffer(file);

    if (isBlorb(data)) {
      blorbMap = BlorbParser.parse(data);
      const exec = BlorbParser.getExecData(blorbMap, data);
      storyData = exec ?? data;
      blorbData = data;
    } else {
      storyData = data;
    }
  } else {
    const result = findStoryAndBlorb(Array.from(files));
    if (!result) {
      alert('No story file found. Please select a .z1-.z8 story file, or a folder containing one.');
      return;
    }

    storyData = await readFileAsBuffer(result.story);
    blorbData = result.blorb ? await readFileAsBuffer(result.blorb) : null;
    if (blorbData && isBlorb(blorbData)) {
      blorbMap = BlorbParser.parse(blorbData);
    }
  }

  // Check for a Blorb Reso chunk to determine the game's native pixel resolution.
  // V6 games store their intended display resolution here. If found, size the canvas
  // to the native resolution and use CSS to scale it to fill the container — this
  // ensures draw_picture coordinates map 1:1 to canvas pixels at the correct scale.
  let v6NativeWidth = 0;
  let v6NativeHeight = 0;
  if (blorbMap && blorbData) {
    const resoData = BlorbParser.getChunkByType(blorbMap, blorbData, 'Reso');
    if (resoData && resoData.length >= 8) {
      v6NativeWidth = resoData.readUInt32BE(0);
      v6NativeHeight = resoData.readUInt32BE(4);
    }
  }

  const rect = gameContainer.getBoundingClientRect();

  if (v6NativeWidth > 0 && v6NativeHeight > 0) {
    // V6 native resolution: set canvas to game's pixel space; CSS scales it to fill container.
    // The canvas draws at native resolution (e.g. 320×200); CSS scales it up to the container.
    pictureCanvas.width = v6NativeWidth;
    pictureCanvas.height = v6NativeHeight;
    pictureCanvas.style.width = '100%';
    pictureCanvas.style.height = '100%';
    // Use pixelated rendering so scaled-up pixel art stays crisp rather than blurry.
    pictureCanvas.style.imageRendering = 'pixelated';
    // Force the container to maintain the game's native aspect ratio.
    const aspectHeight = Math.round((rect.width * v6NativeHeight) / v6NativeWidth);
    gameContainer.style.height = `${aspectHeight}px`;
  } else {
    // Non-V6 or no Reso chunk: size canvas to fit the container as-is.
    pictureCanvas.width = rect.width;
    pictureCanvas.height = rect.height;
    pictureCanvas.style.width = '';
    pictureCanvas.style.height = '';
    pictureCanvas.style.imageRendering = '';
  }

  setupGame(storyData, blorbData, statusEl, mainEl, pictureCanvas, inputEl);
}

function init(): void {
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const dirInput = document.getElementById('dir-input') as HTMLInputElement;
  const fontSizeSelect = document.getElementById('font-size') as HTMLSelectElement;
  const gameContainer = document.getElementById('game-container') as HTMLDivElement;

  fileInput.addEventListener('change', () => {
    handleFileSelect(fileInput.files);
    fileInput.value = '';
  });

  dirInput.addEventListener('change', () => {
    handleFileSelect(dirInput.files);
    dirInput.value = '';
  });

  fontSizeSelect.addEventListener('change', () => {
    const size = fontSizeSelect.value + 'px';
    gameContainer.style.fontSize = size;

    if (!currentSession) return;
    const { machine } = currentSession;

    // Recalculate cell dimensions after font size change.
    const screen = machine.screen as import('./WebScreen').WebScreen;
    const { width: cellWidth, height: cellHeight } = screen.remeasureCellDimensions();

    // Update character-count header fields (these change when font size changes).
    const { rows, cols } = screen.getSize();
    machine.memory.setByte(HeaderLocation.ScreenHeightInLines, rows);
    machine.memory.setByte(HeaderLocation.ScreenWidthInChars, cols);
    if (machine.state.version >= 5) {
      if (machine.state.version < 6) {
        // V5: units are character cells — update to new char counts.
        machine.memory.setWord(HeaderLocation.ScreenWidthInUnits, cols);
        machine.memory.setWord(HeaderLocation.ScreenHeightInUnits, rows);
        // V5: font dimensions in CSS pixels.
        machine.memory.setByte(HeaderLocation.FontWidthInUnits, Math.min(255, Math.round(cellWidth)));
        machine.memory.setByte(HeaderLocation.FontHeightInUnits, Math.min(255, Math.round(cellHeight)));
      } else {
        // V6: pixel-based ScreenWidthInUnits/ScreenHeightInUnits are fixed to the canvas
        // pixel dimensions and do not change when the font size changes.
        // Font dimensions: fontH = canvasH / rows, fontW = fontH (square font assumption).
        const pictureCanvas = (machine.screen as import('./WebScreen').WebScreen).getPictureCanvas();
        const fontH = rows > 0 ? Math.max(1, Math.round(pictureCanvas.height / rows)) : 1;
        const fontW = fontH; // Square font: Infocom V6 games use 8×8 pixel characters
        machine.memory.setByte(HeaderLocation.FontWidthInUnits, Math.min(255, fontW));
        machine.memory.setByte(HeaderLocation.FontHeightInUnits, Math.min(255, fontH));
      }
    }
  });

  // Clean up session when the tab/window is closed
  window.addEventListener('beforeunload', () => {
    stopSession();
  });
}

init();
