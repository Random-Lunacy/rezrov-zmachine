import { Memory } from '../memory/Memory';
import { Logger } from '../../utils/log';
import { GameObject } from './GameObject';
import { MAX_OBJECTS_V3, MAX_OBJECTS_V4 } from '../../utils/constants';

/**
 * Extension of GameObject that overrides the getObject method
 * to use the factory for object retrieval
 */
class ManagedGameObject extends GameObject {
  private factory: GameObjectFactory;

  constructor(
    memory: Memory,
    logger: Logger,
    version: number,
    objTable: number,
    objnum: number,
    factory: GameObjectFactory
  ) {
    super(memory, logger, version, objTable, objnum);
    this.factory = factory;
  }

  /**
   * Get an object by its number using the factory
   * @param objnum Object number
   * @returns The game object or null if invalid
   */
  protected getObject(objnum: number): GameObject | null {
    return this.factory.getObject(objnum);
  }
}

/**
 * Factory for creating and managing GameObject instances
 */
export class GameObjectFactory {
  private memory: Memory;
  private logger: Logger;
  private version: number;
  private objTable: number;
  private objectCache: Map<number, GameObject>;

  /**
   * Create a new GameObjectFactory
   * @param memory Memory access
   * @param logger Logger instance
   * @param version Z-machine version
   * @param objTable Object table address
   */
  constructor(memory: Memory, logger: Logger, version: number, objTable: number) {
    this.memory = memory;
    this.logger = logger;
    this.version = version;
    this.objTable = objTable;
    this.objectCache = new Map<number, GameObject>();

    this.logger.debug(`Created GameObjectFactory for version ${version} object table at ${objTable.toString(16)}`);
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
   * @param objnum Object number
   * @returns The game object or null if the number is invalid
   */
  getObject(objnum: number): GameObject | null {
    // Object number 0 is always null
    if (objnum === 0) {
      return null;
    }

    // Validate object number
    const maxObjects = this.getMaxObjects();
    if (objnum < 0 || objnum > maxObjects) {
      this.logger.warn(`Invalid object number: ${objnum}`);
      return null;
    }

    // Return cached object if available
    let obj = this.objectCache.get(objnum);
    if (obj) {
      return obj;
    }

    // Create and cache new object
    obj = new ManagedGameObject(this.memory, this.logger, this.version, this.objTable, objnum, this);
    this.objectCache.set(objnum, obj);

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
    const maxObjects = this.getMaxObjects();

    for (let i = 1; i <= maxObjects; i++) {
      const obj = this.getObject(i);
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
    return this.getAllObjects().filter(obj => obj.hasAttribute(attribute));
  }

  /**
   * Find objects with a specific property
   * @param property Property number to check
   * @returns Array of objects with the property
   */
  findObjectsWithProperty(property: number): GameObject[] {
    return this.getAllObjects().filter(obj => obj.getPropertyAddress(property) !== 0);
  }

  /**
   * Find all root objects (objects with no parent)
   * @returns Array of root objects
   */
  findRootObjects(): GameObject[] {
    return this.getAllObjects().filter(obj => obj.parent === null);
  }
}
