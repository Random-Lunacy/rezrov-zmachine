import { Logger } from '../../utils/log';

/**
 * Types of multimedia resources
 */
export enum ResourceType {
  Picture = 1,
  Sound = 2,
  Music = 3,
}

/**
 * Status of a multimedia operation
 */
export enum ResourceStatus {
  Available = 0, // Resource is available
  NotAvailable = 1, // Resource is not available
  Loading = 2, // Resource is loading
  Loaded = 3, // Resource is loaded and ready to use
  Playing = 4, // Resource is currently playing
  Stopped = 5, // Resource is stopped
  Error = 6, // Error occurred during resource operation
}

/**
 * Picture data structure for getPictureData method
 */
export interface PictureData {
  width: number;
  height: number;
  format: string;
  hasTransparency: boolean;
}

/**
 * Resource information structure for getResourceInfo method
 */
export interface ResourceInfo {
  size: number;
  format: string;
  metadata: Record<string, unknown>;
}

/**
 * Interface for handling multimedia resources in Z-machine
 * This interface covers all multimedia operations required by the Z-Machine spec
 */
export interface MultimediaHandler {
  /**
   * Check if a particular resource is available
   * @param type Resource type
   * @param resourceId ID of the resource
   * @returns True if the resource is available
   */
  isResourceAvailable(type: ResourceType, resourceId: number): boolean;

  /**
   * Load a resource into memory
   * @param type Resource type
   * @param resourceId ID of the resource
   * @returns Promise that resolves when resource is loaded
   */
  loadResource(type: ResourceType, resourceId: number): Promise<ResourceStatus>;

  /**
   * Unload a resource from memory
   * @param type Resource type
   * @param resourceId ID of the resource
   * @returns Promise that resolves when resource is unloaded
   */
  unloadResource(type: ResourceType, resourceId: number): Promise<ResourceStatus>;

  /**
   * Get information about a resource
   * @param type Resource type
   * @param resourceId ID of the resource
   * @returns Resource information or null if not available
   */
  getResourceInfo(type: ResourceType, resourceId: number): ResourceInfo | null;

  /**
   * Preload multiple resources
   * @param resources Array of resource type and ID pairs
   * @returns Promise that resolves with array of load statuses
   */
  preloadResources(resources: Array<{ type: ResourceType; id: number }>): Promise<ResourceStatus[]>;

  // Sound Effects Methods
  /**
   * Play a sound effect
   * @param resourceId Sound resource ID
   * @param effect Effect number
   * @param volume Volume level (0-255)
   * @param repeats Number of repeats (0 = infinite)
   * @returns Status of the operation
   */
  playSound(resourceId: number, effect: number, volume: number, repeats: number): ResourceStatus;

  /**
   * Stop a playing sound
   * @param resourceId Sound resource ID (0 = all sounds)
   * @returns Status of the operation
   */
  stopSound(resourceId: number): ResourceStatus;

  /**
   * Get the current status of a sound
   * @param resourceId Sound resource ID
   * @returns Current status of the sound
   */
  getSoundStatus(resourceId: number): ResourceStatus;

  /**
   * Set the volume of a playing sound
   * @param resourceId Sound resource ID
   * @param volume Volume level (0-255)
   * @returns Status of the operation
   */
  setSoundVolume(resourceId: number, volume: number): ResourceStatus;

  /**
   * Get the current volume of a sound
   * @param resourceId Sound resource ID
   * @returns Current volume level (0-255) or -1 if not found
   */
  getSoundVolume(resourceId: number): number;

  // Music Methods (V6+)
  /**
   * Play background music
   * @param resourceId Music resource ID
   * @param volume Volume level (0-255)
   * @param repeats Number of repeats (0 = infinite)
   * @returns Status of the operation
   */
  playMusic(resourceId: number, volume: number, repeats: number): ResourceStatus;

  /**
   * Stop background music
   * @param resourceId Music resource ID (0 = all music)
   * @returns Status of the operation
   */
  stopMusic(resourceId: number): ResourceStatus;

  /**
   * Set the volume of background music
   * @param resourceId Music resource ID
   * @param volume Volume level (0-255)
   * @returns Status of the operation
   */
  setMusicVolume(resourceId: number, volume: number): ResourceStatus;

  /**
   * Get the current status of background music
   * @param resourceId Music resource ID
   * @returns Current status of the music
   */
  getMusicStatus(resourceId: number): ResourceStatus;

  // Picture Methods
  /**
   * Display a picture
   * @param resourceId Picture resource ID
   * @param x X coordinate
   * @param y Y coordinate
   * @param scale Scale factor (100 = normal size)
   * @returns Status of the operation
   */
  displayPicture(resourceId: number, x: number, y: number, scale: number): ResourceStatus;

  /**
   * Erase a displayed picture
   * @param resourceId Picture resource ID
   * @returns Status of the operation
   */
  erasePicture(resourceId: number): ResourceStatus;

  /**
   * Get picture data and metadata
   * @param resourceId Picture resource ID
   * @returns Picture data or null if not available
   */
  getPictureData(resourceId: number): PictureData | null;

  /**
   * Set the scale of a displayed picture
   * @param resourceId Picture resource ID
   * @param scale Scale factor (100 = normal size)
   * @returns Status of the operation
   */
  setPictureScale(resourceId: number, scale: number): ResourceStatus;

  /**
   * Get the current position of a displayed picture
   * @param resourceId Picture resource ID
   * @returns Current position {x, y} or null if not found
   */
  getPicturePosition(resourceId: number): { x: number; y: number } | null;
}

/**
 * Base implementation of MultimediaHandler that provides stubs for all methods
 * This serves as a placeholder for actual implementations
 */
export class BaseMultimediaHandler implements MultimediaHandler {
  private logger: Logger;

  constructor(options?: { logger?: Logger }) {
    this.logger = options?.logger || new Logger('BaseMultimediaHandler');
  }

  // Resource Management Methods
  isResourceAvailable(type: ResourceType, resourceId: number): boolean {
    this.logger.debug(`Checking availability of ${ResourceType[type]} ${resourceId}`);
    return false;
  }

  async loadResource(type: ResourceType, resourceId: number): Promise<ResourceStatus> {
    this.logger.debug(`Loading ${ResourceType[type]} ${resourceId}`);
    return ResourceStatus.NotAvailable;
  }

  async unloadResource(type: ResourceType, resourceId: number): Promise<ResourceStatus> {
    this.logger.debug(`Unloading ${ResourceType[type]} ${resourceId}`);
    return ResourceStatus.NotAvailable;
  }

  getResourceInfo(type: ResourceType, resourceId: number): ResourceInfo | null {
    this.logger.debug(`Getting info for ${ResourceType[type]} ${resourceId}`);
    return null;
  }

  async preloadResources(resources: Array<{ type: ResourceType; id: number }>): Promise<ResourceStatus[]> {
    this.logger.debug(`Preloading ${resources.length} resources`);
    return resources.map(() => ResourceStatus.NotAvailable);
  }

  // Sound Effects Methods
  playSound(resourceId: number, effect: number, volume: number, repeats: number): ResourceStatus {
    this.logger.debug(`Playing sound ${resourceId} (effect: ${effect}, volume: ${volume}, repeats: ${repeats})`);
    return ResourceStatus.NotAvailable;
  }

  stopSound(resourceId: number): ResourceStatus {
    this.logger.debug(`Stopping sound ${resourceId}`);
    return ResourceStatus.NotAvailable;
  }

  getSoundStatus(resourceId: number): ResourceStatus {
    this.logger.debug(`Getting status for sound ${resourceId}`);
    return ResourceStatus.NotAvailable;
  }

  setSoundVolume(resourceId: number, volume: number): ResourceStatus {
    this.logger.debug(`Setting volume for sound ${resourceId} to ${volume}`);
    return ResourceStatus.NotAvailable;
  }

  getSoundVolume(resourceId: number): number {
    this.logger.debug(`Getting volume for sound ${resourceId}`);
    return -1;
  }

  // Music Methods (V6+)
  playMusic(resourceId: number, volume: number, repeats: number): ResourceStatus {
    this.logger.debug(`Playing music ${resourceId} (volume: ${volume}, repeats: ${repeats})`);
    return ResourceStatus.NotAvailable;
  }

  stopMusic(resourceId: number): ResourceStatus {
    this.logger.debug(`Stopping music ${resourceId}`);
    return ResourceStatus.NotAvailable;
  }

  setMusicVolume(resourceId: number, volume: number): ResourceStatus {
    this.logger.debug(`Setting volume for music ${resourceId} to ${volume}`);
    return ResourceStatus.NotAvailable;
  }

  getMusicStatus(resourceId: number): ResourceStatus {
    this.logger.debug(`Getting status for music ${resourceId}`);
    return ResourceStatus.NotAvailable;
  }

  // Picture Methods
  displayPicture(resourceId: number, x: number, y: number, scale: number): ResourceStatus {
    this.logger.debug(`Displaying picture ${resourceId} at (${x},${y}) with scale ${scale}%`);
    return ResourceStatus.NotAvailable;
  }

  erasePicture(resourceId: number): ResourceStatus {
    this.logger.debug(`Erasing picture ${resourceId}`);
    return ResourceStatus.NotAvailable;
  }

  getPictureData(resourceId: number): PictureData | null {
    this.logger.debug(`Getting data for picture ${resourceId}`);
    return null;
  }

  setPictureScale(resourceId: number, scale: number): ResourceStatus {
    this.logger.debug(`Setting scale for picture ${resourceId} to ${scale}%`);
    return ResourceStatus.NotAvailable;
  }

  getPicturePosition(resourceId: number): { x: number; y: number } | null {
    this.logger.debug(`Getting position for picture ${resourceId}`);
    return null;
  }
}
