// src/examples/GameObjectExample.ts
import { Memory } from '../core/memory/Memory';
import { GameObjectFactory } from '../core/objects/GameObjectFactory';
import { Logger, LogLevel } from '../utils/log';
import { HeaderLocation } from '../utils/constants';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Example that demonstrates loading a Z-machine story file and
 * inspecting the objects in the game world
 */
async function runGameObjectExample(storyFilePath: string): Promise<void> {
  // Set up logger
  const logger = new Logger(LogLevel.DEBUG);
  logger.info(`Loading Z-machine story file: ${storyFilePath}`);

  try {
    // Load the story file
    const storyData = fs.readFileSync(storyFilePath);
    logger.info(`Loaded ${storyData.length} bytes from story file`);

    // Create memory from the story file
    const memory = new Memory(storyData);

    // Read basic information from the header
    const version = memory.getByte(HeaderLocation.Version);
    const objectTableAddr = memory.getWord(HeaderLocation.ObjectTable);

    logger.info(`Z-machine version: ${version}`);
    logger.info(`Object table at: 0x${objectTableAddr.toString(16)}`);

    // Create the object factory
    const factory = new GameObjectFactory(memory, logger, version, objectTableAddr);

    // Find all root objects (objects with no parent)
    const rootObjects = factory.findRootObjects();
    logger.info(`Found ${rootObjects.length} root objects`);

    // Display the object hierarchy
    logger.info('Object hierarchy:');
    rootObjects.forEach(obj => {
      displayObjectTree(obj, 0);
    });

    // Find objects with certain attributes
    // Attribute 21 is often CONTAINER in Infocom games
    const containersAttr = 21;
    const containers = factory.findObjectsWithAttribute(containersAttr);
    logger.info(`\nFound ${containers.length} objects with attribute ${containersAttr}:`);
    containers.forEach(obj => {
      logger.info(`  [${obj.objnum}] ${obj.name}`);
    });

    // Find objects with certain properties
    // Property 18 is often CAPACITY in Infocom games
    const capacityProp = 18;
    const objsWithCapacity = factory.findObjectsWithProperty(capacityProp);
    logger.info(`\nFound ${objsWithCapacity.length} objects with property ${capacityProp}:`);
    objsWithCapacity.forEach(obj => {
      const capacity = obj.getProperty(capacityProp);
      logger.info(`  [${obj.objnum}] ${obj.name} - capacity: ${capacity}`);
    });
  } catch (error) {
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.debug(error.stack);
    }
  }
}

/**
 * Helper function to display an object tree with proper indentation
 */
function displayObjectTree(obj: any, depth: number): void {
  const indent = '  '.repeat(depth);
  console.log(`${indent}[${obj.objnum}] ${obj.name}`);

  // Display children recursively
  for (let child = obj.child; child !== null; child = child.sibling) {
    displayObjectTree(child, depth + 1);
  }
}

// If this file is run directly, execute the example
if (require.main === module) {
  // Path to a Z-machine story file (e.g., Zork)
  const storyPath = process.argv[2] || path.join(__dirname, '../../stories/zork1.z3');

  runGameObjectExample(storyPath)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Unhandled error:', err);
      process.exit(1);
    });
}
