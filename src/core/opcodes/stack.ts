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
 * - loadw: Loads a word from an array.
 * - loadb: Loads a byte from an array.
 * - storew: Stores a word in an array.
 * - storeb: Stores a byte in an array.
 */
import { ZMachine } from "../../interpreter/ZMachine";
import { toI16, toU16 } from "../memory/cast16";
import { opcode } from "./base";

/**
 * Pushes a value onto the stack.
 */
function push(machine: ZMachine, value: number): void {
  machine.state.pushStack(value);
}

/**
 * Pops a value from the stack.
 * The value is discarded.
 */
function pop(machine: ZMachine): void {
  machine.state.popStack();
}

/**
 * Pops a value from the stack and stores it in a variable.
 */
function pull(machine: ZMachine, variable: number): void {
  const value = machine.state.popStack();
  machine.state.storeVariable(variable, value);
}

/**
 * Loads a value from a variable and stores it in the result variable.
 */
function load(machine: ZMachine, variable: number): void {
  const resultVar = machine.state.readByte();
  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} load ${variable} -> (${resultVar})`
  );
  machine.state.storeVariable(resultVar, machine.state.loadVariable(variable, true), true);
}

/**
 * Stores a value in a variable.
 */
function store(machine: ZMachine, variable: number, value: number): void {
  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} store (${variable}) ${value}`
  );
  machine.state.storeVariable(variable, value, true);
}

/**
 * Increments a variable by 1.
 */
function inc(machine: ZMachine, variable: number): void {
  const currentValue = machine.state.loadVariable(variable, true);
  machine.state.storeVariable(variable, toU16(toI16(currentValue) + 1), true);
}

/**
 * Decrements a variable by 1.
 */
function dec(machine: ZMachine, variable: number): void {
  const currentValue = machine.state.loadVariable(variable, true);
  machine.state.storeVariable(variable, toU16(toI16(currentValue) - 1), true);
}

/**
 * Increments a variable, then checks if it's greater than a value.
 */
function inc_chk(machine: ZMachine, variable: number, value: number): void {
  const [offset, branchOnFalse] = machine.state.readBranchOffset();
  machine.logger.debug(
    `${machine.executor.op_pc.toString(
      16
    )} inc_chk ${variable} ${value} -> [${!branchOnFalse}] ${
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
    `${machine.executor.op_pc.toString(
      16
    )} dec_chk ${variable} ${value} -> [${!branchOnFalse}] ${
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
 * Loads a word from an array.
 */
function loadw(machine: ZMachine, array: number, wordIndex: number): void {
  const resultVar = machine.state.readByte();
  machine.logger.debug(
    `${machine.executor.op_pc.toString(
      16
    )} loadw ${array} ${wordIndex} -> (${resultVar})`
  );

  const address = (array + 2 * wordIndex) & 0xffff;
  machine.state.storeVariable(resultVar, machine.memory.getWord(address));
}

/**
 * Loads a byte from an array.
 */
function loadb(machine: ZMachine, array: number, byteIndex: number): void {
  const resultVar = machine.state.readByte();
  machine.logger.debug(
    `${machine.executor.op_pc.toString(
      16
    )} loadb ${array} ${byteIndex} -> (${resultVar})`
  );

  const address = (array + byteIndex) & 0xffff;
  machine.state.storeVariable(resultVar, machine.memory.getByte(address));
}

/**
 * Stores a word in an array.
 */
function storew(
  machine: ZMachine,
  array: number,
  wordIndex: number,
  value: number
): void {
  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} storew ${array} ${wordIndex} ${value}`
  );

  const address = (array + 2 * wordIndex) & 0xffff;
  machine.memory.setWord(address, value);
}

/**
 * Stores a byte in an array.
 */
function storeb(
  machine: ZMachine,
  array: number,
  byteIndex: number,
  value: number
): void {
  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} storeb ${array} ${byteIndex} ${value}`
  );

  const address = (array + byteIndex) & 0xffff;
  machine.memory.setByte(address, value & 0xff);
}

/**
 * Export all stack manipulation opcodes
 */
export const stackOpcodes = {
  // Stack operations
  push: opcode("push", push),
  pop: opcode("pop", pop),
  pull: opcode("pull", pull),

  // Variable operations
  load: opcode("load", load),
  store: opcode("store", store),
  inc: opcode("inc", inc),
  dec: opcode("dec", dec),
  inc_chk: opcode("inc_chk", inc_chk),
  dec_chk: opcode("dec_chk", dec_chk),

  // Memory access operations
  loadw: opcode("loadw", loadw),
  loadb: opcode("loadb", loadb),
  storew: opcode("storew", storew),
  storeb: opcode("storeb", storeb),
};
