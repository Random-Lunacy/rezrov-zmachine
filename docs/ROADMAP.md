# Rezrov-ZMachine Roadmap

Version support and the current feature list live in the [README](../README.md#implementation-status).
This file tracks where the project is heading.

## Version support

- V1-V5: complete or mostly complete. The remaining V5 work is validating the extended screen model against Beyond Zork.
- V6: Zork Zero is playable in the web example. More V6 titles would show what is still missing.
- V7-V8: addressing and version detection exist, but no story files have been tested.

## Near term

- Validate V5 screen features against Beyond Zork.
- Web example polish (see the open issues labelled `examples`): text scaling in V6, status-area redraw on
  font-size changes, the Zork Zero hint screens, and showing Blorb frontispieces before a game starts.

## Longer term

- V7-V8 story file testing.
- More V6 titles.
- Performance profiling of the executor loop.
- A plugin or extension story for custom opcodes and multimedia handlers.

## Challenges

- Keeping behaviour consistent across Z-machine versions.
- Verifying against the shipped story files rather than the published source, which can differ (see Zork Zero).
