/**
 * Snapshot module for handling the serialization and deserialization of
 * snapshots in a binary format. This module is responsible for creating
 * a binary buffer from a snapshot object and reading a snapshot object
 * from a binary buffer. It also includes validation functions to ensure
 * the integrity of the snapshot data.
 *
 * It is used to store and retrieve the state of the Z-machine for undo
 * and redo operations.
 */
import { StackFrame } from '../core/execution/StackFrame';
import { Snapshot } from './interfaces';

/**
 * Enum defining the different types of chunks in a snapshot file
 */
enum SnapshotChunkType {
  Memory = 1,
  Stack = 2,
  Callstack = 3,
  Registers = 4,
}

/**
 * Creates a binary buffer from a snapshot object
 * @param snapshot The snapshot data to serialize
 * @returns A buffer containing the serialized snapshot
 */
export function createSnapshotBuffer(snapshot: Snapshot): Buffer {
  // Helper function to create a chunk header
  const createChunkHeader = (type: SnapshotChunkType, length: number): Buffer => {
    const header = Buffer.alloc(8);
    header.writeUInt32LE(type, 0);
    header.writeUInt32LE(length, 4);
    return header;
  };

  // Array to hold all buffer fragments
  const buffers: Array<Buffer> = [];

  // Add memory chunk
  buffers.push(createChunkHeader(SnapshotChunkType.Memory, snapshot.mem.length));
  buffers.push(snapshot.mem);

  // Add stack chunk
  const stackString = JSON.stringify(snapshot.stack);
  buffers.push(createChunkHeader(SnapshotChunkType.Stack, stackString.length));
  buffers.push(Buffer.from(stackString, 'utf8'));

  // Add callstack chunk (convert old CallFrame to new StackFrame if needed)
  const callstackString = JSON.stringify(snapshot.callstack);
  buffers.push(createChunkHeader(SnapshotChunkType.Callstack, callstackString.length));
  buffers.push(Buffer.from(callstackString, 'utf8'));

  // Add registers chunk (just PC for now)
  buffers.push(createChunkHeader(SnapshotChunkType.Registers, 4));
  const registerBuffer = Buffer.alloc(4);
  registerBuffer.writeUInt32LE(snapshot.pc);
  buffers.push(registerBuffer);

  // Combine all buffers and return
  return Buffer.concat(buffers);
}

/**
 * Reads a snapshot from a binary buffer
 * @param buffer The buffer containing serialized snapshot data
 * @returns The deserialized Snapshot object
 */
export function readSnapshotFromBuffer(buffer: Buffer): Snapshot {
  let mem: Buffer | null = null;
  let stack: Array<number> | null = null;
  const callstack: Array<StackFrame> | null = null;
  let pc: number | null = null;

  let position = 0;

  // Read chunks until we reach the end of the buffer
  while (position < buffer.length) {
    // Read chunk header
    const type = buffer.readUInt32LE(position) as SnapshotChunkType;
    position += 4;
    const length = buffer.readUInt32LE(position);
    position += 4;

    // Process chunk based on type
    switch (type) {
      case SnapshotChunkType.Memory:
        // Create a copy of the memory section
        mem = Buffer.from(buffer.subarray(position, position + length));
        break;
      case SnapshotChunkType.Stack:
        // Parse stack data
        stack = JSON.parse(buffer.toString('utf8', position, position + length));
        break;
      case SnapshotChunkType.Registers:
        // Read PC (program counter)
        pc = buffer.readUInt32LE(position);
        break;
      default:
        throw new Error(`Unknown chunk type: ${type}`);
    }

    // Move position to next chunk
    position += length;
  }

  // Ensure all required data was read
  if (mem === null) {
    throw new Error('Memory chunk missing from snapshot');
  }
  if (stack === null) {
    throw new Error('Stack chunk missing from snapshot');
  }
  if (callstack === null) {
    throw new Error('Callstack chunk missing from snapshot');
  }
  if (pc === null) {
    throw new Error('Registers chunk missing from snapshot');
  }

  // Return the complete snapshot
  return {
    mem,
    stack,
    callstack,
    pc,
  };
}

/**
 * Validates a snapshot before saving or loading
 * @param snapshot The snapshot to validate
 * @returns true if the snapshot is valid
 * @throws Error if the snapshot is invalid
 */
export function validateSnapshot(snapshot: Snapshot): boolean {
  if (!snapshot.mem || !(snapshot.mem instanceof Buffer)) {
    throw new Error('Invalid snapshot: memory is missing or not a Buffer');
  }

  if (!snapshot.stack || !Array.isArray(snapshot.stack)) {
    throw new Error('Invalid snapshot: stack is missing or not an Array');
  }

  if (!snapshot.callstack || !Array.isArray(snapshot.callstack)) {
    throw new Error('Invalid snapshot: callstack is missing or not an Array');
  }

  if (typeof snapshot.pc !== 'number') {
    throw new Error('Invalid snapshot: PC is missing or not a number');
  }

  return true;
}
