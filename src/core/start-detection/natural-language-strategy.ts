/**
 * Natural language strategy for start button detection.
 *
 * This strategy uses Stagehand's natural language commands (page.act())
 * to find and click the start button. It tries multiple phrases:
 * - "click start button"
 * - "click play button"
 * - "press start"
 * - "click begin game"
 *
 * @module core.start-detection.natural-language-strategy
 */

import { BaseStartStrategy, StartButtonResult } from './base-strategy';
import type { AnyPage } from '@browserbasehq/stagehand';
import { withTimeout } from '../../utils/timeout';
import { TIMEOUTS } from '../../config/constants';

/**
 * Natural language strategy for start button detection.
 */
export class NaturalLanguageStrategy extends BaseStartStrategy {
  /**
   * Natural language phrases to try, in priority order.
   */
  private readonly phrases = [
    'click start button',
    'click play button',
    'press start',
    'click begin game',
  ];

  /**
   * Check if natural language strategy is available.
   *
   * @returns true (availability checked at runtime in execute)
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Execute natural language strategy to find and click start button.
   *
   * @param page - The Stagehand page object
   * @param timeout - Timeout in milliseconds
   * @returns Promise that resolves to StartButtonResult
   */
  async execute(page: AnyPage, timeout: number): Promise<StartButtonResult> {
    const startTime = Date.now();
    const pageAny = page as any;

    if (typeof pageAny.act !== 'function') {
      return {
        success: false,
        strategy: 'natural_language',
        attempts: 0,
        duration: Date.now() - startTime,
        error: 'page.act() not available',
      };
    }

    this.logger.debug('Natural language strategy starting', {
      phraseCount: this.phrases.length,
      timeout,
    });

    for (let i = 0; i < this.phrases.length; i++) {
      const phrase = this.phrases[i];

      try {
        this.logger.trace(`Trying natural language [${i + 1}/${this.phrases.length}]`, { phrase });

        await withTimeout(
          pageAny.act(phrase),
          timeout,
          `Natural language timeout: ${phrase}`
        );

        this.logger.action('click', {
          strategy: 'natural_language',
          target: phrase,
        });

        await this.postClickDelay(TIMEOUTS.POST_START_DELAY);

        return {
          success: true,
          strategy: 'natural_language',
          attempts: i + 1,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        this.logger.trace('Natural language command failed', {
          phrase,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      success: false,
      strategy: 'natural_language',
      attempts: this.phrases.length,
      duration: Date.now() - startTime,
      error: 'All phrases failed',
    };
  }
}

