# rezrov-zmachine

A modular **Z-machine** interpreter written in TypeScript.

## About the Z-Machine

The **Z-Machine** is a virtual machine developed by _Infocom_ in 1979 to run interactive fiction games, most famously titles like _Zork_ and _Planetfall_. It was designed to be platform-independent, allowing Infocom to write a game once and run it on a wide variety of computer systems by porting just the interpreter.

Z-Machine story files (typically with `.z1` to `.z8` extensions) contain a compiled game program in a custom bytecode format. The interpreter is responsible for executing this bytecode, managing game state, handling input/output, and presenting the text-based adventure.

Over the years, the format has evolved through several versions, from v1 (used for early games) up to v8, with each version introducing new features and capabilities. Today, the Z-Machine is still supported by hobbyist interpreters and authoring tools, and remains a cornerstone of the interactive fiction community.

### Key Resources

- [**The Z-Machine Standards Document (Inform Fiction)**](https://inform-fiction.org/zmachine/standards/z1point1/index.html)
  The official and most detailed technical specification for all versions of the Z-Machine.

- [**The Inform 6 Compiler**](https://github.com/DavidKinder/Inform6)
  A popular compiler that produces Z-Machine story files from source code written in the Inform language.

- [**IF Archive: Z-Machine**](https://ifarchive.org/indexes/if-archiveXinfocomXinterpretersXzcode.html)
  A repository of Z-Machine interpreters and tools.

- [**The Digital Antiquarian: Infocom History**](https://www.filfre.net/tag/infocom/)
  A great historical deep-dive into Infocom and the evolution of its technology.

## Acknowledgments

This project is a port/refactoring of the [ebozz](https://github.com/toshok/ebozz) Z-machine implementation by Chris Toshok. While maintaining the same general architecture, rezrov-zmachine aims to modernize the codebase and improve modularity.

## Project Features

- **Fully modular design**: Clear separation between core interpreter, UI, storage, and parsing components
- **TypeScript implementation**: Strong typing for better development experience
- **High compatibility**: Support for Z-machine versions 1 through 8
- **Extensible interfaces**: Easily create custom UI and storage implementations
- **Modern architecture**: Promise-based APIs for asynchronous operations
- **Comprehensive object model**: Full support for the Z-machine object system

## Implementation Status

Currently implemented:

- Basic object system
- Text parsing and dictionary handling
- Memory management

In progress:

- Execution loop
- Basic support for Z-machine versions 1-3
- Extended opcodes for versions 5+

## Roadmap

- [ ] Full support for Z-machine versions 3-5
- [ ] Add example UI implementations (terminal, web, etc.)
- [ ] Implement graphics support for V6 games
- [ ] Complete implementation of all Z-machine versions

## Installation

### From npm (not yet published)

```bash
npm install rezrov-zmachine
```

### From source

```bash
git clone https://github.com/yourusername/rezrov-zmachine.git
cd rezrov-zmachine
npm install
npm run build
```

## Development

This project uses TypeScript and follows modern ES module patterns.

### Setting up the development environment

```bash
npm install
```

### Running Tests

The project includes a comprehensive test suite:

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run Z-machine compliance tests
npm run test:compliance
```

## Architecture

Rezrov-ZMachine uses a layered architecture that separates the Z-Machine's core functions from interface implementations, making it adaptable to various environments. The diagram below illustrates the key components and their relationships:

### Architecture Overview

The high-level diagram shows the main architectural components and their relationships:

```mermaid
graph TD
  ZMachine["Z-Machine<br>(Central Controller)"]

  Core["Core Components<br>(Memory, Execution, Objects)"]
  Parser["Parsers<br>(Text, Dictionary, Z-String)"]
  Storage["Storage System<br>(Save/Restore Game)"]
  UI["UI Components<br>(Screen, Input)"]
  Utilities["Utilities<br>(Logging, Constants, Debug)"]

  ZMachine --- Core
  ZMachine --- Parser
  ZMachine --- Storage
  ZMachine --- UI

  Core --- Parser
  Core --- Utilities

  Parser -.- Utilities
  Storage -.- Utilities
  UI -.- Utilities

style ZMachine fill:#063970,stroke:#21130d,stroke-width:2px
```

- **Z-Machine**: The central controller that orchestrates all other components
- **Core Components**: The essential parts of the Z-machine implementation (memory, execution, objects)
- **Parser System**: Handles text parsing, dictionaries, and Z-string encoding/decoding
- **Storage System**: Manages save/restore functionality using the Quetzal format
- **UI Components**: Defines interfaces and implementations for user interaction
- **Utilities**: Cross-cutting concerns like logging and constants

### Extensibility

The architecture is designed to be extensible. You can create custom implementations of:

- Screen interfaces for different platforms (web, terminal, native UI)
- Storage systems for different environments (file system, browser storage, cloud)
- Input handlers for different interaction methods

This modular design allows the interpreter to run in various environments while maintaining the same core Z-Machine functionality.

## Creating a Custom Screen Implementation

The interpreter is designed to work with any UI system. You can create your own screen implementation by implementing the `Screen` interface:

```typescript
import { BaseScreen, Capabilities, ScreenSize, ZMachine, InputState } from 'rezrov-zmachine';

export class MyCustomScreen extends BaseScreen {
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
const obj = machine.state.getObject(42);

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
const box = machine.state.getObject(23);
const key = machine.state.getObject(37);
if (box && key) {
  key.parent = box; // Put the key in the box
}
```

## Examples

Check the `examples` directory for complete working examples:

- `GameObjectExample.ts` - Exploring the game object tree
- `console/index.ts` - A simple console-based implementation

### Running the `console` example

#### Install ts-node if you haven't already

```bash
npm install -g ts-node
```

#### Run the example

```bash
npx tsx examples/console/index.ts path/to/story.z3
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
