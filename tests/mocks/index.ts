export * from './MockGameState';
export * from './MockInputProcessor';
export * from './MockMemory';
export * from './MockScreen';
export * from './MockZMachine';

// Helper function to create a fully configured ZMachine mock
import { Executor } from '../../src/core/execution/Executor';
import { MockZMachine } from './MockZMachine';

export function createMockZMachine(): MockZMachine {
  const machine = new MockZMachine();
  const executor = new Executor(machine as any, { logger: machine.logger });
  machine.executor = executor;
  return machine;
}
