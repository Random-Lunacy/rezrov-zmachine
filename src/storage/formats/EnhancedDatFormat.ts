import { ZMachineState } from '../../types';
import { FormatProvider } from './FormatProvider';

export class EnhancedDatFormat implements FormatProvider {
  /**
   * Serializes a Z-Machine state to a Buffer using enhanced JSON serialization
   * that preserves Buffer objects and type information
   *
   * @param state The Z-Machine state to serialize
   * @returns A buffer containing the serialized state
   */
  serialize(state: ZMachineState): Buffer {
    // Create a serializable object with explicit type information
    // and Buffer objects converted to base64 strings
    const serializable = {
      memory: state.memory.toString('base64'),
      pc: state.pc,
      stack: state.stack,
      callFrames: state.callFrames.map((frame) => ({
        returnPC: frame.returnPC,
        discardResult: frame.discardResult,
        storeVariable: frame.storeVariable,
        argumentMask: Array.isArray(frame.argumentMask) ? frame.argumentMask : [],
        locals: Array.from(frame.locals || []),
        stack: Array.from(frame.stack || []),
      })),
      originalStory: state.originalStory.toString('base64'),
      __version: 1, // Format version for future compatibility
      __types: {
        memory: 'Buffer',
        originalStory: 'Buffer',
      },
    };

    // Convert to JSON and then to a Buffer
    const stateData = JSON.stringify(serializable);
    return Buffer.from(stateData, 'utf-8');
  }

  /**
   * Deserializes a Buffer containing an enhanced JSON serialized Z-Machine state
   *
   * @param data The buffer containing the serialized state
   * @param originalStory The original story file buffer (used as fallback)
   * @returns The deserialized Z-Machine state
   */
  deserialize(data: Buffer, originalStory: Buffer): ZMachineState {
    // Convert Buffer to string and parse JSON
    const stateData = data.toString('utf-8');
    const parsed = JSON.parse(stateData);

    try {
      // Check format version for compatibility
      const version = parsed.__version || 0;
      if (version > 1) {
        console.warn(`Warning: Save file uses newer format (${version}) than supported (1)`);
      }

      // Restore proper types based on metadata
      return {
        memory: Buffer.from(parsed.memory, 'base64'),
        pc: parsed.pc,
        stack: parsed.stack,
        callFrames: parsed.callFrames.map((frame: SerializedCallFrame) => ({
          returnPC: frame.returnPC,
          discardResult: Boolean(frame.discardResult),
          storeVariable: frame.storeVariable,
          argumentMask: Array.isArray(frame.argumentMask) ? frame.argumentMask : [],
          locals: Array.from(frame.locals || []),
          stack: Array.from(frame.stack || []),
        })),
        originalStory: parsed.originalStory ? Buffer.from(parsed.originalStory, 'base64') : originalStory, // Fallback to provided original story if missing
      };
    } catch (error) {
      // More detailed error for debugging
      throw new Error(`Failed to deserialize save file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extracts metadata from a serialized save file
   *
   * @param data The buffer containing the serialized state
   * @returns Metadata extracted from the save file
   */
  extractMetadata(data: Buffer): { description?: string; [key: string]: unknown } {
    try {
      const stateData = data.toString('utf-8');
      const parsed = JSON.parse(stateData);

      return {
        description: parsed.description || 'Enhanced save file',
        version: parsed.__version || 0,
        format: 'enhanced',
      };
    } catch (e) {
      return {
        description: 'Unreadable save file',
        format: 'unknown',
      };
    }
  }
}

interface SerializedCallFrame {
  returnPC: number;
  discardResult: boolean;
  storeVariable: number;
  argumentMask: unknown; // This could be an array or something else
  locals?: number[] | ArrayLike<number>;
  stack?: number[] | ArrayLike<number>;
}
