import { Address } from '../../types';
import { Logger } from '../../utils/log';
import { Memory } from '../memory/Memory';

/**
 * Represents a user stack in Z-Machine memory (Version 6+ only)
 *
 * User stacks are stored in the Z-machine's dynamic memory and consist of:
 * - A word at the first address indicating the number of available slots (capacity)
 * - The actual stack slots following that word
 */
export interface UserStack {
  /**
   * Memory address where the stack begins
   */
  address: Address;

  /**
   * Initial capacity of the stack
   */
  initialCapacity: number;
}

/**
 * Manages user-defined stacks in Z-machine memory
 * Used in Version 6+ for the pop_stack and push_stack operations
 *
 * Unlike the main stack, user stacks are stored in the Z-machine's dynamic memory.
 * The first word in the stack table holds the number of available slots.
 * No underflow checking is performed by the Z-machine itself.
 */
export class UserStackManager {
  /**
   * Creates a new user stack manager
   * @param memory The memory instance
   * @param logger The logger to use
   */
  constructor(
    private memory: Memory,
    private logger: Logger
  ) {}

  /**
   * Pushes a value onto a user stack
   * @param stackAddr Address of the user stack
   * @param value Value to push
   * @returns true if successful, false if stack is full
   */
  pushStack(stackAddr: Address, value: number): boolean {
    // Verify the stack is in dynamic memory to prevent errors
    if (!this.memory.isDynamicMemory(stackAddr)) {
      this.logger.error(`User stack at 0x${stackAddr.toString(16)} is not in dynamic memory`);
      return false;
    }

    // First word is available slots counter
    const availableSlots = this.memory.getWord(stackAddr);

    if (availableSlots <= 0) {
      this.logger.debug(`User stack at 0x${stackAddr.toString(16)} is full`);
      return false;
    }

    // Calculate position for the new value - values are stored from high to low
    // The next value position is (availableSlots - 1) slots from the end
    const valueIndex = availableSlots;
    const valueAddr = stackAddr + 2 + (valueIndex - 1) * 2;

    try {
      // Store the value
      this.memory.setWord(valueAddr, value);

      // Decrease available slots
      this.memory.setWord(stackAddr, availableSlots - 1);

      this.logger.debug(
        `Pushed ${value} onto user stack at 0x${stackAddr.toString(16)}, new count: ${availableSlots - 1}`
      );
      return true;
    } catch (e) {
      this.logger.error(`Error pushing to user stack: ${e}`);
      return false;
    }
  }

  /**
   * Pulls a value from a user stack (pop and return)
   * @param stackAddr Address of the user stack
   * @returns The popped value, or undefined if stack is empty
   */
  pullStack(stackAddr: Address): number | undefined {
    // Verify the stack is in dynamic memory to prevent errors
    if (!this.memory.isDynamicMemory(stackAddr)) {
      this.logger.error(`User stack at 0x${stackAddr.toString(16)} is not in dynamic memory`);
      return undefined;
    }

    const initialCapacity = this.getInitialCapacity(stackAddr);
    const availableSlots = this.memory.getWord(stackAddr);
    const usedSlots = initialCapacity - availableSlots;

    if (usedSlots <= 0) {
      this.logger.debug(`User stack at 0x${stackAddr.toString(16)} is empty`);
      return undefined;
    }

    // Calculate position of the value to pull
    // We pull from the top of the stack (first used position)
    const valueIndex = availableSlots + 1;
    const valueAddr = stackAddr + 2 + (valueIndex - 1) * 2;

    try {
      // Get the value
      const value = this.memory.getWord(valueAddr);

      // Increase available slots
      this.memory.setWord(stackAddr, availableSlots + 1);

      this.logger.debug(
        `Pulled ${value} from user stack at 0x${stackAddr.toString(16)}, new count: ${availableSlots + 1}`
      );
      return value;
    } catch (e) {
      this.logger.error(`Error pulling from user stack: ${e}`);
      return undefined;
    }
  }

  /**
   * Pops multiple items from a user stack without returning them
   * @param stackAddr Address of the user stack
   * @param items Number of items to pop
   */
  popStack(stackAddr: Address, items: number): void {
    // Verify the stack is in dynamic memory to prevent errors
    if (!this.memory.isDynamicMemory(stackAddr)) {
      this.logger.error(`User stack at 0x${stackAddr.toString(16)} is not in dynamic memory`);
      return;
    }

    const availableSlots = this.memory.getWord(stackAddr);
    const initialCapacity = this.getInitialCapacity(stackAddr);
    const usedSlots = initialCapacity - availableSlots;
    const itemsToPop = Math.min(items, usedSlots);

    try {
      // Increase available slots by itemsToPop
      this.memory.setWord(stackAddr, availableSlots + itemsToPop);
      this.logger.debug(
        `Popped ${itemsToPop} items from user stack at 0x${stackAddr.toString(16)}, new count: ${
          availableSlots + itemsToPop
        }`
      );
    } catch (e) {
      this.logger.error(`Error popping from user stack: ${e}`);
    }
  }

  /**
   * Estimates the initial capacity of a user stack
   * @param stackAddr Address of the user stack
   * @returns Estimated initial capacity
   * @private
   */
  private getInitialCapacity(stackAddr: Address): number {
    // If we don't know the initial capacity, we can estimate
    // based on the current available slots and checking for
    // non-zero values beyond the currently used portion

    const availableSlots = this.memory.getWord(stackAddr);

    // Check for non-zero values beyond the current position
    // to estimate how large the stack actually is
    let maxNonZero = 0;

    for (let i = 1; i <= 32; i++) {
      // Arbitrary limit for search
      const addr = stackAddr + 2 + i * 2;
      if (addr < this.memory.size) {
        try {
          const value = this.memory.getWord(addr);
          if (value !== 0) {
            maxNonZero = i;
          }
        } catch (e) {
          // Address out of bounds or in read-only memory
          break;
        }
      }
    }

    return Math.max(availableSlots, maxNonZero);
  }

  /**
   * Creates a new user stack in memory
   * @param address Address where the stack should be created
   * @param capacity Initial capacity of the stack
   * @returns The created user stack object
   */
  createUserStack(address: Address, capacity: number): UserStack {
    // Verify the stack address is in dynamic memory
    if (!this.memory.isDynamicMemory(address)) {
      throw new Error(`Cannot create user stack in read-only memory at 0x${address.toString(16)}`);
    }

    // Initialize available slots counter
    this.memory.setWord(address, capacity);

    this.logger.debug(`Created user stack at 0x${address.toString(16)} with capacity ${capacity}`);

    return {
      address,
      initialCapacity: capacity,
    };
  }
}
