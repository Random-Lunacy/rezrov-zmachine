/**
 * Graphics opcodes for ZMachine
 * These opcodes handle graphics-related operations in the ZMachine.
 * Currently, they are not implemented and will throw an error if called.
 *
 * Exported functions:
 * - draw_picture: Draw a picture at the given coordinates (V6)
 * - picture_data: Get picture data, branch if available (V6)
 * - erase_picture: Erase a picture (V6)
 * - picture_table: Give advance notice of pictures (V6)
 */
import { ZMachine } from "../../interpreter/ZMachine";
import { opcode } from "./base";

/**
 * Draw a picture at the given coordinates (V6)
 */
function draw_picture(machine: ZMachine, picture: number, x: number, y: number): void {
  machine.state.logger.debug(`draw_picture ${picture} ${x} ${y}`);
  throw new Error(`Unimplemented opcode: draw_picture`);
}

/**
 * Get picture data, branch if available (V6)
 */
function picture_data(machine: ZMachine, picture: number): void {
  machine.state.logger.debug(`picture_data ${picture}`);
  throw new Error(`Unimplemented opcode: picture_data`);
}

/**
 * Erase a picture (V6)
 */
function erase_picture(machine: ZMachine, picture: number): void {
  machine.state.logger.debug(`erase_picture ${picture}`);
  throw new Error(`Unimplemented opcode: erase_picture`);
}

/**
 * Give advance notice of pictures (V6)
 */
function picture_table(machine: ZMachine, table: number): void {
  machine.state.logger.debug(`picture_table ${table}`);
  throw new Error(`Unimplemented opcode: picture_table`);
}

/**
 * Export the graphics opcodes
 */
export const graphicsOpcodes = {
  draw_picture: opcode("draw_picture", draw_picture),
  picture_data: opcode("picture_data", picture_data),
  erase_picture: opcode("erase_picture", erase_picture),
  picture_table: opcode("picture_table", picture_table),
};
