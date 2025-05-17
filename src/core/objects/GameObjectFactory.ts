import { MAX_OBJECTS_V3, MAX_OBJECTS_V4 } from '../../utils/constants';
import { Logger } from '../../utils/log';
import { Memory } from '../memory/Memory';
import { GameObject } from './GameObject';

/**
 * Extension of GameObject that overrides the getObject method
 * to use the factory for object retrieval
 */
class ManagedGameObject extends GameObject {
  private readonly factory: GameObjectFactory;

  constructor(
    memory: Memory,
    version: number,
    objTable: number,
    objNum: number,
    factory: GameObjectFactory,
    options?: { logger?: Logger }
  ) {
    super(memory, version, objTable, objNum, options);
    this.factory = factory;
  }

  /**
   * Get an object by its number using the factory
   * @param objNum Object number
   * @returns The game object or null if invalid
   */
  protected getObject(objNum: number): GameObject | null {
    return this.factory.getObject(objNum);
  }
}

/**
 * Factory for creating and managing GameObject instances
 */
export class GameObjectFactory {
  private readonly memory: Memory;
  private readonly logger: Logger;
  private readonly version: number;
  private readonly objTable: number;
  private readonly objectCache: Map<number, GameObject>;
  private readonly hasOptionsLogger: boolean;
  private readonly validObjectNumbers: Set<number>; // NEW: Track valid object numbers

  /**
   * Create a new GameObjectFactory
   * @param memory Memory access
   * @param logger Logger instance
   * @param version Z-machine version
   * @param objTable Object table address
   */
  constructor(memory: Memory, version: number, objTable: number, options?: { logger?: Logger }) {
    this.memory = memory;
    this.version = version;
    this.objTable = objTable;
    this.objectCache = new Map<number, GameObject>();
    this.validObjectNumbers = new Set<number>(); // NEW
    this.hasOptionsLogger = options?.logger !== undefined;
    this.logger = options?.logger || new Logger('GameObjectFactory');

    this.logger.debug(`Created GameObjectFactory for version ${version} object table at ${objTable.toString(16)}`);

    // NEW: Identify valid objects during initialization
    this.identifyValidObjects();
  }

  /**
   * Scan the object table to identify which object numbers are valid
   * This prevents attempting to create objects that don't exist in the story file
   */
  private identifyValidObjects(): void {
    const maxObjects = this.getMaxObjects();
    const entrySize = this.version <= 3 ? 9 : 14;
    const propertyDefaultsSize = this.version <= 3 ? 31 * 2 : 63 * 2;

    // Start address of the object entries
    const objectEntriesStart = this.objTable + propertyDefaultsSize;

    // Check each potential object number
    for (let objNum = 1; objNum <= maxObjects; objNum++) {
      const objAddr = objectEntriesStart + (objNum - 1) * entrySize;

      try {
        // Try to access the object's address to verify it's within memory bounds
        if (this.isValidObjectAddress(objAddr)) {
          this.validObjectNumbers.add(objNum);
          this.logger.debug(`Found valid object ${objNum} at address 0x${objAddr.toString(16)}`);
        }
      } catch (error) {
        // If we get a memory access error, stop scanning
        this.logger.debug(
          `Stopping object scan at object ${objNum}: ${error instanceof Error ? error.message : String(error)}`
        );
        break;
      }
    }

    this.logger.info(`Identified ${this.validObjectNumbers.size} valid objects in the story file`);
  }

  /**
   * Check if an address contains a valid object entry
   */
  private isValidObjectAddress(objAddr: number): boolean {
    try {
      // Try to read bytes that should be part of the object
      // This will throw an error if outside memory bounds
      this.memory.getByte(objAddr);

      // For additional validation, we could check if the parent/sibling/child
      // fields contain valid object numbers, but this basic check is sufficient
      // to prevent most memory access errors

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the maximum valid object number for the current version
   * @returns Maximum object number
   */
  getMaxObjects(): number {
    return this.version <= 3 ? MAX_OBJECTS_V3 : MAX_OBJECTS_V4;
  }

  /**
   * Get an object by its number
   * @param objNum Object number
   * @returns The game object or null if the number is invalid
   */
  getObject(objNum: number): GameObject | null {
    // Object number 0 is always null
    if (objNum === 0) {
      return null;
    }

    // NEW: Check if this is a valid object number
    if (!this.validObjectNumbers.has(objNum)) {
      this.logger.warn(`Invalid object number: ${objNum}`);
      return null;
    }

    // Return cached object if available
    let obj = this.objectCache.get(objNum);
    if (obj) {
      return obj;
    }

    this.logger.debug(`Creating new object ${objNum}`);
    if (this.hasOptionsLogger) {
      obj = new ManagedGameObject(this.memory, this.version, this.objTable, objNum, this, { logger: this.logger });
    } else {
      obj = new ManagedGameObject(this.memory, this.version, this.objTable, objNum, this);
    }

    // Cache the object for future use
    this.objectCache.set(objNum, obj);

    return obj;
  }

  /**
   * Reset the object cache
   * This should be called when loading a saved game
   */
  resetCache(): void {
    this.objectCache.clear();
    this.logger.debug('Object cache cleared');
  }

  /**
   * Get all objects in the game
   * @returns Array of all valid game objects
   */
  getAllObjects(): GameObject[] {
    const objects: GameObject[] = [];

    // Only iterate over valid object numbers
    for (const objNum of this.validObjectNumbers) {
      const obj = this.getObject(objNum);
      if (obj) {
        objects.push(obj);
      }
    }

    return objects;
  }

  /**
   * Find objects that have a specific attribute
   * @param attribute Attribute number to check
   * @returns Array of objects with the attribute
   */
  findObjectsWithAttribute(attribute: number): GameObject[] {
    return this.getAllObjects().filter((obj) => obj.hasAttribute(attribute));
  }

  /**
   * Find objects with a specific property
   * @param property Property number to check
   * @returns Array of objects with the property
   */
  findObjectsWithProperty(property: number): GameObject[] {
    return this.getAllObjects().filter((obj) => obj.getPropertyAddress(property) !== 0);
  }

  /**
   * Find all root objects (objects with no parent)
   * @returns Array of root objects
   */
  findRootObjects(): GameObject[] {
    return this.getAllObjects().filter((obj) => obj.parent === null);
  }
}
