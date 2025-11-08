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
import type { Screenshot, GameMetadata, LoadingIndicator, SuccessIndicator } from '../types/game-test.types';

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

  /**
   * Capture multiple screenshots in parallel.
   * 
   * Captures screenshots for all provided stages simultaneously using Promise.allSettled()
   * to handle partial failures gracefully. Returns array of successfully captured screenshots.
   * 
   * @param page - The Stagehand page object
   * @param stages - Array of stages to capture screenshots for
   * @returns Promise that resolves to array of Screenshot objects (may be fewer than stages if some fail)
   * 
   * @example
   * ```typescript
   * const screenshots = await capturer.captureAll(page, ['initial_load', 'after_interaction', 'final_state']);
   * // Returns: [{ id: '...', stage: 'initial_load', ... }, ...]
   * ```
   */
  async captureAll(page: AnyPage, stages: Screenshot['stage'][]): Promise<Screenshot[]> {
    this.logger.info('Capturing multiple screenshots in parallel', {
      stageCount: stages.length,
      stages,
    });

    const capturePromises = stages.map(stage => 
      this.capture(page, stage).catch(error => {
        this.logger.warn('Screenshot capture failed in parallel capture', {
          stage,
          error: error instanceof Error ? error.message : String(error),
        });
        return null; // Return null for failed captures
      })
    );

    const results = await Promise.all(capturePromises);
    const successfulScreenshots = results.filter((s): s is Screenshot => s !== null);

    this.logger.info('Parallel screenshot capture completed', {
      requested: stages.length,
      successful: successfulScreenshots.length,
      failed: stages.length - successfulScreenshots.length,
    });

    return successfulScreenshots;
  }

  /**
   * Capture a screenshot at optimal time based on metadata indicators.
   * 
   * For initial_load stage: Waits for loading indicators before capturing.
   * For after_interaction stage: Waits for success indicators after interaction.
   * Falls back to immediate capture if no metadata provided or indicators timeout.
   * 
   * @param page - The Stagehand page object
   * @param stage - Stage of the test when screenshot is taken
   * @param metadata - Optional game metadata with loading/success indicators
   * @param indicatorTimeout - Optional timeout for waiting for indicators (default: 5000ms)
   * @returns Promise that resolves to Screenshot object
   * 
   * @example
   * ```typescript
   * const metadata = {
   *   inputSchema: {...},
   *   loadingIndicators: [{ type: 'element', pattern: '#start-btn', ... }],
   * };
   * const screenshot = await capturer.captureAtOptimalTime(page, 'initial_load', metadata);
   * ```
   */
  async captureAtOptimalTime(
    page: AnyPage,
    stage: Screenshot['stage'],
    metadata?: GameMetadata,
    indicatorTimeout: number = 5000
  ): Promise<Screenshot> {
    // If no metadata, fall back to immediate capture
    if (!metadata) {
      this.logger.debug('No metadata provided, capturing immediately', { stage });
      return this.capture(page, stage);
    }

    try {
      if (stage === 'post_start' && metadata.loadingIndicators) {
        // Wait for loading indicators before capturing post-start screenshot
        this.logger.info('Waiting for loading indicators before capture', {
          stage,
          indicatorCount: metadata.loadingIndicators.length,
        });
        await this.waitForIndicators(page, metadata.loadingIndicators, indicatorTimeout);
      } else if (stage === 'after_interaction' && metadata.successIndicators) {
        // Wait for success indicators after interaction
        this.logger.info('Waiting for success indicators after interaction', {
          stage,
          indicatorCount: metadata.successIndicators.length,
        });
        await this.waitForIndicators(page, metadata.successIndicators, indicatorTimeout);
      }
    } catch (error) {
      // If indicator wait fails or times out, log warning but proceed with capture
      this.logger.warn('Indicator wait failed or timed out, proceeding with capture', {
        stage,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Capture screenshot (either after indicators appear or immediately if wait failed)
    return this.capture(page, stage);
  }

  /**
   * Wait for loading or success indicators to appear.
   * 
   * Checks for indicators with appropriate timeouts and falls back gracefully
   * if indicators don't appear within the timeout.
   * 
   * @param page - The Stagehand page object
   * @param indicators - Array of loading or success indicators to wait for
   * @param timeout - Maximum time to wait in milliseconds
   * @private
   */
  private async waitForIndicators(
    page: AnyPage,
    indicators: (LoadingIndicator | SuccessIndicator)[],
    timeout: number
  ): Promise<void> {
    const pageAny = page as any;
    const waitPromises: Promise<void>[] = [];

    for (const indicator of indicators) {
      if (indicator.type === 'element') {
        // Wait for DOM element to appear
        const selector = indicator.pattern || indicator.selector;
        if (selector && pageAny.waitForSelector) {
          waitPromises.push(
            withTimeout(
              pageAny.waitForSelector(selector, { timeout }).catch(() => {
                // Element not found, continue
              }),
              timeout,
              `Timeout waiting for element: ${selector}`
            ).then(() => {})
          );
        }
      } else if (indicator.type === 'text') {
        // Wait for text content to appear
        if (pageAny.evaluate) {
          waitPromises.push(
            withTimeout(
              this.waitForText(pageAny, indicator.pattern, timeout),
              timeout,
              `Timeout waiting for text: ${indicator.pattern}`
            ).catch(() => {
              // Text not found, continue
            })
          );
        }
      }
      // 'network' type is handled by GameDetector, skip here
      // Other types (score_change, animation, etc.) are visual and checked by VisionAnalyzer
    }

    // Wait for at least one indicator to appear (or timeout)
    if (waitPromises.length > 0) {
      await Promise.race(waitPromises);
    }
  }

  /**
   * Wait for text content to appear on the page.
   * 
   * @param page - The page object
   * @param text - Text pattern to search for
   * @param timeout - Maximum time to wait
   * @private
   */
  private async waitForText(page: any, text: string, timeout: number): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      try {
        const pageText = await page.evaluate(() => document.body.innerText);
        if (pageText && pageText.includes(text)) {
          return;
        }
      } catch {
        // Evaluation failed, continue polling
      }
      await new Promise(resolve => setTimeout(resolve, 500)); // Poll every 500ms
    }
    throw new Error(`Text "${text}" not found within timeout`);
  }
}

