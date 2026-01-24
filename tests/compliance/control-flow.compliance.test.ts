import { describe, expect, it } from 'vitest';
import { runZStory } from '../utils/testRunner';
import { join } from 'path';

describe('Control Flow Compliance', () => {
  it('V3: should pass all control flow tests', async () => {
    const output = await runZStory(join(__dirname, '../fixtures/control_flow_test.z3'));
    expect(output).toContain('je_equal passed');
    expect(output).toContain('je_not_equal passed');
    expect(output).toContain('jl_less passed');
    expect(output).toContain('jg_greater passed');
    expect(output).toContain('jz_zero passed');
    expect(output).toContain('test_bitmap passed');
    expect(output).toContain('control_flow_finished');
  });

  it('V5: should pass all control flow tests', async () => {
    const output = await runZStory(join(__dirname, '../fixtures/control_flow_test.z5'));
    expect(output).toContain('je_equal passed');
    expect(output).toContain('je_not_equal passed');
    expect(output).toContain('jl_less passed');
    expect(output).toContain('jg_greater passed');
    expect(output).toContain('jz_zero passed');
    expect(output).toContain('test_bitmap passed');
    expect(output).toContain('control_flow_finished');
  });
});
