/**
 * Game operation opcodes
 * These opcodes provide functionality for saving and restoring game state,
 * as well as handling piracy checks and other game-specific operations.
 *
 * Exported Opcodes:
 * - `save_undo`: Saves the current state for undo operations.
 * - `restore_undo`: Restores the last saved state.
 * - `restart`: Restarts the game from the beginning.
 * - `verify`: Verifies the game file checksum.
 * - `piracy`: Performs a piracy check (always returns true).
 * - `save`: Saves the game state to a specified table.
 * - `restore`: Restores the game state from a specified table.
 * - `quit`: Quits the game.
 * - `show_status`: Updates the status bar (for versions <= 3).
 */
import { ZMachine } from '../../interpreter/ZMachine';
import { OperandType } from '../../types';
import { HeaderLocation } from '../../utils/constants';
import { opcode } from './base';

/**
 * Save the machine state to a given table
 */
async function save_undo(machine: ZMachine, _operandTypes: OperandType[]): Promise<void> {
  const resultVar = machine.state.readByte();
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} save_undo ${resultVar}`);

  try {
    const success = machine.saveUndo();
    machine.state.storeVariable(resultVar, success ? 1 : 0);
  } catch (error) {
    machine.logger.error(`Failed to save undo state: ${error}`);
    machine.state.storeVariable(resultVar, 0);
  }
}

/**
 * Restore the machine state from the last save_undo
 */
async function restore_undo(machine: ZMachine, _operandTypes: OperandType[]): Promise<void> {
  const resultVar = machine.state.readByte();
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} restore_undo ${resultVar}`);

  try {
    const success = machine.restoreUndo();
    machine.state.storeVariable(resultVar, success ? 2 : 0);
  } catch (error) {
    machine.logger.error(`Failed to restore undo state: ${error}`);
    machine.state.storeVariable(resultVar, 0);
  }
}

/**
 * Restart the game from the beginning
 */
function restart(machine: ZMachine, _operandTypes: OperandType[]): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} restart`);
  machine.restart();
}

/**
 * Verify the game file checksum.
 * Sums all bytes from offset 64 to the file length, then compares
 * (mod 65536) against the checksum stored in the header at 0x1C.
 */
function verify(machine: ZMachine, _operandTypes: OperandType[]): void {
  const [offset, branchOnFalse] = machine.state.readBranchOffset();

  machine.logger.debug(`${machine.executor.op_pc.toString(16)} verify -> [${!branchOnFalse}] ${offset}`);

  const buffer = machine.originalStory;
  const version = machine.state.version;

  // File length from header at 0x1A is packed (Z-spec §11.1.6)
  const rawLength = buffer.readUInt16BE(HeaderLocation.FileLength);
  let fileLength: number;
  if (version <= 3) {
    fileLength = rawLength * 2;
  } else if (version <= 5) {
    fileLength = rawLength * 4;
  } else {
    fileLength = rawLength * 8;
  }

  // Clamp to actual buffer size
  const endByte = Math.min(fileLength, buffer.length);

  // Sum all bytes from offset 64 to file length
  let checksum = 0;
  for (let i = 64; i < endByte; i++) {
    checksum = (checksum + buffer[i]) & 0xffff;
  }

  const expectedChecksum = buffer.readUInt16BE(HeaderLocation.Checksum);
  const verified = checksum === expectedChecksum;

  machine.logger.debug(
    `verify: computed=${checksum.toString(16)}, expected=${expectedChecksum.toString(16)}, match=${verified}`
  );
  machine.state.doBranch(verified, branchOnFalse, offset);
}

/**
 * Piracy check - always returns true (game is genuine)
 */
function piracy(machine: ZMachine, _operandTypes: OperandType[]): void {
  const [offset, branchOnFalse] = machine.state.readBranchOffset();

  machine.logger.debug(`${machine.executor.op_pc.toString(16)} piracy -> [${!branchOnFalse}] ${offset}`);

  // Always indicate the game is genuine
  machine.state.doBranch(true, branchOnFalse, offset);
}

async function save(
  machine: ZMachine,
  operandTypes: OperandType[],
  table: number,
  bytes: number,
  name: number = 0,
  prompt: number = -1
): Promise<void> {
  if (machine.state.version >= 5) {
    const resultVar = machine.state.readByte();
    const shouldPrompt = prompt === -1 || prompt === 1;
    const isPartial = operandTypes.length > 0;

    if (isPartial) {
      // Partial save: write memory region to auxiliary file (no game state)
      machine.logger.debug(
        `${machine.executor.op_pc.toString(16)} save (partial) table=${table} bytes=${bytes} name=${name}`
      );
      try {
        const success = await machine.saveAuxiliary(table, bytes, name, shouldPrompt);
        machine.state.storeVariable(resultVar, success ? 1 : 0);
      } catch (error) {
        machine.logger.error(`Failed to save auxiliary data: ${error}`);
        machine.state.storeVariable(resultVar, 0);
      }
    } else {
      // Standard save: full game state
      machine.logger.debug(`${machine.executor.op_pc.toString(16)} save (standard)`);
      try {
        const success = await machine.saveGame();
        machine.state.storeVariable(resultVar, success ? 1 : 0);
      } catch (error) {
        machine.logger.error(`Failed to save: ${error}`);
        machine.state.storeVariable(resultVar, 0);
      }
    }
  } else {
    const [offset, branchOnFalse] = machine.state.readBranchOffset();
    machine.logger.debug(`${machine.executor.op_pc.toString(16)} save -> [${!branchOnFalse}] ${offset}`);

    try {
      const saved = await machine.saveGame();
      machine.state.doBranch(saved, branchOnFalse, offset);
    } catch (error) {
      machine.logger.error(`Failed to save game: ${error}`);
      machine.state.doBranch(false, branchOnFalse, offset);
    }
  }
}

async function restore(
  machine: ZMachine,
  operandTypes: OperandType[],
  table: number,
  bytes: number,
  name: number = 0,
  prompt: number = -1
): Promise<void> {
  if (machine.state.version >= 5) {
    const resultVar = machine.state.readByte();
    const shouldPrompt = prompt === -1 || prompt === 1;
    const isPartial = operandTypes.length > 0;

    if (isPartial) {
      // Partial restore: read memory region from auxiliary file (no game state)
      machine.logger.debug(
        `${machine.executor.op_pc.toString(16)} restore (partial) table=${table} bytes=${bytes} name=${name}`
      );
      try {
        const bytesRead = await machine.restoreAuxiliary(table, bytes, name, shouldPrompt);
        machine.state.storeVariable(resultVar, bytesRead);
      } catch (error) {
        machine.logger.error(`Failed to restore auxiliary data: ${error}`);
        machine.state.storeVariable(resultVar, 0);
      }
    } else {
      // Standard restore: full game state
      machine.logger.debug(`${machine.executor.op_pc.toString(16)} restore (standard)`);
      try {
        const success = await machine.restoreGame();
        machine.state.storeVariable(resultVar, success ? 2 : 0);
      } catch (error) {
        machine.logger.error(`Failed to restore: ${error}`);
        machine.state.storeVariable(resultVar, 0);
      }
    }
  } else {
    const [offset, branchOnFalse] = machine.state.readBranchOffset();
    machine.logger.debug(`${machine.executor.op_pc.toString(16)} restore -> [${!branchOnFalse}] ${offset}`);

    try {
      const restored = await machine.restoreGame();
      machine.state.doBranch(restored, branchOnFalse, offset);
    } catch (error) {
      machine.logger.error(`Failed to restore game: ${error}`);
      machine.state.doBranch(false, branchOnFalse, offset);
    }
  }
}

/**
 * Quit the game
 */
function quit(machine: ZMachine, _operandTypes: OperandType[]): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} quit`);
  machine.quit();
}

/**
 * Update the status bar (for versions <= 3)
 */
function show_status(machine: ZMachine, _operandTypes: OperandType[]): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} show_status`);
  machine.updateStatusBar();
}

/**
 * Export game operation opcodes
 */
export const gameOpcodes = {
  save_undo: opcode('save_undo', save_undo),
  restore_undo: opcode('restore_undo', restore_undo),
  restart: opcode('restart', restart),
  verify: opcode('verify', verify),
  piracy: opcode('piracy', piracy),
  save: opcode('save', save),
  restore: opcode('restore', restore),
  quit: opcode('quit', quit),
  show_status: opcode('show_status', show_status),
};
