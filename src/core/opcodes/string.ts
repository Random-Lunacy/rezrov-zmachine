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
import { decodeZString, encodeZString, packZCharacters } from '../../parsers/ZString';
import { OperandType } from '../../types';
import { toI16 } from '../memory/cast16';
import { opcode } from './base';

/**
 * Print the string at the given address
 */
function print_addr(machine: ZMachine, _operandTypes: OperandType[], stringAddr: number): void {
  const decoded = decodeZString(machine.memory, machine.memory.getZString(stringAddr), true);
  machine.logger.debug(`print_addr ${stringAddr.toString(16)}`);
  machine.screen.print(machine, decoded);
}

/**
 * Print a string at a packed address
 */
function print_paddr(machine: ZMachine, _operandTypes: OperandType[], packedAddr: number): void {
  const addr = machine.state.memory.unpackStringAddress(packedAddr);
  const decoded = decodeZString(machine.memory, machine.memory.getZString(addr), true);
  machine.logger.debug(`print_paddr ${packedAddr} -> ${addr}`);
  machine.screen.print(machine, decoded);
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
  const decoded = decodeZString(machine.memory, zstring, true);
  machine.logger.debug(`print: "${decoded.substring(0, 40)}"`);
  machine.screen.print(machine, decoded);
}

/**
 * Print a string, followed by new_line, then return 1 (true)
 */
function print_ret(machine: ZMachine): void {
  machine.logger.debug(`${machine.state.pc.toString(16)} print_ret`);

  // Read and print the embedded Z-string
  const zstring = machine.state.readZString();
  machine.screen.print(machine, decodeZString(machine.memory, zstring, true));
  machine.screen.print(machine, '\n');

  // Return from the routine with value 1
  machine.state.returnFromRoutine(1);
}

/**
 * Print a single character
 */
function print_char(machine: ZMachine, _operandTypes: OperandType[], ...chars: Array<number>): void {
  machine.logger.debug(`print_char(${chars})`);
  machine.screen.print(machine, chars.map((c) => String.fromCharCode(c)).join(''));
}

/**
 * Print a number
 */
function print_num(machine: ZMachine, _operandTypes: OperandType[], value: number): void {
  const numStr = toI16(value).toString();
  machine.logger.debug(`print_num ${value} -> ${numStr}`);
  machine.screen.print(machine, numStr);
}

/**
 * Print a table of characters
 */
function print_table(
  machine: ZMachine,
  _operandTypes: OperandType[],
  zscii_text: number,
  width: number,
  height: number = 1,
  skip: number = 0
): void {
  machine.logger.debug(`print_table: addr=${zscii_text}, width=${width}, height=${height}, skip=${skip}`);

  // Per spec: after each row, cursor returns to the starting column and moves one line down.
  const startPos = machine.screen.getCursorPosition(machine);
  const outputWindow = machine.screen.getOutputWindow(machine);
  const isUpperWindow = outputWindow === 1;

  for (let i = 0; i < height; i++) {
    // Position cursor at the starting column for each row after the first
    if (i > 0) {
      if (isUpperWindow) {
        const windowId = machine.state.version < 6 ? 1 : outputWindow;
        machine.screen.setCursorPosition(machine, startPos.line + i, startPos.column, windowId);
      } else {
        machine.screen.print(machine, '\n');
      }
    }

    const row = [];

    // Calculate the starting address for this row
    // For each subsequent row, we skip (width + skip) bytes from the previous row's start
    const rowStartAddr = zscii_text + i * (width + skip);

    // Read each character in the current row
    for (let j = 0; j < width; j++) {
      const charCode = machine.memory.getByte(rowStartAddr + j);
      // Replace control characters (0-31) with spaces to prevent cursor jumps.
      // print_table data is a fixed-width grid; control chars would break the layout.
      row.push(charCode < 32 ? ' ' : String.fromCharCode(charCode));
    }

    // Print the row (no newline - cursor positioning handles row advancement)
    machine.screen.print(machine, row.join(''));
  }

  // Per spec: "There is no implicit new-line at the end."
  // The cursor remains at the end of the last printed row.
  // Between rows, cursor moves to start column of next line, but after
  // the final row, cursor stays where the last character was printed.
}

/**
 * Tokenize input text
 * Per Z-machine spec: tokenise text parse dict flag
 * - text: address of text buffer containing input
 * - parse: address of parse buffer to write tokens to
 * - dict: dictionary address (0 = default dictionary)
 * - flag: if non-zero, only recognized words are stored
 */
function tokenize(
  machine: ZMachine,
  _operandTypes: OperandType[],
  text: number,
  parse: number,
  dict: number = 0,
  flag: number = 0
): void {
  machine.logger.debug(
    `tokenise: text=0x${text.toString(16)}, parse=0x${parse.toString(16)}, dict=0x${dict.toString(16)}, flag=${flag}`
  );
  machine.state.tokenizeLine(text, parse, dict, flag !== 0);
}

/**
 * Print a Unicode character
 */
function print_unicode(machine: ZMachine, _operandTypes: OperandType[], charCode: number): void {
  machine.logger.debug(`print_unicode ${charCode}`);
  // For now, we'll just convert to the nearest ASCII equivalent
  // In a real implementation, this would handle proper Unicode
  const char = String.fromCodePoint(charCode);
  machine.screen.print(machine, char);
}

/**
 * Check if a Unicode character can be displayed
 */
function check_unicode(machine: ZMachine, _operandTypes: OperandType[], charCode: number): void {
  const resultVar = machine.state.readByte();
  machine.logger.debug(`check_unicode ${charCode} -> ${resultVar}`);

  // For now, we'll just check if it's in the basic ASCII range
  const canDisplay = charCode >= 32 && charCode <= 126;
  machine.state.storeVariable(resultVar, canDisplay ? 3 : 0);
}

function print_form(machine: ZMachine, _operandTypes: OperandType[], form: number): void {
  const string = machine.memory.getZString(form);
  const encoded_text = decodeZString(machine.memory, string, true);
  machine.logger.debug(`print_form ${form} -> ${encoded_text}`);
  throw new Error(`Unimplemented opcode: print_form`);
}

function encode_text(
  machine: ZMachine,
  _operandTypes: OperandType[],
  zsciiText: number,
  length: number,
  from: number,
  codedText: number
): void {
  // Read ZSCII characters from memory at zsciiText + from
  let text = '';
  for (let i = 0; i < length; i++) {
    text += String.fromCharCode(machine.memory.getByte(zsciiText + from + i));
  }

  machine.logger.debug(`encode_text: text="${text}", from=${from}, length=${length}, dest=0x${codedText.toString(16)}`);

  // Encode using existing ZString utilities
  const zChars = encodeZString(machine.memory, text, machine.state.version);
  const packed = packZCharacters(zChars, machine.state.version);

  // Write packed words to coded-text address
  for (let i = 0; i < packed.length; i++) {
    machine.memory.setWord(codedText + i * 2, packed[i]);
  }
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
