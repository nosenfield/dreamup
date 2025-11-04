/**
 * Logger utility for structured JSON logging.
 * 
 * This module provides a Logger class that outputs structured JSON logs
 * compatible with CloudWatch and other log aggregation systems. Logs
 * follow a consistent format with timestamp, level, module, operation,
 * correlation ID, message, and optional data/error fields.
 * 
 * @module utils.logger
 */

import type { FeatureFlags } from '../types/config.types';
import { getFeatureFlags } from '../config/feature-flags';

/**
 * Log levels for structured logging.
 * 
 * Levels are ordered from most verbose (trace) to least verbose (fatal).
 */
export enum LogLevel {
  /** Very detailed, hot path debugging (function entry/exit, loop iterations) */
  TRACE = 'trace',
  
  /** Detailed diagnostic info (variable values, intermediate states) */
  DEBUG = 'debug',
  
  /** Important business events (user login, order placed, job completed) */
  INFO = 'info',
  
  /** Recoverable errors, degraded state (retry attempts, fallback used) */
  WARN = 'warn',
  
  /** Errors requiring attention (failed requests, unhandled exceptions) */
  ERROR = 'error',
  
  /** System-level failures (cannot continue, immediate action needed) */
  FATAL = 'fatal',
}

/**
 * Context object for logger instantiation.
 * 
 * Provides default context that will be included in all log entries
 * created by this logger instance.
 */
export interface LoggerContext {
  /** Module name (e.g., "auth", "payment", "ui-core") */
  module?: string;
  
  /** Operation name (e.g., "loginUser", "processPayment") */
  op?: string;
  
  /** Correlation ID for tracing requests across services */
  correlationId?: string;
  
  /** Additional context data (no PII) */
  data?: Record<string, unknown>;
}

/**
 * Structured log entry format.
 * 
 * All log entries follow this format for CloudWatch compatibility.
 */
export interface LogEntry {
  /** ISO8601 timestamp */
  ts: string;
  
  /** Log level (trace|debug|info|warn|error|fatal) */
  level: LogLevel;
  
  /** Module name (optional, from context) */
  module?: string;
  
  /** Operation name (optional, from context) */
  op?: string;
  
  /** Correlation ID for request tracing (optional, from context) */
  correlationId?: string;
  
  /** Human-readable message */
  msg: string;
  
  /** Structured context data (optional, no PII) */
  data?: Record<string, unknown>;
  
  /** Error details (optional, only for error logs) */
  error?: {
    /** Error name (e.g., "Error", "TypeError") */
    name: string;
    
    /** Error message */
    message: string;
    
    /** Error stack trace */
    stack?: string;
  };
}

/**
 * Logger class for structured JSON logging.
 * 
 * Provides methods for logging at different levels (info, warn, error, debug)
 * with structured JSON output. All logs are output as JSON strings via
 * console.log for CloudWatch compatibility.
 * 
 * @example
 * ```typescript
 * const logger = new Logger({
 *   module: 'auth',
 *   op: 'loginUser',
 *   correlationId: 'req-123',
 * });
 * 
 * logger.info('User logged in', { userId: '123', method: 'oauth' });
 * logger.error('Login failed', { userId: '123' }, error);
 * ```
 */
export class Logger {
  private context: LoggerContext;
  private flags: FeatureFlags;

  /**
   * Create a new Logger instance.
   * 
   * @param context - Optional context object (module, op, correlationId, data)
   * @param flags - Optional feature flags (defaults to getFeatureFlags())
   */
  constructor(context?: LoggerContext, flags?: FeatureFlags) {
    this.context = context || {};
    this.flags = flags || getFeatureFlags();
  }

  /**
   * Check if a log level should be output.
   * 
   * Debug logs are only shown when enableDetailedLogging is true.
   * All other levels are always shown.
   * 
   * @param level - Log level to check
   * @returns true if log should be output, false otherwise
   */
  private shouldLog(level: LogLevel): boolean {
    if (level === LogLevel.DEBUG || level === LogLevel.TRACE) {
      return this.flags.enableDetailedLogging === true;
    }
    return true;
  }

  /**
   * Format a log entry with all required fields.
   * 
   * Merges context fields with log-specific fields to create
   * a complete log entry.
   * 
   * @param level - Log level
   * @param msg - Human-readable message
   * @param data - Optional additional data
   * @param error - Optional error object
   * @returns Formatted log entry
   */
  private formatLog(
    level: LogLevel,
    msg: string,
    data?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      msg,
    };

    // Add context fields if present
    if (this.context.module) {
      entry.module = this.context.module;
    }
    if (this.context.op) {
      entry.op = this.context.op;
    }
    if (this.context.correlationId) {
      entry.correlationId = this.context.correlationId;
    }

    // Merge context data with log-specific data
    const mergedData = { ...this.context.data, ...data };
    if (Object.keys(mergedData).length > 0) {
      entry.data = mergedData;
    }

    // Add error details if present
    if (error) {
      entry.error = {
        name: error.name || 'Error',
        message: error.message || 'Unknown error',
        stack: error.stack,
      };
    }

    return entry;
  }

  /**
   * Output a log entry as JSON string.
   * 
   * Uses console.log to output structured JSON for CloudWatch compatibility.
   * 
   * @param entry - Log entry to output
   */
  private output(entry: LogEntry): void {
    console.log(JSON.stringify(entry));
  }

  /**
   * Log an info-level message.
   * 
   * Use for important business events (user login, order placed, job completed).
   * 
   * @param msg - Human-readable message
   * @param data - Optional additional context data
   */
  info(msg: string, data?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const entry = this.formatLog(LogLevel.INFO, msg, data);
      this.output(entry);
    }
  }

  /**
   * Log a warn-level message.
   * 
   * Use for recoverable errors or degraded state (retry attempts, fallback used).
   * 
   * @param msg - Human-readable message
   * @param data - Optional additional context data
   */
  warn(msg: string, data?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const entry = this.formatLog(LogLevel.WARN, msg, data);
      this.output(entry);
    }
  }

  /**
   * Log an error-level message.
   * 
   * Use for errors requiring attention (failed requests, unhandled exceptions).
   * 
   * @param msg - Human-readable message
   * @param data - Optional additional context data
   * @param error - Optional Error object to include error details
   */
  error(
    msg: string,
    data?: Record<string, unknown>,
    error?: Error
  ): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const entry = this.formatLog(LogLevel.ERROR, msg, data, error);
      this.output(entry);
    }
  }

  /**
   * Log a debug-level message.
   * 
   * Use for detailed diagnostic info (variable values, intermediate states).
   * Only logs when enableDetailedLogging is true.
   * 
   * @param msg - Human-readable message
   * @param data - Optional additional context data
   */
  debug(msg: string, data?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const entry = this.formatLog(LogLevel.DEBUG, msg, data);
      this.output(entry);
    }
  }
}

