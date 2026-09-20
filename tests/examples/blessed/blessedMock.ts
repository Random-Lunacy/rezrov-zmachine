import { vi } from 'vitest';

/**
 * Test double for the `blessed` module.
 *
 * BlessedScreen's constructor eagerly calls blessed.screen(), which seizes the
 * TTY and puts stdin in raw mode, so the real library cannot be instantiated
 * under Vitest. This stands in for the slice of the widget API the two example
 * classes actually touch, and lets tests drive the handlers they register.
 *
 * Not named *.test.ts, so Vitest's `tests/**\/*.test.ts` include never collects it.
 */

type Handler = (...args: unknown[]) => unknown;

export interface MockWidget {
  handlers: Map<string, Handler[]>;
  on(event: string, fn: Handler): void;
  removeListener(event: string, fn: Handler): void;
  key(keys: string | string[], fn: Handler): void;
  /** Test-only: invoke every handler registered for `event`. */
  emit(event: string, ...args: unknown[]): void;
  /** Test-only: invoke handlers registered via key() for `name`. */
  pressKey(name: string, ...args: unknown[]): void;
  setContent: ReturnType<typeof vi.fn>;
  getContent: ReturnType<typeof vi.fn>;
  setScrollPerc: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  content: string;
  style: { fg: string; bg: string };
  top: number | string;
  height: number | string;
  width: number | string;
  hidden: boolean;
}

export interface MockScreen extends MockWidget {
  append: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  program: {
    key: ReturnType<typeof vi.fn>;
    disableMouse: ReturnType<typeof vi.fn>;
    enableMouse: ReturnType<typeof vi.fn>;
    handlers: Map<string, Handler[]>;
  };
  cursor: { artificial: boolean; shape: string; blink: boolean; color: string };
}

/** Every widget the module has handed out since the last reset. */
export const created: { screens: MockScreen[]; boxes: MockWidget[]; textboxes: MockWidget[] } = {
  screens: [],
  boxes: [],
  textboxes: [],
};

function baseWidget(options: Record<string, unknown> = {}): MockWidget {
  const handlers = new Map<string, Handler[]>();
  const keyHandlers = new Map<string, Handler[]>();

  const widget: MockWidget = {
    handlers,
    on(event, fn) {
      const list = handlers.get(event) ?? [];
      list.push(fn);
      handlers.set(event, list);
    },
    removeListener(event, fn) {
      const list = handlers.get(event);
      if (!list) return;
      const i = list.indexOf(fn);
      if (i !== -1) list.splice(i, 1);
    },
    key(keys, fn) {
      for (const k of Array.isArray(keys) ? keys : [keys]) {
        const list = keyHandlers.get(k) ?? [];
        list.push(fn);
        keyHandlers.set(k, list);
      }
    },
    emit(event, ...args) {
      // Copy: a handler may remove itself mid-dispatch, which both example
      // input processors do on the key that completes an input.
      for (const fn of [...(handlers.get(event) ?? [])]) fn(...args);
    },
    pressKey(name, ...args) {
      for (const fn of [...(keyHandlers.get(name) ?? [])]) fn(...args);
    },
    setContent: vi.fn((value: string) => {
      widget.content = value;
    }),
    getContent: vi.fn(() => widget.content),
    setScrollPerc: vi.fn(),
    focus: vi.fn(),
    content: (options.content as string) ?? '',
    style: { fg: 'white', bg: 'black', ...((options.style as object) ?? {}) },
    top: (options.top as number) ?? 0,
    height: (options.height as number) ?? 1,
    width: (options.width as number) ?? '100%',
    hidden: false,
  };

  return widget;
}

function makeScreen(options: Record<string, unknown> = {}): MockScreen {
  const base = baseWidget(options);
  const programHandlers = new Map<string, Handler[]>();

  const screen: MockScreen = Object.assign(base, {
    // Defaults above the >10 / >5 thresholds in BlessedScreen.getSize, so tests
    // exercise the normal path unless they deliberately set 1x1.
    width: 80,
    height: 25,
    append: vi.fn(),
    remove: vi.fn(),
    render: vi.fn(),
    destroy: vi.fn(),
    program: {
      key: vi.fn((keys: string | string[], fn: Handler) => {
        for (const k of Array.isArray(keys) ? keys : [keys]) {
          const list = programHandlers.get(k) ?? [];
          list.push(fn);
          programHandlers.set(k, list);
        }
      }),
      disableMouse: vi.fn(),
      enableMouse: vi.fn(),
      handlers: programHandlers,
    },
    cursor: { artificial: true, shape: 'line', blink: true, color: 'default' },
  });

  created.screens.push(screen);
  return screen;
}

/** The module shape to hand to `vi.mock('blessed', ...)`. */
export function createBlessedModule(): Record<string, unknown> {
  const screen = (options?: Record<string, unknown>): MockScreen => makeScreen(options);
  const box = (options?: Record<string, unknown>): MockWidget => {
    const w = baseWidget(options);
    created.boxes.push(w);
    return w;
  };
  const textbox = (options?: Record<string, unknown>): MockWidget => {
    const w = baseWidget(options);
    created.textboxes.push(w);
    return w;
  };
  // Covers both `import * as blessed` and a default import.
  return { screen, box, textbox, default: { screen, box, textbox } };
}

export function resetBlessedMock(): void {
  created.screens.length = 0;
  created.boxes.length = 0;
  created.textboxes.length = 0;
}

/**
 * BlessedScreen's constructor adds a `resize` listener to process.stdout. The
 * source now detaches it in quit(), but tests rarely call quit(), and a dozen
 * constructions would trip Node's MaxListeners warning.
 *
 * Snapshot before / restore after rather than removeAllListeners('resize'):
 * Vitest's own worker tty plumbing may hold a listener, and removing it would
 * produce a confusing failure far from the cause.
 */
export function trackStdoutResizeListeners(): () => void {
  const before = new Set(process.stdout.listeners('resize'));
  return () => {
    for (const listener of process.stdout.listeners('resize')) {
      if (!before.has(listener)) {
        process.stdout.removeListener('resize', listener as (...args: unknown[]) => void);
      }
    }
  };
}
