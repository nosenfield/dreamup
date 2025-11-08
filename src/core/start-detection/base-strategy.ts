/**
 * Base strategy interface for start button detection.
 *
 * This module defines the abstract base class and interfaces for all
 * start button detection strategies. Each strategy implements a different
 * approach (DOM, natural language, vision, state analysis).
 *
 * @module core.start-detection.base-strategy
 */

import type { AnyPage } from '@browserbasehq/stagehand';
import type { Logger } from '../../utils/logger';

/**
 * Result of a start button detection attempt.
 */
export interface StartButtonResult {
  /** Whether the start button was found and clicked */
  success: boolean;
  
  /** Name of the strategy used */
  strategy: string;
  
  /** Number of attempts made */
  attempts: number;
  
  /** Duration in milliseconds */
  duration: number;
  
  /** Coordinates where click occurred (if successful) */
  coordinates?: { x: number; y: number };
  
  /** Error message (if failed) */
  error?: string;
}

/**
 * Abstract base class for start button detection strategies.
 *
 * All strategies must implement:
 * - `isAvailable()`: Check if strategy can be used
 * - `execute()`: Perform the detection and click
 *
 * Provides common helper methods:
 * - `postClickDelay()`: Wait after clicking start button
 */
export abstract class BaseStartStrategy {
  /**
   * Create a new strategy instance.
   *
   * @param logger - Logger instance for structured logging
   * @param name - Strategy name (e.g., 'dom', 'natural_language', 'vision')
   */
  constructor(
    protected readonly logger: Logger,
    protected readonly name: string
  ) {}

  /**
   * Check if this strategy is available for use.
   *
   * @returns true if strategy can be used, false otherwise
   */
  abstract isAvailable(): boolean;

  /**
   * Execute the strategy to find and click the start button.
   *
   * @param page - The Stagehand page object
   * @param timeout - Timeout in milliseconds for the operation
   * @returns Promise that resolves to StartButtonResult
   */
  abstract execute(page: AnyPage, timeout: number): Promise<StartButtonResult>;

  /**
   * Wait after clicking start button to allow game to initialize.
   *
   * @param delayMs - Delay in milliseconds
   */
  protected async postClickDelay(delayMs: number): Promise<void> {
    this.logger.debug('Waiting after click', { delayMs });
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}

