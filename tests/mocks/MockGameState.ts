import { vi } from 'vitest';
import { GameObject } from '../../src/core/objects/GameObject';

export class MockGameState {
  pc = 0x1000;
  version = 3;
  stack = [];
  callstack = [];
  memory = {
    getByte: vi.fn().mockReturnValue(0),
    getWord: vi.fn().mockReturnValue(0),
    unpackRoutineAddress: vi.fn().mockImplementation((addr: number) => addr * 2),
    validateRoutineHeader: vi.fn().mockReturnValue(true),
  };

  logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  readByte = vi.fn().mockReturnValue(0);
  readWord = vi.fn().mockReturnValue(0);
  readBranchOffset = vi.fn().mockReturnValue([0, false] as [number, boolean]);
  readZString = vi.fn().mockReturnValue([]);
  storeVariable = vi.fn();
  loadVariable = vi.fn().mockReturnValue(0);
  doBranch = vi.fn();
  pushStack = vi.fn();
  popStack = vi.fn().mockReturnValue(0);
  peekStack = vi.fn().mockReturnValue(0);
  getArgumentCount = vi.fn().mockReturnValue(0);
  callRoutine = vi.fn();
  returnFromRoutine = vi.fn();
  tokenizeLine = vi.fn();
  updateStatusBar = vi.fn();
  getObject = vi.fn().mockReturnValue(null as unknown as GameObject | null);
  getRootObjects = vi.fn().mockReturnValue([]);
}
