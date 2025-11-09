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
import type { StateAnalyzer } from './state-analyzer';
import type { GameMetadata, ActionRecommendation, CapturedState } from '../types';
import { StartDetector } from './start-detection';

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
  
  /** Optional StateAnalyzer for LLM-powered state analysis (Strategy 3) */
  stateAnalyzer?: StateAnalyzer;
  
  /** Optional game metadata for context in state analysis */
  metadata?: GameMetadata;
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
  private readonly stateAnalyzer?: StateAnalyzer;
  private readonly metadata?: GameMetadata;
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
    this.stateAnalyzer = config.stateAnalyzer;
    this.metadata = config.metadata;
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
    let lastProgressUpdate = startTime;
    const progressUpdateInterval = 5000; // Update every 5 seconds

    while (Date.now() - startTime < duration) {
      // Get next key to press (cycle through available keys)
      const key = this.keyboardKeys[keyIndex % this.keyboardKeys.length];
      keyIndex++;

      try {
        // Use Stagehand's keyPress() method (not keyboard.press())
        // Stagehand Page exposes keyPress directly on the page object
        await page.keyPress(key, { delay: 0 });
        
        // Log each key press as an action
        this.logger.action('keypress', {
          key,
          keyIndex,
          elapsed: Date.now() - startTime,
        });
      } catch (error) {
        this.logger.warn('Key press failed, continuing simulation', {
          key,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next key rather than failing entire simulation
      }

      // Periodic progress updates
      const now = Date.now();
      if (now - lastProgressUpdate >= progressUpdateInterval) {
        const elapsed = now - startTime;
        const progress = Math.round((elapsed / duration) * 100);
        this.logger.info('Gameplay simulation progress', {
          elapsed,
          duration,
          progress: `${progress}%`,
          keysPressed: keyIndex,
          remaining: duration - elapsed,
        });
        lastProgressUpdate = now;
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

    this.logger.info('Keyboard simulation loop completed', {
      keysPressed: keyIndex,
      duration: Date.now() - startTime,
      expectedDuration: duration,
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
    // Round coordinates to integers
    const roundedX = Math.round(x);
    const roundedY = Math.round(y);

    // Validate coordinates
    if (roundedX < 0 || roundedY < 0) {
      const error = new Error(`Invalid coordinates: x=${roundedX}, y=${roundedY}. Coordinates must be non-negative integers.`);
      this.logger.error('Mouse click failed - invalid coordinates', {
        x: roundedX,
        y: roundedY,
        error: error.message,
      });
      throw error;
    }

    this.logger.info('Clicking at coordinates', {
      x: roundedX,
      y: roundedY,
      timeout: this.interactionTimeout,
    });

    // Cast to any to access Stagehand Page methods
    // Stagehand exposes click() directly on the Page object
    const pageAny = page as any;

    try {
      // Use Stagehand's click(x, y) method
      // Stagehand Page exposes click directly with coordinates
      await withTimeout(
        pageAny.click(roundedX, roundedY),
        this.interactionTimeout,
        `Mouse click timed out after ${this.interactionTimeout}ms`
      );

      this.logger.info('Mouse click completed', {
        x: roundedX,
        y: roundedY,
      });
    } catch (error) {
      this.logger.error('Mouse click failed', {
        x: roundedX,
        y: roundedY,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      throw error;
    }
  }

  /**
   * Find and click the start button using multiple strategies.
   *
   * Delegates to StartDetector which coordinates multiple strategies:
   * 1. DOM selector strategy (fastest, most reliable)
   * 2. Natural language strategy (Stagehand page.act())
   * 3. Vision strategy (GPT-4 Vision element detection)
   * 4. State analysis strategy (LLM-powered state analysis)
   *
   * Strategies are tried in order until one succeeds.
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
    const detector = new StartDetector({
      logger: this.logger,
      timeout: timeout ?? this.interactionTimeout,
      visionAnalyzer: this.visionAnalyzer,
      screenshotCapturer: this.screenshotCapturer,
      stateAnalyzer: this.stateAnalyzer,
          metadata: this.metadata,
    });

    const result = await detector.findAndClickStart(page);
    return result.success;
  }

  /**
   * Execute an action recommendation.
   * 
   * Executes the recommended action (click, keypress, wait, or complete)
   * based on the ActionRecommendation from StateAnalyzer.
   * 
   * @param page - The Stagehand page object
   * @param recommendation - Action recommendation to execute
   * @returns Promise that resolves to `true` if action executed successfully, `false` otherwise
   */
  private async executeRecommendation(
    page: AnyPage,
    recommendation: ActionRecommendation
  ): Promise<boolean> {
    try {
      if (recommendation.action === 'complete') {
        this.logger.info('Recommendation indicates goal complete', {
          reasoning: recommendation.reasoning,
        });
        return true;
      }

      if (recommendation.action === 'wait') {
        const duration = typeof recommendation.target === 'number' ? recommendation.target : 1000;
        this.logger.info('Executing wait recommendation', {
          duration,
          reasoning: recommendation.reasoning,
        });
        await new Promise(resolve => setTimeout(resolve, duration));
        return true;
      }

      if (recommendation.action === 'click') {
        if (typeof recommendation.target === 'object' && 'x' in recommendation.target && 'y' in recommendation.target) {
          const { x, y } = recommendation.target;
          const roundedX = Math.round(x);
          const roundedY = Math.round(y);
          this.logger.info('Executing click recommendation', {
            coordinates: { x: roundedX, y: roundedY },
            reasoning: recommendation.reasoning,
            confidence: recommendation.confidence,
          });
          await this.clickAtCoordinates(page, roundedX, roundedY);
          return true;
        } else {
          this.logger.warn('Invalid click recommendation target', {
            target: recommendation.target,
          });
          return false;
        }
      }

      if (recommendation.action === 'keypress') {
        if (typeof recommendation.target === 'string') {
          const key = recommendation.target;
          this.logger.info('Executing keypress recommendation', {
            key,
            reasoning: recommendation.reasoning,
            confidence: recommendation.confidence,
          });
          await withTimeout(
            (page as any).keyPress(key, { delay: 0 }),
            this.interactionTimeout,
            `Keypress "${key}" timed out after ${this.interactionTimeout}ms`
          );
          return true;
        } else {
          this.logger.warn('Invalid keypress recommendation target', {
            target: recommendation.target,
          });
          return false;
        }
      }

      this.logger.warn('Unknown recommendation action', {
        action: recommendation.action,
      });
      return false;
    } catch (error) {
      this.logger.warn('Failed to execute recommendation', {
        action: recommendation.action,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Execute an action recommendation (public wrapper).
   * 
   * Public wrapper for executeRecommendation used by adaptive QA loop.
   * 
   * @param page - The Stagehand page object
   * @param recommendation - Action recommendation to execute
   * @returns Promise that resolves to `true` if action executed successfully, `false` otherwise
   */
  async executeRecommendationPublic(
    page: AnyPage,
    recommendation: ActionRecommendation
  ): Promise<boolean> {
    return this.executeRecommendation(page, recommendation);
  }

  /**
   * Capture current game state (HTML + screenshot).
   * 
   * Captures a snapshot of the current game state including sanitized HTML
   * and a screenshot. Used for adaptive QA loops to track state progression.
   * 
   * @param page - The Stagehand page object
   * @returns Promise that resolves to CapturedState
   * @throws {Error} If screenshotCapturer or stateAnalyzer not available
   * 
   * @example
   * ```typescript
   * const state = await interactor.captureCurrentState(page);
   * // Returns: { html: '...', screenshot: {...}, timestamp: 1234567890 }
   * ```
   */
  async captureCurrentState(page: AnyPage): Promise<CapturedState> {
    if (!this.screenshotCapturer) {
      throw new Error('ScreenshotCapturer required for state capture');
    }
    
    if (!this.stateAnalyzer) {
      throw new Error('StateAnalyzer required for state capture');
    }

    this.logger.debug('Capturing current game state', {});

    // Capture screenshot (use 'after_interaction' stage as placeholder)
    // Pass metadata to capture() for canvas detection
    const screenshot = await this.screenshotCapturer.capture(page, 'after_interaction', {
      metadata: this.metadata,
    });

    // Capture and sanitize HTML using Stagehand's evaluate method
    const html = await (page as any).evaluate(() => {
      // @ts-ignore - Code runs in browser context where document exists
      return document.documentElement.outerHTML;
    }) as string;
    const sanitizedHTML = this.stateAnalyzer.sanitizeHTML(html);

    return {
      html: sanitizedHTML,
      screenshot,
      timestamp: Date.now(),
    };
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

    // Check if game is mouse-only (clicker/idle games)
    const inputType = metadata.inputSchema?.type;
    if (inputType === 'mouse-only') {
      this.logger.info('Detected mouse-only game - using click simulation', {
        clickStrategy: metadata.testingStrategy?.clickStrategy,
      });
      return this.simulateMouseClicks(page, metadata, actualDuration);
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
    let lastProgressUpdate = startTime;
    const progressUpdateInterval = 5000; // Update every 5 seconds

    while (Date.now() - startTime < duration) {
      // Get next key to press (cycle through provided keys)
      const key = keys[keyIndex % keys.length];
      keyIndex++;

      try {
        // Use Stagehand's keyPress() method
        await page.keyPress(key, { delay: 0 });
        
        // Log each key press as an action
        this.logger.action('keypress', {
          key,
          keyIndex,
          elapsed: Date.now() - startTime,
        });
      } catch (error) {
        this.logger.warn('Key press failed, continuing simulation', {
          key,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next key rather than failing entire simulation
      }

      // Periodic progress updates
      const now = Date.now();
      if (now - lastProgressUpdate >= progressUpdateInterval) {
        const elapsed = now - startTime;
        const progress = Math.round((elapsed / duration) * 100);
        this.logger.info('Gameplay simulation progress', {
          elapsed,
          duration,
          progress: `${progress}%`,
          keysPressed: keyIndex,
          remaining: duration - elapsed,
        });
        lastProgressUpdate = now;
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

    this.logger.info('Metadata-driven keyboard simulation loop completed', {
      keysPressed: keyIndex,
      duration: Date.now() - startTime,
      expectedDuration: duration,
    });
  }

  /**
   * Simulate mouse clicks for clicker/idle games.
   *
   * Uses metadata to determine click positions, frequency, and strategy.
   * Supports random grid-based clicking for games with brick/tile grids.
   *
   * @param page - Stagehand Page object
   * @param metadata - GameMetadata with testingStrategy and gridBounds
   * @param duration - Duration in milliseconds
   */
  async simulateMouseClicks(
    page: AnyPage,
    metadata: GameMetadata,
    duration: number
  ): Promise<void> {
    const pageAny = page as any;
    const strategy = metadata.testingStrategy;
    const clicksPerSecond = strategy?.clicksPerSecond ?? 2;
    const gridBounds = strategy?.gridBounds;

    this.logger.info('Starting mouse click simulation', {
      duration,
      clicksPerSecond,
      clickStrategy: strategy?.clickStrategy,
      hasGridBounds: !!gridBounds,
    });

    // Get viewport size for calculating click positions
    const viewport = await pageAny.viewportSize();
    if (!viewport) {
      throw new Error('Failed to get viewport size');
    }

    // Calculate grid bounds from metadata or use defaults
    const bounds = gridBounds ? {
      x: viewport.width * gridBounds.xStart,
      y: viewport.height * gridBounds.yStart,
      width: viewport.width * gridBounds.width,
      height: viewport.height * gridBounds.height,
    } : {
      // Default: center 60% x 80% of screen
      x: viewport.width * 0.2,
      y: viewport.height * 0.1,
      width: viewport.width * 0.6,
      height: viewport.height * 0.8,
    };

    this.logger.debug('Calculated click bounds', {
      viewport: { width: viewport.width, height: viewport.height },
      bounds,
    });

    const startTime = Date.now();
    const delayBetweenClicks = 1000 / clicksPerSecond;
    let clickCount = 0;

    try {
      await withTimeout(
        this._performMouseClickSimulation(pageAny, bounds, duration, delayBetweenClicks),
        this.interactionTimeout,
        `Mouse click simulation timed out after ${this.interactionTimeout}ms`
      );

      this.logger.info('Mouse click simulation completed', {
        duration: Date.now() - startTime,
        clicksPerformed: Math.floor(duration / delayBetweenClicks),
      });
    } catch (error) {
      this.logger.error('Mouse click simulation failed', {
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      throw error;
    }
  }

  /**
   * Internal method to perform mouse click simulation loop.
   *
   * @param page - Stagehand Page object (AnyPage type)
   * @param bounds - Click area bounds { x, y, width, height }
   * @param duration - Duration in milliseconds
   * @param delayBetweenClicks - Delay between clicks in milliseconds
   */
  private async _performMouseClickSimulation(
    page: any,
    bounds: { x: number; y: number; width: number; height: number },
    duration: number,
    delayBetweenClicks: number
  ): Promise<void> {
    const startTime = Date.now();
    let clickCount = 0;
    let lastProgressUpdate = startTime;
    const progressUpdateInterval = 5000; // Update every 5 seconds

    while (Date.now() - startTime < duration) {
      // Generate random position within bounds
      const x = Math.floor(bounds.x + Math.random() * bounds.width);
      const y = Math.floor(bounds.y + Math.random() * bounds.height);

      try {
        await this.clickAtCoordinates(page, x, y);
        clickCount++;

        // Log each click as an action
        this.logger.action('click', {
          coordinates: `(${x}, ${y})`,
          clickIndex: clickCount,
          elapsed: Date.now() - startTime,
        });
      } catch (error) {
        this.logger.warn('Click failed, continuing simulation', {
          position: { x, y },
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next click rather than failing entire simulation
      }

      // Periodic progress updates
      const now = Date.now();
      if (now - lastProgressUpdate >= progressUpdateInterval) {
        const elapsed = now - startTime;
        const progress = Math.round((elapsed / duration) * 100);
        this.logger.info('Gameplay simulation progress', {
          elapsed,
          duration,
          progress: `${progress}%`,
          clicksPerformed: clickCount,
          remaining: duration - elapsed,
        });
        lastProgressUpdate = now;
      }

      // Wait before next click
      const remainingTime = duration - (Date.now() - startTime);
      if (remainingTime <= 0) {
        break;
      }

      // Use smaller delay if we're near the end
      const delay = Math.min(delayBetweenClicks, remainingTime);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.logger.info('Mouse click simulation loop completed', {
      clicksPerformed: clickCount,
      duration: Date.now() - startTime,
      expectedDuration: duration,
    });
  }
}

