import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Memory } from '../../../src/core/memory/Memory';
import { HeaderLocation } from '../../../src/utils/constants';
import { Logger } from '../../../src/utils/log';
// filepath: src/core/memory/Memory.test.ts

describe('Memory', () => {
  let mockBuffer: Buffer;
  let mockLogger: Logger;

  beforeEach(() => {
    mockBuffer = Buffer.alloc(0x10000); // 64KB memory
    mockLogger = new Logger('TestLogger');
    vi.spyOn(mockLogger, 'error');
    vi.spyOn(mockLogger, 'warn');
    vi.spyOn(mockLogger, 'debug');
  });

  it('should initialize memory with valid configuration', () => {
    // Set up valid header values
    mockBuffer[HeaderLocation.Version] = 3; // Version 3
    mockBuffer.writeUInt16BE(0x0400, HeaderLocation.StaticMemBase); // Dynamic memory ends at 0x0400
    mockBuffer.writeUInt16BE(0x0800, HeaderLocation.HighMemBase); // High memory starts at 0x0800

    const memory = new Memory(mockBuffer, { logger: mockLogger });

    expect(memory.version).toBe(3);
    expect(memory.dynamicMemoryEnd).toBe(0x0400);
    expect(memory.highMemoryStart).toBe(0x0800);
    expect(mockLogger.debug).toHaveBeenCalledWith('Memory map validated successfully for version 3');
  });

  it('should skip validation when skipValidation is true', () => {
    // Set up invalid header values
    mockBuffer[HeaderLocation.Version] = 0; // Invalid version
    mockBuffer.writeUInt16BE(0x0000, HeaderLocation.StaticMemBase); // Invalid dynamic memory end

    const memory = new Memory(mockBuffer, { logger: mockLogger, skipValidation: true });

    expect(memory.version).toBe(0);
    expect(mockLogger.debug).not.toHaveBeenCalled();
  });

  it('should throw an error for invalid Z-machine version', () => {
    mockBuffer[HeaderLocation.Version] = 9; // Invalid version

    expect(() => new Memory(mockBuffer, { logger: mockLogger })).toThrow('Invalid Z-machine version: 9');
  });

  it('should throw an error for dynamic memory size less than minimum', () => {
    mockBuffer[HeaderLocation.Version] = 3; // Version 3
    mockBuffer.writeUInt16BE(0x0030, HeaderLocation.StaticMemBase); // Dynamic memory ends at 0x0030 (less than 64 bytes)

    expect(() => new Memory(mockBuffer, { logger: mockLogger })).toThrow(
      'Dynamic memory size is less than minimum (64 bytes): 48'
    );
  });

  it('should throw an error when high memory overlaps dynamic memory', () => {
    mockBuffer[HeaderLocation.Version] = 3; // Version 3
    mockBuffer.writeUInt16BE(0x0400, HeaderLocation.StaticMemBase); // Dynamic memory ends at 0x0400
    mockBuffer.writeUInt16BE(0x0300, HeaderLocation.HighMemBase); // High memory starts at 0x0300 (overlaps)

    expect(() => new Memory(mockBuffer, { logger: mockLogger })).toThrow(
      'High memory start (768) overlaps with dynamic memory end (1024)'
    );
  });
});
