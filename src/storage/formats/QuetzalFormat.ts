// src/storage/formats/QuetzalFormat.ts
import { ZMachineState } from '../../types';
import { Logger } from '../../utils/log';
import { FormatProvider } from './FormatProvider';

export class QuetzalFormat implements FormatProvider {
  // IFF chunk IDs
  private static readonly FORM_ID = 'FORM';
  private static readonly IFZS_ID = 'IFZS';
  private static readonly IFHD_ID = 'IFhd';
  private static readonly CMEM_ID = 'CMem';
  private static readonly UMEM_ID = 'UMem';
  private static readonly STKS_ID = 'Stks';
  private static readonly ANNO_ID = 'ANNO';

  private logger: Logger;

  constructor() {
    this.logger = new Logger('QuetzalFormat');
  }

  serialize(state: ZMachineState): Buffer {
    // Create chunks
    const ifhdChunk = this.createIFhdChunk(state);
    const memChunk = this.createCMemChunk(state.memory, state.originalStory);
    const stksChunk = this.createStksChunk(state);

    // Calculate total size (FORM header + size + 'IFZS' + chunks)
    const totalSize = 4 + 4 + 4 + ifhdChunk.length + memChunk.length + stksChunk.length;

    // Create buffer for the entire file
    const buffer = Buffer.alloc(totalSize);
    let offset = 0;

    // Write FORM header
    buffer.write(QuetzalFormat.FORM_ID, offset, 'ascii');
    offset += 4;

    // Write size (excluding FORM ID and size field)
    buffer.writeUInt32BE(totalSize - 8, offset);
    offset += 4;

    // Write IFZS ID
    buffer.write(QuetzalFormat.IFZS_ID, offset, 'ascii');
    offset += 4;

    // Write chunks
    ifhdChunk.copy(buffer, offset);
    offset += ifhdChunk.length;

    memChunk.copy(buffer, offset);
    offset += memChunk.length;

    stksChunk.copy(buffer, offset);

    return buffer;
  }

  deserialize(data: Buffer, originalStory: Buffer): ZMachineState {
    if (!originalStory) {
      throw new Error('Original story data is required for Quetzal format');
    }

    // Validate FORM header
    if (data.toString('ascii', 0, 4) !== QuetzalFormat.FORM_ID) {
      throw new Error('Invalid Quetzal file: missing FORM header');
    }

    // Validate IFZS ID
    if (data.toString('ascii', 8, 12) !== QuetzalFormat.IFZS_ID) {
      throw new Error('Invalid Quetzal file: missing IFZS identifier');
    }

    // Parse chunks
    const chunks = this.parseChunks(data);

    // Validate required chunks
    if (!chunks[QuetzalFormat.IFHD_ID]) {
      throw new Error('Invalid Quetzal file: missing IFhd chunk');
    }

    if (!chunks[QuetzalFormat.CMEM_ID] && !chunks[QuetzalFormat.UMEM_ID]) {
      throw new Error('Invalid Quetzal file: missing memory chunk');
    }

    if (!chunks[QuetzalFormat.STKS_ID]) {
      throw new Error('Invalid Quetzal file: missing Stks chunk');
    }

    // Parse chunks to create snapshot
    const ifhdData = this.parseIFhdChunk(chunks[QuetzalFormat.IFHD_ID]);

    // Validate IFhd data against original story
    this.validateIFhdData(ifhdData, originalStory);

    // Parse memory
    let memory: Buffer;
    if (chunks[QuetzalFormat.CMEM_ID]) {
      memory = this.parseCMemChunk(chunks[QuetzalFormat.CMEM_ID], originalStory);
    } else {
      memory = this.parseUMemChunk(chunks[QuetzalFormat.UMEM_ID]);
    }

    // Parse stacks
    const { stack, callStack } = this.parseStksChunk(chunks[QuetzalFormat.STKS_ID]);

    return {
      memory,
      pc: ifhdData.pc,
      stack,
      callFrames: callStack,
      originalStory: Buffer.from(originalStory),
    };
  }

  extractMetadata(data: Buffer): { description?: string; [key: string]: unknown } {
    const metadata: { description?: string; [key: string]: unknown } = {};

    try {
      // Validate FORM header
      if (data.toString('ascii', 0, 4) !== QuetzalFormat.FORM_ID) {
        return metadata;
      }

      // Validate IFZS ID
      if (data.toString('ascii', 8, 12) !== QuetzalFormat.IFZS_ID) {
        return metadata;
      }

      // Parse chunks
      const chunks = this.parseChunks(data);

      // Extract ANNO chunk if present
      if (chunks[QuetzalFormat.ANNO_ID]) {
        const annoText = chunks[QuetzalFormat.ANNO_ID].toString('ascii');
        metadata.description = annoText;
      }

      // Extract IFhd data if present
      if (chunks[QuetzalFormat.IFHD_ID]) {
        const ifhdData = this.parseIFhdChunk(chunks[QuetzalFormat.IFHD_ID]);
        metadata.release = ifhdData.release;
        metadata.serial = ifhdData.serial;
        metadata.checksum = ifhdData.checksum;
      }
    } catch (error) {
      this.logger.debug(`Error extracting metadata: ${error}`);
      // Ignore errors during metadata extraction
    }

    return metadata;
  }

  private parseChunks(data: Buffer): { [id: string]: Buffer } {
    const chunks: { [id: string]: Buffer } = {};
    let offset = 12; // Skip FORM header, size, and IFZS ID

    while (offset < data.length) {
      // Read chunk ID
      const chunkId = data.toString('ascii', offset, offset + 4);
      offset += 4;

      // Read chunk size
      const chunkSize = data.readUInt32BE(offset);
      offset += 4;

      // Extract chunk data
      const chunkData = Buffer.alloc(chunkSize);
      data.copy(chunkData, 0, offset, offset + chunkSize);
      chunks[chunkId] = chunkData;

      // Move to next chunk (accounting for padding)
      offset += chunkSize;
      if (chunkSize % 2 !== 0) {
        offset++; // Skip padding byte
      }
    }

    return chunks;
  }

  private createIFhdChunk(state: ZMachineState): Buffer {
    // IFhd chunk is 13 bytes + 8 bytes for header + 1 byte for odd-length padding
    const buffer = Buffer.alloc(13 + 8 + 1);
    let offset = 0;

    // Write chunk ID
    buffer.write(QuetzalFormat.IFHD_ID, offset, 'ascii');
    offset += 4;

    // Write chunk size
    buffer.writeUInt32BE(13, offset);
    offset += 4;

    // Write release number (word at $2)
    const release = state.originalStory.readUInt16BE(2);
    buffer.writeUInt16BE(release, offset);
    offset += 2;

    // Write serial number (6 bytes at $12)
    state.originalStory.copy(buffer, offset, 0x12, 0x18);
    offset += 6;

    // Write checksum (word at $1C)
    const checksum = state.originalStory.readUInt16BE(0x1c);
    buffer.writeUInt16BE(checksum, offset);
    offset += 2;

    // Write PC (3 bytes)
    const pc = state.pc;
    buffer.writeUInt8((pc >> 16) & 0xff, offset);
    offset++;
    buffer.writeUInt16BE(pc & 0xffff, offset);
    offset += 2;

    // Add padding byte for odd-length chunk
    buffer.writeUInt8(0, offset);

    return buffer;
  }

  private parseIFhdChunk(data: Buffer): { release: number; serial: string; checksum: number; pc: number } {
    if (data.length < 13) {
      throw new Error('Invalid IFhd chunk: too short');
    }

    // Read release number (2 bytes)
    const release = data.readUInt16BE(0);

    // Read serial number (6 bytes)
    const serial = data.toString('ascii', 2, 8);

    // Read checksum (2 bytes)
    const checksum = data.readUInt16BE(8);

    // Read PC (3 bytes)
    const pcHigh = data.readUInt8(10);
    const pcLow = data.readUInt16BE(11);
    const pc = (pcHigh << 16) | pcLow;

    return { release, serial, checksum, pc };
  }

  private validateIFhdData(
    ifhdData: { release: number; serial: string; checksum: number },
    originalStory: Buffer
  ): void {
    // Read release number from original story
    const originalRelease = originalStory.readUInt16BE(2);

    // Read serial number from original story
    const originalSerial = originalStory.toString('ascii', 0x12, 0x18);

    // Read checksum from original story
    const originalChecksum = originalStory.readUInt16BE(0x1c);

    // Validate release number
    if (ifhdData.release !== originalRelease) {
      throw new Error(`Release number mismatch: expected ${originalRelease}, got ${ifhdData.release}`);
    }

    // Validate serial number
    if (ifhdData.serial !== originalSerial) {
      throw new Error(`Serial number mismatch: expected ${originalSerial}, got ${ifhdData.serial}`);
    }

    // Validate checksum
    if (ifhdData.checksum !== originalChecksum) {
      throw new Error(`Checksum mismatch: expected ${originalChecksum}, got ${ifhdData.checksum}`);
    }
  }

  private createCMemChunk(memory: Buffer, originalStory: Buffer): Buffer {
    // Determine dynamic memory size
    const dynamicMemorySize = this.getDynamicMemorySize(originalStory);

    // Create a buffer for dynamic memory
    const dynamicMemory = Buffer.alloc(dynamicMemorySize);
    memory.copy(dynamicMemory, 0, 0, dynamicMemorySize);

    // XOR with original story data
    const originalDynamicMemory = Buffer.alloc(dynamicMemorySize);
    originalStory.copy(originalDynamicMemory, 0, 0, dynamicMemorySize);

    for (let i = 0; i < dynamicMemorySize; i++) {
      dynamicMemory[i] ^= originalDynamicMemory[i];
    }

    // Compress using run-length encoding
    const compressed = this.compressMemory(dynamicMemory);

    // Create the chunk buffer
    const buffer = Buffer.alloc(compressed.length + 8);
    let offset = 0;

    // Write chunk ID
    buffer.write(QuetzalFormat.CMEM_ID, offset, 'ascii');
    offset += 4;

    // Write chunk size
    buffer.writeUInt32BE(compressed.length, offset);
    offset += 4;

    // Write compressed data
    compressed.copy(buffer, offset);

    return buffer;
  }

  private parseCMemChunk(data: Buffer, originalStory: Buffer): Buffer {
    // Determine dynamic memory size
    const dynamicMemorySize = this.getDynamicMemorySize(originalStory);

    // Decompress the data
    const decompressed = this.decompressMemory(data, dynamicMemorySize);

    // Create a buffer for the entire memory
    const memory = Buffer.from(originalStory);

    // XOR with original story data for dynamic memory
    const originalDynamicMemory = Buffer.alloc(dynamicMemorySize);
    originalStory.copy(originalDynamicMemory, 0, 0, dynamicMemorySize);

    for (let i = 0; i < dynamicMemorySize; i++) {
      memory[i] = decompressed[i] ^ originalDynamicMemory[i];
    }

    return memory;
  }

  private parseUMemChunk(data: Buffer): Buffer {
    // UMem is a direct copy of dynamic memory
    // We need to prepend it with original story data
    // This implementation is incomplete - we need original story data
    return data;
  }

  private compressMemory(data: Buffer): Buffer {
    // Implement run-length encoding:
    // Non-zero bytes are stored as-is
    // Zero bytes are stored as a zero followed by a count byte
    const tempBuffer = Buffer.alloc(data.length * 2); // Worst case
    let tempOffset = 0;
    let i = 0;

    while (i < data.length) {
      if (data[i] !== 0) {
        // Non-zero byte, store as-is
        tempBuffer[tempOffset++] = data[i++];
      } else {
        // Zero byte, count consecutive zeros
        let zeroCount = 1;
        i++;

        while (i < data.length && data[i] === 0 && zeroCount < 255) {
          zeroCount++;
          i++;
        }

        // Store zero byte followed by count
        tempBuffer[tempOffset++] = 0;
        tempBuffer[tempOffset++] = zeroCount;
      }
    }

    // Create the final buffer with the exact size
    const result = Buffer.alloc(tempOffset);
    tempBuffer.copy(result, 0, 0, tempOffset);

    return result;
  }

  private decompressMemory(compressedData: Buffer, targetSize: number): Buffer {
    const result = Buffer.alloc(targetSize);
    let resultOffset = 0;
    let i = 0;

    while (i < compressedData.length && resultOffset < targetSize) {
      if (compressedData[i] !== 0) {
        // Non-zero byte, copy as-is
        result[resultOffset++] = compressedData[i++];
      } else {
        // Zero byte, expand run
        i++; // Skip the zero

        if (i >= compressedData.length) {
          // Error: incomplete run at end of data
          break;
        }

        const zeroCount = compressedData[i++];

        // Write zeroCount+1 zeros
        for (let j = 0; j < zeroCount && resultOffset < targetSize; j++) {
          result[resultOffset++] = 0;
        }
      }
    }

    // If we didn't completely fill the result, assume the rest are zeros
    while (resultOffset < targetSize) {
      result[resultOffset++] = 0;
    }

    return result;
  }

  private createStksChunk(state: ZMachineState): Buffer {
    // Calculate size needed for all stack frames
    let size = 0;

    // Add size for dummy frame if needed (Z-machine version <= 5 or >= 7)
    // This is simplified - you should check Z-machine version
    size += 6; // Fixed part of frame
    size += 2; // Evaluation stack count

    // Add size for real frames
    for (const frame of state.callFrames) {
      size += 6; // Fixed part of frame
      size += frame.locals.length * 2; // Local variables (word each)
      size += frame.stack.length * 2; // Evaluation stack (word each)
    }

    // Create buffer
    const buffer = Buffer.alloc(size + 8); // Add 8 for chunk header
    let offset = 0;

    // Write chunk ID
    buffer.write(QuetzalFormat.STKS_ID, offset, 'ascii');
    offset += 4;

    // Write chunk size
    buffer.writeUInt32BE(size, offset);
    offset += 4;

    // Write dummy frame (if needed)
    // This is simplified - you should check Z-machine version
    buffer.writeUInt8(0, offset++); // Return PC high byte
    buffer.writeUInt16BE(0, offset); // Return PC low bytes
    offset += 2;

    buffer.writeUInt8(0, offset++); // Flags
    buffer.writeUInt8(0, offset++); // Variable number
    buffer.writeUInt8(0, offset++); // Arguments supplied

    // Write eval stack size for dummy frame
    const dummyStackSize = state.stack.length;
    buffer.writeUInt16BE(dummyStackSize, offset);
    offset += 2;

    // Write evaluation stack for dummy frame
    for (const value of state.stack) {
      buffer.writeUInt16BE(value, offset);
      offset += 2;
    }

    // Write real frames
    for (const frame of state.callFrames) {
      // Write return PC
      buffer.writeUInt8((frame.returnPC >> 16) & 0xff, offset++);
      buffer.writeUInt16BE(frame.returnPC & 0xffff, offset);
      offset += 2;

      // Write flags
      let flags = 0;
      if (frame.discardResult) {
        flags |= 0x10; // Set the p flag
      }

      // Set vvvv bits for number of locals
      flags |= Math.min(frame.locals.length, 0x0f);
      buffer.writeUInt8(flags, offset++);

      // Write variable number
      buffer.writeUInt8(frame.storeVariable || 0, offset++);

      // Write arguments supplied
      let args = 0;
      for (let i = 0; i < Math.min(frame.argumentMask.length, 7); i++) {
        if (frame.argumentMask[i]) {
          args |= 1 << i;
        }
      }
      buffer.writeUInt8(args, offset++);

      // Write eval stack size
      buffer.writeUInt16BE(frame.stack.length, offset);
      offset += 2;

      // Write local variables
      for (const local of frame.locals) {
        buffer.writeUInt16BE(local, offset);
        offset += 2;
      }

      // Write evaluation stack
      for (const value of frame.stack) {
        buffer.writeUInt16BE(value, offset);
        offset += 2;
      }
    }

    return buffer;
  }

  private parseStksChunk(data: Buffer): {
    stack: number[];
    callStack: {
      returnPC: number;
      discardResult: boolean;
      storeVariable: number;
      argumentMask: boolean[];
      locals: number[];
      stack: number[];
    }[];
  } {
    const stack: number[] = [];
    const callStack: {
      returnPC: number;
      discardResult: boolean;
      storeVariable: number;
      argumentMask: boolean[];
      locals: number[];
      stack: number[];
    }[] = [];
    let offset = 0;

    // Parse dummy frame (for Z-machine version <= 5 or >= 7)
    offset += 3; // Skip return PC
    offset++; // Skip flags
    offset++; // Skip variable number
    offset++; // Skip arguments supplied

    // Read eval stack size for dummy frame
    const dummyStackSize = data.readUInt16BE(offset);
    offset += 2;

    // Read evaluation stack for dummy frame
    for (let i = 0; i < dummyStackSize; i++) {
      stack.push(data.readUInt16BE(offset));
      offset += 2;
    }

    // Parse remaining frames
    while (offset < data.length) {
      // Read return PC
      const pcHigh = data.readUInt8(offset++);
      const pcLow = data.readUInt16BE(offset);
      offset += 2;
      const returnPC = (pcHigh << 16) | pcLow;

      // Read flags
      const flags = data.readUInt8(offset++);
      const discardResult = (flags & 0x10) !== 0;
      const localCount = flags & 0x0f;

      // Read variable number
      const storeVariable = data.readUInt8(offset++);

      // Read arguments supplied
      const argsSupplied = data.readUInt8(offset++);
      const argumentMask: boolean[] = [];
      for (let i = 0; i < 7; i++) {
        argumentMask[i] = (argsSupplied & (1 << i)) !== 0;
      }

      // Read eval stack size
      const evalStackSize = data.readUInt16BE(offset);
      offset += 2;

      // Read local variables
      const locals: number[] = [];
      for (let i = 0; i < localCount; i++) {
        locals.push(data.readUInt16BE(offset));
        offset += 2;
      }

      // Read evaluation stack
      const frameStack: number[] = [];
      for (let i = 0; i < evalStackSize; i++) {
        frameStack.push(data.readUInt16BE(offset));
        offset += 2;
      }

      // Add frame to call stack
      callStack.push({
        returnPC,
        discardResult,
        storeVariable,
        argumentMask,
        locals,
        stack: frameStack,
      });
    }

    return { stack, callStack };
  }

  private getDynamicMemorySize(storyData: Buffer): number {
    // Dynamic memory size depends on the Z-machine version
    const version = storyData[0];

    switch (version) {
      case 1:
      case 2:
      case 3:
        return 0x10000; // V1-3: Up to 64K
      case 4:
      case 5:
        return 0x10000; // V4-5: Up to 64K
      case 6:
      case 7:
      case 8:
        return 0x20000; // V6-8: Up to 128K
      default:
        throw new Error(`Unsupported Z-machine version: ${version}`);
    }
  }
}
