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
 * Test phases for phase-based logging.
 * 
 * Used to visually separate different phases of the test execution
 * with clear banners in the logs.
 */
export enum TestPhase {
  INITIALIZATION = 'initialization',
  NAVIGATION = 'navigation',
  GAME_DETECTION = 'game_detection',
  START_BUTTON_DETECTION = 'start_button_detection',
  GAMEPLAY_SIMULATION = 'gameplay_simulation',
  ADAPTIVE_QA_LOOP = 'adaptive_qa_loop',
  VISION_ANALYSIS = 'vision_analysis',
  SCREENSHOT_CAPTURE = 'screenshot_capture',
  CLEANUP = 'cleanup',
}

/**
 * Action details for action logging.
 */
export interface ActionDetails {
  x?: number;
  y?: number;
  target?: string;
  strategy?: string;
  key?: string;
  duration?: number;
  stage?: string;
  path?: string;
  timing?: string;
  confidence?: number;
  reasoning?: string;
  [key: string]: unknown;
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
  private logLevel: LogLevel;
  private currentPhase?: TestPhase;

  /**
   * Parse log level from environment variable.
   * 
   * @param envValue - Value from LOG_LEVEL environment variable
   * @param flags - Feature flags (for DEBUG backward compatibility)
   * @returns Parsed log level, defaults to INFO
   */
  private static parseLogLevel(envValue: string | undefined, flags: FeatureFlags): LogLevel {
    // Backward compatibility: DEBUG flag sets log level to DEBUG
    if (flags.enableDetailedLogging && !envValue) {
      return LogLevel.DEBUG;
    }

    if (!envValue) {
      return LogLevel.INFO;
    }

    const levelMap: Record<string, LogLevel> = {
      trace: LogLevel.TRACE,
      debug: LogLevel.DEBUG,
      info: LogLevel.INFO,
      warn: LogLevel.WARN,
      error: LogLevel.ERROR,
      fatal: LogLevel.FATAL,
    };

    const normalized = envValue.toLowerCase();
    return levelMap[normalized] || LogLevel.INFO;
  }

  /**
   * Create a new Logger instance.
   * 
   * @param context - Optional context object (module, op, correlationId, data)
   * @param flags - Optional feature flags (defaults to getFeatureFlags())
   */
  constructor(context?: LoggerContext, flags?: FeatureFlags) {
    this.context = context || {};
    this.flags = flags || getFeatureFlags();
    this.logLevel = Logger.parseLogLevel(process.env.LOG_LEVEL, this.flags);
  }

  /**
   * Check if a log level should be output.
   * 
   * Respects LOG_LEVEL environment variable and DEBUG flag for backward compatibility.
   * 
   * @param level - Log level to check
   * @returns true if log should be output, false otherwise
   */
  private shouldLog(level: LogLevel): boolean {
    const levelPriority: Record<LogLevel, number> = {
      [LogLevel.TRACE]: 0,
      [LogLevel.DEBUG]: 1,
      [LogLevel.INFO]: 2,
      [LogLevel.WARN]: 3,
      [LogLevel.ERROR]: 4,
      [LogLevel.FATAL]: 5,
    };

    const currentPriority = levelPriority[this.logLevel];
    const messagePriority = levelPriority[level];

    // Log if message priority >= current log level priority
    return messagePriority >= currentPriority;
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
   * Output a plain string (for phase banners).
   * 
   * @param message - Plain string message to output
   */
  private outputPlain(message: string): void {
    console.log(message);
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
   * Only logs when LOG_LEVEL allows it.
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

  /**
   * Log a trace-level message.
   * 
   * Use for very detailed, hot path debugging (function entry/exit, loop iterations).
   * Only logs when LOG_LEVEL=trace.
   * 
   * @param msg - Human-readable message
   * @param data - Optional additional context data
   */
  trace(msg: string, data?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      const entry = this.formatLog(LogLevel.TRACE, msg, data);
      this.output(entry);
    }
  }

  /**
   * Begin a test phase with a visual banner.
   * 
   * Outputs a clear banner to separate test phases in logs.
   * 
   * @param phase - Test phase to begin
   * @param details - Optional phase details to log
   */
  beginPhase(phase: TestPhase, details?: Record<string, unknown>): void {
    this.currentPhase = phase;
    const phaseName = phase.toUpperCase().replace(/_/g, ' ');
    const banner = `\n${'='.repeat(60)}\n=== BEGIN ${phaseName} ===\n${'='.repeat(60)}`;
    this.outputPlain(banner);
    
    if (details) {
      this.info('Phase details', details);
    }
  }

  /**
   * End a test phase with a visual banner.
   * 
   * Outputs a clear banner to mark the end of a test phase.
   * 
   * @param phase - Test phase to end
   * @param summary - Optional phase summary to log
   */
  endPhase(phase: TestPhase, summary?: Record<string, unknown>): void {
    if (summary) {
      this.info('Phase summary', summary);
    }
    
    const phaseName = phase.toUpperCase().replace(/_/g, ' ');
    const banner = `${'='.repeat(60)}\n=== END ${phaseName} ===\n${'='.repeat(60)}\n`;
    this.outputPlain(banner);
    this.currentPhase = undefined;
  }

  /**
   * Log an iteration separator with visual banner.
   * 
   * Creates a clear visual separator for loop iterations, making it easy
   * to distinguish between different iterations in the logs.
   * 
   * @param iteration - Current iteration number (1-based)
   * @param total - Total number of iterations
   * @param details - Optional iteration details (elapsed time, actions performed, etc.)
   */
  iteration(iteration: number, total: number, details?: Record<string, unknown>): void {
    const banner = `\n${'-'.repeat(60)}\n--- Iteration ${iteration}/${total} ---\n${'-'.repeat(60)}`;
    this.outputPlain(banner);
    
    if (details) {
      this.info('Iteration details', details);
    }
  }

  /**
   * Log an action with formatted details.
   * 
   * Formats action details based on action type (click, keypress, screenshot).
   * 
   * @param actionType - Type of action (click, keypress, screenshot, etc.)
   * @param details - Action details to format and log
   */
  action(actionType: string, details: ActionDetails): void {
    const formatted = this.formatActionDetails(actionType, details);
    this.info(`ACTION: ${actionType}`, formatted);
  }

  /**
   * Format action details based on action type.
   * 
   * @param actionType - Type of action
   * @param details - Raw action details
   * @returns Formatted action details object
   */
  private formatActionDetails(actionType: string, details: ActionDetails): Record<string, unknown> {
    switch (actionType) {
      case 'click':
        return {
          coordinates: details.x !== undefined && details.y !== undefined
            ? `(${details.x}, ${details.y})`
            : undefined,
          target: details.target,
          strategy: details.strategy,
          ...(details.confidence !== undefined && { confidence: details.confidence }),
          ...(details.reasoning !== undefined && { reasoning: details.reasoning }),
        };
      case 'keypress':
        return {
          key: details.key,
          duration: details.duration,
        };
      case 'screenshot':
        return {
          stage: details.stage,
          path: details.path,
          timing: details.timing,
        };
      default:
        return details;
    }
  }
}

