import * as fs from 'fs';
import * as path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStackFrame } from '../../src/core/execution/StackFrame';
import { Snapshot } from '../../src/storage/interfaces';
import { QuetzalFormat } from '../../src/storage/QuetzalFormat';
import { QuetzalStorage } from '../../src/storage/QuetzalStorage';
import { HeaderLocation } from '../../src/utils/constants';
import { Logger, LogLevel } from '../../src/utils/log';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
}));

describe('QuetzalFormat', () => {
  let logger: Logger;
  let quetzalFormat: QuetzalFormat;
  let mockMemory: Buffer;
  let mockSnapshot: Snapshot;

  beforeEach(() => {
    logger = new Logger('quetzal.test.js');
    Logger.setLevel(LogLevel.DEBUG);

    // Spy on logger methods
    vi.spyOn(logger, 'debug');
    vi.spyOn(logger, 'info');
    vi.spyOn(logger, 'warn');
    vi.spyOn(logger, 'error');

    quetzalFormat = new QuetzalFormat(logger);

    // Create a mock Z-machine memory
    mockMemory = Buffer.alloc(0x10000);

    // Set up basic header
    mockMemory.writeUInt8(3, HeaderLocation.Version); // Version 3
    mockMemory.writeUInt16BE(0x0400, HeaderLocation.StaticMemBase); // Dynamic memory ends at 0x0400
    mockMemory.writeUInt16BE(0x0800, HeaderLocation.HighMemBase); // High memory starts at 0x0800
    mockMemory.writeUInt16BE(0x1234, HeaderLocation.HighMemBase - 2); // Release number
    mockMemory.writeUInt16BE(0x5678, HeaderLocation.Flags2 + 12); // Checksum

    // Set some serial number
    const serial = Buffer.from('123456');
    serial.copy(mockMemory, HeaderLocation.Dictionary);

    // Create a simple stack and callstack
    const stack = [1, 2, 3, 4, 5];
    const callstack = [createStackFrame(0x1000, 2, 2, true, 10, 1, 0x2000)];

    // Set locals in the callstack
    callstack[0].locals[0] = 42;
    callstack[0].locals[1] = 123;

    // Create mock snapshot
    mockSnapshot = {
      mem: mockMemory,
      stack,
      callstack,
      pc: 0x1500,
    };
  });

  it('should create a Quetzal file', () => {
    // Create Quetzal file
    const quetzalData = quetzalFormat.createQuetzalFile(
      mockSnapshot,
      false // Don't use compression for this test
    );

    // Should be an IFF file starting with "FORM"
    expect(quetzalData.toString('ascii', 0, 4)).toBe('FORM');

    // Should have form type "IFZS"
    expect(quetzalData.toString('ascii', 8, 12)).toBe('IFZS');

    // Should have the expected chunks: IFhd, UMem, Stks
    expect(quetzalData.toString().includes('IFhd')).toBeTruthy();
    expect(quetzalData.toString().includes('UMem')).toBeTruthy();
    expect(quetzalData.toString().includes('Stks')).toBeTruthy();
  });

  it('should compress memory correctly', () => {
    // Create original story data with different content
    const originalStory = Buffer.alloc(0x10000);

    // Copy header
    mockMemory.copy(originalStory, 0, 0, 0x40);

    // Modify some data in dynamic memory to be different
    for (let i = 0x40; i < 0x400; i++) {
      originalStory[i] = 0xaa; // Different pattern
      mockMemory[i] = 0x55;
    }

    // Create Quetzal file with compression
    const quetzalData = quetzalFormat.createQuetzalFile(
      mockSnapshot,
      true, // Use compression
      originalStory
    );

    // Should be an IFF file
    expect(quetzalData.toString('ascii', 0, 4)).toBe('FORM');

    // Should have CMem instead of UMem
    expect(quetzalData.toString().includes('CMem')).toBeTruthy();
    expect(quetzalData.toString().includes('UMem')).toBeFalsy();

    // Compressed memory should be smaller than dynamic memory
    const formSize = quetzalData.readUInt32BE(4);
    expect(formSize).toBeLessThan(mockMemory.length);
  });

  it('should handle memory compression and decompression', () => {
    // Create original story data with different content
    const originalStory = Buffer.alloc(0x10000);

    // Copy header
    mockMemory.copy(originalStory, 0, 0, 0x40);

    // Modify some data in dynamic memory to be different
    for (let i = 0x40; i < 0x400; i++) {
      originalStory[i] = i & 0xff; // Original data
      mockMemory[i] = (i + 1) & 0xff; // Current data - differs by 1
    }

    // Create compressed Quetzal file
    const quetzalData = quetzalFormat.createQuetzalFile(
      mockSnapshot,
      true, // Use compression
      originalStory
    );

    // Parse it back
    const parsedSnapshot = quetzalFormat.parseQuetzalFile(quetzalData, originalStory);

    // Dynamic memory should match the mockMemory
    for (let i = 0; i < 0x400; i++) {
      expect(parsedSnapshot.mem[i]).toBe(mockMemory[i]);
    }
  });
});

describe('QuetzalStorage', () => {
  let logger: Logger;
  let quetzalStorage: QuetzalStorage;
  let mockMemory: Buffer;
  let mockSnapshot: Snapshot;

  beforeEach(() => {
    logger = new Logger('quetzal.test.js');
    Logger.setLevel(LogLevel.DEBUG);

    // Spy on logger methods
    vi.spyOn(logger, 'debug');
    vi.spyOn(logger, 'info');
    vi.spyOn(logger, 'warn');
    vi.spyOn(logger, 'error');

    // Create a mock Z-machine memory
    mockMemory = Buffer.alloc(0x10000);

    // Set up basic header
    mockMemory.writeUInt8(3, HeaderLocation.Version); // Version 3
    mockMemory.writeUInt16BE(0x0400, HeaderLocation.StaticMemBase); // Dynamic memory ends at 0x0400
    mockMemory.writeUInt16BE(0x0800, HeaderLocation.HighMemBase); // High memory starts at 0x0800

    // Create a simple stack and callstack
    const stack = [1, 2, 3, 4, 5];
    const callstack = [createStackFrame(0x1000, 2, 2, true, 10, 1, 0x2000)];

    // Create mock snapshot
    mockSnapshot = {
      mem: mockMemory,
      stack,
      callstack,
      pc: 0x1500,
    };

    // Create QuetzalStorage
    quetzalStorage = new QuetzalStorage(logger, mockMemory, '/save', 'test.qzl');

    // Mock fs functions
    (fs.existsSync as any).mockReset();
    (fs.statSync as any).mockReset();
    (fs.mkdirSync as any).mockReset();
    (fs.writeFileSync as any).mockReset();
    (fs.readFileSync as any).mockReset();
  });

  it('should save a snapshot to a file', () => {
    // Mock directory existence
    (fs.existsSync as any).mockReturnValue(true);

    // Save the snapshot
    quetzalStorage.saveSnapshot(mockSnapshot);

    // Should have called writeFileSync
    expect(fs.writeFileSync).toHaveBeenCalled();

    // First parameter should be the path
    const savePath = (fs.writeFileSync as any).mock.calls[0][0];
    expect(savePath).toBe(path.join('/save', 'test.qzl'));

    // Second parameter should be buffer
    const saveData = (fs.writeFileSync as any).mock.calls[0][1];
    expect(saveData).toBeInstanceOf(Buffer);
  });

  it('should create the save directory if it does not exist', () => {
    // Mock directory non-existence
    (fs.existsSync as any).mockReturnValue(false);

    // Save the snapshot
    quetzalStorage.saveSnapshot(mockSnapshot);

    // Should have called mkdirSync
    expect(fs.mkdirSync).toHaveBeenCalled();

    // First parameter should be the directory
    const dirPath = (fs.mkdirSync as any).mock.calls[0][0];
    expect(dirPath).toBe('/save');
  });

  it('should throw an error if the save file does not exist', () => {
    // Mock file non-existence
    (fs.existsSync as any).mockReturnValue(false);

    // Should throw an error
    expect(() => quetzalStorage.loadSnapshot()).toThrow(/Save file not found/);
  });

  it('should use in-memory save data if available', () => {
    // Mock file non-existence
    (fs.existsSync as any).mockReturnValue(false);

    // First save
    quetzalStorage.saveSnapshot(mockSnapshot);

    // Then load - should use in-memory data
    const loadedSnapshot = quetzalStorage.loadSnapshot();

    // Should not have called readFileSync
    expect(fs.readFileSync).not.toHaveBeenCalled();

    // Should have loaded with correct PC
    expect(loadedSnapshot.pc).toBe(mockSnapshot.pc);
  });
});
