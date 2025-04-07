export enum LogLevel {
  DEBUG,
  INFO,
  WARN,
  ERROR
}

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  debug(msg: string): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${msg}`);
    }
  }

  info(msg: string): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`[INFO] ${msg}`);
    }
  }

  warn(msg: string): void {
    if (this.level <= LogLevel.WARN) {
      console.log(`[WARN] ${msg}`);
    }
  }

  error(msg: string): void {
    if (this.level <= LogLevel.ERROR) {
      console.log(`[ERROR] ${msg}`);
    }
  }
}
