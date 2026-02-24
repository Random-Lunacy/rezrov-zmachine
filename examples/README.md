# Examples

This directory contains example implementations showing how to use the rezrov-zmachine library to create Z-Machine interpreters with different user interfaces.

## Prerequisites

Ensure the main rezrov-zmachine package is built:

```bash
# From the project root
npm run build
```

## Available Examples

### Console ([`console/`](console/))

A basic command-line Z-Machine interpreter using standard input/output. This example demonstrates:

- Simple text-based interface
- Color support using chalk
- Command-line argument parsing
- Basic Z-Machine debugging features

**Features:**

- Runs Z-Machine story files in your terminal
- Supports text styling (bold, italic, colors)
- Command-line flags for debugging
- Uses readline-sync for user input

### Web ([`web/`](web/))

A browser-based Z-Machine interpreter with full V6 multimedia support (pictures and sound). This example demonstrates:

- Canvas-based picture rendering from Blorb resources
- Web Audio API for sound playback (OGG Vorbis)
- Support for text-mode stories (V3–V5) and V6 games with graphics/sound
- Self-contained Blorb files and companion Blorb (story + .blb in same folder)
- Directory picker or multi-file picker for loading story + companion Blorb

**Features:**

- Load story via file picker (single file or folder)
- Full text output with colors and styles
- Picture display for V6 Blorb games
- Sound effects via Web Audio API
- Save/restore to browser localStorage

**Usage:** Build the main library, then run `npm run dev` or `npm run build && npm run preview` from `examples/web/`.

### Blessed Console ([`blessedConsole/`](blessedConsole/))

An enhanced terminal-based Z-Machine interpreter using the [blessed](https://www.npmjs.com/package/blessed) library for better terminal UI. This example demonstrates:

- Split-window support (status bar + main text)
- Better cursor and display management
- More sophisticated input handling
- Enhanced terminal UI capabilities

**Features:**

- Proper split-window display
- Status bar support
- Better keyboard input handling
- Scrollable main text area
- Enhanced visual presentation

## Getting Started

Each example is a self-contained project with its own dependencies. Navigate to the specific example directory and follow its README for installation and usage instructions.

## Usage Pattern

**Node.js examples** (console, blessedConsole):

```bash
cd examples/[example-name]
npm install
npm start path/to/story.z3
```

**Web example:**

```bash
cd examples/web
npm install
npm run dev   # Development server
# or
npm run build && npm run preview  # Production build
```

Then open the URL in a browser and load a story file via the file picker.

## Command-Line Options

Both examples support the following flags:

| Flag | Short | Description |
| ---- | ----- | ----------- |
| `--debug` | `-d` | Enable debug logging |
| `--interpreter <name>` | `-i` | Set interpreter type (default: `amiga`) |
| `--header` | `-h` | Dump Z-Machine header information |
| `--objectTree` | `-o` | Dump object table structure |
| `--dict` | `-t` | Dump dictionary contents |
| `--dump` | | Enable all debugging features without execution |
| `--noExec` | `-n` | Show debugging info without running the story |

### Interpreter Types

The `--interpreter` flag controls which platform the Z-Machine reports to the game. Some games (notably Beyond Zork) use this to select color palettes and platform-specific behavior.

Valid interpreter names: `dec20`, `apple-iie`, `mac`, `amiga`, `atari`, `ibm`, `c128`, `c64`, `apple-iic`, `apple-iigs`, `tandy`

The default is `amiga`, which provides good color palette support out of the box. Use `--interpreter ibm` to emulate an IBM PC, though note that some games (like Beyond Zork) start with a colorless default palette on IBM.

### Usage Examples

```bash
# Basic usage
npm start -- path/to/story.z3

# With debug output
npm start -- -d -h path/to/story.z3

# Set interpreter to IBM PC
npm start -- -i ibm ~/infocom/Beyond\ Zork.z5
```

## Creating Your Own Implementation

These examples serve as templates for building your own Z-Machine interpreters. Key components you'll need to implement:

1. **Screen Interface**: Extend `BaseScreen` to handle display output
2. **Input Processor**: Extend `BaseInputProcessor` to handle user input
3. **Z-Machine Instance**: Create and configure the ZMachine with your screen and input implementations

See the individual example READMEs for more detailed implementation guidance.
