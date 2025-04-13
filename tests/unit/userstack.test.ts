import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserStackManager } from '../../src/core/execution/UserStack';
import { Memory } from '../../src/core/memory/Memory';
import { Logger, LogLevel } from '../../src/utils/log';

describe('UserStackManager', () => {
  let memory: Memory;
  let logger: Logger;
  let userStackManager: UserStackManager;
  let memoryMock: any;

  beforeEach(() => {
    // Create a mock memory with enough size for our tests
    const buffer = Buffer.alloc(1024);
    memory = new Memory(buffer);
    memoryMock = {
      getWord: vi.fn(),
      setWord: vi.fn(),
      getByte: vi.fn(),
      setByte: vi.fn(),
      size: 1024
    };
    logger = new Logger(LogLevel.ERROR);
    
    // Create the UserStackManager with our mocked dependencies
    userStackManager = new UserStackManager(memory, logger);
  });

  describe('createUserStack', () => {
    it('should initialize a user stack with the specified capacity', () => {
      // Setup
      const address = 100;
      const capacity = 10;
      const spy = vi.spyOn(memory, 'setWord');
      
      // Act
      const result = userStackManager.createUserStack(address, capacity);
      
      // Assert
      expect(spy).toHaveBeenCalledWith(address, capacity);
      expect(result).toEqual({
        address,
        initialCapacity: capacity
      });
    });
  });

  describe('pushStack', () => {
    it('should push a value onto the stack and update available slots', () => {
      // Setup
      const address = 100;
      const availableSlots = 5;
      const value = 42;
      
      // Mock the memory methods
      vi.spyOn(memory, 'getWord').mockReturnValue(availableSlots);
      const setWordSpy = vi.spyOn(memory, 'setWord');
      
      // Act
      const result = userStackManager.pushStack(address, value);
      
      // Assert
      expect(result).toBe(true);
      // Check that we read the available slots
      expect(memory.getWord).toHaveBeenCalledWith(address);
      // Check that we stored the value at the correct position
      expect(setWordSpy).toHaveBeenCalledWith(address + 2 + (availableSlots - 1) * 2, value);
      // Check that we updated the available slots
      expect(setWordSpy).toHaveBeenCalledWith(address, availableSlots - 1);
    });

    it('should return false when stack is full', () => {
      // Setup
      const address = 100;
      const availableSlots = 0; // Stack is full
      const value = 42;
      
      // Mock the memory methods
      vi.spyOn(memory, 'getWord').mockReturnValue(availableSlots);
      const setWordSpy = vi.spyOn(memory, 'setWord');
      
      // Act
      const result = userStackManager.pushStack(address, value);
      
      // Assert
      expect(result).toBe(false);
      // Check that we read the available slots
      expect(memory.getWord).toHaveBeenCalledWith(address);
      // Check that we didn't try to store any values
      expect(setWordSpy).not.toHaveBeenCalled();
    });
  });

  describe('pullStack', () => {
    it('should pull a value from the stack and update available slots', () => {
      // Setup
      const address = 100;
      const availableSlots = 3;
      const initialCapacity = 5;
      const usedSlots = initialCapacity - availableSlots;
      const stackValue = 42;
      
      // Mock getInitialCapacity method
      vi.spyOn(userStackManager as any, 'getInitialCapacity').mockReturnValue(initialCapacity);
      
      // Mock the memory methods
      vi.spyOn(memory, 'getWord')
        .mockReturnValueOnce(availableSlots) // First call for availableSlots
        .mockReturnValueOnce(stackValue);    // Second call for the value
      
      const setWordSpy = vi.spyOn(memory, 'setWord');
      
      // Act
      const result = userStackManager.pullStack(address);
      
      // Assert
      expect(result).toBe(stackValue);
      // Check that we read the available slots
      expect(memory.getWord).toHaveBeenCalledWith(address);
      // Check that we read the value at the correct position
      expect(memory.getWord).toHaveBeenCalledWith(address + 2 + (availableSlots) * 2);
      // Check that we updated the available slots
      expect(setWordSpy).toHaveBeenCalledWith(address, availableSlots + 1);
    });

    it('should return undefined when stack is empty', () => {
      // Setup
      const address = 100;
      const availableSlots = 5;
      const initialCapacity = 5;
      const usedSlots = initialCapacity - availableSlots; // 0, stack is empty
      
      // Mock getInitialCapacity method
      vi.spyOn(userStackManager as any, 'getInitialCapacity').mockReturnValue(initialCapacity);
      
      // Mock the memory methods
      vi.spyOn(memory, 'getWord').mockReturnValue(availableSlots);
      const setWordSpy = vi.spyOn(memory, 'setWord');
      
      // Act
      const result = userStackManager.pullStack(address);
      
      // Assert
      expect(result).toBeUndefined();
      // Check that we read the available slots
      expect(memory.getWord).toHaveBeenCalledWith(address);
      // Check that we didn't try to read any values
      expect(memory.getWord).toHaveBeenCalledTimes(1);
      // Check that we didn't update the available slots
      expect(setWordSpy).not.toHaveBeenCalled();
    });
  });

  describe('popStack', () => {
    it('should pop items from the stack and update available slots', () => {
      // Setup
      const address = 100;
      const availableSlots = 2;
      const initialCapacity = 5;
      const items = 2;
      
      // Mock getInitialCapacity method
      vi.spyOn(userStackManager as any, 'getInitialCapacity').mockReturnValue(initialCapacity);
      
      // Mock the memory methods
      vi.spyOn(memory, 'getWord').mockReturnValue(availableSlots);
      const setWordSpy = vi.spyOn(memory, 'setWord');
      
      // Act
      userStackManager.popStack(address, items);
      
      // Assert
      // Check that we read the available slots
      expect(memory.getWord).toHaveBeenCalledWith(address);
      // Check that we updated the available slots
      expect(setWordSpy).toHaveBeenCalledWith(address, availableSlots + items);
    });

    it('should not pop more items than are in the stack', () => {
      // Setup
      const address = 100;
      const availableSlots = 3;
      const initialCapacity = 5;
      const usedSlots = initialCapacity - availableSlots; // 2 items in stack
      const items = 3; // Try to pop 3 items
      
      // Mock getInitialCapacity method
      vi.spyOn(userStackManager as any, 'getInitialCapacity').mockReturnValue(initialCapacity);
      
      // Mock the memory methods
      vi.spyOn(memory, 'getWord').mockReturnValue(availableSlots);
      const setWordSpy = vi.spyOn(memory, 'setWord');
      
      // Act
      userStackManager.popStack(address, items);
      
      // Assert
      // Check that we read the available slots
      expect(memory.getWord).toHaveBeenCalledWith(address);
      // Check that we updated the available slots but only for the used slots
      expect(setWordSpy).toHaveBeenCalledWith(address, availableSlots + usedSlots);
    });
  });

  describe('getInitialCapacity', () => {
    it('should estimate capacity based on available slots and non-zero values', () => {
      // Setup
      const address = 100;
      const availableSlots = 8;
      
      // Mock memory to return 0 for all positions except one
      vi.spyOn(memory, 'getWord')
        .mockImplementation((addr) => {
          if (addr === address) {
            return availableSlots;
          } else if (addr === address + 2 + 5 * 2) {
            // Put a non-zero value at position 5
            return 42;
          } else {
            return 0;
          }
        });
      
      // Act
      const result = (userStackManager as any).getInitialCapacity(address);
      
      // Assert
      // Initial capacity should be the max of availableSlots and highest non-zero position
      expect(result).toBe(8); // max(8, 5) = 8
    });

    it('should handle case where non-zero values are higher than available slots', () => {
      // Setup
      const address = 100;
      const availableSlots = 3;
      
      // Mock memory to return 0 for all positions except one
      vi.spyOn(memory, 'getWord')
        .mockImplementation((addr) => {
          if (addr === address) {
            return availableSlots;
          } else if (addr === address + 2 + 10 * 2) {
            // Put a non-zero value at position 10
            return 42;
          } else {
            return 0;
          }
        });
      
      // Act
      const result = (userStackManager as any).getInitialCapacity(address);
      
      // Assert
      // Initial capacity should be the max of availableSlots and highest non-zero position
      expect(result).toBe(10); // max(3, 10) = 10
    });
  });
});
