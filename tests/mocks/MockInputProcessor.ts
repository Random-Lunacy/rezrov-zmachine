import { vi } from 'vitest';
import { InputProcessor } from '../../src/ui/input/InputInterface';

export class MockInputProcessor implements InputProcessor {
  startTextInput = vi.fn();
  startCharInput = vi.fn();
  cancelInput = vi.fn();
  handleTimedInput = vi.fn();
  processTerminatingCharacters = vi.fn().mockReturnValue(13);
  promptForFilename = vi.fn().mockResolvedValue('mock_save.dat');
  onInputComplete = vi.fn();
  onKeyPress = vi.fn();
  onInputTimeout = vi.fn();
}
