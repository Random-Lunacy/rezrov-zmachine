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
import { ZMachine } from '../../interpreter/ZMachine';
import { OperandType } from '../../types';
import { opcode } from './base';

/**
 * Draw a picture at the given coordinates (V6)
 */
function draw_picture(machine: ZMachine, _operandTypes: OperandType[], picture: number, x: number, y: number): void {
  machine.logger.debug(`draw_picture ${picture} ${x} ${y}`);

  // Check if pictures are supported for this version
  const version = machine.state.version;
  if (version < 6) {
    machine.logger.warn(`draw_picture not supported in version ${version}`);
    return;
  }

  try {
    // Use the multimedia handler to display the picture
    const status = machine.multimediaHandler.displayPicture(picture, x, y, 100); // Default to 100% scale

    if (status === 0) { // ResourceStatus.Available
      machine.logger.debug(`Picture ${picture} displayed successfully at (${x}, ${y})`);
    } else {
      machine.logger.warn(`Picture ${picture} failed to display, status: ${status}`);
    }
  } catch (error) {
    machine.logger.error(`Error displaying picture ${picture}: ${error}`);
  }
}

/**
 * Get picture data, branch if available (V6)
 */
function picture_data(machine: ZMachine, _operandTypes: OperandType[], picture: number): void {
  machine.logger.debug(`picture_data ${picture}`);

  // Check if pictures are supported for this version
  const version = machine.state.version;
  if (version < 6) {
    machine.logger.warn(`picture_data not supported in version ${version}`);
    return;
  }

  try {
    // Use the multimedia handler to get picture data
    const pictureData = machine.multimediaHandler.getPictureData(picture);

    if (pictureData) {
      machine.logger.debug(`Picture ${picture} data retrieved successfully`);
      // TODO: Store picture data in variables for branching logic
      // This would require additional implementation to handle the branching
    } else {
      machine.logger.warn(`Picture ${picture} data not available`);
    }
  } catch (error) {
    machine.logger.error(`Error getting picture data for ${picture}: ${error}`);
  }
}

/**
 * Erase a picture (V6)
 */
function erase_picture(machine: ZMachine, _operandTypes: OperandType[], picture: number): void {
  machine.logger.debug(`erase_picture ${picture}`);

  // Check if pictures are supported for this version
  const version = machine.state.version;
  if (version < 6) {
    machine.logger.warn(`erase_picture not supported in version ${version}`);
    return;
  }

  try {
    // Use the multimedia handler to erase the picture
    const status = machine.multimediaHandler.erasePicture(picture);

    if (status === 0) { // ResourceStatus.Available
      machine.logger.debug(`Picture ${picture} erased successfully`);
    } else {
      machine.logger.warn(`Picture ${picture} failed to erase, status: ${status}`);
    }
  } catch (error) {
    machine.logger.error(`Error erasing picture ${picture}: ${error}`);
  }
}

/**
 * Give advance notice of pictures (V6)
 */
function picture_table(machine: ZMachine, _operandTypes: OperandType[], table: number): void {
  machine.logger.debug(`picture_table ${table}`);

  // Check if pictures are supported for this version
  const version = machine.state.version;
  if (version < 6) {
    machine.logger.warn(`picture_table not supported in version ${version}`);
    return;
  }

  try {
    // TODO: Parse the picture table and preload pictures
    // This would require parsing the table structure and calling preloadResources
    machine.logger.debug(`Picture table ${table} processed for preloading`);
  } catch (error) {
    machine.logger.error(`Error processing picture table ${table}: ${error}`);
  }
}

/**
 * Export the graphics opcodes
 */
export const graphicsOpcodes = {
  draw_picture: opcode('draw_picture', draw_picture),
  picture_data: opcode('picture_data', picture_data),
  erase_picture: opcode('erase_picture', erase_picture),
  picture_table: opcode('picture_table', picture_table),
};

// Export individual functions for testing
export { draw_picture, picture_data, erase_picture, picture_table };
