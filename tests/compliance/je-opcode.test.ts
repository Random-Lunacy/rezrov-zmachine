import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { Logger, LogLevel } from '../../src/utils/log';
import { runZStory } from '../utils/testRunner';

describe('Z-machine compliance for je opcode', () => {
  const logger = new Logger('runZStory');
  Logger.setLevel(LogLevel.DEBUG);

  it('correctly implements je opcode behavior', async () => {
    const expectedOutputs = [
      'Equal test (5==5) passed',
      'Not equal test (5!=8) passed',
      'Multiple equality test passed',
      'All tests completed',
    ];

    logger.info('Calling runZStory');
    const output = await runZStory(join(__dirname, '../fixtures/je_test.z3'), expectedOutputs);

    logger.info(`Test output: ${output}`);

    // Verify each expected line is in the output
    for (const expectedLine of expectedOutputs) {
      expect(output).toContain(expectedLine);
    }
  });
});
