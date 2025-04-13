# rezrov-zmachine

A modular Z-machine interpreter written in TypeScript.

This project is based on the [ebozz](https://github.com/toshok/ebozz) Z-machine implementation by Chris Toshok.

## What is the Z-machine?

The Z-machine is a virtual machine developed by Infocom in 1979 for their interactive fiction titles. It was one of the first portable virtual machines, allowing games to be developed once and played on many different computer platforms. Classic games like Zork, Hitchhiker's Guide to the Galaxy, and many other text adventures ran on the Z-machine.

## Project Features

- **Fully modular design**: Clear separation between core interpreter, UI, storage, and parsing components
- **TypeScript implementation**: Strong typing for better development experience
- **High compatibility**: Support for Z-machine versions 1 through 8
- **Extensible interfaces**: Easily create custom UI and storage implementations
- **Modern architecture**: Promise-based APIs for asynchronous operations
- **Comprehensive object model**: Full support for the Z-machine object system

## Installation

```bash
npm install rezrov-zmachine
```

## Basic Usage

```typescript
import { ZMachine, Memory, ConsoleScreen, FileStorage, Logger, LogLevel } from 'rezrov-zmachine';
import fs from 'fs';

// Load a story file
const storyData = fs.readFileSync('zork1.z3');

// Create the components
const logger = new Logger(LogLevel.INFO);
const memory = new Memory(storyData);
const screen = new ConsoleScreen(logger);
const storage = new FileStorage('./saves');

// Create and run the Z-machine
const machine = new ZMachine(memory, logger, screen, storage);
machine.execute();
```

## Project Structure

```
src/
├── core/           # Core Z-machine functionality
│   ├── memory/     # Memory management
│   ├── execution/  # Instruction execution
│   ├── objects/    # Object system
│   └── opcodes/    # Opcode implementations
├── interpreter/    # Z-code interpreter
├── ui/             # User interface components
│   ├── screen/     # Screen handling
│   ├── input/      # Input processing
│   └── multimedia/ # Graphics and sound
├── parsers/        # Text parsing
├── storage/        # Save/load functionality
└── utils/          # Utilities
```

## Creating a Custom Screen Implementation

The interpreter is designed to work with any UI system. You can create your own screen implementation by implementing the `Screen` interface:

```typescript
import { Screen, Capabilities, ScreenSize, ZMachine, InputState } from 'rezrov-zmachine';

export class MyCustomScreen implements Screen {
  getCapabilities(): Capabilities {
    return {
      hasColors: true,
      hasBold: true,
      hasItalic: true,
      hasReverseVideo: true,
      hasFixedPitch: true,
      hasSplitWindow: true,
      hasDisplayStatusBar: true,
      hasPictures: false,
      hasSound: false,
      hasTimedKeyboardInput: false,
    };
  }

  getSize(): ScreenSize {
    return { rows: 25, cols: 80 };
  }

  print(machine: ZMachine, text: string): void {
    // Your implementation here
  }

  // Additional methods for the Screen interface...
}
```

## Custom Storage Implementation

Similarly, you can create your own storage implementation for save/restore functionality:

```typescript
import { Storage, Snapshot } from 'rezrov-zmachine';

export class MyCustomStorage implements Storage {
  saveSnapshot(snapshot: Snapshot): void {
    // Your implementation here
  }

  loadSnapshot(): Snapshot {
    // Your implementation here
  }
}
```

## Working with Game Objects

The Z-machine has a sophisticated object system. You can interact with game objects like this:

```typescript
// Get an object by number
const obj = machine.getGameState().getObject(42);

// Get object attributes and properties
if (obj && obj.hasAttribute(21)) {
  console.log(`Object ${obj.name} is a container`);
  const capacity = obj.getProperty(18);
  console.log(`It can hold ${capacity} items`);
}

// Modify objects
obj.setAttribute(10); // Make it openable
obj.clearAttribute(2); // Make it not locked

// Move objects in the object tree
const box = machine.getGameState().getObject(23);
const key = machine.getGameState().getObject(37);
if (box && key) {
  key.parent = box; // Put the key in the box
}
```

## Examples

Check the `examples` directory for complete working examples:

- `BasicInterpreter.ts` - A simple command-line interpreter
- `GameObjectExample.ts` - Exploring the game object tree
- `WebInterpreter.ts` - A web-based interpreter

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
