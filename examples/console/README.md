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

## Supported Z-Machine Features

- **Text Display**: Standard text formatting and colors
- **Input Handling**: Line input and single character input
- **Z-Machine Versions**: Supports Z-Machine versions 3-5

## Controls

- **Text Input**: Type commands and press Enter
- **Character Input**: Press any key when prompted
- **Exit**: Use Ctrl+C to quit at any time

## Implementation Details

This example demonstrates:

### Screen Implementation (`StdioScreen`)

- Extends `BaseScreen` from rezrov-zmachine
- Uses chalk for color and styling
- Implements basic status bar display
- Handles window switching (limited split-window support)

### Input Implementation (`StdioInputProcessor`)

- Extends `BaseInputProcessor` from rezrov-zmachine
- Uses readline-sync for synchronous input
- Handles both text and character input modes
- Supports filename prompting for save/load operations

### Key Files

- `index.ts`: Main application and command-line parsing
- Uses nopt for argument parsing
- Integrates screen and input with ZMachine class

## Limitations

- **No Split Windows**: Limited split-window support compared to blessed version
- **Basic UI**: Minimal visual enhancements

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

## Next Steps

For a more advanced terminal UI, see the `blessedConsole` example which provides:

- Better split-window support
- Enhanced input handling
- Improved visual presentation
- Scrollable text areas
