/**
 * Game Interactor for simulating user input in browser-based games.
 *
 * This module provides a GameInteractor class that handles keyboard and mouse
 * interactions with game pages. It supports basic input simulation for automated
 * game testing.
 *
 * IMPORTANT: Uses Stagehand's native Page API, NOT Playwright/Puppeteer API.
 * - Use `page.keyPress(key, options)` NOT `page.keyboard.press(key)`
 * - Use `page.click(x, y, options)` NOT `page.mouse.click(x, y)`
 *
 * See Pattern 8 in memory-bank/systemPatterns.md for details.
 *
 * @module core.game-interactor
 */

import type { AnyPage } from '@browserbasehq/stagehand';
import { Logger } from '../utils/logger';
import { withTimeout } from '../utils/timeout';
import { TIMEOUTS } from '../config/constants';
import { InputSchemaParser } from './input-schema-parser';
import type { VisionAnalyzer } from '../vision/analyzer';
import type { ScreenshotCapturer } from './screenshot-capturer';
import type { GameMetadata, InputAction, InputAxis } from '../types';

/**
 * Configuration for GameInteractor.
 */
export interface GameInteractorConfig {
  /** Logger instance for structured logging */
  logger: Logger;
  
  /** Optional timeout for interactions (default: INTERACTION_TIMEOUT) */
  interactionTimeout?: number;
  
  /** Optional VisionAnalyzer for vision-based element detection fallback */
  visionAnalyzer?: VisionAnalyzer;
  
  /** Optional ScreenshotCapturer for taking screenshots for vision analysis */
  screenshotCapturer?: ScreenshotCapturer;
}

/**
 * Game Interactor class for simulating user input in games.
 * 
 * Provides methods for keyboard input simulation and mouse clicking
 * on game pages. All operations are wrapped with timeouts to ensure
 * they don't exceed allocated time budgets.
 * 
 * @example
 * ```typescript
 * const logger = new Logger({ module: 'qa-agent' });
 * const interactor = new GameInteractor({ logger });
 * 
 * await interactor.simulateKeyboardInput(page, 30000); // 30 seconds
 * await interactor.clickAtCoordinates(page, 100, 200);
 * ```
 */
export class GameInteractor {
  private readonly logger: Logger;
  private readonly interactionTimeout: number;
  private readonly visionAnalyzer?: VisionAnalyzer;
  private readonly screenshotCapturer?: ScreenshotCapturer;
  private readonly inputSchemaParser: InputSchemaParser;

  /**
   * Available keyboard keys for game input simulation.
   */
  private readonly keyboardKeys = [
    'KeyW',      // W - move up
    'KeyA',      // A - move left
    'KeyS',      // S - move down
    'KeyD',      // D - move right
    'ArrowUp',   // Arrow Up
    'ArrowDown', // Arrow Down
    'ArrowLeft', // Arrow Left
    'ArrowRight', // Arrow Right
    'Space',     // Spacebar
    'Enter',     // Enter
  ];

  /**
   * Delay between key presses in milliseconds.
   */
  private readonly keyPressDelay = 150;

  /**
   * Create a new GameInteractor instance.
   * 
   * @param config - Configuration object with logger and optional timeout
   */
  constructor(config: GameInteractorConfig) {
    this.logger = config.logger;
    this.interactionTimeout = config.interactionTimeout ?? TIMEOUTS.INTERACTION_TIMEOUT;
    this.visionAnalyzer = config.visionAnalyzer;
    this.screenshotCapturer = config.screenshotCapturer;
    this.inputSchemaParser = new InputSchemaParser({ logger: config.logger });
  }

  /**
   * Simulate keyboard input for a specified duration.
   * 
   * Sends keyboard events (WASD, arrows, space, enter) to the game page
   * over the specified duration. Keys are sent sequentially with delays
   * between presses to simulate realistic user input.
   * 
   * @param page - The Stagehand page object
   * @param duration - Duration in milliseconds to simulate input
   * @throws {TimeoutError} If interaction exceeds timeout
   * @throws {Error} If page doesn't have keyboard object or interaction fails
   * 
   * @example
   * ```typescript
   * await interactor.simulateKeyboardInput(page, 30000); // 30 seconds
   * ```
   */
  async simulateKeyboardInput(page: AnyPage, duration: number): Promise<void> {
    this.logger.info('Starting keyboard input simulation', {
      duration,
      timeout: this.interactionTimeout,
    });

    // Cast to any to access Stagehand Page methods
    // Stagehand exposes keyPress() directly on the Page object
    const pageAny = page as any;

    try {
      // Wrap entire simulation in timeout
      await withTimeout(
        this._performKeyboardSimulation(pageAny, duration),
        this.interactionTimeout,
        `Keyboard simulation timed out after ${this.interactionTimeout}ms`
      );

      this.logger.info('Keyboard input simulation completed', {
        duration,
      });
    } catch (error) {
      this.logger.error('Keyboard input simulation failed', {
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      throw error;
    }
  }

  /**
   * Internal method to perform keyboard simulation.
   *
   * Uses Stagehand's page.keyPress() API to send keyboard events.
   * Stagehand Page exposes keyPress(key) rather than keyboard.press(key).
   *
   * @param page - Stagehand Page object (AnyPage type)
   * @param duration - Duration in milliseconds
   */
  private async _performKeyboardSimulation(
    page: any,
    duration: number
  ): Promise<void> {
    const startTime = Date.now();
    let keyIndex = 0;

    while (Date.now() - startTime < duration) {
      // Get next key to press (cycle through available keys)
      const key = this.keyboardKeys[keyIndex % this.keyboardKeys.length];
      keyIndex++;

      try {
        // Use Stagehand's keyPress() method (not keyboard.press())
        // Stagehand Page exposes keyPress directly on the page object
        await page.keyPress(key, { delay: 0 });
      } catch (error) {
        this.logger.warn('Key press failed, continuing simulation', {
          key,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next key rather than failing entire simulation
      }

      // Wait before next key press
      const remainingTime = duration - (Date.now() - startTime);
      if (remainingTime <= 0) {
        break;
      }

      // Use smaller delay if we're near the end
      const delay = Math.min(this.keyPressDelay, remainingTime);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.logger.debug('Keyboard simulation loop completed', {
      keysPressed: keyIndex,
      duration: Date.now() - startTime,
    });
  }

  /**
   * Click at specific coordinates on the page.
   * 
   * Performs a mouse click at the specified pixel coordinates.
   * Coordinates are validated to be non-negative integers.
   * 
   * @param page - The Stagehand page object
   * @param x - X coordinate in pixels (0-based, top-left origin)
   * @param y - Y coordinate in pixels (0-based, top-left origin)
   * @throws {TimeoutError} If click exceeds timeout
   * @throws {Error} If coordinates are invalid or page doesn't have mouse object
   * 
   * @example
   * ```typescript
   * await interactor.clickAtCoordinates(page, 100, 200);
   * ```
   */
  async clickAtCoordinates(page: AnyPage, x: number, y: number): Promise<void> {
    // Validate coordinates
    if (x < 0 || y < 0 || !Number.isInteger(x) || !Number.isInteger(y)) {
      const error = new Error(`Invalid coordinates: x=${x}, y=${y}. Coordinates must be non-negative integers.`);
      this.logger.error('Mouse click failed - invalid coordinates', {
        x,
        y,
        error: error.message,
      });
      throw error;
    }

    this.logger.info('Clicking at coordinates', {
      x,
      y,
      timeout: this.interactionTimeout,
    });

    // Cast to any to access Stagehand Page methods
    // Stagehand exposes click() directly on the Page object
    const pageAny = page as any;

    try {
      // Use Stagehand's click(x, y) method
      // Stagehand Page exposes click directly with coordinates
      await withTimeout(
        pageAny.click(x, y),
        this.interactionTimeout,
        `Mouse click timed out after ${this.interactionTimeout}ms`
      );

      this.logger.info('Mouse click completed', {
        x,
        y,
      });
    } catch (error) {
      this.logger.error('Mouse click failed', {
        x,
        y,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      throw error;
    }
  }

  /**
   * Find and click the start button using DOM selector, natural language, or vision fallback.
   *
   * Uses a three-strategy approach:
   * 1. First tries direct DOM selection (fastest, most reliable for HTML buttons)
   *    - Looks for common start/play button selectors
   *    - Works for HTML elements above or below canvas
   * 2. Then tries Stagehand's natural language command (`page.act("click start button")`)
   * 3. Finally falls back to vision-based detection if both fail
   *    - Takes a screenshot
   *    - Uses VisionAnalyzer to find clickable elements
   *    - Filters for "start" or "play" buttons
   *    - Clicks at the highest confidence element (>= 0.7)
   *
   * @param page - The Stagehand page object
   * @param timeout - Optional timeout for the operation (default: interactionTimeout)
   * @returns Promise that resolves to `true` if start button was found and clicked, `false` otherwise
   *
   * @example
   * ```typescript
   * const success = await interactor.findAndClickStart(page);
   * if (success) {
   *   console.log('Start button clicked successfully');
   * }
   * ```
   */
  async findAndClickStart(page: AnyPage, timeout?: number): Promise<boolean> {
    const operationTimeout = timeout ?? this.interactionTimeout;
    const pageAny = page as any;

    this.logger.info('Finding and clicking start button', {
      timeout: operationTimeout,
      hasVisionFallback: !!(this.visionAnalyzer && this.screenshotCapturer),
    });

    // Strategy 1: Try direct DOM selection (fastest, works for HTML elements)
    const domSelectors = [
      'button:has-text("Start")',
      'button:has-text("Play")',
      'button:has-text("START GAME")',
      'button:has-text("MORE GAMES")', // Try this too, in case it's the only clickable
      '[onclick*="start" i]',
      '[onclick*="play" i]',
      'a:has-text("Start")',
      'a:has-text("Play")',
      'div[role="button"]:has-text("Start")',
      'div[role="button"]:has-text("Play")',
    ];

    for (const selector of domSelectors) {
      try {
        // Try to find and click the element using standard page.click(selector)
        const element = await pageAny.locator(selector).first();
        if (element && (await element.isVisible({ timeout: 1000 }).catch(() => false))) {
          await withTimeout(
            element.click(),
            operationTimeout,
            `DOM selector click "${selector}" timed out after ${operationTimeout}ms`
          );

          this.logger.info('Start button found using DOM selector', {
            selector,
          });

          // Wait for game to initialize after clicking start
          await new Promise(resolve => setTimeout(resolve, TIMEOUTS.POST_START_DELAY));
          this.logger.debug('Post-click delay completed (DOM selector)', {
            delayMs: TIMEOUTS.POST_START_DELAY,
          });

          return true;
        }
      } catch (error) {
        this.logger.debug('DOM selector failed', {
          selector,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue to next selector
      }
    }

    // Strategy 2: Try natural language commands
    const naturalLanguagePhrases = [
      'click start button',
      'click play button',
      'press start',
      'click begin game',
    ];

    for (const phrase of naturalLanguagePhrases) {
      try {
        if (typeof pageAny.act === 'function') {
          await withTimeout(
            pageAny.act(phrase),
            operationTimeout,
            `Natural language act "${phrase}" timed out after ${operationTimeout}ms`
          );

          this.logger.info('Start button found using natural language', {
            phrase,
          });

          // Wait for game to initialize after clicking start
          await new Promise(resolve => setTimeout(resolve, TIMEOUTS.POST_START_DELAY));
          this.logger.debug('Post-click delay completed (natural language)', {
            delayMs: TIMEOUTS.POST_START_DELAY,
          });

          return true;
        } else {
          // page.act() doesn't exist, skip natural language
          break;
        }
      } catch (error) {
        this.logger.debug('Natural language command failed', {
          phrase,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue to next phrase or fallback
      }
    }

    // Strategy 3: Fallback to vision-based detection
    if (this.visionAnalyzer && this.screenshotCapturer) {
      this.logger.info('Falling back to vision-based start button detection', {});

      try {
        // Take screenshot for vision analysis
        const screenshot = await this.screenshotCapturer.capture(page, 'initial_load');
        
        // Find clickable elements using vision
        const elements = await this.visionAnalyzer.findClickableElements(screenshot.path);

        if (elements.length === 0) {
          this.logger.warn('No clickable elements found in screenshot', {});
          return false;
        }

        // Filter for start/play-related buttons
        const startKeywords = ['start', 'play', 'begin', 'go'];
        const startElements = elements.filter((element) => {
          const labelLower = element.label.toLowerCase();
          return (
            startKeywords.some((keyword) => labelLower.includes(keyword)) &&
            element.confidence >= 0.7
          );
        });

        if (startElements.length === 0) {
          this.logger.warn('No start/play buttons found in clickable elements', {
            elementCount: elements.length,
          });
          return false;
        }

        // Select element with highest confidence
        const bestElement = startElements.reduce((best, current) =>
          current.confidence > best.confidence ? current : best
        );

        this.logger.info('Start button found using vision', {
          label: bestElement.label,
          coordinates: { x: bestElement.x, y: bestElement.y },
          confidence: bestElement.confidence,
        });

        // Click at the coordinates
        await this.clickAtCoordinates(page, bestElement.x, bestElement.y);

        this.logger.info('Start button clicked successfully using vision', {
          label: bestElement.label,
        });

        // Wait for game to initialize after clicking start
        await new Promise(resolve => setTimeout(resolve, TIMEOUTS.POST_START_DELAY));
        this.logger.debug('Post-click delay completed (vision)', {
          delayMs: TIMEOUTS.POST_START_DELAY,
        });

        return true;
      } catch (error) {
        this.logger.warn('Vision-based start button detection failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    }

    // All strategies failed or fallback not available
    this.logger.warn('Could not find start button', {
      domSelectionFailed: true,
      naturalLanguageFailed: true,
      visionFallbackAvailable: !!(this.visionAnalyzer && this.screenshotCapturer),
    });

    return false;
  }

  /**
   * Simulate gameplay using metadata-driven input testing.
   * 
   * Uses GameMetadata to extract targeted controls and test them in priority order:
   * 1. Critical actions (from testingStrategy.criticalActions)
   * 2. Critical axes (from testingStrategy.criticalAxes)
   * 3. Remaining actions
   * 4. Remaining axes
   * 
   * Falls back to generic inputs if metadata is missing or has no keys.
   * 
   * @param page - The Stagehand page object
   * @param metadata - Optional GameMetadata containing input schema and testing strategy
   * @param duration - Optional duration in milliseconds (overrides testingStrategy.interactionDuration if provided)
   * @throws {TimeoutError} If interaction exceeds timeout
   * 
   * @example
   * ```typescript
   * await interactor.simulateGameplayWithMetadata(page, metadata);
   * // Uses testingStrategy.interactionDuration from metadata
   * 
   * await interactor.simulateGameplayWithMetadata(page, metadata, 15000);
   * // Uses provided duration instead
   * ```
   */
  async simulateGameplayWithMetadata(
    page: AnyPage,
    metadata?: GameMetadata,
    duration?: number
  ): Promise<void> {
    // Determine duration: use provided duration, or testingStrategy.interactionDuration, or default
    const actualDuration = duration ?? 
      metadata?.testingStrategy?.interactionDuration ?? 
      30000;

    this.logger.info('Starting metadata-driven gameplay simulation', {
      duration: actualDuration,
      hasMetadata: !!metadata,
      timeout: this.interactionTimeout,
    });

    // If no metadata provided, fallback to generic inputs
    if (!metadata) {
      this.logger.info('No metadata provided - using generic inputs', {});
      return this.simulateKeyboardInput(page, actualDuration);
    }

    // Parse metadata to extract actions and axes
    const parsed = this.inputSchemaParser.parse(metadata);
    const allKeys = this.inputSchemaParser.inferKeybindings(parsed.actions, parsed.axes);

    // If no keys found, fallback to generic inputs
    if (allKeys.length === 0) {
      this.logger.warn('No keys found in metadata - using generic inputs', {});
      return this.simulateKeyboardInput(page, actualDuration);
    }

    // Extract critical inputs from testingStrategy
    const criticalActions = metadata.testingStrategy?.criticalActions ?? [];
    const criticalAxes = metadata.testingStrategy?.criticalAxes ?? [];

    // Build priority key list: critical first, then others
    const criticalKeys: string[] = [];
    const regularKeys: string[] = [];

    // Collect critical action keys
    for (const action of parsed.actions) {
      if (criticalActions.includes(action.name)) {
        criticalKeys.push(...action.keys.map(k => this.mapKeyToStagehandKey(k)));
      } else {
        regularKeys.push(...action.keys.map(k => this.mapKeyToStagehandKey(k)));
      }
    }

    // Collect critical axis keys
    for (const axis of parsed.axes) {
      if (criticalAxes.includes(axis.name)) {
        criticalKeys.push(...axis.keys.map(k => this.mapKeyToStagehandKey(k)));
      } else {
        regularKeys.push(...axis.keys.map(k => this.mapKeyToStagehandKey(k)));
      }
    }

    // Remove duplicates
    const uniqueCriticalKeys = [...new Set(criticalKeys)];
    const uniqueRegularKeys = [...new Set(regularKeys)];

    // Combine: critical first, then regular
    const priorityKeys = [...uniqueCriticalKeys, ...uniqueRegularKeys];

    if (priorityKeys.length === 0) {
      this.logger.warn('No valid keys after mapping - using generic inputs', {});
      return this.simulateKeyboardInput(page, actualDuration);
    }

    this.logger.info('Testing keys from metadata', {
      criticalKeys: uniqueCriticalKeys.length,
      regularKeys: uniqueRegularKeys.length,
      totalKeys: priorityKeys.length,
    });

    // Cast to any to access Stagehand Page methods
    const pageAny = page as any;

    try {
      // Wrap entire simulation in timeout
      await withTimeout(
        this._performMetadataKeyboardSimulation(pageAny, priorityKeys, actualDuration),
        this.interactionTimeout,
        `Metadata-driven simulation timed out after ${this.interactionTimeout}ms`
      );

      this.logger.info('Metadata-driven gameplay simulation completed', {
        duration: actualDuration,
        keysTested: priorityKeys.length,
      });
    } catch (error) {
      this.logger.error('Metadata-driven gameplay simulation failed', {
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      throw error;
    }
  }

  /**
   * Map key name from metadata to Stagehand key code.
   * 
   * Maps common key names to their Stagehand equivalents:
   * - 'w', 'a', 's', 'd' → 'KeyW', 'KeyA', 'KeyS', 'KeyD'
   * - Arrow keys remain as-is
   * - Space, Escape, Enter remain as-is
   * 
   * @param key - Key name from metadata (e.g., 'w', 'ArrowUp', 'Space')
   * @returns Stagehand key code (e.g., 'KeyW', 'ArrowUp', 'Space')
   */
  private mapKeyToStagehandKey(key: string): string {
    const keyMap: Record<string, string> = {
      'w': 'KeyW',
      'a': 'KeyA',
      's': 'KeyS',
      'd': 'KeyD',
      'W': 'KeyW',
      'A': 'KeyA',
      'S': 'KeyS',
      'D': 'KeyD',
    };

    // Return mapped key if exists, otherwise return original (for Arrow keys, Space, etc.)
    return keyMap[key.toLowerCase()] ?? key;
  }

  /**
   * Internal method to perform metadata-driven keyboard simulation.
   *
   * Cycles through provided keys in priority order.
   *
   * @param page - Stagehand Page object (AnyPage type)
   * @param keys - Array of keys to test (in priority order)
   * @param duration - Duration in milliseconds
   */
  private async _performMetadataKeyboardSimulation(
    page: any,
    keys: string[],
    duration: number
  ): Promise<void> {
    const startTime = Date.now();
    let keyIndex = 0;

    while (Date.now() - startTime < duration) {
      // Get next key to press (cycle through provided keys)
      const key = keys[keyIndex % keys.length];
      keyIndex++;

      try {
        // Use Stagehand's keyPress() method
        await page.keyPress(key, { delay: 0 });
      } catch (error) {
        this.logger.warn('Key press failed, continuing simulation', {
          key,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next key rather than failing entire simulation
      }

      // Wait before next key press
      const remainingTime = duration - (Date.now() - startTime);
      if (remainingTime <= 0) {
        break;
      }

      // Use smaller delay if we're near the end
      const delay = Math.min(this.keyPressDelay, remainingTime);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.logger.debug('Metadata-driven keyboard simulation loop completed', {
      keysPressed: keyIndex,
      duration: Date.now() - startTime,
    });
  }
}

