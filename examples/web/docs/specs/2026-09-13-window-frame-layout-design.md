# Design: Per-window CSS frames for V6 canvas layout

## Goal

In V6 canvas mode (`WebScreen.enableCanvasBackground()`), each Z-machine
window has a real on-canvas box: an origin and size in canvas pixels,
set via `move_window`/`resize_window` and tracked generically by
`WindowManager` for any window ID. Today `WebScreen` never turns that
box into a real DOM box. Instead:

- `#main-content` (window 0's text) is a flex child that always spans
  the *entire* game area, full width, docked at the top. The window's
  actual left/right/top boundaries are faked with CSS padding computed
  as a percentage of the *full canvas width* — approximately right when
  the container happens to already span the full canvas, wrong once it
  shouldn't.
- `#status-bar` (window 1) is likewise a flex child, always full width,
  positioned at the top only because it happens to be the first child
  and no window has yet asked to be anywhere else.

Confirmed against a live Zork Zero trace: `move_window(0, y=40, x=44)`
+ `window_size(0, h=161, w=234)` place window 0's true box at
left=43px, top=39px, width=234px (right edge 277px) on a 320×200
canvas — exactly the interior column between two ~43px decorative
pillars. `window_size(1, h=39, w=320)` places window 1 as the full-width
39px-tall header strip above it. These tracked values are already
correct; nothing here changes how they're computed.

Symptoms this fixes, all from the same root cause:
- Body text sliding under/behind the header banner picture regardless
  of scroll position (no structural top clip existed).
- The scroll container's scrollbar rendering at the far right edge of
  the whole game surface, past the right pillar (the scrolling element
  was never narrowed to the interior column).
- Left/right text margins reading as too wide (percentages computed
  against the full canvas width, applied to a box that should be
  narrower).
- Sets up correct positioning for status-bar content that occupies
  more than one region of the header banner (e.g. room name/moves in a
  left segment, location/score in a right segment) — today those are
  columns within one flat full-width buffer with no box of their own
  to anchor to.

## Approach

Add a single generic mechanism — "compute a window's on-canvas frame,
apply it as a real CSS box" — and use it for every window currently
producing output, instead of one-off tracking fields
(`_window0BaseLeft/Right/Top`) and heuristics
(`trackRightPicture`/`_rightPillarX`) that approximate the same
boundaries a different, less reliable way.

Two alternatives were considered and set aside:

- **Keep the padding-based approximation, just recompute percentages
  against the right base width.** Fixes the margin-width symptom but
  not the header-overlap or scrollbar symptoms — padding cannot produce
  a hard clip or move where a scrollbar renders; both require the
  element's own box (position/size), not its content-box padding.
- **Track pillar/header boundaries via picture-drawing heuristics
  (extending `trackRightPicture` to also infer the top and left
  edges).** This is the diagnostic path this bug was found through, and
  it is strictly worse than trusting `resize_window`'s own width/height:
  it depends on incidental facts about which pictures the game happens
  to draw and how tall they are, breaks for games with a different
  visual layout, and is redundant with data the interpreter already
  has (confirmed above: 43 + 234 = 277, exactly the right pillar's left
  edge, already tracked and correct).

## Changes

Scope: `examples/web` only (`WebScreen.ts`, `main.ts`, `index.html`).
No `src/` changes — `WindowManager` already tracks per-window
`x/y/width/height` generically for any window ID; this only changes how
`WebScreen` renders that state as DOM.

### 1. One scale factor

`#game-container`'s height is already forced to preserve the canvas's
native aspect ratio (`main.ts`, on load: `gameContainer.style.height =
rect.width * nativeH / nativeW`), and the canvas is stretched 100%×100%
into it. X and Y therefore always scale identically. Add
`getCanvasScale(): number` (CSS px per canvas px) to `WebScreen`,
replacing the Y-only `getStatusBarLineHeight()` calculation
(`cssContainerH / canvasH`) as the single source of scale. Existing
callers of `getStatusBarLineHeight()` (status bar sizing, font-3 bitmap
sizing) switch to `getCanvasScale()`; the method is removed once no
callers remain.

### 2. `computeWindowFrame(windowId)`

New private method on `WebScreen`:

```ts
private computeWindowFrame(windowId: number): { left: number; top: number; width: number; height: number } {
  const scale = this.getCanvasScale();
  const left = this.windowManager.getWindowProperty(windowId, WindowProperty.XCoordinate) - 1;
  const top = this.windowManager.getWindowProperty(windowId, WindowProperty.YCoordinate) - 1;
  const width = this.windowManager.getWindowProperty(windowId, WindowProperty.XSize);
  const height = this.windowManager.getWindowProperty(windowId, WindowProperty.YSize);
  return { left: left * scale, top: top * scale, width: width * scale, height: height * scale };
}
```

(`XCoordinate`/`YCoordinate` are 1-based per existing convention
elsewhere in this file — see `draw_picture`'s `finalX`/`finalY` — hence
the `- 1`.) Pure function of `WindowManager` state; takes no window-0-
specific parameters, so it works for any window ID a game uses.

### 3. Apply the frame as a real box

New private method `applyWindowFrame(el: HTMLElement, windowId: number,
{ scroll: boolean })`: reads `computeWindowFrame(windowId)` and sets
`el.style.{position: 'absolute', left, top, width, height}` in CSS px.
When `scroll` is true it also sets `overflowY: 'auto'; overflowX:
'hidden'`; otherwise `overflow: 'hidden'`.

- **`#main-content`** (window 0): becomes `position: absolute` (was a
  flex child of `#game-container`) and gets its frame applied with
  `scroll: true`. `#text-output` inside it keeps `white-space: pre-wrap`
  etc. unchanged — it's the scrolling content, `#main-content` is now
  the clipped viewport. `padding: 0` stays; margins from `set_margins`
  become the only padding source (see below).
- **`#status-bar`** (window 1, and generically any non-zero window
  found producing output — see §5): becomes `position: absolute` and
  gets its frame applied with `scroll: false`.
- `#game-container` stays `position: relative` (unchanged) so these
  absolute boxes anchor to it, matching the existing canvas
  (`#picture-layer`, `position: absolute; top: 0; left: 0`).
- **`#input-line` must also change.** It is not part of the Z-machine
  window model at all — it's browser-UI chrome this example bolts on
  below the game canvas, transparent, currently kept in place only
  because it's a flex sibling of `#main-content`/`#status-bar` (its
  own height plus `#main-content`'s `flex: 1` exactly fill
  `#game-container`'s fixed, aspect-locked height today). Once the
  other two children leave flex flow, `#input-line` becomes the sole
  flex child and would render at the *top* of the container — a real
  regression, not a hypothetical. Fix: give `#input-line` `position:
  absolute; left: 0; right: 0; bottom: 0` (pinned to the container's
  bottom, sized by its own content as today), and have
  `applyWindowFrame` clip a computed frame's bottom edge so it never
  extends past `#input-line`'s top (`Math.min(frame.top + frame.height,
  inputLineTop) - frame.top`). This is a general clip in
  `applyWindowFrame`, not window-0-specific logic — it happens to only
  affect window 0 today because window 0 is the only frame currently
  reaching the bottom of the canvas.

Recompute and reapply a window's frame whenever its box could have
changed: `moveWindow`, `resizeWindow`, and `splitWindow` (window 1's
frame depends on the split height) overrides, plus once from
`enableCanvasBackground()` for the initial state.

### 4. Margins become box-relative padding

`applyLowerWindowMarginsCss(left, right)` currently computes
`paddingLeft`/`paddingRight` as percentages of the *full canvas width*,
combining the window's own left/right offset (`_window0BaseLeft`,
`_window0BaseRight`) with the `set_margins` values, because
`#main-content` didn't yet have its own correctly-sized box to be
relative to.

Once `#main-content` *is* window 0's real, correctly-sized box, the
window's own offset is no longer part of this calculation — it's
already expressed by the box's position/size. This method simplifies
to setting `paddingLeft`/`paddingRight` directly from the `set_margins`
values only, either in px or as a percentage of the box's own width
(both work now that the box width is correct; px is simpler and
avoids a rounding indirection, so prefer px). Same simplification
applies to `displayInlinePicture`'s column-width math
(`columnLeft`/`columnRight`), which currently reconstructs the column
from `_window0BaseLeft`/`_window0BaseRight` — once `#main-content`'s
own `clientWidth` is directly the column width, that reconstruction is
unnecessary; percentages resolve against `#main-content`'s own box.

`setCursorPosition`'s existing padding-top-below-a-picture mechanism
(pushing the first line of text below a top illustration drawn within
window 0) needs no logic change, only simplification: `canvasAbsY`
currently computes a screen-absolute canvas Y and subtracts the status
bar's CSS height to get a padding value relative to `#main-content`'s
current (wrong, full-height) box. Once `#main-content`'s own top is
already the window's correct top, the padding is just the position
*within the window*, i.e. `(line - 1) * getCanvasScale()` directly, no
subtraction needed. This was previously suspected of being unfixable
because padding-top cancels out of the visible-position formula once
auto-scroll-to-bottom is active for content taller than the viewport —
that analysis was correct for *keeping* padding applied for the window's
lifetime, but this padding is only ever meant to matter for the first
line printed after a window resize/picture (positioning it below the
picture); once enough content accumulates to scroll, natural
scroll-to-bottom behavior correctly carries that first (padded) line
off the top of the viewport along with everything else — which is the
desired behavior, not a bug. The fix here is giving `#main-content` the
right box, not the padding-top mechanism itself.

### 5. Generic across window IDs

`applyWindowFrame` and `computeWindowFrame` take a `windowId` parameter
and contain no window-0- or window-1-specific logic. Call sites decide
*which* windows get a managed DOM frame:

- Window 0 always does (`#main-content`).
- Window 1 always does (`#status-bar`) — it's the element that already
  exists for status/header text.
- Any other window ID that calls `setOutputWindow`/prints text while
  `_useCanvasBackground` is true is out of scope for *this* change:
  `BaseScreen`'s content model funnels all non-zero-window output into
  the single `upperWindowBuffer` rendered into `#status-bar` regardless
  of window ID (confirmed: Zork Zero's header uses window 1 only, with
  room-name/moves and location/score as two cursor-positioned columns
  within that one buffer — not separate windows). Framing additional
  physical DOM elements per non-zero window would require restructuring
  `BaseScreen`'s shared upper-window content model, which is bigger
  than this bug warrants and affects the console/blessed-console
  examples too. If a future game is found to use a second non-zero
  window for text, that's a follow-up spec.

### 6. Remove the now-redundant pillar heuristic

`_rightPillarX` and `trackRightPicture` (`WebScreen.ts`) and their call
site in `main.ts`'s picture-drawing path are deleted. They existed to
approximate window 0's right boundary from incidental picture
positions; `resize_window`'s own tracked width is the same boundary,
already correct, and is what `computeWindowFrame` uses directly.

## Error handling

No new failure modes: `computeWindowFrame` reads already-validated
`WindowManager` state (clamped/defaulted there today) and pure
arithmetic. If `getCanvasScale()` is called before the canvas has a
laid-out size (0×0), it returns `0`, `applyWindowFrame` would collapse
the box to `0×0` — matches today's existing early-layout guards
elsewhere in this file (e.g. `applyLowerWindowMarginsCss`'s `canvasW
=== 0` early return); add the same guard to `applyWindowFrame`.

## Testing

`examples/web` has no automated test infrastructure (confirmed in the
prior inline-pictures spec; still true). Verify manually with
Playwright against Zork Zero, per the pattern already used earlier in
this investigation (`verify-margins.mjs`-style scripts in the session
scratchpad):

1. Screenshot comparison against the sfrotz reference at the Banquet
   Hall scene: header banner not overlapped by body text at any scroll
   position (scroll to the bottom, confirm), text column flush between
   the pillars, scrollbar rendering at the interior column's right edge
   (not the canvas's right edge).
2. Direct DOM measurement (`getBoundingClientRect`) confirming
   `#main-content`'s box matches `computeWindowFrame(0)`'s expected
   values, and likewise for `#status-bar`/window 1. Also confirm
   `#input-line` still renders pinned to the bottom of `#game-container`
   (not at the top) and that `#main-content`'s bottom edge sits at or
   above `#input-line`'s top with no overlap.
3. Play forward far enough to exercise `resize_window`/`move_window`
   being called again after the initial layout (e.g. entering a room
   with a differently-sized inline picture area) and confirm the frame
   updates rather than sticking to the first computed box.
4. Re-verify the earlier fixes still hold: inline pictures flush left
   at the correct column position, drop-cap icon rendering, padding
   between inline images and body text.

## Out of scope

- Restructuring `BaseScreen`'s shared upper-window content model to
  support multiple simultaneous non-zero text windows with independent
  DOM frames (see §5). Only needed if a game is found to require it.
- Any change to non-V6 (text-only) rendering — all of this is gated on
  `_useCanvasBackground`.
- Picture placement/scaling logic itself (covered by the prior inline-
  pictures spec and the `picture_data` 0×0-Rect fix); this spec only
  changes where the *containers* those pictures and text live in are
  positioned.
