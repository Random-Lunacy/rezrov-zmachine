import { describe, expect, it } from 'vitest';
import { runZStory } from '../utils/testRunner';
import { join } from 'path';

describe('Memory Operations Compliance', () => {
  it('V3: should pass all memory operation tests', async () => {
    const output = await runZStory(join(__dirname, '../fixtures/memory_test.z3'));
    expect(output).toContain('storeb_loadb passed');
    expect(output).toContain('storew_loadw passed');
    expect(output).toContain('memory_finished');
  });

  it('V5: should pass all memory operation tests including copy_table', async () => {
    const output = await runZStory(join(__dirname, '../fixtures/memory_test.z5'));
    expect(output).toContain('storeb_loadb passed');
    expect(output).toContain('storew_loadw passed');
    expect(output).toContain('copy_table passed');
    expect(output).toContain('memory_finished');
  });
});
