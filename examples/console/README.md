# Console Z-Machine Interpreter

A basic command-line Z-Machine interpreter that runs interactive fiction games in your terminal using standard input/output.

## Features

- **Simple Interface**: Text-based interaction using your terminal
- **Color Support**: Text colors and styling using chalk
- **Debugging Tools**: Built-in commands to inspect Z-Machine internals
- **Cross-Platform**: Works on Windows, macOS, and Linux terminals

## Prerequisites

Ensure the main rezrov-zmachine package is built:

```bash
# From the project root
npm run build
```

## Installation

```bash
cd examples/console
npm install
```

## Usage

### Basic Usage

```bash
npm start path/to/story.z3
```

### With Debugging

```bash
npm start story.z3 --debug
```

### Debugging Options

- `--debug` or `-d`: Enable debug logging
- `--header` or `-h`: Dump Z-Machine header information
- `--objectTree` or `-o`: Dump object table structure
- `--dict` or `-t`: Dump dictionary contents
- `--dump`: Enable all debugging features without execution
- `--noExec` or `-n`: Show debugging info without running the story

### Examples

```bash
# Run a story with debug output
npm start zork1.z3 --debug

# Show header info only
npm start zork1.z3 --header --noExec

# Show all debugging info without running
npm start zork1.z3 --dump
```

## Project Structure

```text
examples/console/
├── index.ts                # Main application and Z-Machine integration
├── StdioScreen.ts          # Screen implementation for terminal output
├── StdioInputProcessor.ts  # Input processor for terminal input
├── utils.ts                # Utilities (argument parsing, helpers)
├── package.json
└── README.md
```

## Implementation Guide

This example demonstrates the key components you need to implement when using the rezrov-zmachine library:

### 1. Screen Implementation (`StdioScreen.ts`)

The `StdioScreen` class extends `BaseScreen` and handles all display output:

- **Text rendering**: Converts Z-Machine output to terminal text
- **Styling**: Applies colors, bold, italic, and reverse video using chalk
- **Window management**: Basic support for output windows and status bar
- **Terminal control**: Cursor positioning, clearing, and display updates

**Key methods to implement:**

- `print()`: Output text to the terminal
- `getCapabilities()`: Declare what features your screen supports
- `setTextStyle()` / `setTextColors()`: Handle text formatting
- `updateStatusBar()`: Display status information

### 2. Input Processor (`StdioInputProcessor.ts`)

The `StdioInputProcessor` class extends `BaseInputProcessor` and handles user input:

- **Text input**: Line-based input using readline-sync
- **Character input**: Single keypress detection
- **File operations**: Prompting for save/restore filenames
- **Error handling**: Graceful handling of input errors

**Key methods to implement:**

- `doStartTextInput()`: Handle line input from user
- `doStartCharInput()`: Handle single character input
- `promptForFilename()`: Get filenames for save/restore operations

### 3. Integration (`index.ts`)

The main file shows how to wire everything together:

```typescript
// Create implementations
const screen = new StdioScreen();
const inputProcessor = new StdioInputProcessor();

// Create Z-Machine with your implementations
const machine = new ZMachine(storyData, screen, inputProcessor);

// Start the interpreter
machine.execute();
```

## Supported Z-Machine Features

- **Text Display**: Standard text formatting and colors
- **Input Handling**: Line input and single character input
- **Z-Machine Versions**: Supports Z-Machine versions 3-5

## Controls

- **Text Input**: Type commands and press Enter
- **Character Input**: Press any key when prompted
- **Exit**: Use Ctrl+C to quit at any time

## Limitations

- **No Split Windows**: Limited split-window support compared to blessed version
- **Basic UI**: Minimal visual enhancements
- **Status Bar**: Simple status bar implementation

## Troubleshooting

### "Module not found" errors

Ensure you've run `npm install` in this directory and that the parent rezrov-zmachine package is built (`npm run build` in the root directory).

### Input not working

Some terminal configurations may have issues with readline-sync. Try running in a different terminal or check your terminal's input settings.

### Colors not displaying

If colors aren't showing, your terminal may not support them. Try setting the `FORCE_COLOR` environment variable:

```bash
FORCE_COLOR=1 npm start story.z3
```

## Extending This Example

This console example provides a solid foundation for building your own Z-Machine interpreter:

### Using as a Template

1. **Copy the files**: Use `StdioScreen.ts` and `StdioInputProcessor.ts` as starting points
2. **Modify the implementations**: Adapt the screen and input handling for your platform
3. **Update capabilities**: Modify `getCapabilities()` to match your platform's features
4. **Test with stories**: Run various Z-Machine games to ensure compatibility

### Possible Enhancements

- **Better split-window support**: Implement proper window management
- **Enhanced input**: Add command history, tab completion
- **Configuration**: Support for user preferences and settings
- **Graphics**: Add basic image display capabilities (for newer Z-Machine versions)

## Next Steps

For a more advanced terminal UI, see the `blessedConsole` example which provides:

- Better split-window support
- Enhanced input handling
- Improved visual presentation
- Scrollable text areas

The blessed example demonstrates how to extend these same base classes for more sophisticated terminal applications.
