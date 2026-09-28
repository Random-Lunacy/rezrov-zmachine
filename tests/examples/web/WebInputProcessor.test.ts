// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebInputProcessor } from '../../../examples/web/src/WebInputProcessor';
import type { WebScreen } from '../../../examples/web/src/WebScreen';
import { BaseInputProcessor, InputMode, Logger, type InputState, type ZMachine } from '../../../src/index';

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
    isPaging: vi.fn(() => false),
    clientToScreenUnits: vi.fn(() => ({ x: 150, y: 90 })),
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
  container: HTMLDivElement;
  onMouseClick: ReturnType<typeof vi.spyOn>;
}

function setup(pagerPending = false): Harness {
  document.body.innerHTML = '';
  const scroller = document.createElement('div');
  const outputEl = document.createElement('div');
  scroller.appendChild(outputEl);
  const inputEl = document.createElement('input');
  const container = document.createElement('div');
  container.append(scroller, inputEl);
  document.body.append(container);

  const screen = makeScreen(pagerPending);
  const machine = makeMachine();
  const processor = new WebInputProcessor(screen, inputEl, outputEl, { clickTarget: container });

  // The base class's completion path needs a live executor and memory; the
  // example's own contribution is what it hands over, so observe that instead.
  const onInputComplete = vi.spyOn(processor, 'onInputComplete').mockImplementation(() => {});
  const onKeyPress = vi.spyOn(processor, 'onKeyPress').mockImplementation(() => {});
  // Whether the core accepts a click is tested in core; here, observe what reaches it
  const onMouseClick = vi.spyOn(processor, 'onMouseClick').mockReturnValue(true);

  return { processor, screen, machine, inputEl, outputEl, onInputComplete, onKeyPress, container, onMouseClick };
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

  describe('mouse clicks', () => {
    function click(el: Element, detail = 1): void {
      el.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, detail, clientX: 300, clientY: 180 })
      );
    }

    /** Start char input and let the (already drained) pager release it. */
    async function waitingForChar(h: Harness): Promise<void> {
      await startCharInput(h);
      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));
    }

    it('should hand a click to the game in screen units while it waits for input', async () => {
      const h = setup();
      await waitingForChar(h);

      click(h.outputEl);

      expect(h.screen.clientToScreenUnits).toHaveBeenCalledWith(300, 180);
      expect(h.onMouseClick).toHaveBeenCalledWith(h.machine, { x: 150, y: 90, isDouble: false }, '');
    });

    it('should report the second click of a double-click as a double', async () => {
      const h = setup();
      await waitingForChar(h);

      click(h.outputEl, 2);

      expect(h.onMouseClick).toHaveBeenCalledWith(h.machine, { x: 150, y: 90, isDouble: true }, '');
    });

    it('should pass the text typed so far with a click during line input', async () => {
      const h = setup();
      await startTextInput(h);
      await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));
      h.inputEl.value = 'go ';

      click(h.outputEl);

      expect(h.onMouseClick).toHaveBeenCalledWith(h.machine, { x: 150, y: 90, isDouble: false }, 'go ');
    });

    it('should queue a click that arrives while the game is busy and deliver it at the next input', async () => {
      // The tower puzzle: the peg click often comes while the game still prints its prompt
      const h = setup();
      await waitingForChar(h);
      h.processor.cancelInput(h.machine); // The game took the weight click and is running

      click(h.outputEl, 1);
      expect(h.onMouseClick).not.toHaveBeenCalled();

      await waitingForChar(h);
      expect(h.onMouseClick).toHaveBeenCalledTimes(1);
      expect(h.onMouseClick).toHaveBeenCalledWith(h.machine, { x: 150, y: 90, isDouble: false }, '');
    });

    it('should deliver queued clicks one input at a time', async () => {
      const h = setup();
      await waitingForChar(h);
      h.processor.cancelInput(h.machine);
      click(h.outputEl, 1);
      click(h.outputEl, 2);

      await waitingForChar(h);
      expect(h.onMouseClick).toHaveBeenCalledTimes(1);
      h.processor.cancelInput(h.machine);

      await waitingForChar(h);
      expect(h.onMouseClick).toHaveBeenCalledTimes(2);
      expect(h.onMouseClick).toHaveBeenLastCalledWith(h.machine, { x: 150, y: 90, isDouble: true }, '');
    });

    it('should drop a queued click the game rejects and try the next one', async () => {
      const h = setup();
      await waitingForChar(h);
      h.processor.cancelInput(h.machine);
      click(h.outputEl, 1);
      click(h.outputEl, 2);
      h.onMouseClick.mockReturnValueOnce(false).mockReturnValueOnce(true);

      await waitingForChar(h);

      expect(h.onMouseClick).toHaveBeenCalledTimes(2);
    });

    it('should keep at most four queued clicks', async () => {
      const h = setup();
      await waitingForChar(h);
      h.processor.cancelInput(h.machine);
      for (let i = 0; i < 6; i++) click(h.outputEl);
      h.onMouseClick.mockReturnValue(false); // Rejected, so every queued click is tried

      await waitingForChar(h);

      expect(h.onMouseClick).toHaveBeenCalledTimes(4);
    });

    it('should ignore clicks before the game has asked for any input', () => {
      const h = setup();

      click(h.outputEl);

      expect(h.onMouseClick).not.toHaveBeenCalled();
    });

    it('should leave clicks on the input field and the [MORE] prompt alone', async () => {
      const h = setup();
      await waitingForChar(h);
      const more = document.createElement('div');
      more.id = 'more-prompt';
      h.container.appendChild(more);

      click(h.inputEl);
      click(more);

      expect(h.onMouseClick).not.toHaveBeenCalled();
    });

    it('should ignore clicks while the [MORE] prompt is showing', async () => {
      const h = setup();
      await waitingForChar(h);
      (h.screen.isPaging as ReturnType<typeof vi.fn>).mockReturnValue(true);

      click(h.outputEl);

      expect(h.onMouseClick).not.toHaveBeenCalled();
    });

    it('should stop listening once disposed', async () => {
      const h = setup();
      await waitingForChar(h);

      h.processor.dispose();
      click(h.outputEl);

      expect(h.onMouseClick).not.toHaveBeenCalled();
    });

    describe('when a click ends line input', () => {
      let base: ReturnType<typeof vi.spyOn>;

      function clickEndsInput(h: Harness, typed: string): void {
        h.onInputComplete.mockRestore();
        base = vi.spyOn(BaseInputProcessor.prototype, 'onInputComplete').mockImplementation(() => {});
        h.processor.onInputComplete(h.machine, typed, 254);
      }

      afterEach(() => base.mockRestore());

      it('should take the typed text back into the input field when the game asks again with it', async () => {
        // Zork Zero: a click that misses the compass loops back to READ with the buffer intact
        const h = setup();
        clickEndsInput(h, 'look');
        expect(h.outputEl.textContent).toBe('look');

        await startTextInput(h, textState({ preloadedText: 'look' }));
        await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));

        expect(h.outputEl.textContent).toBe('');
        expect(h.inputEl.value).toBe('look');
      });

      it('should keep the typed text on screen when the game prints after it', async () => {
        // Zork Zero: a compass click appends the direction to the typed text and prints it
        const h = setup();
        clickEndsInput(h, 'go ');
        const printed = document.createElement('span');
        printed.textContent = 'north\n';
        h.outputEl.appendChild(printed);

        await startTextInput(h, textState({ preloadedText: '' }));
        await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));

        expect(h.outputEl.textContent).toBe('go north\n');
      });

      it('should keep the typed text on screen when the game asks again with different text', async () => {
        const h = setup();
        clickEndsInput(h, 'look');

        await startTextInput(h, textState({ preloadedText: 'examine' }));
        await vi.waitFor(() => expect(h.inputEl.disabled).toBe(false));

        expect(h.outputEl.textContent).toBe('look');
      });
    });

    it('should leave typed text on screen without a newline when a click ends line input', () => {
      const h = setup();
      h.onInputComplete.mockRestore();
      const base = vi.spyOn(BaseInputProcessor.prototype, 'onInputComplete').mockImplementation(() => {});
      h.inputEl.value = 'go ';

      h.processor.onInputComplete(h.machine, 'go ', 254);

      expect(h.outputEl.textContent).toBe('go ');
      expect(h.inputEl.value).toBe('');
      expect(base).toHaveBeenCalledWith(h.machine, 'go ', 254);
      base.mockRestore();
    });
  });

  describe('promptForFilename', () => {
    it('should return the name the player types', async () => {
      const h = setup();
      vi.stubGlobal(
        'prompt',
        vi.fn(() => 'zork1.qzl')
      );

      await expect(h.processor.promptForFilename(h.machine, 'save')).resolves.toBe('zork1.qzl');
      vi.unstubAllGlobals();
    });

    it.each([null, '', '   '])('should return an empty name, cancelling the operation, for %j', async (answer) => {
      const h = setup();
      vi.stubGlobal(
        'prompt',
        vi.fn(() => answer)
      );

      await expect(h.processor.promptForFilename(h.machine, 'restore')).resolves.toBe('');
      vi.unstubAllGlobals();
    });

    it('should offer save.dat first, then the last name the player chose', async () => {
      const h = setup();
      const prompt = vi.fn().mockReturnValueOnce('castle.sav').mockReturnValueOnce(null);
      vi.stubGlobal('prompt', prompt);

      await h.processor.promptForFilename(h.machine, 'save');
      await h.processor.promptForFilename(h.machine, 'restore');

      expect(prompt).toHaveBeenNthCalledWith(1, 'Enter filename for save:', 'save.dat');
      expect(prompt).toHaveBeenNthCalledWith(2, 'Enter filename for restore:', 'castle.sav');
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
