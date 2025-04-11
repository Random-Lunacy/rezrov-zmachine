import { ZMachine } from "../../interpreter/ZMachine";
import { opcode } from "./base";
import { SuspendState, InputState } from "../../core/execution/SuspendState";

/**
 * Update the status bar (for versions <= 3)
 */
function show_status(machine: ZMachine): void {
  machine.state.updateStatusBar();
}

/**
 * Split the screen into two windows
 */
function split_window(machine: ZMachine, lines: number): void {
  machine.screen.splitWindow(machine, lines);
}

/**
 * Set the active output window
 */
function set_window(machine: ZMachine, window: number): void {
  machine.screen.setOutputWindow(machine, window);
}

/**
 * Clear a window
 */
function erase_window(machine: ZMachine, window: number): void {
  machine.screen.clearWindow(machine, window);
}

/**
 * Clear the current line
 */
function erase_line(machine: ZMachine, value: number): void {
  machine.screen.clearLine(machine, value);
}

/**
 * Set the cursor position
 */
function set_cursor(
  machine: ZMachine,
  line: number,
  column: number,
  window: number = 0
): void {
  if (machine.state.version >= 6) {
    if (line === -1) {
      machine.screen.hideCursor(machine, window);
      return;
    }
    if (line === -2) {
      machine.screen.showCursor(machine, window);
      return;
    }
  }

  if (machine.state.version < 6) {
    window = machine.screen.getOutputWindow(machine);
  }

  machine.screen.setCursorPosition(machine, line, column, window);
}

/**
 * Get the current cursor position
 */
function get_cursor(machine: ZMachine, array: number): void {
  machine.logger.warn(`get_cursor ${array} -- not implemented`);
}

/**
 * Set the text style
 */
function set_text_style(machine: ZMachine, style: number): void {
  machine.screen.setTextStyle(machine, style);
}

/**
 * Set buffer mode (buffered or unbuffered output)
 */
function buffer_mode(machine: ZMachine, flag: number): void {
  machine.screen.setBufferMode(machine, flag);
}

/**
 * Enable or disable an output stream
 */
function output_stream(
  machine: ZMachine,
  streamNum: number,
  table: number = 0,
  width: number = 0
): void {
  const streamNumber = machine.toI16(streamNum);
  if (streamNumber === 0) {
    // why emit this opcode at all?
    return;
  }
  if (streamNumber > 0) {
    machine.screen.enableOutputStream(machine, streamNumber, table, width);
    return;
  }
  machine.screen.disableOutputStream(machine, -streamNumber, table, width);
}

/**
 * Select an input stream
 */
function input_stream(machine: ZMachine, streamNum: number): void {
  machine.screen.selectInputStream(machine, machine.toI16(streamNum));
}

/**
 * Read a line of input from the user
 */
function sread(
  machine: ZMachine,
  textBuffer: number,
  parseBuffer: number,
  time: number = 0,
  routine: number = 0
): void {
  let resultVar = 0;

  if (machine.state.version >= 5) {
    resultVar = machine.state.readByte();
  }

  const max_input = machine.memory.getByte(textBuffer) + 1;
  machine.logger.debug(
    `sread max_input=${max_input}, text=${textBuffer}, parse=${parseBuffer}, time=${time}, routine=${routine}`
  );

  machine.state.updateStatusBar();

  // Suspend execution until user input is received
  throw new SuspendState({
    keyPress: false,
    textBuffer,
    parseBuffer,
    time,
    routine,
    resultVar,
  });
}

/**
 * Play a sound effect
 */
function sound_effect(
  machine: ZMachine,
  number: number,
  effect: number = 0,
  volume: number = 0,
  routine: number = 0
): void {
  machine.logger.warn(`sound_effect ${number} -- not implemented`);
}

/**
 * Read a single character from the user
 */
function read_char(
  machine: ZMachine,
  device: number = 0,
  time: number = 0,
  routine: number = 0
): void {
  const resultVar = machine.state.readByte();
  throw new SuspendState({
    keyPress: true,
    resultVar,
    time,
    routine,
  });
}

/**
 * Save the current game state
 */
function save(machine: ZMachine): void {
  const [offset, condfalse] = machine.state.readBranchOffset();

  const saved = machine.saveGame();
  if (machine.state.version < 5) {
    machine.state.doBranch(saved, condfalse, offset);
  } else {
    throw new Error("unimplemented save for version 5+");
  }
}

/**
 * Restore a saved game state
 */
function restore(machine: ZMachine): void {
  const [offset, condfalse] = machine.state.readBranchOffset();

  const restored = machine.restoreGame();
  if (machine.state.version < 5) {
    machine.state.doBranch(restored, condfalse, offset);
  } else {
    throw new Error("unimplemented restore for version 5+");
  }
}

/**
 * Quit the game
 */
function quit(machine: ZMachine): void {
  machine.quit();
}

/**
 * Verify the game file checksum
 */
function verify(machine: ZMachine): void {
  const [offset, condfalse] = machine.state.readBranchOffset();
  // We assume verification always succeeds
  machine.state.doBranch(true, condfalse, offset);
}

/**
 * Set the foreground and background colors
 */
function set_color(
  machine: ZMachine,
  foreground: number,
  background: number,
  window: number = 0
): void {
  if (machine.state.version <= 5) {
    window = 0;
  }
  // Flush any buffered text before changing colors
  machine.screen.setTextColors(machine, window, foreground, background);
}

/**
 * Generate a random number
 */
function random(machine: ZMachine, range: number): void {
  const resultVar = machine.getGameState().readByte();

  if (range <= 0) {
    // Reseed the RNG
    machine.reseedRandom(range);
    machine.getGameState().storeVariable(resultVar, 0);
  } else {
    // Generate a random number between 1 and range
    const value = machine.getRandomInt(range);
    machine.getGameState().storeVariable(resultVar, value);
  }
}

/**
 * Export all I/O opcodes
 */
export const ioOpcodes = {
  show_status: opcode("show_status", show_status),
  split_window: opcode("split_window", split_window),
  set_window: opcode("set_window", set_window),
  erase_window: opcode("erase_window", erase_window),
  erase_line: opcode("erase_line", erase_line),
  set_cursor: opcode("set_cursor", set_cursor),
  get_cursor: opcode("get_cursor", get_cursor),
  set_text_style: opcode("set_text_style", set_text_style),
  buffer_mode: opcode("buffer_mode", buffer_mode),
  output_stream: opcode("output_stream", output_stream),
  input_stream: opcode("input_stream", input_stream),
  sread: opcode("sread", sread),
  sound_effect: opcode("sound_effect", sound_effect),
  read_char: opcode("read_char", read_char),
  save: opcode("save", save),
  restore: opcode("restore", restore),
  quit: opcode("quit", quit),
  verify: opcode("verify", verify),
  set_color: opcode("set_color", set_color),
  random: opcode("random", random),

};
