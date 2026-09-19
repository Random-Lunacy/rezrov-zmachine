/**
 * Blorb-backed MultimediaHandler implementation.
 *
 * Bridges the BlorbParser resource extraction with the MultimediaHandler interface,
 * enabling graphics opcodes (draw_picture, picture_data, etc.) to resolve picture
 * dimensions and availability from Blorb container resources.
 *
 * JPEG and PNG dimensions are extracted directly from binary headers without
 * external dependencies.
 */
import type { BlorbMap } from '../../resources/BlorbData';
import { BlorbChunkType, BlorbUsage } from '../../resources/BlorbData';
import { BlorbParser } from '../../resources/BlorbParser';
import { isPng, readPalette, replacePalette } from '../../resources/PngPalette';
import { Logger } from '../../utils/log';
import {
  BaseMultimediaHandler,
  type PictureData,
  type ResourceInfo,
  ResourceStatus,
  ResourceType,
} from './MultimediaHandler';

/**
 * Extract width and height from a JPEG buffer by scanning for SOF markers.
 * SOF0 (0xFFC0) through SOF3 (0xFFC3) contain the image dimensions.
 * Returns null if no SOF marker is found.
 */
function getJpegDimensions(data: Buffer): { width: number; height: number } | null {
  // Validate JPEG SOI marker
  if (data.length < 2 || data[0] !== 0xff || data[1] !== 0xd8) {
    return null;
  }

  let offset = 2;

  while (offset + 4 < data.length) {
    if (data[offset] !== 0xff) {
      return null;
    }

    const marker = data[offset + 1];

    // SOF markers: 0xC0-0xC3 (baseline, extended, progressive, lossless)
    if (marker >= 0xc0 && marker <= 0xc3) {
      if (offset + 9 > data.length) return null;
      const height = data.readUInt16BE(offset + 5);
      const width = data.readUInt16BE(offset + 7);
      return { width, height };
    }

    // Skip marker segment (length is big-endian at offset+2)
    if (offset + 3 >= data.length) return null;
    const segmentLength = data.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }

  return null;
}

/**
 * Extract width and height from a PNG buffer by reading the IHDR chunk.
 * The IHDR chunk starts at byte 16 and contains 4-byte BE width and height.
 * Returns null if the buffer is too small or has an invalid PNG signature.
 */
function getPngDimensions(data: Buffer): { width: number; height: number } | null {
  // PNG signature (8 bytes) + IHDR length (4) + 'IHDR' (4) + width (4) + height (4) = 24 bytes minimum
  if (data.length < 24) return null;

  // Validate PNG signature
  if (
    data[0] !== 0x89 ||
    data[1] !== 0x50 ||
    data[2] !== 0x4e ||
    data[3] !== 0x47 ||
    data[4] !== 0x0d ||
    data[5] !== 0x0a ||
    data[6] !== 0x1a ||
    data[7] !== 0x0a
  ) {
    return null;
  }

  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  return { width, height };
}

/**
 * Extract width and height from a Blorb 'Rect' placeholder chunk: 4-byte BE
 * width followed by 4-byte BE height, no pixel data. Returns null if the
 * buffer is too small.
 */
function getRectDimensions(data: Buffer): { width: number; height: number } | null {
  if (data.length < 8) return null;

  const width = data.readUInt32BE(0);
  const height = data.readUInt32BE(4);
  return { width, height };
}

/**
 * Callback for displaying a picture. Receives raw image data and display parameters.
 */
export type PictureRendererCallback = (
  resourceId: number,
  data: Buffer,
  format: string,
  x: number,
  y: number,
  scale: number,
  window: number
) => void;

/**
 * Callback for erasing a displayed picture.
 */
export type PictureEraserCallback = (resourceId: number) => void;

/**
 * Callback for playing a sound. Returns ResourceStatus.
 */
export type SoundPlayerCallback = (
  resourceId: number,
  data: Buffer,
  format: string,
  volume: number,
  repeats: number
) => ResourceStatus;

/**
 * Options for BlorbMultimediaHandler constructor.
 */
export interface BlorbMultimediaHandlerOptions {
  logger?: Logger;
  pictureRenderer?: PictureRendererCallback;
  pictureEraser?: PictureEraserCallback;
  soundPlayer?: SoundPlayerCallback;
}

/**
 * MultimediaHandler backed by Blorb resources.
 *
 * Extends BaseMultimediaHandler to provide real picture metadata from Blorb
 * containers. Sound/music methods remain stubbed (delegated to base class)
 * since audio playback requires platform-specific backends.
 *
 * When optional pictureRenderer and soundPlayer callbacks are provided,
 * displayPicture and playSound invoke them with the raw resource data,
 * enabling actual rendering and playback in the host environment.
 */
export class BlorbMultimediaHandler extends BaseMultimediaHandler {
  private readonly _blorbMap: BlorbMap;
  private readonly _blorbData: Buffer;
  private readonly _logger: Logger;
  private readonly _dimensionCache: Map<number, PictureData> = new Map();
  private readonly _pictureRenderer?: PictureRendererCallback;
  private readonly _pictureEraser?: PictureEraserCallback;
  private readonly _soundPlayer?: SoundPlayerCallback;

  /** Picture numbers listed in the Blorb 'APal' chunk (see getAdaptivePaletteIds). */
  private readonly _adaptivePaletteIds: Set<number>;

  /**
   * Palette of the most recently drawn non-adaptive picture, applied to adaptive
   * pictures so they take on the colors of the artwork they overlay. Null until
   * such a picture has been drawn.
   */
  private _currentPalette: Buffer | null = null;

  constructor(blorbMap: BlorbMap, blorbData: Buffer, options?: BlorbMultimediaHandlerOptions) {
    super(options);
    this._blorbMap = blorbMap;
    this._blorbData = blorbData;
    this._logger = options?.logger || new Logger('BlorbMultimediaHandler');
    this._pictureRenderer = options?.pictureRenderer;
    this._pictureEraser = options?.pictureEraser;
    this._soundPlayer = options?.soundPlayer;
    this._adaptivePaletteIds = BlorbParser.getAdaptivePaletteIds(blorbMap, blorbData);
  }

  get blorbMap(): BlorbMap {
    return this._blorbMap;
  }

  isResourceAvailable(type: ResourceType, resourceId: number): boolean {
    const usage = this.resourceTypeToUsage(type);
    if (!usage) return false;

    const chunkType = BlorbParser.getResourceChunkType(this._blorbMap, usage, resourceId);
    return chunkType !== null;
  }

  async loadResource(type: ResourceType, resourceId: number): Promise<ResourceStatus> {
    if (this.isResourceAvailable(type, resourceId)) {
      return ResourceStatus.Loaded;
    }
    return ResourceStatus.NotAvailable;
  }

  async unloadResource(_type: ResourceType, _resourceId: number): Promise<ResourceStatus> {
    return ResourceStatus.Available;
  }

  getResourceInfo(type: ResourceType, resourceId: number): ResourceInfo | null {
    const usage = this.resourceTypeToUsage(type);
    if (!usage) return null;

    const data = BlorbParser.getResource(this._blorbMap, this._blorbData, usage, resourceId);
    if (!data) return null;

    const chunkType = BlorbParser.getResourceChunkType(this._blorbMap, usage, resourceId);
    return {
      size: data.length,
      format: chunkType || 'unknown',
      metadata: {},
    };
  }

  async preloadResources(resources: Array<{ type: ResourceType; id: number }>): Promise<ResourceStatus[]> {
    return resources.map(({ type, id }) =>
      this.isResourceAvailable(type, id) ? ResourceStatus.Loaded : ResourceStatus.NotAvailable
    );
  }

  getPictureData(resourceId: number): PictureData | null {
    // Check cache first
    const cached = this._dimensionCache.get(resourceId);
    if (cached) return cached;

    const data = BlorbParser.getResource(this._blorbMap, this._blorbData, BlorbUsage.Pict, resourceId);
    if (!data) {
      this._logger.debug(`Picture ${resourceId} not found in Blorb`);
      return null;
    }

    const chunkType = BlorbParser.getResourceChunkType(this._blorbMap, BlorbUsage.Pict, resourceId);

    // Both are assigned on every branch below that does not return early.
    let dimensions: { width: number; height: number } | null;
    let format: string;
    let hasTransparency = false;

    if (chunkType === BlorbChunkType.JPEG) {
      dimensions = getJpegDimensions(data);
      format = 'JPEG';
    } else if (chunkType === BlorbChunkType.PNG) {
      dimensions = getPngDimensions(data);
      format = 'PNG';
      hasTransparency = true; // PNG supports alpha
    } else if (chunkType === BlorbChunkType.Rect) {
      dimensions = getRectDimensions(data);
      format = 'Rect';
    } else {
      this._logger.warn(`Picture ${resourceId}: unsupported chunk type '${chunkType}'`);
      return null;
    }

    if (!dimensions) {
      this._logger.warn(`Picture ${resourceId}: could not parse ${format} dimensions`);
      return null;
    }

    const pictureData: PictureData = {
      width: dimensions.width,
      height: dimensions.height,
      format,
      hasTransparency,
    };

    this._dimensionCache.set(resourceId, pictureData);
    this._logger.debug(`Picture ${resourceId}: ${format} ${dimensions.width}x${dimensions.height}`);
    return pictureData;
  }

  /**
   * Resolve a picture's palette against Blorb's adaptive-palette rule.
   *
   * A picture NOT listed in 'APal' owns its palette and becomes the current one.
   * A picture that IS listed carries a placeholder palette (Zork Zero ships a
   * stock EGA ramp) and is recolored with the current palette, so overlays such
   * as the compass direction markers match the artwork beneath them instead of
   * rendering in stock EGA blue/green/red.
   *
   * Returns the data to render — unchanged unless a substitution applies.
   */
  private applyAdaptivePalette(resourceId: number, data: Buffer): Buffer {
    if (!isPng(data)) return data;

    if (!this._adaptivePaletteIds.has(resourceId)) {
      const palette = readPalette(data);
      if (palette) this._currentPalette = palette;
      return data;
    }

    // Adaptive, but nothing has established a palette yet: the picture's own
    // placeholder is all we have, so draw it rather than failing.
    if (!this._currentPalette) {
      this._logger.debug(`Picture ${resourceId} is adaptive but no current palette is set`);
      return data;
    }

    return replacePalette(data, this._currentPalette);
  }

  displayPicture(resourceId: number, x: number, y: number, scale: number, window: number): ResourceStatus {
    if (!this.isResourceAvailable(ResourceType.Picture, resourceId)) {
      this._logger.debug(`Picture ${resourceId} not available for display`);
      return ResourceStatus.NotAvailable;
    }

    if (this._pictureRenderer) {
      const raw = BlorbParser.getResource(this._blorbMap, this._blorbData, BlorbUsage.Pict, resourceId);
      const chunkType = BlorbParser.getResourceChunkType(this._blorbMap, BlorbUsage.Pict, resourceId);
      if (raw && chunkType) {
        const format =
          chunkType === BlorbChunkType.PNG ? 'PNG' : chunkType === BlorbChunkType.JPEG ? 'JPEG' : chunkType;
        const data = this.applyAdaptivePalette(resourceId, raw);
        try {
          this._pictureRenderer(resourceId, data, format, x, y, scale, window);
          return ResourceStatus.Available;
        } catch (error) {
          this._logger.error(`Picture ${resourceId} render failed: ${error}`);
          return ResourceStatus.Error;
        }
      }
    }

    this._logger.debug(`Picture ${resourceId} available at (${x},${y}) scale ${scale}% window=${window}`);
    return ResourceStatus.Available;
  }

  erasePicture(resourceId: number): ResourceStatus {
    if (!this.isResourceAvailable(ResourceType.Picture, resourceId)) {
      return ResourceStatus.NotAvailable;
    }
    if (this._pictureEraser) {
      try {
        this._pictureEraser(resourceId);
      } catch (error) {
        this._logger.error(`Picture ${resourceId} erase failed: ${error}`);
        return ResourceStatus.Error;
      }
    }
    return ResourceStatus.Available;
  }

  playSound(resourceId: number, effect: number, volume: number, repeats: number): ResourceStatus {
    if (this._soundPlayer && this.isResourceAvailable(ResourceType.Sound, resourceId)) {
      const data = BlorbParser.getResource(this._blorbMap, this._blorbData, BlorbUsage.Snd, resourceId);
      const chunkType = BlorbParser.getResourceChunkType(this._blorbMap, BlorbUsage.Snd, resourceId);
      if (data && chunkType) {
        const format =
          chunkType === BlorbChunkType.OGGV ? 'OGGV' : chunkType === BlorbChunkType.AIFF ? 'AIFF' : chunkType;
        try {
          return this._soundPlayer(resourceId, data, format, volume, repeats);
        } catch (error) {
          this._logger.error(`Sound ${resourceId} play failed: ${error}`);
          return ResourceStatus.Error;
        }
      }
    }
    return super.playSound(resourceId, effect, volume, repeats);
  }

  /**
   * Map MultimediaHandler ResourceType to Blorb usage string.
   */
  private resourceTypeToUsage(type: ResourceType): string | null {
    switch (type) {
      case ResourceType.Picture:
        return BlorbUsage.Pict;
      case ResourceType.Sound:
        return BlorbUsage.Snd;
      default:
        return null;
    }
  }
}
