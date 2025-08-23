import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseMultimediaHandler, ResourceStatus, ResourceType } from '../../../../src/ui/multimedia/MultimediaHandler';
import { Logger } from '../../../../src/utils/log';

describe('BaseMultimediaHandler', () => {
  let handler: BaseMultimediaHandler;
  let mockLogger: Logger;

  beforeEach(() => {
    // Create a mock logger to verify logging behavior
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger;

    // Create an instance of BaseMultimediaHandler with the mock logger
    handler = new BaseMultimediaHandler({ logger: mockLogger });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Resource Management Methods', () => {
    it('should check resource availability', () => {
      const result = handler.isResourceAvailable(ResourceType.Picture, 1);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith('Checking availability of Picture 1');
    });

    it('should load resources', async () => {
      const result = await handler.loadResource(ResourceType.Sound, 2);

      expect(result).toBe(ResourceStatus.NotAvailable);
      expect(mockLogger.debug).toHaveBeenCalledWith('Loading Sound 2');
    });

    it('should unload resources', async () => {
      const result = await handler.unloadResource(ResourceType.Music, 3);

      expect(result).toBe(ResourceStatus.NotAvailable);
      expect(mockLogger.debug).toHaveBeenCalledWith('Unloading Music 3');
    });

    it('should get resource info', () => {
      const result = handler.getResourceInfo(ResourceType.Picture, 1);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith('Getting info for Picture 1');
    });

    it('should preload multiple resources', async () => {
      const resources = [
        { type: ResourceType.Picture, id: 1 },
        { type: ResourceType.Sound, id: 2 },
        { type: ResourceType.Music, id: 3 }
      ];

      const result = await handler.preloadResources(resources);

      expect(result).toEqual([
        ResourceStatus.NotAvailable,
        ResourceStatus.NotAvailable,
        ResourceStatus.NotAvailable
      ]);
      expect(mockLogger.debug).toHaveBeenCalledWith('Preloading 3 resources');
    });
  });

  describe('Sound Effects Methods', () => {
    it('should play sounds', () => {
      const result = handler.playSound(1, 2, 128, 3);

      expect(result).toBe(ResourceStatus.NotAvailable);
      expect(mockLogger.debug).toHaveBeenCalledWith('Playing sound 1 (effect: 2, volume: 128, repeats: 3)');
    });

    it('should stop sounds', () => {
      const result = handler.stopSound(1);

      expect(result).toBe(ResourceStatus.NotAvailable);
      expect(mockLogger.debug).toHaveBeenCalledWith('Stopping sound 1');
    });

    it('should get sound status', () => {
      const result = handler.getSoundStatus(1);

      expect(result).toBe(ResourceStatus.NotAvailable);
      expect(mockLogger.debug).toHaveBeenCalledWith('Getting status for sound 1');
    });

    it('should set sound volume', () => {
      const result = handler.setSoundVolume(1, 200);

      expect(result).toBe(ResourceStatus.NotAvailable);
      expect(mockLogger.debug).toHaveBeenCalledWith('Setting volume for sound 1 to 200');
    });

    it('should get sound volume', () => {
      const result = handler.getSoundVolume(1);

      expect(result).toBe(-1);
      expect(mockLogger.debug).toHaveBeenCalledWith('Getting volume for sound 1');
    });
  });

  describe('Music Methods (V6+)', () => {
    it('should play music', () => {
      const result = handler.playMusic(1, 150, 2);

      expect(result).toBe(ResourceStatus.NotAvailable);
      expect(mockLogger.debug).toHaveBeenCalledWith('Playing music 1 (volume: 150, repeats: 2)');
    });

    it('should stop music', () => {
      const result = handler.stopMusic(1);

      expect(result).toBe(ResourceStatus.NotAvailable);
      expect(mockLogger.debug).toHaveBeenCalledWith('Stopping music 1');
    });

    it('should set music volume', () => {
      const result = handler.setMusicVolume(1, 180);

      expect(result).toBe(ResourceStatus.NotAvailable);
      expect(mockLogger.debug).toHaveBeenCalledWith('Setting volume for music 1 to 180');
    });

    it('should get music status', () => {
      const result = handler.getMusicStatus(1);

      expect(result).toBe(ResourceStatus.NotAvailable);
      expect(mockLogger.debug).toHaveBeenCalledWith('Getting status for music 1');
    });
  });

  describe('Picture Methods', () => {
    it('should display pictures', () => {
      const result = handler.displayPicture(1, 100, 200, 150);

      expect(result).toBe(ResourceStatus.NotAvailable);
      expect(mockLogger.debug).toHaveBeenCalledWith('Displaying picture 1 at (100,200) with scale 150%');
    });

    it('should erase pictures', () => {
      const result = handler.erasePicture(1);

      expect(result).toBe(ResourceStatus.NotAvailable);
      expect(mockLogger.debug).toHaveBeenCalledWith('Erasing picture 1');
    });

    it('should get picture data', () => {
      const result = handler.getPictureData(1);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith('Getting data for picture 1');
    });

    it('should set picture scale', () => {
      const result = handler.setPictureScale(1, 200);

      expect(result).toBe(ResourceStatus.NotAvailable);
      expect(mockLogger.debug).toHaveBeenCalledWith('Setting scale for picture 1 to 200%');
    });

    it('should get picture position', () => {
      const result = handler.getPicturePosition(1);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith('Getting position for picture 1');
    });
  });

  describe('constructor', () => {
    it('should create with default logger if none provided', () => {
      const defaultHandler = new BaseMultimediaHandler();
      expect(defaultHandler).toBeDefined();
    });

    it('should create with provided logger', () => {
      const customHandler = new BaseMultimediaHandler({ logger: mockLogger });
      expect(customHandler).toBeDefined();
    });
  });
});
