/**
 * DOM selector strategy for start button detection.
 *
 * This strategy uses CSS selectors to find and click the start button.
 * It tries selectors in three tiers:
 * 1. Exact IDs (#start-btn, #play-btn, #begin-btn)
 * 2. Attribute wildcards ([id*="start" i], [class*="play" i], etc.)
 * 3. Text-based fallback (button:has-text("start"), etc.)
 *
 * @module core.start-detection.dom-strategy
 */

import { BaseStartStrategy, StartButtonResult } from './base-strategy';
import type { AnyPage } from '@browserbasehq/stagehand';
import { withTimeout } from '../../utils/timeout';
import { TIMEOUTS } from '../../config/constants';

/**
 * DOM selector strategy for start button detection.
 */
export class DOMStrategy extends BaseStartStrategy {
  /**
   * CSS selectors to try, in priority order.
   * 
   * Tier 1: Exact IDs (fastest, most reliable)
   * Tier 2: Attribute wildcards (broad coverage, case-insensitive)
   * Tier 3: Text-based fallback (case-insensitive, partial match)
   */
  private readonly selectors = [
    // Tier 1: Exact IDs
    '#start-btn',
    '#play-btn',
    '#begin-btn',

    // Tier 2: Attribute wildcards
    '[id*="start" i]',
    '[id*="play" i]',
    '[id*="begin" i]',
    '[class*="start" i]',
    '[class*="play" i]',
    '[class*="begin" i]',
    '[name*="start" i]',
    '[name*="play" i]',
    '[name*="begin" i]',
    '[onclick*="start" i]',
    '[onclick*="play" i]',
    '[onclick*="begin" i]',

    // Tier 3: Text-based fallback
    'button:has-text("start")',
    'button:has-text("play")',
    'button:has-text("begin")',
    'a:has-text("start")',
    'a:has-text("play")',
    'div[role="button"]:has-text("start")',
    'div[role="button"]:has-text("play")',
  ];

  /**
   * Check if DOM strategy is available.
   *
   * @returns true (DOM strategy is always available)
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Execute DOM strategy to find and click start button.
   *
   * @param page - The Stagehand page object
   * @param timeout - Timeout in milliseconds
   * @returns Promise that resolves to StartButtonResult
   */
  async execute(page: AnyPage, timeout: number): Promise<StartButtonResult> {
    const startTime = Date.now();
    const pageAny = page as any;

    this.logger.debug('DOM strategy starting', {
      selectorCount: this.selectors.length,
      timeout,
    });

    for (let i = 0; i < this.selectors.length; i++) {
      const selector = this.selectors[i];

      try {
        this.logger.trace(`Trying DOM selector [${i + 1}/${this.selectors.length}]`, { selector });

        const element = await pageAny.locator(selector).first();
        if (element && (await element.isVisible({ timeout: 1000 }).catch(() => false))) {
          await withTimeout(
            element.click(),
            timeout,
            `DOM click timeout: ${selector}`
          );

          // Get coordinates for logging (approximate from bounding box)
          const box = await element.boundingBox().catch(() => null);
          const coords = box ? { 
            x: Math.round(box.x + box.width / 2), 
            y: Math.round(box.y + box.height / 2) 
          } : undefined;

          this.logger.action('click', {
            strategy: 'dom',
            target: selector,
            x: coords?.x,
            y: coords?.y,
          });

          await this.postClickDelay(TIMEOUTS.POST_START_DELAY);

          return {
            success: true,
            strategy: 'dom',
            attempts: i + 1,
            duration: Date.now() - startTime,
            coordinates: coords,
          };
        }
      } catch (error) {
        this.logger.trace('DOM selector failed', {
          selector,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      success: false,
      strategy: 'dom',
      attempts: this.selectors.length,
      duration: Date.now() - startTime,
      error: 'No selectors matched',
    };
  }
}

