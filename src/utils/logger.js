/**
 * 日志工具
 */

export class Logger {
  constructor() {
    this.prefix = '[DailySummary]';
  }

  info(...args) {
    console.log(`${this.prefix}`, ...args);
  }

  warn(...args) {
    console.warn(`${this.prefix} ⚠️`, ...args);
  }

  error(...args) {
    console.error(`${this.prefix} ❌`, ...args);
  }

  success(...args) {
    console.log(`${this.prefix} ✅`, ...args);
  }
}
