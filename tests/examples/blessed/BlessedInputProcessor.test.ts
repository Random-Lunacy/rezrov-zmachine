import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlessedInputProcessor } from '../../../examples/blessedConsole/BlessedInputProcessor';
import { BlessedScreen } from '../../../examples/blessedConsole/BlessedScreen';
import { Logger, type InputState, type ZMachine } from '../../../src/index';
import { InputMode } from '../../../src/ui/input/InputInterface';
import { created, resetBlessedMock, trackStdoutResizeListeners, type MockScreen, type MockWidget } from './blessedMock';

Logger.setLogToConsole(false);

// Mocked by the path the SUT resolves to — see BlessedScreen.test.ts.
vi.mock('../../../examples/blessedConsole/node_modules/blessed', async () => {
  const { createBlessedModule } = await import('./blessedMock');
  return createBlessedModule();
});

function makeMachine(version = 5): ZMachine {
  return {
    logger: new Logger('TestMachine'),
    state: { version, memory: { getByte: vi.fn(() => 8), getWord: vi.fn(() => 0), setByte: vi.fn() } },
    memory: { getByte: vi.fn(() => 8) },
    executor: { isSuspended: false },
    getInputState: vi.fn(() => undefined),
  } as unknown as ZMachine;
}

function invoke<T>(target: object, method: string, ...args: unknown[]): T {
  return (target as unknown as Record<string, (...a: unknown[]) => T>)[method](...args);
}

const charState = { mode: InputMode.CHAR } as InputState;

describe('BlessedInputProcessor', () => {
  let processor: BlessedInputProcessor;
  let blessedScreen: BlessedScreen;
  let machine: ZMachine;
  let mockScreen: MockScreen;
  let mainWindow: MockWidget;
  let onKeyPress: ReturnType<typeof vi.spyOn>;
  let restoreStdout: () => void;

  /** Deliver a keypress the way blessed would. */
  function press(name: string | undefined, ch = ''): void {
    mockScreen.emit('keypress', ch, name === undefined ? {} : { name });
  }

  beforeEach(() => {
    resetBlessedMock();
    restoreStdout = trackStdoutResizeListeners();
    blessedScreen = new BlessedScreen();
    mockScreen = created.screens[0];
    mainWindow = created.boxes[1];
    machine = makeMachine();
    processor = new BlessedInputProcessor(blessedScreen);
    onKeyPress = vi.spyOn(processor, 'onKeyPress').mockImplementation(() => {});
  });

  afterEach(() => {
    restoreStdout();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('processTerminatingCharacters', () => {
    it('should report Enter for empty input', () => {
      expect(processor.processTerminatingCharacters('', [13])).toBe(13);
    });

    it('should report Enter for an ordinary line', () => {
      expect(processor.processTerminatingCharacters('north', [13])).toBe(13);
    });

    it('should return the last character when it is a terminator', () => {
      expect(processor.processTerminatingCharacters(`open${String.fromCharCode(129)}`, [13, 129])).toBe(129);
    });

    it('should find a function-key terminator mid-string', () => {
      const input = `a${String.fromCharCode(133)}b`;

      expect(processor.processTerminatingCharacters(input, [13, 133])).toBe(133);
    });

    it('should accept a terminator in the 252-254 range', () => {
      const input = `a${String.fromCharCode(253)}b`;

      expect(processor.processTerminatingCharacters(input, [13, 253])).toBe(253);
    });

    it('should ignore a mid-string terminator outside the function-key ranges', () => {
      // 'b' (98) is listed as a terminator but is not a function key, so the
      // range guard rejects it and the default Enter is reported instead.
      expect(processor.processTerminatingCharacters('abc', [13, 98])).toBe(13);
    });

    it('should report Enter when nothing matches', () => {
      expect(processor.processTerminatingCharacters('abc', [13])).toBe(13);
    });

    it('should fall back to Enter with an empty terminator list', () => {
      expect(processor.processTerminatingCharacters('abc', [])).toBe(13);
    });
  });

  describe('getPendingMouseClick', () => {
    it('should report no click before one happens', () => {
      expect(processor.getPendingMouseClick()).toBeNull();
    });

    it('should return the recorded click and then clear it', () => {
      invoke(processor, 'doStartCharInput', machine, charState);

      mainWindow.emit('click', { x: 3, y: 4, button: 'left' });

      expect(processor.getPendingMouseClick()).toEqual({ x: 4, y: 5, button: 1 });
      expect(processor.getPendingMouseClick()).toBeNull();
    });

    it('should signal a click as ZSCII 254 during character input', () => {
      invoke(processor, 'doStartCharInput', machine, charState);

      mainWindow.emit('click', { x: 0, y: 0, button: 'left' });

      expect(onKeyPress).toHaveBeenCalledWith(machine, String.fromCharCode(254));
    });
  });

  describe('character input key mapping', () => {
    beforeEach(() => {
      invoke(processor, 'doStartCharInput', machine, charState);
    });

    it.each([
      ['enter', 13],
      ['return', 13],
      ['escape', 27],
      ['up', 129],
      ['down', 130],
      ['left', 131],
      ['right', 132],
      ['delete', 8],
      ['backspace', 8],
    ] as const)('should map %s to ZSCII %i', (name, zscii) => {
      press(name);

      expect(onKeyPress).toHaveBeenCalledWith(machine, String.fromCharCode(zscii));
    });

    it.each([
      ['f1', 133],
      ['f5', 137],
      ['f12', 144],
    ] as const)('should map %s to ZSCII %i', (name, zscii) => {
      press(name);

      expect(onKeyPress).toHaveBeenCalledWith(machine, String.fromCharCode(zscii));
    });

    it('should map space to a literal space', () => {
      press('space');

      expect(onKeyPress).toHaveBeenCalledWith(machine, ' ');
    });

    it.each(['a', 'Z', '7', '?'])('should pass the printable key %s straight through', (ch) => {
      press(ch, ch);

      expect(onKeyPress).toHaveBeenCalledWith(machine, ch);
    });

    it('should keep waiting after a mouse pseudo-key', () => {
      press('mouse');

      expect(onKeyPress).not.toHaveBeenCalled();
      expect(mockScreen.handlers.get('keypress')).toHaveLength(1);
    });

    it('should keep waiting through a partial escape sequence', () => {
      mockScreen.emit('keypress', '', { sequence: '\x1b[A' });

      expect(onKeyPress).not.toHaveBeenCalled();
      expect(mockScreen.handlers.get('keypress')).toHaveLength(1);
    });

    it('should restart rather than report an unrecognised non-printable key', () => {
      press(undefined, String.fromCharCode(31));

      expect(onKeyPress).not.toHaveBeenCalled();
      // The restart re-registers a fresh listener.
      expect(mockScreen.handlers.get('keypress')).toHaveLength(1);
    });

    it('should reject a high-bit character from a mouse event', () => {
      press(undefined, String.fromCharCode(200));

      expect(onKeyPress).not.toHaveBeenCalled();
    });

    it('should detach its listener once a key is accepted', () => {
      press('a', 'a');

      expect(mockScreen.handlers.get('keypress')).toHaveLength(0);
    });

    it('should report only the first accepted key', () => {
      press('a', 'a');
      press('b', 'b');

      expect(onKeyPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('onInputTimeout', () => {
    it('should ignore a stale timeout once input is no longer pending', () => {
      const state = { mode: InputMode.TEXT, time: 10, routine: 0x1234 } as InputState;

      processor.onInputTimeout(machine, state);

      expect(state.currentInput).toBeUndefined();
    });

    it('should hand the partially typed line to the timeout routine', () => {
      const state = { mode: InputMode.TEXT, time: 10, routine: 0x1234 } as InputState;
      (processor as unknown as { isWaitingForInput: boolean }).isWaitingForInput = true;
      (processor as unknown as { currentInput: string }).currentInput = 'open the ';

      processor.onInputTimeout(machine, state);

      expect(state.currentInput).toBe('open the ');
    });

    it('should pause input handling while the routine runs', () => {
      const state = { mode: InputMode.TEXT, time: 10, routine: 0x1234 } as InputState;
      (processor as unknown as { isWaitingForInput: boolean }).isWaitingForInput = true;

      processor.onInputTimeout(machine, state);

      expect((processor as unknown as { isExecutingTimeoutRoutine: boolean }).isExecutingTimeoutRoutine).toBe(true);
    });
  });

  describe('handleTimedInput', () => {
    it('should bail out and clear the flag when input ended during the routine', () => {
      const state = { mode: InputMode.TEXT, time: 10, routine: 0x1234 } as InputState;
      const p = processor as unknown as { isExecutingTimeoutRoutine: boolean; isWaitingForInput: boolean };
      p.isExecutingTimeoutRoutine = true;
      p.isWaitingForInput = false;

      processor.handleTimedInput(machine, state);

      expect(p.isExecutingTimeoutRoutine).toBe(false);
    });

    it('should proceed on initial setup, before isWaitingForInput is set', () => {
      // The guard only applies when coming back from a routine; on first setup
      // isWaitingForInput is legitimately still false and input must start.
      const state = { mode: InputMode.TEXT, time: 10, routine: 0x1234 } as InputState;
      const p = processor as unknown as { isExecutingTimeoutRoutine: boolean; isWaitingForInput: boolean };
      p.isExecutingTimeoutRoutine = false;
      p.isWaitingForInput = false;

      expect(() => processor.handleTimedInput(machine, state)).not.toThrow();
      expect(p.isExecutingTimeoutRoutine).toBe(false);
    });

    it('should resume input handling after the routine finishes', () => {
      const state = { mode: InputMode.TEXT, time: 10, routine: 0x1234 } as InputState;
      const p = processor as unknown as { isExecutingTimeoutRoutine: boolean; isWaitingForInput: boolean };
      p.isExecutingTimeoutRoutine = true;
      p.isWaitingForInput = true;

      processor.handleTimedInput(machine, state);

      expect(p.isExecutingTimeoutRoutine).toBe(false);
    });
  });

  describe('cursor blink', () => {
    it('should toggle the cursor on the blink interval', () => {
      vi.useFakeTimers();
      const p = processor as unknown as { cursorVisible: boolean };
      invoke(processor, 'startCursorBlink');
      const before = p.cursorVisible;

      vi.advanceTimersByTime(500);

      expect(p.cursorVisible).toBe(!before);
    });

    it('should stop toggling once the blink is cancelled', () => {
      vi.useFakeTimers();
      const p = processor as unknown as { cursorVisible: boolean };
      invoke(processor, 'startCursorBlink');
      invoke(processor, 'stopCursorBlink');
      const after = p.cursorVisible;

      vi.advanceTimersByTime(2000);

      expect(p.cursorVisible).toBe(after);
    });
  });

  describe('promptForFilename', () => {
    it('should resolve with the submitted filename', async () => {
      const pending = processor.promptForFilename(machine, 'save');
      const textbox = created.textboxes[0];

      textbox.emit('submit', 'zork1.qzl');

      await expect(pending).resolves.toBe('zork1.qzl');
    });

    it('should focus the prompt so the player can type immediately', () => {
      void processor.promptForFilename(machine, 'save');

      expect(created.textboxes[0].focus).toHaveBeenCalled();
    });

    it('should resolve with an empty name when the prompt is cancelled', async () => {
      const pending = processor.promptForFilename(machine, 'save');

      created.textboxes[0].emit('cancel');

      await expect(pending).resolves.toBe('');
    });

    it('should resolve with an empty name when escape is pressed', async () => {
      const pending = processor.promptForFilename(machine, 'save');

      created.textboxes[0].pressKey('escape');

      await expect(pending).resolves.toBe('');
    });

    it('should settle only once even if submit and cancel both fire', async () => {
      const pending = processor.promptForFilename(machine, 'save');
      const textbox = created.textboxes[0];

      textbox.emit('submit', 'first.qzl');
      textbox.emit('cancel');

      await expect(pending).resolves.toBe('first.qzl');
      expect(mockScreen.remove).toHaveBeenCalledTimes(1);
    });
  });
});
