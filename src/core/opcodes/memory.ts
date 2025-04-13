/**
 * Memory opcodes
 *
 * This module contains the implementation of memory-related opcodes for the Z-Machine interpreter.
 *
 * Exported Opcodes:
 * - `copy_table`: Copy a region of memory
 * - `scan_table`: Scan through a table looking for a particular word/byte
 * - `loadw`: Loads a word from an array
 * - `loadb`: Loads a byte from an array
 * - `storew`: Stores a word in an array
 * - `storeb`: Stores a byte in an array
 */

import { ZMachine } from '../../interpreter/ZMachine';
import { opcode } from './base';

/**
 * Copy a region of memory
 */
function copy_table(machine: ZMachine, sourceAddr: number, destAddr: number, size: number): void {
  if (size === 0) {
    machine.logger.debug('copy_table: no-op');
    return; // No-op
  }

  const sourceSize = Math.abs(size);
  const sourceEnd = sourceAddr + sourceSize;

  machine.logger.debug(`copy_table ${sourceAddr} ${destAddr} ${size}`);

  if (destAddr === 0) {
    // Just check that source region is valid
    if (sourceAddr < 0 || sourceEnd > machine.memory.size) {
      throw new Error(`Invalid copy_table source range: ${sourceAddr}-${sourceEnd}`);
    }
    return;
  }

  if (size > 0) {
    // Positive size: normal copy
    machine.memory.copyBlock(sourceAddr, destAddr, size);
  } else {
    // Negative size: fill destination with zeros
    for (let i = 0; i < sourceSize; i++) {
      machine.memory.setByte(destAddr + i, 0);
    }
  }
}

/**
 * Scan through a table looking for a particular word/byte
 */
function scan_table(machine: ZMachine, value: number, table: number, length: number, form: number = 0x82): void {
  const resultVar = machine.state.readByte();
  const [offset, branchOnFalse] = machine.state.readBranchOffset();

  machine.logger.debug(`scan_table ${value} ${table} ${length} ${form}`);

  // Determine if we're looking for a word or byte
  const isWord = (form & 0x80) !== 0;
  const elementSize = form & 0x7f;

  machine.logger.debug(`scan_table: isWord=${isWord}, elementSize=${elementSize}`);

  let found = false;
  let foundAddr = 0;

  // Scan the table
  for (let i = 0; i < length; i++) {
    const addr = table + i * elementSize;
    const tableValue = isWord ? machine.memory.getWord(addr) : machine.memory.getByte(addr);

    if (tableValue === value) {
      found = true;
      foundAddr = addr;
      break;
    }
  }

  if (found) {
    machine.state.storeVariable(resultVar, foundAddr);
    machine.state.doBranch(true, branchOnFalse, offset);
  } else {
    machine.state.storeVariable(resultVar, 0);
    machine.state.doBranch(false, branchOnFalse, offset);
  }
}

/**
 * Loads a word from an array.
 */
function loadw(machine: ZMachine, array: number, wordIndex: number): void {
  const resultVar = machine.state.readByte();
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} loadw ${array} ${wordIndex} -> (${resultVar})`);

  const address = (array + 2 * wordIndex) & 0xffff;
  machine.state.storeVariable(resultVar, machine.memory.getWord(address));
}

/**
 * Loads a byte from an array.
 */
function loadb(machine: ZMachine, array: number, byteIndex: number): void {
  const resultVar = machine.state.readByte();
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} loadb ${array} ${byteIndex} -> (${resultVar})`);

  const address = (array + byteIndex) & 0xffff;
  machine.state.storeVariable(resultVar, machine.memory.getByte(address));
}

/**
 * Stores a word in an array.
 */
function storew(machine: ZMachine, array: number, wordIndex: number, value: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} storew ${array} ${wordIndex} ${value}`);

  const address = (array + 2 * wordIndex) & 0xffff;
  machine.memory.setWord(address, value);
}

/**
 * Stores a byte in an array.
 */
function storeb(machine: ZMachine, array: number, byteIndex: number, value: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} storeb ${array} ${byteIndex} ${value}`);

  const address = (array + byteIndex) & 0xffff;
  machine.memory.setByte(address, value & 0xff);
}

export const memoryOpcodes = {
  copy_table: opcode('copy_table', copy_table),
  scan_table: opcode('scan_table', scan_table),
  loadw: opcode('loadw', loadw),
  loadb: opcode('loadb', loadb),
  storew: opcode('storew', storew),
  storeb: opcode('storeb', storeb),
};
