import { afterEach, describe, expect, it, vi } from 'vitest';
import { defer } from '../../../src/utils/defer';

describe('defer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('should run the callback after the current call stack, not synchronously', async () => {
    const order: string[] = [];

    defer(() => order.push('deferred'));
    order.push('sync');
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(order).toEqual(['sync', 'deferred']);
  });

  it('should use setImmediate when it exists', () => {
    const immediate = vi.fn();
    vi.stubGlobal('setImmediate', immediate);
    const callback = vi.fn();

    defer(callback);

    expect(immediate).toHaveBeenCalledWith(callback);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should fall back to setTimeout where setImmediate is missing (browsers)', () => {
    vi.useFakeTimers();
    vi.stubGlobal('setImmediate', undefined);
    const callback = vi.fn();

    defer(callback);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(0);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
