// src/core/opcodes/control.ts
import { GameState } from "../../interpreter/GameState";
import { opcode } from "./base";
import { hex } from "../../utils/debug";
import { toI16 } from "../memory/cast16";

/**
 * Jumps if equal
 */
function je(state: GameState, a: number, b: number, c?: number, d?: number): void {
  const [offset, condfalse] = state.readBranchOffset();
  state.logger.debug(
    `${hex(state.pc)} je ${hex(a)} ${hex(b)} ${c !== undefined ? hex(c) : ''} ${d !== undefined ? hex(d) : ''} -> [${!condfalse}] ${hex(state.pc + offset - 2)}`
  );

  const cond =
    a === b ||
    (c !== undefined && a === c) ||
    (d !== undefined && a === d);

  state.doBranch(cond, condfalse, offset);
}

/**
 * Jumps if less than
 */
function jl(state: GameState, a: number, b: number): void {
  const [offset, condfalse] = state.readBranchOffset();
  state.logger.debug(
    `${hex(state.pc)} jl ${hex(a)} ${hex(b)} -> [${!condfalse}] ${hex(state.pc + offset - 2)}`
  );

  state.doBranch(toI16(a) < toI16(b), condfalse, offset);
}

/**
 * Jumps if greater than
 */
function jg(state: GameState, a: number, b: number): void {
  const [offset, condfalse] = state.readBranchOffset();
  state.logger.debug(
    `${hex(state.pc)} jg ${hex(a)} ${hex(b)} -> [${!condfalse}] ${hex(state.pc + offset - 2)}`
  );

  state.doBranch(toI16(a) > toI16(b), condfalse, offset);
}

/**
 * Jumps if zero
 */
function jz(state: GameState, a: number): void {
  const [offset, condfalse] = state.readBranchOffset();
  state.logger.debug(
    `${hex(state.pc)} jz ${hex(a)} -> [${!condfalse}] ${hex(state.pc + offset - 2)}`
  );

  state.doBranch(a === 0, condfalse, offset);
}

/**
 * Unconditional jump
 */
function jump(state: GameState, offset: number): void {
  state.logger.debug(`${hex(state.pc)} jump ${hex(offset)}`);
  state.pc = state.pc + toI16(offset) - 2;
}

/**
 * Tests bits
 */
function test(state: GameState, bitmap: number, flags: number): void {
  const [offset, condfalse] = state.readBranchOffset();
  state.logger.debug(
    `${hex(state.pc)} test ${hex(bitmap)} ${hex(flags)} -> [${!condfalse}] ${hex(state.pc + offset - 2)}`
  );

  state.doBranch((bitmap & flags) === flags, condfalse, offset);
}

/**
 * Checks the argument count
 */
function check_arg_count(state: GameState, argNumber: number): void {
  const [offset, condfalse] = state.readBranchOffset();
  state.logger.debug(
    `${hex(state.pc)} check_arg_count ${hex(argNumber)} -> [${!condfalse}] ${hex(state.pc + offset - 2)}`
  );

  state.doBranch(state.getArgumentCount() >= argNumber, condfalse, offset);
}

/**
 * Returns true (1)
 */
function rtrue(state: GameState): void {
  state.logger.debug(`${hex(state.pc)} rtrue`);
  state.returnFromRoutine(1);
}

/**
 * Returns false (0)
 */
function rfalse(state: GameState): void {
  state.logger.debug(`${hex(state.pc)} rfalse`);
  state.returnFromRoutine(0);
}

/**
 * Returns value popped from the stack
 */
function ret_popped(state: GameState): void {
  state.logger.debug(`${hex(state.pc)} ret_popped`);
  state.returnFromRoutine(state.popStack());
}

/**
 * Returns from a routine with the specified value
 */
function ret(state: GameState, value: number): void {
  state.logger.debug(`${hex(state.pc)} ret ${hex(value)}`);
  state.returnFromRoutine(value);
}

/**
 * Placeholder for no-op instruction
 */
function nop(state: GameState): void {
  state.logger.debug(`${hex(state.pc)} nop`);
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
