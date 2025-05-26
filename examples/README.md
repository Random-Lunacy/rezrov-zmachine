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

All examples follow this general pattern:

```bash
cd examples/[example-name]
npm install
npm start path/to/story.z3
```

## Debugging Features

Both examples support debugging flags:

- `--debug` or `-d`: Enable debug logging
- `--header` or `-h`: Dump Z-Machine header information
- `--objectTree` or `-o`: Dump object table structure
- `--dict` or `-t`: Dump dictionary contents
- `--dump`: Enable all debugging features without execution
- `--noExec` or `-n`: Show debugging info without running the story

Example:

```bash
npm start story.z3 --debug --header
```

## Creating Your Own Implementation

These examples serve as templates for building your own Z-Machine interpreters. Key components you'll need to implement:

1. **Screen Interface**: Extend `BaseScreen` to handle display output
2. **Input Processor**: Extend `BaseInputProcessor` to handle user input
3. **Z-Machine Instance**: Create and configure the ZMachine with your screen and input implementations

See the individual example READMEs for more detailed implementation guidance.
