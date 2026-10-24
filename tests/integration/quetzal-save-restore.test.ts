import { beforeEach, describe, expect, it } from 'vitest';
import { gameOpcodes } from '../../src/core/opcodes/game';
import { ZMachine } from '../../src/interpreter/ZMachine';
import { QuetzalFormat } from '../../src/storage/formats/QuetzalFormat';
import { MemoryStorageProvider } from '../../src/storage/providers/MemoryStorageProvider';
import { HeaderLocation } from '../../src/utils/constants';
import { Logger, LogLevel } from '../../src/utils/log';
import { MockInputProcessor, MockScreen } from '../mocks';

Logger.setLogToConsole(false);
Logger.setLevel(LogLevel.ERROR);

/**
 * Saves are written and read back through a real Quetzal format. Memory is modified in place while
 * a game runs, so saves must be diffed against (and restored over) the pristine story, and every
 * chunk, including an odd-length CMem, must be padded to an even length (IFF).
 */

const SAVE_AT = 0x2000;
const GLOBALS = 0x0300;
const SAVE_RESULT = 0x10;
const SAVE_FILE = 'game.qzl';

function makeStory(): Buffer {
  const story = Buffer.alloc(0x10000);
  story[HeaderLocation.Version] = 3;
  story.writeUInt16BE(0x2000, HeaderLocation.InitialPC);
  story.writeUInt16BE(0x0100, HeaderLocation.ObjectTable);
  story.writeUInt16BE(0x0200, HeaderLocation.Dictionary);
  story.writeUInt16BE(GLOBALS, HeaderLocation.GlobalVariables);
  story.writeUInt16BE(0x4000, HeaderLocation.StaticMemBase);
  story.writeUInt16BE(0x5000, HeaderLocation.HighMemBase);
  story[SAVE_AT] = 0xca; // Branch on true, short form, offset 10
  return story;
}

function makeMachine(provider: MemoryStorageProvider, inputProcessor: MockInputProcessor): ZMachine {
  return new ZMachine(makeStory(), new MockScreen(), inputProcessor, undefined, provider, new QuetzalFormat());
}

describe('Quetzal save and restore through a running machine', () => {
  let provider: MemoryStorageProvider;
  let inputProcessor: MockInputProcessor;

  beforeEach(() => {
    provider = new MemoryStorageProvider();
    inputProcessor = new MockInputProcessor();
    inputProcessor.promptForFilename = (() => Promise.resolve(SAVE_FILE)) as typeof inputProcessor.promptForFilename;
  });

  async function save(machine: ZMachine): Promise<void> {
    machine.state.pc = SAVE_AT;
    await gameOpcodes.save.impl(machine, []);
  }

  async function restore(machine: ZMachine): Promise<void> {
    machine.state.pc = SAVE_AT;
    await gameOpcodes.restore.impl(machine, []);
  }

  it('should write a file whose chunks are all padded to an even length', async () => {
    // Different amounts of change compress to chunks of different lengths; some of them are odd
    let sawOddCMem = false;

    for (let changed = 1; changed <= 6; changed++) {
      const machine = makeMachine(provider, inputProcessor);
      for (let i = 0; i < changed; i++) {
        machine.memory.setByte(0x0400 + i * 7, 0x7f);
      }
      await save(machine);

      const file = (await provider.read(SAVE_FILE))!;
      let offset = 12;
      const ids: string[] = [];
      while (offset < file.length) {
        const id = file.toString('ascii', offset, offset + 4);
        const size = file.readUInt32BE(offset + 4);
        ids.push(id);
        if (id === 'CMem' && size % 2 === 1) sawOddCMem = true;
        offset += 8 + size + (size % 2);
      }

      expect(ids).toEqual(['IFhd', 'CMem', 'Stks']);
      expect(offset).toBe(file.length);
      expect(file.readUInt32BE(4)).toBe(file.length - 8);
    }

    expect(sawOddCMem).toBe(true);
  });

  it('should restore memory saved earlier in the same game', async () => {
    const machine = makeMachine(provider, inputProcessor);
    machine.memory.setByte(0x0400, 0x7f);
    await save(machine);

    machine.memory.setByte(0x0400, 0x11);
    machine.memory.setByte(0x0500, 0x22);
    await restore(machine);

    expect(machine.memory.getByte(0x0400)).toBe(0x7f);
    expect(machine.memory.getByte(0x0500)).toBe(0);
  });

  it('should restore a save into a new game', async () => {
    const first = makeMachine(provider, inputProcessor);
    first.memory.setByte(0x0400, 0x7f);
    first.memory.setByte(0x0402, 0x33);
    await save(first);

    const second = makeMachine(provider, inputProcessor);
    second.memory.setByte(0x0600, 0x44); // Progress made before restoring
    await restore(second);

    expect(second.memory.getByte(0x0400)).toBe(0x7f);
    expect(second.memory.getByte(0x0402)).toBe(0x33);
    expect(second.memory.getByte(0x0600)).toBe(0);
  });
});
