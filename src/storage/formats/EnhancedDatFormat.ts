import { ZMachineState } from '../../types';
import { fromBase64, toBase64, utf8Decode, utf8Encode } from '../../utils/bytes';
import { Logger } from '../../utils/log';
import { FormatProvider } from './FormatProvider';

export class EnhancedDatFormat implements FormatProvider {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('EnhancedDatFormat');
  }

  /**
   * Serializes a Z-Machine state to a Uint8Array using enhanced JSON serialization
   * that preserves Uint8Array objects and type information
   *
   * @param state The Z-Machine state to serialize
   * @returns A buffer containing the serialized state
   */
  serialize(state: ZMachineState): Uint8Array {
    // Create a serializable object with explicit type information
    // and Uint8Array objects converted to base64 strings
    const serializable = {
      memory: toBase64(state.memory),
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
      originalStory: toBase64(state.originalStory),
      __version: 1, // Format version for future compatibility
      // Written into save files, so keep the original names: rc.1 and earlier save 'Buffer' here.
      __types: {
        memory: 'Buffer',
        originalStory: 'Buffer',
      },
    };

    // Convert to JSON and then to a Uint8Array
    const stateData = JSON.stringify(serializable);
    return utf8Encode(stateData);
  }

  /**
   * Deserializes a Uint8Array containing an enhanced JSON serialized Z-Machine state
   *
   * @param data The buffer containing the serialized state
   * @param originalStory The original story file buffer (used as fallback)
   * @returns The deserialized Z-Machine state
   */
  deserialize(data: Uint8Array, originalStory: Uint8Array): ZMachineState {
    // Convert Uint8Array to string and parse JSON
    const stateData = utf8Decode(data);
    const parsed = JSON.parse(stateData);

    try {
      // Check format version for compatibility
      const version = parsed.__version || 0;
      if (version > 1) {
        this.logger.warn(`Warning: Save file uses newer format (${version}) than supported (1)`);
      }

      // Restore proper types based on metadata
      return {
        memory: fromBase64(parsed.memory),
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
        originalStory: parsed.originalStory ? fromBase64(parsed.originalStory) : originalStory, // Fallback to provided original story if missing
      };
    } catch (error) {
      // More detailed error for debugging
      throw new Error(`Failed to deserialize save file: ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
      });
    }
  }

  /**
   * Extracts metadata from a serialized save file
   *
   * @param data The buffer containing the serialized state
   * @returns Metadata extracted from the save file
   */
  extractMetadata(data: Uint8Array): { description?: string; [key: string]: unknown } {
    try {
      const stateData = utf8Decode(data);
      const parsed = JSON.parse(stateData);

      return {
        description: parsed.description || 'Enhanced save file',
        version: parsed.__version || 0,
        format: 'enhanced',
      };
    } catch (e) {
      this.logger.debug(`Error reading save file: ${e}`);
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
