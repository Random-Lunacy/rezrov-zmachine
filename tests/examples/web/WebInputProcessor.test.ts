// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger, type InputState, type ZMachine } from '../../../src/index';
// InputMode is re-exported type-only from the package root, so take the enum
// value from the module that declares it.
import { InputMode } from '../../../src/ui/input/InputInterface';
import { WebInputProcessor } from '../../../examples/web/src/WebInputProcessor';
import type { WebScreen } from '../../../examples/web/src/WebScreen';

Logger.setLogToConsole(false);

let pagerResolve: () => void;

/** Minimal WebScreen surface the input processor actually touches. */
function makeScreen(pagerPending = false): WebScreen {
  return {
    pagerDrained: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          if (pagerPending) {
            pagerResolve = resolve;
          } else {
            resolve();
          }
        })
    ),
    getForegroundColor: vi.fn(() => 'rgb(224, 224, 224)'),
  } as unknown as WebScreen;
}

function makeMachine(): ZMachine {
  return {
    logger: new Logger('TestMachine'),
    state: { version: 5 },
    // Reported as not suspended so the base class's timeout handling stops at
    // its own guard; what the example contributes runs before it delegates.
    executor: { isSuspended: false },
    getInputState: vi.fn(() => undefined),
  } as unknown as ZMachine;
}

function textState(overrides: Partial<InputState> = {}): InputState {
  return { mode: InputMode.TEXT, ...overrides } as InputState;
}

function press(el: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

interface Harness {
  processor: WebInputProcessor;
  screen: WebScreen;
  machine: ZMachine;
  inputEl: HTMLInputElement;
  outputEl: HTMLDivElement;
  onInputComplete: ReturnType<typeof vi.spyOn>;
  onKeyPress: ReturnType<typeof vi.spyOn>;
}

function setup(pagerPending = false): Harness {
  document.body.innerHTML = '';
  const scroller = document.createElement('div');
  const outputEl = document.createElement('div');
  scroller.appendChild(outputEl);
  const inputEl = document.createElement('input');
  document.body.append(scroller, inputEl);

  const screen = makeScreen(pagerPending);
  const machine = makeMachine();
  const processor = new WebInputProcessor(screen, inputEl, outputEl);

  // The base class's completion path needs a live executor and memory; the
  // example's own contribution is what it hands over, so observe that instead.
  const onInputComplete = vi.spyOn(processor, 'onInputComplete').mockImplementation(() => {});
  const onKeyPress = vi.spyOn(processor, 'onKeyPress').mockImplementation(() => {});

  return { processor, screen, machine, inputEl, outputEl, onInputComplete, onKeyPress };
}

/** Reach the protected hooks without going through the base class's setup work. */
function startTextInput(h: Harness, state: InputState = textState()): Promise<void> {
  (h.processor as unknown as { doStartTextInput(m: ZMachine, s: InputState): void }).doStartTextInput(h.machine, state);
  return Promise.resolve();
}

function startCharInput(h: Harness, state: InputState = textState({ mode: InputMode.CHAR })): Promise<void> {
  (h.processor as unknown as { doStartCharInput(m: ZMachine, s: InputState): void }).doStartCharInput(h.machine, state);
  return Promise.resolve();
}

describe('WebInputProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('text input', () => {
    it('should enable and focus the input field once the pager has drained', async () => {
      const h = setup();
      await startTextInput(h);

      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));
      expect(h.inputEl.style.visibility).toBe('visible');
      expect(document.activeElement).toBe(h.inputEl);
    });

    it('should not show the prompt while a [MORE] pause is still pending', async () => {
      const h = setup(true);
      h.inputEl.disabled = true;
      await startTextInput(h);

      await Promise.resolve();
      expect(h.inputEl.disabled).toBe(true);

      pagerResolve();
      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));
    });

    it('should display preloaded text with the caret after it (Z-spec 15.2)', async () => {
      const h = setup();
      await startTextInput(h, textState({ preloadedText: 'take ' }));

      await vi.waitFor(() => expect(h.inputEl.value).toBe('take '));
      expect(h.inputEl.selectionStart).toBe(5);
      expect(h.inputEl.selectionEnd).toBe(5);
    });

    it('should start empty when there is no preloaded text', async () => {
      const h = setup();
      await startTextInput(h);

      await vi.waitFor(() => expect(h.inputEl.value).toBe(''));
    });

    it('should submit the typed line on Enter', async () => {
      const h = setup();
      await startTextInput(h);
      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));

      h.inputEl.value = 'open mailbox';
      press(h.inputEl, 'Enter');

      expect(h.onInputComplete).toHaveBeenCalledWith(h.machine, 'open mailbox', expect.anything());
    });

    it('should ignore keys other than Enter', async () => {
      const h = setup();
      await startTextInput(h);
      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));

      h.inputEl.value = 'open';
      press(h.inputEl, 'o');

      expect(h.onInputComplete).not.toHaveBeenCalled();
    });

    it('should echo the submitted line into the transcript', async () => {
      const h = setup();
      await startTextInput(h);
      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));

      h.inputEl.value = 'go north';
      press(h.inputEl, 'Enter');

      expect(h.outputEl.textContent).toBe('go north\n');
      expect(h.screen.getForegroundColor).toHaveBeenCalledWith(0);
    });

    it('should clear and disable the field after submitting', async () => {
      const h = setup();
      await startTextInput(h);
      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));

      h.inputEl.value = 'wait';
      press(h.inputEl, 'Enter');

      expect(h.inputEl.value).toBe('');
      expect(h.inputEl.disabled).toBe(true);
    });

    it('should not submit twice when Enter is pressed again', async () => {
      const h = setup();
      await startTextInput(h);
      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));

      h.inputEl.value = 'wait';
      press(h.inputEl, 'Enter');
      press(h.inputEl, 'Enter');

      expect(h.onInputComplete).toHaveBeenCalledTimes(1);
    });

    it('should not leave the previous prompt listener attached across two reads', async () => {
      const h = setup();
      await startTextInput(h);
      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));
      await startTextInput(h);
      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));

      h.inputEl.value = 'look';
      press(h.inputEl, 'Enter');

      expect(h.onInputComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('character input', () => {
    it('should show the press-any-key hint and focus the field', async () => {
      const h = setup();
      await startCharInput(h);

      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));
      expect(h.inputEl.placeholder).toBe('[press any key]');
      expect(document.activeElement).toBe(h.inputEl);
    });

    it.each([
      ['Enter', 13],
      ['Escape', 27],
      ['Backspace', 8],
      ['Delete', 8],
      ['ArrowUp', 129],
      ['ArrowDown', 130],
      ['ArrowLeft', 131],
      ['ArrowRight', 132],
    ])('should map %s to ZSCII %i', async (key, zscii) => {
      const h = setup();
      await startCharInput(h);
      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));

      press(h.inputEl, key);

      expect(h.onKeyPress).toHaveBeenCalledWith(h.machine, String.fromCharCode(zscii));
    });

    it.each([
      ['F1', 133],
      ['F5', 137],
      ['F12', 144],
    ])('should map %s to ZSCII %i', async (key, zscii) => {
      const h = setup();
      await startCharInput(h);
      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));

      press(h.inputEl, key);

      expect(h.onKeyPress).toHaveBeenCalledWith(h.machine, String.fromCharCode(zscii));
    });

    it('should ignore function keys beyond F12', async () => {
      const h = setup();
      await startCharInput(h);
      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));

      press(h.inputEl, 'F13');

      expect(h.onKeyPress).not.toHaveBeenCalled();
    });

    it.each([' ', 'a', 'Z', '7', '?'])('should pass the printable key %s straight through', async (key) => {
      const h = setup();
      await startCharInput(h);
      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));

      press(h.inputEl, key);

      expect(h.onKeyPress).toHaveBeenCalledWith(h.machine, key);
    });

    it.each(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])(
      'should ignore the modifier key %s and keep waiting',
      async (key) => {
        const h = setup();
        await startCharInput(h);
        await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));

        press(h.inputEl, key);

        expect(h.onKeyPress).not.toHaveBeenCalled();
        expect(h.inputEl.disabled).toBe(false);
      }
    );

    it('should clear the hint and disable the field after a key is accepted', async () => {
      const h = setup();
      await startCharInput(h);
      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));

      press(h.inputEl, 'y');

      expect(h.inputEl.placeholder).toBe('');
      expect(h.inputEl.disabled).toBe(true);
    });

    it('should only report the first key', async () => {
      const h = setup();
      await startCharInput(h);
      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));

      press(h.inputEl, 'y');
      press(h.inputEl, 'n');

      expect(h.onKeyPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelInput', () => {
    it('should disable the field and detach the listener', async () => {
      const h = setup();
      await startTextInput(h);
      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));

      h.processor.cancelInput(h.machine);

      expect(h.inputEl.disabled).toBe(true);
      h.inputEl.value = 'ignored';
      press(h.inputEl, 'Enter');
      expect(h.onInputComplete).not.toHaveBeenCalled();
    });

    it('should be safe to call when no input is pending', () => {
      const h = setup();
      expect(() => h.processor.cancelInput(h.machine)).not.toThrow();
    });
  });

  describe('promptForFilename', () => {
    it('should return the name the player types', async () => {
      const h = setup();
      vi.stubGlobal('prompt', vi.fn(() => 'zork1.qzl'));

      await expect(h.processor.promptForFilename(h.machine, 'save')).resolves.toBe('zork1.qzl');
      vi.unstubAllGlobals();
    });

    it.each([null, ''])('should fall back to save.dat when the prompt returns %s', async (answer) => {
      const h = setup();
      vi.stubGlobal('prompt', vi.fn(() => answer));

      await expect(h.processor.promptForFilename(h.machine, 'restore')).resolves.toBe('save.dat');
      vi.unstubAllGlobals();
    });
  });

  describe('onInputTimeout', () => {
    it('should ignore a stale timeout that fires after input finished', async () => {
      const h = setup();
      const state = textState({ time: 10, routine: 0x1234 });

      h.processor.onInputTimeout(h.machine, state);

      expect(state.currentInput).toBeUndefined();
    });

    it('should hand the partially typed line to the timeout routine', async () => {
      const h = setup();
      await startTextInput(h);
      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));
      h.inputEl.value = 'open the ';
      const state = textState({ time: 10, routine: 0x1234 });

      h.processor.onInputTimeout(h.machine, state);

      expect(state.currentInput).toBe('open the ');
    });

    it('should suppress Enter while the timeout routine is running', async () => {
      const h = setup();
      await startTextInput(h);
      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));
      h.inputEl.value = 'open the ';

      h.processor.onInputTimeout(h.machine, textState({ time: 10, routine: 0x1234 }));
      press(h.inputEl, 'Enter');

      expect(h.onInputComplete).not.toHaveBeenCalled();
    });
  });
});
