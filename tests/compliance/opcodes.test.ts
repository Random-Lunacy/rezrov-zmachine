import { describe, it, expect } from 'vitest';
import { ZMachine } from '../../src/interpreter/ZMachine';
import { TestScreen } from '../mocks/TestScreen';
import { TestStorage } from '../mocks/TestStorage';
import { Logger, LogLevel } from '../../src/utils/log';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Z-machine compliance', () => {
  it('correctly implements je opcode behavior', () => {
    // Setup minimal environment to test an opcode
    const testStory = readFileSync(join(__dirname, '../fixtures/je_test.z3'));
    const logger = new Logger(LogLevel.ERROR);
    const screen = new TestScreen(logger);
    const storage = new TestStorage();

    const machine = new ZMachine(testStory, logger, screen, storage);

    // Execute the test program which uses je opcode
    machine.execute();

    // Verify the results captured in our TestScreen
    expect(screen.getOutput()).toContain('Test passed');
  });
});
