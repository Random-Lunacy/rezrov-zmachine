/**
 * Collection of call-related opcodes for the Z-Machine interpreter.
 * These opcodes handle routine calls with varying numbers of arguments,
 * as well as stack manipulation for exception handling.
 *
 * Exported opcodes:
 * - `call_1s`: Calls a routine with 1 argument and stores the result.
 * - `call_1n`: Calls a routine with 1 argument without storing the result.
 * - `call_2s`: Calls a routine with 2 arguments and stores the result.
 * - `call_2n`: Calls a routine with 2 arguments without storing the result.
 * - `call_vs`: Calls a routine with a variable number of arguments and stores the result.
 * - `call_vs2`: Calls a routine with a variable number of arguments (minimum 2) and stores the result.
 * - `call_vn`: Calls a routine with a variable number of arguments without storing the result.
 * - `call_vn2`: Calls a routine with a variable number of arguments (minimum 2) without storing the result.
 * - `call`: General-purpose call opcode for routines with variable arguments, storing the result.
 * - `catch`: Stores the current callstack frame for use with exception handling.
 * - `throw`: Throws an exception, unwinding the stack to a specified frame.
 */
import { ZMachine } from '../../interpreter/ZMachine';
import { OperandType } from '../../types';
import { hex } from '../../utils/debug';
import { opcode } from './base';

/**
 * Call a routine with 1 argument, storing the result
 */
function call_1s(machine: ZMachine, _operandTypes: OperandType[], routine: number): void {
  const resultVar = machine.state.readByte();

  machine.logger.debug(`${hex(machine.state.pc)} call_1s ${hex(routine)} -> (${hex(resultVar)})`);

  const unpackedAddress = validateAndUnpackRoutine(machine, routine);
  if (routine === 0) {
    machine.state.storeVariable(resultVar, 0);
    return;
  }

  machine.state.callRoutine(unpackedAddress, resultVar);
}

/**
 * Call a routine with 1 argument, not storing the result
 */
function call_1n(machine: ZMachine, _operandTypes: OperandType[], routine: number): void {
  machine.logger.debug(`${hex(machine.state.pc)} call_1n ${hex(routine)}`);

  const unpackedAddress = validateAndUnpackRoutine(machine, routine);

  if (routine === 0) {
    // No-op for routine 0
    return;
  }

  machine.state.callRoutine(unpackedAddress, null);
}

/**
 * Call a routine with 2 arguments, storing the result
 */
function call_2s(machine: ZMachine, _operandTypes: OperandType[], routine: number, arg1: number): void {
  const resultVar = machine.state.readByte();
  machine.logger.debug(`${hex(machine.state.pc)} call_2s ${hex(routine)} -> (${hex(resultVar)})`);

  const unpackedAddress = validateAndUnpackRoutine(machine, routine);

  if (routine === 0) {
    machine.state.storeVariable(resultVar, 0);
    return;
  }

  machine.state.callRoutine(unpackedAddress, resultVar, arg1);
}

/**
 * Call a routine with 2 arguments, not storing the result
 */
function call_2n(machine: ZMachine, _operandTypes: OperandType[], routine: number, arg1: number): void {
  machine.logger.debug(`${hex(machine.state.pc)} call_2n ${hex(routine)}`);

  const unpackedAddress = validateAndUnpackRoutine(machine, routine);

  if (routine === 0) {
    // No-op for routine 0
    return;
  }

  machine.state.callRoutine(unpackedAddress, null, arg1);
}

/**
 * Call a routine with variable number of arguments, storing the result.
 * 'call' in v1-3 and 'call_vs' in v4+. Functionality is the same.
 */
function call_vs(machine: ZMachine, _operandTypes: OperandType[], routine: number, ...args: Array<number>): void {
  const resultVar = machine.state.readByte();
  machine.logger.debug(`${hex(machine.state.pc)} call_vs ${hex(routine)} -> (${hex(resultVar)})`);

  const unpackedAddress = validateAndUnpackRoutine(machine, routine);

  if (routine === 0) {
    machine.state.storeVariable(resultVar, 0);
    return;
  }

  machine.state.callRoutine(unpackedAddress, resultVar, ...args);
}

/**
 * Call a routine with variable number of arguments, but specifically 2 at minimum (VAR form)
 */
function call_vs2(machine: ZMachine, _operandTypes: OperandType[], routine: number, ...args: Array<number>): void {
  const resultVar = machine.state.readByte();
  machine.logger.debug(`${hex(machine.state.pc)} call_vs2 ${hex(routine)} -> (${hex(resultVar)})`);

  const unpackedAddress = validateAndUnpackRoutine(machine, routine);

  if (routine === 0) {
    machine.state.storeVariable(resultVar, 0);
    return;
  }

  machine.state.callRoutine(unpackedAddress, resultVar, ...args);
}

/**
 * Call a routine with variable number of arguments, not storing the result
 */
function call_vn(machine: ZMachine, _operandTypes: OperandType[], routine: number, ...args: Array<number>): void {
  machine.logger.debug(`${hex(machine.state.pc)} call_vn ${hex(routine)}`);

  const unpackedAddress = validateAndUnpackRoutine(machine, routine);

  if (routine === 0) {
    // No-op for routine 0
    return;
  }

  machine.state.callRoutine(unpackedAddress, null, ...args);
}

/**
 * Call a routine with variable number of arguments, but specifically 2 at minimum, not storing the result
 */
function call_vn2(machine: ZMachine, _operandTypes: OperandType[], routine: number, ...args: Array<number>): void {
  machine.logger.debug(`${hex(machine.state.pc)} call_vn2 ${hex(routine)}`);

  const unpackedAddress = validateAndUnpackRoutine(machine, routine);

  if (routine === 0) {
    // No-op for routine 0
    return;
  }

  machine.state.callRoutine(unpackedAddress, null, ...args);
}

/**
 * Store the return addresses for the current callstack frame, to be used by catch/throw
 */
function zCatch(machine: ZMachine): void {
  const resultVar = machine.state.readByte();
  machine.logger.debug(`${hex(machine.state.pc)} catch -> (${hex(resultVar)})`);
  machine.state.storeVariable(resultVar, machine.state.callstack.length - 1);
}

/**
 * Throw an exception, unwinding the stack to a given frame
 */
function zThrow(machine: ZMachine, _operandTypes: OperandType[], returnVal: number, frameNum: number): void {
  machine.logger.debug(`${hex(machine.state.pc)} throw ${hex(returnVal)} ${hex(frameNum)}`);

  if (frameNum >= machine.state.callstack.length) {
    throw new Error(`Invalid frame number ${frameNum} for throw operation`);
  }

  // Unwind the callstack to the specified frame
  machine.state.callstack.splice(frameNum + 1);

  // Return with the specified value
  machine.state.returnFromRoutine(returnVal);
}

/**
 * Helper function to validate and unpack routine addresses
 * Used by all call opcodes to ensure consistent behavior
 *
 * @param machine The Z-Machine instance
 * @param routine The packed routine address
 * @returns The unpacked address, 0 for routine 0 (which is a no-op),or -1 for invalid addresses
 */
function validateAndUnpackRoutine(machine: ZMachine, routine: number): number {
  if (routine === 0) {
    return 0;
  }

  try {
    const unpackedAddress = machine.memory.unpackRoutineAddress(routine);

    // Explicitly log each validation step
    machine.logger.debug(`Validating routine: ${hex(routine)}, Unpacked Address: ${hex(unpackedAddress)}`);

    // Valid routine address check
    if (!machine.memory.isValidRoutineAddress(unpackedAddress)) {
      machine.logger.error(`Routine address not in valid memory: ${hex(unpackedAddress)}`);
      throw new Error(`Invalid routine address or header: ${hex(routine)} (not in valid memory)`);
    }

    // Alignment check
    if (!machine.memory.checkPackedAddressAlignment(unpackedAddress, true)) {
      machine.logger.error(`Routine address not properly aligned: ${hex(unpackedAddress)}`);
      throw new Error(`Invalid routine address or header: ${hex(routine)} (not properly aligned)`);
    }

    // Header validation
    if (!machine.state.memory.validateRoutineHeader(unpackedAddress)) {
      machine.logger.error(`Invalid routine header at address: ${hex(unpackedAddress)}`);
      throw new Error(`Invalid routine address or header: ${hex(routine)} (invalid header)`);
    }

    return unpackedAddress;
  } catch (e) {
    machine.logger.error(`Error unpacking or validating routine address: ${e}`);
    throw new Error(`Invalid routine address or header: ${hex(routine)}`);
  }
}

/**
 * Export all call-related opcodes
 */
export const callOpcodes = {
  call_1n: opcode('call_1n', call_1n),
  call_1s: opcode('call_1s', call_1s),
  call_2n: opcode('call_2n', call_2n),
  call_2s: opcode('call_2s', call_2s),
  call_vn: opcode('call_vn', call_vn),
  call_vn2: opcode('call_vn2', call_vn2),
  call_vs: opcode('call_vs', call_vs),
  call_vs2: opcode('call_vs2', call_vs2),
  Catch: opcode('catch', zCatch), // 'catch' is a reserved word
  Throw: opcode('throw', zThrow), // 'throw' is a reserved word
};
