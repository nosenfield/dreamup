/**
 * Error Monitor for capturing console errors and warnings during game testing.
 * 
 * This module provides an ErrorMonitor class that listens to console errors
 * and warnings in the browser context and makes them available for analysis.
 * Uses page.evaluate() to override console methods and capture errors.
 * 
 * @module core.error-monitor
 */

import type { AnyPage } from '@browserbasehq/stagehand';
import { Logger } from '../utils/logger';
import type { ConsoleError } from '../types/game-test.types';

/**
 * Configuration for ErrorMonitor.
 */
export interface ErrorMonitorConfig {
  /** Logger instance for structured logging */
  logger: Logger;
}

/**
 * Error Monitor class for capturing console errors and warnings.
 * 
 * Provides methods for starting and stopping console error monitoring,
 * retrieving captured errors, and checking for critical errors.
 * 
 * @example
 * ```typescript
 * const logger = new Logger({ module: 'qa-agent' });
 * const monitor = new ErrorMonitor({ logger });
 * 
 * await monitor.startMonitoring(page);
 * // ... perform game interactions ...
 * const errors = await monitor.getErrors();
 * const hasCritical = await monitor.hasCriticalError();
 * await monitor.stopMonitoring(page);
 * ```
 */
export class ErrorMonitor {
  private readonly logger: Logger;
  private isMonitoring: boolean = false;

  /**
   * Create a new ErrorMonitor instance.
   * 
   * @param config - Configuration object with logger
   */
  constructor(config: ErrorMonitorConfig) {
    this.logger = config.logger;
  }

  /**
   * Start monitoring console errors and warnings.
   * 
   * Overrides console.error() and console.warn() in the browser context
   * to capture all errors and warnings. Errors are stored in a global
   * array accessible via getErrors().
   * 
   * @param page - Stagehand Page object
   * @throws {Error} If monitoring fails (logged but not thrown)
   * 
   * @example
   * ```typescript
   * await monitor.startMonitoring(page);
   * ```
   */
  async startMonitoring(page: AnyPage): Promise<void> {
    if (this.isMonitoring) {
      this.logger.warn('Error monitoring already active', {});
      return;
    }

    this.logger.info('Starting error monitoring', {});

    try {
      await (page as any).evaluate(() => {
        // @ts-ignore - Code runs in browser context where window exists
        // Initialize error storage if it doesn't exist
        if (!window.__qaErrors) {
          window.__qaErrors = [];
        }

        // Store original console methods
        const originalError = console.error;
        const originalWarn = console.warn;

        // Override console.error
        console.error = (...args: any[]) => {
          // Call original to preserve normal console behavior
          originalError.apply(console, args);
          
          // Capture error
          // @ts-ignore - Code runs in browser context
          window.__qaErrors.push({
            message: args.map(arg => {
              if (typeof arg === 'string') return arg;
              if (arg instanceof Error) return arg.message;
              try {
                return JSON.stringify(arg);
              } catch {
                return String(arg);
              }
            }).join(' '),
            timestamp: Date.now(),
            level: 'error',
          });
        };

        // Override console.warn
        console.warn = (...args: any[]) => {
          // Call original to preserve normal console behavior
          originalWarn.apply(console, args);
          
          // Capture warning
          // @ts-ignore - Code runs in browser context
          window.__qaErrors.push({
            message: args.map(arg => {
              if (typeof arg === 'string') return arg;
              if (arg instanceof Error) return arg.message;
              try {
                return JSON.stringify(arg);
              } catch {
                return String(arg);
              }
            }).join(' '),
            timestamp: Date.now(),
            level: 'warning',
          });
        };

        // Store original methods for cleanup
        // @ts-ignore - Code runs in browser context
        window.__qaOriginalConsole = {
          error: originalError,
          warn: originalWarn,
        };

        // Also listen to unhandled errors
        // @ts-ignore - Code runs in browser context where window.onerror exists
        window.onerror = (message: any, source?: any, lineno?: any, colno?: any, error?: any) => {
          // @ts-ignore - Code runs in browser context
          window.__qaErrors.push({
            message: error?.message || String(message),
            timestamp: Date.now(),
            level: 'error',
          });
        };

        // Listen to unhandled promise rejections
        // @ts-ignore - Code runs in browser context where window.onunhandledrejection exists
        window.onunhandledrejection = (event: any) => {
          // @ts-ignore - Code runs in browser context
          window.__qaErrors.push({
            message: event.reason?.message || String(event.reason),
            timestamp: Date.now(),
            level: 'error',
          });
        };
      });

      this.isMonitoring = true;
      this.logger.info('Error monitoring started successfully', {});
    } catch (error) {
      this.logger.error('Failed to start error monitoring', {
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      // Don't throw - monitoring is best-effort
    }
  }

  /**
   * Get all captured console errors and warnings.
   * 
   * @param page - Stagehand Page object
   * @returns Promise that resolves to array of ConsoleError objects
   * 
   * @example
   * ```typescript
   * const errors = await monitor.getErrors(page);
   * console.log(`Found ${errors.length} errors`);
   * ```
   */
  async getErrors(page: AnyPage): Promise<ConsoleError[]> {
    try {
      const errors = await (page as any).evaluate(() => {
        // @ts-ignore - Code runs in browser context where window exists
        return window.__qaErrors || [];
      });

      // Validate and return errors
      if (!Array.isArray(errors)) {
        this.logger.warn('Invalid error array format', {});
        return [];
      }

      return errors.map(error => ({
        message: String(error.message || ''),
        timestamp: typeof error.timestamp === 'number' ? error.timestamp : Date.now(),
        level: error.level === 'warning' ? 'warning' : 'error',
      }));
    } catch (error) {
      this.logger.debug('Failed to retrieve errors', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Check if any errors or warnings were captured.
   * 
   * @param page - Stagehand Page object
   * @returns Promise that resolves to true if any errors/warnings exist
   * 
   * @example
   * ```typescript
   * const hasErrors = await monitor.hasErrors(page);
   * if (hasErrors) {
   *   console.log('Errors detected during test');
   * }
   * ```
   */
  async hasErrors(page: AnyPage): Promise<boolean> {
    const errors = await this.getErrors(page);
    return errors.length > 0;
  }

  /**
   * Check if any critical errors (not warnings) were captured.
   * 
   * Critical errors are JavaScript errors, unhandled exceptions, or
   * unhandled promise rejections. Warnings are not considered critical.
   * 
   * @param page - Stagehand Page object
   * @returns Promise that resolves to true if any critical errors exist
   * 
   * @example
   * ```typescript
   * const hasCritical = await monitor.hasCriticalError(page);
   * if (hasCritical) {
   *   console.log('Critical errors detected');
   * }
   * ```
   */
  async hasCriticalError(page: AnyPage): Promise<boolean> {
    const errors = await this.getErrors(page);
    return errors.some(error => error.level === 'error');
  }

  /**
   * Stop monitoring console errors and warnings.
   * 
   * Restores original console methods and cleans up event listeners.
   * 
   * @param page - Stagehand Page object
   * 
   * @example
   * ```typescript
   * await monitor.stopMonitoring(page);
   * ```
   */
  async stopMonitoring(page: AnyPage): Promise<void> {
    if (!this.isMonitoring) {
      this.logger.debug('Error monitoring not active', {});
      return;
    }

    this.logger.info('Stopping error monitoring', {});

    try {
      await (page as any).evaluate(() => {
        // @ts-ignore - Code runs in browser context where window exists
        // Restore original console methods
        // @ts-ignore - Code runs in browser context where window exists
        if (window.__qaOriginalConsole) {
          // @ts-ignore - Code runs in browser context
          console.error = window.__qaOriginalConsole.error;
          // @ts-ignore - Code runs in browser context
          console.warn = window.__qaOriginalConsole.warn;
          // @ts-ignore - Code runs in browser context
          delete window.__qaOriginalConsole;
        }

        // Clear error handlers
        // @ts-ignore - Code runs in browser context
        window.onerror = null;
        // @ts-ignore - Code runs in browser context
        window.onunhandledrejection = null;
      });

      this.isMonitoring = false;
      this.logger.info('Error monitoring stopped successfully', {});
    } catch (error) {
      this.logger.error('Failed to stop error monitoring', {
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      // Reset state even if cleanup failed
      this.isMonitoring = false;
    }
  }

  /**
   * Check if monitoring is currently active.
   * 
   * @returns True if monitoring is active, false otherwise
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }
}

