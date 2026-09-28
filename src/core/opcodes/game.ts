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
 * Get the current PC safely for logging
 */
function getSafePcHex(machine: ZMachine): string {
  const pc = machine.executor?.op_pc ?? machine.state.pc;
  return typeof pc === 'number' ? pc.toString(16) : '0';
}

/**
 * Save the machine state to memory for a later restore_undo (V5+).
 *
 * The snapshot is taken before the store byte is read, so the saved PC points at it.
 * A later restore_undo resumes there and completes this instruction with 2 ("restored").
 */
async function save_undo(machine: ZMachine, _operandTypes: OperandType[]): Promise<void> {
  let saved = false;
  try {
    saved = machine.saveUndo();
  } catch (error) {
    machine.logger.error(`Failed to save undo state: ${error}`);
  }

  const resultVar = machine.state.readByte();
  machine.logger.debug(`${getSafePcHex(machine)} save_undo ${resultVar}`);
  machine.state.storeVariable(resultVar, saved ? 1 : 0);
}

/**
 * Restore the machine state from the last save_undo
 */
async function restore_undo(machine: ZMachine, _operandTypes: OperandType[]): Promise<void> {
  const resultVar = machine.state.readByte();
  machine.logger.debug(`${getSafePcHex(machine)} restore_undo ${resultVar}`);

  let restored = false;
  try {
    restored = machine.restoreUndo();
  } catch (error) {
    machine.logger.error(`Failed to restore undo state: ${error}`);
  }

  if (restored) {
    // Execution is back at save_undo's store byte: complete that instruction with 2
    machine.state.storeVariable(machine.state.readByte(), 2);
  } else {
    machine.state.storeVariable(resultVar, 0);
  }
}

/**
 * Restart the game from the beginning
 */
function restart(machine: ZMachine, _operandTypes: OperandType[]): void {
  machine.logger.debug(`${getSafePcHex(machine)} restart`);
  machine.restart();
}

/**
 * Verify the game file checksum.
 * Sums all bytes from offset 64 to the file length, then compares
 * (mod 65536) against the checksum stored in the header at 0x1C.
 */
function verify(machine: ZMachine, _operandTypes: OperandType[]): void {
  const [offset, branchOnFalse] = machine.state.readBranchOffset();

  machine.logger.debug(`${getSafePcHex(machine)} verify -> [${!branchOnFalse}] ${offset}`);

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

  machine.logger.debug(`${getSafePcHex(machine)} piracy -> [${!branchOnFalse}] ${offset}`);

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
  const version = machine.state.version;

  if (version >= 5 && operandTypes.length > 0) {
    // Partial save: write memory region to auxiliary file (no game state)
    const resultVar = machine.state.readByte();
    const shouldPrompt = prompt === -1 || prompt === 1;
    machine.logger.debug(`${getSafePcHex(machine)} save (partial) table=${table} bytes=${bytes} name=${name}`);
    try {
      const success = await machine.saveAuxiliary(table, bytes, name, shouldPrompt);
      machine.state.storeVariable(resultVar, success ? 1 : 0);
    } catch (error) {
      machine.logger.error(`Failed to save auxiliary data: ${error}`);
      machine.state.storeVariable(resultVar, 0);
    }
    return;
  }

  // Full save. Snapshot first, while the PC still points at this instruction's store byte (V4+)
  // or branch data (V1-3): that is the PC Quetzal records, and a later restore resumes there to
  // complete this instruction as "restored" (spec §15 save; Frotz does the same).
  machine.logger.debug(`${getSafePcHex(machine)} save (standard)`);
  let saved = false;
  try {
    saved = await machine.saveGame();
  } catch (error) {
    machine.logger.error(`Failed to save game: ${error}`);
  }

  if (version >= 4) {
    machine.state.storeVariable(machine.state.readByte(), saved ? 1 : 0);
  } else {
    const [offset, branchOnFalse] = machine.state.readBranchOffset();
    machine.state.doBranch(saved, branchOnFalse, offset);
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
  const version = machine.state.version;

  if (version >= 5 && operandTypes.length > 0) {
    // Partial restore: read memory region from auxiliary file (no game state)
    const resultVar = machine.state.readByte();
    const shouldPrompt = prompt === -1 || prompt === 1;
    machine.logger.debug(`${getSafePcHex(machine)} restore (partial) table=${table} bytes=${bytes} name=${name}`);
    try {
      const bytesRead = await machine.restoreAuxiliary(table, bytes, name, shouldPrompt);
      machine.state.storeVariable(resultVar, bytesRead);
    } catch (error) {
      machine.logger.error(`Failed to restore auxiliary data: ${error}`);
      machine.state.storeVariable(resultVar, 0);
    }
    return;
  }

  // Full restore. This instruction's own store/branch is only used if the restore fails.
  machine.logger.debug(`${getSafePcHex(machine)} restore (standard)`);
  const resultVar = version >= 4 ? machine.state.readByte() : 0;
  const branch = version >= 4 ? null : machine.state.readBranchOffset();

  let restored = false;
  try {
    restored = await machine.restoreGame();
  } catch (error) {
    machine.logger.error(`Failed to restore game: ${error}`);
  }

  if (restored) {
    // Execution is back at the saving instruction's store byte or branch data: complete it
    // with 2 ("restored"), or a taken branch in V1-3
    if (version >= 4) {
      machine.state.storeVariable(machine.state.readByte(), 2);
    } else {
      const [offset, branchOnFalse] = machine.state.readBranchOffset();
      machine.state.doBranch(true, branchOnFalse, offset);
    }
  } else if (branch) {
    machine.state.doBranch(false, branch[1], branch[0]);
  } else {
    machine.state.storeVariable(resultVar, 0);
  }
}

/**
 * Quit the game
 */
function quit(machine: ZMachine, _operandTypes: OperandType[]): void {
  machine.logger.debug(`${getSafePcHex(machine)} quit`);
  machine.quit();
}

/**
 * Update the status bar (for versions <= 3)
 */
function show_status(machine: ZMachine, _operandTypes: OperandType[]): void {
  machine.logger.debug(`${getSafePcHex(machine)} show_status`);
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
