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
import { HeaderLocation } from '../../utils/constants';
import { toI16 } from '../memory/cast16';
import { opcode } from './base';

/**
 * Split the screen into two windows
 */
function split_window(machine: ZMachine, lines: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} split_window ${lines}`);
  machine.screen.splitWindow(machine, lines);
}

/**
 * Set the active output window
 */
function set_window(machine: ZMachine, window: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} set_window ${window}`);
  machine.screen.setOutputWindow(machine, window);
}

/**
 * Clear a window
 */
function erase_window(machine: ZMachine, window: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} erase_window ${window}`);
  machine.screen.clearWindow(machine, window);
}

/**
 * Clear the current line
 */
function erase_line(machine: ZMachine, value: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} erase_line ${value}`);
  machine.screen.clearLine(machine, value);
}

/**
 * Set the cursor position
 */
function set_cursor(machine: ZMachine, line: number, column: number, window: number = 0): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} set_cursor ${line} ${column}`);

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
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} get_cursor ${array}`);
  machine.logger.warn(`get_cursor ${array} -- not implemented`);
}

/**
 * Set the text style
 */
function set_text_style(machine: ZMachine, style: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} set_text_style ${style}`);

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
function buffer_mode(machine: ZMachine, flag: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} buffer_mode ${flag}`);
  machine.screen.setBufferMode(machine, flag);
}

/**
 * Enable or disable an output stream
 */
function output_stream(machine: ZMachine, streamNum: number, table: number = 0, width: number = 0): void {
  const streamNumber = toI16(streamNum);

  machine.logger.debug(`${machine.executor.op_pc.toString(16)} output_stream ${streamNum} ${table} ${width}`);

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
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} input_stream ${streamNum}`);
  machine.screen.selectInputStream(machine, toI16(streamNum));
}

/**
 * Read a line of input from the user. This opcode is used for both
 * sread and aread, depending on the version of the Z-Machine.
 * In V5+, we need to store the terminating character
 */
function sread(
  machine: ZMachine,
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

  machine.logger.debug(`sread/aread: text=${textBuffer}, parse=${parseBuffer}, time=${time}, routine=${routine}`);

  // Update status bar if needed
  machine.state.updateStatusBar();

  // Suspend for text input
  throw new SuspendState({
    keyPress: false,
    resultVar,
    textBuffer,
    parseBuffer,
    time,
    routine,
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
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} sound_effect ${number} ${effect} ${volume} ${routine}`);
  machine.logger.warn(`sound_effect ${number} -- not implemented`);
}

/**
 * Read a single character from the user
 */
function read_char(machine: ZMachine, device: number = 0, time: number = 0, routine: number = 0): void {
  const resultVar = machine.state.readByte();

  machine.logger.debug(`${machine.executor.op_pc.toString(16)} read_char ${device} ${time} ${routine}`);

  // Suspend for key input
  throw new SuspendState({
    keyPress: true,
    resultVar,
    time,
    routine,
  });
}

function get_wind_prop(machine: ZMachine, window: number, property: number): void {
  const resultVar = machine.state.readByte();

  machine.logger.debug(`${machine.executor.op_pc.toString(16)} get_wind_prop ${window} ${property} -> (${resultVar})`);

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
function set_font(machine: ZMachine, font: number, window: number = -3): void {
  const resultVar = machine.state.readByte();

  machine.logger.debug(`${machine.executor.op_pc.toString(16)} set_font ${font} ${window}`);

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
function buffer_screen(machine: ZMachine, mode: number): void {
  const resultVar = machine.state.readByte();

  // Get current buffer mode to return as the result
  const currentMode = machine.screen.getBufferMode(machine);

  machine.logger.debug(`${machine.executor.op_pc.toString(16)} buffer_screen ${mode} -> (${resultVar})`);

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
 */
function set_colour(machine: ZMachine, foreground: number, background: number, window: number = 0): void {
  if (machine.state.version < 5) {
    machine.logger.debug(`set_colour: ignoring in version < 5`);
    window = 0;
  }

  machine.logger.debug(`${machine.executor.op_pc.toString(16)} set_colour ${foreground} ${background} ${window}`);

  if (machine.state.version === 6) {
    if (!handleTransparency(machine, foreground, background)) {
      return;
    }
    foreground = ensureValidForeground(machine, foreground);
  }

  machine.screen.setTextColors(machine, window, foreground, background);
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

  machine.logger.debug(`${machine.executor.op_pc.toString(16)} set_true_colour ${foreground} ${background} ${window}`);

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

function set_margins(machine: ZMachine, left: number, right: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} set_margins ${left} ${right}`);
  machine.logger.warn(`set_margins ${left} ${right} -- not implemented`);
  throw new Error(`Unimplemented opcode: set_margins`);
}

function move_window(machine: ZMachine, window: number, x: number, y: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} move_window ${window} ${x} ${y}`);
  machine.logger.warn(`move_window ${window} ${x} ${y} -- not implemented`);
  throw new Error(`Unimplemented opcode: move_window`);
}

function window_size(machine: ZMachine, window: number, width: number, height: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} window_size ${window} ${width} ${height}`);
  machine.logger.warn(`window_size ${window} ${width} ${height} -- not implemented`);
  throw new Error(`Unimplemented opcode: window_size`);
}

function window_style(machine: ZMachine, window: number, style: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} window_style ${window} ${style}`);
  machine.logger.warn(`window_style ${window} ${style} -- not implemented`);
  throw new Error(`Unimplemented opcode: window_style`);
}

function read_mouse(machine: ZMachine, window: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} read_mouse ${window}`);
  machine.logger.warn(`read_mouse ${window} -- not implemented`);
  throw new Error(`Unimplemented opcode: read_mouse`);
}

function mouse_window(machine: ZMachine, window: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} mouse_window ${window}`);
  machine.logger.warn(`mouse_window ${window} -- not implemented`);
  throw new Error(`Unimplemented opcode: mouse_window`);
}

function make_menu(machine: ZMachine, menu: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} make_menu ${menu}`);
  machine.logger.warn(`make_menu ${menu} -- not implemented`);
  throw new Error(`Unimplemented opcode: make_menu`);
}

function scroll_window(machine: ZMachine, window: number, lines: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} scroll_window ${window} ${lines}`);
  machine.logger.warn(`scroll_window ${window} ${lines} -- not implemented`);
  throw new Error(`Unimplemented opcode: scroll_window`);
}

function put_wind_prop(machine: ZMachine, window: number, property: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} put_wind_prop ${window} ${property}`);
  machine.logger.warn(`put_wind_prop ${window} ${property} -- not implemented`);
  throw new Error(`Unimplemented opcode: put_wind_prop`);
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
