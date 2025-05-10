import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { GameObjectFactory, HeaderLocation, Logger, LogLevel, Memory } from '../dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runGameObjectExample(storyFilePath: string): Promise<void> {
  const logger = new Logger('GameObjectExample');
  Logger.setLevel(LogLevel.DEBUG);
  logger.info(`Loading Z-machine story file: ${storyFilePath}`);

  try {
    const storyData = fs.readFileSync(storyFilePath);
    logger.info(`Loaded ${storyData.length} bytes from story file`);

    const memory = new Memory(storyData);

    const version = memory.getByte(HeaderLocation.Version);
    const objectTableAddr = memory.getWord(HeaderLocation.ObjectTable);

    logger.info(`Z-machine version: ${version}`);
    logger.info(`Object table at: 0x${objectTableAddr.toString(16)}`);

    const factory = new GameObjectFactory(memory, logger, version, objectTableAddr);

    const rootObjects = factory.findRootObjects();
    logger.info(`Found ${rootObjects.length} root objects`);

    logger.info('Object hierarchy:');
    rootObjects.forEach((obj) => {
      displayObjectTree(obj, 0);
    });

    const containersAttr = 21;
    const containers = factory.findObjectsWithAttribute(containersAttr);
    logger.info(`\nFound ${containers.length} objects with attribute ${containersAttr}:`);
    containers.forEach((obj) => {
      logger.info(`  [${obj.objNum}] ${obj.name}`);
    });

    const capacityProp = 18;
    const objsWithCapacity = factory.findObjectsWithProperty(capacityProp);
    logger.info(`\nFound ${objsWithCapacity.length} objects with property ${capacityProp}:`);
    objsWithCapacity.forEach((obj) => {
      const capacity = obj.getProperty(capacityProp);
      logger.info(`  [${obj.objNum}] ${obj.name} - capacity: ${capacity}`);
    });
  } catch (error) {
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.debug(error.stack);
    }
  }
}

interface GameObject {
  objNum: number;
  name: string;
  child: GameObject | null;
  sibling: GameObject | null;
}

function displayObjectTree(obj: GameObject, depth: number): void {
  const indent = '  '.repeat(depth);
  const logger: Logger = new Logger('GameObjectExample');
  logger.info(`${indent}[${obj.objNum}] ${obj.name}`);

  for (let child = obj.child; child !== null; child = child.sibling) {
    displayObjectTree(child, depth + 1);
  }
}

// Main execution
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const storyPath = process.argv[2] || path.join(__dirname, '../tests/fixtures/minimal.z3');
  const logger = new Logger('GameObjectExample');
  logger.info(`Running GameObjectExample with story file: ${storyPath}`);

  runGameObjectExample(storyPath)
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error(`Unhandled error: ${err}`);
      process.exit(1);
    });
}

export { runGameObjectExample };
