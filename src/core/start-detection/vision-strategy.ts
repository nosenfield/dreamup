/**
 * Vision-based strategy for start button detection.
 *
 * This strategy uses GPT-4 Vision to find clickable elements in a screenshot
 * and filters for start/play-related buttons. Falls back to this strategy
 * when DOM and natural language strategies fail.
 *
 * @module core.start-detection.vision-strategy
 */

import { BaseStartStrategy, StartButtonResult } from './base-strategy';
import type { AnyPage } from '@browserbasehq/stagehand';
import type { VisionAnalyzer } from '../../vision/analyzer';
import type { ScreenshotCapturer } from '../screenshot-capturer';
import { TIMEOUTS } from '../../config/constants';
import { categorizeError } from '../../utils/errors';
import { TestPhase } from '../../utils/logger';

/**
 * Vision-based strategy for start button detection.
 */
export class VisionStrategy extends BaseStartStrategy {
  /**
   * Create a new VisionStrategy instance.
   *
   * @param logger - Logger instance for structured logging
   * @param name - Strategy name ('vision')
   * @param visionAnalyzer - VisionAnalyzer instance for element detection
   * @param screenshotCapturer - ScreenshotCapturer instance for taking screenshots
   */
  constructor(
    logger: any,
    name: string,
    private readonly visionAnalyzer: VisionAnalyzer,
    private readonly screenshotCapturer: ScreenshotCapturer
  ) {
    super(logger, name);
  }

  /**
   * Check if vision strategy is available.
   *
   * @returns true (available if dependencies provided)
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Execute vision strategy to find and click start button.
   *
   * @param page - The Stagehand page object
   * @param timeout - Timeout in milliseconds
   * @returns Promise that resolves to StartButtonResult
   */
  async execute(page: AnyPage, timeout: number): Promise<StartButtonResult> {
    const startTime = Date.now();

    this.logger.debug('Vision strategy starting', { timeout });

    try {
      // Take screenshot for vision analysis (pre-start baseline)
      const screenshot = await this.screenshotCapturer.capture(page, 'pre_start');
      this.logger.trace('Screenshot captured for vision analysis', { path: screenshot.path });

      // Find clickable elements using vision
      const elements = await this.visionAnalyzer.findClickableElements(screenshot.path);

      if (elements.length === 0) {
        return {
          success: false,
          strategy: 'vision',
          attempts: 1,
          duration: Date.now() - startTime,
          error: 'No clickable elements found',
        };
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
        return {
          success: false,
          strategy: 'vision',
          attempts: 1,
          duration: Date.now() - startTime,
          error: `No start/play buttons found (found ${elements.length} clickable elements)`,
        };
      }

      // Select element with highest confidence
      const bestElement = startElements.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );

      this.logger.debug('Vision detected start button', {
        label: bestElement.label,
        coordinates: { x: bestElement.x, y: bestElement.y },
        confidence: bestElement.confidence,
      });

      // Click at the coordinates
      const pageAny = page as any;
      await pageAny.click(bestElement.x, bestElement.y);

      this.logger.action('click', {
        strategy: 'vision',
        target: bestElement.label,
        x: bestElement.x,
        y: bestElement.y,
        confidence: bestElement.confidence,
      });

      await this.postClickDelay(TIMEOUTS.POST_START_DELAY);

      return {
        success: true,
        strategy: 'vision',
        attempts: 1,
        duration: Date.now() - startTime,
        coordinates: { x: bestElement.x, y: bestElement.y },
      };
    } catch (error) {
      const qaError = categorizeError(error, TestPhase.START_BUTTON_DETECTION);
      this.logger.debug('Vision strategy error', {
        category: qaError.category,
        message: qaError.message,
        recoverable: qaError.recoverable,
        context: qaError.context,
      });
      return {
        success: false,
        strategy: 'vision',
        attempts: 1,
        duration: Date.now() - startTime,
        error: qaError.message,
      };
    }
  }
}

