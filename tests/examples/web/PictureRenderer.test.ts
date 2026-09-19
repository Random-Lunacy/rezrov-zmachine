// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PictureRenderer } from '../../../examples/web/src/PictureRenderer';

/** jsdom has no 2d context, so stand one in and record the calls we assert on. */
function makeCanvas(width = 320, height = 200): {
  canvas: HTMLCanvasElement;
  ctx: { drawImage: ReturnType<typeof vi.fn>; fillRect: ReturnType<typeof vi.fn>; fillStyle: string };
} {
  const ctx = { drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: '' };
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext = vi.fn(() => ctx) as unknown as HTMLCanvasElement['getContext'];
  return { canvas, ctx };
}

describe('PictureRenderer', () => {
  beforeEach(() => {
    // createImageBitmap is not implemented in jsdom.
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 40, height: 20 }))
    );
  });

  describe('construction', () => {
    it('should throw when the canvas has no 2d context', () => {
      const canvas = document.createElement('canvas');
      canvas.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
      expect(() => new PictureRenderer(canvas)).toThrow('Could not get 2d context');
    });
  });

  describe('displayPicture', () => {
    it('should convert 1-based V6 pixel coordinates to 0-based canvas coordinates', async () => {
      const { canvas, ctx } = makeCanvas();
      const renderer = new PictureRenderer(canvas);

      await renderer.displayPicture(3, new ArrayBuffer(8), 'PNG', 10, 25, 100);

      expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 9, 24, 40, 20);
    });

    it('should place a picture at the canvas origin for the V6 coordinate (1, 1)', async () => {
      const { canvas, ctx } = makeCanvas();
      const renderer = new PictureRenderer(canvas);

      await renderer.displayPicture(1, new ArrayBuffer(8), 'PNG', 1, 1, 100);

      expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 40, 20);
    });

    it('should apply the scale factor as a percentage of the natural size', async () => {
      const { canvas, ctx } = makeCanvas();
      const renderer = new PictureRenderer(canvas);

      await renderer.displayPicture(1, new ArrayBuffer(8), 'PNG', 1, 1, 50);

      expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 20, 10);
    });

    it('should round fractional scaled dimensions to whole pixels', async () => {
      const { canvas, ctx } = makeCanvas();
      const renderer = new PictureRenderer(canvas);

      // 40 * 0.33 = 13.2 -> 13, 20 * 0.33 = 6.6 -> 7
      await renderer.displayPicture(1, new ArrayBuffer(8), 'PNG', 1, 1, 33);

      expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 13, 7);
    });

    it('should accept a Node Buffer as well as an ArrayBuffer', async () => {
      const { canvas, ctx } = makeCanvas();
      const renderer = new PictureRenderer(canvas);

      await renderer.displayPicture(1, Buffer.from([1, 2, 3, 4]), 'JPEG', 1, 1, 100);

      expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    });
  });

  describe('erasePicture', () => {
    it('should clear exactly the region the picture was drawn into', async () => {
      const { canvas, ctx } = makeCanvas();
      const renderer = new PictureRenderer(canvas);
      await renderer.displayPicture(7, new ArrayBuffer(8), 'PNG', 10, 25, 100);

      renderer.erasePicture(7, '#123456');

      expect(ctx.fillStyle).toBe('#123456');
      expect(ctx.fillRect).toHaveBeenCalledWith(9, 24, 40, 20);
    });

    it('should do nothing for a picture that was never displayed', () => {
      const { canvas, ctx } = makeCanvas();
      const renderer = new PictureRenderer(canvas);

      renderer.erasePicture(99);

      expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('should forget the picture so a second erase is a no-op', async () => {
      const { canvas, ctx } = makeCanvas();
      const renderer = new PictureRenderer(canvas);
      await renderer.displayPicture(7, new ArrayBuffer(8), 'PNG', 10, 25, 100);

      renderer.erasePicture(7);
      renderer.erasePicture(7);

      expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear', () => {
    it('should fill the whole canvas and drop all tracked pictures', async () => {
      const { canvas, ctx } = makeCanvas(320, 200);
      const renderer = new PictureRenderer(canvas);
      await renderer.displayPicture(7, new ArrayBuffer(8), 'PNG', 10, 25, 100);

      renderer.clear('#0a0a0a');
      renderer.erasePicture(7);

      expect(ctx.fillRect).toHaveBeenCalledTimes(1);
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 320, 200);
    });
  });

  describe('resize', () => {
    it('should resize the backing canvas', () => {
      const { canvas } = makeCanvas();
      const renderer = new PictureRenderer(canvas);

      renderer.resize(640, 400);

      expect(canvas.width).toBe(640);
      expect(canvas.height).toBe(400);
    });
  });
});
