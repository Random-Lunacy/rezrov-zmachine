import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as readline from '../../../examples/console/node_modules/readline-sync';
import { StdioInputProcessor } from '../../../examples/console/StdioInputProcessor';
import { Logger, type InputState, type ZMachine } from '../../../src/index';
import { InputMode } from '../../../src/ui/input/InputInterface';

Logger.setLogToConsole(false);

/**
 * readline-sync blocks on a real TTY, so it can never run under Vitest.
 *
 * Mocked (and imported) by the path the SUT actually resolves to. A bare
 * `vi.mock('readline-sync')` registers against THIS file's resolution — the
 * repo root, where the package does not exist — so the ids never match and the
 * real library runs, failing with "environment doesn't support interactive
 * reading from TTY". The package lives only in examples/console/node_modules.
 *
 * The SUT does `import * as readline`, so the factory supplies named exports.
 */
vi.mock('../../../examples/console/node_modules/readline-sync', () => ({
  question: vi.fn(() => ''),
  keyIn: vi.fn(() => ''),
}));

const mocked = vi.mocked(readline);

function makeMachine(version = 5): ZMachine {
  return {
    logger: new Logger('TestMachine'),
    // loadTerminatingCharacters reads the header's terminating-chars address on
    // V5+; returning 0 means "no custom terminators", leaving the default [13].
    state: { version, memory: { getWord: vi.fn(() => 0), getByte: vi.fn(() => 0), setByte: vi.fn() } },
    memory: { getByte: vi.fn(() => 0) },
    getInputState: vi.fn(() => undefined),
  } as unknown as ZMachine;
}

/** Reach the protected hooks without the base class's setup work. */
function startText(p: StdioInputProcessor, m: ZMachine, state: InputState): void {
  (p as unknown as { doStartTextInput(m: ZMachine, s: InputState): void }).doStartTextInput(m, state);
}

function startChar(p: StdioInputProcessor, m: ZMachine, state: InputState): void {
  (p as unknown as { doStartCharInput(m: ZMachine, s: InputState): void }).doStartCharInput(m, state);
}

describe('StdioInputProcessor', () => {
  let processor: StdioInputProcessor;
  let machine: ZMachine;
  let onInputComplete: ReturnType<typeof vi.spyOn>;
  let onKeyPress: ReturnType<typeof vi.spyOn>;

  const textState = { mode: InputMode.TEXT } as InputState;
  const charState = { mode: InputMode.CHAR } as InputState;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new StdioInputProcessor();
    machine = makeMachine();
    // The base class's completion path needs a live executor and memory; what
    // this example contributes is the value it hands over, so observe that.
    onInputComplete = vi.spyOn(processor, 'onInputComplete').mockImplementation(() => {});
    onKeyPress = vi.spyOn(processor, 'onKeyPress').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('construction', () => {
    it('should accept an injected logger', () => {
      const logger = new Logger('Injected');

      expect(() => new StdioInputProcessor({ logger })).not.toThrow();
    });

    it('should default its own logger when none is given', () => {
      expect(() => new StdioInputProcessor()).not.toThrow();
    });
  });

  describe('text input', () => {
    it('should hand the typed line to the completion path', () => {
      mocked.question.mockReturnValue('open mailbox');

      startText(processor, machine, textState);

      expect(onInputComplete).toHaveBeenCalledWith(machine, 'open mailbox', expect.any(Number));
    });

    it('should prompt with an empty string, since the story already printed one', () => {
      startText(processor, machine, textState);

      expect(mocked.question).toHaveBeenCalledWith('');
    });

    it('should report Enter as the terminator for an ordinary line', () => {
      mocked.question.mockReturnValue('north');

      startText(processor, machine, textState);

      expect(onInputComplete).toHaveBeenCalledWith(machine, 'north', 13);
    });

    it('should pass an empty line straight through', () => {
      mocked.question.mockReturnValue('');

      startText(processor, machine, textState);

      expect(onInputComplete).toHaveBeenCalledWith(machine, '', 13);
    });

    it('should fall back to an empty line with Enter when readline throws', () => {
      mocked.question.mockImplementation(() => {
        throw new Error('stdin closed');
      });

      startText(processor, machine, textState);

      expect(onInputComplete).toHaveBeenCalledWith(machine, '', 13);
    });

    it('should not propagate a readline failure to the caller', () => {
      mocked.question.mockImplementation(() => {
        throw new Error('stdin closed');
      });

      expect(() => startText(processor, machine, textState)).not.toThrow();
    });
  });

  describe('character input', () => {
    it('should hand the pressed key to the key path', () => {
      mocked.keyIn.mockReturnValue('y');

      startChar(processor, machine, charState);

      expect(onKeyPress).toHaveBeenCalledWith(machine, 'y');
    });

    it('should suppress the terminal echo', () => {
      startChar(processor, machine, charState);

      expect(mocked.keyIn).toHaveBeenCalledWith('', { hideEchoBack: true });
    });

    it('should fall back to a NUL character when readline throws', () => {
      mocked.keyIn.mockImplementation(() => {
        throw new Error('stdin closed');
      });

      startChar(processor, machine, charState);

      expect(onKeyPress).toHaveBeenCalledWith(machine, '\0');
    });

    it('should not propagate a readline failure to the caller', () => {
      mocked.keyIn.mockImplementation(() => {
        throw new Error('stdin closed');
      });

      expect(() => startChar(processor, machine, charState)).not.toThrow();
    });
  });

  describe('promptForFilename', () => {
    it('should name the operation in the prompt', async () => {
      const write = vi.spyOn(process.stdout, 'write').mockImplementation((() => true) as never);
      mocked.question.mockReturnValue('zork1.qzl');

      await processor.promptForFilename(machine, 'save');

      expect(write).toHaveBeenCalledWith('Enter filename for save: ');
    });

    it('should return the filename the player types', async () => {
      vi.spyOn(process.stdout, 'write').mockImplementation((() => true) as never);
      mocked.question.mockReturnValue('zork1.qzl');

      await expect(processor.promptForFilename(machine, 'restore')).resolves.toBe('zork1.qzl');
    });
  });

  describe('cleanup', () => {
    it('should be a safe no-op, since readline-sync holds no state', () => {
      expect(() => processor.cleanup()).not.toThrow();
    });

    it('should be idempotent', () => {
      processor.cleanup();

      expect(() => processor.cleanup()).not.toThrow();
    });
  });
});
