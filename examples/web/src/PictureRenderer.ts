/**
 * Renders Blorb pictures to an HTML canvas.
 * Maps Z-machine V6 pixel coordinates directly to canvas pixel positions.
 *
 * In V6, draw_picture passes (x, y) as 1-based pixel coordinates where
 * x is horizontal (column) and y is vertical (row). No cell-based scaling
 * is applied — the values are already in the canvas's pixel space.
 */
export class PictureRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly displayedPictures: Map<number, { x: number; y: number; width: number; height: number }> = new Map();
  /**
   * Canvas operations run one at a time, in the order the game issued them. Pictures decode
   * asynchronously, and drawing each one as soon as it decoded let a slow full-screen picture
   * land on top of smaller ones requested after it: Zork Zero's Tower of Bozbar border covered
   * the weights. Erases and fills must wait their turn too, or a pending draw undoes them.
   */
  private queue: Promise<void> = Promise.resolve();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2d context');
    }
    this.ctx = ctx;
  }

  /**
   * Draw a picture at the given Z-machine V6 coordinates.
   * x is horizontal position (1-based pixel column from window left).
   * y is vertical position (1-based pixel row from window top).
   */
  displayPicture(
    resourceId: number,
    data: ArrayBuffer | Buffer,
    format: string,
    x: number,
    y: number,
    scale: number
  ): Promise<void> {
    const arrayBuffer = data instanceof ArrayBuffer ? data : new Uint8Array(data).buffer;
    const blob = new Blob([arrayBuffer], {
      type: format === 'PNG' ? 'image/png' : 'image/jpeg',
    });

    // Start decoding now, alongside any pictures still in the queue; only the drawing waits
    const decoded = createImageBitmap(blob);
    decoded.catch(() => undefined); // Reported when the queued draw awaits it

    return this.enqueue(async (ctx) => {
      const bitmap = await decoded;

      const scaleFactor = scale / 100;
      const width = Math.round(bitmap.width * scaleFactor);
      const height = Math.round(bitmap.height * scaleFactor);

      // V6: x (column/horizontal) and y (row/vertical) are 1-based pixel coordinates.
      // Subtract 1 to convert to 0-based canvas coordinates.
      const pixelX = x - 1;
      const pixelY = y - 1;

      ctx.drawImage(bitmap, pixelX, pixelY, width, height);
      this.displayedPictures.set(resourceId, { x: pixelX, y: pixelY, width, height });
    });
  }

  /**
   * Erase a displayed picture by clearing its region.
   */
  erasePicture(resourceId: number, clearColor: string = '#0a0a0a'): Promise<void> {
    return this.enqueue((ctx) => {
      const info = this.displayedPictures.get(resourceId);
      if (info) {
        ctx.fillStyle = clearColor;
        ctx.fillRect(info.x, info.y, info.width, info.height);
        this.displayedPictures.delete(resourceId);
      }
    });
  }

  /**
   * Clear the entire canvas.
   */
  clear(clearColor: string = '#0a0a0a'): Promise<void> {
    return this.enqueue((ctx) => {
      ctx.fillStyle = clearColor;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.displayedPictures.clear();
    });
  }

  /**
   * Fill a canvas-pixel rectangle (the whole canvas if omitted) with a colour, in turn with
   * the pictures. Pictures inside the area stay tracked, as before, so a later erase still works.
   */
  fill(color: string, rect?: { x: number; y: number; width: number; height: number }): Promise<void> {
    return this.enqueue((ctx) => {
      ctx.fillStyle = color;
      const r = rect ?? { x: 0, y: 0, width: this.canvas.width, height: this.canvas.height };
      ctx.fillRect(r.x, r.y, r.width, r.height);
    });
  }

  /** Run a canvas operation after every one queued before it; a failure doesn't stop the rest. */
  private enqueue(op: (ctx: CanvasRenderingContext2D) => void | Promise<void>): Promise<void> {
    const run = this.queue.then(() => op(this.ctx));
    this.queue = run.catch(() => undefined);
    return run;
  }

  /**
   * Resize the canvas to match the content area.
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }
}
