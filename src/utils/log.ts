/**
 * Logging system for the Z-machine interpreter
 */

/**
 * Log levels used by the logger
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Logger class for outputting messages at different severity levels
 */
export class Logger {
  private level: LogLevel;
  private useColors: boolean;

  /**
   * Creates a new logger
   * @param level Minimum log level to display (defaults to INFO)
   * @param useColors Whether to use colored output (defaults to true if in a TTY environment)
   */
  constructor(level: LogLevel = LogLevel.INFO, useColors?: boolean) {
    this.level = level;
    this.useColors =
      useColors ?? (typeof process !== "undefined" && process.stdout.isTTY);
  }

  /**
   * Format a debug message with optional color
   * @param msg The message to format
   * @returns Formatted message string
   */
  private formatDebug(msg: string): string {
    return this.useColors ? `\x1b[36m[DEBUG] ${msg}\x1b[0m` : `[DEBUG] ${msg}`;
  }

  /**
   * Format an info message with optional color
   * @param msg The message to format
   * @returns Formatted message string
   */
  private formatInfo(msg: string): string {
    return this.useColors ? `\x1b[32m[INFO] ${msg}\x1b[0m` : `[INFO] ${msg}`;
  }

  /**
   * Format a warning message with optional color
   * @param msg The message to format
   * @returns Formatted message string
   */
  private formatWarn(msg: string): string {
    return this.useColors ? `\x1b[33m[WARN] ${msg}\x1b[0m` : `[WARN] ${msg}`;
  }

  /**
   * Format an error message with optional color
   * @param msg The message to format
   * @returns Formatted message string
   */
  private formatError(msg: string): string {
    return this.useColors ? `\x1b[31m[ERROR] ${msg}\x1b[0m` : `[ERROR] ${msg}`;
  }

  /**
   * Log a debug message
   * @param msg The message to log
   */
  debug(msg: string): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(this.formatDebug(msg));
    }
  }

  /**
   * Log an info message
   * @param msg The message to log
   */
  info(msg: string): void {
    if (this.level <= LogLevel.INFO) {
      console.log(this.formatInfo(msg));
    }
  }

  /**
   * Log a warning message
   * @param msg The message to log
   */
  warn(msg: string): void {
    if (this.level <= LogLevel.WARN) {
      console.log(this.formatWarn(msg));
    }
  }

  /**
   * Log an error message
   * @param msg The message to log
   */
  error(msg: string): void {
    if (this.level <= LogLevel.ERROR) {
      console.log(this.formatError(msg));
    }
  }

  /**
   * Set the current log level
   * @param level The new log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Enable or disable colored output
   * @param useColors Whether to use colored output
   */
  setColored(useColors: boolean): void {
    this.useColors = useColors;
  }
}
