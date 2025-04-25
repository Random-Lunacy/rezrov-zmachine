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
import { opcode } from './base';

/**
 * Save the machine state to a given table
 */
async function save_undo(machine: ZMachine): Promise<void> {
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
async function restore_undo(machine: ZMachine): Promise<void> {
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
function restart(machine: ZMachine): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} restart`);
  machine.restart();
}

/**
 * Verify the game file checksum
 */
function verify(machine: ZMachine): void {
  const [offset, branchOnFalse] = machine.state.readBranchOffset();

  machine.logger.debug(`${machine.executor.op_pc.toString(16)} verify -> [${!branchOnFalse}] ${offset}`);

  try {
    // In a real implementation, we would compute the checksum
    // For now, always return true
    const verified = true;
    machine.state.doBranch(verified, branchOnFalse, offset);
  } catch (error) {
    machine.logger.error(`Error verifying checksum: ${error}`);
    machine.state.doBranch(false, branchOnFalse, offset);
  }
}

/**
 * Piracy check - always returns true (game is genuine)
 */
function piracy(machine: ZMachine): void {
  const [offset, branchOnFalse] = machine.state.readBranchOffset();

  machine.logger.debug(`${machine.executor.op_pc.toString(16)} piracy -> [${!branchOnFalse}] ${offset}`);

  // Always indicate the game is genuine
  machine.state.doBranch(true, branchOnFalse, offset);
}

async function save(
  machine: ZMachine,
  table: number,
  bytes: number,
  name: number = 0,
  prompt: number = -1
): Promise<void> {
  if (machine.state.version >= 5) {
    const resultVar = machine.state.readByte();
    machine.logger.debug(`${machine.executor.op_pc.toString(16)} save (ext) ${table} ${bytes} ${name} ${prompt}`);

    try {
      const shouldPrompt = prompt === -1 || prompt === 1;
      const success = await machine.saveToTable(table, bytes, name, shouldPrompt);
      machine.state.storeVariable(resultVar, success ? 1 : 0);
    } catch (error) {
      machine.logger.error(`Failed to save: ${error}`);
      machine.state.storeVariable(resultVar, 0);
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
  table: number,
  bytes: number,
  name: number = 0,
  prompt: number = -1
): Promise<void> {
  if (machine.state.version >= 5) {
    const resultVar = machine.state.readByte();
    machine.logger.debug(`${machine.executor.op_pc.toString(16)} restore (ext) ${table} ${bytes} ${name} ${prompt}`);

    try {
      const shouldPrompt = prompt === -1 || prompt === 1;
      const success = await machine.restoreFromTable(table, bytes, name, shouldPrompt);
      machine.state.storeVariable(resultVar, success ? 2 : 0);
    } catch (error) {
      machine.logger.error(`Failed to restore: ${error}`);
      machine.state.storeVariable(resultVar, 0);
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
function quit(machine: ZMachine): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} quit`);
  machine.quit();
}

/**
 * Update the status bar (for versions <= 3)
 */
function show_status(machine: ZMachine): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} show_status`);
  machine.state.updateStatusBar();
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
