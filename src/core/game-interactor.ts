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

/**
 * Configuration for GameInteractor.
 */
export interface GameInteractorConfig {
  /** Logger instance for structured logging */
  logger: Logger;
  
  /** Optional timeout for interactions (default: INTERACTION_TIMEOUT) */
  interactionTimeout?: number;
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
}

