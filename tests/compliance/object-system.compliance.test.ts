import { describe, expect, it } from 'vitest';
import { runZStory } from '../utils/testRunner';
import { join } from 'path';

describe('Object System Compliance', () => {
  it('V3: should pass all object system tests', async () => {
    const output = await runZStory(join(__dirname, '../fixtures/object_test.z3'));
    expect(output).toContain('initial_parent passed');
    expect(output).toContain('move_passed');
    expect(output).toContain('attr_passed');
    expect(output).toContain('clear_attr_passed');
    expect(output).toContain('prop_passed');
    expect(output).toContain('object_finished');
  });

  it('V5: should pass all object system tests', async () => {
    const output = await runZStory(join(__dirname, '../fixtures/object_test.z5'));
    expect(output).toContain('initial_parent passed');
    expect(output).toContain('move_passed');
    expect(output).toContain('attr_passed');
    expect(output).toContain('clear_attr_passed');
    expect(output).toContain('prop_passed');
    expect(output).toContain('object_finished');
  });
});
