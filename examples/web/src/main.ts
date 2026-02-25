import { Buffer } from 'buffer';
(globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;

// Polyfill process for browser (Logger checks process.stdout.isTTY)
if (typeof (globalThis as unknown as { process?: unknown }).process === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).process = { stdout: { isTTY: false } };
}

// Polyfill setImmediate for browser (Executor uses it to defer input setup)
if (
  typeof (globalThis as typeof globalThis & { setImmediate?: (cb: () => void) => unknown }).setImmediate === 'undefined'
) {
  (globalThis as typeof globalThis & { setImmediate: (cb: () => void) => ReturnType<typeof setTimeout> }).setImmediate =
    (cb: () => void) => setTimeout(cb, 0);
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

  const { width: cellWidth, height: cellHeight } = screen.getCellDimensions();
  const pictureRenderer = new PictureRenderer(pictureCanvas, cellWidth, cellHeight);
  const soundPlayer = new SoundPlayer();

  let multimediaHandler: BlorbMultimediaHandler | undefined;
  let blorbMap: ReturnType<typeof BlorbParser.parse> | null = null;

  if (blorbData && isBlorb(blorbData)) {
    blorbMap = BlorbParser.parse(blorbData);
    const webScreen = screen as import('./WebScreen').WebScreen;
    multimediaHandler = new BlorbMultimediaHandler(blorbMap, blorbData, {
      pictureRenderer: async (resourceId, data, format, x, y, scale) => {
        await pictureRenderer.displayPicture(resourceId, data, format, x, y, scale);
      },
      pictureEraser: (resourceId) =>
        pictureRenderer.erasePicture(resourceId, webScreen.getBackgroundColor(0)),
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

  const resizeObserver = new ResizeObserver(() => {
    const { rows, cols } = screen.getSize();
    const version = machine.state.version;
    machine.memory.setByte(HeaderLocation.ScreenHeightInLines, rows);
    machine.memory.setByte(HeaderLocation.ScreenWidthInChars, cols);
    if (version >= 5) {
      machine.memory.setWord(HeaderLocation.ScreenWidthInUnits, cols);
      machine.memory.setWord(HeaderLocation.ScreenHeightInUnits, rows);
    }
    screen.handleResize();
  });

  resizeObserver.observe(mainEl.parentElement!);

  // Set initial dimensions in header before execution (ZMachine constructor may
  // have run before layout; ResizeObserver callback is async)
  const { rows, cols } = screen.getSize();
  machine.memory.setByte(HeaderLocation.ScreenHeightInLines, rows);
  machine.memory.setByte(HeaderLocation.ScreenWidthInChars, cols);
  if (machine.state.version >= 5) {
    machine.memory.setWord(HeaderLocation.ScreenWidthInUnits, cols);
    machine.memory.setWord(HeaderLocation.ScreenHeightInUnits, rows);
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
  const storyExt = ['.z3', '.z5', '.z8'];
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

  const storyExt = ['.z3', '.z5', '.z8'];
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
  mainEl.innerHTML = '';
  statusEl.innerHTML = '';
  // Reset status bar styles from previous game (e.g. multi-line upper window)
  statusEl.style.minHeight = '';
  statusEl.style.display = '';
  inputEl.value = '';
  inputEl.placeholder = '';
  inputEl.disabled = false;

  const rect = mainEl.parentElement!.getBoundingClientRect();
  pictureCanvas.width = rect.width;
  pictureCanvas.height = rect.height;

  let storyData: Buffer;
  let blorbData: Buffer | null = null;

  if (files.length === 1) {
    const file = files[0];
    const data = await readFileAsBuffer(file);

    if (isBlorb(data)) {
      const map = BlorbParser.parse(data);
      const exec = BlorbParser.getExecData(map, data);
      storyData = exec ?? data;
      blorbData = data;
    } else {
      storyData = data;
    }
  } else {
    const result = findStoryAndBlorb(Array.from(files));
    if (!result) {
      alert('No story file found. Please select a .z3, .z5, or .z8 file, or a folder containing one.');
      return;
    }

    storyData = await readFileAsBuffer(result.story);
    blorbData = result.blorb ? await readFileAsBuffer(result.blorb) : null;
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
    const { machine, pictureRenderer } = currentSession;

    // Recalculate cell dimensions after font size change
    const screen = machine.screen as import('./WebScreen').WebScreen;
    const { width: cellWidth, height: cellHeight } = screen.remeasureCellDimensions();
    pictureRenderer.updateCellDimensions(cellWidth, cellHeight);

    // Update header with new screen dimensions
    const { rows, cols } = screen.getSize();
    machine.memory.setByte(HeaderLocation.ScreenHeightInLines, rows);
    machine.memory.setByte(HeaderLocation.ScreenWidthInChars, cols);
    if (machine.state.version >= 5) {
      machine.memory.setWord(HeaderLocation.ScreenWidthInUnits, cols);
      machine.memory.setWord(HeaderLocation.ScreenHeightInUnits, rows);
    }
  });

  // Clean up session when the tab/window is closed
  window.addEventListener('beforeunload', () => {
    stopSession();
  });
}

init();
