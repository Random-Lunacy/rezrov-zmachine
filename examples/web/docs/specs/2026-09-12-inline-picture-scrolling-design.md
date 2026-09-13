# Design: Inline pictures that scroll with window-0 text

## Goal

V6 games draw small pictures (a drop-cap letter, a room icon) inline with
the running body text in window 0, the main scrolling text window.
Pictures drawn into window 0 must scroll with the text they were printed
alongside, and body text must wrap around them the way it does in
reference V6 interpreters, rather than the picture staying fixed while
unrelated later text passes behind/through it.

Scope is window 0 only. Picture placement in the header/status window
(1/7) is a separate concern, out of scope here.

## Approach

Render window-0 pictures as real inline `<img>` elements inserted into the
`#text-output` DOM flow at the moment `draw_picture` fires, rather than
drawing them onto the fixed picture canvas used for other windows. As real
DOM content, they scroll with the surrounding text via normal browser
layout — no scroll-offset tracking or picture-history redraw logic needed.

Text wrapping reuses the margin mechanism games already drive via
`set_margins` (narrowing the text column around a picture), which
`WebScreen.applyLowerWindowMarginsCss` turns into CSS padding on
`#main-content`. The image only needs to float within that column; it
does not need to compute its own wrapping.

Two alternatives were considered and set aside:

- **Canvas + tracked scroll offset**: keep pictures on the canvas, track
  each window's scroll position, and redraw/shift previously-drawn
  pictures on every scroll event. Requires maintaining per-window picture
  history and repainting on scroll (perf/flicker risk), and still needs a
  separate mechanism for text wrapping.
- **Absolutely-positioned DOM images, repositioned via a scroll listener**:
  more pixel-exact than the chosen approach, but needs per-image
  scroll-event handling and, like the above, no wrapping for free.

Inline DOM insertion is the smallest change and the closest match to how
reference interpreters behave, where a window is one raster surface on
which text and pictures scroll together.

## Changes

### 1. Thread the window number through `displayPicture` (`src/`)

`MultimediaHandler.displayPicture` needs to tell its caller which window a
picture targets, so `examples/web` can route window-0 pictures
differently. Add a `window` parameter end to end:

- `src/ui/multimedia/MultimediaHandler.ts` — `displayPicture(resourceId, x, y, scale, window)`.
- `src/ui/multimedia/BlorbMultimediaHandler.ts` — pass `window` through to
  the `pictureRenderer` callback; update the `PictureRendererCallback` type.
- `src/core/opcodes/graphics.ts` — `draw_picture` already computes
  `currentWindow`; pass it into `machine.multimediaHandler.displayPicture(...)`.

This is additive. Existing tests for `draw_picture` and
`BlorbMultimediaHandler` get extended (not rewritten) to assert the window
number flows through correctly, following TDD as usual for `src/` changes.

### 2. Route window-0 pictures to the DOM instead of the canvas (`examples/web`)

- **`WebScreen`**: add `displayInlinePicture(resourceId, data, format, scale)`.
  Builds a `Blob`/object URL from the raw picture bytes, creates an
  `<img>`, and appends it to `mainEl` (`#text-output`) at the current end
  of its content — i.e., wherever the print stream currently is. Tracked
  in a new `Map<number, HTMLImageElement>` (mirroring
  `PictureRenderer.displayedPictures`) so `erase_picture` can find and
  remove it later.

- **Sizing**: follow the existing percentage-of-canvas-width convention
  already used for margins (`applyLowerWindowMarginsCss`) rather than
  introducing a new canvas-px-to-CSS-px scale factor. Set the image's CSS
  `width` as `(pictureWidthPx / canvasWidth) * 100` and `height: auto` to
  preserve aspect ratio.

- **Float direction**: reuse the margin state `WebScreen` already tracks
  (`_window0BaseLeft` / `_window0BaseRight`). Compare the picture's X to
  the midpoint of that column; float left or right accordingly, with
  `margin-left`/`margin-right` (also as `%`) filling the gap to the
  picture's actual X offset. No new state.

- **`main.ts` wiring**: the `pictureRenderer` callback passed to
  `BlorbMultimediaHandler` branches on the new `window` parameter —
  `window === 0` calls `webScreen.displayInlinePicture(...)`; any other
  window keeps the existing canvas path (`pictureRenderer.displayPicture`,
  `trackRightPicture`) unchanged. The `pictureEraser` callback checks
  `WebScreen`'s new inline-image map first (DOM removal via `.remove()`)
  before falling back to the canvas eraser.

- **`clear_window(0)`**: no new code needed. `WebScreen.clearWindow`
  already does `mainEl.innerHTML = ''` for window 0, which removes any
  inline images as a side effect; the tracking map just needs clearing
  alongside it so stale entries don't leak.

## Error handling

Mirrors the existing canvas path: if the image data fails to decode, the
error propagates to `BlorbMultimediaHandler.displayPicture`'s existing
try/catch, which logs via `this._logger.error` and returns
`ResourceStatus.Error`. No new error-handling pattern is introduced.

## Testing

- **`src/` changes**: proper unit tests, TDD, extending the existing
  patterns in `tests/unit/ui/multimedia/BlorbMultimediaHandler.test.ts` and
  `tests/unit/core/opcodes/multimedia.test.ts` to assert the window number
  reaches the `pictureRenderer` callback correctly.
- **`examples/web` changes**: this package has no test infrastructure today
  (no `.test.ts` files, no vitest config) — it's a demo app verified
  manually. Verify by loading a V6 game with inline window-0 pictures
  (e.g. Zork Zero) and confirming each inline picture scrolls with its own
  paragraph instead of stacking at a fixed position.

## Out of scope

- Picture placement in the header/status window (1 and 7).
- Any change to non-V6 picture handling, or to windows other than 0.
