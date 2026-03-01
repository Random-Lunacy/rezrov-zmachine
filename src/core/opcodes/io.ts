/**
 * I/O opcodes for the Z-Machine interpreter
 * These opcodes handle input and output operations, including text display,
 * sound effects, and user input.
 *
 * Exported Opcodes:
 * - `split_window`: Split the screen into two windows
 * - `set_window`: Set the active output window
 * - `erase_window`: Clear a window
 * - `erase_line`: Clear the current line
 * - `set_cursor`: Set the cursor position
 * - `get_cursor`: Get the current cursor position
 * - `set_text_style`: Set the text style
 * - `set_colour`: Sets the text colors for printing.
 * - `buffer_mode`: Set buffer mode (buffered or unbuffered output)
 * - `output_stream`: Enable or disable an output stream
 * - `input_stream`: Select an input stream
 * - `sread`: Read a line of input from the user
 * - `sound_effect`: Play a sound effect
 * - `read_char`: Read a single character from the user
 * - `get_wind_prop`: Get a window property
 * - `set_font`: Set the font for text output
 * - `buffer_screen`: Buffer screen operation
 * - `set_true_colour`: Set true color for text output
 * - `set_margins`: Set margins for text output
 * - `move_window`: Move a window to a new position
 * - `window_size`: Set the size of a window
 * - `window_style`: Set the style of a window
 * - `read_mouse`: Read mouse input
 * - `mouse_window`: Set the mouse window
 * - `make_menu`: Create a menu
 * - `scroll_window`: Scroll a window
 * - `put_wind_prop`: Set a window property
 */
import { SuspendState } from '../../core/execution/SuspendState';
import { ZMachine } from '../../interpreter/ZMachine';
import { OperandType } from '../../types';
import { HeaderLocation } from '../../utils/constants';
import { toI16 } from '../memory/cast16';
import { opcode } from './base';

/**
 * Get the current PC safely for logging
 */
function getSafePcHex(machine: ZMachine): string {
  const pc = machine.executor?.op_pc ?? machine.state.pc;
  return typeof pc === 'number' ? pc.toString(16) : '0';
}

/**
 * Split the screen into two windows
 */
function split_window(machine: ZMachine, _operandTypes: OperandType[], lines: number): void {
  machine.logger.debug(`${getSafePcHex(machine)} split_window ${lines}`);
  machine.screen.splitWindow(machine, lines);
}

/**
 * Set the active output window
 */
function set_window(machine: ZMachine, _operandTypes: OperandType[], window: number): void {
  machine.logger.debug(`${getSafePcHex(machine)} set_window ${window}`);
  machine.screen.setOutputWindow(machine, window);
}

/**
 * Clear a window
 * The window argument is a signed 16-bit value:
 * -1 (0xFFFF) = clear all, unsplit, select window 0
 * -2 (0xFFFE) = clear all but don't unsplit
 * 0 = clear window 0
 * 1 = clear window 1
 */
function erase_window(machine: ZMachine, _operandTypes: OperandType[], window: number): void {
  const signedWindow = toI16(window);
  machine.logger.debug(`${getSafePcHex(machine)} erase_window ${signedWindow}`);
  machine.screen.clearWindow(machine, signedWindow);
}

/**
 * Clear the current line
 */
function erase_line(machine: ZMachine, _operandTypes: OperandType[], value: number): void {
  machine.logger.debug(`${getSafePcHex(machine)} erase_line ${value}`);
  // Per Z-spec §8.7.2.1 and Infocom: only erase when argument is 1
  if (value === 1) {
    machine.screen.clearLine(machine, value);
  }
}

/**
 * Set the cursor position
 */
function set_cursor(
  machine: ZMachine,
  _operandTypes: OperandType[],
  line: number,
  column: number,
  window: number = 0
): void {
  machine.logger.debug(`${getSafePcHex(machine)} set_cursor ${line} ${column}`);

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
    // Per spec 8.7.2: set_cursor always targets the upper window in V4/V5
    // "This is the cursor which set_cursor sets."
    window = 1; // WindowType.Upper
  }

  machine.screen.setCursorPosition(machine, line, column, window);
}

/**
 * Get the current cursor position
 */
function get_cursor(machine: ZMachine, _operandTypes: OperandType[], array: number): void {
  machine.logger.debug(`${getSafePcHex(machine)} get_cursor ${array}`);

  // Per spec: stores cursor position as two words at array address
  // array→0: current line (1-based)
  // array→2: current column (1-based)
  const pos = machine.screen.getCursorPosition(machine);
  machine.memory.setWord(array, pos.line);
  machine.memory.setWord(array + 2, pos.column);
}

/**
 * Set the text style
 */
function set_text_style(machine: ZMachine, _operandTypes: OperandType[], style: number): void {
  machine.logger.debug(`${getSafePcHex(machine)} set_text_style ${style}`);

  // Style values:
  // 0 = Normal (clear all styles)
  // 1 = Reverse Video
  // 2 = Bold
  // 4 = Italic
  // 8 = Fixed Pitch
  // Combined styles are sums of these values, e.g., 6 = Bold + Italic

  // In Standard 1.1, we handle combined styles
  // If parameter is 0, deactivate all styles
  // If non-zero, activate the specified styles

  // Let the screen handle the style setting
  // Pass the full style value to let screen implementation handle the combination
  machine.screen.setTextStyle(machine, style);
}

/**
 * Set buffer mode (buffered or unbuffered output)
 */
function buffer_mode(machine: ZMachine, _operandTypes: OperandType[], flag: number): void {
  machine.logger.debug(`${getSafePcHex(machine)} buffer_mode ${flag}`);
  machine.screen.setBufferMode(machine, flag);
}

/**
 * Enable or disable an output stream
 */
function output_stream(
  machine: ZMachine,
  _operandTypes: OperandType[],
  streamNum: number,
  table: number = 0,
  width: number = 0
): void {
  const streamNumber = toI16(streamNum);

  machine.logger.debug(`${getSafePcHex(machine)} output_stream ${streamNum} ${table} ${width}`);

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
function input_stream(machine: ZMachine, _operandTypes: OperandType[], streamNum: number): void {
  machine.logger.debug(`${getSafePcHex(machine)} input_stream ${streamNum}`);
  machine.screen.selectInputStream(machine, toI16(streamNum));
}

/**
 * Read a line of input from the user. This opcode is used for both
 * sread and aread, depending on the version of the Z-Machine.
 * In V5+, we need to store the terminating character
 */
function sread(
  machine: ZMachine,
  _operandTypes: OperandType[],
  textBuffer: number,
  parseBuffer: number,
  time: number = 0,
  routine: number = 0
): void {
  const version = machine.state.version;
  let resultVar = 0;

  if (version >= 5) {
    resultVar = machine.state.readByte();
  }

  machine.logger.debug(
    `sread/aread: text=0x${textBuffer.toString(16)}, parse=0x${parseBuffer.toString(16)}, time=${time}, routine=${routine}`
  );

  // Z-spec §8.4: In V1-3, update the status line before reading input
  if (version <= 3) {
    machine.updateStatusBar();
  }

  // Z-spec §15.2: In V5+, the text buffer may contain pre-loaded text.
  // Byte 0 = max length, Byte 1 = number of pre-existing characters,
  // Bytes 2+ = the pre-existing characters.
  let preloadedText: string | undefined;
  if (version >= 5) {
    const maxLen = machine.state.memory.getByte(textBuffer);
    const preloadedLen = machine.state.memory.getByte(textBuffer + 1);
    machine.logger.debug(`sread/aread: textBuffer maxLen=${maxLen}, preloadedLen=${preloadedLen}`);
    if (preloadedLen > 0) {
      let preloaded = '';
      for (let i = 0; i < preloadedLen; i++) {
        preloaded += String.fromCharCode(machine.state.memory.getByte(textBuffer + 2 + i));
      }
      machine.logger.debug(`sread/aread: preloaded text="${preloaded}"`);
      preloadedText = preloaded;
    }
  }

  // Suspend for text input
  throw new SuspendState({
    keyPress: false,
    resultVar,
    textBuffer,
    parseBuffer,
    time,
    routine,
    preloadedText,
  });
}

/**
 * Play a sound effect
 */
function sound_effect(
  machine: ZMachine,
  _operandTypes: OperandType[],
  number: number,
  effect: number = 2,
  volumeAndRepeats: number = 0x00ff,
  _routine: number = 0
): void {
  // Infocom ARG3 packs count (high byte) and volume (low byte)
  // Default $00FF = count 0 (use default), volume 255 (use MIDI/max)
  const volume = volumeAndRepeats & 0xff;
  const rawRepeats = (volumeAndRepeats >> 8) & 0xff;
  // 0xFF = infinite (-1 signed), 0 = use default (1), 1-254 = finite count
  const repeats = rawRepeats === 0xff ? -1 : rawRepeats || 1;

  machine.logger.debug(
    `${getSafePcHex(machine)} sound_effect ${number} effect=${effect} vol=${volume} repeats=${repeats}`
  );

  try {
    const status = machine.multimediaHandler.playSound(number, effect, volume, repeats);

    if (status === 0) {
      machine.logger.debug(`Sound effect ${number} started successfully`);
    } else {
      machine.logger.warn(`Sound effect ${number} failed to start, status: ${status}`);
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      machine.logger.error(`Error playing sound effect ${number}: ${error.message}`);
    } else {
      machine.logger.error(`Error playing sound effect ${number}: ${error}`);
    }
  }
}

/**
 * Read a single character from the user
 */
function read_char(
  machine: ZMachine,
  _operandTypes: OperandType[],
  device: number = 0,
  time: number = 0,
  routine: number = 0
): void {
  const resultVar = machine.state.readByte();

  machine.logger.debug(`${getSafePcHex(machine)} read_char ${device} ${time} ${routine}`);

  // Suspend for key input
  throw new SuspendState({
    keyPress: true,
    resultVar,
    time,
    routine,
  });
}

function get_wind_prop(machine: ZMachine, _operandTypes: OperandType[], window: number, property: number): void {
  const resultVar = machine.state.readByte();

  machine.logger.debug(`${getSafePcHex(machine)} get_wind_prop ${window} ${property} -> (${resultVar})`);

  // Get the property value from the window
  let value = 0;

  try {
    // Check for true color properties
    if (property === 16 || property === 17) {
      // Only available in Version 6
      if (machine.state.version === 6) {
        if (property === 16) {
          // Get true foreground color
          value = machine.screen.getWindowTrueForeground(machine, window);
        } else {
          // Get true background color
          value = machine.screen.getWindowTrueBackground(machine, window);
        }
      } else {
        machine.logger.warn(`True color properties only available in Version 6`);
      }
    } else {
      // Handle other window properties
      value = machine.screen.getWindowProperty(machine, window, property);
    }
  } catch (error) {
    machine.logger.error(`Error getting window property: ${error}`);
  }

  machine.state.storeVariable(resultVar, value);
}

/**
 * Set the font for text output
 */
function set_font(machine: ZMachine, _operandTypes: OperandType[], font: number, window: number = -3): void {
  const resultVar = machine.state.readByte();

  machine.logger.debug(`${getSafePcHex(machine)} set_font ${font} ${window}`);

  // Check if window parameter is valid for the current version
  if (window !== -3 && machine.state.version < 6) {
    machine.logger.warn('Window parameter to set_font only valid in V6');
    // Force to current window for V5 and earlier
    window = -3;
  }

  // Store the previous font
  let oldFont = 1; // Default to font 1 if information not available

  // For V6, we need to handle the window parameter
  if (machine.state.version === 6 && window !== -3) {
    // Get the current font for the specified window
    // This assumes there's a way to get the font from a specific window
    oldFont = machine.screen.getFontForWindow(machine, window);

    // Set the font for the specified window
    const success = machine.screen.setFontForWindow(machine, font, window);

    // If font change failed, return 0
    if (!success) {
      machine.state.storeVariable(resultVar, 0);
      return;
    }
  } else {
    // For V5 or current window in V6
    oldFont = machine.screen.getCurrentFont(machine);

    // Set the font for the current window
    const success = machine.screen.setFont(machine, font);

    // If font change failed, return 0
    if (!success) {
      machine.state.storeVariable(resultVar, 0);
      return;
    }
  }

  // Return previous font number
  machine.state.storeVariable(resultVar, oldFont);
}

/**
 * Buffer screen operation
 */
function buffer_screen(machine: ZMachine, _operandTypes: OperandType[], mode: number): void {
  const resultVar = machine.state.readByte();

  // Get current buffer mode to return as the result
  const currentMode = machine.screen.getBufferMode(machine);

  machine.logger.debug(`${getSafePcHex(machine)} buffer_screen ${mode} -> (${resultVar})`);

  if (mode === -1) {
    // Force immediate update without changing buffer state
    machine.screen.updateDisplay(machine);
  } else if (mode === 0 || mode === 1) {
    // Set new buffer mode
    machine.screen.setBufferMode(machine, mode);
  } else {
    machine.logger.warn(`Invalid buffer_screen mode: ${mode}. Expected -1, 0, or 1.`);
  }

  // Return the previous buffer mode
  machine.state.storeVariable(resultVar, currentMode);
}

/**
 * Set text colors
 *
 * In V5: Takes 2 operands (foreground, background) and applies to the current output window
 * In V6: Takes 3 operands (foreground, background, window) where window is optional
 */
function set_colour(
  machine: ZMachine,
  _operandTypes: OperandType[],
  foreground: number,
  background: number,
  window?: number
): void {
  if (machine.state.version < 5) {
    machine.logger.debug(`set_colour: ignoring in version < 5`);
    return;
  }

  // In V5, set_colour always applies to the current output window
  // In V6, if window is not provided, it defaults to the current output window
  let targetWindow: number;
  if (machine.state.version === 6 && window !== undefined) {
    targetWindow = window;
  } else {
    targetWindow = machine.screen.getOutputWindow(machine);
  }

  machine.logger.debug(`${getSafePcHex(machine)} set_colour ${foreground} ${background} -> window ${targetWindow}`);

  if (machine.state.version === 6) {
    if (!handleTransparency(machine, foreground, background)) {
      return;
    }
    foreground = ensureValidForeground(machine, foreground);
  }

  machine.screen.setTextColors(machine, targetWindow, foreground, background);
}

function handleTransparency(machine: ZMachine, foreground: number, background: number): boolean {
  if (background === 15) {
    if (!supportsTransparency(machine)) {
      machine.logger.warn('Transparency requested but not supported by interpreter');
      return false;
    }

    if (foreground === 15) {
      machine.logger.warn('Transparent foreground not allowed, request ignored');
      return false;
    }

    if (isReverseVideoActive(machine)) {
      machine.logger.warn('Reverse video style not allowed with transparent background');
      return false;
    }
  }
  return true;
}

function supportsTransparency(machine: ZMachine): boolean {
  const flags3Addr = machine.state.memory.getWord(HeaderLocation.HeaderExtTable) + 4;
  if (flags3Addr > 0) {
    const flags3 = machine.state.memory.getWord(flags3Addr);
    return (flags3 & 0x0001) !== 0;
  }
  machine.logger.warn('Transparency requested but header extension not present');
  return false;
}

function isReverseVideoActive(machine: ZMachine): boolean {
  const currentWindow = machine.screen.getOutputWindow(machine);
  const currentStyle = machine.screen.getWindowProperty(machine, currentWindow, 10);
  return (currentStyle & 1) !== 0;
}

function ensureValidForeground(machine: ZMachine, foreground: number): number {
  if (foreground === 15) {
    machine.logger.warn('Transparent foreground not allowed, using default instead');
    return 1; // Use default foreground color instead
  }
  return foreground;
}

function set_true_colour(
  machine: ZMachine,
  _operandTypes: OperandType[],
  foreground: number,
  background: number,
  window: number = -3 // Default to current window (magic value -3)
): void {
  machine.logger.debug(`set_true_colour ${foreground} ${background} ${window}`);

  // Magic values:
  // -1 = default setting
  // -2 = current setting
  // -3 = color under cursor (V6 only)
  // -4 = transparent (V6 only)

  machine.logger.debug(`${getSafePcHex(machine)} set_true_colour ${foreground} ${background} ${window}`);

  // Check that windows parameter is only used in V6
  if (window !== -3 && machine.state.version < 6) {
    machine.logger.warn('Window parameter to set_true_colour only valid in V6');
    window = -3; // Force to current window
  }

  // Handle foreground transparency in V6
  if (foreground === -4 && machine.state.version === 6) {
    machine.logger.warn('Transparency requested for foreground - this is not permitted');
    foreground = -2; // Fall back to current color
  }

  // In minimal implementation, map to standard colors and call set_colour
  // For Version 6, note that window is already -3 (current) for V5
  const standardFg = trueColorToStandard(foreground);
  const standardBg = trueColorToStandard(background);

  // Call set_colour with the mapped standard colors
  if (machine.state.version === 6) {
    machine.screen.setTextColors(machine, window, standardFg, standardBg);
  } else {
    machine.screen.setTextColors(machine, 0, standardFg, standardBg);
  }

  // For V6, update the window properties for true colors
  // This assumes there's a way to store these values in window properties
  if (machine.state.version === 6 && window !== -3) {
    // This is a simplified example - in practice, we'd need to
    // modify the window properties system to handle properties 16 and 17
    storeWindowTrueColors(machine, window, foreground, background);
  }
}

// Helper function to map true colors to standard colors
function trueColorToStandard(trueColor: number): number {
  // Magic values stay as is
  if (trueColor <= -1) return trueColor;

  // This is a simple implementation - a real one would use
  // color distance calculations to find the closest match
  // in the standard 1-15 color palette

  // Extract RGB components (5 bits each)
  const red = trueColor & 0x1f;
  const green = (trueColor >> 5) & 0x1f;
  const blue = (trueColor >> 10) & 0x1f;

  // Very basic mapping - a real implementation would be more sophisticated
  if (red === 0 && green === 0 && blue === 0) return 2; // black
  if (red > 20 && green < 10 && blue < 10) return 3; // red
  if (red < 10 && green > 20 && blue < 10) return 4; // green
  if (red > 20 && green > 20 && blue < 10) return 5; // yellow
  if (red < 10 && green < 10 && blue > 20) return 6; // blue
  if (red > 20 && green < 10 && blue > 20) return 7; // magenta
  if (red < 10 && green > 20 && blue > 20) return 8; // cyan
  if (red > 20 && green > 20 && blue > 20) return 9; // white

  // Default to gray scale based on intensity
  const intensity = (red + green + blue) / 3;
  if (intensity > 20) return 9; // white
  if (intensity > 15) return 10; // light grey
  if (intensity > 10) return 11; // medium grey
  if (intensity > 5) return 12; // dark grey
  return 2; // black
}

// Helper function to store true colors in window properties
function storeWindowTrueColors(machine: ZMachine, window: number, foreground: number, background: number): void {
  // This would need integration with the window property system
  // Here's a conceptual implementation

  // Assuming there's a window property storage system
  // setWindowProperty(machine, window, 16, foreground);
  // setWindowProperty(machine, window, 17, background);

  // For now, just log it
  machine.logger.debug(`Window ${window} true colors set to: fg=${foreground}, bg=${background}`);
}

function set_margins(
  machine: ZMachine,
  _operandTypes: OperandType[],
  left: number,
  right: number,
  window?: number
): void {
  machine.logger.debug(`${getSafePcHex(machine)} set_margins ${left} ${right} ${window ?? 'current'}`);

  if (machine.state.version < 5) {
    machine.logger.warn('set_margins only supported in V5+');
    return;
  }

  if (machine.screen.setWindowMargins) {
    machine.screen.setWindowMargins(machine, left, right, window);
  }
}

function move_window(machine: ZMachine, _operandTypes: OperandType[], window: number, y: number, x: number): void {
  machine.logger.debug(`${getSafePcHex(machine)} move_window ${window} ${y} ${x}`);

  if (machine.state.version < 6) {
    machine.logger.warn('move_window only supported in V6');
    return;
  }

  if (machine.screen.moveWindow) {
    machine.screen.moveWindow(machine, window, y, x);
  }
}

function window_size(
  machine: ZMachine,
  _operandTypes: OperandType[],
  window: number,
  height: number,
  width: number
): void {
  machine.logger.debug(`${getSafePcHex(machine)} window_size ${window} ${height} ${width}`);

  if (machine.state.version < 6) {
    machine.logger.warn('window_size only supported in V6');
    return;
  }

  if (machine.screen.resizeWindow) {
    machine.screen.resizeWindow(machine, window, height, width);
  }
}

function window_style(
  machine: ZMachine,
  _operandTypes: OperandType[],
  window: number,
  flags: number,
  operation: number = 0
): void {
  machine.logger.debug(`${getSafePcHex(machine)} window_style ${window} ${flags} ${operation}`);

  if (machine.state.version < 6) {
    machine.logger.warn('window_style only supported in V6');
    return;
  }

  if (machine.screen.setWindowStyle) {
    machine.screen.setWindowStyle(machine, window, flags, operation);
  }
}

function read_mouse(machine: ZMachine, _operandTypes: OperandType[], array: number): void {
  machine.logger.debug(`${getSafePcHex(machine)} read_mouse ${array.toString(16)}`);

  if (machine.state.version < 6) {
    machine.logger.warn('read_mouse only supported in V6');
    return;
  }

  if (machine.screen.readMouse) {
    machine.screen.readMouse(machine, array);
  } else {
    // Default: write zeros (no mouse activity)
    machine.memory.setWord(array, 0); // y
    machine.memory.setWord(array + 2, 0); // x
    machine.memory.setWord(array + 4, 0); // buttons
    machine.memory.setWord(array + 6, 0); // menu data
  }
}

function mouse_window(machine: ZMachine, _operandTypes: OperandType[], window: number): void {
  machine.logger.debug(`${getSafePcHex(machine)} mouse_window ${window}`);

  if (machine.state.version < 6) {
    machine.logger.warn('mouse_window only supported in V6');
    return;
  }

  if (machine.screen.setMouseWindow) {
    machine.screen.setMouseWindow(machine, window);
  }
}

function make_menu(machine: ZMachine, _operandTypes: OperandType[], _menu: number, _table: number): void {
  machine.logger.debug(`${getSafePcHex(machine)} make_menu ${_menu} ${_table}`);

  // Not implemented even by Infocom's Mac interpreter (always branches false)
  const [offset, branchOnFalse] = machine.state.readBranchOffset();
  machine.state.doBranch(false, branchOnFalse, offset);
}

function scroll_window(machine: ZMachine, _operandTypes: OperandType[], window: number, lines: number = 1): void {
  machine.logger.debug(`${getSafePcHex(machine)} scroll_window ${window} ${lines}`);

  if (machine.state.version < 6) {
    machine.logger.warn('scroll_window only supported in V6');
    return;
  }

  if (machine.screen.scrollWindow) {
    machine.screen.scrollWindow(machine, window, lines);
  }
}

function put_wind_prop(
  machine: ZMachine,
  _operandTypes: OperandType[],
  window: number,
  property: number,
  value: number
): void {
  machine.logger.debug(`${getSafePcHex(machine)} put_wind_prop ${window} ${property} ${value}`);

  if (machine.state.version < 6) {
    machine.logger.warn('put_wind_prop only supported in V6');
    return;
  }

  if (machine.screen.setWindowProperty) {
    machine.screen.setWindowProperty(machine, window, property, value);
  }
}

/**
 * Export all I/O opcodes
 */
export const ioOpcodes = {
  split_window: opcode('split_window', split_window),
  set_window: opcode('set_window', set_window),
  erase_window: opcode('erase_window', erase_window),
  erase_line: opcode('erase_line', erase_line),
  set_cursor: opcode('set_cursor', set_cursor),
  get_cursor: opcode('get_cursor', get_cursor),
  set_text_style: opcode('set_text_style', set_text_style),
  buffer_mode: opcode('buffer_mode', buffer_mode),
  output_stream: opcode('output_stream', output_stream),
  input_stream: opcode('input_stream', input_stream),
  sread: opcode('sread', sread),
  sound_effect: opcode('sound_effect', sound_effect),
  read_char: opcode('read_char', read_char),
  get_wind_prop: opcode('get_wind_prop', get_wind_prop),
  set_font: opcode('set_font', set_font),
  buffer_screen: opcode('buffer_screen', buffer_screen),
  set_true_colour: opcode('set_true_colour', set_true_colour),
  set_colour: opcode('set_colour', set_colour),
  set_margins: opcode('set_margins', set_margins),
  move_window: opcode('move_window', move_window),
  window_size: opcode('window_size', window_size),
  window_style: opcode('window_style', window_style),
  read_mouse: opcode('read_mouse', read_mouse),
  mouse_window: opcode('mouse_window', mouse_window),
  make_menu: opcode('make_menu', make_menu),
  scroll_window: opcode('scroll_window', scroll_window),
  put_wind_prop: opcode('put_wind_prop', put_wind_prop),
};

// Export individual functions for testing
export { sound_effect };
