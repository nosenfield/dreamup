/**
 * Game Detector for identifying game types and waiting for game readiness.
 * 
 * This module provides a GameDetector class that detects game types (canvas,
 * iframe, DOM, or unknown) and waits for games to be ready before interaction.
 * Uses multi-signal detection to reliably determine when a game has finished loading.
 * 
 * @module core.game-detector
 */

import type { AnyPage } from '@browserbasehq/stagehand';
import { Logger } from '../utils/logger';
import { withTimeout } from '../utils/timeout';
import { TIMEOUTS } from '../config/constants';

/**
 * Game type enumeration.
 */
export enum GameType {
  /** Canvas-based game (renders to <canvas> element) */
  CANVAS = 'canvas',
  
  /** Iframe-embedded game */
  IFRAME = 'iframe',
  
  /** DOM-based game (uses HTML elements for UI) */
  DOM = 'dom',
  
  /** Unknown game type (cannot determine) */
  UNKNOWN = 'unknown',
}

/**
 * Configuration for GameDetector.
 */
export interface GameDetectorConfig {
  /** Logger instance for structured logging */
  logger: Logger;
  
  /** Optional timeout for ready detection (default: GAME_LOAD_TIMEOUT) */
  readyTimeout?: number;
}

/**
 * Detection results from page evaluation.
 */
interface DetectionResult {
  /** Whether canvas element exists */
  hasCanvas: boolean;
  
  /** Number of canvas elements */
  canvasCount: number;
  
  /** Whether iframe exists */
  hasIframe: boolean;
  
  /** Number of iframe elements */
  iframeCount: number;
  
  /** Whether iframe contains canvas (if iframe exists) */
  iframeHasCanvas?: boolean;
  
  /** Whether game-related DOM elements exist */
  hasGameElements?: boolean;
}

/**
 * Ready state signals from page evaluation.
 */
interface ReadySignals {
  /** Canvas element exists */
  hasCanvas: boolean;
  
  /** Canvas is rendering (has non-black pixels) */
  canvasRendering: boolean;
  
  /** Network is idle (resources loaded) */
  networkIdle: boolean;
  
  /** No loading text visible */
  noLoadingText: boolean;
}

/**
 * Game Detector class for detecting game types and waiting for readiness.
 * 
 * Provides methods for detecting game types (canvas, iframe, DOM) and
 * waiting for games to be ready before interaction. Uses multi-signal
 * detection to reliably determine when a game has finished loading.
 * 
 * @example
 * ```typescript
 * const logger = new Logger({ module: 'qa-agent' });
 * const detector = new GameDetector({ logger });
 * 
 * const gameType = await detector.detectType(page);
 * const isReady = await detector.waitForGameReady(page, 60000);
 * ```
 */
export class GameDetector {
  private readonly logger: Logger;
  private readonly readyTimeout: number;

  /**
   * Create a new GameDetector instance.
   * 
   * @param config - Configuration object with logger and optional timeout
   */
  constructor(config: GameDetectorConfig) {
    this.logger = config.logger;
    this.readyTimeout = config.readyTimeout ?? TIMEOUTS.GAME_LOAD_TIMEOUT;
  }

  /**
   * Detect the type of game on the page.
   * 
   * Checks for canvas elements, iframes, and DOM-based game patterns
   * to determine the game type. Returns UNKNOWN if no game is detected.
   * 
   * Priority order: CANVAS > IFRAME > DOM > UNKNOWN
   * 
   * @param page - Stagehand Page object
   * @returns Promise that resolves to detected GameType
   * @throws {TimeoutError} If detection exceeds timeout
   * 
   * @example
   * ```typescript
   * const gameType = await detector.detectType(page);
   * // Returns GameType.CANVAS, GameType.IFRAME, GameType.DOM, or GameType.UNKNOWN
   * ```
   */
  async detectType(page: AnyPage): Promise<GameType> {
    this.logger.info('Detecting game type', {});

    try {
      const result = await withTimeout(
        this.evaluateDetection(page),
        this.readyTimeout,
        `Game type detection timed out after ${this.readyTimeout}ms`
      );

      // Priority: CANVAS > IFRAME > DOM > UNKNOWN
      if (result.hasCanvas && result.canvasCount > 0) {
        this.logger.info('Detected CANVAS game type', {
          canvasCount: result.canvasCount,
        });
        return GameType.CANVAS;
      }

      if (result.hasIframe && result.iframeCount > 0 && result.iframeHasCanvas) {
        this.logger.info('Detected IFRAME game type', {
          iframeCount: result.iframeCount,
        });
        return GameType.IFRAME;
      }

      if (result.hasGameElements) {
        this.logger.info('Detected DOM game type', {});
        return GameType.DOM;
      }

      this.logger.warn('Could not detect game type', {});
      return GameType.UNKNOWN;
    } catch (error) {
      this.logger.error('Failed to detect game type', {
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      return GameType.UNKNOWN;
    }
  }

  /**
   * Wait for game to be ready before interaction.
   * 
   * Uses multi-signal detection to determine when a game is ready:
   * - Canvas exists
   * - Canvas is rendering (not blank)
   * - Network is idle
   * - No loading text visible
   * 
   * Returns true if 3/4 signals pass (to handle edge cases where
   * one signal may be unreliable).
   * 
   * Polls every 1 second until timeout or ready state detected.
   * 
   * @param page - Stagehand Page object
   * @param timeout - Maximum time to wait in milliseconds
   * @returns Promise that resolves to true if ready, false if timeout
   * 
   * @example
   * ```typescript
   * const isReady = await detector.waitForGameReady(page, 60000);
   * if (!isReady) {
   *   throw new Error('Game failed to load');
   * }
   * ```
   */
  async waitForGameReady(page: AnyPage, timeout: number): Promise<boolean> {
    this.logger.info('Waiting for game ready state', { timeout });

    const startTime = Date.now();
    const pollInterval = 1000; // Poll every 1 second

    while (Date.now() - startTime < timeout) {
      try {
        const signals = await this.evaluateReadySignals(page);
        
        // Count how many signals pass
        const passedSignals = [
          signals.hasCanvas,
          signals.canvasRendering,
          signals.networkIdle,
          signals.noLoadingText,
        ].filter(Boolean).length;

        // Game ready if 3/4 signals pass
        if (passedSignals >= 3) {
          this.logger.info('Game ready state detected', {
            signalsPassed: passedSignals,
            elapsed: Date.now() - startTime,
          });
          return true;
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (error) {
        // Log error but continue polling
        this.logger.debug('Error checking ready signals', {
          error: error instanceof Error ? error.message : String(error),
        });
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    this.logger.warn('Game ready timeout exceeded', {
      timeout,
      elapsed: Date.now() - startTime,
    });
    return false;
  }

  /**
   * Check if canvas is actively rendering (not blank).
   * 
   * Evaluates the page to check if canvas elements exist and have
   * non-black pixels, indicating active rendering.
   * 
   * @param page - Stagehand Page object
   * @returns Promise that resolves to true if canvas is rendering
   */
  async isCanvasRendering(page: AnyPage): Promise<boolean> {
    try {
      const result = await (page as any).evaluate(() => {
        // @ts-ignore - Code runs in browser context where document exists
        const canvas = document.querySelector('canvas');
        if (!canvas) return { hasCanvas: false, canvasHasPixels: false };

        try {
          const ctx = canvas.getContext('2d');
          if (!ctx) return { hasCanvas: true, canvasHasPixels: false };

          // Check if canvas has non-black pixels
          const imageData = ctx.getImageData(0, 0, Math.min(canvas.width, 100), Math.min(canvas.height, 100));
          const hasPixels = imageData.data.some((val: number, index: number) => {
            // Skip alpha channel, check RGB channels
            if (index % 4 === 3) return false;
            return val !== 0;
          });

          return { hasCanvas: true, canvasHasPixels: hasPixels };
        } catch {
          return { hasCanvas: true, canvasHasPixels: false };
        }
      });

      return result.hasCanvas && result.canvasHasPixels;
    } catch (error) {
      this.logger.debug('Failed to check canvas rendering', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Detect if page contains iframe with game content.
   * 
   * Checks for iframe elements and whether they contain canvas elements.
   * 
   * @param page - Stagehand Page object
   * @returns Promise that resolves to true if game iframe detected
   */
  async detectIframe(page: AnyPage): Promise<boolean> {
    try {
      const result = await (page as any).evaluate(() => {
        // @ts-ignore - Code runs in browser context where document exists
        const iframes = Array.from(document.querySelectorAll('iframe'));
        if (iframes.length === 0) {
          return { hasIframe: false, iframeCount: 0, iframeHasCanvas: false };
        }

        // Check if any iframe contains canvas (if accessible)
        let iframeHasCanvas = false;
        for (const iframe of iframes) {
          try {
            // @ts-ignore - Code runs in browser context
            // Cross-origin iframes will throw SecurityError
            const iframeDoc = (iframe as HTMLIFrameElement).contentDocument || (iframe as HTMLIFrameElement).contentWindow?.document;
            if (iframeDoc) {
              const canvas = iframeDoc.querySelector('canvas');
              if (canvas) {
                iframeHasCanvas = true;
                break;
              }
            }
          } catch {
            // Cross-origin iframe - cannot access content
            // Assume it might contain a game (common pattern)
            iframeHasCanvas = true;
            break;
          }
        }

        return {
          hasIframe: true,
          iframeCount: iframes.length,
          iframeHasCanvas,
        };
      });

      return result.hasIframe && result.iframeHasCanvas;
    } catch (error) {
      this.logger.debug('Failed to detect iframe', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Evaluate page to detect game type.
   * 
   * @private
   */
  private async evaluateDetection(page: AnyPage): Promise<DetectionResult> {
    return (page as any).evaluate(() => {
      // @ts-ignore - Code runs in browser context where document exists
      // Check for canvas elements
      const canvases = Array.from(document.querySelectorAll('canvas'));
      const hasCanvas = canvases.length > 0;

      // Check for iframe elements
      // @ts-ignore - Code runs in browser context where document exists
      const iframes = Array.from(document.querySelectorAll('iframe'));
      const hasIframe = iframes.length > 0;

      // Check if iframe contains canvas (if accessible)
      let iframeHasCanvas = false;
      if (hasIframe) {
        for (const iframe of iframes) {
          try {
            // @ts-ignore - Code runs in browser context
            const iframeDoc = (iframe as HTMLIFrameElement).contentDocument || (iframe as HTMLIFrameElement).contentWindow?.document;
            if (iframeDoc) {
              const canvas = iframeDoc.querySelector('canvas');
              if (canvas) {
                iframeHasCanvas = true;
                break;
              }
            }
          } catch {
            // Cross-origin iframe - assume it might contain game
            iframeHasCanvas = true;
            break;
          }
        }
      }

      // Check for game-related DOM elements (fallback detection)
      // @ts-ignore - Code runs in browser context where document exists (all lines below)
      const hasGameElements =
        document.querySelector('[data-game]') !== null ||
        document.querySelector('.game-container') !== null ||
        document.querySelector('#game') !== null ||
        document.body.innerText.toLowerCase().includes('game') ||
        document.title.toLowerCase().includes('game');

      return {
        hasCanvas,
        canvasCount: canvases.length,
        hasIframe,
        iframeCount: iframes.length,
        iframeHasCanvas,
        hasGameElements,
      };
    });
  }

  /**
   * Evaluate page to check ready signals.
   * 
   * @private
   */
  private async evaluateReadySignals(page: AnyPage): Promise<ReadySignals> {
    return (page as any).evaluate(() => {
      // @ts-ignore - Code runs in browser context where document exists
      // Signal 1: Canvas exists
      const hasCanvas = document.querySelector('canvas') !== null;

      // Signal 2: Canvas is rendering (not blank)
      let canvasRendering = false;
      if (hasCanvas) {
        try {
          // @ts-ignore - Code runs in browser context where document exists
          const canvas = document.querySelector('canvas');
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Check small sample of pixels
              const imageData = ctx.getImageData(0, 0, Math.min(canvas.width, 100), Math.min(canvas.height, 100));
              canvasRendering = imageData.data.some((val: number, index: number) => {
                if (index % 4 === 3) return false; // Skip alpha channel
                return val !== 0;
              });
            }
          }
        } catch {
          canvasRendering = false;
        }
      }

      // Signal 3: Network idle (resources loaded)
      // Check if performance API has entries (indicates resources loaded)
      const networkIdle = performance.getEntriesByType('resource').length > 0 ||
        (performance.getEntriesByType('navigation' as any) as PerformanceEntry[]).length > 0;

      // Signal 4: No loading text visible
      // @ts-ignore - Code runs in browser context where document exists
      const bodyText = document.body.innerText.toLowerCase();
      const noLoadingText = !bodyText.match(/loading|please wait|load/i);

      return {
        hasCanvas,
        canvasRendering,
        networkIdle,
        noLoadingText,
      };
    });
  }
}

