# rezrov-zmachine

A modular Z-machine interpreter written in TypeScript that executes interactive fiction games like Zork and Planetfall. This is a modern port/refactoring of the ebozz implementation, designed with strong typing, modularity, and extensibility for running classic Infocom games across different platforms (terminal, web, native).

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Runtime | Node.js | 20.x/22.x | Modern JavaScript runtime with ESM support |
| Language | TypeScript | 5.x | Strict type safety with comprehensive compiler checks |
| Build | tsc + tsc-esm-fix | - | Compiles to ESNext modules with proper .js extensions |
| Testing | Vitest | 4.x | Fast unit/integration testing with V8 coverage |
| Linting | ESLint + TypeScript ESLint | 9.x/8.x | Code quality with automatic import organization |
| Formatting | Prettier | 3.x | 120 char lines, single quotes, organized imports |
| CI/CD | GitHub Actions | - | Automated testing on Node 20.x and 22.x |

**Key TypeScript Configuration:**
- Strict mode enabled with `noImplicitReturns`, `noUnusedLocals`, `useUnknownInCatchVariables`
- ES2020 target with ESNext modules for maximum compatibility
- Declaration files with source maps for library consumers

## Quick Start

```bash
# Prerequisites
Node.js 20.x or 22.x

# Installation
git clone https://github.com/yourusername/rezrov-zmachine.git
cd rezrov-zmachine
npm install

# Build the library
npm run build

# Development
npm run test:watch         # Tests in watch mode
npm run format            # Auto-format all TypeScript files
npm run lint              # Check code quality

# Testing
npm test                  # Run all tests
npm run test:coverage     # Run with coverage report
npm run test:unit         # Run only unit tests
npm run test:integration  # Run integration tests
npm run test:compliance   # Run Z-machine spec compliance tests

# Tools (for debugging story files)
npm run tools:objects     # Analyze object hierarchy
npm run tools:strings     # Extract all text content
```

**Coverage Targets:**
- Global: 80% statements/functions/lines, 75% branches
- Critical modules (Executor: 90%, Memory: 83%)
- Implemented opcodes: 90% coverage required

## Project Structure

```
rezrov-zmachine/
├── src/
│   ├── core/                      # Core Z-machine implementation
│   │   ├── execution/             # Instruction execution engine
│   │   │   ├── Executor.ts        # Main execution loop (90% coverage required)
│   │   │   ├── StackFrame.ts      # Call stack management
│   │   │   ├── UserStack.ts       # V6 user stack support
│   │   │   └── SuspendState.ts    # Save/resume execution state
│   │   ├── memory/                # Memory management
│   │   │   ├── Memory.ts          # Main memory interface with validation (83%+ coverage)
│   │   │   └── cast16.ts          # 16-bit signed/unsigned conversions
│   │   ├── objects/               # Z-machine object system
│   │   │   ├── GameObject.ts      # Object properties, attributes, hierarchy
│   │   │   └── GameObjectFactory.ts  # Object creation and management
│   │   └── opcodes/               # Opcode implementations (grouped by category)
│   │       ├── base.ts            # Opcode decorator and utilities
│   │       ├── math.ts            # Arithmetic operations (add, sub, mul, div, mod, and, or, not)
│   │       ├── memory.ts          # Memory access (loadb, loadw, storeb, storew)
│   │       ├── control.ts         # Flow control (jump, je, jz, jl, jg, branch)
│   │       ├── stack.ts           # Stack manipulation (push, pull, pop)
│   │       ├── call.ts            # Function calls and returns (call, ret, rtrue, rfalse)
│   │       ├── string.ts          # String operations (print, print_ret, encode, decode)
│   │       ├── object.ts          # Object manipulation (get_parent, get_child, insert_obj, remove_obj)
│   │       ├── io.ts              # Input/output operations (sread, aread, print_char)
│   │       ├── game.ts            # Game control (save, restore, quit, restart, verify)
│   │       └── graphics.ts        # Graphics opcodes (V6)
│   ├── interpreter/               # High-level interpreter interface
│   │   ├── ZMachine.ts            # Main interpreter class (entry point)
│   │   ├── GameState.ts           # Game state management
│   │   └── Version.ts             # Version detection and capabilities
│   ├── parsers/                   # Text parsing and encoding
│   │   ├── TextParser.ts          # Input tokenization
│   │   ├── Dictionary.ts          # Word lookup and management
│   │   ├── ZString.ts             # Z-string encoding/decoding
│   │   └── AlphabetTable.ts       # Custom alphabet tables (V5+)
│   ├── storage/                   # Save/restore functionality
│   │   ├── Storage.ts             # Main storage interface
│   │   ├── interfaces.ts          # TypeScript interfaces
│   │   ├── factory.ts             # Storage provider factory functions
│   │   ├── formats/               # Save file formats
│   │   │   ├── FormatProvider.ts  # Format interface
│   │   │   ├── QuetzalFormat.ts   # Standard Quetzal format
│   │   │   └── EnhancedDatFormat.ts  # Enhanced .dat format with metadata
│   │   └── providers/             # Storage backends
│   │       ├── StorageProvider.ts # Provider interface
│   │       ├── FileSystemProvider.ts  # Node.js file system
│   │       ├── BrowserStorageProvider.ts  # Browser localStorage
│   │       └── MemoryStorageProvider.ts   # In-memory (testing)
│   ├── ui/                        # User interface abstractions
│   │   ├── screen/                # Display handling
│   │   │   ├── interfaces.ts      # Screen interface, Capabilities, ScreenSize
│   │   │   ├── BaseScreen.ts      # Base implementation with window management
│   │   │   └── WindowManager.ts   # Split-window support (status bar + main)
│   │   ├── input/                 # Input handling
│   │   │   └── InputInterface.ts  # InputProcessor, InputState, InputMode
│   │   ├── fonts/                 # Font system (V3 bitmaps, V6 custom fonts)
│   │   │   ├── FontManager.ts     # Font management
│   │   │   ├── Font3Bitmaps.ts    # Font 3 bitmap data
│   │   │   └── Font3System.ts     # Font 3 implementation
│   │   └── multimedia/            # Pictures and sound
│   │       └── MultimediaHandler.ts  # Resource loading (V6)
│   ├── utils/                     # Shared utilities
│   │   ├── constants.ts           # Header locations, flags, known globals
│   │   ├── log.ts                 # Configurable logger (LogLevel, Logger)
│   │   ├── debug.ts               # Debugging utilities (hex, dump functions)
│   │   └── random.ts              # Seeded random number generator
│   ├── types.ts                   # Core type definitions (Address, ZSCII, Color, TextStyle, etc.)
│   └── index.ts                   # Public API exports
├── tests/
│   ├── unit/                      # Unit tests (mirrors src/ structure)
│   ├── integration/               # Multi-component tests
│   ├── compliance/                # Z-machine spec conformance tests
│   ├── fixtures/                  # Test data and story files
│   ├── mocks/                     # Mock implementations for testing
│   └── utils/                     # Test utilities
├── examples/                      # Complete interpreter implementations
│   ├── console/                   # Basic CLI interpreter (readline-sync + chalk)
│   └── blessedConsole/            # Advanced terminal UI (blessed library, split windows)
├── tools/                         # Development/debugging tools
│   ├── GameObjectExample.ts       # Analyze object trees in story files
│   └── StringDumpExample.ts       # Extract all text content from story files
├── docs/                          # Documentation
│   └── ARCHITECTURE.md            # Detailed architecture documentation
└── dist/                          # Compiled JavaScript output (generated)
```

## Architecture Overview

Rezrov-ZMachine implements a layered architecture separating the Z-machine VM core from I/O and storage implementations, enabling the same interpreter to run in Node.js, browsers, or other JavaScript environments.

**Core Execution Flow:**
1. `Memory` loads and validates story file buffer
2. `GameState` reads header and initializes version-specific state
3. `Executor` runs the fetch-decode-execute loop on Z-machine bytecode
4. Opcodes interact with `Screen`, `InputProcessor`, and `Storage` through abstract interfaces
5. `ZMachine` orchestrates all components and provides the public API

**Core Layer**: The `core/` directory contains the Z-machine VM implementation—memory management, instruction execution engine, object system, and opcode handlers. This layer has no I/O dependencies and operates purely on the memory buffer and execution state.

**Abstraction Layer**: The `ui/` and `storage/` directories define interfaces (`Screen`, `InputProcessor`, `StorageProvider`) that isolate the core from platform-specific concerns. The core communicates through these interfaces without knowing whether output goes to a terminal, web page, or native UI.

**Implementation Layer**: Examples and provider implementations demonstrate how to bind the core to specific platforms. The `examples/console/` shows terminal integration, while storage providers handle Node.js files, browser localStorage, or in-memory buffers.

```
┌─────────────────────────────────────────────────┐
│          ZMachine (Central Controller)          │
│  • Orchestrates all components                  │
│  • Manages execution loop                       │
│  • Handles save/restore/undo                    │
└──────┬─────────┬─────────┬────────┬─────────────┘
       │         │         │        │
   ┌───▼──┐  ┌──▼───┐  ┌──▼───┐  ┌▼─────────┐
   │ Core │  │Parser│  │Storage│  │    UI    │
   └──┬───┘  └──┬───┘  └──┬───┘  └┬─────────┘
      │         │         │        │
   ┌──▼──────────▼─────────▼────────▼──────┐
   │         Utils (logging, debug)         │
   └────────────────────────────────────────┘
```

### Key Modules

| Module | Location | Purpose |
|--------|----------|---------|
| ZMachine | src/interpreter/ZMachine.ts:23 | Main interpreter class coordinating all components, managing execution loop and undo stack |
| Memory | src/core/memory/Memory.ts:30 | Memory validation, access, region management (dynamic/static/high memory) |
| Executor | src/core/execution/Executor.ts | Opcode dispatch, instruction decoding, PC management |
| GameObject | src/core/objects/GameObject.ts:11 | Object tree traversal, property/attribute manipulation |
| GameState | src/interpreter/GameState.ts | Stack, variables, program counter, object access |
| Opcodes | src/core/opcodes/*.ts | Opcode implementations organized by category (math, memory, control, I/O) |
| BaseScreen | src/ui/screen/BaseScreen.ts:16 | Base UI with window manager, style tracking |
| WindowManager | src/ui/screen/WindowManager.ts | Split windows (status bar + scrolling main text) |
| Storage | src/storage/Storage.ts | Save/restore orchestrator supporting Quetzal and Enhanced .dat formats |
| TextParser | src/parsers/TextParser.ts | Tokenize input against dictionary |
| Dictionary | src/parsers/Dictionary.ts:9 | Word lookup for player input parsing |
| ZString | src/parsers/ZString.ts | Z-string compression codec |

**Version Support:**
- **V1-V3:** Core support complete (execution, objects, text parsing)
- **V4-V5:** Extended opcodes, timed input (in progress)
- **V6:** Graphics support (pictures, fonts, windowing) in development
- **V7-V8:** Not yet implemented

## Development Guidelines

### File Naming Conventions

- **Source files**: PascalCase matching primary export (`Memory.ts`, `GameObject.ts`, `ZString.ts`, `ZMachine.ts`)
- **Interface files**: lowercase `interfaces.ts` for type-only exports
- **Utility files**: lowercase for utility modules (`constants.ts`, `log.ts`, `debug.ts`, `random.ts`)
- **Index files**: `index.ts` for barrel exports
- **Test files**: lowercase with `*.test.ts` suffix (`storage.test.ts`, `memory.test.ts`)
- **Directories**: lowercase (`core/`, `parsers/`, `storage/`), multi-word uses camelCase (`blessedConsole/`)

### Code Naming Conventions

- **Classes**: PascalCase (`ZMachine`, `Memory`, `GameObject`)
- **Functions**: camelCase (`readByte`, `storeVariable`, `decodeZString`)
- **Variables**: camelCase (`dynamicMemoryEnd`, `objectTable`, `callStack`)
- **Constants**: SCREAMING_SNAKE_CASE for true constants (`MAX_UNDO_LEVELS`, `MAX_ATTRIBUTES_V3`, `HeaderLocation.Version`)
- **Enums**: PascalCase enum name, PascalCase values (`Color.Black`, `TextStyle.Bold`, `WindowType.Lower`)
- **Type aliases**: PascalCase (`Address`, `ZSCII`, `StackFrame`)
- **Interfaces**: PascalCase (`Screen`, `StorageProvider`, `Capabilities`)
- **Private fields**: Underscore prefix (`_memory`, `_executor`, `_state`)
- **Unused parameters**: Underscore prefix (`_operandTypes`, `_options`)
- **Boolean variables**: Prefix with `is`/`has`/`should` (`hasColors`, `isLoading`, `shouldUpdate`)

### Import Organization

Prettier automatically organizes imports using `prettier-plugin-organize-imports`:

1. External packages (Node.js built-ins first, then npm packages)
2. Internal absolute imports (from `src/`)
3. Relative imports (`../../`, `../`, `./`)
4. Type imports (automatically separated with `type` keyword when possible)

**Example:**
```typescript
import { readFileSync } from 'fs';
import { Memory } from '../../core/memory/Memory';
import { Logger } from '../../utils/log';
import type { Address } from '../../types';
```

### Class Member Ordering

ESLint enforces class member ordering via `eslint-plugin-sort-class-members`:

1. Static properties
2. Static methods
3. Instance properties
4. Constructor
5. Instance methods

Accessors (getters/setters) are positioned with getter before setter.

### Code Style

- **Indentation:** 2 spaces (no tabs)
- **Line length:** 120 characters max
- **Quotes:** Single quotes for strings
- **Semicolons:** Required
- **Trailing commas:** ES5 style (objects/arrays, not function params)
- **Arrow function parens:** Always (`(x) => x + 1`)
- **End of line:** LF (`\n`)
- **Final newline:** Required in all files

### TypeScript Configuration

- **Strict mode enabled**: All strict checks are active (`strict: true`)
- **No implicit returns**: All code paths must explicitly return (`noImplicitReturns: true`)
- **No unused locals**: Unused variables trigger errors (with `_` prefix exception for intentionally unused)
- **Unknown in catch**: Catch variables are `unknown`, not `any` (`useUnknownInCatchVariables: true`)
- **Declaration files**: `.d.ts` files with sourcemaps generated for library consumers

### Testing Strategy

**Coverage Thresholds:**
- Global: 80% statements, 75% branches, 80% functions, 80% lines
- Core execution (`Executor.ts`): 90% all metrics—VM correctness is critical
- Memory management (`Memory.ts`): 83%+ statements/lines, 78%+ branches
- Implemented opcodes: 90%+ all metrics—these are production-ready

**Test Categories:**
- `tests/unit/`: Component isolation tests with mocks (mirrors src/ structure)
- `tests/integration/`: Multi-component interaction tests
- `tests/compliance/`: Z-machine specification conformance tests

**Test Naming Pattern:** `tests/[category]/[module-path]/[file].test.ts`

Example: `tests/unit/core/memory/Memory.test.ts`

**Testing Practices:**
- **Arrange-Act-Assert:** Follow AAA pattern in tests
- **Mocking:** Use Vitest `vi.fn()` for mocks
- **Silent logging:** Disable with `Logger.setLogToConsole(false)` in tests
- **Test structure:** Use `describe` for components, nested for methods
- **Test naming:** Use `it('should...')` format for behavior

### Error Handling

- Use standard `Error` objects with descriptive messages
- Include context in error messages (e.g., object numbers, addresses)
- Let errors propagate unless recovery is possible
- Use `try-catch` for validation in constructors
- Never swallow errors silently

### Logging

- Use the `Logger` class with appropriate log levels
- **Debug:** Opcode execution details, internal state changes
- **Info:** Initialization, major state transitions
- **Warn:** Deprecated features, unusual but valid behavior
- **Error:** Invalid operations, failed validations
- Each component gets its own logger instance with descriptive name

### Linting and Formatting

- **Prettier**: 120 char line width, single quotes, trailing commas (ES5), LF line endings
- **ESLint**: `no-console` and `no-debugger` are warnings (not errors) for debugging
- **End of file**: All files must end with exactly one newline (enforced by `.editorconfig` and ESLint)

### Git Workflow

- **Main branch**: `main`
- **CI/CD**: GitHub Actions run on push/PR to main
  - Tested on Node.js 20.x and 22.x
  - Build, then run full test suite with coverage
  - CodeQL security analysis
- **Commit messages:** Clear, descriptive (no enforced format)

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to dist/ with ESM fixes |
| `npm run format` | Auto-format all TypeScript source and config files |
| `npm run lint` | Check code quality with ESLint |
| `npm test` | Run all tests (unit + integration + compliance) |
| `npm run test:watch` | Run tests in watch mode for development |
| `npm run test:coverage` | Run all tests with V8 coverage report |
| `npm run test:unit` | Run only unit tests |
| `npm run test:unit-coverage` | Run unit tests with coverage |
| `npm run test:integration` | Run only integration tests |
| `npm run test:compliance` | Run Z-machine spec compliance tests |
| `npm run tools:objects` | Run object tree analysis tool |
| `npm run tools:strings` | Run string extraction tool |

## Testing

- **Unit tests**: `tests/unit/` - Isolated component testing with mocks
- **Integration tests**: `tests/integration/` - Multi-component interaction testing
- **Compliance tests**: `tests/compliance/` - Z-machine specification conformance
- **Coverage target**: 80% global, 90% for core execution engine and implemented opcodes
- **Test framework**: Vitest with globals enabled, Node.js environment
- **Coverage reports**: Text (console), JSON, and HTML (`coverage/index.html`)
- **Test timeout**: 10 seconds per test

**Running Specific Tests:**
```bash
# Run tests for a specific file
npx vitest run tests/unit/storage/storage.test.ts

# Run tests matching a pattern
npx vitest run -t "Dictionary"

# Watch specific directory
npx vitest watch tests/unit/parsers/
```

## Environment Variables

This library does not require environment variables. Examples may accept command-line flags:

| Flag | Description |
|------|-------------|
| `--debug` or `-d` | Enable debug logging |
| `--header` or `-h` | Dump Z-machine header information |
| `--objectTree` or `-o` | Dump object table structure |
| `--dict` or `-t` | Dump dictionary contents |
| `--dump` | Enable all debugging features |
| `--noExec` or `-n` | Show debugging info without execution |

## Creating Custom Implementations

### Custom Screen Implementation

Extend `BaseScreen` and implement required methods:

```typescript
import { BaseScreen, Capabilities, ScreenSize, ZMachine } from 'rezrov-zmachine';

export class MyScreen extends BaseScreen {
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
    // Your platform-specific output implementation
  }

  // Implement other Screen interface methods as needed...
}
```

See `examples/console/` and `examples/blessedConsole/` for complete implementations.

### Custom Storage Provider

Implement the `StorageProvider` interface for your platform:

```typescript
import { StorageProvider } from 'rezrov-zmachine';

export class MyStorageProvider implements StorageProvider {
  async read(filename: string): Promise<Buffer> {
    // Read from your storage backend
  }

  async write(filename: string, data: Buffer): Promise<void> {
    // Write to your storage backend
  }

  async list(pattern?: string): Promise<string[]> {
    // List available save files
  }

  async exists(filename: string): Promise<boolean> {
    // Check if file exists
  }

  async ensureDirectory(path: string): Promise<void> {
    // Ensure storage location exists
  }
}
```

Then use with factory functions or instantiate directly:

```typescript
import { ZMachine, Storage, QuetzalFormat } from 'rezrov-zmachine';

const storage = new Storage(
  new QuetzalFormat(),
  new MyStorageProvider(),
  storyBuffer
);
const machine = new ZMachine(storyBuffer, screen, inputProcessor, undefined, storage);
```

## Z-machine Object System

The Z-machine has a hierarchical object system. Access and manipulate objects:

```typescript
// Get object by number
const obj = machine.state.getObject(42);

// Check attributes
if (obj && obj.hasAttribute(21)) {
  console.log(`Object ${obj.name} is a container`);
}

// Read properties
const capacity = obj.getProperty(18);

// Modify attributes
obj.setAttribute(10);  // Make openable
obj.clearAttribute(2); // Remove locked

// Move objects in hierarchy
const box = machine.state.getObject(23);
const key = machine.state.getObject(37);
if (box && key) {
  key.parent = box; // Put key in box
}
```

## Deployment

This is a library, not a deployable application. For publishing:

```bash
# Prepare for publishing
npm run build
npm run test:coverage  # Verify all tests pass
npm run lint           # Ensure code quality

# Publish to npm (when ready)
npm publish
```

For examples of deployed interpreters using this library, see `examples/` directory.

## Additional Resources

- **Z-machine Spec**: [Inform Fiction Standards](https://inform-fiction.org/zmachine/standards/z1point1/index.html)
- **Quetzal Format**: [Save file format spec](https://inform-fiction.org/zmachine/standards/quetzal/index.html)
- **IF Archive**: [Z-machine resources](https://ifarchive.org/indexes/if-archiveXinfocomXinterpretersXzcode.html)
- **Original ebozz**: [Chris Toshok's implementation](https://github.com/toshok/ebozz) (inspiration for this project)
- **Architecture Details**: See `docs/ARCHITECTURE.md`
- **Examples**: See `examples/` directory for complete implementations
- **Tools**: See `tools/` directory for debugging utilities

## Implementation Notes

**Current Focus:** V3 and V5 story files (most classic Infocom games like Zork, Planetfall)

**Design Decisions:**
- **Strict TypeScript:** Prevents runtime type errors in complex opcode implementations
- **Dependency injection:** Screen, Storage, and Input are injected for maximum flexibility
- **No global state:** All state contained in ZMachine instance for multiple concurrent games
- **ESM modules:** Modern import/export for future-proof library design
- **Comprehensive validation:** Memory validates story file header on construction
- **Organized opcodes:** Grouped by category (math, memory, control) not numeric value for maintainability
- **Extensible storage:** Support multiple formats (Quetzal, Enhanced .dat) and backends (filesystem, browser, memory)
- **Version-aware execution:** Version capabilities determine available features and memory layouts


## Skill Usage Guide

When working on tasks involving these technologies, invoke the corresponding skill:

| Skill | Invoke When |
|-------|-------------|
| npm | Manages dependencies, scripts, and package distribution |
| eslint | Enforces code quality, import organization, and class member ordering |
| prettier | Formats TypeScript code with 120-char lines and single quotes |
| node | Manages Node.js runtime, file system APIs, and module execution |
| typescript | Enforces strict TypeScript patterns, VM correctness, and type safety |
| vitest | Configures unit, integration, and compliance tests with V8 coverage |
