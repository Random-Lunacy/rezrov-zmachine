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
  private static level: LogLevel = LogLevel.INFO; // Global log level
  private static useColors: boolean = typeof process !== 'undefined' && process.stdout.isTTY; // Global color setting

  /**
   * Set the global log level
   * @param level The new global log level
   */
  static setLevel(level: LogLevel): void {
    Logger.level = level;
  }

  /**
   * Enable or disable global colored output
   * @param useColors Whether to use colored output globally
   */
  static setColored(useColors: boolean): void {
    Logger.useColors = useColors;
  }

  private readonly name: string;

  /**
   * Creates a new logger
   * @param name The name of the logger instance
   */
  constructor(name: string) {
    this.name = name;
  }

  /**
   * Format a debug message with optional color
   * @param msg The message to format
   * @returns Formatted message string
   */
  private formatDebug(msg: string): string {
    return Logger.useColors ? `\x1b[36m[DEBUG] [${this.name}] ${msg}\x1b[0m` : `[DEBUG] [${this.name}] ${msg}`;
  }

  /**
   * Format an info message with optional color
   * @param msg The message to format
   * @returns Formatted message string
   */
  private formatInfo(msg: string): string {
    return Logger.useColors ? `\x1b[32m[INFO] [${this.name}] ${msg}\x1b[0m` : `[INFO] [${this.name}] ${msg}`;
  }

  /**
   * Format a warning message with optional color
   * @param msg The message to format
   * @returns Formatted message string
   */
  private formatWarn(msg: string): string {
    return Logger.useColors ? `\x1b[33m[WARN] [${this.name}] ${msg}\x1b[0m` : `[WARN] [${this.name}] ${msg}`;
  }

  /**
   * Format an error message with optional color
   * @param msg The message to format
   * @returns Formatted message string
   */
  private formatError(msg: string): string {
    return Logger.useColors ? `\x1b[31m[ERROR] [${this.name}] ${msg}\x1b[0m` : `[ERROR] [${this.name}] ${msg}`;
  }

  /**
   * Log a debug message
   * @param msg The message to log
   */
  debug(msg: string): void {
    if (Logger.level <= LogLevel.DEBUG) {
      console.log(this.formatDebug(msg));
    }
  }

  /**
   * Log an info message
   * @param msg The message to log
   */
  info(msg: string): void {
    if (Logger.level <= LogLevel.INFO) {
      console.log(this.formatInfo(msg));
    }
  }

  /**
   * Log a warning message
   * @param msg The message to log
   */
  warn(msg: string): void {
    if (Logger.level <= LogLevel.WARN) {
      console.log(this.formatWarn(msg));
    }
  }

  /**
   * Log an error message
   * @param msg The message to log
   */
  error(msg: string): void {
    if (Logger.level <= LogLevel.ERROR) {
      console.log(this.formatError(msg));
    }
  }
}
