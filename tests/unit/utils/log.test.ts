import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LogLevel, Logger } from '../../../src/utils/log';

describe('Logger', () => {
  // Spy on console.log
  const consoleSpy = vi.spyOn(console, 'log');

  beforeEach(() => {
    // Reset static properties of Logger to defaults
    Logger.setLevel(LogLevel.INFO);
    Logger.setColored(typeof process !== 'undefined' && process.stdout.isTTY);
    Logger.setLogToConsole(true);
    Logger.setLogSink(null);
  });

  afterEach(() => {
    // Clear mocks after each test
    consoleSpy.mockClear();
  });

  describe('static configuration', () => {
    it('should set global log level', () => {
      Logger.setLevel(LogLevel.DEBUG);
      const logger = new Logger('TestLogger');

      logger.debug('Test debug message');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockClear();

      Logger.setLevel(LogLevel.ERROR);
      logger.debug('This debug message should not appear');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should enable/disable colored output', () => {
      // Enable colored output
      Logger.setColored(true);
      const logger = new Logger('TestLogger');

      logger.info('Test info message');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[32m')); // Check for color code

      consoleSpy.mockClear();

      // Disable colored output
      Logger.setColored(false);
      logger.info('Test info message without color');
      expect(consoleSpy).toHaveBeenCalledWith(expect.not.stringContaining('\x1b[32m'));
    });

    it('should send formatted messages to a sink, until it is removed', () => {
      const sink = vi.fn();
      Logger.setLogSink(sink);
      const logger = new Logger('TestLogger');

      logger.info('Test sink logging');
      expect(sink).toHaveBeenCalledWith(expect.stringContaining('Test sink logging'));

      sink.mockClear();

      Logger.setLogSink(null);
      logger.info('This should not reach the sink');
      expect(sink).not.toHaveBeenCalled();
    });

    it('should enable/disable console logging', () => {
      Logger.setLogToConsole(true);
      const logger = new Logger('TestLogger');

      logger.info('Test console logging');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockClear();

      Logger.setLogToConsole(false);
      logger.info('This should not be logged to console');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('log levels', () => {
    it('should respect log level hierarchy', () => {
      const logger = new Logger('TestLogger');

      // Set to INFO level - DEBUG should not appear
      Logger.setLevel(LogLevel.INFO);

      logger.debug('Debug message');
      expect(consoleSpy).not.toHaveBeenCalled();

      logger.info('Info message');
      expect(consoleSpy).toHaveBeenLastCalledWith(expect.stringContaining('Info message'));

      logger.warn('Warning message');
      expect(consoleSpy).toHaveBeenLastCalledWith(expect.stringContaining('Warning message'));

      logger.error('Error message');
      expect(consoleSpy).toHaveBeenLastCalledWith(expect.stringContaining('Error message'));

      consoleSpy.mockClear();

      // Set to WARN level - DEBUG and INFO should not appear
      Logger.setLevel(LogLevel.WARN);

      logger.debug('Debug message');
      expect(consoleSpy).not.toHaveBeenCalled();

      logger.info('Info message');
      expect(consoleSpy).not.toHaveBeenCalled();

      logger.warn('Warning message');
      expect(consoleSpy).toHaveBeenLastCalledWith(expect.stringContaining('Warning message'));

      logger.error('Error message');
      expect(consoleSpy).toHaveBeenLastCalledWith(expect.stringContaining('Error message'));

      consoleSpy.mockClear();

      // Set to ERROR level - only ERROR should appear
      Logger.setLevel(LogLevel.ERROR);

      logger.debug('Debug message');
      expect(consoleSpy).not.toHaveBeenCalled();

      logger.info('Info message');
      expect(consoleSpy).not.toHaveBeenCalled();

      logger.warn('Warning message');
      expect(consoleSpy).not.toHaveBeenCalled();

      logger.error('Error message');
      expect(consoleSpy).toHaveBeenLastCalledWith(expect.stringContaining('Error message'));
    });
  });

  describe('message formatting', () => {
    it('should format debug messages correctly', () => {
      Logger.setLevel(LogLevel.DEBUG);
      Logger.setColored(true);
      const logger = new Logger('TestModule');

      logger.debug('Test debug message');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[36m[DEBUG] [TestModule] Test debug message\x1b[0m')
      );

      // Without color
      consoleSpy.mockClear();
      Logger.setColored(false);

      logger.debug('Test debug message');
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] [TestModule] Test debug message');
    });

    it('should format info messages correctly', () => {
      Logger.setLevel(LogLevel.INFO);
      Logger.setColored(true);
      const logger = new Logger('TestModule');

      logger.info('Test info message');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[32m[INFO] [TestModule] Test info message\x1b[0m')
      );

      // Without color
      consoleSpy.mockClear();
      Logger.setColored(false);

      logger.info('Test info message');
      expect(consoleSpy).toHaveBeenCalledWith('[INFO] [TestModule] Test info message');
    });

    it('should format warning messages correctly', () => {
      Logger.setLevel(LogLevel.WARN);
      Logger.setColored(true);
      const logger = new Logger('TestModule');

      logger.warn('Test warning message');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[33m[WARN] [TestModule] Test warning message\x1b[0m')
      );

      // Without color
      consoleSpy.mockClear();
      Logger.setColored(false);

      logger.warn('Test warning message');
      expect(consoleSpy).toHaveBeenCalledWith('[WARN] [TestModule] Test warning message');
    });

    it('should format error messages correctly', () => {
      Logger.setLevel(LogLevel.ERROR);
      Logger.setColored(true);
      const logger = new Logger('TestModule');

      logger.error('Test error message');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[31m[ERROR] [TestModule] Test error message\x1b[0m')
      );

      // Without color
      consoleSpy.mockClear();
      Logger.setColored(false);

      logger.error('Test error message');
      expect(consoleSpy).toHaveBeenCalledWith('[ERROR] [TestModule] Test error message');
    });
  });

  describe('simultaneous output targets', () => {
    it('should log to both console and sink when both are enabled', () => {
      const sink = vi.fn();
      Logger.setLogToConsole(true);
      Logger.setLogSink(sink);
      const logger = new Logger('DualLogger');

      logger.info('Log to both outputs');

      expect(consoleSpy).toHaveBeenCalled();
      expect(sink).toHaveBeenCalled();
    });

    it('should not log to either when both are disabled', () => {
      const sink = vi.fn();
      Logger.setLogToConsole(false);
      Logger.setLogSink(null);
      const logger = new Logger('NoLogger');

      logger.info('Should not be logged anywhere');

      expect(consoleSpy).not.toHaveBeenCalled();
      expect(sink).not.toHaveBeenCalled();
    });
  });

  describe('logger instances', () => {
    it('should create loggers with different names', () => {
      const logger1 = new Logger('Module1');
      const logger2 = new Logger('Module2');

      logger1.info('Message from Module1');
      expect(consoleSpy).toHaveBeenLastCalledWith(expect.stringContaining('[Module1]'));

      logger2.info('Message from Module2');
      expect(consoleSpy).toHaveBeenLastCalledWith(expect.stringContaining('[Module2]'));
    });

    it('should apply global settings to all logger instances', () => {
      const logger1 = new Logger('Module1');
      const logger2 = new Logger('Module2');

      // All loggers should respect the global log level
      Logger.setLevel(LogLevel.ERROR);

      logger1.info('Should not appear');
      logger2.info('Should not appear');
      expect(consoleSpy).not.toHaveBeenCalled();

      logger1.error('Should appear');
      expect(consoleSpy).toHaveBeenLastCalledWith(expect.stringContaining('[Module1]'));

      logger2.error('Should also appear');
      expect(consoleSpy).toHaveBeenLastCalledWith(expect.stringContaining('[Module2]'));
    });
  });
});
