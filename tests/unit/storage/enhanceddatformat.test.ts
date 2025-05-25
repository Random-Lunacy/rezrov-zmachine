import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnhancedDatFormat } from '../../../src/storage/formats/EnhancedDatFormat';
import { ZMachineState } from '../../../src/types';
import { Logger } from '../../../src/utils/log';

// Suppress console output during tests
Logger.setLogToConsole(false);

describe('EnhancedDatFormat', () => {
  let format: EnhancedDatFormat;
  let mockState: ZMachineState;
  let originalStory: Buffer;

  beforeEach(() => {
    // Create a new instance for each test
    format = new EnhancedDatFormat();

    // Mock the logger
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    // Create a simple state for testing
    originalStory = Buffer.from([0x03, 0x00, 0x01, 0x02]); // Version 3 story file

    // Create a mock ZMachineState
    mockState = {
      memory: Buffer.from([0x04, 0x05, 0x06, 0x07]),
      pc: 0x1234,
      stack: [1, 2, 3],
      callFrames: [
        {
          returnPC: 0x5678,
          discardResult: false,
          storeVariable: 16,
          argumentMask: [true, false, true],
          locals: [10, 20, 30],
          stack: [40, 50, 60],
        },
      ],
      originalStory: originalStory,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('serialize', () => {
    it('should serialize ZMachineState to a Buffer', () => {
      const serialized = format.serialize(mockState);

      // Verify the result is a Buffer
      expect(serialized).toBeInstanceOf(Buffer);

      // Verify the content is parsable JSON
      const parsed = JSON.parse(serialized.toString('utf-8'));

      // Check that the essential state properties are present
      expect(parsed.pc).toBe(mockState.pc);
      expect(parsed.stack).toEqual(mockState.stack);

      // Check that buffer properties are converted to base64
      expect(parsed.memory).toBeTruthy();
      expect(typeof parsed.memory).toBe('string');
      expect(parsed.originalStory).toBeTruthy();
      expect(typeof parsed.originalStory).toBe('string');

      // Check that the version is included
      expect(parsed.__version).toBe(1);

      // Check that type information is preserved
      expect(parsed.__types.memory).toBe('Buffer');
      expect(parsed.__types.originalStory).toBe('Buffer');
    });

    it('should handle empty state', () => {
      const emptyState: ZMachineState = {
        memory: Buffer.alloc(0),
        pc: 0,
        stack: [],
        callFrames: [],
        originalStory: Buffer.alloc(0),
      };

      const serialized = format.serialize(emptyState);

      // Should serialize properly even with empty state
      expect(serialized).toBeInstanceOf(Buffer);

      const parsed = JSON.parse(serialized.toString('utf-8'));
      expect(parsed.pc).toBe(0);
      expect(parsed.stack).toEqual([]);
      expect(parsed.callFrames).toEqual([]);
    });

    it('should convert call frames correctly', () => {
      const serialized = format.serialize(mockState);
      const parsed = JSON.parse(serialized.toString('utf-8'));

      // Verify that call frames are serialized correctly
      expect(parsed.callFrames.length).toBe(1);
      expect(parsed.callFrames[0].returnPC).toBe(mockState.callFrames[0].returnPC);
      expect(parsed.callFrames[0].discardResult).toBe(mockState.callFrames[0].discardResult);
      expect(parsed.callFrames[0].storeVariable).toBe(mockState.callFrames[0].storeVariable);
      expect(Array.isArray(parsed.callFrames[0].argumentMask)).toBe(true);
      expect(parsed.callFrames[0].argumentMask).toEqual(mockState.callFrames[0].argumentMask);
      expect(Array.isArray(parsed.callFrames[0].locals)).toBe(true);
      expect(parsed.callFrames[0].locals).toEqual(Array.from(mockState.callFrames[0].locals));
      expect(Array.isArray(parsed.callFrames[0].stack)).toBe(true);
      expect(parsed.callFrames[0].stack).toEqual(Array.from(mockState.callFrames[0].stack));
    });
  });

  describe('deserialize', () => {
    it('should deserialize Buffer to ZMachineState', () => {
      // First serialize then deserialize to test roundtrip
      const serialized = format.serialize(mockState);
      const deserialized = format.deserialize(serialized, originalStory);

      // Verify the result is a ZMachineState
      expect(deserialized.pc).toBe(mockState.pc);
      expect(deserialized.stack).toEqual(mockState.stack);

      // Check that buffer properties are correctly recreated
      expect(Buffer.isBuffer(deserialized.memory)).toBe(true);
      expect(deserialized.memory.equals(mockState.memory)).toBe(true);
      expect(Buffer.isBuffer(deserialized.originalStory)).toBe(true);
      expect(deserialized.originalStory.equals(mockState.originalStory)).toBe(true);

      // Verify call frames
      expect(deserialized.callFrames.length).toBe(mockState.callFrames.length);
      expect(deserialized.callFrames[0].returnPC).toBe(mockState.callFrames[0].returnPC);
      expect(deserialized.callFrames[0].discardResult).toBe(mockState.callFrames[0].discardResult);
      expect(deserialized.callFrames[0].storeVariable).toBe(mockState.callFrames[0].storeVariable);
      expect(deserialized.callFrames[0].argumentMask).toEqual(mockState.callFrames[0].argumentMask);
      expect(Array.from(deserialized.callFrames[0].locals)).toEqual(Array.from(mockState.callFrames[0].locals));
      expect(Array.from(deserialized.callFrames[0].stack)).toEqual(Array.from(mockState.callFrames[0].stack));
    });

    it('should handle older format versions gracefully', () => {
      // Create an older version serialized state
      const oldState = {
        memory: mockState.memory.toString('base64'),
        pc: mockState.pc,
        stack: mockState.stack,
        callFrames: mockState.callFrames.map((frame) => ({
          returnPC: frame.returnPC,
          discardResult: frame.discardResult,
          storeVariable: frame.storeVariable,
          argumentMask: frame.argumentMask,
          locals: Array.from(frame.locals),
          stack: Array.from(frame.stack),
        })),
        originalStory: mockState.originalStory.toString('base64'),
        __version: 0, // Older version
      };

      const serialized = Buffer.from(JSON.stringify(oldState), 'utf-8');

      // Should deserialize properly even with older version
      const deserialized = format.deserialize(serialized, originalStory);
      expect(deserialized.pc).toBe(mockState.pc);
    });

    it('should throw error on invalid data', () => {
      const invalidData = Buffer.from('{"not":"valid"}', 'utf-8');

      // Should throw when data is missing required properties
      expect(() => format.deserialize(invalidData, originalStory)).toThrow();
    });

    it('should use provided originalStory as fallback', () => {
      // Create a state without originalStory
      const stateWithoutOriginal = {
        memory: mockState.memory.toString('base64'),
        pc: mockState.pc,
        stack: mockState.stack,
        callFrames: mockState.callFrames.map((frame) => ({
          returnPC: frame.returnPC,
          discardResult: frame.discardResult,
          storeVariable: frame.storeVariable,
          argumentMask: frame.argumentMask,
          locals: Array.from(frame.locals),
          stack: Array.from(frame.stack),
        })),
        __version: 1,
        __types: {
          memory: 'Buffer',
        },
      };

      const serialized = Buffer.from(JSON.stringify(stateWithoutOriginal), 'utf-8');

      // Should use provided originalStory when missing in data
      const deserialized = format.deserialize(serialized, originalStory);
      expect(deserialized.originalStory).toBe(originalStory);
    });

    it('should handle call frames with missing properties', () => {
      // Create a state with call frames missing some properties
      const stateWithIncompleteFrames = {
        memory: mockState.memory.toString('base64'),
        pc: mockState.pc,
        stack: mockState.stack,
        callFrames: [
          {
            returnPC: 0x1234,
            // Missing discardResult, storeVariable, etc.
          },
        ],
        originalStory: mockState.originalStory.toString('base64'),
        __version: 1,
        __types: {
          memory: 'Buffer',
          originalStory: 'Buffer',
        },
      };

      const serialized = Buffer.from(JSON.stringify(stateWithIncompleteFrames), 'utf-8');

      // Should handle missing properties gracefully
      const deserialized = format.deserialize(serialized, originalStory);
      expect(deserialized.callFrames[0].returnPC).toBe(0x1234);
      expect(deserialized.callFrames[0].argumentMask).toEqual([]);
      expect(Array.from(deserialized.callFrames[0].locals || [])).toEqual([]);
      expect(Array.from(deserialized.callFrames[0].stack || [])).toEqual([]);
    });
  });

  describe('extractMetadata', () => {
    it('should extract metadata from a serialized state', () => {
      // Add a description to the state
      const stateWithMetadata = {
        memory: mockState.memory.toString('base64'),
        pc: mockState.pc,
        stack: mockState.stack,
        callFrames: mockState.callFrames.map((frame) => ({
          returnPC: frame.returnPC,
          discardResult: frame.discardResult,
          storeVariable: frame.storeVariable,
          argumentMask: frame.argumentMask,
          locals: Array.from(frame.locals),
          stack: Array.from(frame.stack),
        })),
        originalStory: mockState.originalStory.toString('base64'),
        __version: 1,
        __types: {
          memory: 'Buffer',
          originalStory: 'Buffer',
        },
        description: 'Test save state',
      };

      const serialized = Buffer.from(JSON.stringify(stateWithMetadata), 'utf-8');

      // Extract metadata
      const metadata = format.extractMetadata(serialized);

      // Verify metadata
      expect(metadata.description).toBe('Test save state');
      expect(metadata.version).toBe(1);
      expect(metadata.format).toBe('enhanced');
    });

    it('should provide default metadata if description is missing', () => {
      const serialized = format.serialize(mockState);
      const metadata = format.extractMetadata(serialized);

      // Should provide default description
      expect(metadata.description).toBe('Enhanced save file');
      expect(metadata.format).toBe('enhanced');
    });

    it('should handle invalid data gracefully', () => {
      const invalidData = Buffer.from('not valid json', 'utf-8');
      const metadata = format.extractMetadata(invalidData);

      // Should return fallback metadata
      expect(metadata.description).toBe('Unreadable save file');
      expect(metadata.format).toBe('unknown');
    });
  });

  describe('roundtrip', () => {
    it('should perform complete roundtrip serialization/deserialization', () => {
      const serialized = format.serialize(mockState);
      const deserialized = format.deserialize(serialized, originalStory);

      // Check primitive properties
      expect(deserialized.pc).toBe(mockState.pc);
      expect(deserialized.stack).toEqual(mockState.stack);

      // Check buffer properties
      expect(deserialized.memory.equals(mockState.memory)).toBe(true);
      expect(deserialized.originalStory.equals(mockState.originalStory)).toBe(true);

      // Check call frames
      expect(deserialized.callFrames.length).toBe(mockState.callFrames.length);

      const origFrame = mockState.callFrames[0];
      const newFrame = deserialized.callFrames[0];

      expect(newFrame.returnPC).toBe(origFrame.returnPC);
      expect(newFrame.discardResult).toBe(origFrame.discardResult);
      expect(newFrame.storeVariable).toBe(origFrame.storeVariable);
      expect(newFrame.argumentMask).toEqual(origFrame.argumentMask);
      expect(Array.from(newFrame.locals || [])).toEqual(Array.from(origFrame.locals));
      expect(Array.from(newFrame.stack || [])).toEqual(Array.from(origFrame.stack));
    });

    it('should handle complex state with multiple call frames', () => {
      // Create a more complex state with multiple call frames
      const complexState: ZMachineState = {
        memory: Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]),
        pc: 0x2000,
        stack: [1, 2, 3, 4, 5, 6],
        callFrames: [
          {
            returnPC: 0x1000,
            discardResult: false,
            storeVariable: 10,
            argumentMask: [true, true, false],
            locals: [100, 200, 300],
            stack: [1000, 2000],
          },
          {
            returnPC: 0x3000,
            discardResult: true,
            storeVariable: 20,
            argumentMask: [false, false, true],
            locals: [400, 500],
            stack: [3000, 4000, 5000],
          },
        ],
        originalStory: originalStory,
      };

      const serialized = format.serialize(complexState);
      const deserialized = format.deserialize(serialized, originalStory);

      // Check structure and content
      expect(deserialized.callFrames.length).toBe(2);
      expect(deserialized.stack.length).toBe(6);
      expect(deserialized.callFrames[0].returnPC).toBe(0x1000);
      expect(deserialized.callFrames[1].returnPC).toBe(0x3000);
      expect(Array.from(deserialized.callFrames[0].locals || [])).toEqual([100, 200, 300]);
      expect(Array.from(deserialized.callFrames[1].locals || [])).toEqual([400, 500]);
    });
  });
});
