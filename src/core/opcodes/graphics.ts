/**
 * Graphics opcodes for ZMachine
 * These opcodes handle graphics-related operations in the ZMachine.
 *
 * Exported functions:
 * - draw_picture: Draw a picture at the given coordinates (V6)
 * - picture_data: Get picture data, branch if available (V6)
 * - erase_picture: Erase a picture (V6)
 * - picture_table: Give advance notice of pictures (V6)
 */
import { ZMachine } from '../../interpreter/ZMachine';
import { OperandType } from '../../types';
import { ResourceType } from '../../ui/multimedia/MultimediaHandler';
import { WindowProperty } from '../../ui/screen/interfaces';
import { HeaderLocation } from '../../utils/constants';
import { opcode } from './base';

/**
 * Draw a picture at the given coordinates (V6)
 * Z-spec: draw_picture picture-number y x
 */
function draw_picture(machine: ZMachine, _operandTypes: OperandType[], picture: number, y: number, x: number): void {
  machine.logger.debug(`draw_picture ${picture} ${y} ${x}`);

  const version = machine.state.version;
  if (version < 6) {
    machine.logger.warn(`draw_picture not supported in version ${version}`);
    return;
  }

  const fontH = machine.memory.getByte(HeaderLocation.FontHeightInUnits) || 1;
  const fontW = machine.memory.getByte(HeaderLocation.FontWidthInUnits) || 1;

  // Default position: use current cursor when y or x is 0.
  // In V6, BaseScreen.setCursorPosition() converts set_cursor's pixel args to char-cell
  // indices for upper-window buffer addressing, so getCursorPosition() returns char cells.
  // Reverse that conversion to get the 1-based pixel coordinate.
  let finalY = y;
  let finalX = x;

  if (!finalY || !finalX) {
    const cursorPos = machine.screen.getCursorPosition(machine);
    if (!finalY) finalY = (cursorPos.line - 1) * fontH + 1;
    if (!finalX) finalX = (cursorPos.column - 1) * fontW + 1;
  }

  // V6: draw_picture coordinates are window-relative 1-based pixel positions (spec §8.8.3.1).
  // Convert to screen-absolute by adding the current window's top-left pixel position.
  // getWindowProperty(YCoordinate/XCoordinate) returns the 1-based canvas pixel position
  // of the window's top-left corner (tracked by WindowManager via move_window/split_window).
  const currentWindow = machine.screen.getOutputWindow(machine);
  const windowY = machine.screen.getWindowProperty(machine, currentWindow, WindowProperty.YCoordinate);
  const windowX = machine.screen.getWindowProperty(machine, currentWindow, WindowProperty.XCoordinate);
  // Both windowY and finalY are 1-based; adding them and subtracting 1 gives the
  // screen-absolute 1-based position (window_top + offset_within_window - 1).
  finalY = windowY + finalY - 1;
  finalX = windowX + finalX - 1;

  machine.logger.debug(
    `draw_picture pic=${picture} rawY=${y} rawX=${x} winY=${windowY} winX=${windowX} ` +
      `finalY=${finalY} finalX=${finalX} window=${currentWindow}`
  );

  try {
    const status = machine.multimediaHandler.displayPicture(picture, finalX, finalY, 100, currentWindow);

    if (status === 0) {
      machine.logger.debug(`Picture ${picture} displayed at (${finalX}, ${finalY})`);
    } else {
      machine.logger.warn(`Picture ${picture} failed to display, status: ${status}`);
    }

    // Notify the screen synchronously so it can reposition HTML text below the picture.
    // getPictureData() reads dimensions from the Blorb header without decoding the image.
    const picInfo = machine.multimediaHandler.getPictureData(picture);
    if (picInfo) {
      machine.screen.onWindowPictureDrawn?.(currentWindow, finalY, picInfo.height);
    }
  } catch (error) {
    machine.logger.error(`Error displaying picture ${picture}: ${error}`);
  }
}

/**
 * Get picture data, branch if available (V6)
 * Z-spec: picture_data picture-number array ?(label)
 * Stores height in array[0], width in array[1], branches if picture is available
 */
function picture_data(machine: ZMachine, _operandTypes: OperandType[], picture: number, array: number): void {
  machine.logger.debug(`picture_data ${picture} ${array.toString(16)}`);

  const [offset, branchOnFalse] = machine.state.readBranchOffset();

  const version = machine.state.version;
  if (version < 6) {
    machine.logger.warn(`picture_data not supported in version ${version}`);
    machine.state.doBranch(false, branchOnFalse, offset);
    return;
  }

  try {
    const pictureData = machine.multimediaHandler.getPictureData(picture);

    if (pictureData && pictureData.height > 0 && pictureData.width > 0) {
      // Store height and width in the array
      machine.memory.setWord(array, pictureData.height);
      machine.memory.setWord(array + 2, pictureData.width);

      machine.logger.debug(`Picture ${picture}: ${pictureData.width}x${pictureData.height}`);
      machine.state.doBranch(true, branchOnFalse, offset);
    } else {
      machine.logger.debug(`Picture ${picture} not available`);
      machine.state.doBranch(false, branchOnFalse, offset);
    }
  } catch (error) {
    machine.logger.error(`Error getting picture data for ${picture}: ${error}`);
    machine.state.doBranch(false, branchOnFalse, offset);
  }
}

/**
 * Erase a picture (V6)
 * Z-spec: erase_picture picture-number y x
 */
function erase_picture(
  machine: ZMachine,
  _operandTypes: OperandType[],
  picture: number,
  y: number = 0,
  x: number = 0
): void {
  machine.logger.debug(`erase_picture ${picture} ${y} ${x}`);

  const version = machine.state.version;
  if (version < 6) {
    machine.logger.warn(`erase_picture not supported in version ${version}`);
    return;
  }

  try {
    const status = machine.multimediaHandler.erasePicture(picture);

    if (status === 0) {
      machine.logger.debug(`Picture ${picture} erased`);
    } else {
      machine.logger.warn(`Picture ${picture} failed to erase, status: ${status}`);
    }
  } catch (error) {
    machine.logger.error(`Error erasing picture ${picture}: ${error}`);
  }
}

/**
 * Give advance notice of pictures to preload (V6)
 * Z-spec: picture_table table
 * Table is an array of word-sized picture IDs, terminated by 0
 */
function picture_table(machine: ZMachine, _operandTypes: OperandType[], table: number): void {
  machine.logger.debug(`picture_table ${table.toString(16)}`);

  const version = machine.state.version;
  if (version < 6) {
    machine.logger.warn(`picture_table not supported in version ${version}`);
    return;
  }

  if (table === 0) {
    machine.logger.debug('Picture preloading cancelled');
    return;
  }

  try {
    // Parse table: array of word picture IDs, terminated by 0
    const resources: Array<{ type: ResourceType; id: number }> = [];
    let addr = table;

    while (true) {
      const pictureId = machine.memory.getWord(addr);
      if (pictureId === 0) break;

      resources.push({ type: ResourceType.Picture, id: pictureId });
      addr += 2;
    }

    if (resources.length > 0) {
      machine.multimediaHandler.preloadResources(resources);
      machine.logger.debug(`Preloading ${resources.length} pictures`);
    }
  } catch (error) {
    machine.logger.error(`Error processing picture table: ${error}`);
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
export { draw_picture, erase_picture, picture_data, picture_table };
