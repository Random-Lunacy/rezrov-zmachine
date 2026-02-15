import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZMachine } from '../../../src/interpreter/ZMachine';
import { HeaderLocation } from '../../../src/utils/constants';
import { Logger, LogLevel } from '../../../src/utils/log';
import { MockInputProcessor, MockScreen } from '../../mocks';

// Suppress console output during tests
Logger.setLogToConsole(false);
Logger.setLevel(LogLevel.ERROR);

describe('ZMachine', () => {
  let storyBuffer: Buffer;
  let screen: MockScreen;
  let inputProcessor: MockInputProcessor;
  let logger: Logger;

  beforeEach(() => {
    // Create a minimal story buffer with version 3
    storyBuffer = Buffer.alloc(0x10000); // 64KB buffer
    storyBuffer[0] = 3; // Version 3

    // Set initial PC to a valid address
    storyBuffer[HeaderLocation.InitialPC] = 0x00;
    storyBuffer[HeaderLocation.InitialPC + 1] = 0x20;

    // Set object table to a valid address
    storyBuffer[HeaderLocation.ObjectTable] = 0x01;
    storyBuffer[HeaderLocation.ObjectTable + 1] = 0x00;

    // Set dictionary to a valid address
    storyBuffer[HeaderLocation.Dictionary] = 0x02;
    storyBuffer[HeaderLocation.Dictionary + 1] = 0x00;

    // Set global variables to a valid address
    storyBuffer[HeaderLocation.GlobalVariables] = 0x03;
    storyBuffer[HeaderLocation.GlobalVariables + 1] = 0x00;

    // Set static memory base to a valid address
    storyBuffer[HeaderLocation.StaticMemBase] = 0x04;
    storyBuffer[HeaderLocation.StaticMemBase + 1] = 0x00;

    // Set high memory base to a valid address
    storyBuffer[HeaderLocation.HighMemBase] = 0x05;
    storyBuffer[HeaderLocation.HighMemBase + 1] = 0x00;

    screen = new MockScreen();
    inputProcessor = new MockInputProcessor();
    logger = new Logger('ZMachineTest');

    // Spy on execute method
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'info').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with valid story buffer', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      expect(zmachine).toBeDefined();
      expect(zmachine.memory).toBeDefined();
      expect(zmachine.state).toBeDefined();
      expect(zmachine.executor).toBeDefined();
      expect(zmachine.screen).toBe(screen);
      expect(zmachine.inputProcessor).toBe(inputProcessor);
      expect(zmachine.logger).toBe(logger);
    });

    it('should configure screen capabilities based on Z-Machine version', () => {
      // Spy on screen methods
      vi.spyOn(screen, 'getSize').mockReturnValue({ rows: 20, cols: 80 });
      vi.spyOn(screen, 'getCapabilities').mockReturnValue({
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

      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Check that header bytes were set correctly for screen dimensions
      expect(zmachine.memory.getByte(HeaderLocation.ScreenHeightInLines)).toBe(20);
      expect(zmachine.memory.getByte(HeaderLocation.ScreenWidthInChars)).toBe(80);

      // For version 3, check that flags1 has appropriate bits set
      const flags1 = zmachine.memory.getByte(HeaderLocation.Flags1);
      expect(flags1 & 0x10).toBe(0x10); // Bit 4 (StatusLine)
      expect(flags1 & 0x20).toBe(0x20); // Bit 5 (SplitScreen)
    });

    it('should initialize UserStackManager for Version 6', () => {
      // Create a Version 6 story
      storyBuffer[0] = 6;

      // Version 6 requires non-zero routine and string offsets
      // Set RoutinesOffset at header location 0x28 (40)
      storyBuffer[HeaderLocation.RoutinesOffset] = 0x10;
      storyBuffer[HeaderLocation.RoutinesOffset + 1] = 0x00;

      // Set StaticStringsOffset at header location 0x2a (42)
      storyBuffer[HeaderLocation.StaticStringsOffset] = 0x20;
      storyBuffer[HeaderLocation.StaticStringsOffset + 1] = 0x00;

      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Should have UserStackManager
      expect(() => zmachine.getUserStackManager()).not.toThrow();
    });

    it('should throw when accessing UserStackManager in non-Version 6', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Should throw when accessing UserStackManager in Version 3
      expect(() => zmachine.getUserStackManager()).toThrow(/User stacks are only available in Version 6/);
    });
  });

  describe('Execute', () => {
    it('should start execution at initial PC from header', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Spy on executor
      const executeSpy = vi.spyOn(zmachine.executor, 'executeLoop').mockResolvedValue();

      zmachine.execute();

      // Check that PC was set to initial PC from header (0x0020)
      expect(zmachine.state.pc).toBe(0x0020);
      // Check that executeLoop was called
      expect(executeSpy).toHaveBeenCalled();
    });
  });

  describe('Input State', () => {
    it('should return input state when suspended', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock executor's suspendedInputState
      const mockInputState = { mode: 0, textBuffer: 0, parseBuffer: 0 };
      Object.defineProperty(zmachine.executor, 'suspendedInputState', {
        get: () => mockInputState,
      });

      expect(zmachine.getInputState()).toBe(mockInputState);
    });

    it('should return null when not suspended', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock executor's suspendedInputState to return null
      Object.defineProperty(zmachine.executor, 'suspendedInputState', {
        get: () => null,
      });

      expect(zmachine.getInputState()).toBeNull();
    });
  });

  describe('Save and Restore', () => {
    it('should save game state', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock storage saveSnapshot
      const saveSpy = vi.spyOn(zmachine.storage, 'saveSnapshot').mockResolvedValue();

      const result = await zmachine.saveGame();

      expect(result).toBe(true);
      expect(saveSpy).toHaveBeenCalled();
    });

    it('should handle save errors', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock storage saveSnapshot to throw
      vi.spyOn(zmachine.storage, 'saveSnapshot').mockRejectedValue(new Error('Save failed'));

      const result = await zmachine.saveGame();

      expect(result).toBe(false);
    });

    it('should restore game state', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock storage loadSnapshot and state's restoreFromSnapshot
      const loadSpy = vi.spyOn(zmachine.storage, 'loadSnapshot').mockResolvedValue({
        memory: Buffer.alloc(0x10000),
        pc: 0x1000,
        stack: [],
        callFrames: [],
        originalStory: Buffer.alloc(0x10000),
      });
      const restoreSpy = vi.spyOn(zmachine.state, 'restoreFromSnapshot').mockImplementation(() => {});

      const result = await zmachine.restoreGame();

      expect(result).toBe(true);
      expect(loadSpy).toHaveBeenCalled();
      expect(restoreSpy).toHaveBeenCalled();
    });

    it('should handle restore errors', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock storage loadSnapshot to throw
      vi.spyOn(zmachine.storage, 'loadSnapshot').mockRejectedValue(new Error('Restore failed'));

      const result = await zmachine.restoreGame();

      expect(result).toBe(false);
    });
  });

  describe('Undo / Redo', () => {
    it('should save undo state', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // We need access to the private _undoStack - use any to get around TypeScript
      const undoStack = (zmachine as any)._undoStack;
      expect(undoStack.length).toBe(0);

      const result = zmachine.saveUndo();

      expect(result).toBe(true);
      expect(undoStack.length).toBe(1);
    });

    it('should restore undo state', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Push a state to the undo stack
      zmachine.saveUndo();

      // Spy on state's restoreFromSnapshot
      const restoreSpy = vi.spyOn(zmachine.state, 'restoreFromSnapshot').mockImplementation(() => {});

      const result = zmachine.restoreUndo();

      expect(result).toBe(true);
      expect(restoreSpy).toHaveBeenCalled();

      // Stack should be empty now
      expect((zmachine as any)._undoStack.length).toBe(0);
    });

    it('should return false when no undo states available', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Don't push any states
      const result = zmachine.restoreUndo();

      expect(result).toBe(false);
    });

    it('should limit undo stack to max size', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Push more states than the max size
      const maxUndoLevels = (zmachine as any)._maxUndoLevels;

      for (let i = 0; i < maxUndoLevels + 5; i++) {
        zmachine.saveUndo();
      }

      // Check that the stack is limited to max size
      expect((zmachine as any)._undoStack.length).toBe(maxUndoLevels);
    });
  });

  describe('Restart', () => {
    it('should reset program counter and stacks', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Set up initial state
      zmachine.state.pc = 0x1000;
      zmachine.state.pushStack(0x1234);

      // Mock executor's executeLoop
      const executeSpy = vi.spyOn(zmachine.executor, 'executeLoop').mockResolvedValue();

      zmachine.restart();

      // PC should be reset to initial value from header (synchronously)
      expect(zmachine.state.pc).toBe(0x0020);
      // Stack should be empty (synchronously)
      expect(zmachine.state.stack.length).toBe(0);
      // Callstack should be empty (synchronously)
      expect(zmachine.state.callstack.length).toBe(0);

      // Wait for setImmediate callback to execute
      await new Promise((resolve) => setImmediate(resolve));

      // executor.executeLoop should be called (asynchronously in setImmediate)
      expect(executeSpy).toHaveBeenCalled();
    });

    it('should reset ALL dynamic memory to original story state', () => {
      // Create a story buffer with known initial values in dynamic memory
      const testStoryBuffer = Buffer.alloc(0x10000);
      testStoryBuffer[0] = 3; // Version 3

      // Set header fields
      testStoryBuffer[HeaderLocation.InitialPC] = 0x00;
      testStoryBuffer[HeaderLocation.InitialPC + 1] = 0x20;
      testStoryBuffer[HeaderLocation.ObjectTable] = 0x01;
      testStoryBuffer[HeaderLocation.ObjectTable + 1] = 0x00;
      testStoryBuffer[HeaderLocation.Dictionary] = 0x02;
      testStoryBuffer[HeaderLocation.Dictionary + 1] = 0x00;
      testStoryBuffer[HeaderLocation.GlobalVariables] = 0x03;
      testStoryBuffer[HeaderLocation.GlobalVariables + 1] = 0x00;
      // Static memory starts at 0x0400 (dynamic memory is 0x0000 - 0x03FF)
      testStoryBuffer[HeaderLocation.StaticMemBase] = 0x04;
      testStoryBuffer[HeaderLocation.StaticMemBase + 1] = 0x00;
      testStoryBuffer[HeaderLocation.HighMemBase] = 0x05;
      testStoryBuffer[HeaderLocation.HighMemBase + 1] = 0x00;

      // Set some initial values in dynamic memory (object/game state simulation)
      // These represent game state like object locations, inventory, etc.
      const testAddress1 = 0x100; // Object table area
      const testAddress2 = 0x200; // Another area in dynamic memory
      testStoryBuffer[testAddress1] = 0xAA; // Original value
      testStoryBuffer[testAddress2] = 0xBB; // Original value

      const zmachine = new ZMachine(testStoryBuffer, screen, inputProcessor, undefined, undefined, undefined, {
        logger,
      });

      // Mock executor's executeLoop
      vi.spyOn(zmachine.executor, 'executeLoop').mockResolvedValue();

      // Modify dynamic memory (simulating game state changes)
      zmachine.memory.buffer[testAddress1] = 0x11; // Changed value
      zmachine.memory.buffer[testAddress2] = 0x22; // Changed value

      // Verify the memory was modified
      expect(zmachine.memory.buffer[testAddress1]).toBe(0x11);
      expect(zmachine.memory.buffer[testAddress2]).toBe(0x22);

      // Restart the machine
      zmachine.restart();

      // Memory should be restored to original values
      expect(zmachine.memory.buffer[testAddress1]).toBe(0xAA);
      expect(zmachine.memory.buffer[testAddress2]).toBe(0xBB);
    });

    it('should clear undo stack on restart', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock executor's executeLoop
      vi.spyOn(zmachine.executor, 'executeLoop').mockResolvedValue();

      // Save some undo states
      zmachine.saveUndo();
      zmachine.saveUndo();
      expect((zmachine as any)._undoStack.length).toBe(2);

      // Restart
      zmachine.restart();

      // Undo stack should be cleared
      expect((zmachine as any)._undoStack.length).toBe(0);
    });

    it('should preserve interpreter-set header fields after restart', () => {
      // Spy on screen methods to provide consistent capabilities
      vi.spyOn(screen, 'getSize').mockReturnValue({ rows: 25, cols: 80 });
      vi.spyOn(screen, 'getCapabilities').mockReturnValue({
        hasColors: false,
        hasBold: true,
        hasItalic: true,
        hasReverseVideo: true,
        hasFixedPitch: true,
        hasSplitWindow: true,
        hasDisplayStatusBar: true,
        hasPictures: false,
        hasSound: false,
        hasTimedKeyboardInput: false,
      });

      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock executor's executeLoop
      vi.spyOn(zmachine.executor, 'executeLoop').mockResolvedValue();

      // Record the interpreter-set values before restart
      const interpreterNumberBefore = zmachine.memory.getByte(HeaderLocation.InterpreterNumber);
      const interpreterVersionBefore = zmachine.memory.getByte(HeaderLocation.InterpreterVersion);
      const screenHeightBefore = zmachine.memory.getByte(HeaderLocation.ScreenHeightInLines);
      const screenWidthBefore = zmachine.memory.getByte(HeaderLocation.ScreenWidthInChars);

      // Restart
      zmachine.restart();

      // Interpreter-set header fields should be restored/preserved
      expect(zmachine.memory.getByte(HeaderLocation.InterpreterNumber)).toBe(interpreterNumberBefore);
      expect(zmachine.memory.getByte(HeaderLocation.InterpreterVersion)).toBe(interpreterVersionBefore);
      expect(zmachine.memory.getByte(HeaderLocation.ScreenHeightInLines)).toBe(screenHeightBefore);
      expect(zmachine.memory.getByte(HeaderLocation.ScreenWidthInChars)).toBe(screenWidthBefore);
    });

    it('should cancel pending input and signal restart on restart', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock executor's executeLoop
      vi.spyOn(zmachine.executor, 'executeLoop').mockResolvedValue();

      // Spy on signalRestart and inputProcessor.cancelInput
      const signalRestartSpy = vi.spyOn(zmachine.executor, 'signalRestart');
      const cancelInputSpy = vi.spyOn(inputProcessor, 'cancelInput');

      // Restart
      zmachine.restart();

      // Verify signalRestart was called and input was cancelled (synchronously)
      expect(signalRestartSpy).toHaveBeenCalled();
      expect(cancelInputSpy).toHaveBeenCalledWith(zmachine);
    });

    it('should reset executor state asynchronously after restart', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock executor's executeLoop
      const executeLoopSpy = vi.spyOn(zmachine.executor, 'executeLoop').mockResolvedValue();

      // Spy on executor.reset
      const resetSpy = vi.spyOn(zmachine.executor, 'reset');

      // Restart
      zmachine.restart();

      // reset() and executeLoop() are called in setImmediate, so wait for it
      await new Promise((resolve) => setImmediate(resolve));

      // Verify executor was reset and executeLoop was called
      expect(resetSpy).toHaveBeenCalled();
      expect(executeLoopSpy).toHaveBeenCalled();
    });

    it('should allow clean restart even if executor was suspended', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock executor's executeLoop
      const executeLoopSpy = vi.spyOn(zmachine.executor, 'executeLoop').mockResolvedValue();

      // Simulate a suspended state by setting executor flags
      Object.defineProperty(zmachine.executor, '_suspended', { value: true, writable: true });
      Object.defineProperty(zmachine.executor, '_suspendedInputState', {
        value: { mode: 1, resultVar: 0 },
        writable: true,
      });
      Object.defineProperty(zmachine.executor, '_quit', { value: false, writable: true });
      Object.defineProperty(zmachine.executor, '_restarting', { value: false, writable: true });

      // Restart
      zmachine.restart();

      // Wait for the setImmediate callback to execute
      await new Promise((resolve) => setImmediate(resolve));

      // Verify executor flags were reset (via reset() method called in setImmediate)
      expect(zmachine.executor['_suspended']).toBe(false);
      expect(zmachine.executor['_suspendedInputState']).toBe(null);
      expect(zmachine.executor['_quit']).toBe(false);
      expect(zmachine.executor['_restarting']).toBe(false);

      // Verify executeLoop was called (should be able to run now)
      expect(executeLoopSpy).toHaveBeenCalled();
    });
  });

  describe('Quit', () => {
    it('should call executor.quit', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Spy on executor.quit
      const quitSpy = vi.spyOn(zmachine.executor, 'quit').mockImplementation(() => {});

      zmachine.quit();

      expect(quitSpy).toHaveBeenCalled();
    });
  });

  describe('Table operations (V5+)', () => {
    beforeEach(() => {
      // Update story buffer to Version 5
      storyBuffer[0] = 5;
    });

    it('should save auxiliary data to a file', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock inputProcessor.promptForFilename to return a valid filename
      const promptSpy = vi.spyOn(inputProcessor, 'promptForFilename');
      promptSpy.mockResolvedValue('test_aux.dat');

      // Mock storage writeRaw
      const writeRawSpy = vi.spyOn(zmachine.storage, 'writeRaw');
      writeRawSpy.mockResolvedValue(undefined);

      // Write some data to memory at the table address
      const tableAddr = 0x0150;
      const dataBytes = 8;
      for (let i = 0; i < dataBytes; i++) {
        zmachine.memory.setByte(tableAddr + i, 0x41 + i); // 'A', 'B', 'C', ...
      }

      const result = await zmachine.saveAuxiliary(tableAddr, dataBytes, 0, true);

      expect(result).toBe(true);
      expect(promptSpy).toHaveBeenCalledWith(zmachine, 'save');
      expect(writeRawSpy).toHaveBeenCalled();

      // Verify the written buffer has 32-byte name header + data
      const writtenBuffer = writeRawSpy.mock.calls[0][1];
      expect(writtenBuffer.length).toBe(32 + dataBytes);
      // Data starts at offset 32
      expect(writtenBuffer[32]).toBe(0x41); // 'A'
      expect(writtenBuffer[33]).toBe(0x42); // 'B'
    });

    it('should restore auxiliary data from a file', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock inputProcessor.promptForFilename
      const promptSpy = vi.spyOn(inputProcessor, 'promptForFilename');
      promptSpy.mockResolvedValue('test_aux.dat');

      // Create a mock auxiliary file: 32-byte name header + data
      const auxData = Buffer.alloc(32 + 8);
      // Name header: empty (no name)
      // Data: 0x41, 0x42, 0x43, ...
      for (let i = 0; i < 8; i++) {
        auxData[32 + i] = 0x41 + i;
      }

      const readRawSpy = vi.spyOn(zmachine.storage, 'readRaw');
      readRawSpy.mockResolvedValue(auxData);

      const tableAddr = 0x0150;
      const result = await zmachine.restoreAuxiliary(tableAddr, 8, 0, true);

      expect(result).toBe(8);
      expect(promptSpy).toHaveBeenCalledWith(zmachine, 'restore');

      // Verify data was written to memory
      expect(zmachine.memory.getByte(tableAddr)).toBe(0x41);
      expect(zmachine.memory.getByte(tableAddr + 1)).toBe(0x42);
    });

    it('should return 0 when auxiliary file not found', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      vi.spyOn(inputProcessor, 'promptForFilename').mockResolvedValue('test_aux.dat');
      vi.spyOn(zmachine.storage, 'readRaw').mockResolvedValue(null);

      const result = await zmachine.restoreAuxiliary(0x0150, 8, 0, true);

      expect(result).toBe(0);
    });

    it('should return false when user cancels save prompt', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      vi.spyOn(inputProcessor, 'promptForFilename').mockResolvedValue('');

      const result = await zmachine.saveAuxiliary(0x0150, 8, 0, true);

      expect(result).toBe(false);
    });
  });

  describe('Flag configuration', () => {
    it('should configure flags for Version 3', () => {
      // Use spies to examine the private method behavior
      const mockCapabilities = {
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

      vi.spyOn(screen, 'getCapabilities').mockReturnValue(mockCapabilities);

      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // For version 3, check that flags1 has appropriate bits set
      const flags1 = zmachine.memory.getByte(HeaderLocation.Flags1);

      // Status line (bit 4)
      expect(flags1 & 0x10).toBe(0x10);
      // Split screen (bit 5)
      expect(flags1 & 0x20).toBe(0x20);
      // Should not have version 4+ specific bits
      expect(flags1 & 0x01).toBe(0); // Colors
      expect(flags1 & 0x02).toBe(0); // Pictures
    });

    it('should configure flags for Version 4', () => {
      // Create a Version 4 story
      storyBuffer[0] = 4;

      const mockCapabilities = {
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

      vi.spyOn(screen, 'getCapabilities').mockReturnValue(mockCapabilities);

      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // For version 4+, check that flags1 has appropriate bits set
      const flags1 = zmachine.memory.getByte(HeaderLocation.Flags1);

      // Colors (bit 0)
      expect(flags1 & 0x01).toBe(0x01);
      // Pictures (bit 1)
      expect(flags1 & 0x02).toBe(0x02);
      // Bold font (bit 2)
      expect(flags1 & 0x04).toBe(0x04);
      // Italic font (bit 3)
      expect(flags1 & 0x08).toBe(0x08);
      // Fixed pitch font (bit 4)
      expect(flags1 & 0x10).toBe(0x10);
      // Sound (bit 5)
      expect(flags1 & 0x20).toBe(0x20);
      // Timed keyboard input (bit 7)
      expect(flags1 & 0x80).toBe(0x80);
    });

    it('should configure flags for Version 5', () => {
      // Create a Version 5 story
      storyBuffer[0] = 5;

      const mockCapabilities = {
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

      vi.spyOn(screen, 'getCapabilities').mockReturnValue(mockCapabilities);

      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // For version 5, check that flags1 has appropriate bits set
      const flags1 = zmachine.memory.getByte(HeaderLocation.Flags1);

      // Colors (bit 0)
      expect(flags1 & 0x01).toBe(0x01);
      // Pictures (bit 1)
      expect(flags1 & 0x02).toBe(0x02);
      // Bold font (bit 2)
      expect(flags1 & 0x04).toBe(0x04);
      // Italic font (bit 3)
      expect(flags1 & 0x08).toBe(0x08);
      // Fixed pitch font (bit 4)
      expect(flags1 & 0x10).toBe(0x10);
      // Sound (bit 5)
      expect(flags1 & 0x20).toBe(0x20);
      // Timed keyboard input (bit 7)
      expect(flags1 & 0x80).toBe(0x80);
    });

    it('should configure screen dimensions in units and font size for Version 5', () => {
      // Create a Version 5 story
      storyBuffer[0] = 5;

      vi.spyOn(screen, 'getSize').mockReturnValue({ rows: 25, cols: 80 });

      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Check screen dimensions in units
      expect(zmachine.memory.getWord(HeaderLocation.ScreenWidthInUnits)).toBe(80);
      expect(zmachine.memory.getWord(HeaderLocation.ScreenHeightInUnits)).toBe(25);

      // Check font size in units (1x1 for text mode)
      expect(zmachine.memory.getByte(HeaderLocation.FontWidthInUnits)).toBe(1);
      expect(zmachine.memory.getByte(HeaderLocation.FontHeightInUnits)).toBe(1);
    });

    it('should write default colors to header for Version 5', () => {
      // Create a Version 5 story
      storyBuffer[0] = 5;

      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Default colors should be White (9) foreground and Black (2) background
      expect(zmachine.memory.getByte(HeaderLocation.DefaultForegroundColor)).toBe(9); // Color.White
      expect(zmachine.memory.getByte(HeaderLocation.DefaultBackgroundColor)).toBe(2); // Color.Black
    });

    it('should respect custom default colors from Capabilities for Version 5', () => {
      storyBuffer[0] = 5;

      const mockCapabilities = {
        hasColors: true,
        hasBold: true,
        hasItalic: true,
        hasReverseVideo: true,
        hasFixedPitch: true,
        hasSplitWindow: true,
        hasDisplayStatusBar: true,
        hasPictures: false,
        hasSound: false,
        hasTimedKeyboardInput: false,
        defaultForeground: 8, // Color.Cyan
        defaultBackground: 3, // Color.Red
      };

      vi.spyOn(screen, 'getCapabilities').mockReturnValue(mockCapabilities);

      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      expect(zmachine.memory.getByte(HeaderLocation.DefaultForegroundColor)).toBe(8); // Cyan
      expect(zmachine.memory.getByte(HeaderLocation.DefaultBackgroundColor)).toBe(3); // Red
    });

    it('should not write default colors for Version 3', () => {
      // Version 3 story (default storyBuffer[0] = 3)
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Default colors should not be written for V3
      expect(zmachine.memory.getByte(HeaderLocation.DefaultForegroundColor)).toBe(0);
      expect(zmachine.memory.getByte(HeaderLocation.DefaultBackgroundColor)).toBe(0);
    });

    it('should configure flags for Version 4+ with disabled capabilities', () => {
      // Create a Version 5 story
      storyBuffer[0] = 5;

      const mockCapabilities = {
        hasColors: false,
        hasBold: false,
        hasItalic: false,
        hasReverseVideo: false,
        hasFixedPitch: false,
        hasSplitWindow: false,
        hasDisplayStatusBar: false,
        hasPictures: false,
        hasSound: false,
        hasTimedKeyboardInput: false,
      };

      vi.spyOn(screen, 'getCapabilities').mockReturnValue(mockCapabilities);

      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // For version 5 with all capabilities disabled, flags should be mostly cleared
      const flags1 = zmachine.memory.getByte(HeaderLocation.Flags1);

      // All capability bits should be cleared
      expect(flags1 & 0x01).toBe(0); // Colors
      expect(flags1 & 0x02).toBe(0); // Pictures
      expect(flags1 & 0x04).toBe(0); // Bold
      expect(flags1 & 0x08).toBe(0); // Italic
      expect(flags1 & 0x10).toBe(0); // Fixed pitch
      expect(flags1 & 0x20).toBe(0); // Sound
      expect(flags1 & 0x80).toBe(0); // Timed keyboard input
    });

    it('should configure flags for Version 3 with disabled capabilities', () => {
      const mockCapabilities = {
        hasColors: false,
        hasBold: false,
        hasItalic: false,
        hasReverseVideo: false,
        hasFixedPitch: false,
        hasSplitWindow: false,
        hasDisplayStatusBar: false,
        hasPictures: false,
        hasSound: false,
        hasTimedKeyboardInput: false,
      };

      vi.spyOn(screen, 'getCapabilities').mockReturnValue(mockCapabilities);

      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // For version 3, check that V3-specific flags are cleared
      const flags1 = zmachine.memory.getByte(HeaderLocation.Flags1);

      // Status line (bit 4) should be cleared
      expect(flags1 & 0x10).toBe(0);
      // Split screen (bit 5) should be cleared
      expect(flags1 & 0x20).toBe(0);
    });
  });

  describe('Undo error handling', () => {
    it('should handle error during saveUndo', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock getState to throw an error
      vi.spyOn(zmachine as any, 'getState').mockImplementation(() => {
        throw new Error('Memory allocation failed');
      });

      const result = zmachine.saveUndo();

      expect(result).toBe(false);
    });

    it('should handle error during restoreUndo', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // First save a valid undo state
      zmachine.saveUndo();

      // Mock setState to throw an error
      vi.spyOn(zmachine as any, 'setState').mockImplementation(() => {
        throw new Error('State restoration failed');
      });

      const result = zmachine.restoreUndo();

      expect(result).toBe(false);
    });

    it('should return false when undo stack shift returns undefined', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Manually manipulate the undo stack to test edge case
      (zmachine as any)._undoStack = [];

      const result = zmachine.restoreUndo();

      expect(result).toBe(false);
    });
  });

  describe('restoreAuxiliary error handling', () => {
    beforeEach(() => {
      storyBuffer[0] = 5;
    });

    it('should handle user canceling file selection', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      vi.spyOn(inputProcessor, 'promptForFilename').mockResolvedValue('');

      const result = await zmachine.restoreAuxiliary(0x0150, 32, 0, true);

      expect(result).toBe(0);
    });

    it('should handle errors during restore operation', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      vi.spyOn(inputProcessor, 'promptForFilename').mockResolvedValue('test_aux.dat');
      vi.spyOn(zmachine.storage, 'readRaw').mockRejectedValue(new Error('Disk error'));

      const result = await zmachine.restoreAuxiliary(0x0150, 32, 0, true);

      expect(result).toBe(0);
    });

    it('should reject file with mismatched name header', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      vi.spyOn(inputProcessor, 'promptForFilename').mockResolvedValue('test_aux.dat');

      // Set up a name in memory: length=3, "ABC"
      const nameAddr = 0x0180;
      zmachine.memory.setByte(nameAddr, 3);
      zmachine.memory.setByte(nameAddr + 1, 0x41); // A
      zmachine.memory.setByte(nameAddr + 2, 0x42); // B
      zmachine.memory.setByte(nameAddr + 3, 0x43); // C

      // Create aux file with different name: length=3, "XYZ"
      const auxData = Buffer.alloc(32 + 8);
      auxData[0] = 3;
      auxData[1] = 0x58; // X
      auxData[2] = 0x59; // Y
      auxData[3] = 0x5a; // Z

      vi.spyOn(zmachine.storage, 'readRaw').mockResolvedValue(auxData);

      const result = await zmachine.restoreAuxiliary(0x0150, 8, nameAddr, true);

      expect(result).toBe(0);
    });
  });

  describe('saveAuxiliary error handling', () => {
    beforeEach(() => {
      storyBuffer[0] = 5;
    });

    it('should handle user canceling file selection during save', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      vi.spyOn(inputProcessor, 'promptForFilename').mockResolvedValue('');

      const result = await zmachine.saveAuxiliary(0x0150, 32, 0, true);

      expect(result).toBe(false);
    });

    it('should handle errors during save operation', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      vi.spyOn(inputProcessor, 'promptForFilename').mockResolvedValue('test_aux.dat');
      vi.spyOn(zmachine.storage, 'writeRaw').mockRejectedValue(new Error('Disk full'));

      const result = await zmachine.saveAuxiliary(0x0150, 32, 0, true);

      expect(result).toBe(false);
    });

    it('should save without prompting when shouldPrompt is false', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      const writeRawSpy = vi.spyOn(zmachine.storage, 'writeRaw');
      writeRawSpy.mockResolvedValue(undefined);

      const promptSpy = vi.spyOn(inputProcessor, 'promptForFilename');

      const result = await zmachine.saveAuxiliary(0x0150, 8, 0, false);

      expect(result).toBe(true);
      expect(promptSpy).not.toHaveBeenCalled();
    });
  });

  describe('Restart with object factory', () => {
    it('should reset object factory cache on restart', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock executor's executeLoop
      vi.spyOn(zmachine.executor, 'executeLoop').mockResolvedValue();

      // Access the object factory to trigger its initialization
      const obj = zmachine.state.getObject(1);

      zmachine.restart();

      // The object factory should have been reset
      // We can verify this by checking that getObject works correctly after restart
      expect(zmachine.state.pc).toBe(0x0020);
    });

    it('should handle restart when object factory has no resetCache method', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock executor's executeLoop
      vi.spyOn(zmachine.executor, 'executeLoop').mockResolvedValue();

      // Remove the resetCache method from the object factory
      const objectFactory = (zmachine.state as any)._objectFactory;
      const originalResetCache = objectFactory.resetCache;
      delete objectFactory.resetCache;

      // Should not throw when object factory has no resetCache
      expect(() => zmachine.restart()).not.toThrow();

      // Restore for other tests
      objectFactory.resetCache = originalResetCache;
    });
  });

  describe('Execution error handling', () => {
    it('should log error when execution loop fails', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock executor's executeLoop to throw
      vi.spyOn(zmachine.executor, 'executeLoop').mockRejectedValue(new Error('Execution error'));

      // Spy on logger.error to verify it's called
      const errorSpy = vi.spyOn(logger, 'error');

      // Execute should handle the error gracefully
      zmachine.execute();

      // Wait for the promise to settle and verify error was logged
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Execution error'));
    });

    it('should log error when restart execution fails', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock executor's executeLoop to throw
      vi.spyOn(zmachine.executor, 'executeLoop').mockRejectedValue(new Error('Restart execution error'));

      // Spy on logger.error to verify it's called
      const errorSpy = vi.spyOn(logger, 'error');

      zmachine.restart();

      // Wait for the promise to settle and verify error was logged
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Restart execution error'));
    });
  });

  describe('Status bar', () => {
    it('should update status bar for version 3', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Set up global variables for status bar
      // Variable 16 = location object number
      // Variable 17 = score/hours
      // Variable 18 = moves/minutes
      const globalVarsAddr = zmachine.memory.getWord(HeaderLocation.GlobalVariables);
      zmachine.memory.setWord(globalVarsAddr, 0); // Location object = 0 (no location)
      zmachine.memory.setWord(globalVarsAddr + 2, 42); // Score = 42
      zmachine.memory.setWord(globalVarsAddr + 4, 100); // Moves = 100

      // Mock screen.updateStatusBar
      const updateStatusBarSpy = vi.spyOn(screen, 'updateStatusBar');

      zmachine.updateStatusBar();

      expect(updateStatusBarSpy).toHaveBeenCalledWith(null, 42, 100, false);
    });

    it('should not update status bar for version 5', () => {
      storyBuffer[0] = 5;
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock screen.updateStatusBar
      const updateStatusBarSpy = vi.spyOn(screen, 'updateStatusBar');

      zmachine.updateStatusBar();

      expect(updateStatusBarSpy).not.toHaveBeenCalled();
    });
  });

  describe('MultimediaHandler', () => {
    it('should use provided multimedia handler', () => {
      const customMultimediaHandler = {
        loadPicture: vi.fn(),
        drawPicture: vi.fn(),
        erasePicture: vi.fn(),
        getPictureInfo: vi.fn(),
        playSound: vi.fn(),
        stopSound: vi.fn(),
        logger: logger,
      };

      const zmachine = new ZMachine(
        storyBuffer,
        screen,
        inputProcessor,
        customMultimediaHandler as any,
        undefined,
        undefined,
        { logger }
      );

      expect(zmachine.multimediaHandler).toBe(customMultimediaHandler);
    });

    it('should create default multimedia handler when none provided', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      expect(zmachine.multimediaHandler).toBeDefined();
    });
  });

  describe('Original story buffer', () => {
    it('should expose a copy of the original story buffer', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Verify originalStory is accessible and has correct version
      expect(zmachine.originalStory).toBeDefined();
      expect(zmachine.originalStory[0]).toBe(3); // Version 3

      // originalStory is a COPY of the original buffer (not a reference)
      // This is required for proper restart functionality
      expect(zmachine.originalStory).not.toBe(storyBuffer);

      // The copy should have the same length
      expect(zmachine.originalStory.length).toBe(storyBuffer.length);

      // Key story file fields should match (version, addresses, etc.)
      expect(zmachine.originalStory[HeaderLocation.Version]).toBe(storyBuffer[HeaderLocation.Version]);
      expect(zmachine.originalStory[HeaderLocation.InitialPC]).toBe(storyBuffer[HeaderLocation.InitialPC]);
      expect(zmachine.originalStory[HeaderLocation.ObjectTable]).toBe(storyBuffer[HeaderLocation.ObjectTable]);
    });

    it('should not be affected by modifications to working memory', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Get original value
      const originalValue = zmachine.originalStory[0x100];

      // Modify working memory
      zmachine.memory.buffer[0x100] = 0xff;

      // Original story should be unchanged
      expect(zmachine.originalStory[0x100]).toBe(originalValue);
      expect(zmachine.memory.buffer[0x100]).toBe(0xff);
    });

    it('should preserve pristine header without interpreter modifications', () => {
      // Create a pristine story buffer with zeroed interpreter fields
      const pristineBuffer = Buffer.alloc(0x10000);
      pristineBuffer[0] = 3; // Version 3
      pristineBuffer[HeaderLocation.InitialPC] = 0x00;
      pristineBuffer[HeaderLocation.InitialPC + 1] = 0x20;
      pristineBuffer[HeaderLocation.ObjectTable] = 0x01;
      pristineBuffer[HeaderLocation.ObjectTable + 1] = 0x00;
      pristineBuffer[HeaderLocation.Dictionary] = 0x02;
      pristineBuffer[HeaderLocation.Dictionary + 1] = 0x00;
      pristineBuffer[HeaderLocation.GlobalVariables] = 0x03;
      pristineBuffer[HeaderLocation.GlobalVariables + 1] = 0x00;
      pristineBuffer[HeaderLocation.StaticMemBase] = 0x04;
      pristineBuffer[HeaderLocation.StaticMemBase + 1] = 0x00;
      pristineBuffer[HeaderLocation.HighMemBase] = 0x05;
      pristineBuffer[HeaderLocation.HighMemBase + 1] = 0x00;

      // Interpreter number and version should be 0 initially
      expect(pristineBuffer[HeaderLocation.InterpreterNumber]).toBe(0);
      expect(pristineBuffer[HeaderLocation.InterpreterVersion]).toBe(0);

      const zmachine = new ZMachine(pristineBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Working memory should have interpreter modifications
      expect(zmachine.memory.buffer[HeaderLocation.InterpreterNumber]).not.toBe(0);
      expect(zmachine.memory.buffer[HeaderLocation.InterpreterVersion]).not.toBe(0);

      // Original story should NOT have interpreter modifications (pristine copy)
      expect(zmachine.originalStory[HeaderLocation.InterpreterNumber]).toBe(0);
      expect(zmachine.originalStory[HeaderLocation.InterpreterVersion]).toBe(0);
    });
  });

});
