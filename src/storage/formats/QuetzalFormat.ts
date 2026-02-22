import { ZMachineState } from '../../types';
import { Logger } from '../../utils/log';
import { FormatProvider } from './FormatProvider';

export class QuetzalFormat implements FormatProvider {
  // Constants for chunk identification
  private static readonly FORM_ID = 'FORM';
  private static readonly IFZS_ID = 'IFZS';
  private static readonly IFHD_ID = 'IFhd';
  private static readonly CMEM_ID = 'CMem';
  private static readonly UMEM_ID = 'UMem';
  private static readonly STKS_ID = 'Stks';
  private static readonly ANNO_ID = 'ANNO';

  private logger: Logger;

  constructor(options?: { logger?: Logger }) {
    this.logger = options?.logger || new Logger('QuetzalFormat');
  }

  serialize(state: ZMachineState): Buffer {
    // Create the chunks for the IFF format
    const ifhdChunk = this.createIFhdChunk(state);
    const memChunk = this.createCMemChunk(state.memory, state.originalStory);
    const stksChunk = this.createStksChunk(state);

    // Calculate total size for the buffer
    const totalSize = 4 + 4 + 4 + ifhdChunk.length + memChunk.length + stksChunk.length;

    // Create the buffer and write the data
    const buffer = Buffer.alloc(totalSize);
    let offset = 0;

    // Write FORM header
    buffer.write(QuetzalFormat.FORM_ID, offset, 'ascii');
    offset += 4;

    // Write size (size of everything except the FORM ID and size fields)
    buffer.writeUInt32BE(totalSize - 8, offset);
    offset += 4;

    // Write IFZS identifier
    buffer.write(QuetzalFormat.IFZS_ID, offset, 'ascii');
    offset += 4;

    // Copy the chunks
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

    // Check for valid FORM header
    if (data.toString('ascii', 0, 4) !== QuetzalFormat.FORM_ID) {
      throw new Error('Invalid Quetzal file: missing FORM header');
    }

    // Check for valid IFZS identifier
    if (data.toString('ascii', 8, 12) !== QuetzalFormat.IFZS_ID) {
      throw new Error('Invalid Quetzal file: missing IFZS identifier');
    }

    // Parse the chunks from the IFF file
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

    // Parse the IFhd chunk to get header information
    const ifhdData = this.parseIFhdChunk(chunks[QuetzalFormat.IFHD_ID]);

    // Validate that the save file matches the story file
    this.validateIFhdData(ifhdData, originalStory);

    // Get the version from the story file
    const version = originalStory[0];
    if (version === 6 || version === 7) {
      // For V6/V7, validate the routine and string offsets
      const routinesOffset = originalStory.readUInt16BE(0x28); // HeaderLocation.RoutinesOffset
      const stringsOffset = originalStory.readUInt16BE(0x2a); // HeaderLocation.StaticStringsOffset
      this.validateV6V7Fields(routinesOffset, stringsOffset);
    }

    // Parse the memory chunk
    let memory: Buffer;
    if (chunks[QuetzalFormat.CMEM_ID]) {
      memory = this.parseCMemChunk(chunks[QuetzalFormat.CMEM_ID], originalStory);
    } else {
      memory = this.parseUMemChunk(chunks[QuetzalFormat.UMEM_ID]);
    }

    // Parse the stack chunk
    const { stack, callstack } = this.parseStksChunk(chunks[QuetzalFormat.STKS_ID]);

    // Fix: Convert parsed callstack to the expected format for ZMachineState
    const callFrames = callstack.map((frame) => ({
      returnPC: frame.returnPC,
      discardResult: frame.discardResult,
      storeVariable: frame.storeVariable,
      argumentMask: frame.argumentMask,
      locals: Array.from(frame.locals || []),
      stack: frame.stack || [],
    }));

    // Return the reconstructed state
    return {
      memory,
      pc: ifhdData.pc,
      stack,
      callFrames, // Fixed: Use the properly formatted callFrames
      originalStory: Buffer.from(originalStory),
    };
  }

  extractMetadata(data: Buffer): { description?: string; [key: string]: unknown } {
    const metadata: { description?: string; [key: string]: unknown } = {};

    try {
      // Check for valid FORM header
      if (data.toString('ascii', 0, 4) !== QuetzalFormat.FORM_ID) {
        return metadata;
      }

      // Check for valid IFZS identifier
      if (data.toString('ascii', 8, 12) !== QuetzalFormat.IFZS_ID) {
        return metadata;
      }

      // Parse the chunks
      const chunks = this.parseChunks(data);

      // Get annotation if present
      if (chunks[QuetzalFormat.ANNO_ID]) {
        const annoText = chunks[QuetzalFormat.ANNO_ID].toString('ascii');
        metadata.description = annoText;
      }

      // Get header information if available
      if (chunks[QuetzalFormat.IFHD_ID]) {
        const ifhdData = this.parseIFhdChunk(chunks[QuetzalFormat.IFHD_ID]);
        metadata.release = ifhdData.release;
        metadata.serial = ifhdData.serial;
        metadata.checksum = ifhdData.checksum;
      }
    } catch (error) {
      this.logger.debug(`Error extracting metadata: ${error}`);
      // Continue even if metadata extraction fails
    }

    return metadata;
  }

  private parseChunks(data: Buffer): { [id: string]: Buffer } {
    const chunks: { [id: string]: Buffer } = {};
    let offset = 12; // Skip FORM header and IFZS ID

    while (offset < data.length) {
      // Read chunk ID
      const chunkId = data.toString('ascii', offset, offset + 4);
      offset += 4;

      // Read chunk size
      const chunkSize = data.readUInt32BE(offset);
      offset += 4;

      // Read chunk data
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
    // Create a buffer for the IFhd chunk (fixed size + header)
    const buffer = Buffer.alloc(13 + 8 + 1); // 13 bytes data, 8 bytes header, 1 padding
    let offset = 0;

    // Write chunk ID
    buffer.write(QuetzalFormat.IFHD_ID, offset, 'ascii');
    offset += 4;

    // Write chunk size
    buffer.writeUInt32BE(13, offset);
    offset += 4;

    // Write release number (word at 0x02 in header)
    const release = state.originalStory.readUInt16BE(2);
    buffer.writeUInt16BE(release, offset);
    offset += 2;

    // Write serial number (6 bytes at 0x12 in header)
    state.originalStory.copy(buffer, offset, 0x12, 0x18);
    offset += 6;

    // Write checksum (word at 0x1c in header)
    const checksum = state.originalStory.readUInt16BE(0x1c);
    buffer.writeUInt16BE(checksum, offset);
    offset += 2;

    // Write PC (24-bit value: 1 byte high bits, 2 bytes low bits)
    const pc = state.pc;
    buffer.writeUInt8((pc >> 16) & 0xff, offset);
    offset++;
    buffer.writeUInt16BE(pc & 0xffff, offset);
    offset += 2;

    // Write padding byte
    buffer.writeUInt8(0, offset);

    return buffer;
  }

  private parseIFhdChunk(data: Buffer): { release: number; serial: string; checksum: number; pc: number } {
    if (data.length < 13) {
      throw new Error('Invalid IFhd chunk: too short');
    }

    // Read release number
    const release = data.readUInt16BE(0);

    // Read serial number
    const serial = data.toString('ascii', 2, 8);

    // Read checksum
    const checksum = data.readUInt16BE(8);

    // Read PC (24-bit value)
    const pcHigh = data.readUInt8(10);
    const pcLow = data.readUInt16BE(11);
    const pc = (pcHigh << 16) | pcLow;

    return { release, serial, checksum, pc };
  }

  private validateIFhdData(
    ifhdData: { release: number; serial: string; checksum: number },
    originalStory: Buffer
  ): void {
    // Read release number from story file
    const originalRelease = originalStory.readUInt16BE(2);

    // Read serial number from story file
    const originalSerial = originalStory.toString('ascii', 0x12, 0x18);

    // Read checksum from story file
    const originalChecksum = originalStory.readUInt16BE(0x1c);

    // Compare release numbers
    if (ifhdData.release !== originalRelease) {
      throw new Error(`Release number mismatch: expected ${originalRelease}, got ${ifhdData.release}`);
    }

    // Compare serial numbers
    if (ifhdData.serial !== originalSerial) {
      throw new Error(`Serial number mismatch: expected ${originalSerial}, got ${ifhdData.serial}`);
    }

    // Compare checksums
    if (ifhdData.checksum !== originalChecksum) {
      throw new Error(`Checksum mismatch: expected ${originalChecksum}, got ${ifhdData.checksum}`);
    }
  }

  private createCMemChunk(memory: Buffer, originalStory: Buffer): Buffer {
    // Calculate dynamic memory size
    const dynamicMemorySize = this.getDynamicMemorySize(originalStory);

    // Extract dynamic memory from current state
    const dynamicMemory = Buffer.alloc(dynamicMemorySize);
    memory.copy(dynamicMemory, 0, 0, dynamicMemorySize);

    // Extract original dynamic memory
    const originalDynamicMemory = Buffer.alloc(dynamicMemorySize);
    originalStory.copy(originalDynamicMemory, 0, 0, dynamicMemorySize);

    // XOR the memory with the original to get the differences
    for (let i = 0; i < dynamicMemorySize; i++) {
      dynamicMemory[i] ^= originalDynamicMemory[i];
    }

    // Compress the XORed memory
    const compressed = this.compressMemory(dynamicMemory);

    // Create the chunk
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
    // Calculate dynamic memory size
    const dynamicMemorySize = this.getDynamicMemorySize(originalStory);

    // Decompress the data
    const decompressed = this.decompressMemory(data, dynamicMemorySize);

    // Create a new memory buffer from the original story
    const memory = Buffer.from(originalStory);

    // Extract original dynamic memory
    const originalDynamicMemory = Buffer.alloc(dynamicMemorySize);
    originalStory.copy(originalDynamicMemory, 0, 0, dynamicMemorySize);

    // XOR the decompressed data with the original to restore the actual memory
    for (let i = 0; i < dynamicMemorySize; i++) {
      memory[i] = decompressed[i] ^ originalDynamicMemory[i];
    }

    return memory;
  }

  private parseUMemChunk(data: Buffer): Buffer {
    // For UMem chunks, the data is simply the uncompressed memory
    // We could add validation here, but for now just return the data
    return data;
  }

  private compressMemory(data: Buffer): Buffer {
    // Simple run-length encoding for zero bytes
    // See Quetzal spec section 3.2
    const tempBuffer = Buffer.alloc(data.length * 2);
    let tempOffset = 0;
    let i = 0;

    while (i < data.length) {
      if (data[i] !== 0) {
        // Non-zero byte: copy directly
        tempBuffer[tempOffset++] = data[i++];
      } else {
        // Zero byte: count run length
        let zeroCount = 1;
        i++;

        while (i < data.length && data[i] === 0 && zeroCount < 255) {
          zeroCount++;
          i++;
        }

        // Write zero byte and run length
        tempBuffer[tempOffset++] = 0;
        tempBuffer[tempOffset++] = zeroCount;
      }
    }

    // Create final buffer with correct size
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
        // Non-zero byte: copy directly
        result[resultOffset++] = compressedData[i++];
      } else {
        // Zero byte: expand run
        i++;

        if (i >= compressedData.length) {
          // Incomplete run at end of data
          break;
        }

        const zeroCount = compressedData[i++];

        // Copy zeros
        for (let j = 0; j < zeroCount && resultOffset < targetSize; j++) {
          result[resultOffset++] = 0;
        }
      }
    }

    // If we didn't fill the target size, pad with zeros
    while (resultOffset < targetSize) {
      result[resultOffset++] = 0;
    }

    return result;
  }

  private createStksChunk(state: ZMachineState): Buffer {
    // Calculate size needed for the chunk
    let size = 0;

    // Space for dummy frame for versions other than V6
    size += 6; // Return PC (3), flags (1), variable (1), args (1)
    size += 2; // Stack size

    // Space for stack
    size += state.stack.length * 2;

    // Space for call frames
    for (const frame of state.callFrames) {
      size += 6; // Return PC (3), flags (1), variable (1), args (1)
      size += 2; // Stack size
      size += frame.locals.length * 2; // Locals
      size += frame.stack.length * 2; // Stack
    }

    // Create the buffer
    const buffer = Buffer.alloc(size + 8);
    let offset = 0;

    // Write chunk ID
    buffer.write(QuetzalFormat.STKS_ID, offset, 'ascii');
    offset += 4;

    // Write chunk size
    buffer.writeUInt32BE(size, offset);
    offset += 4;

    // Write dummy frame for versions other than V6
    buffer.writeUInt8(0, offset++); // PC high byte
    buffer.writeUInt16BE(0, offset); // PC low bytes
    offset += 2;

    buffer.writeUInt8(0, offset++); // Flags
    buffer.writeUInt8(0, offset++); // Variable
    buffer.writeUInt8(0, offset++); // Args

    // Write dummy stack size
    const dummyStackSize = state.stack.length;
    buffer.writeUInt16BE(dummyStackSize, offset);
    offset += 2;

    // Write stack values
    for (const value of state.stack) {
      buffer.writeUInt16BE(value, offset);
      offset += 2;
    }

    // Write call frames
    for (const frame of state.callFrames) {
      // Write return PC (24-bit)
      buffer.writeUInt8((frame.returnPC >> 16) & 0xff, offset++);
      buffer.writeUInt16BE(frame.returnPC & 0xffff, offset);
      offset += 2;

      // Write flags
      let flags = 0;
      if (frame.discardResult) {
        flags |= 0x10;
      }

      // Add local count in low bits
      flags |= Math.min(frame.locals.length, 0x0f);
      buffer.writeUInt8(flags, offset++);

      // Write store variable
      buffer.writeUInt8(frame.storeVariable || 0, offset++);

      // Write argument mask
      let args = 0;
      if (Array.isArray(frame.argumentMask)) {
        for (let i = 0; i < Math.min(frame.argumentMask.length, 7); i++) {
          if (frame.argumentMask[i]) {
            args |= 1 << i;
          }
        }
      } else if (typeof frame.argumentMask === 'number') {
        // Handle the case where argumentMask might be a number instead of array
        args = frame.argumentMask;
      }
      buffer.writeUInt8(args, offset++);

      // Write stack size
      buffer.writeUInt16BE(frame.stack.length, offset);
      offset += 2;

      // Write locals
      for (const local of frame.locals) {
        buffer.writeUInt16BE(local, offset);
        offset += 2;
      }

      // Write frame stack values
      for (const value of frame.stack) {
        buffer.writeUInt16BE(value, offset);
        offset += 2;
      }
    }

    return buffer;
  }

  private parseStksChunk(data: Buffer): {
    stack: number[];
    callstack: Array<{
      returnPC: number;
      discardResult: boolean;
      storeVariable: number;
      argumentMask: boolean[];
      locals: number[];
      stack: number[];
    }>;
  } {
    const stack: number[] = [];
    const callstack: Array<{
      returnPC: number;
      discardResult: boolean;
      storeVariable: number;
      argumentMask: boolean[];
      locals: number[];
      stack: number[];
    }> = [];
    let offset = 0;

    // Skip dummy frame header (6 bytes)
    offset += 3; // Return PC
    offset++; // Flags
    offset++; // Variable
    offset++; // Args

    // Read dummy stack size
    const dummyStackSize = data.readUInt16BE(offset);
    offset += 2;

    // Read stack values
    for (let i = 0; i < dummyStackSize; i++) {
      stack.push(data.readUInt16BE(offset));
      offset += 2;
    }

    // Read call frames
    while (offset < data.length) {
      // Read return PC (24-bit)
      const pcHigh = data.readUInt8(offset++);
      const pcLow = data.readUInt16BE(offset);
      offset += 2;
      const returnPC = (pcHigh << 16) | pcLow;

      // Read flags
      const flags = data.readUInt8(offset++);
      const discardResult = (flags & 0x10) !== 0;
      const localCount = flags & 0x0f;

      // Read store variable
      const storeVariable = data.readUInt8(offset++);

      // Read args supplied
      const argsSupplied = data.readUInt8(offset++);
      const argumentMask: boolean[] = [];
      for (let i = 0; i < 7; i++) {
        argumentMask[i] = (argsSupplied & (1 << i)) !== 0;
      }

      // Read stack size
      const evalStackSize = data.readUInt16BE(offset);
      offset += 2;

      // Read locals
      const locals: number[] = [];
      for (let i = 0; i < localCount; i++) {
        locals.push(data.readUInt16BE(offset));
        offset += 2;
      }

      // Read frame stack
      const frameStack: number[] = [];
      for (let i = 0; i < evalStackSize; i++) {
        frameStack.push(data.readUInt16BE(offset));
        offset += 2;
      }

      // Add frame to callstack
      callstack.push({
        returnPC,
        discardResult,
        storeVariable,
        argumentMask,
        locals,
        stack: frameStack,
      });
    }

    return { stack, callstack };
  }

  private getDynamicMemorySize(storyData: Buffer): number {
    // Per Z-spec §1.1 and Quetzal spec §3.1: dynamic memory extends from
    // address 0 to static_memory_base - 1. The static memory base is stored
    // as a word at header offset 0x0E.
    return storyData.readUInt16BE(0x0e);
  }

  // Fix: V6/V7 fields validation
  private validateV6V7Fields(routinesOffset: number, stringsOffset: number): void {
    const rules = [
      {
        condition: routinesOffset !== 0,
        errorMessage: `Routines offset 0x${routinesOffset.toString(16)} must be non-zero`,
      },
      {
        condition: stringsOffset !== 0,
        errorMessage: `Static strings offset 0x${stringsOffset.toString(16)} must be non-zero`,
      },
      // Additional memory region checks could be added here
    ];

    for (const rule of rules) {
      if (!rule.condition) {
        throw new Error(rule.errorMessage);
      }
    }
  }
}
