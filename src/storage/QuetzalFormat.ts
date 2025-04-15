import { StackFrame } from '../core/execution/StackFrame';
import { HeaderLocation } from '../utils/constants';
import { Logger } from '../utils/log';
import { Snapshot } from './interfaces';

/**
 * IFF chunk ID constants for Quetzal format
 */
export enum QuetzalChunk {
  /**
   * IFF Form type for Quetzal
   */
  FormType = 'IFZS',

  /**
   * Story file identifier chunk
   */
  IFhd = 'IFhd',

  /**
   * Compressed memory chunk
   */
  CMem = 'CMem',

  /**
   * Uncompressed memory chunk
   */
  UMem = 'UMem',

  /**
   * Stacks chunk
   */
  Stks = 'Stks',

  /**
   * Interpreter-specific data
   */
  IntD = 'IntD',

  /**
   * Author info
   */
  AUTH = 'AUTH',

  /**
   * Copyright info
   */
  Copyright = '(c) ',

  /**
   * Annotation
   */
  ANNO = 'ANNO',
}

/**
 * Interface for IFF chunks
 */
interface IffChunk {
  /**
   * Chunk ID (4 characters)
   */
  id: string;

  /**
   * Chunk data
   */
  data: Buffer;
}

/**
 * Quetzal format handler for Z-machine save files
 */
export class QuetzalFormat {
  private logger: Logger;

  /**
   * Create a new QuetzalFormat handler
   * @param logger The logger to use
   */
  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Create a Quetzal file from a snapshot
   * @param snapshot The snapshot to convert
   * @param useCompression Whether to use compression for memory
   * @param originalStoryData The original story data for compression
   * @param annotation Optional annotation to include
   * @returns Buffer containing Quetzal data
   */
  public createQuetzalFile(
    snapshot: Snapshot,
    useCompression: boolean = true,
    originalStoryData?: Buffer,
    annotation?: string
  ): Buffer {
    this.logger.debug('Creating Quetzal file');

    const chunks: IffChunk[] = [];

    // Add IFhd chunk - header info
    chunks.push(this.createIFhdChunk(snapshot));

    // Add memory chunk - either CMem or UMem
    if (useCompression && originalStoryData) {
      chunks.push(this.createCMemChunk(snapshot.mem, originalStoryData));
    } else {
      chunks.push(this.createUMemChunk(snapshot.mem));
    }

    // Add Stks chunk - stacks
    chunks.push(this.createStksChunk(snapshot));

    // Add optional annotation
    if (annotation) {
      chunks.push({
        id: QuetzalChunk.ANNO,
        data: Buffer.from(annotation, 'ascii'),
      });
    }

    // Create the FORM
    return this.createIffForm(QuetzalChunk.FormType, chunks);
  }

  /**
   * Parse a Quetzal file into a snapshot
   * @param quetzalData The Quetzal file data
   * @param originalStoryData The original story data (for decompression)
   * @returns The parsed snapshot
   */
  public parseQuetzalFile(quetzalData: Buffer, originalStoryData?: Buffer): Snapshot {
    this.logger.debug('Parsing Quetzal file');

    // Parse IFF FORM
    const { formType, chunks } = this.parseIffForm(quetzalData);

    if (formType !== QuetzalChunk.FormType) {
      throw new Error(`Invalid Quetzal file: expected FORM type ${QuetzalChunk.FormType}, got ${formType}`);
    }

    // Parse required chunks
    const ifhdChunk = chunks.find((chunk) => chunk.id === QuetzalChunk.IFhd);
    const cmemChunk = chunks.find((chunk) => chunk.id === QuetzalChunk.CMem);
    const umemChunk = chunks.find((chunk) => chunk.id === QuetzalChunk.UMem);
    const stksChunk = chunks.find((chunk) => chunk.id === QuetzalChunk.Stks);

    if (!ifhdChunk) {
      throw new Error('Invalid Quetzal file: missing IFhd chunk');
    }

    if (!cmemChunk && !umemChunk) {
      throw new Error('Invalid Quetzal file: missing memory chunk (CMem or UMem)');
    }

    if (!stksChunk) {
      throw new Error('Invalid Quetzal file: missing Stks chunk');
    }

    // Parse header chunk
    const { releaseNumber, serialNumber, checksum, pc } = this.parseIFhdChunk(ifhdChunk.data);

    // Parse memory chunk
    let mem: Buffer;
    if (cmemChunk && originalStoryData) {
      mem = this.decompressCMemChunk(cmemChunk.data, originalStoryData);
    } else if (umemChunk) {
      mem = Buffer.from(umemChunk.data);
    } else {
      throw new Error('Cannot decompress memory: original story data not provided');
    }

    // Parse stacks chunk
    const { stack, callstack } = this.parseStksChunk(stksChunk.data);

    // Create snapshot
    return {
      mem,
      stack,
      callstack,
      pc,
    };
  }

  /**
   * Create an IFhd chunk
   * @param snapshot The snapshot
   * @returns The IFhd chunk
   */
  private createIFhdChunk(snapshot: Snapshot): IffChunk {
    const mem = snapshot.mem;

    // Get header info
    const releaseNumber = mem.readUInt16BE(HeaderLocation.HighMemBase - 2);
    const serialBytes = mem.slice(HeaderLocation.Dictionary, HeaderLocation.Dictionary + 6);
    const checksum = mem.readUInt16BE(HeaderLocation.Flags2 + 12);

    // Create chunk data
    const data = Buffer.alloc(13); // IFhd is 13 bytes long

    // Write release number (at offset 0)
    data.writeUInt16BE(releaseNumber, 0);

    // Write serial number (at offset 2)
    serialBytes.copy(data, 2);

    // Write checksum (at offset 8)
    data.writeUInt16BE(checksum, 8);

    // Write PC (at offset 10)
    // Note: For Z-machine versions <= 3, PC should point to branch offset
    // For Z-machine versions >= 4, PC should point to store variable
    data.writeUInt8((snapshot.pc >> 16) & 0xff, 10);
    data.writeUInt8((snapshot.pc >> 8) & 0xff, 11);
    data.writeUInt8(snapshot.pc & 0xff, 12);

    return {
      id: QuetzalChunk.IFhd,
      data,
    };
  }

  /**
   * Parse an IFhd chunk
   * @param data The chunk data
   * @returns The parsed header info
   */
  private parseIFhdChunk(data: Buffer): {
    releaseNumber: number;
    serialNumber: Buffer;
    checksum: number;
    pc: number;
  } {
    const releaseNumber = data.readUInt16BE(0);
    const serialNumber = Buffer.from(data.slice(2, 8));
    const checksum = data.readUInt16BE(8);

    // PC is a 3-byte value (24 bits)
    const pc = (data[10] << 16) | (data[11] << 8) | data[12];

    return {
      releaseNumber,
      serialNumber,
      checksum,
      pc,
    };
  }

  /**
   * Create a CMem (compressed memory) chunk
   * @param currentMem The current memory state
   * @param originalMem The original memory state
   * @returns The CMem chunk
   */
  private createCMemChunk(currentMem: Buffer, originalMem: Buffer): IffChunk {
    // Find dynamic memory size - typically stored at address 0x0E
    const dynamicMemSize = currentMem.readUInt16BE(HeaderLocation.StaticMemBase);

    // Ensure the original memory is at least as large as dynamic memory
    if (originalMem.length < dynamicMemSize) {
      throw new Error(`Original story file too small for compression: expected at least ${dynamicMemSize} bytes`);
    }

    // Create a buffer to hold the compressed data
    // In worst case, this could be slightly larger than dynamic memory
    const compressedData = Buffer.alloc(dynamicMemSize * 2);
    let compressedSize = 0;

    // Compress the data using XOR + RLE algorithm
    let runLength = 0;

    for (let i = 0; i < dynamicMemSize; i++) {
      // XOR current memory with original memory
      const xorByte = currentMem[i] ^ originalMem[i];

      if (xorByte === 0) {
        // Zero byte - part of a run
        runLength++;

        // If we've accumulated 256 zeroes, output the run and start a new one
        if (runLength === 256) {
          compressedData[compressedSize++] = 0;
          compressedData[compressedSize++] = 255; // 255 + 1 = 256 zeroes
          runLength = 0;
        }
      } else {
        // Non-zero byte - output any pending run, then output this byte
        if (runLength > 0) {
          compressedData[compressedSize++] = 0;
          compressedData[compressedSize++] = runLength - 1; // n+1 zeroes
          runLength = 0;
        }

        compressedData[compressedSize++] = xorByte;
      }
    }

    // Output any final run
    if (runLength > 0) {
      compressedData[compressedSize++] = 0;
      compressedData[compressedSize++] = runLength - 1; // n+1 zeroes
    }

    // Create the final compressed data buffer of the exact right size
    const finalData = Buffer.from(compressedData.slice(0, compressedSize));

    return {
      id: QuetzalChunk.CMem,
      data: finalData,
    };
  }

  /**
   * Decompress a CMem chunk
   * @param compressedData The compressed data
   * @param originalMem The original memory
   * @returns The decompressed memory
   */
  private decompressCMemChunk(compressedData: Buffer, originalMem: Buffer): Buffer {
    // Find dynamic memory size - typically stored at address 0x0E
    const dynamicMemSize = originalMem.readUInt16BE(HeaderLocation.StaticMemBase);

    // Create a buffer to hold the decompressed data
    // First, make a copy of the original file
    const decompressedMem = Buffer.from(originalMem);

    // Then decompress the CMem data on top of it
    let memPos = 0;
    let compPos = 0;

    while (compPos < compressedData.length && memPos < dynamicMemSize) {
      const byte = compressedData[compPos++];

      if (byte === 0) {
        // Start of a run of zeros
        if (compPos >= compressedData.length) {
          throw new Error('Invalid compression data: zero byte at end of data');
        }

        const runLength = compressedData[compPos++] + 1;

        // Skip these bytes (they're already at the original values)
        memPos += runLength;
      } else {
        // Non-zero byte - XOR with original memory
        decompressedMem[memPos] = originalMem[memPos] ^ byte;
        memPos++;
      }
    }

    // If we have leftover compressed data, something's wrong
    if (compPos < compressedData.length) {
      this.logger.warn(`Ignoring ${compressedData.length - compPos} bytes of leftover compressed data`);
    }

    // If we haven't filled all of dynamic memory, assume the rest is unchanged
    if (memPos < dynamicMemSize) {
      this.logger.debug(`Leaving ${dynamicMemSize - memPos} bytes of dynamic memory unchanged`);
    }

    return decompressedMem;
  }

  /**
   * Create a UMem (uncompressed memory) chunk
   * @param mem The memory to store
   * @returns The UMem chunk
   */
  private createUMemChunk(mem: Buffer): IffChunk {
    // Find dynamic memory size - typically stored at address 0x0E
    const dynamicMemSize = mem.readUInt16BE(HeaderLocation.StaticMemBase);

    // Create chunk with just the dynamic memory portion
    return {
      id: QuetzalChunk.UMem,
      data: Buffer.from(mem.slice(0, dynamicMemSize)),
    };
  }

  /**
   * Create a Stks (stacks) chunk
   * @param snapshot The snapshot
   * @returns The Stks chunk
   */
  private createStksChunk(snapshot: Snapshot): IffChunk {
    const { stack, callstack } = snapshot;
    const version = snapshot.mem[HeaderLocation.Version];

    // Estimate size
    // Each frame has:
    // - 3 bytes for PC
    // - 1 byte for flags
    // - 1 byte for result variable
    // - 1 byte for arguments bitmap
    // - 2 bytes for eval stack size
    // - 2 bytes per local variable
    // - 2 bytes per eval stack entry
    const totalFrameSize = callstack.reduce((total, frame) => {
      return total + 8 + frame.locals.length * 2 + (frame.previousSP || 0) * 2;
    }, 0);

    // Add dummy frame size for V1-5 and V7-8
    let dummyFrameSize = 0;
    if (version !== 6) {
      // We need a dummy frame with the evaluation stack at the top level
      dummyFrameSize = 8 + stack.length * 2;
    }

    // Allocate buffer
    const stksData = Buffer.alloc(totalFrameSize + dummyFrameSize);
    let offset = 0;

    // Add dummy frame for non-V6 games
    if (version !== 6) {
      // Write return PC (0)
      stksData.writeUInt8(0, offset++);
      stksData.writeUInt8(0, offset++);
      stksData.writeUInt8(0, offset++);

      // Write flags (0)
      stksData.writeUInt8(0, offset++);

      // Write variable number (0)
      stksData.writeUInt8(0, offset++);

      // Write arguments bitmap (0)
      stksData.writeUInt8(0, offset++);

      // Write eval stack size
      stksData.writeUInt16BE(stack.length, offset);
      offset += 2;

      // Write eval stack
      for (let i = 0; i < stack.length; i++) {
        stksData.writeUInt16BE(stack[i], offset);
        offset += 2;
      }
    }

    // Add each frame
    for (const frame of callstack) {
      // Write return PC (3 bytes)
      stksData.writeUInt8((frame.returnPC >> 16) & 0xff, offset++);
      stksData.writeUInt8((frame.returnPC >> 8) & 0xff, offset++);
      stksData.writeUInt8(frame.returnPC & 0xff, offset++);

      // Write flags
      // p is set if frame.resultVariable is null
      const pFlag = frame.resultVariable === null ? 0x10 : 0x00;
      const vCount = frame.locals.length;
      const flags = pFlag | vCount;
      stksData.writeUInt8(flags, offset++);

      // Write variable number
      stksData.writeUInt8(frame.resultVariable !== null ? frame.resultVariable : 0, offset++);

      // Write arguments bitmap
      // For each bit 0-6, set if argument was provided
      let argBitmap = 0;
      for (let i = 0; i < Math.min(frame.argumentCount, 7); i++) {
        argBitmap |= 1 << i;
      }
      stksData.writeUInt8(argBitmap, offset++);

      // Write eval stack size
      stksData.writeUInt16BE(frame.previousSP || 0, offset);
      offset += 2;

      // Write local variables
      for (let i = 0; i < frame.locals.length; i++) {
        stksData.writeUInt16BE(frame.locals[i], offset);
        offset += 2;
      }

      // For this frame, we don't actually store the eval stack data here -
      // it's stored in the next frame's previousSP
    }

    return {
      id: QuetzalChunk.Stks,
      data: stksData,
    };
  }

  /**
   * Parse a Stks (stacks) chunk
   * @param data The chunk data
   * @returns The parsed stacks
   */
  private parseStksChunk(data: Buffer): { stack: number[]; callstack: StackFrame[] } {
    const stack: number[] = [];
    const callstack: StackFrame[] = [];

    let offset = 0;

    // Process frames until we run out of data
    while (offset < data.length) {
      // Read return PC (3 bytes)
      const pc = (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2];
      offset += 3;

      // Read flags
      const flags = data[offset++];
      const pFlag = (flags & 0x10) !== 0;
      const vCount = flags & 0x0f;

      // Read variable number
      const varNum = data[offset++];

      // Read arguments bitmap
      const argBitmap = data[offset++];

      // Count arguments
      let argCount = 0;
      for (let i = 0; i < 7; i++) {
        if ((argBitmap & (1 << i)) !== 0) {
          argCount++;
        }
      }

      // Read eval stack size
      const evalStackSize = data.readUInt16BE(offset);
      offset += 2;

      // Read local variables
      const locals = new Uint16Array(vCount);
      for (let i = 0; i < vCount; i++) {
        locals[i] = data.readUInt16BE(offset);
        offset += 2;
      }

      // Read eval stack for this frame
      const evalStack = [];
      for (let i = 0; i < evalStackSize; i++) {
        evalStack.push(data.readUInt16BE(offset));
        offset += 2;
      }

      // Check if this is a dummy frame
      const isDummyFrame = pc === 0 && vCount === 0 && argCount === 0;

      if (isDummyFrame) {
        // Add the dummy frame's stack to the global stack
        stack.push(...evalStack);
      } else {
        // Add real frame to the callstack
        callstack.push({
          returnPC: pc,
          previousSP: evalStackSize,
          locals,
          resultVariable: pFlag ? null : varNum,
          argumentCount: argCount,
          routineAddress: 0, // We don't have this info in Quetzal files
        });

        // Add the eval stack to the global stack
        stack.push(...evalStack);
      }
    }

    return { stack, callstack };
  }

  /**
   * Create an IFF FORM
   * @param formType The form type
   * @param chunks The chunks to include
   * @returns The IFF FORM data
   */
  private createIffForm(formType: string, chunks: IffChunk[]): Buffer {
    // Calculate size:
    // 4 bytes for 'FORM'
    // 4 bytes for length
    // 4 bytes for form type
    // For each chunk:
    //   4 bytes for ID
    //   4 bytes for length
    //   n bytes for data
    //   0-1 bytes for padding

    let totalSize = 4 + 4 + 4;

    for (const chunk of chunks) {
      totalSize += 4 + 4 + chunk.data.length;

      // Add padding byte if data length is odd
      if (chunk.data.length % 2 !== 0) {
        totalSize += 1;
      }
    }

    // Create buffer
    const buffer = Buffer.alloc(totalSize);
    let offset = 0;

    // Write FORM header
    buffer.write('FORM', offset);
    offset += 4;

    // Write size (excluding the 'FORM' and size field)
    buffer.writeUInt32BE(totalSize - 8, offset);
    offset += 4;

    // Write form type
    buffer.write(formType, offset);
    offset += 4;

    // Write each chunk
    for (const chunk of chunks) {
      // Write chunk ID
      buffer.write(chunk.id, offset);
      offset += 4;

      // Write chunk length
      buffer.writeUInt32BE(chunk.data.length, offset);
      offset += 4;

      // Write chunk data
      chunk.data.copy(buffer, offset);
      offset += chunk.data.length;

      // Add padding byte if data length is odd
      if (chunk.data.length % 2 !== 0) {
        buffer[offset++] = 0;
      }
    }

    return buffer;
  }

  /**
   * Parse an IFF FORM
   * @param data The IFF data
   * @returns The form type and chunks
   */
  private parseIffForm(data: Buffer): { formType: string; chunks: IffChunk[] } {
    if (data.length < 12) {
      throw new Error('Invalid IFF file: too short');
    }

    // Read FORM header
    const formTag = data.toString('ascii', 0, 4);
    if (formTag !== 'FORM') {
      throw new Error(`Invalid IFF file: expected 'FORM', got '${formTag}'`);
    }

    // Read form size
    const formSize = data.readUInt32BE(4);
    if (formSize + 8 > data.length) {
      throw new Error(`Invalid IFF file: form size ${formSize} exceeds file size ${data.length}`);
    }

    // Read form type
    const formType = data.toString('ascii', 8, 12);

    // Parse chunks
    const chunks: IffChunk[] = [];
    let offset = 12;

    while (offset < data.length) {
      // Need at least 8 bytes for a chunk header
      if (offset + 8 > data.length) {
        break;
      }

      // Read chunk ID
      const id = data.toString('ascii', offset, offset + 4);
      offset += 4;

      // Read chunk length
      const length = data.readUInt32BE(offset);
      offset += 4;

      // Check if we have enough data for this chunk
      if (offset + length > data.length) {
        this.logger.warn(`Invalid IFF chunk: ${id} claims ${length} bytes but only ${data.length - offset} available`);
        break;
      }

      // Read chunk data
      const chunkData = Buffer.from(data.slice(offset, offset + length));
      offset += length;

      // Skip padding byte if chunk length is odd
      if (length % 2 !== 0 && offset < data.length) {
        offset += 1;
      }

      // Add chunk
      chunks.push({
        id,
        data: chunkData,
      });
    }

    return {
      formType,
      chunks,
    };
  }
}
