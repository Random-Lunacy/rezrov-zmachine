# Blessed Console Z-Machine Interpreter

An enhanced terminal-based Z-Machine interpreter using the blessed library for sophisticated terminal UI features, including proper split-window support and advanced input handling.

## Features

- **Split Windows**: Proper status bar and main text area separation
- **Enhanced UI**: Scrollable text and visual borders
- **Advanced Input**: Better keyboard handling and input management
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

## Controls

- **Text Input**: Type in the input box at the bottom
- **Character Input**: Press any key when prompted
- **Exit**: Press Escape or Ctrl+C to quit
- **Navigation**: Input box automatically focuses when needed

## Supported Z-Machine Features

### Display Features

- **Split Windows**: Proper status window (top) and main text (bottom)
- **Text Styling**: Bold, italic, reverse video
- **Colors**: Full color palette support with background/foreground
- **Cursor Control**: Precise cursor positioning
- **Window Management**: Clear windows, cursor visibility control

### Input Features

- **Line Input**: Full text input with editing capabilities
- **Character Input**: Single keypress detection
- **Terminating Characters**: Function keys and special character support
- **Timed Input**: Support for timed input operations

### File Operations

- **Save/Restore**: Interactive filename prompting
- **Multiple Streams**: Output stream management

## Implementation Details

### Screen Implementation (`BlessedScreen`)

- **Window Management**: Separate blessed boxes for status and main windows
- **Dynamic Sizing**: Responsive to terminal resize
- **Style Application**: Real-time text styling using blessed tags
- **Color Mapping**: Z-Machine color codes to blessed color names
- **Scrolling**: Automatic scrolling in main text area

### Input Implementation (`BlessedInputProcessor`)

- **Input Box**: Dedicated input widget with border and label
- **Key Filtering**: Intelligent handling of special keys
- **Event Management**: Proper cleanup of input handlers
- **Filename Prompts**: Custom input boxes for file operations

### Key Files

- `index.ts`: Main application with blessed UI setup
- Screen and input classes integrated with ZMachine
- Command-line argument parsing with nopt

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
│                                         │
├─────────────────────────────────────────┤
│ ┌─ Input ─────────────────────────────┐ │
│ │ [Text input box appears here]       │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Advanced Features

### Window Management

- Automatic split-window handling
- Proper window clearing and management
- Cursor positioning within windows
- Window property queries

### Text Rendering

- Real-time style application
- Color inheritance and overrides
- Efficient screen updates
- Proper text wrapping

### Input Handling

- Context-sensitive input modes
- Special key detection and filtering
- Terminating character processing
- Cleanup after input completion

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
- Try clicking in the input area
- Check that no other processes are using stdin

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

## Comparison with Basic Console

| Feature       | Basic Console   | Blessed Console   |
| ------------- | --------------- | ----------------- |
| Split Windows | Limited         | Full Support      |
| Input Method  | readline-sync   | blessed textbox   |
| Scrolling     | Terminal native | Controlled        |
| Styling       | chalk only      | Full blessed tags |
| UI Polish     | Basic           | Enhanced          |
| Performance   | Good            | Optimized         |

## Next Steps

This example provides a solid foundation for building more advanced Z-Machine interpreters. Consider extending it with:

- **Graphics Support**: Add picture display capabilities
- **Sound Integration**: Implement sound effect support
- **Save Management**: Enhanced save/load UI
- **Configuration**: User preferences and settings
- **Themes**: Customizable color schemes and fonts
