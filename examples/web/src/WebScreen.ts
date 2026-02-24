import { BaseScreen, Capabilities, Color, ScreenSize, TextStyle, translateFont3Text, ZMachine } from 'rezrov-zmachine';

/**
 * Map Z-machine color to CSS color.
 */
function colorToCss(color: number): string {
  switch (color) {
    case Color.Black:
      return '#000000';
    case Color.Red:
      return '#cc0000';
    case Color.Green:
      return '#00cc00';
    case Color.Yellow:
      return '#cccc00';
    case Color.Blue:
      return '#0000cc';
    case Color.Magenta:
      return '#cc00cc';
    case Color.Cyan:
      return '#00cccc';
    case Color.White:
      return '#cccccc';
    case Color.Gray:
      return '#808080';
    default:
      return '#e0e0e0';
  }
}

/**
 * Convert true color (15-bit) to hex.
 */
function trueColorToHex(trueColor: number): string {
  const r = (trueColor & 0x1f) * 8;
  const g = ((trueColor >> 5) & 0x1f) * 8;
  const b = ((trueColor >> 10) & 0x1f) * 8;
  const toHex = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export class WebScreen extends BaseScreen {
  private statusEl: HTMLDivElement;
  private mainEl: HTMLDivElement;
  private pictureCanvas: HTMLCanvasElement;
  private cellWidth: number;
  private cellHeight: number;
  private onQuitCallback?: () => void;

  constructor(
    statusEl: HTMLDivElement,
    mainEl: HTMLDivElement,
    pictureCanvas: HTMLCanvasElement,
    options?: { cols?: number; rows?: number; onQuit?: () => void }
  ) {
    super('WebScreen', { logger: undefined });
    this.statusEl = statusEl;
    this.mainEl = mainEl;
    this.pictureCanvas = pictureCanvas;
    this.onQuitCallback = options?.onQuit;
    const { width: cellWidth, height: cellHeight } = this.measureCellDimensions();
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
  }

  private measureCellDimensions(): { width: number; height: number } {
    const measureEl = document.createElement('span');
    measureEl.textContent = 'M';
    measureEl.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;white-space:pre;font:inherit;';
    this.mainEl.appendChild(measureEl);
    const width = measureEl.offsetWidth || 10;
    const height = measureEl.offsetHeight || 16;
    measureEl.remove();
    return { width, height };
  }

  getCapabilities(): Capabilities {
    return {
      hasColors: true,
      hasBold: true,
      hasItalic: true,
      hasReverseVideo: true,
      hasFixedPitch: true,
      hasSplitWindow: true,
      hasDisplayStatusBar: true,
      hasPictures: true,
      hasSound: true,
      hasTimedKeyboardInput: true,
    };
  }

  getSize(): ScreenSize {
    // Use the scroll container (main-content) for dimensions so status bar and
    // upper window use the same width. Fall back to mainEl if parent unavailable.
    const container = this.mainEl.parentElement;
    const width = (container?.clientWidth ?? this.mainEl.clientWidth) || 800;
    const height = (container?.clientHeight ?? this.mainEl.clientHeight) || 400;
    const cols = Math.max(40, Math.floor(width / this.cellWidth));
    const rows = Math.max(10, Math.floor(height / this.cellHeight));
    return { rows, cols };
  }

  protected initializeOutputPosition(): void {
    if (!this.startFromBottom || this.hasReceivedFirstOutput) return;
    this.hasReceivedFirstOutput = true;
  }

  private applyStylesAndColors(str: string): string {
    const windowColors = this.windowColors.get(this.outputWindowId);
    let fg = '#e0e0e0';
    let bg = '#0a0a0a';

    if (windowColors) {
      const fgVal = windowColors.foreground;
      const bgVal = windowColors.background;
      if (fgVal !== Color.Default && fgVal !== Color.Current) {
        fg = fgVal > 15 ? trueColorToHex(fgVal) : colorToCss(fgVal);
      }
      if (bgVal !== Color.Default && bgVal !== Color.Current) {
        bg = bgVal > 15 ? trueColorToHex(bgVal) : colorToCss(bgVal);
      }
    }

    const styles: string[] = [];
    if (this.currentStyles & TextStyle.Bold) styles.push('font-weight:bold');
    if (this.currentStyles & TextStyle.Italic) styles.push('font-style:italic');
    if (this.currentStyles & TextStyle.ReverseVideo) {
      [fg, bg] = [bg, fg];
    }

    const style = `color:${fg};background:${bg};${styles.join(';')}`;
    const parts = str.split('\n').map((line) => escapeHtml(line));
    return parts.map((line) => `<span style="${style}">${line}</span>`).join('<br>');
  }

  private renderStyledUpperWindow(): string {
    const defaultColor = { foreground: Color.Default, background: Color.Default };
    const lines: string[] = [];

    for (let lineIdx = 0; lineIdx < this.upperWindowBuffer.length; lineIdx++) {
      const textLine = this.upperWindowBuffer[lineIdx];
      const styleLine = lineIdx < this.upperWindowStyleBuffer.length ? this.upperWindowStyleBuffer[lineIdx] : [];
      const colorLine = lineIdx < this.upperWindowColorBuffer.length ? this.upperWindowColorBuffer[lineIdx] : [];

      let result = '';
      let runStart = 0;

      while (runStart < textLine.length) {
        const runStyle = runStart < styleLine.length ? styleLine[runStart] : 0;
        const runColor = runStart < colorLine.length ? colorLine[runStart] : defaultColor;

        let runEnd = runStart + 1;
        while (runEnd < textLine.length) {
          const nextStyle = runEnd < styleLine.length ? styleLine[runEnd] : 0;
          const nextColor = runEnd < colorLine.length ? colorLine[runEnd] : defaultColor;
          if (
            nextStyle !== runStyle ||
            nextColor.foreground !== runColor.foreground ||
            nextColor.background !== runColor.background
          ) {
            break;
          }
          runEnd++;
        }

        const runText = escapeHtml(textLine.substring(runStart, runEnd));
        let fg = runColor.foreground > 15 ? trueColorToHex(runColor.foreground) : colorToCss(runColor.foreground);
        let bg = runColor.background > 15 ? trueColorToHex(runColor.background) : colorToCss(runColor.background);
        if (runColor.foreground === Color.Default) fg = '#e0e0e0';
        if (runColor.background === Color.Default) bg = '#0a0a0a';

        if (runStyle & TextStyle.ReverseVideo) [fg, bg] = [bg, fg];
        const st: string[] = [`color:${fg}`, `background:${bg}`];
        if (runStyle & TextStyle.Bold) st.push('font-weight:bold');
        if (runStyle & TextStyle.Italic) st.push('font-style:italic');

        result += `<span style="${st.join(';')}">${runText}</span>`;
        runStart = runEnd;
      }

      lines.push(result);
    }

    return lines.join('<br>');
  }

  print(machine: ZMachine, str: string): void {
    if (this.isMemoryStreamActive()) {
      this.writeToMemoryStream(machine, str);
      return;
    }

    let textToDisplay = str;
    if (this.isCurrentFontFont3()) {
      textToDisplay = translateFont3Text(str);
    }

    if (this.outputWindowId === 0) {
      if (!this.hasReceivedFirstOutput && this.startFromBottom) {
        this.initializeOutputPosition();
        this.hasReceivedFirstOutput = true;
      }

      const styled = this.applyStylesAndColors(textToDisplay);
      const span = document.createElement('span');
      span.innerHTML = styled;
      this.mainEl.appendChild(span);
      // Scroll the parent container (#main-content), not the text div
      const scrollContainer = this.mainEl.parentElement;
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    } else {
      const screenWidth = this.getSize().cols;
      this.writeToUpperWindowBuffer(textToDisplay, screenWidth);

      // Expand status bar if buffer lines exceed the current split height
      // (Beyond Zork positions title page text beyond the split boundary)
      const bufferLines = this.upperWindowBuffer.length;
      const currentMinHeight = Math.round(parseFloat(this.statusEl.style.minHeight || '0') / this.cellHeight);
      if (bufferLines > currentMinHeight) {
        this.statusEl.style.minHeight = `${bufferLines * this.cellHeight}px`;
      }

      this.statusEl.innerHTML = this.renderStyledUpperWindow();
    }
  }

  splitWindow(machine: ZMachine, lines: number): void {
    super.splitWindow(machine, lines);

    if (lines === 0) {
      this.statusEl.style.display = 'none';
    } else {
      this.statusEl.style.display = 'block';
      this.statusEl.style.minHeight = `${lines * this.cellHeight}px`;
    }
  }

  clearWindow(machine: ZMachine, windowId: number): void {
    super.clearWindow(machine, windowId);

    if (windowId === -1) {
      // Clear both windows and unsplit
      this.mainEl.innerHTML = '';
      this.statusEl.innerHTML = '';
      this.statusEl.style.display = 'none';
      this.statusEl.style.minHeight = '';
    } else if (windowId === -2) {
      // Clear both windows but preserve split state
      this.mainEl.innerHTML = '';
      this.statusEl.innerHTML = '';
    } else if (windowId === 0) {
      this.mainEl.innerHTML = '';
    } else if (windowId === 1) {
      this.statusEl.innerHTML = '';
    }
  }

  clearLine(machine: ZMachine, value: number): void {
    super.clearLine(machine, value);
    if (this.outputWindowId === 1) {
      this.statusEl.innerHTML = this.renderStyledUpperWindow();
    }
  }

  updateStatusBar(locationName: string | null, value1: number, value2: number, isTimeMode: boolean): void {
    const width = this.getSize().cols;
    const line = this.formatStatusBarLine(locationName, value1, value2, isTimeMode, width);
    this.statusEl.innerHTML = `<span style="color:#fff;background:#333;">${escapeHtml(line)}</span>`;
  }

  hideCursor(_machine: ZMachine, _windowId: number): void {
    // Cursor visibility handled by input processor
  }

  showCursor(_machine: ZMachine, _windowId: number): void {
    // Cursor visibility handled by input processor
  }

  quit(): void {
    this.onQuitCallback?.();
  }

  getPictureCanvas(): HTMLCanvasElement {
    return this.pictureCanvas;
  }

  getCellDimensions(): { width: number; height: number } {
    return { width: this.cellWidth, height: this.cellHeight };
  }

  /**
   * Resize the upper window buffer for a new screen width and redraw.
   * Called when the viewport size changes.
   */
  handleResize(): void {
    const { cols } = this.getSize();
    const resized = this.resizeUpperWindowBuffer(cols);
    if (resized !== null) {
      this.statusEl.innerHTML = this.renderStyledUpperWindow();
    }
  }

  /**
   * Remeasure cell dimensions after a font size change.
   * Returns the new dimensions for callers that need to update (e.g. PictureRenderer).
   */
  remeasureCellDimensions(): { width: number; height: number } {
    const { width, height } = this.measureCellDimensions();
    this.cellWidth = width;
    this.cellHeight = height;
    return { width, height };
  }
}
