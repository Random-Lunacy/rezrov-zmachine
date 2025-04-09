import { Memory } from "../core/memory/Memory";
import { ZSCII } from "../types";

export type ZString = Array<ZSCII>;

const alphabet_table = [
  /* A0 */ "abcdefghijklmnopqrstuvwxyz",
  /* A1 */ "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  /* A2 */ " \n0123456789.,!?_#'\"/\\-:()",
];

export function decodeZString(
  memory: Memory,
  zstr: ZString,
  expand: boolean = false
): string {
  // Z-string decoding logic will go here
  return "";
}

export function encodeZString(text: string, padding: number = 0x05): ZString {
  // Z-string encoding logic will go here
  return [];
}
