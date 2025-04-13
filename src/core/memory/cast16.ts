/**
 * Utility functions for converting between signed and unsigned 16-bit integers
 * Uses TypedArrays to perform bit-level conversions without manual bit manipulation
 */

// Create a 2-byte buffer to hold a single 16-bit value
const cvt_buffer = new ArrayBuffer(2);

// Create views of the same buffer with different interpretations
const i16_array = new Int16Array(cvt_buffer);
const u16_array = new Uint16Array(cvt_buffer);

/**
 * Convert an unsigned 16-bit integer to a signed 16-bit integer
 * @param ui16 The unsigned integer to convert (0-65535)
 * @returns The equivalent signed integer (-32768 to 32767)
 */
export function toI16(ui16: number): number {
  u16_array[0] = ui16;
  return i16_array[0];
}

/**
 * Convert a signed 16-bit integer to an unsigned 16-bit integer
 * @param i16 The signed integer to convert (-32768 to 32767)
 * @returns The equivalent unsigned integer (0-65535)
 */
export function toU16(i16: number): number {
  i16_array[0] = i16;
  return u16_array[0];
}
