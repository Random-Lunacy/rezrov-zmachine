import { ZMachine } from "../../interpreter/ZMachine";
import { opcode } from "./base";
import { toI16, toU16 } from "../memory/cast16";

/**
 * Pushes a value onto the stack.
 */
function push(machine: ZMachine, value: number): void {
  machine.pushStack(value);
}

/**
 * Pops a value from the stack.
 * The value is discarded.
 */
function pop(machine: ZMachine): void {
  machine.popStack();
}

/**
 * Pops a value from the stack and stores it in a variable.
 */
function pull(machine: ZMachine, variable: number): void {
  const value = machine.popStack();
  machine.storeVariable(variable, value);
}

/**
 * Loads a value from a variable and stores it in the result variable.
 */
function load(machine: ZMachine, variable: number): void {
  const resultVar = machine.readByte();
  machine.logger.debug(`${machine.op_pc.toString(16)} load ${variable} -> (${resultVar})`);
  machine.storeVariable(resultVar, machine.loadVariable(variable, true), true);
}

/**
 * Stores a value in a variable.
 */
function store(machine: ZMachine, variable: number, value: number): void {
  machine.logger.debug(`${machine.op_pc.toString(16)} store (${variable}) ${value}`);
  machine.storeVariable(variable, value, true);
}

/**
 * Increments a variable by 1.
 */
function inc(machine: ZMachine, variable: number): void {
  const currentValue = machine.loadVariable(variable, true);
  machine.storeVariable(
    variable,
    toU16(toI16(currentValue) + 1),
    true
  );
}

/**
 * Decrements a variable by 1.
 */
function dec(machine: ZMachine, variable: number): void {
  const currentValue = machine.loadVariable(variable, true);
  machine.storeVariable(
    variable,
    toU16(toI16(currentValue) - 1),
    true
  );
}

/**
 * Increments a variable, then checks if it's greater than a value.
 */
function inc_chk(machine: ZMachine, variable: number, value: number): void {
  const [offset, condfalse] = machine.readBranchOffset();
  machine.logger.debug(
    `${machine.op_pc.toString(16)} inc_chk ${variable} ${value} -> [${!condfalse}] ${machine.pc + offset - 2}`
  );

  const currentValue = machine.loadVariable(variable, true);
  const newValue = toI16(currentValue) + 1;
  machine.storeVariable(variable, toU16(newValue), true);

  machine.logger.debug(`     ${newValue} ?> ${value}`);
  machine.doBranch(newValue > toI16(value), condfalse, offset);
}

/**
 * Decrements a variable, then checks if it's less than a value.
 */
function dec_chk(machine: ZMachine, variable: number, value: number): void {
  const [offset, condfalse] = machine.readBranchOffset();
  machine.logger.debug(
    `${machine.op_pc.toString(16)} dec_chk ${variable} ${value} -> [${!condfalse}] ${machine.pc + offset - 2}`
  );

  const currentValue = machine.loadVariable(variable, true);
  const newValue = toI16(currentValue) - 1;
  machine.storeVariable(variable, toU16(newValue), true);

  machine.logger.debug(`     ${newValue} <? ${value}`);
  machine.doBranch(newValue < toI16(value), condfalse, offset);
}

/**
 * Loads a word from an array.
 */
function loadw(machine: ZMachine, array: number, wordIndex: number): void {
  const resultVar = machine.readByte();
  machine.logger.debug(
    `${machine.op_pc.toString(16)} loadw ${array} ${wordIndex} -> (${resultVar})`
  );

  const address = (array + 2 * wordIndex) & 0xffff;
  machine.storeVariable(resultVar, machine.getWord(address));
}

/**
 * Loads a byte from an array.
 */
function loadb(machine: ZMachine, array: number, byteIndex: number): void {
  const resultVar = machine.readByte();
  machine.logger.debug(
    `${machine.op_pc.toString(16)} loadb ${array} ${byteIndex} -> (${resultVar})`
  );

  const address = (array + byteIndex) & 0xffff;
  machine.storeVariable(resultVar, machine.getByte(address));
}

/**
 * Stores a word in an array.
 */
function storew(machine: ZMachine, array: number, wordIndex: number, value: number): void {
  machine.logger.debug(
    `${machine.op_pc.toString(16)} storew ${array} ${wordIndex} ${value}`
  );

  const address = (array + 2 * wordIndex) & 0xffff;
  machine.setWord(address, value);
}

/**
 * Stores a byte in an array.
 */
function storeb(machine: ZMachine, array: number, byteIndex: number, value: number): void {
  machine.logger.debug(
    `${machine.op_pc.toString(16)} storeb ${array} ${byteIndex} ${value}`
  );

  const address = (array + byteIndex) & 0xffff;
  machine.setByte(address, value & 0xff);
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
