/**
 * Renders Blorb pictures to an HTML canvas.
 * Maps Z-machine line/column coordinates to pixel positions.
 */
export class PictureRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private cellWidth: number;
  private cellHeight: number;
  private displayedPictures: Map<number, { x: number; y: number; width: number; height: number }> = new Map();

  constructor(canvas: HTMLCanvasElement, cellWidth: number, cellHeight: number) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2d context');
    }
    this.ctx = ctx;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
  }

  /**
   * Draw a picture at the given Z-machine coordinates.
   * x and y are 1-based line/column from the Z-machine.
   */
  async displayPicture(
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

    const bitmap = await createImageBitmap(blob);

    const scaleFactor = scale / 100;
    const width = Math.round(bitmap.width * scaleFactor);
    const height = Math.round(bitmap.height * scaleFactor);

    const pixelX = (y - 1) * this.cellWidth;
    const pixelY = (x - 1) * this.cellHeight;

    this.ctx.drawImage(bitmap, pixelX, pixelY, width, height);
    this.displayedPictures.set(resourceId, { x: pixelX, y: pixelY, width, height });
  }

  /**
   * Erase a displayed picture by clearing its region.
   */
  erasePicture(resourceId: number, clearColor: string = '#0a0a0a'): void {
    const info = this.displayedPictures.get(resourceId);
    if (info) {
      this.ctx.fillStyle = clearColor;
      this.ctx.fillRect(info.x, info.y, info.width, info.height);
      this.displayedPictures.delete(resourceId);
    }
  }

  /**
   * Clear the entire canvas.
   */
  clear(clearColor: string = '#0a0a0a'): void {
    this.ctx.fillStyle = clearColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.displayedPictures.clear();
  }

  /**
   * Resize the canvas to match the content area.
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Update cell dimensions after a font size change.
   */
  updateCellDimensions(cellWidth: number, cellHeight: number): void {
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
  }
}
