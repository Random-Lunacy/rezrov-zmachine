import { vi } from 'vitest';
import { Executor } from '../../src/core/execution/Executor';
import { Logger } from '../../src/utils/log';
import { MockGameState } from './MockGameState';
import { MockInputProcessor } from './MockInputProcessor';
import { MockMemory } from './MockMemory';
import { MockScreen } from './MockScreen';

export class MockZMachine {
  state = new MockGameState() as any;
  screen = new MockScreen() as any;
  memory = new MockMemory() as any;
  inputProcessor = new MockInputProcessor() as any;

  logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as Logger;

  executor: Executor = {} as Executor; // Will be set by test

  getInputState = vi.fn().mockReturnValue(null);
  handleTimedInput = vi.fn();
  saveGame = vi.fn().mockResolvedValue(true);
  restoreGame = vi.fn().mockResolvedValue(true);
  saveToTable = vi.fn().mockResolvedValue(true);
  restoreFromTable = vi.fn().mockResolvedValue(true);
  saveUndo = vi.fn().mockReturnValue(true);
  restoreUndo = vi.fn().mockReturnValue(true);
  restart = vi.fn();
  quit = vi.fn();
  updateStatusBar = vi.fn();
  getUserStackManager = vi.fn().mockReturnValue({});
  storage = {};

  constructor() {
    // Empty constructor
  }
}
