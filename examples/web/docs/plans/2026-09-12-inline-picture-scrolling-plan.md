# Inline Picture Scrolling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make V6 pictures drawn into window 0 (the scrolling body-text window) render as real inline DOM images that scroll with their surrounding text and wrap within the game's own margin-narrowed column, instead of drawing onto the fixed picture canvas.

**Architecture:** Thread the target window number through the existing `MultimediaHandler.displayPicture` → `BlorbMultimediaHandler` → `pictureRenderer` callback pipeline (currently dropped before it reaches the example app). In `examples/web`, branch on that window number: window 0 pictures become `<img>` elements appended into `#text-output`'s DOM flow (floated within the already-margin-narrowed column); every other window keeps using the existing fixed `<canvas>` path unchanged.

**Tech Stack:** TypeScript, Vitest (for `src/` unit tests), Vite (for `examples/web`), browser DOM APIs (`Blob`, `createImageBitmap`, `URL.createObjectURL`).

**Spec:** `examples/web/docs/specs/2026-09-12-inline-picture-scrolling-design.md`

## Global Constraints

- Scope is window 0 only — do not change how pictures render in any other window.
- `src/` changes get TDD unit tests; `examples/web` has no test infrastructure (no `.test.ts` files, no vitest config anywhere in that package) and its changes are verified manually in a browser, per existing project convention.
- Sizing uses percentage-of-canvas-width CSS, matching the existing convention in `WebScreen.applyLowerWindowMarginsCss` — no new absolute canvas-px-to-CSS-px scale factor.

---

### Task 1: Thread `window` through `MultimediaHandler.displayPicture`

**Files:**
- Modify: `src/ui/multimedia/MultimediaHandler.ts:169` (interface), `:286` (`BaseMultimediaHandler` stub)
- Test: `tests/unit/ui/multimedia/BaseMultimediaHandler.test.ts:141-146`

**Interfaces:**
- Produces: `MultimediaHandler.displayPicture(resourceId: number, x: number, y: number, scale: number, window: number): ResourceStatus` — the `window` parameter is new and required, appended after `scale`.

- [ ] **Step 1: Update the test to call the new signature**

In `tests/unit/ui/multimedia/BaseMultimediaHandler.test.ts`, replace the `'should display pictures'` test (lines 141-146):

```typescript
    it('should display pictures', () => {
      const result = handler.displayPicture(1, 100, 200, 150, 0);

      expect(result).toBe(ResourceStatus.NotAvailable);
      expect(mockLogger.debug).toHaveBeenCalledWith('Displaying picture 1 at (100,200) with scale 150%');
    });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/ui/multimedia/BaseMultimediaHandler.test.ts`
Expected: FAIL — a TypeScript error, "Expected 4 arguments, but got 5" (the interface doesn't accept a 5th argument yet).

- [ ] **Step 3: Update the interface and stub implementation**

In `src/ui/multimedia/MultimediaHandler.ts`, replace line 169:

```typescript
  displayPicture(resourceId: number, x: number, y: number, scale: number, window: number): ResourceStatus;
```

And update the JSDoc immediately above it (currently ending `@param scale ... @returns Status of the operation`) to add a line before `@returns`:

```typescript
   * @param window Window the picture is being drawn into
```

Replace line 286 (the `BaseMultimediaHandler` stub — name the parameter `_window` since the base stub doesn't use it, matching this file's existing `_type`/`_resourceId` convention for intentionally-unused parameters):

```typescript
  displayPicture(resourceId: number, x: number, y: number, scale: number, _window: number): ResourceStatus {
    this.logger.debug(`Displaying picture ${resourceId} at (${x},${y}) with scale ${scale}%`);
    return ResourceStatus.NotAvailable;
  }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/unit/ui/multimedia/BaseMultimediaHandler.test.ts`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Commit**

```bash
git add src/ui/multimedia/MultimediaHandler.ts tests/unit/ui/multimedia/BaseMultimediaHandler.test.ts
git commit -m "Add window parameter to MultimediaHandler.displayPicture"
```

---

### Task 2: Thread `window` through `BlorbMultimediaHandler.displayPicture` and `PictureRendererCallback`

**Files:**
- Modify: `src/ui/multimedia/BlorbMultimediaHandler.ts:105-112` (`PictureRendererCallback` type), `:263-287` (`displayPicture` method)
- Test: `tests/unit/ui/multimedia/BlorbMultimediaHandler.test.ts:276-286`

**Interfaces:**
- Consumes: `MultimediaHandler.displayPicture(resourceId, x, y, scale, window)` from Task 1.
- Produces: `PictureRendererCallback = (resourceId: number, data: Buffer, format: string, x: number, y: number, scale: number, window: number) => void`. `BlorbMultimediaHandler.displayPicture` now requires a 5th `window` argument and forwards it as the callback's 7th argument.

- [ ] **Step 1: Update the tests to call the new signature and add a forwarding test**

In `tests/unit/ui/multimedia/BlorbMultimediaHandler.test.ts`, replace the `describe('displayPicture', ...)` block (lines 276-286):

```typescript
  describe('displayPicture', () => {
    it('should return Available for existing picture', () => {
      const status = handler.displayPicture(1, 10, 20, 100, 0);
      expect(status).toBe(ResourceStatus.Available);
    });

    it('should return NotAvailable for missing picture', () => {
      const status = handler.displayPicture(99, 10, 20, 100, 0);
      expect(status).toBe(ResourceStatus.NotAvailable);
    });

    it('should forward the target window to the pictureRenderer callback', () => {
      const rendererSpy = vi.fn();
      const h = new BlorbMultimediaHandler(blorbMap, blorbData, { logger: mockLogger, pictureRenderer: rendererSpy });

      h.displayPicture(1, 10, 20, 100, 3);

      expect(rendererSpy).toHaveBeenCalledWith(1, jpegData, 'JPEG', 10, 20, 100, 3);
    });
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/ui/multimedia/BlorbMultimediaHandler.test.ts`
Expected: FAIL — TypeScript errors on the two 5-argument `displayPicture` calls ("Expected 4 arguments, but got 5"), and the new forwarding test fails at runtime once it compiles (callback never receives a 7th argument).

- [ ] **Step 3: Update the callback type and displayPicture method**

In `src/ui/multimedia/BlorbMultimediaHandler.ts`, replace the `PictureRendererCallback` type (lines 105-112):

```typescript
export type PictureRendererCallback = (
  resourceId: number,
  data: Buffer,
  format: string,
  x: number,
  y: number,
  scale: number,
  window: number
) => void;
```

Replace the `displayPicture` method (lines 263-287):

```typescript
  displayPicture(resourceId: number, x: number, y: number, scale: number, window: number): ResourceStatus {
    if (!this.isResourceAvailable(ResourceType.Picture, resourceId)) {
      this._logger.debug(`Picture ${resourceId} not available for display`);
      return ResourceStatus.NotAvailable;
    }

    if (this._pictureRenderer) {
      const data = BlorbParser.getResource(this._blorbMap, this._blorbData, BlorbUsage.Pict, resourceId);
      const chunkType = BlorbParser.getResourceChunkType(this._blorbMap, BlorbUsage.Pict, resourceId);
      if (data && chunkType) {
        const format =
          chunkType === BlorbChunkType.PNG ? 'PNG' : chunkType === BlorbChunkType.JPEG ? 'JPEG' : chunkType;
        try {
          this._pictureRenderer(resourceId, data, format, x, y, scale, window);
          return ResourceStatus.Available;
        } catch (error) {
          this._logger.error(`Picture ${resourceId} render failed: ${error}`);
          return ResourceStatus.Error;
        }
      }
    }

    this._logger.debug(`Picture ${resourceId} available at (${x},${y}) scale ${scale}% window=${window}`);
    return ResourceStatus.Available;
  }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/unit/ui/multimedia/BlorbMultimediaHandler.test.ts`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Commit**

```bash
git add src/ui/multimedia/BlorbMultimediaHandler.ts tests/unit/ui/multimedia/BlorbMultimediaHandler.test.ts
git commit -m "Forward target window to BlorbMultimediaHandler's pictureRenderer callback"
```

---

### Task 3: Pass the current output window from the `draw_picture` opcode

**Files:**
- Modify: `src/core/opcodes/graphics.ts:65`
- Test: `tests/unit/core/opcodes/multimedia.test.ts` (`'draw_picture opcode'` describe block, plus 6 existing assertions elsewhere in the file)

**Interfaces:**
- Consumes: `MultimediaHandler.displayPicture(resourceId, x, y, scale, window)` from Task 1. `draw_picture` already computes `currentWindow` via `machine.screen.getOutputWindow(machine)` (see `graphics.ts:51`).

- [ ] **Step 1: Add a new failing test asserting the window is forwarded**

In `tests/unit/core/opcodes/multimedia.test.ts`, add this test inside the existing `describe('draw_picture opcode', ...)` block (after the `'should use cursor position when y or x is 0'` test, before its closing `});` at line 145):

```typescript
    it('should pass the current output window to the multimedia handler', () => {
      machine.state.version = 6;
      machine.screen.getOutputWindow.mockReturnValue(3);
      mockMultimediaHandler.displayPicture.mockReturnValue(ResourceStatus.Available);

      draw_picture(machine, [], 1, 200, 100);

      expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 100, 200, 100, 3);
    });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/core/opcodes/multimedia.test.ts -t "should pass the current output window"`
Expected: FAIL — actual call was `(1, 100, 200, 100)` (4 arguments), expected 5.

- [ ] **Step 3: Update the opcode to pass `currentWindow`**

In `src/core/opcodes/graphics.ts`, replace line 65:

```typescript
    const status = machine.multimediaHandler.displayPicture(picture, finalX, finalY, 100, currentWindow);
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `npx vitest run tests/unit/core/opcodes/multimedia.test.ts -t "should pass the current output window"`
Expected: PASS

- [ ] **Step 5: Run the whole file and fix the now-broken existing assertions**

Run: `npx vitest run tests/unit/core/opcodes/multimedia.test.ts`
Expected: 6 pre-existing tests now FAIL, because `displayPicture` is called with an extra `window` argument they don't expect. `machine.screen.getOutputWindow` defaults to `0` (`MockScreen.ts:10`) and none of these 6 tests override it, so append `, 0` to each. Find and replace each exact string below (line numbers shift once Step 1's new test is inserted, so locate these by their unique text, not by line number):

- `expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 100, 200, 100);` → `expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 100, 200, 100, 0);`
- `expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 10, 5, 100);` → `expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 10, 5, 100, 0);`
- `expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 6, 6, 100);` → `expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 6, 6, 100, 0);`
- `expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 25, 15, 100);` → `expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 25, 15, 100, 0);`
- `expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 80, 40, 100);` → `expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 80, 40, 100, 0);`
- `expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 9, 17, 100);` → `expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 9, 17, 100, 0);`

And the end-to-end test that explicitly calls `realScreen.setOutputWindow(machine, 2)`, so its window is `2`, not `0`:

- `expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 209, 59, 100);` → `expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 209, 59, 100, 2);`

- [ ] **Step 6: Run the whole file again to verify everything passes**

Run: `npx vitest run tests/unit/core/opcodes/multimedia.test.ts`
Expected: PASS (all tests in the file)

- [ ] **Step 7: Commit**

```bash
git add src/core/opcodes/graphics.ts tests/unit/core/opcodes/multimedia.test.ts
git commit -m "Pass the current output window from draw_picture to the multimedia handler"
```

---

### Task 4: Render window-0 pictures as inline DOM images in `WebScreen`

**Files:**
- Modify: `examples/web/src/WebScreen.ts:507` (new field, after `_rightPillarX`), `:1253-1301` (`clearWindow`), `:1235-1251` (remove `onWindowPictureDrawn` override), add two new public methods near `trackRightPicture` (`:1199-1206`)

**Interfaces:**
- Produces:
  - `WebScreen.displayInlinePicture(resourceId: number, data: Buffer, format: string, x: number, y: number, scale: number): Promise<void>`
  - `WebScreen.eraseInlinePicture(resourceId: number): boolean` (returns `true` if an inline picture was found and removed)

No automated tests — `examples/web` has no test infrastructure. This task's steps are implementation edits; verification happens manually in Task 6.

- [ ] **Step 1: Add the tracking field**

In `examples/web/src/WebScreen.ts`, immediately after the `_rightPillarX` field declaration (line 507, `private _rightPillarX: number = -1;`), insert:

```typescript

  /**
   * V6 window-0 pictures rendered as inline <img> elements (instead of drawn
   * onto the fixed picture canvas), keyed by resource ID so erase_picture
   * can find and remove them.
   */
  private inlinePictures: Map<number, HTMLImageElement> = new Map();
```

- [ ] **Step 2: Add `displayInlinePicture` and `eraseInlinePicture`**

Immediately after the `trackRightPicture` method (ends at line 1206 with its closing `}`), insert:

```typescript

  /**
   * Insert a V6 window-0 picture as a real inline image in the scrolling
   * text flow, instead of drawing it onto the fixed picture canvas. As real
   * DOM content it scrolls with the surrounding text automatically. Floats
   * within the column the game has already narrowed via set_margins (see
   * applyLowerWindowMarginsCss), so text wraps around it the same way it
   * already wraps around canvas-drawn pictures in other windows.
   */
  async displayInlinePicture(
    resourceId: number,
    data: Buffer,
    format: string,
    x: number,
    _y: number,
    scale: number
  ): Promise<void> {
    const blob = new Blob([new Uint8Array(data).buffer], {
      type: format === 'PNG' ? 'image/png' : 'image/jpeg',
    });
    const bitmap = await createImageBitmap(blob);

    const img = document.createElement('img');
    img.src = URL.createObjectURL(blob);
    img.onload = (): void => URL.revokeObjectURL(img.src);
    img.style.imageRendering = 'pixelated';

    const canvasW = this.pictureCanvas.width;
    if (canvasW === 0) {
      this.mainEl.appendChild(img);
      this.inlinePictures.set(resourceId, img);
      return;
    }

    const scaleFactor = scale / 100;
    const widthPx = bitmap.width * scaleFactor;
    img.style.width = `${(widthPx / canvasW) * 100}%`;
    img.style.height = 'auto';

    const columnLeft = this._window0BaseLeft;
    const columnRight = this._window0BaseRight >= 0 ? this._window0BaseRight : canvasW;
    const columnMid = (columnLeft + columnRight) / 2;

    if (x <= columnMid) {
      img.style.float = 'left';
      img.style.marginLeft = `${(Math.max(0, x - columnLeft) / canvasW) * 100}%`;
    } else {
      img.style.float = 'right';
      img.style.marginRight = `${(Math.max(0, columnRight - (x + widthPx)) / canvasW) * 100}%`;
    }

    this.mainEl.appendChild(img);
    this.inlinePictures.set(resourceId, img);
  }

  /**
   * Remove a previously inserted inline picture (erase_picture for window 0).
   * Returns true if a matching inline picture was found and removed, so the
   * caller can fall back to the canvas eraser for pictures drawn elsewhere.
   */
  eraseInlinePicture(resourceId: number): boolean {
    const img = this.inlinePictures.get(resourceId);
    if (!img) return false;
    img.remove();
    this.inlinePictures.delete(resourceId);
    return true;
  }
```

- [ ] **Step 3: Clear tracked inline pictures alongside `mainEl.innerHTML`**

In `examples/web/src/WebScreen.ts`, in `clearWindow` (lines 1253-1301), each of the three branches that does `this.mainEl.innerHTML = '';` needs `this.inlinePictures.clear();` alongside it, since those DOM nodes are being removed as a side effect and the map must not keep stale references. Replace the three branches (lines 1280-1296):

```typescript
    if (windowId === -1) {
      // Clear both windows and unsplit
      this.mainEl.innerHTML = '';
      this.mainEl.style.paddingTop = '';
      this.inlinePictures.clear();
      this.statusEl.innerHTML = '';
      this.statusEl.style.display = 'none';
      this.statusEl.style.minHeight = '';
      this.upperWindowFontBuffer = [];
    } else if (windowId === -2) {
      // Clear both windows but preserve split state
      this.mainEl.innerHTML = '';
      this.mainEl.style.paddingTop = '';
      this.inlinePictures.clear();
      this.statusEl.innerHTML = '';
      this.upperWindowFontBuffer = [];
    } else if (windowId === 0) {
      this.mainEl.innerHTML = '';
      this.mainEl.style.paddingTop = '';
      this.inlinePictures.clear();
    } else if (windowId === 1) {
      this.statusEl.innerHTML = '';
      this.upperWindowFontBuffer = [];
    }
```

- [ ] **Step 4: Remove the now-obsolete `onWindowPictureDrawn` override**

This override existed solely to work around window-0 pictures living on a fixed canvas underneath scrolling text: it wiped `mainEl.innerHTML` and computed a `paddingTop` hack to push text below where the picture was drawn. With window-0 pictures now real DOM content inserted at the current print position, this would immediately erase the inline image just inserted by `displayInlinePicture` (call order in `graphics.ts`'s `draw_picture` is: `multimediaHandler.displayPicture` — which triggers `displayInlinePicture` — followed by `screen.onWindowPictureDrawn?.(...)`).

In `examples/web/src/WebScreen.ts`, delete the entire `onWindowPictureDrawn` method (lines 1235-1251):

```typescript
  onWindowPictureDrawn(windowId: number, finalY: number, height: number): void {
    if (!this._useCanvasBackground || windowId !== 0) return;
    // Clear any text rendered before this picture (picture covers it in the original interpreter).
    this.mainEl.innerHTML = '';
    // Position text start just below the picture's bottom edge.
    // finalY is 1-based screen-absolute canvas pixel; picture occupies rows finalY..finalY+height-1.
    // Row below picture (0-based) = finalY - 1 + height = finalY + height - 1.
    const canvasAbsY = finalY - 1 + height;
    const lineHeight = this.getStatusBarLineHeight(); // CSS pixels per canvas pixel
    const cssY = canvasAbsY * lineHeight;
    const statusBarCssH = parseFloat(this.statusEl.style.minHeight || '0');
    const paddingTop = Math.max(0, cssY - statusBarCssH);
    this.mainEl.style.paddingTop = `${paddingTop.toFixed(1)}px`;
    this.v6debug(
      `[onWindowPictureDrawn] window=${windowId} finalY=${finalY} h=${height} canvasAbsY=${canvasAbsY} paddingTop=${paddingTop.toFixed(1)}`
    );
  }
```

`Screen.onWindowPictureDrawn` is optional (`src/ui/screen/interfaces.ts:166`) and `BaseScreen` already provides a no-op default (`BaseScreen.ts:982`), so removing this override is safe — `graphics.ts`'s `machine.screen.onWindowPictureDrawn?.(...)` call falls back to that no-op for every window once this override is gone.

- [ ] **Step 5: Type-check**

Run: `cd examples/web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add examples/web/src/WebScreen.ts
git commit -m "Render V6 window-0 pictures as inline DOM images that scroll with text"
```

---

### Task 5: Wire `main.ts` to route window-0 pictures through the new `WebScreen` methods

**Files:**
- Modify: `examples/web/src/main.ts:107-116`

**Interfaces:**
- Consumes: `PictureRendererCallback` with the new `window` parameter (Task 2); `WebScreen.displayInlinePicture` and `WebScreen.eraseInlinePicture` (Task 4).

- [ ] **Step 1: Update the `pictureRenderer` and `pictureEraser` callbacks**

In `examples/web/src/main.ts`, replace lines 107-116:

```typescript
      pictureRenderer: async (resourceId, data, format, x, y, scale, window) => {
        if (window === 0) {
          await webScreen.displayInlinePicture(resourceId, data, format, x, y, scale);
          return;
        }
        // Track right-side pictures synchronously (before async image load) so that
        // the right text boundary is set before any subsequent set_margins opcode runs.
        if (x > pictureCanvas.width / 2) {
          webScreen.trackRightPicture(x);
        }
        await pictureRenderer.displayPicture(resourceId, data, format, x, y, scale);
      },
      pictureEraser: (resourceId) => {
        if (webScreen.eraseInlinePicture(resourceId)) return;
        pictureRenderer.erasePicture(resourceId, webScreen.getBackgroundColor(0));
      },
```

- [ ] **Step 2: Type-check**

Run: `cd examples/web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add examples/web/src/main.ts
git commit -m "Route window-0 pictures to inline DOM rendering in the web example"
```

---

### Task 6: Rebuild and verify with Zork Zero

**Files:** none (build + manual verification only)

- [ ] **Step 1: Run the full `src/` test suite and lint**

Run: `npm test && npm run lint`
Expected: all tests pass; no new lint errors (pre-existing unrelated lint errors in other files, if any, are not this plan's concern).

- [ ] **Step 2: Rebuild the library**

Run: `npm run build`
Expected: builds cleanly — `examples/web` imports the library via `dist/index.js` (aliased in `examples/web/vite.config.ts`), so this step is required for the example app to pick up Tasks 1-3.

- [ ] **Step 3: Start the web example and load Zork Zero**

Run: `cd examples/web && npm run dev`, then open the printed local URL in a browser, load `Zork Zero.z6` + `Zork Zero.blb` (via the "Or folder" picker), and reach the Banquet Hall opening scene.

Expected: the drop-cap letter at the start of the first paragraph and the room icon before "The hall is filled to capacity..." each appear inline with their own paragraph and scroll normally with the text, instead of both landing on top of each other at a fixed position on screen. Text wraps around each image within its narrowed column.

- [ ] **Step 4: Stop the dev server**

Run: `lsof -ti:5173 -sTCP:LISTEN | xargs -r kill` (or whatever port the dev server printed).
