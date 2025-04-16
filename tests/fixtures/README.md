# Test Fixtures

This directory contains various test fixtures used by rezrov-zmachine's test suite, primarily:

1. Small Inform source files (`.inf`) that compile to Z-code story files
2. Pre-compiled Z-code story files (`.z3`, `.z5`, etc.) for use in tests

## Compiling Inform Source Files

The `.inf` files in this directory are written in Inform 6, the standard language for creating Z-machine story files. To compile these files into Z-code, you'll need the Inform 6 compiler.

### Installing Inform 6

#### Using a package manager

- **Linux (Debian/Ubuntu)**: `sudo apt-get install inform`
- **macOS (Homebrew)**: `brew install inform6`
- **Windows**: Download from [IF Archive](https://www.ifarchive.org/indexes/if-archiveXinfocomXcompilersXinform6.html)

#### Manual installation

You can download Inform 6 compiler directly from the [IF Archive](https://www.ifarchive.org/indexes/if-archiveXinfocomXcompilersXinform6.html) or [David Kinder's GitHub repository](https://github.com/DavidKinder/Inform6).

### Compiling a Test File

To compile an `.inf` file into a Z-code story file, use:

```bash
inform -v3 -z je_test.inf
```

This will produce `je_test.z3`, a Z-code story file using Z-machine version 3.

#### Compilation Options

- `-v3`: Specifies Z-machine version 3 (versions 3-8 are supported)
- `-z`: Generates a Z-code file (default output is a game file)
- `-s`: Outputs assembly code for inspection

### Example Files

- **je_test.inf**: Tests the 'je' opcode functionality
- **minimal.inf**: A minimal Z-machine story with a few objects

### Adding New Test Files

When creating new test files:

1. Keep them minimal and focused on testing specific functionality
2. Add meaningful comments explaining the purpose of the test
3. After compilation, add both the `.inf` source and the compiled story file to version control
4. Update this README if your test file requires special compilation options

## Using the Test Files

In your tests, you can use these files by loading them with the Memory class:

```typescript
import { Memory } from '../../src/core/memory/Memory';
import { join } from 'path';

memory = Memory.fromFile(join(__dirname, '../fixtures/je_test.z3'));
```

## Learning Inform 6

If you're new to Inform 6 and want to create your own test files, these resources may be helpful:

- [Inform 6 Documentation](https://www.inform-fiction.org/manual/html/)
- [The Inform Beginner's Guide](https://www.ifarchive.org/if-archive/infocom/compilers/inform6/manuals/IBG.pdf)
- [DM4: The Inform Designer's Manual](https://www.inform-fiction.org/manual/download_dm4.html)
