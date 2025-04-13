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
function save_undo(machine: ZMachine): void {
  const resultVar = machine.state.readByte();

  machine.logger.debug(`${machine.executor.op_pc.toString(16)} save_undo ${resultVar}`);

  try {
    machine.saveUndo();
    machine.state.storeVariable(resultVar, 1);
  } catch (error) {
    machine.logger.error(`Failed to save undo state: ${error}`);
    machine.state.storeVariable(resultVar, 0);
  }
}

/**
 * Restore the machine state from the last save_undo
 */
function restore_undo(machine: ZMachine): void {
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
  machine.state.logger.debug(`${machine.executor.op_pc.toString(16)} restart`);
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

function save(machine: ZMachine, table: number, bytes: number, name: number = 0, prompt: number = -1): void {
  // For Version 5 and later, use the extended format
  if (machine.state.version >= 5) {
    const resultVar = machine.state.readByte();

    machine.logger.debug(`${machine.executor.op_pc.toString(16)} save (ext) ${table} ${bytes} ${name} ${prompt}`);

    try {
      // If prompt parameter is provided and is 0, don't prompt
      // If prompt is 1 or not provided (or -1 in our case), prompt behavior is determined by the interpreter
      const shouldPrompt = prompt === -1 || prompt === 1;

      // This would need to save the table data to a file
      const success = machine.saveToTable(table, bytes, name, shouldPrompt);

      // Store the result (1 for success, 0 for failure)
      machine.state.storeVariable(resultVar, success ? 1 : 0);
    } catch (error) {
      machine.logger.error(`Failed to save: ${error}`);
      machine.state.storeVariable(resultVar, 0);
    }
  } else {
    // For earlier versions, use the branch format
    const [offset, branchOnFalse] = machine.state.readBranchOffset();

    machine.logger.debug(`${machine.executor.op_pc.toString(16)} save -> [${!branchOnFalse}] ${offset}`);

    const saved = machine.saveGame();
    machine.state.doBranch(saved, branchOnFalse, offset);
  }
}

function restore(machine: ZMachine, table: number, bytes: number, name: number = 0, prompt: number = -1): void {
  // For Version 5 and later, use the extended format
  if (machine.state.version >= 5) {
    const resultVar = machine.state.readByte();

    machine.logger.debug(`${machine.executor.op_pc.toString(16)} restore (ext) ${table} ${bytes} ${name} ${prompt}`);

    try {
      // If prompt parameter is provided and is 0, don't prompt
      // If prompt is 1 or not provided (or -1 in our case), prompt behavior is determined by the interpreter
      const shouldPrompt = prompt === -1 || prompt === 1;

      // This would need to restore the table data from a file
      const success = machine.restoreFromTable(table, bytes, name, shouldPrompt);

      // Store the result (2 for success after restoring, 0 for failure)
      machine.state.storeVariable(resultVar, success ? 2 : 0);
    } catch (error) {
      machine.logger.error(`Failed to restore: ${error}`);
      machine.state.storeVariable(resultVar, 0);
    }
  } else {
    // For earlier versions, use the branch format
    const [offset, branchOnFalse] = machine.state.readBranchOffset();

    machine.logger.debug(`${machine.executor.op_pc.toString(16)} restore -> [${!branchOnFalse}] ${offset}`);

    const restored = machine.restoreGame();
    machine.state.doBranch(restored, branchOnFalse, offset);
  }
}

/**
 * Quit the game
 */
function quit(machine: ZMachine): void {
  machine.state.logger.debug(`${machine.executor.op_pc.toString(16)} quit`);
  machine.quit();
}

/**
 * Update the status bar (for versions <= 3)
 */
function show_status(machine: ZMachine): void {
  machine.state.logger.debug(`${machine.executor.op_pc.toString(16)} show_status`);
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
