import { readFileSync } from 'fs';
import type { ZMachineState } from '../../src/types';

/**
 * A fixed, hand-made game state over the minimal.z3 fixture, used to prove saves stay compatible across
 * releases: tests/fixtures/saves/rc1-state.* were written from this state by 1.0.0-rc.1.
 */
export function buildFixtureState(): ZMachineState {
  const story = readFileSync(new URL('../fixtures/minimal.z3', import.meta.url));
  const memory = Uint8Array.from(story);

  // Dynamic memory ends at 0x04eb for this story, so these are all legal writes
  memory[0x100] = 0x01;
  memory[0x200] = 0x02;
  memory[0x300] = 0xff;
  memory[0x4ea] = 0x7f;

  return {
    memory,
    pc: 0x0511,
    stack: [1, 2, 3, 0xffff],
    callFrames: [
      {
        returnPC: 0x0520,
        discardResult: false,
        storeVariable: 16,
        argumentMask: [true, false, true],
        locals: [10, 20, 30],
        stack: [40, 50, 60],
      },
      {
        returnPC: 0x0530,
        discardResult: true,
        storeVariable: 0,
        argumentMask: [true],
        locals: [0xffff],
        stack: [],
      },
    ],
    originalStory: Uint8Array.from(story),
  } as ZMachineState;
}
