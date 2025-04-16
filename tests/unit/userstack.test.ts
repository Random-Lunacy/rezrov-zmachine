import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserStackManager } from '../../src/core/execution/UserStack';
import { Memory } from '../../src/core/memory/Memory';
import { HeaderLocation } from '../../src/utils/constants';
import { Logger } from '../../src/utils/log';

describe('UserStackManager', () => {
  let buffer: Buffer;
  let memory: Memory;
  let logger: Logger;
  let userStackManager: UserStackManager;

  beforeEach(() => {
    // Create a mock story file buffer with a basic header
    buffer = Buffer.alloc(1024);

    // Set version to 6 (required for user stacks)
    buffer[HeaderLocation.Version] = 6;

    // Set static memory base to 0x0400 (1024)
    buffer[HeaderLocation.StaticMemBase] = 0x04;
    buffer[HeaderLocation.StaticMemBase + 1] = 0x00;

    // Set high memory base to 0x0200 (512)
    buffer[HeaderLocation.HighMemBase] = 0x02;
    buffer[HeaderLocation.HighMemBase + 1] = 0x00;

    memory = new Memory(buffer);
    logger = new Logger('user stack test');

    // Mock logger methods for testing
    logger.debug = vi.fn();
    logger.error = vi.fn();

    userStackManager = new UserStackManager(memory, { logger });
  });

  describe('createUserStack', () => {
    it('creates a user stack with specified capacity', () => {
      const address = 100;
      const capacity = 10;

      const stack = userStackManager.createUserStack(address, capacity);

      // Verify stack object
      expect(stack).toEqual({
        address,
        initialCapacity: capacity,
      });

      // Verify memory was set correctly
      expect(memory.getWord(address)).toBe(capacity);

      // Verify logger was called
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Created user stack at 0x${address.toString(16)}`)
      );
    });

    it('throws error when creating stack in read-only memory', () => {
      const address = 0x0400; // Static memory
      const capacity = 10;

      expect(() => userStackManager.createUserStack(address, capacity)).toThrow(
        /Cannot create user stack in read-only memory/
      );
    });
  });

  describe('pushStack', () => {
    it('pushes value onto stack', () => {
      // Create a stack
      const address = 100;
      const capacity = 5;
      userStackManager.createUserStack(address, capacity);

      // Push a value
      const result = userStackManager.pushStack(address, 42);

      // Verify result
      expect(result).toBe(true);

      // Verify available slots decreased
      expect(memory.getWord(address)).toBe(capacity - 1);

      // Verify value was stored at correct position
      // The first value should be at address + 2 + (capacity - 1)*2
      expect(memory.getWord(address + 2 + (capacity - 1) * 2)).toBe(42);

      // Verify logger was called
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(`Pushed 42 onto user stack`));
    });

    it('returns false when stack is full', () => {
      // Create a stack with 0 capacity
      const address = 100;
      memory.setWord(address, 0); // Available slots = 0

      // Try to push a value
      const result = userStackManager.pushStack(address, 42);

      // Verify result
      expect(result).toBe(false);

      // Verify logger was called
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(`stack is full`));
    });

    it('returns false when stack is not in dynamic memory', () => {
      const address = 0x0400; // Static memory

      // Try to push a value
      const result = userStackManager.pushStack(address, 42);

      // Verify result
      expect(result).toBe(false);

      // Verify logger was called
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`not in dynamic memory`));
    });

    it('pushes multiple values correctly', () => {
      // Create a stack
      const address = 100;
      const capacity = 5;
      userStackManager.createUserStack(address, capacity);

      // Push multiple values
      userStackManager.pushStack(address, 10);
      userStackManager.pushStack(address, 20);
      userStackManager.pushStack(address, 30);

      // Verify available slots
      expect(memory.getWord(address)).toBe(capacity - 3);

      // Verify values were stored in correct positions
      expect(memory.getWord(address + 2 + (capacity - 1) * 2)).toBe(10);
      expect(memory.getWord(address + 2 + (capacity - 2) * 2)).toBe(20);
      expect(memory.getWord(address + 2 + (capacity - 3) * 2)).toBe(30);
    });
  });

  describe('pullStack', () => {
    it('pulls value from stack', () => {
      // Create and prepare a stack
      const address = 100;
      const capacity = 5;
      userStackManager.createUserStack(address, capacity);

      // Push a value
      userStackManager.pushStack(address, 42);

      // Reset logger calls before pull
      vi.clearAllMocks();

      // Pull the value
      const result = userStackManager.pullStack(address);

      // Verify result
      expect(result).toBe(42);

      // Verify available slots increased
      expect(memory.getWord(address)).toBe(capacity);

      // Verify logger was called
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(`Pulled 42 from user stack`));
    });

    it('returns undefined when stack is empty', () => {
      // Create a stack
      const address = 100;
      const capacity = 5;
      userStackManager.createUserStack(address, capacity);

      // Don't push anything, so stack is empty

      // Pull from empty stack
      const result = userStackManager.pullStack(address);

      // Verify result
      expect(result).toBeUndefined();

      // Verify logger was called
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(`stack is empty`));
    });

    it('returns undefined when stack is not in dynamic memory', () => {
      const address = 0x0400; // Static memory

      // Try to pull a value
      const result = userStackManager.pullStack(address);

      // Verify result
      expect(result).toBeUndefined();

      // Verify logger was called
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`not in dynamic memory`));
    });

    it('pulls multiple values in LIFO order', () => {
      // Create a stack
      const address = 100;
      const capacity = 5;
      userStackManager.createUserStack(address, capacity);

      // Push multiple values
      userStackManager.pushStack(address, 10);
      userStackManager.pushStack(address, 20);
      userStackManager.pushStack(address, 30);

      // Pull values (should be LIFO order)
      expect(userStackManager.pullStack(address)).toBe(30);
      expect(userStackManager.pullStack(address)).toBe(20);
      expect(userStackManager.pullStack(address)).toBe(10);

      // Stack should now be empty
      expect(userStackManager.pullStack(address)).toBeUndefined();

      // Available slots should be back to initial capacity
      expect(memory.getWord(address)).toBe(capacity);
    });
  });

  describe('popStack', () => {
    it('pops multiple items at once', () => {
      // Create and prepare a stack
      const address = 100;
      const capacity = 5;
      userStackManager.createUserStack(address, capacity);

      // Push multiple values
      userStackManager.pushStack(address, 10);
      userStackManager.pushStack(address, 20);
      userStackManager.pushStack(address, 30);

      // Available slots should be capacity - 3
      expect(memory.getWord(address)).toBe(capacity - 3);

      // Reset logger calls before pop
      vi.clearAllMocks();

      // Pop 2 items
      userStackManager.popStack(address, 2);

      // Verify available slots increased by 2
      expect(memory.getWord(address)).toBe(capacity - 1);

      // Verify logger was called
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(`Popped 2 items from user stack`));

      // Pull the remaining item
      expect(userStackManager.pullStack(address)).toBe(10);
    });

    it('does nothing when stack is not in dynamic memory', () => {
      const address = 0x0400; // Static memory

      // Try to pop items
      userStackManager.popStack(address, 2);

      // Verify logger was called
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`not in dynamic memory`));
    });

    it('handles popping more items than available', () => {
      // Create a stack
      const address = 100;
      const capacity = 5;
      userStackManager.createUserStack(address, capacity);

      // Push 2 values
      userStackManager.pushStack(address, 10);
      userStackManager.pushStack(address, 20);

      // Available slots should be capacity - 2
      expect(memory.getWord(address)).toBe(capacity - 2);

      // Try to pop 3 items (more than pushed)
      userStackManager.popStack(address, 3);

      // Verify available slots increased only by 2 (the actual number of items)
      expect(memory.getWord(address)).toBe(capacity);
    });
  });

  describe('getInitialCapacity', () => {
    it('estimates capacity based on non-zero values', () => {
      // This is testing a private method, so we need to create a scenario
      // that will trigger it indirectly

      // Create a stack without using createUserStack
      const address = 100;

      // Set available slots
      memory.setWord(address, 3); // 3 available, 2 used

      // Set values in stack positions
      memory.setWord(address + 2 + 0 * 2, 10); // First item
      memory.setWord(address + 2 + 1 * 2, 20); // Second item

      // Set a value beyond what should be the stack
      memory.setWord(address + 2 + 7 * 2, 42); // This would suggest capacity of at least 8

      // Now when we call pullStack, it should try to estimate capacity
      const result = userStackManager.pullStack(address);

      // It should pull the top value (20)
      expect(result).toBe(20);

      // And it should have updated available slots to 4
      // (This assumes initial capacity of 8 based on the non-zero value at index 7)
      expect(memory.getWord(address)).toBe(4);
    });
  });
});
