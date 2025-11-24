# Blessed Console Z-Machine Interpreter

An enhanced terminal-based Z-Machine interpreter using the blessed library for sophisticated terminal UI features, including proper split-window support and advanced input handling.

## Features

- **Split Windows**: Proper status bar and main text area separation
- **Enhanced UI**: Scrollable text and visual borders
- **Inline Input**: Authentic Infocom-style input that appears inline with story text
- **Blinking Cursor**: Visual feedback showing current input position
- **Terminal Optimization**: Efficient screen updates and cursor management
- **Full Z-Machine Support**: Complete implementation of Z-Machine display features

## Prerequisites

Ensure the main rezrov-zmachine package is built:

```bash
# From the project root
npm run build
```

## Installation

```bash
cd examples/blessedConsole
npm install
```

## Build

The example can be built independently using TypeScript:

```bash
# Build the project
npm run build

# Build with watch mode (auto-rebuild on changes)
npm run build:watch

# Clean build artifacts
npm run clean
```

The built files will be placed in the `dist/` directory.

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
# Run Zork with enhanced UI
npm start zork1.z3

# Debug mode with full logging
npm start adventure.z5 --debug

# Examine story structure without running
npm start mystery.z8 --dump
```

## Project Structure

```
examples/blessedConsole/
├── index.ts                    # Main application and Z-Machine integration
├── BlessedScreen.ts           # Screen implementation using blessed
├── BlessedInputProcessor.ts   # Input processor using blessed
├── utils.ts                   # Utilities (argument parsing, helpers)
├── package.json
└── README.md
```

## Implementation Guide

This example demonstrates advanced terminal UI implementation using the blessed library:

### 1. Screen Implementation (`BlessedScreen.ts`)

The `BlessedScreen` class extends `BaseScreen` and provides sophisticated terminal UI:

- **Split Window Support**: True split-window implementation with separate blessed boxes
- **Advanced Styling**: Rich text formatting using blessed tags
- **Color Management**: Complete Z-Machine color palette support
- **Dynamic Layout**: Responsive window sizing and management
- **Cursor Control**: Precise cursor positioning and visibility control

**Key features:**

- **Status Window**: Fixed-height status bar at the top
- **Main Window**: Scrollable main text area with automatic scrolling
- **Style Application**: Real-time text styling with bold, italic, reverse video
- **Color Mapping**: Z-Machine colors to blessed color names
- **Window Management**: Split/unsplit operations and window clearing

### 2. Input Processor (`BlessedInputProcessor.ts`)

The `BlessedInputProcessor` class extends `BaseInputProcessor` with blessed-specific input handling:

- **Inline Input**: Infocom-style input that appears directly in the story text
- **Blinking Cursor**: Visual feedback with a blinking block cursor (█) showing input position
- **Advanced Key Handling**: Intelligent filtering of special keys and navigation
- **Event Management**: Proper cleanup of input handlers and cursor timers
- **Enhanced Prompting**: Custom input boxes for file operations

**Key features:**

- **Text Input**: Full inline text input with real-time display updates
- **Character Input**: Single keypress detection with special key filtering
- **Visual Feedback**: Blinking cursor and immediate character echo
- **Error Handling**: Graceful handling of input errors and cleanup

### 3. Integration (`index.ts`)

The main file demonstrates the integration pattern:

```typescript
// Create the screen implementation
const screen = new BlessedScreen();

// Create input processor with access to blessed screen
const inputProcessor = new BlessedInputProcessor(screen.getBlessedScreen());

// Create Z-Machine with implementations
const machine = new ZMachine(storyData, screen, inputProcessor);

// Start the interpreter
machine.execute();
```

## Controls

- **Text Input**: Type directly inline with the story text (no separate input box)
- **Character Input**: Press any key when prompted
- **Exit**: Press Escape or Ctrl+C to quit
- **Backspace**: Use backspace to edit your input
- **Enter**: Submit your input
- **Escape**: Clear input and restart

## Supported Z-Machine Features

### Display Features

- **Split Windows**: Proper status window (top) and main text (bottom)
- **Text Styling**: Bold, italic, reverse video using blessed tags
- **Colors**: Full color palette support with background/foreground
- **Cursor Control**: Precise cursor positioning
- **Window Management**: Clear windows, cursor visibility control
- **Dynamic Sizing**: Responsive to terminal resize

### Input Features

- **Line Input**: Full inline text input with real-time editing capabilities
- **Character Input**: Single keypress detection
- **Terminating Characters**: Function keys and special character support
- **Timed Input**: Support for timed input operations
- **Visual Feedback**: Blinking cursor and immediate character echo
- **Authentic Prompts**: ">" prompts appear naturally inline with story text

### File Operations

- **Save/Restore**: Interactive filename prompting with labeled input boxes
- **Multiple Streams**: Output stream management

## UI Layout

```
┌─────────────────────────────────────────┐
│ Status Bar (Window 1)                   │
├─────────────────────────────────────────┤
│                                         │
│ Main Text Area (Window 0)               │
│ - Scrollable                            │
│ - Supports all text styles              │
│ - Full color support                    │
│ - Inline input with blinking cursor    │
│                                         │
│ You are standing in an open field west │
│ of a white house, with a boarded front │
│ door. There is a small mailbox here.   │
│                                         │
│ > look mailbox█                         │
│                                         │
└─────────────────────────────────────────┘
```

**Note**: Input appears inline with the story text, just like the original Infocom interpreters. The blinking cursor (█) shows where you're typing.

## Advanced Features

### Window Management

- **Automatic Split**: Dynamic window splitting based on Z-Machine requests
- **Proper Clearing**: Individual window clearing and management
- **Cursor Positioning**: Accurate cursor positioning within windows
- **Window Properties**: Complete window property queries

### Text Rendering

- **Real-time Styling**: Immediate style application using blessed tags
- **Color Inheritance**: Proper color handling with inheritance and overrides
- **Efficient Updates**: Optimized screen rendering
- **Proper Wrapping**: Automatic text wrapping and scrolling

### Input Handling

- **Context-sensitive**: Different input modes for text vs character input
- **Key Filtering**: Intelligent handling of special keys and navigation
- **Terminating Characters**: Complete terminating character processing
- **Resource Cleanup**: Proper cleanup of input handlers and cursor timers
- **Inline Experience**: Authentic Infocom-style input that flows with story text
- **Visual Feedback**: Blinking cursor provides clear input position indication

## Troubleshooting

### Terminal Compatibility

This example requires a terminal that supports:

- ANSI escape sequences
- Color display
- Cursor positioning
- Keyboard input detection

### Common Issues

**Blank Screen**: Some terminals may not display blessed UI properly. Try:

```bash
TERM=xterm-256color npm start story.z3
```

**Input Not Working**: If input doesn't respond:

- Ensure your terminal supports interactive input
- Try typing directly in the terminal (no need to click)
- Check that no other processes are using stdin
- The blinking cursor should appear when the game is waiting for input

**Colors Not Displaying**: For terminals with limited color support:

- Use a modern terminal emulator
- Check terminal color settings
- Some features may gracefully degrade

**Layout Issues**: If windows don't display correctly:

- Resize your terminal window
- Ensure minimum terminal size (80x25 recommended)
- Some very small terminals may not display properly

## Performance Notes

- Blessed optimizes screen updates automatically
- Large amounts of text are handled efficiently
- Scrolling performance is optimized for readability
- Memory usage scales with story file size

## Extending This Example

This blessed console example provides an excellent foundation for advanced Z-Machine interpreters:

### Using as a Template

1. **Copy the components**: Use `BlessedScreen.ts` and `BlessedInputProcessor.ts` as starting points
2. **Customize the UI**: Modify blessed widget properties for different visual styles
3. **Add features**: Extend with additional UI elements (menus, dialogs, etc.)
4. **Enhance capabilities**: Add graphics support, sound, or other advanced features

### Possible Enhancements

- **Graphics Support**: Add picture display capabilities using blessed-image
- **Sound Integration**: Implement sound effect support
- **Enhanced Save Management**: Rich save/load UI with file browsers
- **Configuration UI**: Settings dialogs and preference management
- **Themes**: Customizable color schemes and visual styles
- **Multiple Panes**: Additional UI panes for maps, inventory, etc.

## Comparison with Basic Console

| Feature         | Basic Console   | Blessed Console   |
| --------------- | --------------- | ----------------- |
| Split Windows   | Limited         | Full Support      |
| Input Method    | readline-sync   | Inline input      |
| Scrolling       | Terminal native | Controlled        |
| Styling         | chalk only      | Full blessed tags |
| UI Polish       | Basic           | Enhanced          |
| Performance     | Good            | Optimized         |
| Layout Control  | None            | Complete          |
| Visual Feedback | Minimal         | Blinking cursor   |
| Authentic UX    | No              | Infocom-style     |

## Next Steps

This example demonstrates how to create sophisticated terminal-based Z-Machine interpreters. The modular structure makes it easy to:

- **Understand each component**: Clear separation of concerns
- **Customize implementations**: Easy to modify individual pieces
- **Add new features**: Extensible architecture for enhancements
- **Build variations**: Use as foundation for different UI approaches

The blessed implementation shows the full potential of terminal-based interactive fiction players while maintaining the clear component architecture that makes the code easy to understand and extend.
