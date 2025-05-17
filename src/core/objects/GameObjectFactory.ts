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

    // Based on the file dump, the actual object table in this story file
    // only contains 7 valid objects (1-7)
    this.logger.info(`Scanning for valid objects starting from 0x${objectEntriesStart.toString(16)}`);

    // Check each potential object number
    for (let objNum = 1; objNum <= maxObjects; objNum++) {
      const objAddr = objectEntriesStart + (objNum - 1) * entrySize;

      try {
        // More rigorous validation of object structure
        if (this.isValidZMachineObject(objAddr)) {
          this.validObjectNumbers.add(objNum);
          this.logger.debug(`Found valid object ${objNum} at address 0x${objAddr.toString(16)}`);
        }
      } catch (error) {
        // If we get a memory access error, log and continue
        this.logger.debug(
          `Object ${objNum} failed validation: ${error instanceof Error ? error.message : String(error)}`
        );

        // Don't stop scanning - just skip this object and try the next one
        // Some objects may be invalid due to story file structure
      }
    }

    this.logger.info(`Identified ${this.validObjectNumbers.size} valid objects in the story file`);
  }

  /**
   * Perform comprehensive validation of a potential Z-machine object
   * @param objAddr The address of the potential object
   * @param objNum The object number being validated
   * @returns true if this appears to be a valid Z-machine object
   */
  private isValidZMachineObject(objAddr: number): boolean {
    try {
      // 1. Basic memory access check - can we read the object data?
      // First bytes are attribute flags, which we can read without specific checks
      this.memory.getByte(objAddr);

      // 2. Check validity of parent, sibling, child pointers
      const parentNum = this.version <= 3 ? this.memory.getByte(objAddr + 4) : this.memory.getWord(objAddr + 6);

      // Parent number should be 0 or a valid object number
      // This prevents obviously invalid references
      const maxObjects = this.getMaxObjects();
      if (parentNum > maxObjects) {
        return false;
      }

      // We should also check sibling and child object numbers
      const siblingNum = this.version <= 3 ? this.memory.getByte(objAddr + 5) : this.memory.getWord(objAddr + 8);

      const childNum = this.version <= 3 ? this.memory.getByte(objAddr + 6) : this.memory.getWord(objAddr + 10);

      // Validate sibling and child numbers as well
      if (siblingNum > maxObjects || childNum > maxObjects) {
        return false;
      }

      // 3. Check property table address - crucial for a valid object
      const propTableAddr = this.memory.getWord(objAddr + (this.version <= 3 ? 7 : 12));

      // Property table must be within memory bounds
      if (propTableAddr <= 0 || propTableAddr >= this.memory.size) {
        return false;
      }

      // 4. Validate property table structure
      // First byte should be a length byte for the object name (usually 0-16)
      const nameLength = this.memory.getByte(propTableAddr);

      // Name length should be reasonable - Inform typically uses short names
      if (nameLength > 20) {
        return false;
      }

      // Check that we can access the name string bytes
      for (let i = 0; i < nameLength * 2; i++) {
        this.memory.getByte(propTableAddr + 1 + i);
      }

      // 5. Check for at least one property after the name (or a terminator)
      const propStart = propTableAddr + 1 + nameLength * 2;
      const firstPropByte = this.memory.getByte(propStart);

      // Either a valid property number (1-31/63) or a terminator (0)
      if (firstPropByte !== 0 && (firstPropByte & 0x1f) === 0) {
        return false;
      }

      // This object passed all checks
      return true;
    } catch (error) {
      // Any exception (like memory access errors) means it's not a valid object
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
