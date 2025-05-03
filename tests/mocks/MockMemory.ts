import { vi } from 'vitest';

export class MockMemory {
  // Public methods that tests will use
  getByte = vi.fn().mockReturnValue(0);
  setByte = vi.fn();
  getWord = vi.fn().mockReturnValue(0);
  setWord = vi.fn();
  getZString = vi.fn().mockReturnValue([]);
  copyBlock = vi.fn();
  checkPackedAddressAlignment = vi.fn();
  unpackRoutineAddress = vi.fn().mockImplementation((addr: number) => addr * 2);
  validateRoutineHeader = vi.fn().mockReturnValue(true);
  getAlphabetTables = vi
    .fn()
    .mockReturnValue(['abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', ' 0123456789.,!?_#\'"/\\<-:()']);
  version = 3; // Use a property instead of a getter
  size = 0x10000;
  buffer = Buffer.alloc(0x10000);
  isDynamicMemory = vi.fn().mockImplementation((addr: number) => addr < 0x4000);
  isStaticMemory = vi.fn().mockImplementation((addr: number) => addr >= 0x4000 && addr < 0x8000);
  isHighMemory = vi.fn().mockImplementation((addr: number) => addr >= 0x8000);
}
