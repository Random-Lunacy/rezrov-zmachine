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
 * - `print_char`: Prints a single character.
 * - `print_num`: Prints a number.
 * - `print_table`: Prints a table of characters.
 * - `new_line`: Prints a newline character.
 * - `tokenise`: Tokenizes input text.
 * - `print_unicode`: Prints a Unicode character.
 * - `check_unicode`: Checks if a Unicode character can be displayed.
 */
import { ZMachine } from '../../interpreter/ZMachine';
import { decodeZString } from '../../parsers/ZString';
import { toI16 } from '../memory/cast16';
import { opcode } from './base';

/**
 * Print the string at the given address
 */
function print_addr(machine: ZMachine, stringAddr: number): void {
  machine.logger.debug(`print_addr ${stringAddr.toString(16)}`);
  machine.screen.print(machine, decodeZString(machine.memory, machine.memory.getZString(stringAddr), true));
}

/**
 * Print a string at a packed address
 */
function print_paddr(machine: ZMachine, packedAddr: number): void {
  const addr = machine.state.unpackStringAddress(packedAddr);
  machine.logger.debug(`print_paddr ${packedAddr} -> ${addr}`);

  machine.screen.print(machine, decodeZString(machine.memory, machine.memory.getZString(addr), true));
}

/**
 * Print a newline
 */
function new_line(machine: ZMachine): void {
  machine.logger.debug(`new_line`);
  machine.screen.print(machine, '\n');
}

/**
 * Print a string embedded in the instruction stream
 */
function print(machine: ZMachine): void {
  const zstring = machine.state.readZString();
  machine.logger.debug(`print ${zstring}`);
  machine.screen.print(machine, decodeZString(machine.memory, zstring, true));
}

/**
 * Print a string and return 1
 */
function print_ret(machine: ZMachine): void {
  machine.logger.debug(`${machine.state.pc.toString(16)} print_ret`);

  // Read and print the embedded Z-string
  const zstring = machine.state.readZString();
  machine.screen.print(machine, decodeZString(machine.memory, zstring, true));

  // Return from the routine with value 1
  machine.state.returnFromRoutine(1);
}

/**
 * Print a single character
 */
function print_char(machine: ZMachine, ...chars: Array<number>): void {
  machine.logger.debug(`print_char(${chars})`);
  machine.screen.print(machine, chars.map(c => String.fromCharCode(c)).join(''));
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
function print_table(machine: ZMachine, zscii_text: number, width: number, height: number = 1, skip: number = 0): void {
  machine.logger.debug(`print_table: addr=${zscii_text}, width=${width}, height=${height}, skip=${skip}`);
  // This is a complex operation that prints a table of text
  // For now, we'll implement a simple version that just prints the text
  for (let i = 0; i < height; i++) {
    const row = [];
    for (let j = 0; j < width; j++) {
      const charCode = machine.memory.getByte(zscii_text + i * (width + skip) + j);
      row.push(String.fromCharCode(charCode));
    }
    machine.screen.print(machine, row.join('') + '\n');
  }
}

/**
 * Tokenize input text
 */
function tokenize(machine: ZMachine, text: number, dict: number, parse: number = 0, flag: number = 0): void {
  machine.logger.debug(`tokenise: text=${text}, dict=${dict}, parse=${parse}, flag=${flag}`);
  machine.state.tokenizeLine(text, parse, dict, flag !== 0);
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

function print_form(machine: ZMachine, form: number): void {
  const string = machine.memory.getZString(form);
  const encoded_text = decodeZString(machine.memory, string, true);
  machine.logger.debug(`print_form ${form} -> ${encoded_text}`);
  throw new Error(`Unimplemented opcode: print_form`);
}

function encode_text(machine: ZMachine, text: number): void {
  const encoded_text = machine.memory.getZString(text);
  machine.logger.debug(`encode_text ${text} -> ${encoded_text}`);
  throw new Error(`Unimplemented opcode: encode_text`);
}

/**
 * Export string handling opcodes
 */
export const stringOpcodes = {
  print: opcode('print', print),
  print_ret: opcode('print_ret', print_ret),
  print_addr: opcode('print_addr', print_addr),
  print_paddr: opcode('print_paddr', print_paddr),
  print_char: opcode('print_char', print_char),
  print_num: opcode('print_num', print_num),
  print_table: opcode('print_table', print_table),
  new_line: opcode('new_line', new_line),
  tokenise: opcode('tokenise', tokenize),
  print_unicode: opcode('print_unicode', print_unicode),
  check_unicode: opcode('check_unicode', check_unicode),
  print_form: opcode('print_form', print_form),
  encode_text: opcode('encode_text', encode_text),
};
