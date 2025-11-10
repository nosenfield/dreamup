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
  async execute(page: AnyPage, timeout: number, preStartScreenshotPath?: string): Promise<StartButtonResult> {
    const startTime = Date.now();
    const pageAny = page as any;

    this.logger.debug('DOM strategy starting', {
      selectorCount: this.selectors.length,
      timeout,
    });

    for (let i = 0; i < this.selectors.length; i++) {
      const selector = this.selectors[i];

      try {
        const element = await pageAny.locator(selector).first();
        const isVisible = element && (await element.isVisible({ timeout: 1000 }).catch(() => false));
        
        if (!isVisible) {
          this.logger.debug(`DOM selector [${i + 1}/${this.selectors.length}] not visible`, { selector });
          continue;
        }

        this.logger.info(`DOM selector [${i + 1}/${this.selectors.length}] found and visible, attempting click`, { selector });

        // Click the element - if this succeeds, we're done
        try {
          await withTimeout(
            element.click(),
            timeout,
            `DOM click timeout: ${selector}`
          );

          // Click succeeded! Get coordinates for logging (approximate from bounding box)
          // If this fails, we still return success since the click worked
          let coords: { x: number; y: number } | undefined = undefined;
          try {
            const box = await element.boundingBox();
            if (box) {
              coords = { 
                x: Math.round(box.x + box.width / 2), 
                y: Math.round(box.y + box.height / 2) 
              };
            }
          } catch (boxError) {
            // boundingBox failed but click succeeded - log and continue
            this.logger.debug('Could not get bounding box for clicked element', {
              selector,
              error: boxError instanceof Error ? boxError.message : String(boxError),
            });
          }

          this.logger.action('click', {
            strategy: 'dom',
            target: selector,
            x: coords?.x,
            y: coords?.y,
          });

          // Post-click delay - if this fails, we still return success since the click worked
          await this.postClickDelay(TIMEOUTS.POST_START_DELAY).catch(() => {
            // Delay failed but click succeeded - continue
          });

          // Return immediately after successful click - this exits the entire loop
          return {
            success: true,
            strategy: 'dom',
            attempts: i + 1,
            duration: Date.now() - startTime,
            coordinates: coords,
          };
        } catch (clickError) {
          // Click failed - log and continue to next selector
          this.logger.warn('DOM click failed', {
            selector,
            error: clickError instanceof Error ? clickError.message : String(clickError),
          });
          continue;
        }
      } catch (error) {
        this.logger.debug('DOM selector lookup failed', {
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

