import { Logger } from '../../utils/log';
import { Memory } from '../memory/Memory';

export interface UserStack {
  address: number;
  initialCapacity: number;
}

export class UserStackManager {
  constructor(memory: Memory, logger: Logger) {
    this.memory = memory;
    this.logger = logger;
  }

  private memory: Memory;
  private logger: Logger;

  /**
   * Pushes a value onto a user stack
   * @param stackAddr Address of the user stack
   * @param value Value to push
   * @returns true if successful, false if stack is full
   */
  pushStack(stackAddr: number, value: number): boolean {
    // Read the current number of available slots
    const availableSlots = this.memory.getWord(stackAddr);

    if (availableSlots <= 0) {
      this.logger.debug(`User stack at ${stackAddr} is full`);
      return false;
    }

    // Calculate where to write the new value
    // Stack grows downward from the end of the table
    const valueIndex = availableSlots;
    const valueAddr = stackAddr + 2 + (valueIndex - 1) * 2;

    // Write the value
    this.memory.setWord(valueAddr, value);

    // Update available slots
    this.memory.setWord(stackAddr, availableSlots - 1);

    return true;
  }

  /**
   * Pulls a value from a user stack
   * @param stackAddr Address of the user stack
   * @returns The value pulled, or undefined if stack is empty
   */
  pullStack(stackAddr: number): number | undefined {
    // Get the capacity by reading the first word in the table
    const initialCapacity = this.getInitialCapacity(stackAddr);

    // Get available slots
    const availableSlots = this.memory.getWord(stackAddr);

    // Calculate used slots
    const usedSlots = initialCapacity - availableSlots;

    if (usedSlots <= 0) {
      this.logger.debug(`User stack at ${stackAddr} is empty`);
      return undefined;
    }

    // Calculate where to read the top value
    const valueIndex = availableSlots + 1;
    const valueAddr = stackAddr + 2 + (valueIndex - 1) * 2;

    // Read the value
    const value = this.memory.getWord(valueAddr);

    // Update available slots
    this.memory.setWord(stackAddr, availableSlots + 1);

    return value;
  }

  /**
   * Pops multiple items from a user stack
   * @param stackAddr Address of the user stack
   * @param items Number of items to pop
   */
  popStack(stackAddr: number, items: number): void {
    // Get available slots
    const availableSlots = this.memory.getWord(stackAddr);
    const initialCapacity = this.getInitialCapacity(stackAddr);

    // Calculate used slots
    const usedSlots = initialCapacity - availableSlots;

    // Calculate how many items we can actually pop
    const itemsToPop = Math.min(items, usedSlots);

    // Update available slots
    this.memory.setWord(stackAddr, availableSlots + itemsToPop);
  }

  /**
   * Get the initial capacity of a user stack
   * @param stackAddr Address of the user stack
   * @returns The initial capacity
   */
  private getInitialCapacity(stackAddr: number): number {
    // We need to infer the initial capacity based on current state
    // This would be stored somewhere in the UserStack object
    // but for stack operations we can calculate based on memory contents

    // For simplicity, we can look at how the stack was initialized
    // In a full implementation we'd need to track this information

    // For now, assuming we have a way to know the initial capacity
    // This would need to be stored separately in an actual implementation
    throw new Error(`Initial capacity tracking not implemented (${stackAddr}).`);
  }

  /**
   * Creates a new user stack in memory
   * @param address Memory address to create the stack
   * @param capacity Capacity of the stack
   * @returns UserStack object representing the stack
   */
  createUserStack(address: number, capacity: number): UserStack {
    // Initialize the stack with all slots available
    this.memory.setWord(address, capacity);

    // Return a reference to the stack
    return {
      address,
      initialCapacity: capacity,
    };
  }
}
