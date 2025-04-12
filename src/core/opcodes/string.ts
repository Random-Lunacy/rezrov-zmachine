/**
 * String handling opcodes
 * These opcodes are responsible for printing strings, handling text input/output, and managing text styles.
 * They provide functionality for displaying text on the screen, formatting text, and controlling the appearance of text.
 *
 * Exported Opcodes:
 * - `print`: Prints a string at the current cursor position.
 * - `print_ret`: Prints a string and returns from the current routine.
 * - `print_addr`: Prints a string at the specified address.
 * - `print_paddr`: Prints a string at a packed address.
 * - `print_obj`: Prints the name of an object.
 * - `print_char`: Prints a single character.
 * - `print_num`: Prints a number.
 * - `print_table`: Prints a table of characters.
 * - `new_line`: Prints a newline character.
 * - `output_stream`: Selects the output stream for printing.
 * - `input_stream`: Selects the input stream for reading.
 * - `tokenise`: Tokenizes input text.
 * - `set_text_style`: Sets the text style for printing.
 * - `set_colour`: Sets the text colors for printing.
 * - `print_unicode`: Prints a Unicode character.
 * - `check_unicode`: Checks if a Unicode character can be displayed.
 */
import { ZMachine } from "../../interpreter/ZMachine";
import { decodeZString } from "../../parsers/ZString";
import { HeaderLocation } from "../../utils/constants";
import { toI16 } from "../memory/cast16";
import { opcode } from "./base";

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
  const object = machine.state.getObject(obj);
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
  const addr = machine.state.unpackStringAddress(packedAddr);
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
  machine.logger.debug(`new_line`);
  machine.screen.print(machine, "\n");
}

/**
 * Print a string embedded in the instruction stream
 */
function print(machine: ZMachine): void {
  const zstring = machine.state.readZString();
  machine.logger.debug(`print ${zstring}`);
  machine.screen.print(
    machine,
    decodeZString(machine.memory, zstring, true)
  );
}

/**
 * Print a string and return 1
 */
function print_ret(machine: ZMachine): void {
  machine.logger.debug(`${machine.state.pc.toString(16)} print_ret`);

  // Read and print the embedded Z-string
  const zstring = machine.state.readZString();
  machine.screen.print(
    machine,
    decodeZString(machine.memory, zstring, true)
  );

  // Return from the routine with value 1
  machine.state.returnFromRoutine(1);
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
  const numStr = toI16(value).toString();
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
  const streamNumber = toI16(streamNum);

  machine.logger.debug(`output_stream: streamNum=${streamNum}, table=${table}, width=${width}`);

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
  machine.logger.debug(`input_stream: streamNum=${streamNum}`);
  machine.screen.selectInputStream(machine, toI16(streamNum));
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
  machine.state.tokenizeLine(text, parse, dict, flag !== 0);
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
function set_colour(
  machine: ZMachine,
  foreground: number,
  background: number,
  window: number = 0
): void {
  if (machine.state.version < 5) {
    machine.logger.debug(`set_colour: ignoring in version < 5`);
    window = 0;
  }

  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} set_colour ${foreground} ${background} ${window}`
  );

  // Handle transparency (color 15) in Version 6
  if (machine.state.version === 6) {
    // Check if background is set to transparent
    if (background === 15) {
      // Check if the interpreter supports transparency
      const flags3Addr = machine.state.memory.getWord(HeaderLocation.HeaderExtTable) + 4;
      if (flags3Addr > 0) {
        const flags3 = machine.state.memory.getWord(flags3Addr);
        const supportsTransparency = (flags3 & 0x0001) !== 0;

        if (!supportsTransparency) {
          // If transparency is not supported, ignore the request
          machine.logger.warn("Transparency requested but not supported by interpreter");
          return;
        }
      } else {
        // No header extension table, assume no transparency support
        machine.logger.warn("Transparency requested but header extension not present");
        return;
      }

      // Check if foreground is also set to transparent (invalid)
      if (foreground === 15) {
        machine.logger.warn("Transparent foreground not allowed, request ignored");
        return;
      }

      // Check if current text style includes reverse video (invalid with transparency)
      const currentWindow = machine.screen.getOutputWindow(machine);
      const currentStyle = machine.screen.getWindowProperty(machine, currentWindow, 10);
      if ((currentStyle & 1) !== 0) { // Reverse video bit
        machine.logger.warn("Reverse video style not allowed with transparent background");
        return;
      }
    }

    // Ensure foreground is never transparent
    if (foreground === 15) {
      machine.logger.warn("Transparent foreground not allowed, using default instead");
      foreground = 1; // Use default foreground color instead
    }
  }

  // Pass to screen implementation
  machine.screen.setTextColors(machine, window, foreground, background);
}

/**
 * Print a Unicode character
 */
function print_unicode(machine: ZMachine, charCode: number): void {
  machine.logger.debug(`print_unicode ${charCode}`);
  // For now, we'll just convert to the nearest ASCII equivalent
  // In a real implementation, this would handle proper Unicode
  const char = String.fromCodePoint(charCode);
  machine.screen.print(machine, char);
}

/**
 * Check if a Unicode character can be displayed
 */
function check_unicode(machine: ZMachine, charCode: number): void {
  const resultVar = machine.state.readByte();
  machine.logger.debug(`check_unicode ${charCode} -> ${resultVar}`);

  // For now, we'll just check if it's in the basic ASCII range
  const canDisplay = charCode >= 32 && charCode <= 126;
  machine.state.storeVariable(resultVar, canDisplay ? 3 : 0);
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
  set_colour: opcode("set_colour", set_colour),
  print_unicode: opcode("print_unicode", print_unicode),
  check_unicode: opcode("check_unicode", check_unicode),
};
