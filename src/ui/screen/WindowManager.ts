/**
 * WindowManager class for advanced Z-Machine window management
 *
 * This class handles:
 * - Window creation, destruction, and lifecycle
 * - Window positioning and sizing
 * - Window stacking (z-order)
 * - Window clipping and content boundaries
 * - Scroll regions and viewport management
 * - Performance optimization for redraws
 *
 * Beyond Zork Requirements:
 * - Status bar window (top, always visible)
 * - Main game window (center, scrollable)
 * - Interactive map window (right side, Font 3)
 * - Input window (bottom, command entry)
 * - Smooth window transitions
 */

import { Color, TextStyle } from '../../types';
import { Logger } from '../../utils/log';
import { WindowProperty, WindowType } from './interfaces';

/**
 * Window state and properties
 */
export interface WindowState {
  id: number;
  type: WindowType;
  x: number;
  y: number;
  width: number;
  height: number;
  zOrder: number;
  visible: boolean;
  active: boolean;
  font: number;
  textStyle: TextStyle;
  foreground: Color;
  background: Color;
  cursorLine: number;
  cursorColumn: number;
  scrollTop: number;
  scrollBottom: number;
  leftMargin: number;
  rightMargin: number;
  content: string[];
  dirty: boolean;
  lastRedraw: number;
}

/**
 * Window creation options
 */
export interface WindowOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  font?: number;
  textStyle?: TextStyle;
  foreground?: Color;
  background?: Color;
  scrollable?: boolean;
  fixed?: boolean;
}

/**
 * Window event types
 */
export enum WindowEventType {
  CREATED = 'created',
  DESTROYED = 'destroyed',
  MOVED = 'moved',
  RESIZED = 'resized',
  FOCUSED = 'focused',
  BLURRED = 'blurred',
  CONTENT_CHANGED = 'content_changed',
  SCROLLED = 'scrolled',
}

/**
 * Window event data
 */
export interface WindowEvent {
  type: WindowEventType;
  windowId: number;
  data?: unknown;
  timestamp: number;
}

/**
 * Window event handler
 */
export type WindowEventHandler = (event: WindowEvent) => void;

/**
 * WindowManager class for advanced window management
 */
export class WindowManager {
  private logger: Logger;
  private windows: Map<number, WindowState> = new Map();
  private nextWindowId: number = 2; // 0 and 1 are reserved for Lower/Upper
  private eventHandlers: Map<WindowEventType, WindowEventHandler[]> = new Map();
  private screenWidth: number = 80;
  private screenHeight: number = 25;
  private lastUpdate: number = Date.now();

  constructor(logger?: Logger) {
    this.logger = logger || new Logger('WindowManager');
    this.initializeDefaultWindows();
  }

  /**
   * Initialize default windows (Lower and Upper)
   */
  private initializeDefaultWindows(): void {
    // Lower window (main game area)
    this.windows.set(WindowType.Lower, {
      id: WindowType.Lower,
      type: WindowType.Lower,
      x: 0,
      y: 0,
      width: this.screenWidth,
      height: this.screenHeight,
      zOrder: 0,
      visible: true,
      active: true,
      font: 1,
      textStyle: TextStyle.Roman,
      foreground: Color.Default,
      background: Color.Default,
      cursorLine: 1,
      cursorColumn: 1,
      scrollTop: 0,
      scrollBottom: this.screenHeight,
      leftMargin: 1,
      rightMargin: this.screenWidth,
      content: [],
      dirty: false,
      lastRedraw: Date.now(),
    });

    // Upper window (status bar)
    this.windows.set(WindowType.Upper, {
      id: WindowType.Upper,
      type: WindowType.Upper,
      x: 0,
      y: 0,
      width: this.screenWidth,
      height: 0, // Initially collapsed
      zOrder: 1,
      visible: false,
      active: false,
      font: 1,
      textStyle: TextStyle.Roman,
      foreground: Color.Default,
      background: Color.Default,
      cursorLine: 1,
      cursorColumn: 1,
      scrollTop: 0,
      scrollBottom: 0,
      leftMargin: 1,
      rightMargin: this.screenWidth,
      content: [],
      dirty: false,
      lastRedraw: Date.now(),
    });
  }

  /**
   * Create a new window
   */
  public createWindow(options: WindowOptions = {}): number {
    const windowId = this.nextWindowId++;

    const window: WindowState = {
      id: windowId,
      type: WindowType.Lower, // Default to lower type for custom windows
      x: options.x || 0,
      y: options.y || 0,
      width: options.width || this.screenWidth,
      height: options.height || this.screenHeight,
      zOrder: windowId,
      visible: true,
      active: false,
      font: options.font || 1,
      textStyle: options.textStyle || TextStyle.Roman,
      foreground: options.foreground || Color.Default,
      background: options.background || Color.Default,
      cursorLine: 1,
      cursorColumn: 1,
      scrollTop: 0,
      scrollBottom: options.height || this.screenHeight,
      leftMargin: 1,
      rightMargin: options.width || this.screenWidth,
      content: [],
      dirty: false,
      lastRedraw: Date.now(),
    };

    this.windows.set(windowId, window);
    this.emitEvent(WindowEventType.CREATED, windowId, { window });

    this.logger.debug(`Created window ${windowId} at (${window.x}, ${window.y}) ${window.width}x${window.height}`);
    return windowId;
  }

  /**
   * Destroy a window
   */
  public destroyWindow(windowId: number): boolean {
    if (windowId <= 1) {
      this.logger.warn(`Cannot destroy reserved window ${windowId}`);
      return false;
    }

    const window = this.windows.get(windowId);
    if (!window) {
      this.logger.warn(`Window ${windowId} not found`);
      return false;
    }

    this.windows.delete(windowId);
    this.emitEvent(WindowEventType.DESTROYED, windowId, { window });

    this.logger.debug(`Destroyed window ${windowId}`);
    return true;
  }

  /**
   * Move a window to a new position
   */
  public moveWindow(windowId: number, x: number, y: number): boolean {
    const window = this.windows.get(windowId);
    if (!window) {
      this.logger.warn(`Window ${windowId} not found`);
      return false;
    }

    const oldX = window.x;
    const oldY = window.y;

    window.x = Math.max(0, Math.min(x, this.screenWidth - window.width));
    window.y = Math.max(0, Math.min(y, this.screenHeight - window.height));
    window.dirty = true;

    this.emitEvent(WindowEventType.MOVED, windowId, {
      oldX,
      oldY,
      newX: window.x,
      newY: window.y,
    });

    this.logger.debug(`Moved window ${windowId} from (${oldX}, ${oldY}) to (${window.x}, ${window.y})`);
    return true;
  }

  /**
   * Resize a window
   */
  public resizeWindow(windowId: number, width: number, height: number): boolean {
    const window = this.windows.get(windowId);
    if (!window) {
      this.logger.warn(`Window ${windowId} not found`);
      return false;
    }

    const oldWidth = window.width;
    const oldHeight = window.height;

    window.width = Math.max(1, Math.min(width, this.screenWidth - window.x));
    window.height = Math.max(1, Math.min(height, this.screenHeight - window.y));
    window.rightMargin = window.x + window.width;
    window.scrollBottom = window.y + window.height;
    window.dirty = true;

    this.emitEvent(WindowEventType.RESIZED, windowId, {
      oldWidth,
      oldHeight,
      newWidth: window.width,
      newHeight: window.height,
    });

    this.logger.debug(`Resized window ${windowId} from ${oldWidth}x${oldHeight} to ${window.width}x${window.height}`);
    return true;
  }

  /**
   * Set window style properties
   */
  public setWindowStyle(windowId: number, style: number): boolean {
    const window = this.windows.get(windowId);
    if (!window) {
      this.logger.warn(`Window ${windowId} not found`);
      return false;
    }

    window.textStyle = style;
    window.dirty = true;

    this.logger.debug(`Set window ${windowId} style to ${style}`);
    return true;
  }

  /**
   * Get window property
   */
  public getWindowProperty(windowId: number, property: WindowProperty): number {
    const window = this.windows.get(windowId);
    if (!window) {
      this.logger.warn(`Window ${windowId} not found`);
      return 0;
    }

    switch (property) {
      case WindowProperty.YCoordinate:
        return window.y + 1; // Convert 0-based to 1-based
      case WindowProperty.XCoordinate:
        return window.x + 1; // Convert 0-based to 1-based
      case WindowProperty.YSize:
        return window.height;
      case WindowProperty.XSize:
        return window.width;
      case WindowProperty.YCursor:
        return window.cursorLine;
      case WindowProperty.XCursor:
        return window.cursorColumn;
      case WindowProperty.LeftMargin:
        return Math.max(0, window.leftMargin - 1); // Convert position to margin size
      case WindowProperty.RightMargin:
        return Math.max(0, window.width - window.rightMargin); // Convert position to margin size
      case WindowProperty.TextStyle:
        return window.textStyle;
      case WindowProperty.ColorData:
        return (window.foreground << 8) | window.background;
      case WindowProperty.Font:
        return window.font;
      case WindowProperty.FontSize:
        return (1 << 8) | 1; // Default 1x1 font size
      case WindowProperty.Attributes:
        return 0;
      case WindowProperty.LineCount:
        return window.height;
      default:
        this.logger.debug(`Unknown window property ${property}`);
        return 0;
    }
  }

  /**
   * Set window property
   */
  public setWindowProperty(windowId: number, property: WindowProperty, value: number): boolean {
    const window = this.windows.get(windowId);
    if (!window) {
      this.logger.warn(`Window ${windowId} not found`);
      return false;
    }

    switch (property) {
      case WindowProperty.YCursor:
        window.cursorLine = Math.max(1, Math.min(value, window.height));
        break;
      case WindowProperty.XCursor:
        window.cursorColumn = Math.max(1, Math.min(value, window.width));
        break;
      case WindowProperty.LeftMargin:
        // Value is margin size; convert to internal position (1-based)
        window.leftMargin = value + 1;
        break;
      case WindowProperty.RightMargin:
        // Value is margin size; convert to internal position
        window.rightMargin = window.width - value;
        break;
      case WindowProperty.Font:
        window.font = value;
        break;
      case WindowProperty.TextStyle:
        window.textStyle = value;
        break;
      case WindowProperty.ColorData:
        window.foreground = (value >> 8) & 0xff;
        window.background = value & 0xff;
        break;
      default:
        this.logger.debug(`Cannot set window property ${property}`);
        return false;
    }

    window.dirty = true;
    return true;
  }

  /**
   * Split the screen into two windows
   */
  public splitWindow(lines: number): void {
    const upperHeight = Math.max(0, Math.min(lines, this.screenHeight - 1));
    const upperWindow = this.windows.get(WindowType.Upper)!;
    const lowerWindow = this.windows.get(WindowType.Lower)!;

    upperWindow.height = upperHeight;
    upperWindow.visible = upperHeight > 0;
    upperWindow.scrollBottom = upperHeight;
    upperWindow.dirty = true;

    lowerWindow.y = upperHeight;
    lowerWindow.height = this.screenHeight - upperHeight;
    lowerWindow.scrollTop = upperHeight;
    lowerWindow.scrollBottom = this.screenHeight;
    lowerWindow.dirty = true;

    this.logger.debug(`Split window: upper=${upperHeight} lines, lower=${this.screenHeight - upperHeight} lines`);
  }

  /**
   * Set the active output window
   */
  public setOutputWindow(windowId: number): boolean {
    if (!this.windows.has(windowId)) {
      this.logger.warn(`Window ${windowId} not found`);
      return false;
    }

    // Deactivate all windows
    this.windows.forEach((window) => {
      window.active = false;
    });

    // Activate the specified window
    const window = this.windows.get(windowId)!;
    window.active = true;
    window.dirty = true;

    this.emitEvent(WindowEventType.FOCUSED, windowId);

    this.logger.debug(`Set output window to ${windowId}`);
    return true;
  }

  /**
   * Get the active output window
   */
  public getOutputWindow(): number {
    for (const [id, window] of this.windows) {
      if (window.active) {
        return id;
      }
    }
    return WindowType.Lower; // Default fallback
  }

  /**
   * Clear a window
   */
  public clearWindow(windowId: number): boolean {
    const window = this.windows.get(windowId);
    if (!window) {
      this.logger.warn(`Window ${windowId} not found`);
      return false;
    }

    window.content = [];
    window.cursorLine = 1;
    window.cursorColumn = 1;
    window.dirty = true;

    this.logger.debug(`Cleared window ${windowId}`);
    return true;
  }

  /**
   * Scroll a window
   */
  public scrollWindow(windowId: number, lines: number): boolean {
    const window = this.windows.get(windowId);
    if (!window) {
      this.logger.warn(`Window ${windowId} not found`);
      return false;
    }

    const oldScrollTop = window.scrollTop;
    window.scrollTop = Math.max(0, Math.min(window.scrollTop + lines, window.height));
    window.dirty = true;

    this.emitEvent(WindowEventType.SCROLLED, windowId, {
      oldScrollTop,
      newScrollTop: window.scrollTop,
      lines,
    });

    this.logger.debug(`Scrolled window ${windowId} by ${lines} lines`);
    return true;
  }

  /**
   * Get all windows
   */
  public getWindows(): WindowState[] {
    return Array.from(this.windows.values()).sort((a, b) => a.zOrder - b.zOrder);
  }

  /**
   * Get window by ID
   */
  public getWindow(windowId: number): WindowState | undefined {
    return this.windows.get(windowId);
  }

  /**
   * Check if window exists
   */
  public hasWindow(windowId: number): boolean {
    return this.windows.has(windowId);
  }

  /**
   * Get dirty windows that need redrawing
   */
  public getDirtyWindows(): WindowState[] {
    return Array.from(this.windows.values()).filter((window) => window.dirty);
  }

  /**
   * Mark window as clean (redrawn)
   */
  public markWindowClean(windowId: number): void {
    const window = this.windows.get(windowId);
    if (window) {
      window.dirty = false;
      window.lastRedraw = Date.now();
    }
  }

  /**
   * Add event handler
   */
  public on(eventType: WindowEventType, handler: WindowEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Remove event handler
   */
  public off(eventType: WindowEventType, handler: WindowEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit window event
   */
  private emitEvent(eventType: WindowEventType, windowId: number, data?: unknown): void {
    const event: WindowEvent = {
      type: eventType,
      windowId,
      data,
      timestamp: Date.now(),
    };

    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          this.logger.error(`Error in window event handler: ${error}`);
        }
      });
    }
  }

  /**
   * Update screen dimensions
   */
  public setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;

    // Adjust existing windows to fit new screen size
    this.windows.forEach((window) => {
      if (window.x + window.width > width) {
        window.width = Math.max(1, width - window.x);
        window.rightMargin = window.x + window.width;
      }
      if (window.y + window.height > height) {
        window.height = Math.max(1, height - window.y);
        window.scrollBottom = window.y + window.height;
      }
      window.dirty = true;
    });

    this.logger.debug(`Screen size updated to ${width}x${height}`);
  }

  /**
   * Get screen dimensions
   */
  public getScreenSize(): { width: number; height: number } {
    return { width: this.screenWidth, height: this.screenHeight };
  }

  /**
   * Get performance statistics
   */
  public getStats(): {
    totalWindows: number;
    dirtyWindows: number;
    lastUpdate: number;
    updateFrequency: number;
  } {
    const now = Date.now();
    const dirtyCount = this.getDirtyWindows().length;

    return {
      totalWindows: this.windows.size,
      dirtyWindows: dirtyCount,
      lastUpdate: this.lastUpdate,
      updateFrequency: now - this.lastUpdate,
    };
  }
}
