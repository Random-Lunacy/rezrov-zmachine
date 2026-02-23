import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseMultimediaHandler, ResourceStatus, ResourceType } from '../../../../src/ui/multimedia/MultimediaHandler';
import { createMockZMachine } from '../../../mocks';
import { sound_effect } from '../../../../src/core/opcodes/io';
import { draw_picture, erase_picture, picture_data, picture_table } from '../../../../src/core/opcodes/graphics';

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

      expect(machine.logger.error).toHaveBeenCalledWith(
        'Error getting picture data for 1: Error: Test error'
      );
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

      expect(machine.logger.error).toHaveBeenCalledWith(
        'Error processing picture table: Error: Memory error'
      );
    });
  });
});
