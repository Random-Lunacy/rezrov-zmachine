import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draw_picture, erase_picture, picture_data, picture_table } from '../../../../src/core/opcodes/graphics';
import { sound_effect } from '../../../../src/core/opcodes/io';
import { ResourceStatus, ResourceType } from '../../../../src/ui/multimedia/MultimediaHandler';
import { WindowProperty } from '../../../../src/ui/screen/interfaces';
import { HeaderLocation } from '../../../../src/utils/constants';
import { createMockZMachine } from '../../../mocks';

describe('Multimedia Opcodes', () => {
  let machine: any;
  let mockMultimediaHandler: any;

  beforeEach(() => {
    // Create a mock multimedia handler
    mockMultimediaHandler = {
      playSound: vi.fn(),
      displayPicture: vi.fn(),
      erasePicture: vi.fn(),
      getPictureData: vi.fn(),
    };

    // Create a mock Z-Machine with the multimedia handler
    machine = createMockZMachine();
    machine.multimediaHandler = mockMultimediaHandler;
    machine.state.version = 6; // Use V6 for full multimedia support
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('sound_effect opcode', () => {
    it('should call multimedia handler for V5+ games', () => {
      machine.state.version = 5;
      mockMultimediaHandler.playSound.mockReturnValue(ResourceStatus.Available);

      // ARG3=0x0080: count=0 (high byte), volume=128 (low byte)
      sound_effect(machine, [], 1, 2, 0x0080, 0);

      // volume=128 (0x80 & 0xFF), repeats=1 (count=0 defaults to 1)
      expect(mockMultimediaHandler.playSound).toHaveBeenCalledWith(1, 2, 128, 1);
    });

    it('should work for V3 games (sound available from V3)', () => {
      machine.state.version = 3;
      mockMultimediaHandler.playSound.mockReturnValue(ResourceStatus.Available);

      sound_effect(machine, [], 1, 2, 0x0008, 0);

      // V3 sound should not be blocked
      expect(mockMultimediaHandler.playSound).toHaveBeenCalledWith(1, 2, 8, 1);
    });

    it('should handle multimedia handler errors gracefully', () => {
      machine.state.version = 5;
      mockMultimediaHandler.playSound.mockImplementation(() => {
        throw new Error('Test error');
      });

      sound_effect(machine, [], 1, 2, 0x0080, 0);

      expect(machine.logger.error).toHaveBeenCalledWith('Error playing sound effect 1: Test error');
    });

    it('should log success when sound starts', () => {
      machine.state.version = 5;
      mockMultimediaHandler.playSound.mockReturnValue(ResourceStatus.Available);

      sound_effect(machine, [], 1, 2, 0x0080, 0);

      expect(machine.logger.debug).toHaveBeenCalledWith(expect.stringContaining('Sound effect 1 started successfully'));
    });

    it('should log warning when sound fails to start', () => {
      machine.state.version = 5;
      mockMultimediaHandler.playSound.mockReturnValue(ResourceStatus.NotAvailable);

      sound_effect(machine, [], 1, 2, 0x0080, 0);

      expect(machine.logger.warn).toHaveBeenCalledWith('Sound effect 1 failed to start, status: 1');
    });
  });

  describe('draw_picture opcode', () => {
    it('should call multimedia handler for V6+ games with y, x param order', () => {
      machine.state.version = 6;
      mockMultimediaHandler.displayPicture.mockReturnValue(ResourceStatus.Available);

      draw_picture(machine, [], 1, 200, 100);

      // displayPicture(picture, x, y, scale) — note x/y swap from opcode params
      expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 100, 200, 100);
      expect(machine.logger.debug).toHaveBeenCalledWith('draw_picture 1 200 100');
    });

    it('should warn for V5 games', () => {
      machine.state.version = 5;

      draw_picture(machine, [], 1, 100, 200);

      expect(mockMultimediaHandler.displayPicture).not.toHaveBeenCalled();
      expect(machine.logger.warn).toHaveBeenCalledWith('draw_picture not supported in version 5');
    });

    it('should handle multimedia handler errors gracefully', () => {
      machine.state.version = 6;
      mockMultimediaHandler.displayPicture.mockImplementation(() => {
        throw new Error('Test error');
      });

      draw_picture(machine, [], 1, 100, 200);

      expect(machine.logger.error).toHaveBeenCalledWith('Error displaying picture 1: Error: Test error');
    });

    it('should log success when picture displays', () => {
      machine.state.version = 6;
      mockMultimediaHandler.displayPicture.mockReturnValue(ResourceStatus.Available);

      draw_picture(machine, [], 1, 200, 100);

      expect(machine.logger.debug).toHaveBeenCalledWith('Picture 1 displayed at (100, 200)');
    });

    it('should log warning when picture fails to display', () => {
      machine.state.version = 6;
      mockMultimediaHandler.displayPicture.mockReturnValue(ResourceStatus.NotAvailable);

      draw_picture(machine, [], 1, 100, 200);

      expect(machine.logger.warn).toHaveBeenCalledWith('Picture 1 failed to display, status: 1');
    });

    it('should use cursor position when y or x is 0', () => {
      machine.state.version = 6;
      machine.screen.getCursorPosition.mockReturnValue({ line: 5, column: 10 });
      mockMultimediaHandler.displayPicture.mockReturnValue(ResourceStatus.Available);

      draw_picture(machine, [], 1, 0, 0);

      expect(machine.screen.getCursorPosition).toHaveBeenCalled();
      expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 10, 5, 100);
    });
  });

  /**
   * Per spec §8.8.3.1 draw_picture's y/x are window-relative 1-based PIXEL positions,
   * so the opcode converts them to screen-absolute using the current window's top-left.
   *
   * The default mock returns YCoordinate/XCoordinate = 1 and getByte = 0 (fontH/fontW
   * fall back to 1), which makes both conversions the identity — so the tests above
   * cannot distinguish correct arithmetic from none at all. These tests supply a
   * non-trivial window origin and font size so the math is actually exercised.
   */
  describe('draw_picture V6 coordinate conversion', () => {
    /** Place window 0's top-left at canvas pixel (winY, winX), both 1-based. */
    function givenWindowOrigin(winY: number, winX: number): void {
      machine.screen.getWindowProperty.mockImplementation((_m: unknown, _window: number, property: number) => {
        if (property === WindowProperty.YCoordinate) return winY;
        if (property === WindowProperty.XCoordinate) return winX;
        return 0;
      });
    }

    /** Report a square font of `size` screen units, as classic V6 games assume. */
    function givenFontSize(size: number): void {
      machine.memory.getByte.mockImplementation((addr: number) =>
        addr === HeaderLocation.FontHeightInUnits || addr === HeaderLocation.FontWidthInUnits ? size : 0
      );
    }

    beforeEach(() => {
      machine.state.version = 6;
      mockMultimediaHandler.displayPicture.mockReturnValue(ResourceStatus.Available);
    });

    it('should offset window-relative coordinates by the window origin', () => {
      // Zork Zero's typical layout: move_window(0, y=6, x=6).
      givenWindowOrigin(6, 6);

      // (1,1) is the window's own top-left corner...
      draw_picture(machine, [], 1, 1, 1);

      // ...which sits at canvas (6,6), not (1,1). displayPicture takes (picture, x, y, scale).
      expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 6, 6, 100);
    });

    it('should add the window origin to a non-zero offset within the window', () => {
      givenWindowOrigin(6, 6);

      draw_picture(machine, [], 1, 10, 20);

      // finalY = 6 + 10 - 1 = 15, finalX = 6 + 20 - 1 = 25
      expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 25, 15, 100);
    });

    it('should leave coordinates unchanged when the window sits at the screen origin', () => {
      givenWindowOrigin(1, 1);

      draw_picture(machine, [], 1, 40, 80);

      // Guards the off-by-one: window_top + offset - 1 must be identity at origin 1.
      expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 80, 40, 100);
    });

    it('should convert a zero coordinate from cursor char cells back to pixels', () => {
      givenWindowOrigin(1, 1);
      givenFontSize(8);
      // BaseScreen stores V6 cursor positions as char cells, so reverse that here.
      machine.screen.getCursorPosition.mockReturnValue({ line: 3, column: 2 });

      draw_picture(machine, [], 1, 0, 0);

      // finalY = (3-1)*8 + 1 = 17, finalX = (2-1)*8 + 1 = 9
      expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 9, 17, 100);
    });

    it('should notify the screen of the drawn picture with absolute Y and height', () => {
      givenWindowOrigin(6, 6);
      machine.screen.getOutputWindow.mockReturnValue(0);
      machine.screen.onWindowPictureDrawn = vi.fn();
      mockMultimediaHandler.getPictureData.mockReturnValue({ height: 40, width: 100 });

      draw_picture(machine, [], 1, 10, 20);

      // Screen needs the absolute Y (15), not the raw window-relative 10,
      // so it can flow HTML text below the picture.
      expect(machine.screen.onWindowPictureDrawn).toHaveBeenCalledWith(0, 15, 40);
    });

    it('should not notify the screen when picture dimensions are unavailable', () => {
      givenWindowOrigin(6, 6);
      machine.screen.onWindowPictureDrawn = vi.fn();
      mockMultimediaHandler.getPictureData.mockReturnValue(undefined);

      draw_picture(machine, [], 1, 10, 20);

      expect(machine.screen.onWindowPictureDrawn).not.toHaveBeenCalled();
    });
  });

  describe('erase_picture opcode', () => {
    it('should call multimedia handler for V6+ games', () => {
      machine.state.version = 6;
      mockMultimediaHandler.erasePicture.mockReturnValue(ResourceStatus.Available);

      erase_picture(machine, [], 1);

      expect(mockMultimediaHandler.erasePicture).toHaveBeenCalledWith(1);
      expect(machine.logger.debug).toHaveBeenCalledWith('erase_picture 1 0 0');
    });

    it('should warn for V5 games', () => {
      machine.state.version = 5;

      erase_picture(machine, [], 1);

      expect(mockMultimediaHandler.erasePicture).not.toHaveBeenCalled();
      expect(machine.logger.warn).toHaveBeenCalledWith('erase_picture not supported in version 5');
    });

    it('should handle multimedia handler errors gracefully', () => {
      machine.state.version = 6;
      mockMultimediaHandler.erasePicture.mockImplementation(() => {
        throw new Error('Test error');
      });

      erase_picture(machine, [], 1);

      expect(machine.logger.error).toHaveBeenCalledWith('Error erasing picture 1: Error: Test error');
    });

    it('should log success when picture erases', () => {
      machine.state.version = 6;
      mockMultimediaHandler.erasePicture.mockReturnValue(ResourceStatus.Available);

      erase_picture(machine, [], 1);

      expect(machine.logger.debug).toHaveBeenCalledWith('Picture 1 erased');
    });

    it('should log warning when picture fails to erase', () => {
      machine.state.version = 6;
      mockMultimediaHandler.erasePicture.mockReturnValue(ResourceStatus.NotAvailable);

      erase_picture(machine, [], 1);

      expect(machine.logger.warn).toHaveBeenCalledWith('Picture 1 failed to erase, status: 1');
    });
  });

  describe('picture_data opcode', () => {
    beforeEach(() => {
      machine.state.readBranchOffset = vi.fn().mockReturnValue([10, false]);
      machine.state.doBranch = vi.fn();
      machine.memory.setWord = vi.fn();
    });

    it('should store height/width and branch true when picture available', () => {
      machine.state.version = 6;
      mockMultimediaHandler.getPictureData.mockReturnValue({
        width: 100,
        height: 200,
        format: 'PNG',
        hasTransparency: false,
      });

      picture_data(machine, [], 1, 0x2000);

      expect(mockMultimediaHandler.getPictureData).toHaveBeenCalledWith(1);
      expect(machine.memory.setWord).toHaveBeenCalledWith(0x2000, 200); // height
      expect(machine.memory.setWord).toHaveBeenCalledWith(0x2002, 100); // width
      expect(machine.state.doBranch).toHaveBeenCalledWith(true, false, 10);
    });

    it('should branch false for V5 games', () => {
      machine.state.version = 5;

      picture_data(machine, [], 1, 0x2000);

      expect(mockMultimediaHandler.getPictureData).not.toHaveBeenCalled();
      expect(machine.state.doBranch).toHaveBeenCalledWith(false, false, 10);
    });

    it('should handle multimedia handler errors and branch false', () => {
      machine.state.version = 6;
      mockMultimediaHandler.getPictureData.mockImplementation(() => {
        throw new Error('Test error');
      });

      picture_data(machine, [], 1, 0x2000);

      expect(machine.logger.error).toHaveBeenCalledWith('Error getting picture data for 1: Error: Test error');
      expect(machine.state.doBranch).toHaveBeenCalledWith(false, false, 10);
    });

    it('should branch false when picture data is not available', () => {
      machine.state.version = 6;
      mockMultimediaHandler.getPictureData.mockReturnValue(null);

      picture_data(machine, [], 1, 0x2000);

      expect(machine.state.doBranch).toHaveBeenCalledWith(false, false, 10);
    });
  });

  describe('picture_table opcode', () => {
    beforeEach(() => {
      mockMultimediaHandler.preloadResources = vi.fn();
    });

    it('should parse table and preload pictures for V6+ games', () => {
      machine.state.version = 6;
      // Set up memory: table at 0x1000 with picture IDs 5, 10, 0 (terminator)
      machine.memory.getWord = vi.fn().mockImplementation((addr: number) => {
        if (addr === 0x1000) return 5;
        if (addr === 0x1002) return 10;
        return 0; // terminator
      });

      picture_table(machine, [], 0x1000);

      expect(mockMultimediaHandler.preloadResources).toHaveBeenCalledWith([
        { type: ResourceType.Picture, id: 5 },
        { type: ResourceType.Picture, id: 10 },
      ]);
    });

    it('should warn for V5 games', () => {
      machine.state.version = 5;

      picture_table(machine, [], 0x1000);

      expect(machine.logger.warn).toHaveBeenCalledWith('picture_table not supported in version 5');
    });

    it('should cancel preloading when table is 0', () => {
      machine.state.version = 6;

      picture_table(machine, [], 0);

      expect(machine.logger.debug).toHaveBeenCalledWith('Picture preloading cancelled');
    });

    it('should handle errors gracefully', () => {
      machine.state.version = 6;
      machine.memory.getWord = vi.fn().mockImplementation(() => {
        throw new Error('Memory error');
      });

      expect(() => {
        picture_table(machine, [], 0x1000);
      }).not.toThrow();

      expect(machine.logger.error).toHaveBeenCalledWith('Error processing picture table: Error: Memory error');
    });
  });
});
