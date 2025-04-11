import { ZMachine } from "../../interpreter/ZMachine";
import { opcode } from "./base";
import { toI16, toU16 } from "../memory/cast16";

/**
 * Performs bitwise OR operation.
 */
function or(machine: ZMachine, a: number, b: number): void {
  machine.storeVariable(machine.readByte(), a | b);
}

/**
 * Performs bitwise AND operation.
 */
function and(machine: ZMachine, a: number, b: number): void {
  machine.storeVariable(machine.readByte(), a & b);
}

/**
 * Adds two numbers.
 */
function add(machine: ZMachine, a: number, b: number): void {
  machine.storeVariable(machine.readByte(), toU16(toI16(a) + toI16(b)));
}

/**
 * Subtracts the second number from the first.
 */
function sub(machine: ZMachine, a: number, b: number): void {
  machine.storeVariable(machine.readByte(), toU16(toI16(a) - toI16(b)));
}

/**
 * Multiplies two numbers.
 */
function mul(machine: ZMachine, a: number, b: number): void {
  machine.storeVariable(machine.readByte(), toU16(toI16(a) * toI16(b)));
}

/**
 * Divides the first number by the second.
 */
function div(machine: ZMachine, a: number, b: number): void {
  if (b === 0) {
    throw new Error("Division by zero");
  }
  machine.storeVariable(
    machine.readByte(),
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
  machine.storeVariable(machine.readByte(), toU16(toI16(a) % toI16(b)));
}

/**
 * Performs bitwise NOT operation.
 */
function not(machine: ZMachine, value: number): void {
  machine.storeVariable(machine.readByte(), value ^ 0xffff);
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
};
