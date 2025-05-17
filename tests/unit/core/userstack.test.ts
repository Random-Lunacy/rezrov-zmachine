import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserStackManager } from '../../../src/core/execution/UserStack';
import { Address } from '../../../src/types';
import { Logger } from '../../../src/utils/log';

// Create a specialized Memory mock compatible with UserStackManager
class UserStackTestMemory {
  public size: number = 0x10000;
  getByte = vi.fn();
  setByte = vi.fn();
  getWord = vi.fn();
  setWord = vi.fn();
  isDynamicMemory = vi.fn();

  // This property is looked up via 'in' operator check
  public buffer = Buffer.alloc(0);
}

describe('UserStackManager', () => {
  let memory: UserStackTestMemory;
  let userStackManager: UserStackManager;
  let mockLogger: Logger;

  beforeEach(() => {
    memory = new UserStackTestMemory();
    mockLogger = new Logger('TestLogger');

    // Spy on logger methods
    mockLogger.warn = vi.fn();
    mockLogger.error = vi.fn();
    mockLogger.debug = vi.fn();

    // Set up the mock memory behavior
    memory.size = 0x10000;
    memory.isDynamicMemory.mockImplementation((addr: Address) => addr >= 0 && addr < 0x4000);

    // Type assertion to make TypeScript happy
    userStackManager = new UserStackManager(memory as any, { logger: mockLogger });
  });

  describe('createUserStack', () => {
    it('should create a user stack with the specified capacity', () => {
      const address = 0x2000;
      const capacity = 10;

      const stack = userStackManager.createUserStack(address, capacity);

      expect(memory.setWord).toHaveBeenCalledWith(address, capacity);
      expect(stack.address).toBe(address);
      expect(stack.initialCapacity).toBe(capacity);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Created user stack'));
    });

    it('should throw an error if attempting to create a stack in read-only memory', () => {
      // Set up address to be in static memory
      memory.isDynamicMemory.mockReturnValueOnce(false);

      expect(() => {
        userStackManager.createUserStack(0x5000, 10);
      }).toThrow(/Cannot create user stack in read-only memory/);
    });
  });

  describe('pushStack', () => {
    it('should push a value onto the stack and update available slots', () => {
      const stackAddr = 0x1000;
      const value = 42;

      // Setup: 5 available slots
      memory.getWord.mockReturnValueOnce(5);

      const result = userStackManager.pushStack(stackAddr, value);

      expect(result).toBe(true);
      // Available slots should be decremented
      expect(memory.setWord).toHaveBeenCalledWith(stackAddr, 4);
      // Value should be pushed to the correct position
      expect(memory.setWord).toHaveBeenCalledWith(stackAddr + 2 + 4 * 2, value);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Pushed 42'));
    });

    it('should return false when pushing to a full stack', () => {
      const stackAddr = 0x1000;

      // Setup: 0 available slots (full stack)
      memory.getWord.mockReturnValueOnce(0);

      const result = userStackManager.pushStack(stackAddr, 99);

      expect(result).toBe(false);
      expect(memory.setWord).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('User stack at'));
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('is full'));
    });

    it('should return false when pushing to an invalid memory address', () => {
      // Setup: address is not in dynamic memory
      memory.isDynamicMemory.mockReturnValueOnce(false);

      const result = userStackManager.pushStack(0x5000, 42);

      expect(result).toBe(false);
      expect(memory.setWord).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('not in dynamic memory'));
    });

    it('should handle errors during push operation', () => {
      const stackAddr = 0x1000;

      // Setup: 5 available slots
      memory.getWord.mockReturnValueOnce(5);
      // Setup: setWord throws an error
      memory.setWord.mockImplementationOnce(() => {
        throw new Error('Mock error');
      });

      const result = userStackManager.pushStack(stackAddr, 42);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error pushing to user stack'));
    });
  });

  describe('pullStack', () => {
    it('should retrieve a value from the stack and update available slots', () => {
      const stackAddr = 0x1000;
      const expectedValue = 100;

      // Mock each getWord call with a specific implementation
      memory.getWord.mockImplementation((addr: Address) => {
        // First getWord is for available slots
        if (addr === stackAddr) return 3;

        // Second getWord is for getInitialCapacity - return max non-zero value
        if (addr === stackAddr + 2 + 1 * 2) return 100; // Value at first slot
        if (addr === stackAddr + 2 + 2 * 2) return 0; // Value at second slot (end of used values)

        // Value to pull - important for the test
        if (addr === stackAddr + 2 + 3 * 2) return expectedValue;

        // Default case
        return 0;
      });

      // Important: We need to explicitly mock the case where getInitialCapacity is called
      // to check stack capacity. Set up the stack to have a capacity of 5.
      vi.spyOn(userStackManager as any, 'getInitialCapacity').mockReturnValue(5);

      const result = userStackManager.pullStack(stackAddr);

      expect(result).toBe(expectedValue);
      // Available slots should be incremented
      expect(memory.setWord).toHaveBeenCalledWith(stackAddr, 4);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Pulled 100'));
    });

    it('should return undefined when pulling from an empty stack', () => {
      const stackAddr = 0x1000;

      // Mock getWord to return 5 available slots
      memory.getWord.mockReturnValueOnce(5);

      // Important: Mock getInitialCapacity to return 5 (full capacity = empty stack)
      vi.spyOn(userStackManager as any, 'getInitialCapacity').mockReturnValue(5);

      const result = userStackManager.pullStack(stackAddr);

      expect(result).toBeUndefined();
      expect(memory.setWord).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('User stack at'));
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('is empty'));
    });

    it('should return undefined when pulling from an invalid memory address', () => {
      // Setup: address is not in dynamic memory
      memory.isDynamicMemory.mockReturnValueOnce(false);

      const result = userStackManager.pullStack(0x5000);

      expect(result).toBeUndefined();
      expect(memory.setWord).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('not in dynamic memory'));
    });

    it('should handle errors during pull operation', () => {
      const stackAddr = 0x1000;

      // Setup to pass initial checks
      memory.isDynamicMemory.mockReturnValue(true);

      // Mock calls to getWord
      let getWordCallCount = 0;
      memory.getWord.mockImplementation((addr: Address) => {
        getWordCallCount++;

        if (getWordCallCount === 1) {
          // First call - return available slots (3)
          return 3;
        }

        // For any subsequent calls, throw an error
        throw new Error('Mock error');
      });

      // We expect this to throw an error
      let errorThrown = false;
      try {
        userStackManager.pullStack(stackAddr);
      } catch (error: any) {
        errorThrown = true;
        expect(error.message).toContain('Error reading memory');
      }

      // Assert that an error was actually thrown
      expect(errorThrown).toBe(true);
    });
  });

  describe('popStack', () => {
    it('should remove multiple items from the stack', () => {
      const stackAddr = 0x1000;
      const itemsToPop = 2;

      // Available slots
      memory.getWord.mockReturnValueOnce(3);

      // Mock getInitialCapacity to return 5
      vi.spyOn(userStackManager as any, 'getInitialCapacity').mockReturnValue(5);

      userStackManager.popStack(stackAddr, itemsToPop);

      // Available slots should be incremented by 2 (to 5)
      expect(memory.setWord).toHaveBeenCalledWith(stackAddr, 5);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Popped 2 items'));
    });

    it('should handle popping more items than available', () => {
      const stackAddr = 0x1000;

      // Available slots
      memory.getWord.mockReturnValueOnce(3);

      // Mock getInitialCapacity to return 5 (so 2 items are used)
      vi.spyOn(userStackManager as any, 'getInitialCapacity').mockReturnValue(5);

      // Try to pop 3 items when only 2 are available
      userStackManager.popStack(stackAddr, 3);

      // Should only pop 2 items (all available)
      expect(memory.setWord).toHaveBeenCalledWith(stackAddr, 5);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Popped 2 items'));
    });

    it('should handle popping from an invalid memory address', () => {
      // Setup: address is not in dynamic memory
      memory.isDynamicMemory.mockReturnValueOnce(false);

      userStackManager.popStack(0x5000, 2);

      expect(memory.setWord).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('not in dynamic memory'));
    });

    it('should handle errors during pop operation', () => {
      const stackAddr = 0x1000;

      // Available slots
      memory.getWord.mockReturnValueOnce(3);

      // Mock getInitialCapacity to return 5
      vi.spyOn(userStackManager as any, 'getInitialCapacity').mockReturnValue(5);

      // Setup: setWord throws an error
      memory.setWord.mockImplementationOnce(() => {
        throw new Error('Mock error');
      });

      userStackManager.popStack(stackAddr, 2);

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error popping from user stack'));
    });
  });

  describe('getInitialCapacity', () => {
    it('should correctly calculate capacity based on non-zero slots', () => {
      const stackAddr = 0x1000;

      // Setup for available slots
      memory.getWord.mockReturnValueOnce(3);

      // Setup memory contents to have non-zero values in positions 1 and 2
      memory.getWord.mockImplementation((addr: Address) => {
        if (addr === stackAddr + 2 + 1 * 2) return 101; // Non-zero value
        if (addr === stackAddr + 2 + 2 * 2) return 102; // Non-zero value
        if (addr === stackAddr + 2 + 3 * 2) return 0; // Zero value
        return 0;
      });

      // Call the private method directly using type casting
      const capacity = (userStackManager as any).getInitialCapacity(stackAddr);

      // Should find 2 non-zero values, which is less than available slots (3)
      expect(capacity).toBe(3);
    });

    it('should throw an error when memory access fails', () => {
      const stackAddr = 0x1000;

      // Setup memory error during capacity checking
      memory.getWord.mockImplementationOnce(() => {
        throw new Error('Memory read error');
      });

      // We expect this to throw an error
      let errorThrown = false;
      try {
        (userStackManager as any).getInitialCapacity(stackAddr);
      } catch (error) {
        errorThrown = true;
        expect(error.message).toContain('Memory read error');
        expect(error.message).toContain('Memory read error');
      }

      // Assert that an error was actually thrown
      expect(errorThrown).toBe(true);
    });
  });
});
