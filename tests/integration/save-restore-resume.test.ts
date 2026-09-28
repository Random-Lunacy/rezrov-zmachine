import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gameOpcodes } from '../../src/core/opcodes/game';
import { ZMachine } from '../../src/interpreter/ZMachine';
import { HeaderLocation } from '../../src/utils/constants';
import { Logger, LogLevel } from '../../src/utils/log';
import { MockInputProcessor, MockScreen } from '../mocks';

Logger.setLogToConsole(false);
Logger.setLevel(LogLevel.ERROR);

/**
 * A successful restore (or restore_undo) resumes at the SAVE instruction and completes it as
 * "restored": 2 stored in the save's result variable (V4+), or its branch taken (V1-3). These
 * tests use a real machine and deliberately give the save and the restore different result
 * variables, so a restore that writes its own variable instead fails them.
 */

// Addresses of each instruction's operand byte(s), as the executor leaves the PC after decoding
const SAVE_AT = 0x2000;
const RESTORE_AT = 0x2100;
const GLOBALS = 0x0300;
const SAVE_RESULT = 0x10; // Global 0
const RESTORE_RESULT = 0x11; // Global 1
const BRANCH_TRUE_PLUS_10 = 0xca; // Branch on true, short form, offset 10
const BRANCH_TRUE_PLUS_5 = 0xc5; // Branch on true, short form, offset 5

function makeStory(version: number): Buffer {
  const story = Buffer.alloc(0x10000);
  story[HeaderLocation.Version] = version;
  story.writeUInt16BE(0x2000, HeaderLocation.InitialPC);
  story.writeUInt16BE(0x0100, HeaderLocation.ObjectTable);
  story.writeUInt16BE(0x0200, HeaderLocation.Dictionary);
  story.writeUInt16BE(GLOBALS, HeaderLocation.GlobalVariables);
  story.writeUInt16BE(0x4000, HeaderLocation.StaticMemBase);
  story.writeUInt16BE(0x5000, HeaderLocation.HighMemBase);
  return story;
}

function global(machine: ZMachine, index: number): number {
  return machine.memory.getWord(GLOBALS + 2 * index);
}

describe('Resuming after restore and restore_undo', () => {
  let inputProcessor: MockInputProcessor;

  beforeEach(() => {
    inputProcessor = new MockInputProcessor();
  });

  function makeMachine(version: number, operands: { save: number; restore: number }): ZMachine {
    const story = makeStory(version);
    story[SAVE_AT] = operands.save;
    story[RESTORE_AT] = operands.restore;
    return new ZMachine(story, new MockScreen(), inputProcessor);
  }

  it('should complete save_undo with 2 in its own variable after restore_undo (V5)', async () => {
    const machine = makeMachine(5, { save: SAVE_RESULT, restore: RESTORE_RESULT });

    machine.state.pc = SAVE_AT;
    await gameOpcodes.save_undo.impl(machine, []);
    expect(global(machine, 0)).toBe(1);

    machine.state.pc = RESTORE_AT;
    await gameOpcodes.restore_undo.impl(machine, []);

    expect(machine.state.pc).toBe(SAVE_AT + 1);
    expect(global(machine, 0)).toBe(2);
    expect(global(machine, 1)).toBe(0); // restore_undo's own variable is untouched
  });

  it('should complete save with 2 in its own variable after restore (V5)', async () => {
    const machine = makeMachine(5, { save: SAVE_RESULT, restore: RESTORE_RESULT });

    machine.state.pc = SAVE_AT;
    await gameOpcodes.save.impl(machine, []);
    expect(global(machine, 0)).toBe(1);

    machine.state.pc = RESTORE_AT;
    await gameOpcodes.restore.impl(machine, []);

    // Zork Zero's V-SAVE tests this variable: 0 would print "SAVE failed!"
    expect(machine.state.pc).toBe(SAVE_AT + 1);
    expect(global(machine, 0)).toBe(2);
    expect(global(machine, 1)).toBe(0);
  });

  it('should treat save and restore as store instructions in V4', async () => {
    const machine = makeMachine(4, { save: SAVE_RESULT, restore: RESTORE_RESULT });

    machine.state.pc = SAVE_AT;
    await gameOpcodes.save.impl(machine, []);
    expect(global(machine, 0)).toBe(1);

    machine.state.pc = RESTORE_AT;
    await gameOpcodes.restore.impl(machine, []);

    expect(machine.state.pc).toBe(SAVE_AT + 1);
    expect(global(machine, 0)).toBe(2);
  });

  it("should take the save's branch, not the restore's, after a restore (V3)", async () => {
    // Different offsets, so taking the restore's own branch lands somewhere else
    const machine = makeMachine(3, { save: BRANCH_TRUE_PLUS_10, restore: BRANCH_TRUE_PLUS_5 });

    machine.state.pc = SAVE_AT;
    await gameOpcodes.save.impl(machine, []);
    expect(machine.state.pc).toBe(SAVE_AT + 1 + 10 - 2);

    machine.state.pc = RESTORE_AT;
    await gameOpcodes.restore.impl(machine, []);

    expect(machine.state.pc).toBe(SAVE_AT + 1 + 10 - 2);
  });

  it("should store 0 in the restore's own variable when the restore fails", async () => {
    const machine = makeMachine(5, { save: SAVE_RESULT, restore: RESTORE_RESULT });
    machine.memory.setWord(GLOBALS + 2, 99);

    machine.state.pc = RESTORE_AT;
    await gameOpcodes.restore.impl(machine, []); // Nothing saved yet

    expect(machine.state.pc).toBe(RESTORE_AT + 1);
    expect(global(machine, 1)).toBe(0);
  });

  it('should fail the save, without writing a file, when the filename prompt is cancelled', async () => {
    const machine = makeMachine(5, { save: SAVE_RESULT, restore: RESTORE_RESULT });
    inputProcessor.promptForFilename = vi.fn().mockResolvedValue('');
    const saveSnapshot = vi.spyOn(machine.storage, 'saveSnapshot');

    machine.state.pc = SAVE_AT;
    await gameOpcodes.save.impl(machine, []);

    expect(inputProcessor.promptForFilename).toHaveBeenCalledWith(machine, 'save');
    expect(saveSnapshot).not.toHaveBeenCalled();
    expect(global(machine, 0)).toBe(0);
  });

  it('should restore from the file the player names', async () => {
    const machine = makeMachine(5, { save: SAVE_RESULT, restore: RESTORE_RESULT });
    inputProcessor.promptForFilename = vi.fn().mockResolvedValue('castle.sav');

    machine.state.pc = SAVE_AT;
    await gameOpcodes.save.impl(machine, []);

    inputProcessor.promptForFilename = vi.fn().mockResolvedValue('other.sav');
    machine.state.pc = RESTORE_AT;
    await gameOpcodes.restore.impl(machine, []);
    expect(global(machine, 1)).toBe(0); // other.sav doesn't exist: restore failed
    expect(machine.state.pc).toBe(RESTORE_AT + 1);

    inputProcessor.promptForFilename = vi.fn().mockResolvedValue('castle.sav');
    machine.state.pc = RESTORE_AT;
    await gameOpcodes.restore.impl(machine, []);
    expect(inputProcessor.promptForFilename).toHaveBeenCalledWith(machine, 'restore');
    expect(global(machine, 0)).toBe(2);
  });
});
