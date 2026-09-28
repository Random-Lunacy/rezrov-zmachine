import { BaseInputProcessor, InputState, Logger, MouseClickCode, ZMachine, type MouseClick } from 'rezrov-zmachine';
import type { WebScreen } from './WebScreen';

/** Clicks held while the game is busy; more than this is a burst the player didn't mean. */
const MAX_PENDING_CLICKS = 4;

/** Mouse tracing. Off unless the page URL carries `?mousedebug`. */
const MOUSE_DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('mousedebug');

export class WebInputProcessor extends BaseInputProcessor {
  private readonly logger: Logger;
  private readonly clickTarget: HTMLElement | null;
  private readonly screen: WebScreen;
  private readonly inputEl: HTMLInputElement;
  private readonly textOutputEl: HTMLDivElement;
  private isWaitingForInput = false;
  private inputHandler: ((e: KeyboardEvent) => void) | null = null;

  // Flag to pause input handling during timeout routine execution
  private isExecutingTimeoutRoutine = false;

  // Offered as the default the next time a filename is asked for
  private lastFilename = 'save.dat';

  // Set once the game first asks for input; clicks before then have nowhere to go
  private machine: ZMachine | null = null;
  // Clicks that arrived while the game was busy, delivered when it next waits for input
  private pendingClicks: MouseClick[] = [];
  // Typed text printed when a click ended line input, taken back if the game asks again with it
  private clickEcho: HTMLSpanElement | null = null;

  private readonly handleClick = (e: MouseEvent): void => {
    const machine = this.machine;
    if (!machine) return;

    // The input field and the [MORE] prompt keep their usual meaning
    const target = e.target instanceof Element ? e.target : null;
    if (target && (this.inputEl.contains(target) || target.closest('#more-prompt'))) return;
    if (this.screen.isPaging()) return;

    const position = this.screen.clientToScreenUnits(e.clientX, e.clientY);
    if (MOUSE_DEBUG) {
      const cell = position ? this.screen.describeUpperCell(position.y, position.x) : 'n/a';
      // eslint-disable-next-line no-console
      console.log(
        `[mouse] client=(${e.clientX}, ${e.clientY}) units=${position ? `(x=${position.x}, y=${position.y})` : 'none'} ` +
          `detail=${e.detail} waiting=${this.isWaitingForInput} cell: ${cell}`
      );
    }
    if (position) {
      // The browser counts clicks: the second of a double-click has detail 2
      const click: MouseClick = { ...position, isDouble: e.detail >= 2 };
      if (this.isWaitingForInput && !this.isExecutingTimeoutRoutine) {
        this.onMouseClick(machine, click, this.inputEl.value);
      } else if (this.pendingClicks.length < MAX_PENDING_CLICKS) {
        this.pendingClicks.push(click);
      }
    }

    // Keep typing going to the input field, unless the player was selecting text
    if (this.isWaitingForInput && (window.getSelection()?.isCollapsed ?? true)) {
      this.inputEl.focus();
    }
  };

  constructor(
    screen: WebScreen,
    inputEl: HTMLInputElement,
    textOutputEl: HTMLDivElement,
    options?: { logger?: Logger; clickTarget?: HTMLElement }
  ) {
    super();
    this.logger = options?.logger || new Logger('WebInputProcessor');
    this.screen = screen;
    this.inputEl = inputEl;
    this.textOutputEl = textOutputEl;
    // Capture phase: the text layers sit over the picture canvas, and a click on them still
    // counts as a click on the game screen
    this.clickTarget = options?.clickTarget ?? null;
    this.clickTarget?.addEventListener('click', this.handleClick, true);
  }

  /** Stop listening for mouse clicks. Call when the game session ends. */
  dispose(): void {
    this.clickTarget?.removeEventListener('click', this.handleClick, true);
    this.pendingClicks = [];
    this.machine = null;
  }

  /**
   * Deliver clicks queued while the game was busy, now that it is waiting for input again.
   * Stops at the first one the game accepts; the rest wait for the input after that.
   */
  private deliverPendingClicks(machine: ZMachine): void {
    while (this.pendingClicks.length > 0 && this.isWaitingForInput) {
      const click = this.pendingClicks.shift()!;
      if (this.onMouseClick(machine, click, this.inputEl.value)) return;
    }
  }

  /**
   * A click that ends line input leaves what the player typed on screen, without a newline:
   * the game may carry on from there (Zork Zero prints the direction clicked on after it).
   * If instead it asks again with the same text, beginTextInput takes the echo back.
   */
  onInputComplete(machine: ZMachine, input: string, termChar: number = 13): void {
    if (termChar === MouseClickCode.SingleClick || termChar === MouseClickCode.DoubleClick) {
      this.clickEcho = input ? this.echoInput(input, false) : null;
      this.inputEl.value = '';
    }
    super.onInputComplete(machine, input, termChar);
  }

  /**
   * Remove the typed text printed by a click that ended the last input, when the game has asked
   * again with that same text preloaded and printed nothing since. Zork Zero does this for a
   * click that misses the compass: the text belongs back in the input field, not twice on screen.
   */
  private takeBackClickEcho(preloaded: string): void {
    const echo = this.clickEcho;
    this.clickEcho = null;
    if (echo && preloaded && echo.textContent === preloaded && echo === this.textOutputEl.lastChild) {
      echo.remove();
    }
  }

  protected doStartTextInput(machine: ZMachine, state: InputState): void {
    // Let the player page through any pending [MORE] output before the prompt
    // appears, so it never covers text they have not read. Resolves immediately
    // when nothing is pending, which is the common case.
    void this.screen.pagerDrained().then(() => this.beginTextInput(machine, state));
  }

  private beginTextInput(machine: ZMachine, state: InputState): void {
    this.logger.debug('Starting text input');
    this.machine = machine;

    // Clean up any existing input state (e.g. from a previous timeout-terminated input)
    if (this.inputHandler) {
      this.inputEl.removeEventListener('keydown', this.inputHandler);
      this.inputHandler = null;
    }
    this.isExecutingTimeoutRoutine = false;

    this.isWaitingForInput = true;
    // Z-spec §15.2: pre-loaded text must be displayed so the player can edit/append to it
    const preloaded = state.preloadedText ?? '';
    this.takeBackClickEcho(preloaded);
    this.inputEl.value = preloaded;
    this.inputEl.disabled = false;
    this.inputEl.style.visibility = 'visible';
    this.inputEl.focus();
    // Move cursor to end so the player appends after any pre-loaded text
    if (preloaded.length > 0) {
      this.inputEl.setSelectionRange(preloaded.length, preloaded.length);
    }

    const handleSubmit = (e: KeyboardEvent): void => {
      e.preventDefault();
      if (!this.isWaitingForInput || this.isExecutingTimeoutRoutine) return;

      const input = this.inputEl.value;
      this.inputEl.value = '';

      this.echoInput(input);
      this.isWaitingForInput = false;
      this.inputEl.disabled = true;

      const h = this.inputHandler;
      if (h) {
        this.inputEl.removeEventListener('keydown', h);
        this.inputHandler = null;
      }

      const termChar = this.processTerminatingCharacters(input);
      this.onInputComplete(machine, input, termChar);
    };

    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSubmit(e);
      }
    };
    this.inputHandler = h;
    this.inputEl.addEventListener('keydown', h);
    this.deliverPendingClicks(machine);
  }

  protected doStartCharInput(machine: ZMachine, state: InputState): void {
    // As with text input: page out first, so the keypress that dismisses a [MORE]
    // prompt is not also consumed as the story's requested character.
    void this.screen.pagerDrained().then(() => this.beginCharInput(machine, state));
  }

  private beginCharInput(machine: ZMachine, _state: InputState): void {
    this.logger.debug('Starting char input');
    this.machine = machine;
    this.clickEcho = null;
    this.isWaitingForInput = true;
    this.inputEl.value = '';
    this.inputEl.disabled = false;
    this.inputEl.style.visibility = 'visible';
    this.inputEl.placeholder = '[press any key]';
    this.inputEl.focus();

    const handleKey = (e: KeyboardEvent): void => {
      if (!this.isWaitingForInput) return;

      e.preventDefault();
      e.stopPropagation();

      let key = '';
      const keyMap: Record<string, number> = {
        Enter: 13,
        Escape: 27,
        Backspace: 8,
        Delete: 8,
        ArrowUp: 129,
        ArrowDown: 130,
        ArrowLeft: 131,
        ArrowRight: 132,
      };

      // F1-F12 → ZSCII 133-144
      const fMatch = e.key.match(/^F(\d+)$/);
      if (fMatch) {
        const fNum = parseInt(fMatch[1], 10);
        if (fNum >= 1 && fNum <= 12) {
          key = String.fromCharCode(132 + fNum);
        }
      } else if (keyMap[e.key] !== undefined) {
        key = String.fromCharCode(keyMap[e.key]);
      } else if (e.key === ' ') {
        key = ' ';
      } else if (e.key.length === 1 && e.key.charCodeAt(0) >= 32) {
        key = e.key;
      }

      if (key !== '') {
        const h = this.inputHandler;
        if (h) {
          this.inputEl.removeEventListener('keydown', h);
          this.inputHandler = null;
        }
        this.inputEl.placeholder = '';
        this.inputEl.disabled = true;
        this.isWaitingForInput = false;

        this.onKeyPress(machine, key);
      }
    };

    this.inputHandler = handleKey;
    this.inputEl.addEventListener('keydown', handleKey);
    this.deliverPendingClicks(machine);
  }

  /**
   * Override onInputTimeout to pass current input to the base class and
   * pause input handling while the timeout routine executes.
   */
  onInputTimeout(machine: ZMachine, state: InputState): void {
    if (!this.isWaitingForInput) {
      this.logger.debug('onInputTimeout: not waiting for input, ignoring stale timeout');
      return;
    }

    // Pass the current input buffer so the base class can use it if the routine terminates input
    state.currentInput = this.inputEl.value;

    // Pause input handling during routine execution
    this.isExecutingTimeoutRoutine = true;

    super.onInputTimeout(machine, state);
  }

  /**
   * Called by base class after timeout routine completes and timer is restarted.
   * Resume input handling.
   */
  handleTimedInput(machine: ZMachine, state: InputState): void {
    if (this.isExecutingTimeoutRoutine && !this.isWaitingForInput) {
      this.logger.debug('handleTimedInput: not waiting for input, ignoring');
      this.isExecutingTimeoutRoutine = false;
      return;
    }

    this.isExecutingTimeoutRoutine = false;
    super.handleTimedInput(machine, state);
  }

  cancelInput(machine: ZMachine): void {
    super.cancelInput(machine);
    if (this.inputHandler) {
      this.inputEl.removeEventListener('keydown', this.inputHandler);
      this.inputHandler = null;
    }
    this.isWaitingForInput = false;
    this.isExecutingTimeoutRoutine = false;
    this.inputEl.disabled = true;
    this.inputEl.placeholder = ''; // A click can end char input without going through handleKey
  }

  /**
   * Ask for a save filename, offering the last one used. Returns '' if the player cancels,
   * which makes the save or restore fail rather than silently using a default file.
   */
  async promptForFilename(_machine: ZMachine, operation: string): Promise<string> {
    const filename = window.prompt(`Enter filename for ${operation}:`, this.lastFilename)?.trim() ?? '';
    if (filename) this.lastFilename = filename;
    return filename;
  }

  private echoInput(input: string, withNewline: boolean = true): HTMLSpanElement {
    const span = document.createElement('span');
    span.textContent = withNewline ? input + '\n' : input;
    span.style.color = this.screen.getForegroundColor(0);
    this.textOutputEl.appendChild(span);
    this.textOutputEl.parentElement!.scrollTop = this.textOutputEl.parentElement!.scrollHeight;
    return span;
  }
}
