import { vi } from 'vitest';
import { Executor } from '../../src/core/execution/Executor';
import { Logger } from '../../src/utils/log';
import { BaseMultimediaHandler } from '../../src/ui/multimedia/MultimediaHandler';
import { MockGameState } from './MockGameState';
import { MockInputProcessor } from './MockInputProcessor';
import { MockMemory } from './MockMemory';
import { MockScreen } from './MockScreen';

export class MockZMachine {
  state = new MockGameState() as any;
  screen = new MockScreen() as any;
  memory = new MockMemory() as any;
  inputProcessor = new MockInputProcessor() as any;
  multimediaHandler = new BaseMultimediaHandler() as any;

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
  saveAuxiliary = vi.fn().mockResolvedValue(true);
  restoreAuxiliary = vi.fn().mockResolvedValue(0);
  saveUndo = vi.fn().mockReturnValue(true);
  restoreUndo = vi.fn().mockReturnValue(true);
  restart = vi.fn();
  quit = vi.fn();
  updateStatusBar = vi.fn();
  getUserStackManager = vi.fn().mockReturnValue({});
  originalStory = Buffer.alloc(0);
  storage = {};

  constructor() {
    // Empty constructor
  }
}
