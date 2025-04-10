import { ZMachine } from "../../interpreter/ZMachine";
import { opcode } from "./base";
import { toI16 } from "../memory/cast16";

/**
 * Save the machine state to a given table
 */
function save_undo(machine: ZMachine): void {
  const resultVar = machine.getGameState().readByte();

  try {
    machine.saveUndo();
    machine.getGameState().storeVariable(resultVar, 1);
  } catch (error) {
    machine.logger.error(`Failed to save undo state: ${error}`);
    machine.getGameState().storeVariable(resultVar, 0);
  }
}

/**
 * Restore the machine state from the last save_undo
 */
function restore_undo(machine: ZMachine): void {
  const resultVar = machine.getGameState().readByte();

  try {
    const success = machine.restoreUndo();
    machine.getGameState().storeVariable(resultVar, success ? 2 : 0);
  } catch (error) {
    machine.logger.error(`Failed to restore undo state: ${error}`);
    machine.getGameState().storeVariable(resultVar, 0);
  }
}

/**
 * Save the current state to an external file
 * (Alternative version in V5+)
 */
function save_v5(machine: ZMachine, table: number, bytes: number, name: number): void {
  const resultVar = machine.getGameState().readByte();

  try {
    // Save to external storage
    const success = machine.saveToTable(table, bytes);
    machine.getGameState().storeVariable(resultVar, success ? 1 : 0);
  } catch (error) {
    machine.logger.error(`Failed to save: ${error}`);
    machine.getGameState().storeVariable(resultVar, 0);
  }
}

/**
 * Restore state from an external file
 * (Alternative version in V5+)
 */
function restore_v5(machine: ZMachine, table: number, bytes: number, name: number): void {
  const resultVar = machine.getGameState().readByte();

  try {
    // Restore from external storage
    const success = machine.restoreFromTable(table, bytes);
    machine.getGameState().storeVariable(resultVar, success ? 2 : 0);
  } catch (error) {
    machine.logger.error(`Failed to restore: ${error}`);
    machine.getGameState().storeVariable(resultVar, 0);
  }
}

/**
 * Reset flags after restoring a game
 */
function restore_undo(machine: ZMachine): void {
  const resultVar = machine.getGameState().readByte();

  try {
    const success = machine.restoreUndo();
    machine.getGameState().storeVariable(resultVar, success ? 2 : 0);
  } catch (error) {
    machine.logger.error(`Failed to restore undo: ${error}`);
    machine.getGameState().storeVariable(resultVar, 0);
  }
}

/**
 * Save the current game state (V5+ version)
 */
function save_v5(machine: ZMachine, ...args: number[]): void {
  const resultVar = machine.getGameState().readByte();

  try {
    // Save the game state
    const success = machine.saveGame();
    machine.getGameState().storeVariable(resultVar, success ? 1 : 0);
  } catch (error) {
    machine.logger.error(`Failed to save game: ${error}`);
    machine.getGameState().storeVariable(resultVar, 0);
  }
}

/**
 * Restore a saved game (V5+ version)
 */
function restore_v5(machine: ZMachine, ...args: number[]): void {
  const resultVar = machine.getGameState().readByte();

  try {
    // Restore the game state
    const success = machine.restoreGame();
    machine.getGameState().storeVariable(resultVar, success ? 2 : 0);
  } catch (error) {
    machine.logger.error(`Failed to restore game: ${error}`);
    machine.getGameState().storeVariable(resultVar, 0);
  }
}

/**
 * Restart the game from the beginning
 */
function restart(machine: ZMachine): void {
  machine.restart();
}

/**
 * Verify the game file checksum
 */
function verify(machine: ZMachine): void {
  const [offset, condfalse] = machine.getGameState().readBranchOffset();

  try {
    // In a real implementation, we would compute the checksum
    // For now, always return true
    const verified = true;
    machine.getGameState().doBranch(verified, condfalse, offset);
  } catch (error) {
    machine.logger.error(`Error verifying checksum: ${error}`);
    machine.getGameState().doBranch(false, condfalse, offset);
  }
}

/**
 * Test if the interpreter claims to provide the given feature
 */
function check_arg_count(machine: ZMachine, argNum: number): void {
  const [offset, condfalse] = machine.getGameState().readBranchOffset();

  // Check if the current routine was called with at least argNum arguments
  const argCount = machine.getGameState().getArgumentCount();
  machine.getGameState().doBranch(argCount >= argNum, condfalse, offset);
}

/**
 * Scan through a table looking for a particular word/byte
 */
function scan_table(
  machine: ZMachine,
  value: number,
  table: number,
  length: number,
  form: number = 0x82
): void {
  const resultVar = machine.getGameState().readByte();
  const [offset, condfalse] = machine.getGameState().readBranchOffset();

  machine.logger.debug(`scan_table ${value} ${table} ${length} ${form}`);

  // Determine if we're looking for a word or byte
  const isWord = (form & 0x80) !== 0;
  const elementSize = form & 0x7f;

  let found = false;
  let foundAddr = 0;

  // Scan the table
  for (let i = 0; i < length; i++) {
    const addr = table + i * elementSize;
    const tableValue = isWord
      ? machine.memory.getWord(addr)
      : machine.memory.getByte(addr);

    if (tableValue === value) {
      found = true;
      foundAddr = addr;
      break;
    }
  }

  if (found) {
    machine.getGameState().storeVariable(resultVar, foundAddr);
    machine.getGameState().doBranch(true, condfalse, offset);
  } else {
    machine.getGameState().storeVariable(resultVar, 0);
    machine.getGameState().doBranch(false, condfalse, offset);
  }
}

/**
 * Piracy check - always returns true (game is genuine)
 */
function piracy(machine: ZMachine): void {
  const [offset, condfalse] = machine.getGameState().readBranchOffset();

  // Always indicate the game is genuine
  machine.getGameState().doBranch(true, condfalse, offset);
}

/**
 * Export game operation opcodes
 */
export const gameOpcodes = {
  save_undo: opcode("save_undo", save_undo),
  restore_undo: opcode("restore_undo", restore_undo),
  restart: opcode("restart", restart),
  verify: opcode("verify", verify),
  check_arg_count: opcode("check_arg_count", check_arg_count),
  scan_table: opcode("scan_table", scan_table),
  piracy: opcode("piracy", piracy),
};
