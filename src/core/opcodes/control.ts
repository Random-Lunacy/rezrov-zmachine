/**
 * Collection of control flow opcodes for the Z-Machine interpreter.
 * These opcodes handle branching, conditional jumps, routine returns,
 * and other control flow operations.
 *
 * Exported Opcodes:
 * - `je`: Jump if equal. Compares up to four values and branches if any are equal.
 * - `jl`: Jump if less than. Compares two signed 16-bit values and branches if the first is less than the second.
 * - `jg`: Jump if greater than. Compares two signed 16-bit values and branches if the first is greater than the second.
 * - `jz`: Jump if zero. Branches if the given value is zero.
 * - `jump`: Unconditional jump. Adjusts the program counter by a signed offset.
 * - `test`: Tests bits. Branches if all bits in the `flags` argument are set in the `bitmap`.
 * - `check_arg_count`: Checks the argument count. Branches if the number of arguments passed to the current routine is greater than or equal to the specified number.
 * - `rtrue`: Returns true (1) from the current routine.
 * - `rfalse`: Returns false (0) from the current routine.
 * - `ret_popped`: Returns a value popped from the stack.
 * - `ret`: Returns a specified value from the current routine.
 * - `nop`: No-op instruction. Does nothing.
 */
import { ZMachine } from "../../interpreter/ZMachine";
import { hex } from "../../utils/debug";
import { toI16 } from "../memory/cast16";
import { opcode } from "./base";

/**
 * Jumps if equal
 */
function je(
  machine: ZMachine,
  a: number,
  b: number,
  c?: number,
  d?: number
): void {
  const [offset, condfalse] = machine.state.readBranchOffset();
  machine.state.logger.debug(
    `${hex(machine.state.pc)} je ${hex(a)} ${hex(b)} ${c !== undefined ? hex(c) : ""} ${
      d !== undefined ? hex(d) : ""
    } -> [${!condfalse}] ${hex(machine.state.pc + offset - 2)}`
  );

  const cond =
    a === b || (c !== undefined && a === c) || (d !== undefined && a === d);

  machine.state.doBranch(cond, condfalse, offset);
}

/**
 * Jumps if less than
 */
function jl(machine: ZMachine, a: number, b: number): void {
  const [offset, condfalse] = machine.state.readBranchOffset();
  machine.state.logger.debug(
    `${hex(machine.state.pc)} jl ${hex(a)} ${hex(b)} -> [${!condfalse}] ${hex(
      machine.state.pc + offset - 2
    )}`
  );

  machine.state.doBranch(toI16(a) < toI16(b), condfalse, offset);
}

/**
 * Jumps if greater than
 */
function jg(machine: ZMachine, a: number, b: number): void {
  const [offset, condfalse] = machine.state.readBranchOffset();
  machine.state.logger.debug(
    `${hex(machine.state.pc)} jg ${hex(a)} ${hex(b)} -> [${!condfalse}] ${hex(
      machine.state.pc + offset - 2
    )}`
  );

  machine.state.doBranch(toI16(a) > toI16(b), condfalse, offset);
}

/**
 * Jumps if zero
 */
function jz(machine: ZMachine, a: number): void {
  const [offset, condfalse] = machine.state.readBranchOffset();
  machine.state.logger.debug(
    `${hex(machine.state.pc)} jz ${hex(a)} -> [${!condfalse}] ${hex(
      machine.state.pc + offset - 2
    )}`
  );

  machine.state.doBranch(a === 0, condfalse, offset);
}

/**
 * Unconditional jump
 */
function jump(machine: ZMachine, offset: number): void {
  machine.state.logger.debug(`${hex(machine.state.pc)} jump ${hex(offset)}`);
  machine.state.pc = machine.state.pc + toI16(offset) - 2;
}

/**
 * Tests bits
 */
function test(machine: ZMachine, bitmap: number, flags: number): void {
  const [offset, condfalse] = machine.state.readBranchOffset();
  machine.state.logger.debug(
    `${hex(machine.state.pc)} test ${hex(bitmap)} ${hex(
      flags
    )} -> [${!condfalse}] ${hex(machine.state.pc + offset - 2)}`
  );

  machine.state.doBranch((bitmap & flags) === flags, condfalse, offset);
}

/**
 * Checks the argument count
 */
function check_arg_count(machine: ZMachine, argNumber: number): void {
  const [offset, condfalse] = machine.state.readBranchOffset();
  machine.state.logger.debug(
    `${hex(machine.state.pc)} check_arg_count ${hex(
      argNumber
    )} -> [${!condfalse}] ${hex(machine.state.pc + offset - 2)}`
  );

  machine.state.doBranch(machine.state.getArgumentCount() >= argNumber, condfalse, offset);
}

/**
 * Returns true (1)
 */
function rtrue(machine: ZMachine): void {
  machine.state.logger.debug(`${hex(machine.state.pc)} rtrue`);
  machine.state.returnFromRoutine(1);
}

/**
 * Returns false (0)
 */
function rfalse(machine: ZMachine): void {
  machine.state.logger.debug(`${hex(machine.state.pc)} rfalse`);
  machine.state.returnFromRoutine(0);
}

/**
 * Returns value popped from the stack
 */
function ret_popped(machine: ZMachine): void {
  machine.state.logger.debug(`${hex(machine.state.pc)} ret_popped`);
  machine.state.returnFromRoutine(machine.state.popStack());
}

/**
 * Returns from a routine with the specified value
 */
function ret(machine: ZMachine, value: number): void {
  machine.state.logger.debug(`${hex(machine.state.pc)} ret ${hex(value)}`);
  machine.state.returnFromRoutine(value);
}

/**
 * Placeholder for no-op instruction
 */
function nop(machine: ZMachine): void {
  machine.state.logger.debug(`${hex(machine.state.pc)} nop`);
  // Do nothing
}

/**
 * Export all control flow opcodes
 */
export const controlOpcodes = {
  je: opcode("je", je),
  jl: opcode("jl", jl),
  jg: opcode("jg", jg),
  jz: opcode("jz", jz),
  jump: opcode("jump", jump),
  test: opcode("test", test),
  check_arg_count: opcode("check_arg_count", check_arg_count),
  rtrue: opcode("rtrue", rtrue),
  rfalse: opcode("rfalse", rfalse),
  ret_popped: opcode("ret_popped", ret_popped),
  ret: opcode("ret", ret),
  nop: opcode("nop", nop),
};
