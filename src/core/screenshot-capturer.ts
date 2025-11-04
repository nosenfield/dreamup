/**
 * Screenshot Capturer for capturing and saving game screenshots.
 * 
 * This module provides a ScreenshotCapturer class that handles screenshot
 * capture from browser pages and saving them via FileManager. It provides
 * a clean abstraction for screenshot operations with proper error handling
 * and timeout management.
 * 
 * @module core.screenshot-capturer
 */

import type { AnyPage } from '@browserbasehq/stagehand';
import { Logger } from '../utils/logger';
import { FileManager } from '../utils/file-manager';
import { withTimeout } from '../utils/timeout';
import { TIMEOUTS } from '../config/constants';
import type { Screenshot } from '../types/game-test.types';

/**
 * Configuration for ScreenshotCapturer.
 */
export interface ScreenshotCapturerConfig {
  /** Logger instance for structured logging */
  logger: Logger;
  
  /** FileManager instance for saving screenshots */
  fileManager: FileManager;
  
  /** Optional timeout for screenshot capture (default: SCREENSHOT_TIMEOUT) */
  screenshotTimeout?: number;
}

/**
 * Screenshot Capturer class for capturing and saving game screenshots.
 * 
 * Provides methods for capturing screenshots from browser pages and saving
 * them via FileManager. All operations are wrapped with timeouts to ensure
 * they don't exceed allocated time budgets.
 * 
 * @example
 * ```typescript
 * const logger = new Logger({ module: 'qa-agent' });
 * const fileManager = new FileManager(sessionId);
 * const capturer = new ScreenshotCapturer({ logger, fileManager });
 * 
 * const screenshot = await capturer.capture(page, 'initial_load');
 * // Returns: { id: 'abc123', path: '/tmp/.../abc123.png', timestamp: 1234567890, stage: 'initial_load' }
 * ```
 */
export class ScreenshotCapturer {
  private readonly logger: Logger;
  private readonly fileManager: FileManager;
  private readonly screenshotTimeout: number;

  /**
   * Create a new ScreenshotCapturer instance.
   * 
   * @param config - Configuration object with logger, fileManager, and optional timeout
   */
  constructor(config: ScreenshotCapturerConfig) {
    this.logger = config.logger;
    this.fileManager = config.fileManager;
    this.screenshotTimeout = config.screenshotTimeout ?? TIMEOUTS.SCREENSHOT_TIMEOUT;
  }

  /**
   * Capture a screenshot from the page and save it to disk.
   * 
   * Captures a screenshot from the provided page object, saves it via
   * FileManager, and returns a Screenshot object with metadata.
   * 
   * @param page - The Stagehand page object
   * @param stage - Stage of the test when screenshot is taken
   * @returns Promise that resolves to Screenshot object
   * @throws {TimeoutError} If screenshot capture exceeds timeout
   * @throws {Error} If page doesn't have screenshot method or save fails
   * 
   * @example
   * ```typescript
   * const screenshot = await capturer.capture(page, 'initial_load');
   * console.log(`Screenshot saved: ${screenshot.path}`);
   * ```
   */
  async capture(page: AnyPage, stage: Screenshot['stage']): Promise<Screenshot> {
    this.logger.info('Capturing screenshot', {
      stage,
      timeout: this.screenshotTimeout,
    });

    // Validate page has screenshot method
    const pageAny = page as any;
    if (!pageAny.screenshot || typeof pageAny.screenshot !== 'function') {
      const error = new Error('Page does not have screenshot method');
      this.logger.error('Screenshot capture failed - invalid page', {
        error: error.message,
      });
      throw error;
    }

    try {
      // Wrap screenshot capture in timeout
      const screenshotBuffer = await withTimeout(
        pageAny.screenshot(),
        this.screenshotTimeout,
        `Screenshot capture timed out after ${this.screenshotTimeout}ms`
      ) as Buffer | Uint8Array;

      this.logger.info('Screenshot captured from page', {
        stage,
        bufferSize: screenshotBuffer.length,
      });

      // Save screenshot via FileManager
      const screenshot = await this.fileManager.saveScreenshot(screenshotBuffer, stage);

      this.logger.info('Screenshot saved successfully', {
        stage,
        screenshotId: screenshot.id,
        screenshotPath: screenshot.path,
      });

      return screenshot;
    } catch (error) {
      this.logger.error('Screenshot capture failed', {
        stage,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      throw error;
    }
  }
}

