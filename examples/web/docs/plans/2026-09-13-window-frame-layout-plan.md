# Per-Window CSS Frame Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `WebScreen`'s ad hoc window-0 boundary tracking (`_window0BaseLeft/Right/Top`) and pillar-detection heuristic (`_rightPillarX`/`trackRightPicture`) with a generic mechanism that positions any Z-machine window's DOM element directly from its own `move_window`/`resize_window`/`split_window` box — fixing header-overlap, scrollbar-placement, and margin-width bugs in V6 canvas mode at their structural root.

**Architecture:** Add one scale factor (`getCanvasScale()`) and one generic box computer (`computeWindowFrame(windowId)`) that reads `WindowManager`'s already-correct per-window `x/y/width/height` state and converts it to CSS pixels. Apply that box directly to `#main-content` (window 0) and `#status-bar` (window 1) via `position: absolute` (replacing flexbox stacking + padding approximations), with `#input-line` pinned to the bottom independently since it isn't part of the Z-machine window model.

**Tech Stack:** TypeScript, Vite, no test framework in `examples/web` (confirmed absent — verification here is `tsc` type-checking plus manual/Playwright browser verification, as used throughout this feature's development).

**Spec:** `examples/web/docs/specs/2026-09-13-window-frame-layout-design.md`

## Global Constraints

- Scope is `examples/web` only (`WebScreen.ts`, `main.ts`). No `src/` changes.
- All changes are gated on `this._useCanvasBackground` — non-canvas (V1-V5 text) rendering must be byte-for-byte unchanged.
- `examples/web` has no test suite; every task's verification is `cd examples/web && npm run build` (runs `tsc && vite build`) plus, where noted, browser verification.
- Follow existing code style in `WebScreen.ts`: 2-space indent, single quotes, no unrelated reformatting.

---

## Task 1: Consolidate the canvas scale factor, fix leftover debug logging

Pure refactor — renames `getStatusBarLineHeight()` to `getCanvasScale()` with identical numeric behavior at every existing call site (all three are already gated on `this._useCanvasBackground`, so the method's unused non-canvas fallback branch is dropped). Also reverts a leftover debug-logging change sitting uncommitted in `main.ts` from prior manual verification.

**Files:**
- Modify: `examples/web/src/main.ts`
- Modify: `examples/web/src/WebScreen.ts`

**Interfaces:**
- Produces: `WebScreen.getCanvasScale(): number` — CSS pixels per one native canvas pixel, valid only when `_useCanvasBackground` is true and the canvas has a laid-out size; returns `0` otherwise. Later tasks build `computeWindowFrame` on top of this.

- [ ] **Step 1: Revert the leftover debug-logging change**

In `examples/web/src/main.ts`, inside `setupGame`, change:

```ts
  Logger.setLevel(LogLevel.DEBUG);
```

back to:

```ts
  Logger.setLevel(LogLevel.INFO);
```

- [ ] **Step 2: Rename `getStatusBarLineHeight` to `getCanvasScale`**

In `examples/web/src/WebScreen.ts`, replace the method (currently around line 673):

```ts
  private getStatusBarLineHeight(): number {
    const gameContainer = this.statusEl.parentElement;
    const cssContainerH = gameContainer?.clientHeight ?? 0;
    if (this._useCanvasBackground) {
      // In V6, split_window uses pixel units (not character rows) per the Z-machine spec.
      // Convert canvas pixels to CSS pixels so that split_window(n) → status bar is
      // n canvas-pixels tall and the lower-window text aligns with its canvas position.
      const canvasH = this.pictureCanvas.height;
      if (canvasH > 0 && cssContainerH > 0) return cssContainerH / canvasH;
    }
    const { rows } = this.getSize();
    // Return exact (non-floored) value so that Math.ceil(lines * lineHeight) aligns
    // the status bar bottom with the canvas lower-window boundary without any gap.
    return rows > 0 && cssContainerH > 0 ? cssContainerH / rows : this.cellHeight;
  }
```

with:

```ts
  /**
   * Return CSS pixels per one native canvas pixel. `#game-container`'s height is
   * forced to preserve the canvas's native aspect ratio (see `main.ts`) and the
   * canvas is stretched 100%x100% into it, so this one scale factor is valid for
   * both X and Y. Returns 0 before the canvas has a laid-out size (e.g. while
   * `#game-container` is still `display: none`) — callers must treat 0 as "not
   * ready yet" and skip applying it.
   */
  private getCanvasScale(): number {
    const gameContainer = this.statusEl.parentElement;
    const cssContainerH = gameContainer?.clientHeight ?? 0;
    const canvasH = this.pictureCanvas.height;
    return canvasH > 0 && cssContainerH > 0 ? cssContainerH / canvasH : 0;
  }
```

- [ ] **Step 3: Update the three call sites**

In `print()` (the window-1/upper-window branch), change:

```ts
      const lineHeightPx = this._useCanvasBackground ? this.getStatusBarLineHeight() : this.cellHeight;
```

to:

```ts
      const lineHeightPx = this._useCanvasBackground ? this.getCanvasScale() : this.cellHeight;
```

In `splitWindow()`, change:

```ts
        this.statusEl.style.minHeight = `${Math.ceil(lines * this.getStatusBarLineHeight())}px`;
```

to:

```ts
        this.statusEl.style.minHeight = `${Math.ceil(lines * this.getCanvasScale())}px`;
```

(This line is fully replaced in Task 3 — this step just keeps the file compiling and behaviorally identical in between.)

In `setCursorPosition()`, change:

```ts
      const lineHeight = this.getStatusBarLineHeight(); // CSS pixels per canvas pixel
```

to:

```ts
      const lineHeight = this.getCanvasScale();
```

(Also fully replaced in Task 3.)

- [ ] **Step 4: Verify it builds and confirm no other references remain**

Run: `cd examples/web && npm run build`
Expected: succeeds with no errors.

Run: `grep -n getStatusBarLineHeight examples/web/src/WebScreen.ts`
Expected: no output (method fully renamed).

- [ ] **Step 5: Commit**

```bash
git add examples/web/src/WebScreen.ts examples/web/src/main.ts
git commit -m "$(cat <<'EOF'
Rename getStatusBarLineHeight to getCanvasScale, revert debug log level

Pure rename with identical behavior at all three existing call sites —
prep for computeWindowFrame, which needs the same X/Y scale factor.
Also reverts a debug logging level left over from manual verification.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Fix `getSize()`'s width source in canvas mode

`getSize()` currently sources its `width` from `#main-content`'s own `clientWidth` in both modes, but sources `height` from `#game-container` in canvas mode specifically (an existing asymmetry). Once Task 3 narrows `#main-content` to window 0's own (possibly sub-canvas-width) box, anything relying on `getSize().cols` to mean "the full canvas grid width" — `BaseScreen.clearLine` (library code) and `WebScreen.handleResize()` — would silently start computing a too-narrow column count for the upper-window text buffer. Fixing the asymmetry now, before `#main-content` narrows, is a no-op today (both elements are still the same width) and prevents that regression window.

**Files:**
- Modify: `examples/web/src/WebScreen.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `getSize()` behavior unchanged for non-canvas mode; in canvas mode, `width` now sourced the same way `height` already is (from `#game-container`, i.e. the full canvas box) rather than from `#main-content`.

- [ ] **Step 1: Update `getSize()`**

Replace:

```ts
  getSize(): ScreenSize {
    // Use the scroll container (main-content) for dimensions so status bar and
    // upper window use the same width. Fall back to mainEl if parent unavailable.
    const container = this.mainEl.parentElement;
    const width = (container?.clientWidth ?? this.mainEl.clientWidth) || 800;
    // In V6 canvas mode, use the full game container height (includes status bar and
    // input area) so that row count maps the entire canvas coordinate space.
    const heightSource = this._useCanvasBackground ? this.statusEl.parentElement : container;
    const height = (heightSource?.clientHeight ?? this.mainEl.clientHeight) || 400;
    const cols = Math.max(40, Math.floor(width / this.cellWidth));
    const rows = Math.max(10, Math.floor(height / this.cellHeight));
    return { rows, cols };
  }
```

with:

```ts
  getSize(): ScreenSize {
    // Use the scroll container (main-content) for dimensions in non-canvas mode.
    // In V6 canvas mode, use the full game container (status bar + main content +
    // input area) for BOTH width and height, so row/col counts map the entire
    // canvas coordinate space rather than window 0's own (possibly narrower) box —
    // window 0's box no longer represents "the whole screen" once it has its own
    // move_window/resize_window position (see computeWindowFrame).
    const container = this.mainEl.parentElement;
    const source = this._useCanvasBackground ? this.statusEl.parentElement : container;
    const width = (source?.clientWidth ?? this.mainEl.clientWidth) || 800;
    const height = (source?.clientHeight ?? this.mainEl.clientHeight) || 400;
    const cols = Math.max(40, Math.floor(width / this.cellWidth));
    const rows = Math.max(10, Math.floor(height / this.cellHeight));
    return { rows, cols };
  }
```

- [ ] **Step 2: Verify it builds**

Run: `cd examples/web && npm run build`
Expected: succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add examples/web/src/WebScreen.ts
git commit -m "$(cat <<'EOF'
Source getSize()'s width from the full canvas box in V6 canvas mode

Matches the existing height-sourcing asymmetry. No behavior change
today (main-content and game-container are still the same width), but
required before window 0's own box narrows to less than the full
canvas width, so callers relying on getSize().cols as "canvas grid
width" (BaseScreen.clearLine, WebScreen.handleResize) don't regress.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add per-window frame computation and apply it to windows 0 and 1

The core change. Adds `computeWindowFrame`/`applyWindowFrame`, switches `#main-content`, `#status-bar`, and `#input-line` from flexbox-stacked to explicitly positioned/sized boxes, wires frame (re)application into every opcode override that can change a window's box (`moveWindow`, `resizeWindow`, `splitWindow`, plus once from `enableCanvasBackground`), and removes the now-superseded `_window0BaseLeft/Right/Top` tracking fields and their readers (`applyLowerWindowMarginsCss`, `displayInlinePicture`, `setCursorPosition`).

This task lands as one commit because the removed fields and their readers must change atomically — there is no valid intermediate state where the fields are gone but a reader still expects them, or vice versa.

**Files:**
- Modify: `examples/web/src/WebScreen.ts`

**Interfaces:**
- Consumes: `WebScreen.getCanvasScale()` (Task 1), `this.windowManager.getWindowProperty(windowId, WindowProperty.{XCoordinate,YCoordinate,XSize,YSize,LeftMargin,RightMargin})` (already exists, generic per window ID).
- Produces:
  - `WebScreen.computeWindowFrame(windowId: number): { left: number; top: number; width: number; height: number }` — CSS pixels, relative to `#game-container`'s own content box.
  - `WebScreen.applyWindowFrame(el: HTMLElement, windowId: number, scroll: boolean): void` — positions and sizes `el` from `computeWindowFrame(windowId)`, clipped so it never extends below `#input-line`'s top.
  - Removes: `_window0BaseLeft`, `_window0BaseRight`, `_window0BaseTop` (no other file references them — confirmed by repo-wide grep before this task).

- [ ] **Step 1: Add `computeWindowFrame` and `applyWindowFrame`**

Add these two new private methods immediately after `getCanvasScale()`:

```ts
  /**
   * Compute a window's on-canvas box in CSS pixels, relative to #game-container's
   * own content box. Pure function of WindowManager's tracked per-window state —
   * works for any window ID the game has moved/resized, not just window 0/1.
   */
  private computeWindowFrame(windowId: number): { left: number; top: number; width: number; height: number } {
    const scale = this.getCanvasScale();
    const left = this.windowManager.getWindowProperty(windowId, WindowProperty.XCoordinate) - 1;
    const top = this.windowManager.getWindowProperty(windowId, WindowProperty.YCoordinate) - 1;
    const width = this.windowManager.getWindowProperty(windowId, WindowProperty.XSize);
    const height = this.windowManager.getWindowProperty(windowId, WindowProperty.YSize);
    return { left: left * scale, top: top * scale, width: width * scale, height: height * scale };
  }

  /**
   * Position and size `el` as windowId's real on-canvas box (position: absolute,
   * left/top/width/height in CSS px). `scroll` selects a scrolling viewport
   * (window 0's text) vs. a clipped, non-scrolling box (a status/banner window).
   *
   * The computed height is capped so the box never extends below #input-line's
   * top edge -- #input-line is browser UI chrome pinned to the bottom of
   * #game-container, not part of the Z-machine window model, so no window's
   * frame should be allowed to render under it.
   */
  private applyWindowFrame(el: HTMLElement, windowId: number, scroll: boolean): void {
    if (this.pictureCanvas.width === 0) return;
    const frame = this.computeWindowFrame(windowId);
    const gameContainer = this.statusEl.parentElement;
    const inputLine = gameContainer?.querySelector('#input-line') as HTMLElement | null;
    const inputLineHeight = inputLine?.offsetHeight ?? 0;
    const gameContainerHeight = gameContainer?.clientHeight ?? 0;
    const inputLineTop = gameContainerHeight - inputLineHeight;
    const height = Math.max(0, Math.min(frame.height, inputLineTop - frame.top));

    el.style.position = 'absolute';
    el.style.left = `${frame.left.toFixed(1)}px`;
    el.style.top = `${frame.top.toFixed(1)}px`;
    el.style.width = `${frame.width.toFixed(1)}px`;
    el.style.height = `${height.toFixed(1)}px`;
    if (scroll) {
      el.style.overflowY = 'auto';
      el.style.overflowX = 'hidden';
    } else {
      el.style.overflow = 'hidden';
    }
  }
```

- [ ] **Step 2: Rewrite `enableCanvasBackground()`'s layout setup**

Replace the whole method body from the `mainEl.style.backgroundColor` line through the `inputField` block (everything between the `this._useCanvasBackground = true;` line and the `// Remeasure cell dimensions` comment) — currently:

```ts
    // Status bar: transparent, no border, initially hidden until split_window is called
    this.statusEl.style.backgroundColor = 'transparent';
    this.statusEl.style.borderBottom = 'none';
    this.statusEl.style.display = 'none';

    // Main text area: transparent, no default padding/height constraints
    this.mainEl.style.backgroundColor = 'transparent';
    this.mainEl.style.minHeight = '0';

    const mainContent = this.mainEl.parentElement;
    if (mainContent) {
      mainContent.style.backgroundColor = 'transparent';
      mainContent.style.minHeight = '0';
      mainContent.style.maxHeight = 'none';
      mainContent.style.padding = '0';
      mainContent.style.overflowY = 'auto';
      // Take up all remaining vertical space between status bar and input line
      mainContent.style.flex = '1';
    }

    const gameContainer = this.statusEl.parentElement;
    if (gameContainer) {
      gameContainer.style.backgroundColor = 'transparent';
      // Stack children vertically so status bar + text area + input fill the container
      gameContainer.style.display = 'flex';
      gameContainer.style.flexDirection = 'column';
      // Note: we intentionally do NOT override the CSS font size here. The default 16px
      // font with the body's line-height:1.4 gives cellHeight≈22px and rows≈25, which
      // maps exactly to Zork Zero's 320×200 canvas at fontH=8 (200/8=25 rows). Changing
      // the font size would misalign split_window heights and set_cursor coordinates.
    }

    const inputLine = gameContainer?.querySelector('#input-line') as HTMLElement | null;
    if (inputLine) {
      inputLine.style.backgroundColor = 'transparent';
      inputLine.style.borderTop = 'none';
      inputLine.style.flexShrink = '0';
    }
    const inputField = gameContainer?.querySelector('#input-field') as HTMLInputElement | null;
    if (inputField) {
      inputField.style.backgroundColor = 'transparent';
      inputField.style.border = '1px solid rgba(255,255,255,0.3)';
    }
```

with:

```ts
    // Status bar: transparent, no border, initially hidden until split_window/
    // resize_window gives it a size. Positioned by applyWindowFrame, not flex.
    this.statusEl.style.backgroundColor = 'transparent';
    this.statusEl.style.borderBottom = 'none';
    this.statusEl.style.display = 'none';
    this.statusEl.style.minHeight = '0';

    // Main text area: transparent, no default padding/height constraints
    this.mainEl.style.backgroundColor = 'transparent';
    this.mainEl.style.minHeight = '0';

    const mainContent = this.mainEl.parentElement as HTMLElement | null;
    if (mainContent) {
      mainContent.style.backgroundColor = 'transparent';
      mainContent.style.padding = '0';
      // left/top/width/height/overflow are set by applyWindowFrame, from window 0's
      // own move_window/resize_window box, once WindowManager has real bounds.
    }

    const gameContainer = this.statusEl.parentElement;
    if (gameContainer) {
      gameContainer.style.backgroundColor = 'transparent';
      // Note: we intentionally do NOT override the CSS font size here. The default 16px
      // font with the body's line-height:1.4 gives cellHeight≈22px and rows≈25, which
      // maps exactly to Zork Zero's 320×200 canvas at fontH=8 (200/8=25 rows). Changing
      // the font size would misalign split_window heights and set_cursor coordinates.
    }

    // #input-line is browser UI chrome, not part of the Z-machine window model --
    // pin it to the bottom of #game-container directly rather than relying on
    // flexbox (main-content/status-bar are no longer flex children, so flex
    // layout can no longer reserve space for it).
    const inputLine = gameContainer?.querySelector('#input-line') as HTMLElement | null;
    if (inputLine) {
      inputLine.style.backgroundColor = 'transparent';
      inputLine.style.borderTop = 'none';
      inputLine.style.position = 'absolute';
      inputLine.style.left = '0';
      inputLine.style.right = '0';
      inputLine.style.bottom = '0';
    }
    const inputField = gameContainer?.querySelector('#input-field') as HTMLInputElement | null;
    if (inputField) {
      inputField.style.backgroundColor = 'transparent';
      inputField.style.border = '1px solid rgba(255,255,255,0.3)';
    }

    // Apply initial frames (no-ops if the canvas isn't sized yet — the later
    // moveWindow/resizeWindow/splitWindow calls will apply them once it is).
    if (mainContent) this.applyWindowFrame(mainContent, 0, true);
    this.applyWindowFrame(this.statusEl, 1, false);
```

- [ ] **Step 3: Delete the `_window0Base*` fields**

Remove the field block (currently around line 490-500):

```ts
  /**
   * V6 window-0 boundary tracking (canvas pixels, 0-based).
   * Updated by overridden resizeWindow/moveWindow; used to compute CSS padding so text
   * flows within the correct visual area and does not overlap canvas pictures.
   * _window0BaseLeft:  left  edge (default 0)
   * _window0BaseRight: right edge (-1 = not yet configured → fall back to canvas width)
   * _window0BaseTop:   top   edge (default 0); used to compute paddingTop from set_cursor
   */
  private _window0BaseLeft: number = 0;
  private _window0BaseRight: number = -1;
  private _window0BaseTop: number = 0;
```

Leave the `_rightPillarX` field and `trackRightPicture` method in place for now — they're removed in Task 4.

- [ ] **Step 4: Simplify `setCursorPosition`**

Replace:

```ts
  override setCursorPosition(machine: ZMachine, line: number, column: number, windowId: number): void {
    // In V6 canvas mode, set_cursor(row, col, 0) positions the HTML text start within window 0
    // (e.g. below the room illustration drawn at the top of the window).  Intercept the raw
    // pixel coordinates here before BaseScreen converts them to character-cell units.
    if (this._useCanvasBackground && machine.state.version >= 6 && windowId === 0) {
      // line is a 1-based canvas-pixel row within window 0; make it screen-absolute.
      const canvasAbsY = this._window0BaseTop + line - 1;
      const lineHeight = this.getCanvasScale();
      const cssY = canvasAbsY * lineHeight;
      const statusBarCssH = parseFloat(this.statusEl.style.minHeight || '0');
      const paddingTop = Math.max(0, cssY - statusBarCssH);
      this.mainEl.style.paddingTop = `${paddingTop.toFixed(1)}px`;
      this.v6debug(
        `[set_cursor] window=0 line=${line} col=${column} canvasAbsY=${canvasAbsY} cssY=${cssY.toFixed(1)} paddingTop=${paddingTop.toFixed(1)}`
      );
      return;
    }
    super.setCursorPosition(machine, line, column, windowId);
  }
```

with:

```ts
  override setCursorPosition(machine: ZMachine, line: number, column: number, windowId: number): void {
    // In V6 canvas mode, set_cursor(row, col, 0) positions the HTML text start within window 0
    // (e.g. below the room illustration drawn at the top of the window).  Intercept the raw
    // pixel coordinates here before BaseScreen converts them to character-cell units.
    //
    // Per the Z-machine spec, set_cursor's line is already relative to the target
    // window's own top-left corner. #main-content's own box top is now exactly
    // window 0's top (see applyWindowFrame), so the padding needed is just the
    // offset within the window -- no absolute-position bookkeeping required.
    if (this._useCanvasBackground && machine.state.version >= 6 && windowId === 0) {
      const paddingTop = Math.max(0, (line - 1) * this.getCanvasScale());
      this.mainEl.style.paddingTop = `${paddingTop.toFixed(1)}px`;
      this.v6debug(`[set_cursor] window=0 line=${line} col=${column} paddingTop=${paddingTop.toFixed(1)}`);
      return;
    }
    super.setCursorPosition(machine, line, column, windowId);
  }
```

- [ ] **Step 5: Simplify `resizeWindow`, `moveWindow`, `splitWindow`**

Replace:

```ts
  override resizeWindow(machine: ZMachine, windowId: number, height: number, width: number): void {
    super.resizeWindow(machine, windowId, height, width);
    if (this._useCanvasBackground && windowId === 0) {
      const newRight = this._window0BaseLeft + width;
      // Only advance the right boundary when the window grows wider.  V6 games
      // (e.g. Zork Zero) sometimes shrink window 0 to a narrow inline-picture
      // sub-region before drawing a floating picture, then restore it.  Using
      // the maximum width ever set prevents that temporary narrowing from
      // squeezing the text area.
      if (this._window0BaseRight < 0 || newRight > this._window0BaseRight) {
        this._window0BaseRight = newRight;
        this.v6debug(`[resize_window] window=0 h=${height} w=${width} rightEdge=${this._window0BaseRight}`);
        const left = this.windowManager.getWindowProperty(0, WindowProperty.LeftMargin);
        const right = this.windowManager.getWindowProperty(0, WindowProperty.RightMargin);
        this.applyLowerWindowMarginsCss(left, right);
      } else {
        this.v6debug(
          `[resize_window] window=0 h=${height} w=${width} (ignored – would narrow from ${this._window0BaseRight})`
        );
      }
    }
  }

  override moveWindow(machine: ZMachine, windowId: number, y: number, x: number): void {
    super.moveWindow(machine, windowId, y, x);
    if (this._useCanvasBackground && windowId === 0) {
      // x and y are 1-based; convert to 0-based canvas pixels
      const oldLeft = this._window0BaseLeft;
      this._window0BaseLeft = x - 1;
      this._window0BaseTop = y - 1;
      if (this._window0BaseRight >= 0) {
        this._window0BaseRight += this._window0BaseLeft - oldLeft;
      }
      this.v6debug(
        `[move_window] window=0 y=${y} x=${x} top=${this._window0BaseTop} left=${this._window0BaseLeft} right=${this._window0BaseRight}`
      );
      const left = this.windowManager.getWindowProperty(0, WindowProperty.LeftMargin);
      const right = this.windowManager.getWindowProperty(0, WindowProperty.RightMargin);
      this.applyLowerWindowMarginsCss(left, right);
    }
  }
```

with:

```ts
  override resizeWindow(machine: ZMachine, windowId: number, height: number, width: number): void {
    super.resizeWindow(machine, windowId, height, width);
    if (!this._useCanvasBackground) return;
    if (windowId === 0) {
      const mainContent = this.mainEl.parentElement as HTMLElement | null;
      if (mainContent) this.applyWindowFrame(mainContent, 0, true);
      this.v6debug(`[resize_window] window=0 h=${height} w=${width}`);
      const left = this.windowManager.getWindowProperty(0, WindowProperty.LeftMargin);
      const right = this.windowManager.getWindowProperty(0, WindowProperty.RightMargin);
      this.applyLowerWindowMarginsCss(left, right);
    } else {
      this.applyWindowFrame(this.statusEl, windowId, false);
      this.v6debug(`[resize_window] window=${windowId} h=${height} w=${width}`);
    }
  }

  override moveWindow(machine: ZMachine, windowId: number, y: number, x: number): void {
    super.moveWindow(machine, windowId, y, x);
    if (!this._useCanvasBackground) return;
    if (windowId === 0) {
      const mainContent = this.mainEl.parentElement as HTMLElement | null;
      if (mainContent) this.applyWindowFrame(mainContent, 0, true);
      this.v6debug(`[move_window] window=0 y=${y} x=${x}`);
      const left = this.windowManager.getWindowProperty(0, WindowProperty.LeftMargin);
      const right = this.windowManager.getWindowProperty(0, WindowProperty.RightMargin);
      this.applyLowerWindowMarginsCss(left, right);
    } else {
      this.applyWindowFrame(this.statusEl, windowId, false);
      this.v6debug(`[move_window] window=${windowId} y=${y} x=${x}`);
    }
  }
```

Note: this intentionally removes the old "never narrow window 0" guard. `#main-content` is now a real box that always reflects `resize_window`'s current value, exactly like a real interpreter — the guard existed only to compensate for `#main-content` not having a real box to be narrow or wide *of*. Task 5 verifies this against the exact scenario that guard was written for.

Note: any non-zero windowId is routed to `this.statusEl` — per the spec, this repo's content model (`BaseScreen.upperWindowBuffer`) doesn't yet support multiple simultaneous non-zero text windows with independent DOM elements (out of scope; see spec §5), so all non-zero windows share the one status-bar element's frame today. This only changes behavior for a window ID other than 0 or 1, which no currently-known game uses.

Now replace `splitWindow`:

```ts
  splitWindow(machine: ZMachine, lines: number): void {
    super.splitWindow(machine, lines);

    if (lines === 0) {
      this.statusEl.style.display = 'none';
    } else {
      this.statusEl.style.display = 'block';
      if (this._useCanvasBackground) {
        // V6: map canvas-row count to CSS pixels proportionally to canvas scaling.
        // Use Math.ceil so the status bar bottom edge is never below the canvas header boundary.
        this.statusEl.style.minHeight = `${Math.ceil(lines * this.getCanvasScale())}px`;
      } else {
        this.statusEl.style.minHeight = `${lines * this.cellHeight}px`;
      }
    }
  }
```

with:

```ts
  splitWindow(machine: ZMachine, lines: number): void {
    super.splitWindow(machine, lines);

    if (lines === 0) {
      this.statusEl.style.display = 'none';
    } else {
      this.statusEl.style.display = 'block';
      if (!this._useCanvasBackground) {
        this.statusEl.style.minHeight = `${lines * this.cellHeight}px`;
      }
    }

    if (this._useCanvasBackground) {
      // WindowManager.splitWindow also moves/resizes window 0 to fill the
      // remaining space (see WindowManager.splitWindow), so reapply both frames.
      this.applyWindowFrame(this.statusEl, 1, false);
      const mainContent = this.mainEl.parentElement as HTMLElement | null;
      if (mainContent) this.applyWindowFrame(mainContent, 0, true);
    }
  }
```

- [ ] **Step 6: Stop auto-growing the status bar height in canvas mode**

In `print()`'s upper-window branch, the status bar's height is now authoritatively fixed by `applyWindowFrame` (from `resize_window`'s tracked size) — auto-growing `minHeight` past that on overflow would defeat the whole point (status text growing down over the picture below it, the same bug this plan fixes for window 0). Replace:

```ts
      // Expand status bar if buffer lines exceed the current split height.
      // In canvas mode, use the canvas-proportional line height so expansion
      // doesn't break the coordinate alignment set by splitWindow().
      const bufferLines = this.upperWindowBuffer.length;
      const lineHeightPx = this._useCanvasBackground ? this.getCanvasScale() : this.cellHeight;
      const currentMinHeight = Math.round(parseFloat(this.statusEl.style.minHeight || '0') / lineHeightPx);
      if (bufferLines > currentMinHeight) {
        this.statusEl.style.minHeight = `${Math.ceil(bufferLines * lineHeightPx)}px`;
      }
```

with:

```ts
      // In canvas mode the status bar's box is authoritatively sized by
      // applyWindowFrame from the window's own resize_window size -- it must
      // not auto-grow past that (would render over whatever is below it).
      // Non-canvas mode keeps the original auto-grow-on-overflow behavior.
      if (!this._useCanvasBackground) {
        const bufferLines = this.upperWindowBuffer.length;
        const currentMinHeight = Math.round(parseFloat(this.statusEl.style.minHeight || '0') / this.cellHeight);
        if (bufferLines > currentMinHeight) {
          this.statusEl.style.minHeight = `${Math.ceil(bufferLines * this.cellHeight)}px`;
        }
      }
```

- [ ] **Step 7: Simplify `applyLowerWindowMarginsCss`**

Replace:

```ts
  private applyLowerWindowMarginsCss(leftInlinePx: number, rightInlinePx: number): void {
    const canvasW = this.pictureCanvas.width;
    if (canvasW === 0) return;
    // Combine the window's own left edge (from move_window) with any inline picture
    // margin (from set_margins) to get the total left offset for text flow.
    const effectiveLeftPx = this._window0BaseLeft + leftInlinePx;
    // Right text boundary: use the window's configured right edge, but cap it at the
    // left edge of any right-side decorative picture (e.g. the right column/pillar).
    // In V6 layouts the window may be sized wider than the visual text column because
    // the original interpreter drew the pillar on top; in CSS we need explicit padding.
    const windowRight = this._window0BaseRight >= 0 ? this._window0BaseRight : canvasW;
    // _rightPillarX is 1-based screen-absolute; convert to 0-based exclusive right limit.
    const pillarRight = this._rightPillarX >= 0 ? this._rightPillarX - 1 : canvasW;
    const effectiveRight = Math.min(windowRight, pillarRight);
    const effectiveRightPx = canvasW - effectiveRight + rightInlinePx;
    // Use percentage-based padding so margins scale with the container and work
    // correctly even before the DOM has been laid out (clientWidth may be 0 during
    // the synchronous execution that processes the first set_margins opcode).
    const leftPct = (effectiveLeftPx / canvasW) * 100;
    const rightPct = (effectiveRightPx / canvasW) * 100;
    this.v6debug(
      `[margins] left=${effectiveLeftPx}px (${leftPct.toFixed(1)}%) right=${effectiveRightPx}px (${rightPct.toFixed(1)}%) canvas=${canvasW}`
    );
    this.mainEl.style.paddingLeft = `${leftPct.toFixed(2)}%`;
    this.mainEl.style.paddingRight = `${rightPct.toFixed(2)}%`;
  }
```

with:

```ts
  private applyLowerWindowMarginsCss(leftInlinePx: number, rightInlinePx: number): void {
    // #main-content is now window 0's own box (see applyWindowFrame), so
    // set_margins' values are the entire story -- no window-offset or pillar
    // reconstruction needed. Margins are in canvas-pixel units; convert to CSS px.
    const scale = this.getCanvasScale();
    if (scale === 0) return;
    const leftPx = leftInlinePx * scale;
    const rightPx = rightInlinePx * scale;
    this.v6debug(`[margins] left=${leftPx.toFixed(1)}px right=${rightPx.toFixed(1)}px`);
    this.mainEl.style.paddingLeft = `${leftPx.toFixed(1)}px`;
    this.mainEl.style.paddingRight = `${rightPx.toFixed(1)}px`;
  }
```

- [ ] **Step 8: Fix `displayInlinePicture`'s column math**

Replace:

```ts
    const leftMargin = this.windowManager.getWindowProperty(0, WindowProperty.LeftMargin);
    const rightMargin = this.windowManager.getWindowProperty(0, WindowProperty.RightMargin);
    const columnLeft = this._window0BaseLeft + leftMargin;
    const columnRight = (this._window0BaseRight >= 0 ? this._window0BaseRight : canvasW) - rightMargin;
    const columnWidth = Math.max(1, columnRight - columnLeft);
    const columnMid = (columnLeft + columnRight) / 2;
```

with:

```ts
    const leftMargin = this.windowManager.getWindowProperty(0, WindowProperty.LeftMargin);
    const rightMargin = this.windowManager.getWindowProperty(0, WindowProperty.RightMargin);
    const windowLeft = this.windowManager.getWindowProperty(0, WindowProperty.XCoordinate) - 1;
    const windowWidth = this.windowManager.getWindowProperty(0, WindowProperty.XSize);
    const columnLeft = windowLeft + leftMargin;
    const columnRight = windowLeft + windowWidth - rightMargin;
    const columnWidth = Math.max(1, columnRight - columnLeft);
    const columnMid = (columnLeft + columnRight) / 2;
```

(This function's `pixelX`/percentage-of-`columnWidth` math below this point is unchanged — both values are still screen-absolute canvas pixels, just sourced live from `WindowManager` instead of a mirrored field. Also update the comment two lines above this block, which currently reads `// 0-based to compare against the 0-based _window0BaseLeft/_window0BaseRight bounds,` — change `_window0BaseLeft/_window0BaseRight` to `windowLeft/windowWidth`.)

- [ ] **Step 9: Verify it builds**

Run: `cd examples/web && npm run build`
Expected: succeeds with no errors. If `tsc` reports unused-variable errors for anything still referencing removed fields, fix those references (this would indicate a missed call site — re-check with `grep -n "_window0Base" examples/web/src/WebScreen.ts`, which should return nothing).

- [ ] **Step 10: Manual/Playwright visual verification**

This is the task where behavior actually changes, so verify visually before committing. If a V6 story + Blorb pair is available locally (this feature was developed against `~/zork-zero/Zork Zero.z6` + `Zork Zero.blb`):

Check whether Playwright's Chromium is available:

Run: `node -e "require('playwright')" 2>&1 | head -5`

If that fails (module not found), install it into a scratch location (do not add it as a project dependency):

Run: `mkdir -p /tmp/window-frame-verify && cd /tmp/window-frame-verify && npm init -y >/dev/null && npm install playwright >/dev/null && npx playwright install chromium`

Then, with `cd examples/web && npm run dev` running in the background, write and run this script (adjust the story path if not using Zork Zero):

```js
// /tmp/window-frame-verify/verify.mjs
import { chromium } from 'playwright';

const home = process.env.HOME;
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 985, height: 700 } });

await page.goto('http://localhost:5173/');
await page.waitForSelector('#dir-input');
await page.setInputFiles('#dir-input', `${home}/zork-zero`);
await page.waitForSelector('#game-container[style*="block"]', { timeout: 15000 });
await page.waitForFunction(() => (document.getElementById('text-output')?.textContent?.length ?? 0) > 20, {
  timeout: 15000,
});
await page.waitForTimeout(1500);

await page.screenshot({ path: '/tmp/window-frame-verify/initial.png' });

const info = await page.evaluate(() => {
  const mainContent = document.getElementById('text-output').parentElement;
  const statusEl = document.getElementById('status-bar');
  const inputLine = document.getElementById('input-line');
  const canvas = document.getElementById('picture-layer');
  const gameContainer = canvas.parentElement;
  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  return {
    gameContainer: rectOf(gameContainer),
    mainContent: rectOf(mainContent),
    statusEl: rectOf(statusEl),
    inputLine: rectOf(inputLine),
    mainContentOverflowY: getComputedStyle(mainContent).overflowY,
    mainContentScrollWidth: mainContent.scrollWidth,
    mainContentClientWidth: mainContent.clientWidth,
  };
});
console.log(JSON.stringify(info, null, 2));

await browser.close();
```

Run: `node /tmp/window-frame-verify/verify.mjs`

Read `/tmp/window-frame-verify/initial.png` and confirm visually:
- Body text does not overlap the header banner picture.
- Body text renders between the left and right decorative pillars, not under either.
- The scrollbar (if visible) renders at the right edge of the text column, not at the right edge of the whole game surface / over the right pillar.
- `#input-line` renders pinned at the bottom of the game area, not at the top.

From the JSON output, confirm:
- `mainContent.top > gameContainer.top` (window 0 starts below the header, not at the very top).
- `mainContent.right <= statusEl.right` and `mainContent.left >= statusEl.left` is not a meaningful check (status bar spans full width); instead confirm `mainContent.width < gameContainer.width` (window 0 is narrower than the full canvas, i.e. it excludes the pillars).
- `mainContent.bottom <= inputLine.top` (no overlap between the scrolling text box and the input line).
- `statusEl.top === gameContainer.top` and `statusEl.width === gameContainer.width` (the header status box still spans the full top strip, matching `window_size 1 39 320` from the game's own trace).

If no local V6 story file is available in this environment, skip the script and instead state plainly in the task notes that this step could not be run, and rely on Task 5's end-to-end pass (run whenever a suitable environment is available) before considering the plan fully verified.

- [ ] **Step 11: Commit**

```bash
git add examples/web/src/WebScreen.ts
git commit -m "$(cat <<'EOF'
Position window 0 and window 1 as real CSS boxes from their own frame

Replaces _window0BaseLeft/Right/Top tracking and padding-based
approximation with computeWindowFrame/applyWindowFrame, which read
WindowManager's already-correct per-window x/y/width/height directly
and apply them as an explicit position:absolute box. Fixes header
overlap (the box's own top is now the window's real top, not a
padding value that could be exceeded), scrollbar placement (the
scrollbar now belongs to a box already narrowed to the interior
column), and margin width (padding is now relative to the box's own
already-correct width instead of the full canvas width).

#input-line is pinned to the bottom of #game-container directly,
since main-content/status-bar leaving flex flow removes the mechanism
that used to reserve space for it there.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Remove the now-redundant pillar-detection heuristic

`resize_window`'s own tracked width already gives window 0's true right edge (confirmed against a live trace: `move_window(0, y=40, x=44)` + `window_size(0, h=161, w=234)` → right edge 277, exactly the right pillar's left edge on a 320px canvas) and Task 3 already uses it directly. `_rightPillarX`/`trackRightPicture` are now dead weight that reconstructs the same boundary a less reliable way (inferring it from which pictures happen to be tall and right-of-center).

**Files:**
- Modify: `examples/web/src/WebScreen.ts`
- Modify: `examples/web/src/main.ts`

**Interfaces:**
- Removes: `WebScreen.trackRightPicture(screenX: number): void`, `WebScreen._rightPillarX`.

- [ ] **Step 1: Confirm nothing still reads it**

Run: `grep -n "_rightPillarX\|trackRightPicture" examples/web/src/WebScreen.ts`
Expected: only the field declaration and the `trackRightPicture` method body itself (no other readers — Task 3's Step 7 already removed `applyLowerWindowMarginsCss`'s reference).

- [ ] **Step 2: Delete the field and method from `WebScreen.ts`**

Remove:

```ts
  /**
   * Leftmost X (1-based, screen-absolute) of any right-side decorative picture drawn
   * during V6 layout.  Used to cap the right text boundary so text does not flow under
   * the right column/pillar picture.  -1 = not yet detected.
   */
  private _rightPillarX: number = -1;
```

and:

```ts
  /**
   * Called from main.ts's pictureRenderer callback when a picture is drawn to the right
   * of the canvas centre.  Tracks the leftmost such X position (1-based, screen-absolute)
   * so that text does not flow under the decorative right-column picture.
   */
  trackRightPicture(screenX: number): void {
    if (this._rightPillarX < 0 || screenX < this._rightPillarX) {
      this._rightPillarX = screenX;
      this.v6debug(`[trackRightPicture] rightPillarX=${this._rightPillarX}`);
      // Re-apply margins with updated right boundary (margins values not re-fetched here;
      // the next set_margins call will pick up the new boundary automatically).
    }
  }
```

- [ ] **Step 3: Remove the call site in `main.ts`**

Replace:

```ts
        try {
          if (window === 0) {
            await webScreen.displayInlinePicture(resourceId, data, format, x, y, scale);
            return;
          }
          // Track right-side pictures synchronously (before async image load) so that
          // the right text boundary is set before any subsequent set_margins opcode runs.
          // Only a tall picture (a real decorative side pillar/column) should narrow the
          // text margin -- a small badge/icon drawn elsewhere on the right (e.g. a
          // status-bar decoration) must not be mistaken for one.
          const pictureHeight = multimediaHandler?.getPictureData(resourceId)?.height ?? 0;
          if (x > pictureCanvas.width / 2 && pictureHeight > pictureCanvas.height / 4) {
            webScreen.trackRightPicture(x);
          }
          await pictureRenderer.displayPicture(resourceId, data, format, x, y, scale);
        } catch (error) {
          console.warn(`Picture ${resourceId} render failed:`, error);
        }
```

with:

```ts
        try {
          if (window === 0) {
            await webScreen.displayInlinePicture(resourceId, data, format, x, y, scale);
            return;
          }
          await pictureRenderer.displayPicture(resourceId, data, format, x, y, scale);
        } catch (error) {
          console.warn(`Picture ${resourceId} render failed:`, error);
        }
```

- [ ] **Step 4: Verify it builds**

Run: `cd examples/web && npm run build`
Expected: succeeds with no errors. (If `multimediaHandler`/`pictureCanvas` become unused in that scope due to this removal, `tsc` with `noUnusedLocals` will report it — check the surrounding `pictureRenderer` callback for any other use of those variables before assuming they're safe to leave; both are used elsewhere in `setupGame`, so this should not happen, but verify.)

- [ ] **Step 5: Commit**

```bash
git add examples/web/src/WebScreen.ts examples/web/src/main.ts
git commit -m "$(cat <<'EOF'
Remove the pillar-detection heuristic, now redundant with real frames

resize_window's own tracked width already gives window 0's true right
edge (used directly since the previous commit) -- confirmed against a
live trace to be the same boundary trackRightPicture was
approximating from incidental picture positions. Removing the
heuristic eliminates a second, less reliable source of truth for the
same value.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: End-to-end verification pass

Re-verify the whole feature together, including the one behavior change flagged as a risk in Task 3 (removing the "never narrow window 0" guard) and everything fixed by earlier work in this session that must still hold.

**Files:** none (verification only).

- [ ] **Step 1: Play forward through a second resize/move cycle**

Using the same Playwright setup as Task 3 Step 10 (or manual browser play if unavailable), load the story, advance play past the opening scene into at least one additional room description (e.g. send a movement command through `#input-field` and press Enter), and re-run the same DOM-measurement script. Confirm `mainContent`'s frame updates to match the new scene's `move_window`/`resize_window` values rather than sticking to the first-computed box.

- [ ] **Step 2: Verify the previously-narrow-then-restored resize sequence**

This game's trace includes `window_size(0, h=161, w=234)` followed later by `window_size(0, h=160, w=86)` (a real, observed temporary narrowing) before eventually being restored wider again. Confirm, after play has advanced past that point, that window 0's text renders at full width with no visible residual narrowing and no visible flash/glitch during the transition (both opcodes execute synchronously with no `await` between them, so no intermediate frame should ever paint — if one is visible, note it, as it would indicate the browser is yielding somewhere unexpected between the two calls).

- [ ] **Step 3: Re-verify prior fixes still hold**

Take a fresh screenshot at the opening scene and confirm all of the following, which were fixed earlier in this feature's development and must not regress:
- Inline pictures (the drop-cap letter, small room icons) render flush-left/flush-right at the correct column position, matching the sfrotz reference.
- Padding exists between inline images and adjacent body text (not butted directly against it).
- The compass/exit icon overlay renders in the correct position.

- [ ] **Step 4: Confirm non-canvas mode is unaffected**

Load a non-V6 story (V3 or V5, e.g. any classic Infocom game file available locally) through the same web app and confirm the status bar and main text area render exactly as before this plan — flexbox layout, no absolute positioning, no visual change. This confirms every change in this plan stayed correctly gated behind `_useCanvasBackground`.

- [ ] **Step 5: Full build check**

Run: `cd examples/web && npm run build`
Expected: succeeds with no errors.

Run (repo root): `npm run lint`
Expected: no new lint errors introduced by this plan's changes.

- [ ] **Step 6: Report results**

No commit for this task (verification only). If any check in Steps 1-4 fails, fix it as a follow-up within the relevant earlier task's commit history (amend via a new small commit, not by rewriting prior commits), then re-run this task's checks.
