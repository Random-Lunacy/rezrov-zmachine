/**
 * Math opcodes for the ZMachine interpreter.
 * These opcodes perform various mathematical operations.
 *
 * Exported Opcodes:
 * - `or`: Bitwise OR
 * - `and`: Bitwise AND
 * - `add`: Addition
 * - `sub`: Subtraction
 * - `mul`: Multiplication
 * - `div`: Division
 * - `mod`: Modulo
 * - `not`: Bitwise NOT
 * - `random`: Generate a random number
 */
import { ZMachine } from "../../interpreter/ZMachine";
import { initRandom, randomInt } from "../../utils/random";
import { toI16, toU16 } from "../memory/cast16";
import { opcode } from "./base";

/**
 * Performs bitwise OR operation.
 */
function or(machine: ZMachine, a: number, b: number): void {
  machine.state.storeVariable(machine.state.readByte(), a | b);
}

/**
 * Performs bitwise AND operation.
 */
function and(machine: ZMachine, a: number, b: number): void {
  machine.state.storeVariable(machine.state.readByte(), a & b);
}

/**
 * Adds two numbers.
 */
function add(machine: ZMachine, a: number, b: number): void {
  machine.state.storeVariable(machine.state.readByte(), toU16(toI16(a) + toI16(b)));
}

/**
 * Subtracts the second number from the first.
 */
function sub(machine: ZMachine, a: number, b: number): void {
  machine.state.storeVariable(machine.state.readByte(), toU16(toI16(a) - toI16(b)));
}

/**
 * Multiplies two numbers.
 */
function mul(machine: ZMachine, a: number, b: number): void {
  machine.state.storeVariable(machine.state.readByte(), toU16(toI16(a) * toI16(b)));
}

/**
 * Divides the first number by the second.
 */
function div(machine: ZMachine, a: number, b: number): void {
  if (b === 0) {
    throw new Error("Division by zero");
  }
  machine.state.storeVariable(
    machine.state.readByte(),
    toU16(Math.floor(toI16(a) / toI16(b)))
  );
}

/**
 * Calculates the remainder when dividing the first number by the second.
 */
function mod(machine: ZMachine, a: number, b: number): void {
  if (b === 0) {
    throw new Error("Modulo by zero");
  }
  machine.state.storeVariable(machine.state.readByte(), toU16(toI16(a) % toI16(b)));
}

/**
 * Performs bitwise NOT operation.
 */
function not(machine: ZMachine, value: number): void {
  machine.state.storeVariable(machine.state.readByte(), value ^ 0xffff);
}

/**
 * Generate a random number
 */
function random(machine: ZMachine, range: number): void {
  const resultVar = machine.state.readByte();

  if (range <= 0) {
    // Reseed the RNG
    initRandom(range.toString());
    machine.state.storeVariable(resultVar, 0);
  } else {
    // Generate a random number between 1 and range
    const value = randomInt(range);
    machine.state.storeVariable(resultVar, value);
  }
}


/**
 * Export all math opcodes
 */
export const mathOpcodes = {
  // 2OP opcodes
  or: opcode("or", or),
  and: opcode("and", and),
  add: opcode("add", add),
  sub: opcode("sub", sub),
  mul: opcode("mul", mul),
  div: opcode("div", div),
  mod: opcode("mod", mod),

  // 1OP opcodes
  not: opcode("not", not),
  random: opcode("random", random),

};
