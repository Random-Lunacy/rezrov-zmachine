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
 * Interface for handling multimedia resources in Z-machine
 * This is a placeholder for future implementation
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
   * Display a picture
   * @param resourceId Picture resource ID
   * @param x X coordinate
   * @param y Y coordinate
   * @param scale Scale factor (100 = normal size)
   * @returns Status of the operation
   */
  displayPicture(resourceId: number, x: number, y: number, scale: number): ResourceStatus;
}

/**
 * Base implementation of MultimediaHandler that does nothing
 * This serves as a placeholder for actual implementations
 */
export class BaseMultimediaHandler implements MultimediaHandler {
  private logger: Logger;

  constructor(options?: { logger?: Logger }) {
    this.logger = options?.logger || new Logger('BaseMultimediaHandler');
  }

  isResourceAvailable(type: ResourceType, resourceId: number): boolean {
    this.logger.debug(`Checking availability of ${ResourceType[type]} ${resourceId}`);
    return false;
  }

  async loadResource(type: ResourceType, resourceId: number): Promise<ResourceStatus> {
    // TODO: Implement actual loading logic
    this.logger.debug(`Loaded ${ResourceType[type]} ${resourceId}`);
    return ResourceStatus.NotAvailable;
  }

  playSound(resourceId: number, effect: number, volume: number, repeats: number): ResourceStatus {
    // TODO: Implement actual sound playing logic
    this.logger.debug(`Playing sound ${resourceId} (effect: ${effect}, volume: ${volume}, repeats: ${repeats})`);
    return ResourceStatus.NotAvailable;
  }

  stopSound(resourceId: number): ResourceStatus {
    //TODO: Implement actual sound stopping logic
    this.logger.debug(`Stopping sound ${resourceId}`);
    return ResourceStatus.NotAvailable;
  }

  displayPicture(resourceId: number, x: number, y: number, scale: number): ResourceStatus {
    // TODO: Implement actual picture displaying logic
    this.logger.debug(`Displaying picture ${resourceId} at (${x},${y}) with scale ${scale}%`);
    return ResourceStatus.NotAvailable;
  }
}
