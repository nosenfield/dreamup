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
import { GameType } from './game-detector';

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
 * Options for screenshot capture.
 */
export interface CaptureOptions {
  /** Optional game type to determine capture method */
  gameType?: GameType;
  /** Optional game metadata for context */
  metadata?: GameMetadata;
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
 * const screenshot = await capturer.capture(page, 'pre_start');
 * // Returns: { id: 'abc123', path: '/tmp/.../abc123.png', timestamp: 1234567890, stage: 'pre_start' }
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
   * For canvas-based games, uses canvas.toDataURL() for cleaner screenshots.
   * For other games, uses page.screenshot() as fallback.
   * 
   * @param page - The Stagehand page object
   * @param stage - Stage of the test when screenshot is taken
   * @param options - Optional capture options (gameType, metadata)
   * @returns Promise that resolves to Screenshot object
   * @throws {TimeoutError} If screenshot capture exceeds timeout
   * @throws {Error} If page doesn't have screenshot method or save fails
   * 
   * @example
   * ```typescript
   * const screenshot = await capturer.capture(page, 'pre_start');
   * // Or with options:
   * const screenshot = await capturer.capture(page, 'pre_start', { gameType: GameType.CANVAS });
   * ```
   */
  async capture(
    page: AnyPage,
    stage: Screenshot['stage'],
    options?: CaptureOptions
  ): Promise<Screenshot> {
    this.logger.info('Capturing screenshot', {
      stage,
      timeout: this.screenshotTimeout,
      gameType: options?.gameType,
    });

    const pageAny = page as any;

    // Check if this is a canvas game
    const isCanvasGame = await this.isCanvasGame(page, options?.gameType, options?.metadata);

    if (isCanvasGame) {
      // Try canvas capture first
      try {
        this.logger.debug('Attempting canvas screenshot capture', { stage });
        const screenshotBuffer = await withTimeout(
          this.captureCanvasScreenshot(page),
          this.screenshotTimeout,
          `Canvas screenshot capture timed out after ${this.screenshotTimeout}ms`
        ) as Buffer | Uint8Array;

        this.logger.info('Canvas screenshot captured', {
          stage,
          bufferSize: screenshotBuffer.length,
        });

        // Save screenshot via FileManager
        const screenshot = await this.fileManager.saveScreenshot(screenshotBuffer, stage);

        this.logger.info('Canvas screenshot saved successfully', {
          stage,
          screenshotId: screenshot.id,
          screenshotPath: screenshot.path,
        });

        return screenshot;
      } catch (error) {
        // Fallback to page.screenshot() if canvas capture fails
        this.logger.warn('Canvas screenshot capture failed, falling back to page.screenshot()', {
          stage,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Fallback to page.screenshot() for non-canvas games or if canvas capture failed
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
        method: isCanvasGame ? 'fallback' : 'page.screenshot()',
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
   * const screenshots = await capturer.captureAll(page, ['pre_start', 'post_start', 'after_interaction', 'final_state']);
   * // Returns: [{ id: '...', stage: 'pre_start', ... }, ...]
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
   * For pre_start or post_start stage: Waits for loading indicators before capturing.
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
   * const screenshot = await capturer.captureAtOptimalTime(page, 'pre_start', metadata);
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
    // Pass metadata to capture() for canvas detection
    return this.capture(page, stage, { metadata });
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

  /**
   * Detect if this is a canvas-based game.
   * 
   * Checks gameType, metadata, or page evaluation to determine if canvas capture should be used.
   * 
   * @param page - The Stagehand page object
   * @param gameType - Optional game type from GameDetector
   * @param metadata - Optional game metadata
   * @returns Promise that resolves to true if canvas game, false otherwise
   * @private
   */
  private async isCanvasGame(
    page: AnyPage,
    gameType?: GameType,
    metadata?: GameMetadata
  ): Promise<boolean> {
    // Check gameType first (most reliable)
    if (gameType === GameType.CANVAS) {
      return true;
    }

    // If explicitly not canvas, return false
    if (gameType && gameType !== GameType.CANVAS) {
      return false;
    }

    // If no gameType provided, check page for canvas element
    const pageAny = page as any;
    if (pageAny.evaluate) {
      try {
        const result = await (pageAny.evaluate(() => {
          // @ts-ignore - Code runs in browser context where document exists
          const canvases = Array.from(document.querySelectorAll('canvas'));
          return {
            hasCanvas: canvases.length > 0,
            canvasCount: canvases.length,
          };
        }) as Promise<{ hasCanvas: boolean; canvasCount: number }>);

        return result.hasCanvas && result.canvasCount > 0;
      } catch (error) {
        // Evaluation failed, fallback to false
        this.logger.debug('Failed to evaluate canvas detection', {
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    }

    return false;
  }

  /**
   * Capture screenshot from canvas element using canvas.toDataURL().
   * 
   * Uses canvas.toDataURL('image/png') to capture canvas content directly,
   * providing cleaner screenshots for canvas-based games without page noise.
   * 
   * @param page - The Stagehand page object
   * @returns Promise that resolves to Buffer containing PNG image data
   * @throws {Error} If canvas element not found or toDataURL() fails
   * @private
   */
  private async captureCanvasScreenshot(page: AnyPage): Promise<Buffer> {
    const pageAny = page as any;
    
    if (!pageAny.evaluate) {
      throw new Error('Page does not have evaluate method');
    }

    const base64Data = await (pageAny.evaluate(() => {
      // @ts-ignore - Code runs in browser context where document exists
      const canvas = document.querySelector('canvas');
      
      if (!canvas) {
        return null;
      }

      // Use canvas.toDataURL() to get base64 PNG
      try {
        return (canvas as HTMLCanvasElement).toDataURL('image/png');
      } catch (error) {
        // Cross-origin or other error
        return null;
      }
    }) as Promise<string | null>);

    if (!base64Data) {
      throw new Error('Canvas element not found or toDataURL() failed');
    }

    // Convert base64 data URL to Buffer
    // Format: "data:image/png;base64,iVBORw0KGgo..."
    const base64Match = base64Data.match(/^data:image\/png;base64,(.+)$/);
    if (!base64Match || !base64Match[1]) {
      throw new Error('Invalid base64 data URL format');
    }

    const base64String = base64Match[1];
    const buffer = Buffer.from(base64String, 'base64');

    return buffer;
  }
}

