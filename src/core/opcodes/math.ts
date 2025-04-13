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
 * - `art_shift`: Binary left arithmetic shift (preserves sign)
 * - `log_shift`: Binary logical shift (does not preserve sign on right shift)
 */
import { ZMachine } from '../../interpreter/ZMachine';
import { initRandom, randomInt } from '../../utils/random';
import { toI16, toU16 } from '../memory/cast16';
import { opcode } from './base';

/**
 * Signed 16-bit addition. Adds the values of a and b and stores the result.
 */
function add(machine: ZMachine, a: number, b: number): void {
  machine.state.logger.debug(`add ${a} ${b}`);
  machine.state.storeVariable(machine.state.readByte(), toU16(toI16(a) + toI16(b)));
}

/**
 * Performs a bitwise AND operation on the values of a and b and stores the result.
 */
function and(machine: ZMachine, a: number, b: number): void {
  machine.state.logger.debug(`and ${a} ${b}`);
  machine.state.storeVariable(machine.state.readByte(), a & b);
}

/**
 * Divides the first number by the second.
 */
function div(machine: ZMachine, a: number, b: number): void {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  machine.state.logger.debug(`div ${a} ${b}`);
  machine.state.storeVariable(machine.state.readByte(), toU16(Math.floor(toI16(a) / toI16(b))));
}

/**
 * Calculates the remainder when dividing the first number by the second.
 */
function mod(machine: ZMachine, a: number, b: number): void {
  if (b === 0) {
    throw new Error('Modulo by zero');
  }
  machine.state.logger.debug(`mod ${a} ${b}`);
  machine.state.storeVariable(machine.state.readByte(), toU16(toI16(a) % toI16(b)));
}

/**
 * Multiplies two numbers.
 */
function mul(machine: ZMachine, a: number, b: number): void {
  machine.state.logger.debug(`mul ${a} ${b}`);
  machine.state.storeVariable(machine.state.readByte(), toU16(toI16(a) * toI16(b)));
}

/**
 * Performs bitwise NOT operation.
 */
function not(machine: ZMachine, value: number): void {
  machine.state.logger.debug(`not ${value}`);
  machine.state.storeVariable(machine.state.readByte(), value ^ 0xffff);
}

/**
 * Performs bitwise OR operation.
 */
function or(machine: ZMachine, a: number, b: number): void {
  machine.state.logger.debug(`or ${a} ${b}`);
  machine.state.storeVariable(machine.state.readByte(), a | b);
}

/**
 * Subtracts the second number from the first.
 */
function sub(machine: ZMachine, a: number, b: number): void {
  machine.state.logger.debug(`sub ${a} ${b}`);
  machine.state.storeVariable(machine.state.readByte(), toU16(toI16(a) - toI16(b)));
}

/**
 * Generate a random number
 */
function random(machine: ZMachine, range: number): void {
  const resultVar = machine.state.readByte();

  machine.state.logger.debug(`random ${range}`);

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
 * Binary left arithmetic shift (preserves sign)
 */
function art_shift(machine: ZMachine, value: number, places: number): void {
  const resultVar = machine.state.readByte();
  const signedPlaces = toI16(places);

  machine.state.logger.debug(`art_shift ${value} ${places}`);

  let result: number;

  if (signedPlaces >= 0) {
    // Left shift
    result = (value << signedPlaces) & 0xffff;
  } else {
    // Right arithmetic shift (preserves sign)
    result = toU16(toI16(value) >> Math.abs(signedPlaces));
  }

  machine.state.storeVariable(resultVar, result);
}

/**
 * Binary logical shift (does not preserve sign on right shift)
 */
function log_shift(machine: ZMachine, value: number, places: number): void {
  const resultVar = machine.state.readByte();
  const signedPlaces = toI16(places);

  machine.state.logger.debug(`log_shift ${value} ${places}`);

  let result: number;

  if (signedPlaces >= 0) {
    // Left shift
    result = (value << signedPlaces) & 0xffff;
  } else {
    // Right logical shift (zero-fill)
    result = (value >>> Math.abs(signedPlaces)) & 0xffff;
  }

  machine.state.storeVariable(resultVar, result);
}

/**
 * Export all math opcodes
 */
export const mathOpcodes = {
  // 2OP opcodes
  or: opcode('or', or),
  and: opcode('and', and),
  add: opcode('add', add),
  sub: opcode('sub', sub),
  mul: opcode('mul', mul),
  div: opcode('div', div),
  mod: opcode('mod', mod),

  // 1OP opcodes
  not: opcode('not', not),
  random: opcode('random', random),

  // Shift opcodes
  art_shift: opcode('art_shift', art_shift),
  log_shift: opcode('log_shift', log_shift),
};
