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
      const availableSlots = 3;
      const expectedValue = 100;
      // valueAddr = stackAddr + 2 + availableSlots * 2 = 0x1000 + 2 + 6 = 0x1008
      const expectedValueAddr = stackAddr + 2 + availableSlots * 2;

      memory.getWord.mockImplementation((addr: Address) => {
        if (addr === stackAddr) return availableSlots;
        if (addr === expectedValueAddr) return expectedValue;
        return 0;
      });

      const result = userStackManager.pullStack(stackAddr);

      expect(result).toBe(expectedValue);
      expect(memory.setWord).toHaveBeenCalledWith(stackAddr, availableSlots + 1);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Pulled 100'));
    });

    it('should return undefined when valueAddr is out of memory bounds', () => {
      const stackAddr = 0x1000;
      // A huge availableSlots value pushes valueAddr beyond memory.size (0x10000)
      const hugeAvailable = 0x8000;
      memory.getWord.mockReturnValueOnce(hugeAvailable);

      const result = userStackManager.pullStack(stackAddr);

      expect(result).toBeUndefined();
      expect(memory.setWord).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('underflowed'));
    });

    it('should return undefined when pulling from an invalid memory address', () => {
      // Setup: address is not in dynamic memory
      memory.isDynamicMemory.mockReturnValueOnce(false);

      const result = userStackManager.pullStack(0x5000);

      expect(result).toBeUndefined();
      expect(memory.setWord).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('not in dynamic memory'));
    });

    it('should propagate errors thrown by memory.getWord', () => {
      const stackAddr = 0x1000;
      const availableSlots = 3;

      memory.getWord.mockImplementation((addr: Address) => {
        if (addr === stackAddr) return availableSlots;
        throw new Error('Mock memory error');
      });

      expect(() => userStackManager.pullStack(stackAddr)).toThrow('Mock memory error');
    });
  });

  describe('popStack', () => {
    it('should remove multiple items from the stack', () => {
      const stackAddr = 0x1000;
      const availableSlots = 3;
      const itemsToPop = 2;

      memory.getWord.mockReturnValueOnce(availableSlots);

      userStackManager.popStack(stackAddr, itemsToPop);

      // Available slots should be incremented by itemsToPop
      expect(memory.setWord).toHaveBeenCalledWith(stackAddr, availableSlots + itemsToPop);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Popped 2 items'));
    });

    it('should pop exactly the requested number of items without capping', () => {
      const stackAddr = 0x1000;
      const availableSlots = 3;

      memory.getWord.mockReturnValueOnce(availableSlots);

      // Pop 10 items — the implementation trusts the caller, no capping
      userStackManager.popStack(stackAddr, 10);

      expect(memory.setWord).toHaveBeenCalledWith(stackAddr, availableSlots + 10);
    });

    it('should handle popping from an invalid memory address', () => {
      // Setup: address is not in dynamic memory
      memory.isDynamicMemory.mockReturnValueOnce(false);

      userStackManager.popStack(0x5000, 2);

      expect(memory.setWord).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('not in dynamic memory'));
    });

    it('should propagate errors thrown by memory.setWord', () => {
      const stackAddr = 0x1000;

      memory.getWord.mockReturnValueOnce(3);
      memory.setWord.mockImplementationOnce(() => {
        throw new Error('Mock write error');
      });

      expect(() => userStackManager.popStack(stackAddr, 2)).toThrow('Mock write error');
    });
  });
});
