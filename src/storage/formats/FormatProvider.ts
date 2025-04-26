import { ZMachineState } from '../../types';

/**
 * FormatProvider interface for serialization and deserialization of ZMachine state.
 * This interface defines the methods required for a format provider to
 * serialize and deserialize the ZMachine state, as well as extract metadata
 * from the serialized data.
 *
 * The extractMetadata method is optional and may not be implemented by all format providers.
 * It should return an object containing metadata about the save file, such as a description or other
 * relevant information. The metadata can be used to provide additional context about the save file,
 * such as its contents or the state of the game at the time of saving. This method is useful for
 * formats that support metadata extraction, such as Quetzal.
 */
export interface FormatProvider {
  serialize(state: ZMachineState): Buffer;
  deserialize(data: Buffer, originalStory: Buffer): ZMachineState;
  extractMetadata?(data: Buffer): { description?: string; [key: string]: unknown };
}
