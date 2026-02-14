import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WindowManager, WindowEventType, WindowEvent } from '../../../../src/ui/screen/WindowManager';
import { WindowType, WindowProperty } from '../../../../src/ui/screen/interfaces';
import { Color, TextStyle } from '../../../../src/types';

describe('WindowManager', () => {
  let windowManager: WindowManager;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    windowManager = new WindowManager(mockLogger);
  });

  describe('initialization', () => {
    it('should initialize with default windows', () => {
      const windows = windowManager.getWindows();
      expect(windows).toHaveLength(2);

      const lowerWindow = windowManager.getWindow(WindowType.Lower);
      const upperWindow = windowManager.getWindow(WindowType.Upper);

      expect(lowerWindow).toBeDefined();
      expect(upperWindow).toBeDefined();
      expect(lowerWindow?.type).toBe(WindowType.Lower);
      expect(upperWindow?.type).toBe(WindowType.Upper);
    });

    it('should set correct default properties for lower window', () => {
      const lowerWindow = windowManager.getWindow(WindowType.Lower)!;

      expect(lowerWindow.x).toBe(0);
      expect(lowerWindow.y).toBe(0);
      expect(lowerWindow.width).toBe(80);
      expect(lowerWindow.height).toBe(25);
      expect(lowerWindow.visible).toBe(true);
      expect(lowerWindow.active).toBe(true);
      expect(lowerWindow.zOrder).toBe(0);
    });

    it('should set correct default properties for upper window', () => {
      const upperWindow = windowManager.getWindow(WindowType.Upper)!;

      expect(upperWindow.x).toBe(0);
      expect(upperWindow.y).toBe(0);
      expect(upperWindow.width).toBe(80);
      expect(upperWindow.height).toBe(0);
      expect(upperWindow.visible).toBe(false);
      expect(upperWindow.active).toBe(false);
      expect(upperWindow.zOrder).toBe(1);
    });
  });

  describe('window creation and destruction', () => {
    it('should create a new window with default options', () => {
      const windowId = windowManager.createWindow();

      expect(windowId).toBe(2); // First custom window ID
      expect(windowManager.hasWindow(windowId)).toBe(true);

      const window = windowManager.getWindow(windowId)!;
      expect(window.id).toBe(windowId);
      expect(window.type).toBe(WindowType.Lower);
      expect(window.x).toBe(0);
      expect(window.y).toBe(0);
      expect(window.width).toBe(80);
      expect(window.height).toBe(25);
    });

    it('should create a window with custom options', () => {
      const options = {
        x: 10,
        y: 5,
        width: 30,
        height: 15,
        font: 2,
        textStyle: TextStyle.Bold,
        foreground: Color.Red,
        background: Color.Blue,
      };

      const windowId = windowManager.createWindow(options);
      const window = windowManager.getWindow(windowId)!;

      expect(window.x).toBe(10);
      expect(window.y).toBe(5);
      expect(window.width).toBe(30);
      expect(window.height).toBe(15);
      expect(window.font).toBe(2);
      expect(window.textStyle).toBe(TextStyle.Bold);
      expect(window.foreground).toBe(Color.Red);
      expect(window.background).toBe(Color.Blue);
    });

    it('should destroy a custom window', () => {
      const windowId = windowManager.createWindow();
      expect(windowManager.hasWindow(windowId)).toBe(true);

      const result = windowManager.destroyWindow(windowId);
      expect(result).toBe(true);
      expect(windowManager.hasWindow(windowId)).toBe(false);
    });

    it('should not destroy reserved windows', () => {
      const result = windowManager.destroyWindow(WindowType.Lower);
      expect(result).toBe(false);
      expect(windowManager.hasWindow(WindowType.Lower)).toBe(true);

      const result2 = windowManager.destroyWindow(WindowType.Upper);
      expect(result2).toBe(false);
      expect(windowManager.hasWindow(WindowType.Upper)).toBe(true);
    });

    it('should handle destroying non-existent window', () => {
      const result = windowManager.destroyWindow(999);
      expect(result).toBe(false);
    });
  });

  describe('window positioning and sizing', () => {
    it('should move a window to new position', () => {
      const windowId = windowManager.createWindow({ x: 0, y: 0, width: 20, height: 10 });

      const result = windowManager.moveWindow(windowId, 15, 8);
      expect(result).toBe(true);

      const window = windowManager.getWindow(windowId)!;
      expect(window.x).toBe(15);
      expect(window.y).toBe(8);
      expect(window.dirty).toBe(true);
    });

    it('should constrain window position to screen bounds', () => {
      const windowId = windowManager.createWindow({ x: 0, y: 0, width: 20, height: 10 });

      // Try to move beyond screen bounds
      windowManager.moveWindow(windowId, 100, 30);

      const window = windowManager.getWindow(windowId)!;
      expect(window.x).toBe(60); // 80 - 20 = 60
      expect(window.y).toBe(15); // 25 - 10 = 15
    });

    it('should resize a window', () => {
      const windowId = windowManager.createWindow({ x: 10, y: 5, width: 20, height: 10 });

      const result = windowManager.resizeWindow(windowId, 30, 15);
      expect(result).toBe(true);

      const window = windowManager.getWindow(windowId)!;
      expect(window.width).toBe(30);
      expect(window.height).toBe(15);
      expect(window.rightMargin).toBe(40); // x + width
      expect(window.scrollBottom).toBe(20); // y + height
      expect(window.dirty).toBe(true);
    });

    it('should constrain window size to screen bounds', () => {
      const windowId = windowManager.createWindow({ x: 70, y: 20, width: 20, height: 10 });

      // Try to resize beyond screen bounds
      windowManager.resizeWindow(windowId, 30, 20);

      const window = windowManager.getWindow(windowId)!;
      expect(window.width).toBe(10); // 80 - 70 = 10
      expect(window.height).toBe(5); // 25 - 20 = 5
    });
  });

  describe('window properties', () => {
    it('should get window properties', () => {
      const windowId = windowManager.createWindow({ x: 10, y: 5, width: 30, height: 15 });

      expect(windowManager.getWindowProperty(windowId, WindowProperty.XSize)).toBe(30);
      expect(windowManager.getWindowProperty(windowId, WindowProperty.YSize)).toBe(15);
      expect(windowManager.getWindowProperty(windowId, WindowProperty.Font)).toBe(1);
      expect(windowManager.getWindowProperty(windowId, WindowProperty.TextStyle)).toBe(TextStyle.Roman);
    });

    it('should set window properties', () => {
      const windowId = windowManager.createWindow();

      windowManager.setWindowProperty(windowId, WindowProperty.Font, 3);
      windowManager.setWindowProperty(windowId, WindowProperty.TextStyle, TextStyle.Bold);
      windowManager.setWindowProperty(windowId, WindowProperty.YCursor, 5);
      windowManager.setWindowProperty(windowId, WindowProperty.XCursor, 10);

      const window = windowManager.getWindow(windowId)!;
      expect(window.font).toBe(3);
      expect(window.textStyle).toBe(TextStyle.Bold);
      expect(window.cursorLine).toBe(5);
      expect(window.cursorColumn).toBe(10);
      expect(window.dirty).toBe(true);
    });

    it('should handle unknown window properties', () => {
      const windowId = windowManager.createWindow();

      expect(windowManager.getWindowProperty(windowId, 999)).toBe(0);
      expect(windowManager.setWindowProperty(windowId, 999, 123)).toBe(false);
    });
  });

  describe('window management', () => {
    it('should split the screen into two windows', () => {
      windowManager.splitWindow(5);

      const upperWindow = windowManager.getWindow(WindowType.Upper)!;
      const lowerWindow = windowManager.getWindow(WindowType.Lower)!;

      expect(upperWindow.height).toBe(5);
      expect(upperWindow.visible).toBe(true);
      expect(upperWindow.scrollBottom).toBe(5);

      expect(lowerWindow.y).toBe(5);
      expect(lowerWindow.height).toBe(20);
      expect(lowerWindow.scrollTop).toBe(5);
      expect(lowerWindow.scrollBottom).toBe(25);

      expect(upperWindow.dirty).toBe(true);
      expect(lowerWindow.dirty).toBe(true);
    });

    it('should set output window', () => {
      const windowId = windowManager.createWindow();

      const result = windowManager.setOutputWindow(windowId);
      expect(result).toBe(true);
      expect(windowManager.getOutputWindow()).toBe(windowId);

      const window = windowManager.getWindow(windowId)!;
      expect(window.active).toBe(true);
      expect(window.dirty).toBe(true);
    });

    it('should clear a window', () => {
      const windowId = windowManager.createWindow();
      const window = windowManager.getWindow(windowId)!;

      // Add some content
      window.content = ['Line 1', 'Line 2', 'Line 3'];
      window.cursorLine = 5;
      window.cursorColumn = 10;

      const result = windowManager.clearWindow(windowId);
      expect(result).toBe(true);

      expect(window.content).toHaveLength(0);
      expect(window.cursorLine).toBe(1);
      expect(window.cursorColumn).toBe(1);
      expect(window.dirty).toBe(true);
    });

    it('should scroll a window', () => {
      const windowId = windowManager.createWindow({ height: 20 });
      const window = windowManager.getWindow(windowId)!;

      window.scrollTop = 5;

      const result = windowManager.scrollWindow(windowId, 3);
      expect(result).toBe(true);

      expect(window.scrollTop).toBe(8);
      expect(window.dirty).toBe(true);
    });
  });

  describe('event handling', () => {
    it('should emit events when windows are created', () => {
      const events: WindowEvent[] = [];
      windowManager.on(WindowEventType.CREATED, (event) => {
        events.push(event);
      });

      const windowId = windowManager.createWindow();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(WindowEventType.CREATED);
      expect(events[0].windowId).toBe(windowId);
      expect(events[0].data?.window).toBeDefined();
    });

    it('should emit events when windows are moved', () => {
      const events: WindowEvent[] = [];
      windowManager.on(WindowEventType.MOVED, (event) => {
        events.push(event);
      });

      const windowId = windowManager.createWindow({ width: 20, height: 10 });
      windowManager.moveWindow(windowId, 15, 8);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(WindowEventType.MOVED);
      expect(events[0].windowId).toBe(windowId);
      expect(events[0].data?.oldX).toBe(0);
      expect(events[0].data?.oldY).toBe(0);
      expect(events[0].data?.newX).toBe(15);
      expect(events[0].data?.newY).toBe(8);
    });

    it('should emit events when windows are resized', () => {
      const events: WindowEvent[] = [];
      windowManager.on(WindowEventType.RESIZED, (event) => {
        events.push(event);
      });

      const windowId = windowManager.createWindow({ width: 20, height: 10 });
      windowManager.resizeWindow(windowId, 30, 15);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(WindowEventType.RESIZED);
      expect(events[0].windowId).toBe(windowId);
      expect(events[0].data?.oldWidth).toBe(20);
      expect(events[0].data?.oldHeight).toBe(10);
      expect(events[0].data?.newWidth).toBe(30);
      expect(events[0].data?.newHeight).toBe(15);
    });

    it('should emit events when output window changes', () => {
      const events: WindowEvent[] = [];
      windowManager.on(WindowEventType.FOCUSED, (event) => {
        events.push(event);
      });

      const windowId = windowManager.createWindow();
      windowManager.setOutputWindow(windowId);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(WindowEventType.FOCUSED);
      expect(events[0].windowId).toBe(windowId);
    });

    it('should remove event handlers', () => {
      const events: WindowEvent[] = [];
      const handler = (event: WindowEvent) => {
        events.push(event);
      };

      windowManager.on(WindowEventType.CREATED, handler);
      windowManager.off(WindowEventType.CREATED, handler);

      const windowId = windowManager.createWindow();

      expect(events).toHaveLength(0);
    });
  });

  describe('screen management', () => {
    it('should update screen size and adjust windows', () => {
      const windowId = windowManager.createWindow({ x: 70, y: 20, width: 20, height: 10 });

      windowManager.setScreenSize(60, 20);

      const window = windowManager.getWindow(windowId)!;
      // setScreenSize only adjusts dimensions, not positions
      // Window at x=70 is beyond screen width 60, so width gets adjusted to 1 (minimum)
      // Window at y=20 with height=10 extends to y=30, which is beyond screen height 20, so height gets adjusted to 1
      expect(window.x).toBe(70); // Position unchanged
      expect(window.y).toBe(20); // Position unchanged
      expect(window.width).toBe(1); // Clamped to minimum since x=70 + width=20 > 60
      expect(window.height).toBe(1); // Clamped to minimum since y=20 + height=10 > 20
      expect(window.dirty).toBe(true);
    });

    it('should get screen dimensions', () => {
      const size = windowManager.getScreenSize();
      expect(size.width).toBe(80);
      expect(size.height).toBe(25);
    });

    it('should get performance statistics', () => {
      const stats = windowManager.getStats();

      expect(stats.totalWindows).toBe(2);
      expect(stats.dirtyWindows).toBe(0);
      expect(stats.lastUpdate).toBeDefined();
      expect(stats.updateFrequency).toBeGreaterThanOrEqual(0); // Can be 0 if no time has passed
    });
  });

  describe('window state management', () => {
    it('should track dirty windows', () => {
      const windowId = windowManager.createWindow();

      expect(windowManager.getDirtyWindows()).toHaveLength(0);

      windowManager.moveWindow(windowId, 10, 5);
      expect(windowManager.getDirtyWindows()).toHaveLength(1);

      windowManager.markWindowClean(windowId);
      expect(windowManager.getDirtyWindows()).toHaveLength(0);
    });

    it('should get all windows in z-order', () => {
      const window1 = windowManager.createWindow();
      const window2 = windowManager.createWindow();

      const windows = windowManager.getWindows();
      expect(windows).toHaveLength(4); // Lower, Upper, window1, window2

      // Check z-order
      expect(windows[0].id).toBe(WindowType.Lower);
      expect(windows[1].id).toBe(WindowType.Upper);
      expect(windows[2].id).toBe(window1);
      expect(windows[3].id).toBe(window2);
    });
  });

  describe('error handling', () => {
    it('should handle errors in event handlers gracefully', () => {
      const errorHandler = vi.fn();
      mockLogger.error = errorHandler;

      windowManager.on(WindowEventType.CREATED, () => {
        throw new Error('Test error');
      });

      const windowId = windowManager.createWindow();

      expect(errorHandler).toHaveBeenCalledWith('Error in window event handler: Error: Test error');
      expect(windowManager.hasWindow(windowId)).toBe(true); // Window still created despite handler error
    });

    it('should handle invalid window operations gracefully', () => {
      expect(windowManager.moveWindow(999, 10, 5)).toBe(false);
      expect(windowManager.resizeWindow(999, 20, 10)).toBe(false);
      expect(windowManager.setWindowProperty(999, WindowProperty.Font, 2)).toBe(false);
      expect(windowManager.clearWindow(999)).toBe(false);
      expect(windowManager.scrollWindow(999, 5)).toBe(false);
    });
  });
});

