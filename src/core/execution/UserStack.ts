// src/core/execution/UserStack.ts
import { Logger } from '../../utils/log';
import { Memory } from '../memory/Memory';

export interface UserStack {
  address: number; // Memory address of the stack
  initialCapacity: number; // Initial capacity of the stack
}

export class UserStackManager {
  constructor(private memory: Memory, private logger: Logger) {}

  /**
   * Pushes a value onto a user stack
   *
   * @param stackAddr Address of the user stack
   * @param value Value to push onto the stack
   * @returns true if successful, false if stack is full
   */
  pushStack(stackAddr: number, value: number): boolean {
    // First word is count of available slots
    const availableSlots = this.memory.getWord(stackAddr);

    if (availableSlots <= 0) {
      this.logger.debug(`User stack at ${stackAddr} is full`);
      return false;
    }

    // Calculate address for the new value (stack grows backward from capacity)
    const valueIndex = availableSlots;
    const valueAddr = stackAddr + 2 + (valueIndex - 1) * 2;

    // Store the value
    this.memory.setWord(valueAddr, value);

    // Update available slots count
    this.memory.setWord(stackAddr, availableSlots - 1);

    return true;
  }

  /**
   * Pulls a value from a user stack
   *
   * @param stackAddr Address of the user stack
   * @returns The value pulled from the stack, or undefined if empty
   */
  pullStack(stackAddr: number): number | undefined {
    const initialCapacity = this.getInitialCapacity(stackAddr);
    const availableSlots = this.memory.getWord(stackAddr);
    const usedSlots = initialCapacity - availableSlots;

    if (usedSlots <= 0) {
      this.logger.debug(`User stack at ${stackAddr} is empty`);
      return undefined;
    }

    // Calculate address of the top value
    const valueIndex = availableSlots + 1;
    const valueAddr = stackAddr + 2 + (valueIndex - 1) * 2;

    // Get the value
    const value = this.memory.getWord(valueAddr);

    // Update available slots count
    this.memory.setWord(stackAddr, availableSlots + 1);

    return value;
  }

  /**
   * Removes multiple items from a user stack
   *
   * @param stackAddr Address of the user stack
   * @param items Number of items to remove
   */
  popStack(stackAddr: number, items: number): void {
    const availableSlots = this.memory.getWord(stackAddr);
    const initialCapacity = this.getInitialCapacity(stackAddr);
    const usedSlots = initialCapacity - availableSlots;
    const itemsToPop = Math.min(items, usedSlots);

    // Update available slots count
    this.memory.setWord(stackAddr, availableSlots + itemsToPop);
  }

  /**
   * Gets the initial capacity of a user stack
   *
   * @param stackAddr Address of the user stack
   * @returns The initial capacity of the stack
   */
  private getInitialCapacity(stackAddr: number): number {
    // We need to track the initial capacity for each stack
    // For now, we'll estimate it based on the current state
    // In a real implementation, we would store this when the stack is created

    // Get the current available slots
    const availableSlots = this.memory.getWord(stackAddr);

    // Look at the first few words after the count to estimate capacity
    // This is a heuristic that should be replaced with proper tracking
    const estimatedCapacity = availableSlots;
    let maxNonZero = 0;

    for (let i = 1; i <= 32; i++) {
      const addr = stackAddr + 2 + i * 2;
      if (addr < this.memory.size) {
        const value = this.memory.getWord(addr);
        if (value !== 0) {
          maxNonZero = i;
        }
      }
    }

    return Math.max(estimatedCapacity, maxNonZero);
  }

  /**
   * Creates a new user stack
   *
   * @param address Address to create the user stack at
   * @param capacity Initial capacity of the stack
   * @returns UserStack object
   */
  createUserStack(address: number, capacity: number): UserStack {
    this.memory.setWord(address, capacity);

    return {
      address,
      initialCapacity: capacity,
    };
  }
}
