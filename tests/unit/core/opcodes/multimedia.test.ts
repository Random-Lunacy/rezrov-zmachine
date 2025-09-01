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

      sound_effect(machine, [], 1, 2, 128, 0);

      expect(mockMultimediaHandler.playSound).toHaveBeenCalledWith(1, 2, 128, 1);
      expect(machine.logger.debug).toHaveBeenCalledWith(expect.stringContaining('sound_effect 1 2 128 0'));
    });

    it('should warn for V3 games', () => {
      machine.state.version = 3;

      sound_effect(machine, [], 1, 2, 128, 0);

      expect(mockMultimediaHandler.playSound).not.toHaveBeenCalled();
      expect(machine.logger.warn).toHaveBeenCalledWith('sound_effect not supported in version 3');
    });

    it('should handle multimedia handler errors gracefully', () => {
      machine.state.version = 5;
      mockMultimediaHandler.playSound.mockImplementation(() => {
        throw new Error('Test error');
      });

      sound_effect(machine, [], 1, 2, 128, 0);

      expect(machine.logger.error).toHaveBeenCalledWith('Error playing sound effect 1: Error: Test error');
    });

    it('should log success when sound starts', () => {
      machine.state.version = 5;
      mockMultimediaHandler.playSound.mockReturnValue(ResourceStatus.Available);

      sound_effect(machine, [], 1, 2, 128, 0);

      expect(machine.logger.debug).toHaveBeenCalledWith(expect.stringContaining('Sound effect 1 started successfully'));
    });

    it('should log warning when sound fails to start', () => {
      machine.state.version = 5;
      mockMultimediaHandler.playSound.mockReturnValue(ResourceStatus.NotAvailable);

      sound_effect(machine, [], 1, 2, 128, 0);

      expect(machine.logger.warn).toHaveBeenCalledWith('Sound effect 1 failed to start, status: 1');
    });
  });

  describe('draw_picture opcode', () => {
    it('should call multimedia handler for V6+ games', () => {
      machine.state.version = 6;
      mockMultimediaHandler.displayPicture.mockReturnValue(ResourceStatus.Available);

      draw_picture(machine, [], 1, 100, 200);

      expect(mockMultimediaHandler.displayPicture).toHaveBeenCalledWith(1, 100, 200, 100);
      expect(machine.logger.debug).toHaveBeenCalledWith('draw_picture 1 100 200');
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

      draw_picture(machine, [], 1, 100, 200);

      expect(machine.logger.debug).toHaveBeenCalledWith('Picture 1 displayed successfully at (100, 200)');
    });

    it('should log warning when picture fails to display', () => {
      machine.state.version = 6;
      mockMultimediaHandler.displayPicture.mockReturnValue(ResourceStatus.NotAvailable);

      draw_picture(machine, [], 1, 100, 200);

      expect(machine.logger.warn).toHaveBeenCalledWith('Picture 1 failed to display, status: 1');
    });
  });

  describe('erase_picture opcode', () => {
    it('should call multimedia handler for V6+ games', () => {
      machine.state.version = 6;
      mockMultimediaHandler.erasePicture.mockReturnValue(ResourceStatus.Available);

      erase_picture(machine, [], 1);

      expect(mockMultimediaHandler.erasePicture).toHaveBeenCalledWith(1);
      expect(machine.logger.debug).toHaveBeenCalledWith('erase_picture 1');
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

      expect(machine.logger.debug).toHaveBeenCalledWith('Picture 1 erased successfully');
    });

    it('should log warning when picture fails to erase', () => {
      machine.state.version = 6;
      mockMultimediaHandler.erasePicture.mockReturnValue(ResourceStatus.NotAvailable);

      erase_picture(machine, [], 1);

      expect(machine.logger.warn).toHaveBeenCalledWith('Picture 1 failed to erase, status: 1');
    });
  });

  describe('picture_data opcode', () => {
    it('should call multimedia handler for V6+ games', () => {
      machine.state.version = 6;
      mockMultimediaHandler.getPictureData.mockReturnValue({ width: 100, height: 200, format: 'PNG', hasTransparency: false });

      picture_data(machine, [], 1);

      expect(mockMultimediaHandler.getPictureData).toHaveBeenCalledWith(1);
      expect(machine.logger.debug).toHaveBeenCalledWith('picture_data 1');
    });

    it('should warn for V5 games', () => {
      machine.state.version = 5;

      picture_data(machine, [], 1);

      expect(mockMultimediaHandler.getPictureData).not.toHaveBeenCalled();
      expect(machine.logger.warn).toHaveBeenCalledWith('picture_data not supported in version 5');
    });

    it('should handle multimedia handler errors gracefully', () => {
      machine.state.version = 6;
      mockMultimediaHandler.getPictureData.mockImplementation(() => {
        throw new Error('Test error');
      });

      picture_data(machine, [], 1);

      expect(machine.logger.error).toHaveBeenCalledWith('Error getting picture data for 1: Error: Test error');
    });

    it('should log success when picture data is available', () => {
      machine.state.version = 6;
      mockMultimediaHandler.getPictureData.mockReturnValue({ width: 100, height: 200, format: 'PNG', hasTransparency: false });

      picture_data(machine, [], 1);

      expect(machine.logger.debug).toHaveBeenCalledWith('Picture 1 data retrieved successfully');
    });

    it('should log warning when picture data is not available', () => {
      machine.state.version = 6;
      mockMultimediaHandler.getPictureData.mockReturnValue(null);

      picture_data(machine, [], 1);

      expect(machine.logger.warn).toHaveBeenCalledWith('Picture 1 data not available');
    });
  });

  describe('picture_table opcode', () => {
    it('should process picture table for V6+ games', () => {
      machine.state.version = 6;

      picture_table(machine, [], 0x1000);

      expect(machine.logger.debug).toHaveBeenCalledWith('picture_table 4096');
      expect(machine.logger.debug).toHaveBeenCalledWith('Picture table 4096 processed for preloading');
    });

    it('should warn for V5 games', () => {
      machine.state.version = 5;

      picture_table(machine, [], 0x1000);

      expect(machine.logger.warn).toHaveBeenCalledWith('picture_table not supported in version 5');
    });

    it('should handle errors gracefully', () => {
      machine.state.version = 6;

      // Test that the function executes without throwing errors
      expect(() => {
        picture_table(machine, [], 0x1000);
      }).not.toThrow();

      expect(machine.logger.debug).toHaveBeenCalledWith('picture_table 4096');
      expect(machine.logger.debug).toHaveBeenCalledWith('Picture table 4096 processed for preloading');
    });
  });
});
