// src/core/opcodes/call.ts
import { GameState } from "../../interpreter/GameState";
import { opcode } from "./base";
import { hex } from "../../utils/debug";

/**
 * Call a routine with 1 argument, storing the result
 */
function call_1s(state: GameState, routine: number): void {
  const resultVar = state.readByte();

  if (routine === 0) {
    state.storeVariable(resultVar, 0);
    return;
  }

  const packedAddress = state.unpackRoutineAddress(routine);
  state.logger.debug(
    `${hex(state.pc)} call_1s ${hex(packedAddress)} -> (${hex(resultVar)})`
  );
  state.callRoutine(packedAddress, resultVar);
}

/**
 * Call a routine with 1 argument, not storing the result
 */
function call_1n(state: GameState, routine: number): void {
  if (routine === 0) {
    return;
  }

  const packedAddress = state.unpackRoutineAddress(routine);
  state.logger.debug(`${hex(state.pc)} call_1n ${hex(packedAddress)}`);
  state.callRoutine(packedAddress, null);
}

/**
 * Call a routine with 2 arguments, storing the result
 */
function call_2s(state: GameState, routine: number, arg1: number): void {
  const resultVar = state.readByte();

  if (routine === 0) {
    state.storeVariable(resultVar, 0);
    return;
  }

  const packedAddress = state.unpackRoutineAddress(routine);
  state.logger.debug(
    `${hex(state.pc)} call_2s ${hex(packedAddress)} ${arg1} -> (${hex(
      resultVar
    )})`
  );
  state.callRoutine(packedAddress, resultVar, arg1);
}

/**
 * Call a routine with 2 arguments, not storing the result
 */
function call_2n(state: GameState, routine: number, arg1: number): void {
  if (routine === 0) {
    return;
  }

  const packedAddress = state.unpackRoutineAddress(routine);
  state.logger.debug(`${hex(state.pc)} call_2n ${hex(packedAddress)} ${arg1}`);
  state.callRoutine(packedAddress, null, arg1);
}

/**
 * Call a routine with variable number of arguments, storing the result
 */
function call_vs(
  state: GameState,
  routine: number,
  ...args: Array<number>
): void {
  const resultVar = state.readByte();

  if (routine === 0) {
    state.storeVariable(resultVar, 0);
    return;
  }

  const packedAddress = state.unpackRoutineAddress(routine);
  state.logger.debug(
    `${hex(state.pc)} call_vs ${hex(packedAddress)} ${args
      .map((a) => hex(a))
      .join(", ")} -> (${hex(resultVar)})`
  );
  state.callRoutine(packedAddress, resultVar, ...args);
}

/**
 * Call a routine with variable number of arguments, but specifically 2 at minimum (VAR form)
 */
function call_vs2(
  state: GameState,
  routine: number,
  ...args: Array<number>
): void {
  const resultVar = state.readByte();

  if (routine === 0) {
    state.storeVariable(resultVar, 0);
    return;
  }

  const packedAddress = state.unpackRoutineAddress(routine);
  state.logger.debug(
    `${hex(state.pc)} call_vs2 ${hex(packedAddress)} ${args
      .map((a) => hex(a))
      .join(", ")} -> (${hex(resultVar)})`
  );
  state.callRoutine(packedAddress, resultVar, ...args);
}

/**
 * Call a routine with variable number of arguments, not storing the result
 */
function call_vn(
  state: GameState,
  routine: number,
  ...args: Array<number>
): void {
  if (routine === 0) {
    return;
  }

  const packedAddress = state.unpackRoutineAddress(routine);
  state.logger.debug(
    `${hex(state.pc)} call_vn ${hex(packedAddress)} ${args
      .map((a) => hex(a))
      .join(", ")}`
  );
  state.callRoutine(packedAddress, null, ...args);
}

/**
 * Call a routine with variable number of arguments, but specifically 2 at minimum, not storing the result
 */
function call_vn2(
  state: GameState,
  routine: number,
  ...args: Array<number>
): void {
  if (routine === 0) {
    return;
  }

  const packedAddress = state.unpackRoutineAddress(routine);
  state.logger.debug(
    `${hex(state.pc)} call_vn2 ${hex(packedAddress)} ${args
      .map((a) => hex(a))
      .join(", ")}`
  );
  state.callRoutine(packedAddress, null, ...args);
}

/**
 * Main VAR opcode for calling routines with variable arguments and storing the result
 * This is the most general form of call
 */
function call(state: GameState, routine: number, ...args: Array<number>): void {
  return call_vs(state, routine, ...args);
}

/**
 * Store the return addresses for the current callstack frame, to be used by catch/throw
 */
function zCatch(state: GameState): void {
  const resultVar = state.readByte();
  state.logger.debug(`${hex(state.pc)} catch -> (${hex(resultVar)})`);
  state.storeVariable(resultVar, state.callstack.length - 1);
}

/**
 * Throw an exception, unwinding the stack to a given frame
 */
function zThrow(state: GameState, returnVal: number, frameNum: number): void {
  state.logger.debug(
    `${hex(state.pc)} throw ${hex(returnVal)} ${hex(frameNum)}`
  );

  if (frameNum >= state.callstack.length) {
    throw new Error(`Invalid frame number ${frameNum} for throw operation`);
  }

  // Unwind the callstack to the specified frame
  state.callstack.splice(frameNum + 1);

  // Return with the specified value
  state.returnFromRoutine(returnVal);
}

/**
 * Export all call-related opcodes
 */
export const callOpcodes = {
  call_1s: opcode("call_1s", call_1s),
  call_1n: opcode("call_1n", call_1n),
  call_2s: opcode("call_2s", call_2s),
  call_2n: opcode("call_2n", call_2n),
  call_vs: opcode("call_vs", call_vs),
  call_vs2: opcode("call_vs2", call_vs2),
  call_vn: opcode("call_vn", call_vn),
  call_vn2: opcode("call_vn2", call_vn2),
  call: opcode("call", call),
  zCatch: opcode("catch", zCatch),
  zThrow: opcode("throw", zThrow),
};
