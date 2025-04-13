/**
 * Stack manipulation opcodes
 * This module contains the implementation of stack manipulation opcodes for the Z-Machine.
 *
 * Exported functions:
 * - push: Pushes a value onto the stack.
 * - pop: Pops a value from the stack.
 * - pull: Pops a value from the stack and stores it in a variable.
 * - load: Loads a value from a variable and stores it in the result variable.
 * - store: Stores a value in a variable.
 * - inc: Increments a variable by 1.
 * - dec: Decrements a variable by 1.
 * - inc_chk: Increments a variable, then checks if it's greater than a value.
 * - dec_chk: Decrements a variable, then checks if it's less than a value.
 * - pop_stack: Pops a value from the stack and discards it.
 * - push_stack: Pushes a value onto the stack.
 */
import { ZMachine } from '../../interpreter/ZMachine';
import { toI16, toU16 } from '../memory/cast16';
import { opcode } from './base';

/**
 * Pushes a value onto the stack.
 */
function push(machine: ZMachine, value: number): void {
  machine.logger.debug(`push ${value}`);
  machine.state.pushStack(value);
}

/**
 * Pops a value from the stack.
 * The value is discarded.
 */
function pop(machine: ZMachine): void {
  machine.logger.debug(`pop`);
  machine.state.popStack();
}

/**
 * Pops a value from the stack and stores it in a variable.
 * If a stack address is provided, it uses the user stack.
 */
function pull(machine: ZMachine, variable: number, stackAddr?: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} pull ${variable} ${stackAddr || ''}`);

  let value: number;

  // If a stack address is provided and we're in Version 6, use the user stack
  if (stackAddr !== undefined && machine.state.version === 6) {
    const userStackValue = machine.getUserStackManager().pullStack(stackAddr);

    // If undefined (stack empty), what should we do? The spec doesn't specify
    // We'll use 0 as a default, but this might need adjustment
    value = userStackValue !== undefined ? userStackValue : 0;
  } else {
    // Use system stack
    value = machine.state.popStack();
  }

  machine.state.storeVariable(variable, value);
}

/**
 * Loads a value from a variable and stores it in the result variable.
 */
function load(machine: ZMachine, variable: number): void {
  const resultVar = machine.state.readByte();
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} load ${variable} -> (${resultVar})`);
  machine.state.storeVariable(resultVar, machine.state.loadVariable(variable, true), true);
}

/**
 * Stores a value in a variable.
 */
function store(machine: ZMachine, variable: number, value: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} store (${variable}) ${value}`);
  machine.state.storeVariable(variable, value, true);
}

/**
 * Increments a variable by 1.
 */
function inc(machine: ZMachine, variable: number): void {
  const currentValue = machine.state.loadVariable(variable, true);
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} inc (${variable}) ${currentValue}`);
  machine.state.storeVariable(variable, toU16(toI16(currentValue) + 1), true);
}

/**
 * Decrements a variable by 1.
 */
function dec(machine: ZMachine, variable: number): void {
  const currentValue = machine.state.loadVariable(variable, true);
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} dec (${variable}) ${currentValue}`);
  machine.state.storeVariable(variable, toU16(toI16(currentValue) - 1), true);
}

/**
 * Increments a variable, then checks if it's greater than a value.
 */
function inc_chk(machine: ZMachine, variable: number, value: number): void {
  const [offset, branchOnFalse] = machine.state.readBranchOffset();
  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} inc_chk ${variable} ${value} -> [${!branchOnFalse}] ${
      machine.state.pc + offset - 2
    }`
  );

  const currentValue = machine.state.loadVariable(variable, true);
  const newValue = toI16(currentValue) + 1;
  machine.state.storeVariable(variable, toU16(newValue), true);

  machine.logger.debug(`     ${newValue} ?> ${value}`);
  machine.state.doBranch(newValue > toI16(value), branchOnFalse, offset);
}

/**
 * Decrements a variable, then checks if it's less than a value.
 */
function dec_chk(machine: ZMachine, variable: number, value: number): void {
  const [offset, branchOnFalse] = machine.state.readBranchOffset();
  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} dec_chk ${variable} ${value} -> [${!branchOnFalse}] ${
      machine.state.pc + offset - 2
    }`
  );

  const currentValue = machine.state.loadVariable(variable, true);
  const newValue = toI16(currentValue) - 1;
  machine.state.storeVariable(variable, toU16(newValue), true);

  machine.logger.debug(`     ${newValue} <? ${value}`);
  machine.state.doBranch(newValue < toI16(value), branchOnFalse, offset);
}

/**
 * Remove items from a specified stack (V6)
 */
function pop_stack(machine: ZMachine, items: number, stackAddr?: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} pop_stack ${items} ${stackAddr || ''}`);

  // Only valid in Version 6
  if (machine.state.version !== 6) {
    machine.logger.warn('pop_stack opcode only available in Version 6');
    return;
  }

  if (stackAddr !== undefined) {
    // Pop from user stack
    machine.getUserStackManager().popStack(stackAddr, items);
  } else {
    // Pop from system stack
    for (let i = 0; i < items; i++) {
      machine.state.popStack();
    }
  }
}

/**
 * Push value onto user stack, branch if successful (V6)
 */
function push_stack(machine: ZMachine, value: number, stackAddr: number): void {
  const [offset, branchOnFalse] = machine.state.readBranchOffset();
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} push_stack ${value} ${stackAddr}`);

  // Only valid in Version 6
  if (machine.state.version !== 6) {
    machine.logger.warn('push_stack opcode only available in Version 6');
    return;
  }

  const success = machine.getUserStackManager().pushStack(stackAddr, value);

  // Branch if successful
  machine.state.doBranch(success, branchOnFalse, offset);
}

/**
 * Export all stack manipulation opcodes
 */
export const stackOpcodes = {
  // Stack operations
  push: opcode('push', push),
  pop: opcode('pop', pop),
  pull: opcode('pull', pull),
  push_stack: opcode('push_stack', push_stack),
  pop_stack: opcode('pop_stack', pop_stack),

  // Variable operations
  load: opcode('load', load),
  store: opcode('store', store),
  inc: opcode('inc', inc),
  dec: opcode('dec', dec),
  inc_chk: opcode('inc_chk', inc_chk),
  dec_chk: opcode('dec_chk', dec_chk),
};
