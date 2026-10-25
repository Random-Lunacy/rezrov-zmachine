# rezrov-zmachine

A modular Z-machine interpreter written in TypeScript that executes interactive fiction games like Zork and Planetfall. This is a modern port/refactoring of the ebozz implementation, designed with strong typing, modularity, and extensibility for running classic Infocom games across different platforms (terminal, web, native).

## Testing

- **Silent logging:** Disable with `Logger.setLogToConsole(false)` in tests

### Git Workflow

- **Main branch**: `main`
- **CI/CD**: GitHub Actions run on push/PR to main
  - Tested on Node.js 22.x and 24.x
  - Build, then run full test suite with coverage
  - CodeQL security analysis
- **Commit messages:** Clear, descriptive (no enforced format)

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

**Version Support:**
- **V1-V3:** Core support complete (execution, objects, text parsing)
- **V4-V5:** Extended opcodes, timed input (in progress)
- **V6:** Graphics support (pictures, fonts, windowing) in development
- **V7-V8:** Not yet implemented

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
