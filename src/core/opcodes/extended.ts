// src/core/opcodes/extended.ts

import { ZMachine } from "../../interpreter/ZMachine";
import { opcode } from "./base";
import { toI16, toU16 } from "../memory/cast16";

/**
 * Binary left arithmetic shift (preserves sign)
 */
function art_shift(machine: ZMachine, value: number, places: number): void {
  const resultVar = machine.state.readByte();

  const signedPlaces = toI16(places);
  let result: number;

  if (signedPlaces >= 0) {
    // Left shift
    result = (value << signedPlaces) & 0xffff;
  } else {
    // Right arithmetic shift (preserves sign)
    result = toU16(toI16(value) >> Math.abs(signedPlaces));
  }

  machine.state.storeVariable(resultVar, result);
}

/**
 * Binary logical shift (does not preserve sign on right shift)
 */
function log_shift(machine: ZMachine, value: number, places: number): void {
  const resultVar = machine.state.readByte();

  const signedPlaces = toI16(places);
  let result: number;

  if (signedPlaces >= 0) {
    // Left shift
    result = (value << signedPlaces) & 0xffff;
  } else {
    // Right logical shift (zero-fill)
    result = (value >>> Math.abs(signedPlaces)) & 0xffff;
  }

  machine.state.storeVariable(resultVar, result);
}

/**
 * Set the font for text output
 */
function set_font(machine: ZMachine, font: number): void {
  const resultVar = machine.state.readByte();

  // In a real implementation, this would change the font
  // For now, just return the previous font (always 1)
  machine.state.storeVariable(resultVar, 1);
}

/**
 * Copy a region of memory
 */
function copy_table(
  machine: ZMachine,
  sourceAddr: number,
  destAddr: number,
  size: number
): void {
  if (size === 0) {
    return; // No-op
  }

  const sourceSize = Math.abs(size);
  const sourceEnd = sourceAddr + sourceSize;

  if (destAddr === 0) {
    // Just check that source region is valid
    if (sourceAddr < 0 || sourceEnd > machine.memory.size) {
      throw new Error(`Invalid copy_table source range: ${sourceAddr}-${sourceEnd}`);
    }
    return;
  }

  if (size > 0) {
    // Positive size: normal copy
    machine.memory.copyBlock(sourceAddr, destAddr, size);
  } else {
    // Negative size: fill destination with zeros
    for (let i = 0; i < sourceSize; i++) {
      machine.memory.setByte(destAddr + i, 0);
    }
  }
}

/**
 * Print a Unicode character
 */
function print_unicode(machine: ZMachine, charCode: number): void {
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

  // For now, we'll just check if it's in the basic ASCII range
  const canDisplay = charCode >= 32 && charCode <= 126;
  machine.state.storeVariable(resultVar, canDisplay ? 3 : 0);
}

/**
 * Set true color (24-bit RGB)
 */
function set_true_colour(
  machine: ZMachine,
  foreground: number,
  background: number
): void {
  // In a real implementation, this would set 24-bit colors
  // For now, we'll just pass it through to set_color
  machine.screen.setTrueColors(machine, foreground, background);
}

/**
 * Export extended opcodes
 */
export const extendedOpcodes = {
  art_shift: opcode("art_shift", art_shift),
  log_shift: opcode("log_shift", log_shift),
  set_font: opcode("set_font", set_font),
  copy_table: opcode("copy_table", copy_table),
  print_unicode: opcode("print_unicode", print_unicode),
  check_unicode: opcode("check_unicode", check_unicode),
  set_true_colour: opcode("set_true_colour", set_true_colour),
};
