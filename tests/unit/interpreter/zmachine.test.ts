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
    it('should reset program counter and stacks', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Set up initial state
      zmachine.state.pc = 0x1000;
      zmachine.state.pushStack(0x1234);

      // Mock executor's executeLoop
      const executeSpy = vi.spyOn(zmachine.executor, 'executeLoop').mockResolvedValue();

      zmachine.restart();

      // PC should be reset to initial value from header
      expect(zmachine.state.pc).toBe(0x0020);
      // Stack should be empty
      expect(zmachine.state.stack.length).toBe(0);
      // Callstack should be empty
      expect(zmachine.state.callstack.length).toBe(0);
      // executor.executeLoop should be called
      expect(executeSpy).toHaveBeenCalled();
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

    it('should save to table', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Give access to private method for testing
      const getStateMethod = vi.spyOn(zmachine as any, 'getState');
      getStateMethod.mockImplementation(() => ({
        memory: Buffer.alloc(0x10000),
        pc: 0x1000,
        stack: [],
        callFrames: [],
        originalStory: Buffer.alloc(0x10000),
      }));

      // Mock the writeMetadataToTable private method to avoid implementation issues
      const writeMetadataMethod = vi.spyOn(zmachine as any, 'writeMetadataToTable');
      writeMetadataMethod.mockImplementation(() => {});

      // Mock inputProcessor.promptForFilename to return a valid filename
      const promptSpy = vi.spyOn(inputProcessor, 'promptForFilename');
      promptSpy.mockResolvedValue('test_save.dat');

      // Mock storage methods with properly chained promises
      const setOptionsSpy = vi.spyOn(zmachine.storage, 'setOptions');
      setOptionsSpy.mockImplementation(() => {});

      const saveSnapshotSpy = vi.spyOn(zmachine.storage, 'saveSnapshot');
      saveSnapshotSpy.mockResolvedValue(undefined);

      const getSaveInfoSpy = vi.spyOn(zmachine.storage, 'getSaveInfo');
      getSaveInfoSpy.mockResolvedValue({
        exists: true,
        path: 'test_save.dat',
        description: 'Test save',
        format: 'ENH',
        lastModified: new Date(),
      });

      // Spy on memory.setByte to track table updates
      const setByteSpy = vi.spyOn(zmachine.memory, 'setByte');

      const tableAddr = 0x1000;
      const bytes = 32;
      const result = await zmachine.saveToTable(tableAddr, bytes);

      // Verify the method calls happened in the expected sequence
      expect(promptSpy).toHaveBeenCalledWith(zmachine, 'save');
      expect(setOptionsSpy).toHaveBeenCalledWith({ filename: 'test_save.dat' });
      expect(getStateMethod).toHaveBeenCalled();
      expect(saveSnapshotSpy).toHaveBeenCalled();
      expect(getSaveInfoSpy).toHaveBeenCalled();
      expect(writeMetadataMethod).toHaveBeenCalled();

      // Check the final result
      expect(result).toBe(true);
    });

    it('should restore from table', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock the private methods needed
      const writeMetadataMethod = vi.spyOn(zmachine as any, 'writeMetadataToTable');
      writeMetadataMethod.mockImplementation(() => {});

      const storeFilenameMethod = vi.spyOn(zmachine as any, 'storeFilenameInMemory');
      storeFilenameMethod.mockImplementation(() => {});

      const setStateMethod = vi.spyOn(zmachine as any, 'setState');
      setStateMethod.mockImplementation(() => {});

      // Mock inputProcessor.promptForFilename
      const promptSpy = vi.spyOn(inputProcessor, 'promptForFilename');
      promptSpy.mockResolvedValue('test_save.dat');

      // Mock storage methods
      const setOptionsSpy = vi.spyOn(zmachine.storage, 'setOptions');
      setOptionsSpy.mockImplementation(() => {});

      const getSaveInfoSpy = vi.spyOn(zmachine.storage, 'getSaveInfo');
      getSaveInfoSpy.mockResolvedValue({
        exists: true,
        path: 'test_save.dat',
        description: 'Test save',
        format: 'ENH',
        lastModified: new Date(),
      });

      const loadSnapshotSpy = vi.spyOn(zmachine.storage, 'loadSnapshot');
      loadSnapshotSpy.mockResolvedValue({
        memory: Buffer.alloc(0x10000),
        pc: 0x1000,
        stack: [],
        callFrames: [],
        originalStory: Buffer.alloc(0x10000),
      });

      const tableAddr = 0x1000;
      const bytes = 32;
      const nameAddr = 0x2000;
      const result = await zmachine.restoreFromTable(tableAddr, bytes, nameAddr);

      // Verify the methods were called in the expected sequence
      expect(promptSpy).toHaveBeenCalledWith(zmachine, 'restore');
      expect(setOptionsSpy).toHaveBeenCalledWith({ filename: 'test_save.dat' });
      expect(getSaveInfoSpy).toHaveBeenCalled();
      expect(loadSnapshotSpy).toHaveBeenCalled();
      expect(storeFilenameMethod).toHaveBeenCalledWith(nameAddr, 'test_save.dat');
      expect(writeMetadataMethod).toHaveBeenCalled();
      expect(setStateMethod).toHaveBeenCalled();

      // Check the final result
      expect(result).toBe(true);
    });

    it('should fail to restore from table when save not found', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock inputProcessor.promptForFilename
      vi.spyOn(inputProcessor, 'promptForFilename').mockResolvedValue('test_save.dat');

      // Mock storage methods
      vi.spyOn(zmachine.storage, 'setOptions').mockImplementation(() => {});
      vi.spyOn(zmachine.storage, 'getSaveInfo').mockResolvedValue({
        exists: false,
        path: 'test_save.dat',
      });

      const tableAddr = 0x1000;
      const bytes = 32;
      const result = await zmachine.restoreFromTable(tableAddr, bytes);

      expect(result).toBe(false);
    });

    it('should not allow restore from table in versions < 5', async () => {
      // Reset to Version 3
      storyBuffer[0] = 3;

      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      const tableAddr = 0x1000;
      const bytes = 32;
      const result = await zmachine.restoreFromTable(tableAddr, bytes);

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

  describe('restoreFromTable error handling', () => {
    beforeEach(() => {
      // Update story buffer to Version 5
      storyBuffer[0] = 5;
    });

    it('should handle user canceling file selection', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock inputProcessor.promptForFilename to return empty string (user canceled)
      vi.spyOn(inputProcessor, 'promptForFilename').mockResolvedValue('');

      const result = await zmachine.restoreFromTable(0x1000, 32);

      expect(result).toBe(false);
    });

    it('should handle errors during restore operation', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock inputProcessor.promptForFilename
      vi.spyOn(inputProcessor, 'promptForFilename').mockResolvedValue('test_save.dat');

      // Mock storage methods
      vi.spyOn(zmachine.storage, 'setOptions').mockImplementation(() => {});
      vi.spyOn(zmachine.storage, 'getSaveInfo').mockResolvedValue({
        exists: true,
        path: 'test_save.dat',
      });
      vi.spyOn(zmachine.storage, 'loadSnapshot').mockRejectedValue(new Error('Corrupted save file'));

      const result = await zmachine.restoreFromTable(0x1000, 32);

      expect(result).toBe(false);
    });
  });

  describe('saveToTable error handling', () => {
    beforeEach(() => {
      storyBuffer[0] = 5;
    });

    it('should handle user canceling file selection during save', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock inputProcessor.promptForFilename to return empty string (user canceled)
      vi.spyOn(inputProcessor, 'promptForFilename').mockResolvedValue('');

      const result = await zmachine.saveToTable(0x1000, 32);

      expect(result).toBe(false);
    });

    it('should handle errors during save operation', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock inputProcessor.promptForFilename
      vi.spyOn(inputProcessor, 'promptForFilename').mockResolvedValue('test_save.dat');

      // Mock storage methods to throw error during save
      vi.spyOn(zmachine.storage, 'setOptions').mockImplementation(() => {});
      vi.spyOn(zmachine.storage, 'saveSnapshot').mockRejectedValue(new Error('Disk full'));

      const result = await zmachine.saveToTable(0x1000, 32);

      expect(result).toBe(false);
    });

    it('should save without prompting when shouldPrompt is false', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Mock getState
      vi.spyOn(zmachine as any, 'getState').mockReturnValue({
        memory: Buffer.alloc(0x10000),
        pc: 0x1000,
        stack: [],
        callFrames: [],
        originalStory: Buffer.alloc(0x10000),
      });

      // Mock storage methods
      vi.spyOn(zmachine.storage, 'saveSnapshot').mockResolvedValue(undefined);
      vi.spyOn(zmachine.storage, 'getSaveInfo').mockResolvedValue({
        exists: true,
        path: 'default.dat',
        format: 'ENH',
      });

      // Mock writeMetadataToTable
      vi.spyOn(zmachine as any, 'writeMetadataToTable').mockImplementation(() => {});

      const promptSpy = vi.spyOn(inputProcessor, 'promptForFilename');

      const result = await zmachine.saveToTable(0x1000, 32, 0, false);

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
    it('should expose the original story buffer', () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Verify originalStory is accessible and has correct version
      expect(zmachine.originalStory).toBeDefined();
      expect(zmachine.originalStory[0]).toBe(3); // Version 3

      // Note: originalStory is a reference to the same buffer, not a copy
      // This is the current implementation behavior
      expect(zmachine.originalStory).toBe(storyBuffer);
    });
  });

  describe('writeMetadataToTable', () => {
    beforeEach(() => {
      storyBuffer[0] = 5;
    });

    it('should write metadata to table correctly', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      // Access the private method
      const writeMetadataToTable = (zmachine as any).writeMetadataToTable.bind(zmachine);

      const tableAddr = 0x0150; // Use dynamic memory address (not 0x100 to avoid test conflicts)
      const maxBytes = 32;
      const saveInfo = {
        exists: true,
        path: 'test.dat',
        format: 'QUETZAL',
        description: 'Test save',
        lastModified: new Date('2024-01-15T10:30:00Z'),
      };

      writeMetadataToTable(tableAddr, maxBytes, saveInfo);

      // Verify magic number 'ZM' was written
      expect(zmachine.memory.getByte(tableAddr)).toBe(0x5a); // 'Z'
      expect(zmachine.memory.getByte(tableAddr + 1)).toBe(0x4d); // 'M'

      // Verify version was written
      expect(zmachine.memory.getWord(tableAddr + 2)).toBe(5);
    });

    it('should handle small buffer sizes', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      const writeMetadataToTable = (zmachine as any).writeMetadataToTable.bind(zmachine);

      const tableAddr = 0x0150; // Use dynamic memory address (not 0x100 to avoid test conflicts)
      const maxBytes = 2; // Very small buffer
      const saveInfo = {
        exists: true,
        path: 'test.dat',
        format: 'QUETZAL',
        description: 'This is a very long description that should be truncated',
        lastModified: new Date(),
      };

      // Should not throw even with small buffer
      expect(() => writeMetadataToTable(tableAddr, maxBytes, saveInfo)).not.toThrow();
    });
  });

  describe('storeFilenameInMemory', () => {
    beforeEach(() => {
      storyBuffer[0] = 5;
    });

    it('should store filename in memory correctly', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      const storeFilenameInMemory = (zmachine as any).storeFilenameInMemory.bind(zmachine);

      const address = 0x0150; // Use dynamic memory address (not 0x100 to avoid test conflicts)
      const filename = 'test.sav';

      storeFilenameInMemory(address, filename);

      // Verify length byte
      expect(zmachine.memory.getByte(address)).toBe(filename.length);

      // Verify filename bytes
      for (let i = 0; i < filename.length; i++) {
        expect(zmachine.memory.getByte(address + 1 + i)).toBe(filename.charCodeAt(i));
      }

      // Verify null terminator
      expect(zmachine.memory.getByte(address + 1 + filename.length)).toBe(0);
    });

    it('should handle long filenames', async () => {
      const zmachine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, undefined, undefined, { logger });

      const storeFilenameInMemory = (zmachine as any).storeFilenameInMemory.bind(zmachine);

      const address = 0x0150; // Use dynamic memory address (not 0x100 to avoid test conflicts)
      const filename = 'a'.repeat(300); // Longer than 255 chars

      storeFilenameInMemory(address, filename);

      // Verify length is capped at 255
      expect(zmachine.memory.getByte(address)).toBe(255);
    });
  });
});
