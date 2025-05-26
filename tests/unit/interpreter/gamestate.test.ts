import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStackFrame } from '../../../src/core/execution/StackFrame';
import { Memory } from '../../../src/core/memory/Memory';
import { GameState } from '../../../src/interpreter/GameState';
import { HeaderLocation } from '../../../src/utils/constants';
import { Logger } from '../../../src/utils/log';
import { MockMemory } from '../../mocks/MockMemory';

// Helper to create a clean mock memory with specific header values
function createMockMemoryWithHeader(version: number = 3): MockMemory {
  const memory = new MockMemory();

  // Direct implementation - no chaining or complex patterns
  memory.getByte.mockImplementation((addr: number) => {
    if (addr === HeaderLocation.Version) return version;
    return 0;
  });

  memory.getWord.mockImplementation((addr: number) => {
    switch (addr) {
      case HeaderLocation.HighMemBase:
        return 0x1000;
      case HeaderLocation.GlobalVariables:
        return 0x0c00;
      case HeaderLocation.AbbreviationsTable:
        return 0x0e00;
      case HeaderLocation.ObjectTable:
        return 0x0800;
      case HeaderLocation.Dictionary:
        return 0x0a00;
      case HeaderLocation.RoutinesOffset:
        return 0x2000;
      case HeaderLocation.StaticStringsOffset:
        return 0x3000;
      default:
        // For global variable access
        if (addr >= 0x0c00 && addr < 0x0c00 + 240) {
          return 42; // Default value for globals
        }
        return 0;
    }
  });

  // Mock other required methods
  memory.isHighMemory.mockReturnValue(true);
  memory.validateRoutineHeader.mockReturnValue(true);
  memory.checkPackedAddressAlignment.mockReturnValue(true);
  memory.getZString.mockReturnValue([]);
  memory.setWord.mockImplementation(() => {});
  memory.setByte.mockImplementation(() => {});
  memory.copyBlock.mockImplementation(() => {});
  memory.unpackRoutineAddress.mockImplementation((addr: number) => addr * 2);
  memory.getAlphabetTables.mockReturnValue([
    'abcdefghijklmnopqrstuvwxyz',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    ' 0123456789.,!?_#\'"/\\<-:()',
  ]);

  // Fixed buffer property - direct value, no getter function
  const testBuffer = Buffer.alloc(65536);
  Object.defineProperty(memory, 'buffer', {
    value: testBuffer,
    writable: false,
    configurable: true,
  });

  return memory;
}

// Helper to create mock memory for routine tests (v3 with locals)
function createRoutineTestMemory(): MockMemory {
  const memory = createMockMemoryWithHeader(3);

  // Override with test-specific behavior for routine tests
  memory.getByte.mockImplementation((addr: number) => {
    if (addr === HeaderLocation.Version) return 3;
    if (addr === 0x1000) return 3; // Number of locals
    return 0;
  });

  memory.getWord.mockImplementation((addr: number) => {
    // Local initial values for v3
    if (addr === 0x1001) return 100;
    if (addr === 0x1003) return 200;
    if (addr === 0x1005) return 300;

    // Handle header lookups
    switch (addr) {
      case HeaderLocation.HighMemBase:
        return 0x1000;
      case HeaderLocation.GlobalVariables:
        return 0x0c00;
      case HeaderLocation.AbbreviationsTable:
        return 0x0e00;
      case HeaderLocation.ObjectTable:
        return 0x0800;
      case HeaderLocation.Dictionary:
        return 0x0a00;
      default:
        if (addr >= 0x0c00 && addr < 0x0c00 + 240) {
          return 42; // Global variables
        }
        return 0;
    }
  });

  return memory;
}

// Helper to create mock memory for V5+ routine tests
function createV5RoutineTestMemory(): MockMemory {
  const memory = createMockMemoryWithHeader(5);

  memory.getByte.mockImplementation((addr: number) => {
    if (addr === HeaderLocation.Version) return 5;
    if (addr === 0x1000) return 3; // Number of locals
    return 0;
  });

  // V5 uses the base getWord implementation (no local init values)

  return memory;
}

// Helper to create mock memory for memory operation tests - WITH Z-STRING FIX
function createMemoryTestMemory(): MockMemory {
  const memory = createMockMemoryWithHeader(3);

  memory.getByte.mockImplementation((addr: number) => {
    if (addr === HeaderLocation.Version) return 3;
    if (addr === 100) return 0x42;
    return 0;
  });

  memory.getWord.mockImplementation((addr: number) => {
    if (addr === 100) return 0x1234;
    if (addr === 102) return 0x5678;
    if (addr === 104) return 0x9abc | 0x8000; // Last word with high bit set to terminate Z-string

    // Handle header lookups
    switch (addr) {
      case HeaderLocation.HighMemBase:
        return 0x1000;
      case HeaderLocation.GlobalVariables:
        return 0x0c00;
      case HeaderLocation.AbbreviationsTable:
        return 0x0e00;
      case HeaderLocation.ObjectTable:
        return 0x0800;
      case HeaderLocation.Dictionary:
        return 0x0a00;
      default:
        return 0;
    }
  });

  memory.getZString.mockImplementation((addr: number) => {
    if (addr === 100) return [1, 2, 3, 4, 5, 6, 7, 8, 9]; // 3 words, 9 Z-chars
    return [];
  });

  return memory;
}

// Helper to create mock memory for branch tests
function createBranchTestMemory(): MockMemory {
  const memory = createMockMemoryWithHeader(3);

  // Default branch test behavior
  memory.getByte.mockImplementation((addr: number) => {
    if (addr === HeaderLocation.Version) return 3;
    if (addr === 100) return 0x42; // Default branch byte
    if (addr === 101) return 0xff; // Second byte for 2-byte branch
    return 0;
  });

  return memory;
}

describe('GameState', () => {
  let mockMemory: MockMemory;
  let gameState: GameState;
  let mockLogger: Logger;

  beforeEach(() => {
    // Silence the logger during tests
    mockLogger = new Logger('TestLogger');
    mockLogger.debug = vi.fn();
    mockLogger.info = vi.fn();
    mockLogger.warn = vi.fn();
    mockLogger.error = vi.fn();

    // Create a mock memory with version 3
    mockMemory = createMockMemoryWithHeader(3);

    // Create a game state instance
    gameState = new GameState(mockMemory as unknown as Memory, { logger: mockLogger });
  });

  afterEach(() => {
    // Clear call history but preserve implementations
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should read header values correctly', () => {
      expect(gameState.highMem).toBe(0x1000);
      expect(gameState.globalVariablesAddress).toBe(0x0c00);
      expect(gameState.abbreviationsTableAddress).toBe(0x0e00);
      expect(gameState.objectTableAddress).toBe(0x0800);
      expect(gameState.dictionaryAddress).toBe(0x0a00);
    });

    it('should initialize with the correct version', () => {
      expect(gameState.version).toBe(3);
    });

    it('should read routines and strings offsets for v6-7', () => {
      // Create a v6 memory
      const v6Memory = createMockMemoryWithHeader(6);
      const v6GameState = new GameState(v6Memory as unknown as Memory, { logger: mockLogger });

      expect(v6GameState.routinesOffset).toBe(0x2000);
      expect(v6GameState.stringsOffset).toBe(0x3000);
    });
  });

  describe('Stack Operations', () => {
    it('should push and pop values correctly', () => {
      // Push some values
      gameState.pushStack(10);
      gameState.pushStack(20);
      gameState.pushStack(30);

      // Check they come back in reverse order
      expect(gameState.popStack()).toBe(30);
      expect(gameState.popStack()).toBe(20);
      expect(gameState.popStack()).toBe(10);
    });

    it('should handle empty stack when popping', () => {
      // Empty stack should return 0 with a warning
      expect(gameState.popStack()).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should throw an error when peeking an empty stack', () => {
      expect(() => gameState.peekStack()).toThrow();
    });

    it('should peek the top value without removing it', () => {
      gameState.pushStack(42);
      expect(gameState.peekStack()).toBe(42);
      expect(gameState.peekStack()).toBe(42); // Still there
      expect(gameState.popStack()).toBe(42); // Now removed
    });

    it('should throw an error when pushing undefined or null', () => {
      expect(() => gameState.pushStack(undefined as unknown as number)).toThrow();
      expect(() => gameState.pushStack(null as unknown as number)).toThrow();
    });
  });

  describe('Variable Operations', () => {
    beforeEach(() => {
      // Push some stack values
      gameState.pushStack(100);
      gameState.pushStack(200);

      // Add a call frame with locals
      const frame = createStackFrame(0, 0, 3, true, 0, 2, 0x1000);
      frame.locals[0] = 10; // Local 1
      frame.locals[1] = 20; // Local 2
      frame.locals[2] = 30; // Local 3
      gameState.callstack.push(frame);
    });

    it('should load from stack (var 0)', () => {
      expect(gameState.loadVariable(0)).toBe(200);
      expect(gameState.loadVariable(0)).toBe(100);
    });

    it('should peek from stack without popping', () => {
      expect(gameState.loadVariable(0, true)).toBe(200);
      expect(gameState.loadVariable(0, true)).toBe(200); // Still there
    });

    it('should load from locals (var 1-15)', () => {
      expect(gameState.loadVariable(1)).toBe(10);
      expect(gameState.loadVariable(2)).toBe(20);
      expect(gameState.loadVariable(3)).toBe(30);
    });

    it('should throw when accessing locals outside range', () => {
      expect(() => gameState.loadVariable(4)).toThrow();
    });

    it('should load from globals (var 16+)', () => {
      expect(gameState.loadVariable(16)).toBe(42);
      expect(gameState.loadVariable(17)).toBe(42);
    });

    it('should store to stack (var 0)', () => {
      gameState.storeVariable(0, 300);
      expect(gameState.popStack()).toBe(300);
    });

    it('should replace top of stack when requested', () => {
      gameState.storeVariable(0, 300, true);
      expect(gameState.popStack()).toBe(300);
      expect(gameState.popStack()).toBe(100); // 200 was replaced
    });

    it('should store to locals (var 1-15)', () => {
      gameState.storeVariable(2, 25);
      expect(gameState.loadVariable(2)).toBe(25);
    });

    it('should store to globals (var 16+)', () => {
      gameState.storeVariable(16, 55);
      expect(mockMemory.setWord).toHaveBeenCalledWith(0x0c00, 55);
    });

    it('should throw when no call frame exists for local access', () => {
      // Create a new game state with no call frames
      const emptyGameState = new GameState(mockMemory as unknown as Memory, { logger: mockLogger });

      expect(() => emptyGameState.loadVariable(1)).toThrow();
      expect(() => emptyGameState.storeVariable(1, 10)).toThrow();
    });
  });

  describe('Routine Handling', () => {
    it('should handle call with 0 address as special case', () => {
      gameState.callRoutine(0, 16);
      expect(mockMemory.setWord).toHaveBeenCalledWith(0x0c00, 0);
    });

    it('should create a call frame with locals for v3', () => {
      // Use specialized mock memory for routine tests
      const routineMemory = createRoutineTestMemory();
      const routineGameState = new GameState(routineMemory as unknown as Memory, { logger: mockLogger });

      // Set PC and call the routine
      routineGameState.pc = 0x500;
      routineGameState.callRoutine(0x1000, 16, 42, 43);

      // Should have created a call frame
      expect(routineGameState.callstack.length).toBe(1);

      const frame = routineGameState.callstack[0];
      expect(frame.returnPC).toBe(0x500);
      expect(frame.routineAddress).toBe(0x1000);
      expect(frame.resultVariable).toBe(16);
      expect(frame.argumentCount).toBe(2);

      // Locals should be initialized from memory, but overridden by args
      expect(frame.locals[0]).toBe(42); // Arg 1 overrides
      expect(frame.locals[1]).toBe(43); // Arg 2 overrides
      expect(frame.locals[2]).toBe(300); // No arg, uses memory init

      // PC should move past locals
      expect(routineGameState.pc).toBe(0x1007);
    });

    it('should create a call frame with locals for v5+', () => {
      // Use specialized mock memory for V5 routine tests
      const v5Memory = createV5RoutineTestMemory();
      const v5GameState = new GameState(v5Memory as unknown as Memory, { logger: mockLogger });

      v5GameState.pc = 0x500;

      // Call the routine
      v5GameState.callRoutine(0x1000, 16, 42, 43);

      // Should have created a call frame
      expect(v5GameState.callstack.length).toBe(1);

      const frame = v5GameState.callstack[0];

      // In v5+, locals without args are initialized to 0
      expect(frame.locals[0]).toBe(42); // Arg 1
      expect(frame.locals[1]).toBe(43); // Arg 2
      expect(frame.locals[2]).toBe(0); // No arg, defaults to 0

      // PC should move past just the local count byte
      expect(v5GameState.pc).toBe(0x1001);
    });

    it('should return from a routine and update PC', () => {
      // Use specialized mock memory for routine tests
      const routineMemory = createRoutineTestMemory();
      const routineGameState = new GameState(routineMemory as unknown as Memory, { logger: mockLogger });

      // Set up a call frame
      routineGameState.pc = 0x500;
      routineGameState.callRoutine(0x1000, 16, 42, 43);

      // Return from routine with value 123
      routineGameState.returnFromRoutine(123);

      // PC should be restored
      expect(routineGameState.pc).toBe(0x500);

      // Should have stored the result in the specified variable
      expect(routineMemory.setWord).toHaveBeenCalledWith(0x0c00, 123);
    });

    it('should throw when returning with empty callstack', () => {
      expect(() => gameState.returnFromRoutine(123)).toThrow();
    });
  });

  describe('Memory Reading Operations', () => {
    let memoryTestGameState: GameState;

    beforeEach(() => {
      // Use specialized mock memory for memory operation tests
      const memoryTestMemory = createMemoryTestMemory();
      memoryTestGameState = new GameState(memoryTestMemory as unknown as Memory, { logger: mockLogger });
    });

    it('should read a byte and advance PC', () => {
      memoryTestGameState.pc = 100;
      const value = memoryTestGameState.readByte();

      expect(value).toBe(0x42);
      expect(memoryTestGameState.pc).toBe(101);
    });

    it('should read a word and advance PC by 2', () => {
      memoryTestGameState.pc = 100;
      const value = memoryTestGameState.readWord();

      expect(value).toBe(0x1234);
      expect(memoryTestGameState.pc).toBe(102);
    });

    it('should read a Z-string and advance PC correctly', () => {
      memoryTestGameState.pc = 100;
      const zstring = memoryTestGameState.readZString();

      expect(zstring).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      // 3 words = 6 bytes
      expect(memoryTestGameState.pc).toBe(106);
    });
  });

  describe('Branch Handling', () => {
    it('should read branch offset for 1-byte branch', () => {
      const branchMemory = createBranchTestMemory();
      const branchGameState = new GameState(branchMemory as unknown as Memory, { logger: mockLogger });

      branchGameState.pc = 100;
      const [offset, branchOnFalse] = branchGameState.readBranchOffset();

      // 0x42 = 0b01000010, so offset = 0b000010 = 2, and branchOnFalse = true
      expect(offset).toBe(2);
      expect(branchOnFalse).toBe(true);
      expect(branchGameState.pc).toBe(101);
    });

    it('should read branch offset for 2-byte branch', () => {
      const branchMemory = createBranchTestMemory();
      // Override for 2-byte branch test
      branchMemory.getByte.mockImplementation((addr: number) => {
        if (addr === HeaderLocation.Version) return 3;
        if (addr === 100) return 0x20; // Bit 6 clear for 2-byte branch, bit 7 clear for "branch on true"
        if (addr === 101) return 0xff; // Second byte
        return 0;
      });

      const branchGameState = new GameState(branchMemory as unknown as Memory, { logger: mockLogger });

      branchGameState.pc = 100;
      const [offset, branchOnFalse] = branchGameState.readBranchOffset();

      expect(offset).toBe(0xe0ff); // Sign-extended 16-bit (negative)
      expect(branchOnFalse).toBe(true);
      expect(branchGameState.pc).toBe(102);
    });

    it('should handle branch on true condition', () => {
      // Set up a non-empty callstack for returnFromRoutine
      const frame = createStackFrame(0, 0, 1, true, 0, 0, 0x1000);
      gameState.callstack.push(frame);

      // Test return true with offset 1
      gameState.doBranch(true, false, 1);
      expect(mockLogger.debug).toHaveBeenCalledWith('Returning true from branch');

      // reset callstack
      gameState.callstack.push(frame);

      // Test return false with offset 0
      gameState.doBranch(true, false, 0);
      expect(mockLogger.debug).toHaveBeenCalledWith('Returning false from branch');

      // Test regular branch
      gameState.pc = 100;
      gameState.doBranch(true, false, 10);
      expect(gameState.pc).toBe(108); // 100 + 10 - 2
    });

    it('should handle branch on false condition', () => {
      // Set up a non-empty callstack for returnFromRoutine
      const frame = createStackFrame(0, 0, 1, true, 0, 0, 0x1000);
      gameState.callstack.push(frame);

      gameState.pc = 100;
      gameState.doBranch(false, true, 10);
      expect(gameState.pc).toBe(108); // 100 + 10 - 2
    });

    it('should handle negative branch offsets', () => {
      gameState.pc = 1000;

      // Test a large positive value that becomes negative when signed
      // 65450 (0xFFAA) becomes -86 when treated as signed 16-bit
      gameState.doBranch(true, false, 65450);
      expect(gameState.pc).toBe(912); // 1000 + (-86) - 2 = 912
    });

    it('should handle positive branch offsets correctly', () => {
      gameState.pc = 100;

      // Test a normal positive offset (less than 32767)
      gameState.doBranch(true, false, 50);
      expect(gameState.pc).toBe(148); // 100 + 50 - 2 = 148
    });

    it('should throw on out-of-bounds negative branch', () => {
      gameState.pc = 50;

      // Create a large negative offset that would go below 0
      // 65400 becomes -136 when signed, so 50 + (-136) - 2 = -88 (out of bounds)
      expect(() => gameState.doBranch(true, false, 65400)).toThrow('Branch out of bounds: -88');
    });

    it('should throw on out-of-bounds positive branch', () => {
      // Set PC close to memory end to make a positive branch go out of bounds
      const memorySize = gameState.memory.size;
      gameState.pc = memorySize - 10;

      // Use a positive offset that stays under 32767 but exceeds memory bounds
      // PC + offset - 2 should exceed memory size
      const offset = 100; // (memorySize - 10) + 100 - 2 = memorySize + 88 (out of bounds)
      expect(() => gameState.doBranch(true, false, offset)).toThrow();
    });

    it('should not branch when condition does not match', () => {
      gameState.pc = 100;

      // Should not branch when condition is false and branchOnFalse is false
      gameState.doBranch(false, false, 50);
      expect(gameState.pc).toBe(100); // PC unchanged

      // Should not branch when condition is true and branchOnFalse is true
      gameState.doBranch(true, true, 50);
      expect(gameState.pc).toBe(100); // PC unchanged
    });
  });

  describe('Object Handling', () => {
    it('should return an object by number', () => {
      const result = gameState.getObject(42);
      expect(result).toBeDefined();
    });

    it('should find root objects', () => {
      const result = gameState.getRootObjects();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('State Snapshot', () => {
    beforeEach(() => {
      // Set up a complex state to snapshot
      gameState.pc = 0x1234;
      gameState.pushStack(100);
      gameState.pushStack(200);

      // Add a call frame
      const frame = createStackFrame(0x5678, 0, 2, true, 16, 1, 0x1000);
      frame.locals[0] = 42;
      frame.locals[1] = 43;
      gameState.callstack.push(frame);

      // Write test data to buffer
      const buffer = mockMemory.buffer;
      buffer.writeUInt16BE(0xabcd, 0x100);
    });

    it('should create a snapshot of the current state', () => {
      const snapshot = gameState.createSnapshot();

      expect(snapshot.pc).toBe(0x1234);
      expect(snapshot.stack).toEqual([100, 200]);
      expect(snapshot.callFrames.length).toBe(1);

      const serializedFrame = snapshot.callFrames[0];
      expect(serializedFrame.returnPC).toBe(0x5678);
      expect(serializedFrame.storeVariable).toBe(16);
      expect(serializedFrame.locals.length).toBe(2);
      expect(serializedFrame.locals[0]).toBe(42);
      expect(serializedFrame.locals[1]).toBe(43);

      // Original buffer should be copied
      expect(snapshot.memory).toBeInstanceOf(Buffer);
      expect(snapshot.memory.readUInt16BE(0x100)).toBe(0xabcd);
    });

    it('should restore state from a snapshot', () => {
      // Create a snapshot
      const snapshot = gameState.createSnapshot();

      // Change the state
      gameState.pc = 0x9999;
      gameState.popStack();
      gameState.popStack();
      gameState.callstack.pop();

      // Restore from snapshot
      gameState.restoreFromSnapshot(snapshot);

      // Verify state is restored
      expect(gameState.pc).toBe(0x1234);
      expect(gameState.stack).toEqual([100, 200]);
      expect(gameState.callstack.length).toBe(1);
    });
  });

  describe('Text Parser', () => {
    it('should tokenize a line of text', () => {
      // Call tokenizeLine
      gameState.tokenizeLine(0x1000, 0x1100);

      // Verify no errors occur - the actual tokenization logic
      // is tested elsewhere
      expect(true).toBe(true);
    });
  });
});
