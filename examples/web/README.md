# Z-Machine Web Example

A V6-capable Z-Machine interpreter that runs in the browser, with full support for pictures and sound.

## Prerequisites

Build the main rezrov-zmachine library from the project root:

```bash
cd ../..
npm run build
```

## Running

```bash
cd examples/web
npm install
npm run dev
```

Open the URL shown (typically http://localhost:5173) in your browser.

For a production build:

```bash
npm run build
npm run preview
```

## Loading Games

**Single file:** Use the "Load story" file input to select:

- A raw story file (`.z3`, `.z5`, `.z8`)
- A self-contained Blorb file (`.blb`) containing the story + pictures/sound

**Companion Blorb:** Use the "Or folder" input to select a directory containing both:

- A story file (e.g., `zork.z5`)
- A companion Blorb with the same base name (e.g., `zork.blb`)

Alternatively, use the single file input with the `multiple` attribute to select both files at once (if your browser supports it).

## Features

- **Text mode:** Full support for V3–V5 text-only games
- **Pictures:** V6 games with Blorb resources display images on a canvas overlay
- **Sound:** OGG Vorbis sounds play via Web Audio API
- **Save/restore:** Uses browser localStorage (when available)

## V6 Games

V6 games with graphics and sound (e.g., Beyond Zork, Shogun) are often distributed as companion Blorb files. Place the story file and its `.blb` companion in the same folder, then load the folder to get full multimedia support.
