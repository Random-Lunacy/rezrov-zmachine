/**
 * Z-machine opcode implementation
 *
 * This module defines the structure and utility functions for Z-machine opcodes.
 * Each opcode has a mnemonic and an implementation function that takes a ZMachine instance and operands.
 */
import { ZMachine } from '../../interpreter/ZMachine';

/**
 * Function signature for opcode implementations
 * Takes a ZMachine instance and variable number of operands
 */
export type OpcodeFn = (machine: ZMachine, ...operands: Array<number>) => void;

/**
 * Represents a Z-machine opcode with its mnemonic and implementation
 */
export type Opcode = {
  mnemonic: string;
  impl: OpcodeFn;
};

/**
 * Creates an opcode object with the given mnemonic and implementation
 * @param mnemonic The opcode's mnemonic name
 * @param impl The function that implements the opcode
 * @returns An Opcode object
 */
export function opcode(mnemonic: string, impl: OpcodeFn): Opcode {
  return { mnemonic, impl };
}

/**
 * Creates an opcode that throws an error when executed
 * @param mnemonic The opcode's mnemonic name
 * @returns An Opcode object that throws an error when executed
 */
export function unimplementedOpcode(mnemonic: string): Opcode {
  return opcode(mnemonic, () => {
    throw new Error(`Unimplemented opcode: ${mnemonic}`);
  });
}
