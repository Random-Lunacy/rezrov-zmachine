/**
 * Debugging utilities for the Z-machine interpreter
 */
import { GameObject } from '../core/objects/GameObject';
import { ZMachine } from '../interpreter/ZMachine';
import { decodeZString } from '../parsers/ZString';
import { Address, ZSCII } from '../types';
import { HeaderLocation, KnownGlobals } from './constants';

/**
 * Convert a number to hexadecimal string representation
 * @param v The number to convert
 * @returns Hexadecimal string representation
 */
export function hex(v: number): string {
  return v !== undefined ? v.toString(16) : '';
}

/**
 * Dump the header information to the console
 * @param machine The Z-machine instance
 */
export function dumpHeader(machine: ZMachine): void {
  const memory = machine.state.memory;
  const logger = machine.logger;

  logger.debug('Header Information:');
  logger.debug(`Z-code version:           ${memory.getByte(HeaderLocation.Version)}`);
  logger.debug(`Initial PC:               ${hex(memory.getWord(HeaderLocation.InitialPC))}`);
  logger.debug(`Global variables address: ${hex(memory.getWord(HeaderLocation.GlobalVariables))}`);
  logger.debug(`Alphabet table address:   ${hex(memory.getWord(HeaderLocation.AlphabetTable))}`);
  logger.debug(`Object table address:     ${hex(memory.getWord(HeaderLocation.ObjectTable))}`);
  logger.debug(`Dictionary address:       ${hex(memory.getWord(HeaderLocation.Dictionary))}`);
  logger.debug(`Static memory base:       ${hex(memory.getWord(HeaderLocation.StaticMemBase))}`);
  logger.debug(`High memory base:         ${hex(memory.getWord(HeaderLocation.HighMemBase))}`);

  // Version specific information
  const version = memory.getByte(HeaderLocation.Version);
  if (version >= 5) {
    logger.debug(`Routines offset:          ${hex(memory.getWord(HeaderLocation.RoutinesOffset))}`);
    logger.debug(`Static strings offset:    ${hex(memory.getWord(HeaderLocation.StaticStringsOffset))}`);
  }

  // Screen properties
  logger.debug(`Screen height (lines):    ${memory.getByte(HeaderLocation.ScreenHeightInLines)}`);
  logger.debug(`Screen width (chars):     ${memory.getByte(HeaderLocation.ScreenWidthInChars)}`);

  logger.debug('');
}

/**
 * Dump object table information to the console
 * @param machine The Z-machine instance
 */
export function dumpObjectTable(machine: ZMachine): void {
  const state = machine.state;
  const logger = machine.logger;
  const rootObjects: Array<GameObject> = [];

  // Find all objects without parents
  for (let i = 1; i < (state.version <= 3 ? 256 : 65536); i++) {
    const obj = state.getObject(i);
    if (obj === null) {
      continue;
    }
    if (obj.parent === null) {
      rootObjects.push(obj);
    }
  }

  logger.debug(`Found ${rootObjects.length} root objects`);
  rootObjects.forEach((obj) => dumpObjectHierarchy(obj, logger));
  logger.debug('');
}

/**
 * Recursively dump an object and its children
 * @param obj The object to dump
 * @param logger The logger to use
 * @param indent Indentation level for formatting
 */
function dumpObjectHierarchy(obj: GameObject, logger: any, indent = 0): void {
  const indentStr = '  '.repeat(indent);
  logger.debug(`${indentStr}[${obj.objNum}] "${obj.name}"`);

  // Dump attributes
  let attrList = '';
  const maxAttrs = obj.getMaxAttributes();
  for (let i = 0; i < maxAttrs; i++) {
    if (obj.hasAttribute(i)) {
      attrList += `${i} `;
    }
  }
  if (attrList.length > 0) {
    logger.debug(`${indentStr}  Attributes: ${attrList}`);
  }

  // Dump properties (implementation would depend on how properties are exposed)
  // This is a placeholder - actual implementation would need to access property information
  logger.debug(`${indentStr}  Properties: [Property dumping not implemented]`);

  // Recursively dump children
  for (let child = obj.child; child !== null; child = child.sibling) {
    dumpObjectHierarchy(child, logger, indent + 1);
  }
}

/**
 * Dump the dictionary to the console
 * @param machine The Z-machine instance
 */
export function dumpDictionary(machine: ZMachine): void {
  const state = machine.state;
  const memory = state.memory;
  const logger = machine.logger;

  const dictAddr = memory.getWord(HeaderLocation.Dictionary);
  logger.debug('Dictionary:');

  // Read separator characters
  const numSeparators = memory.getByte(dictAddr);
  let currentAddr = dictAddr + 1;

  const separators: Array<ZSCII> = [];
  for (let i = 0; i < numSeparators; i++) {
    separators.push(memory.getByte(currentAddr++));
  }

  logger.debug(`Separators: ${separators.map((ch) => String.fromCharCode(ch)).join(' ')}`);

  // Read entry information
  const entryLength = memory.getByte(currentAddr++);
  const numEntries = memory.getWord(currentAddr);
  currentAddr += 2;

  // Dump dictionary entries
  for (let i = 0; i < numEntries; i++) {
    // Read and decode the entry text
    const entryText = decodeZString(memory, memory.getZString(currentAddr), false);

    logger.debug(` [${i}] "${entryText}" ${hex(memory.getWord(currentAddr))} ${hex(memory.getWord(currentAddr + 2))}`);

    currentAddr += entryLength;
  }

  logger.debug('');
}

/**
 * Dump the parse buffer to the console
 * @param machine The Z-machine instance
 * @param parseBuffer Address of the parse buffer
 */
export function dumpParseBuffer(machine: ZMachine, parseBuffer: Address): void {
  const memory = machine.state.memory;
  const logger = machine.logger;

  const maxTokens = memory.getByte(parseBuffer);
  const tokenCount = memory.getByte(parseBuffer + 1);

  logger.debug(`Parse buffer at ${hex(parseBuffer)}: max = ${maxTokens}, count = ${tokenCount} tokens = [`);

  let currentAddr = parseBuffer + 2;
  for (let i = 0; i < tokenCount; i++) {
    const dictAddr = memory.getWord(currentAddr);
    currentAddr += 2;

    const length = memory.getByte(currentAddr++);
    const position = memory.getByte(currentAddr++);

    logger.debug(` (${hex(dictAddr)}, ${hex(position)}, ${hex(length)})`);
  }

  logger.debug(' ]');
}

/**
 * Dump the current Z-machine state
 * @param machine The Z-machine instance
 */
export function dumpState(machine: ZMachine): void {
  const state = machine.state;
  const logger = machine.logger;

  logger.debug('=== Z-Machine State ===');
  logger.debug(`PC: ${hex(state.pc)}`);
  logger.debug(`Stack: [${state.stack.map((v) => hex(v)).join(', ')}]`);
  logger.debug(`Call stack depth: ${state.callstack.length}`);

  // Dump global variables of interest
  const globalVarsAddr = state.globalVariablesAddress;
  const location = state.memory.getWord(globalVarsAddr + 2 * KnownGlobals.Location);
  const locationObj = state.getObject(location);

  logger.debug(`Current location: ${location} (${locationObj ? locationObj.name : 'unknown'})`);

  // For score games
  if (state.version < 3 || (state.memory.getByte(HeaderLocation.Flags1) & 0x02) === 0) {
    const score = state.memory.getWord(globalVarsAddr + 2 * KnownGlobals.Score);
    const moves = state.memory.getWord(globalVarsAddr + 2 * KnownGlobals.NumTurns);
    logger.debug(`Score: ${score}, Moves: ${moves}`);
  } else {
    // For time games
    const hours = state.memory.getWord(globalVarsAddr + 2 * KnownGlobals.Hours);
    const minutes = state.memory.getWord(globalVarsAddr + 2 * KnownGlobals.Minutes);
    logger.debug(`Time: ${hours}:${minutes.toString().padStart(2, '0')}`);
  }

  logger.debug('====================');
}
