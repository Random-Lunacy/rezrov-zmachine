import { ZMachine } from "../../interpreter/ZMachine";
import { opcode } from "./base";
import { decodeZString } from "../../parsers/ZString";

/**
 * Print the string at the given address
 */
function print_addr(machine: ZMachine, stringAddr: number): void {
  machine.logger.debug(`print_addr ${stringAddr.toString(16)}`);
  machine.screen.print(
    machine,
    decodeZString(machine.memory, machine.memory.getZString(stringAddr), true)
  );
}

/**
 * Print the name of an object
 */
function print_obj(machine: ZMachine, obj: number): void {
  machine.logger.debug(`print_obj ${obj}`);
  const object = machine.getGameState().getObject(obj);
  if (object === null) {
    machine.logger.warn(`print_obj: object ${obj} not found`);
    return;
  }
  machine.screen.print(machine, object.name);
}

/**
 * Print a string at a packed address
 */
function print_paddr(machine: ZMachine, packedAddr: number): void {
  const addr = machine.getGameState().unpackStringAddress(packedAddr);
  machine.logger.debug(`print_paddr ${packedAddr} -> ${addr}`);

  machine.screen.print(
    machine,
    decodeZString(machine.memory, machine.memory.getZString(addr), true)
  );
}

/**
 * Print a newline
 */
function new_line(machine: ZMachine): void {
  machine.screen.print(machine, "\n");
}

/**
 * Print a string embedded in the instruction stream
 */
function print(machine: ZMachine): void {
  const zstring = machine.getGameState().readZString();
  machine.screen.print(
    machine,
    decodeZString(machine.memory, zstring, true)
  );
}

/**
 * Print a string and return 1
 */
function print_ret(machine: ZMachine): void {
  machine.logger.debug(`${machine.pc.toString(16)} print_ret`);

  // Read and print the embedded Z-string
  const zstring = machine.getGameState().readZString();
  machine.screen.print(
    machine,
    decodeZString(machine.memory, zstring, true)
  );

  // Return from the routine with value 1
  machine.getGameState().returnFromRoutine(1);
}

/**
 * Print a single character
 */
function print_char(machine: ZMachine, ...chars: Array<number>): void {
  machine.logger.debug(`print_char(${chars})`);
  machine.screen.print(
    machine,
    chars.map((c) => String.fromCharCode(c)).join("")
  );
}

/**
 * Print a number
 */
function print_num(machine: ZMachine, value: number): void {
  const numStr = machine.toI16(value).toString();
  machine.logger.debug(`print_num ${value} -> ${numStr}`);
  machine.screen.print(machine, numStr);
}

/**
 * Print a table of characters
 */
function print_table(
  machine: ZMachine,
  zscii_text: number,
  width: number,
  height: number = 1,
  skip: number = 0
): void {
  machine.logger.debug(`print_table: addr=${zscii_text}, width=${width}, height=${height}, skip=${skip}`);
  // This is a complex operation that prints a table of text
  // For now, we'll implement a simple version that just prints the text
  for (let i = 0; i < height; i++) {
    const row = [];
    for (let j = 0; j < width; j++) {
      const charCode = machine.memory.getByte(zscii_text + i * (width + skip) + j);
      row.push(String.fromCharCode(charCode));
    }
    machine.screen.print(machine, row.join("") + "\n");
  }
}

/**
 * Output stream selection
 */
function output_stream(
  machine: ZMachine,
  streamNum: number,
  table: number = 0,
  width: number = 0
): void {
  const streamNumber = machine.toI16(streamNum);

  if (streamNumber === 0) {
    return; // No-op
  }

  if (streamNumber > 0) {
    machine.screen.enableOutputStream(machine, streamNumber, table, width);
  } else {
    machine.screen.disableOutputStream(machine, -streamNumber, table, width);
  }
}

/**
 * Input stream selection
 */
function input_stream(machine: ZMachine, streamNum: number): void {
  machine.screen.selectInputStream(machine, machine.toI16(streamNum));
}

/**
 * Tokenize input text
 */
function tokenise(
  machine: ZMachine,
  text: number,
  dict: number,
  parse: number = 0,
  flag: number = 0
): void {
  machine.logger.debug(`tokenise: text=${text}, dict=${dict}, parse=${parse}, flag=${flag}`);
  machine.getGameState().tokenizeLine(text, parse, dict, flag !== 0);
}

/**
 * Set the text style
 */
function set_text_style(machine: ZMachine, style: number): void {
  machine.logger.debug(`set_text_style ${style}`);
  machine.screen.setTextStyle(machine, style);
}

/**
 * Set text colors
 */
function set_color(
  machine: ZMachine,
  foreground: number,
  background: number,
  window: number = 0
): void {
  if (machine.getGameState().version < 5) {
    window = 0;
  }

  machine.screen.setTextColors(machine, window, foreground, background);
}

/**
 * Export string handling opcodes
 */
export const stringOpcodes = {
  print: opcode("print", print),
  print_ret: opcode("print_ret", print_ret),
  print_addr: opcode("print_addr", print_addr),
  print_paddr: opcode("print_paddr", print_paddr),
  print_obj: opcode("print_obj", print_obj),
  print_char: opcode("print_char", print_char),
  print_num: opcode("print_num", print_num),
  print_table: opcode("print_table", print_table),
  new_line: opcode("new_line", new_line),
  output_stream: opcode("output_stream", output_stream),
  input_stream: opcode("input_stream", input_stream),
  tokenise: opcode("tokenise", tokenise),
  set_text_style: opcode("set_text_style", set_text_style),
  set_color: opcode("set_color", set_color),
};
