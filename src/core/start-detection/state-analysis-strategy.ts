/**
 * LLM state analysis strategy for start button detection.
 *
 * This strategy uses GPT-4 Vision to analyze the game state (HTML + screenshot)
 * and recommend actions. Falls back to this strategy when DOM,
 * natural language, and vision strategies fail.
 *
 * @module core.start-detection.state-analysis-strategy
 */

import { BaseStartStrategy, StartButtonResult } from './base-strategy';
import type { AnyPage } from '@browserbasehq/stagehand';
import type { StateAnalyzer } from '../state-analyzer';
import type { ScreenshotCapturer } from '../screenshot-capturer';
import type { GameMetadata } from '../../types';
import { TIMEOUTS } from '../../config/constants';
import { categorizeError } from '../../utils/errors';
import { TestPhase } from '../../utils/logger';

/**
 * LLM state analysis strategy for start button detection.
 */
export class StateAnalysisStrategy extends BaseStartStrategy {
  /**
   * Create a new StateAnalysisStrategy instance.
   *
   * @param logger - Logger instance for structured logging
   * @param name - Strategy name ('state_analysis')
   * @param stateAnalyzer - StateAnalyzer instance for LLM analysis
   * @param screenshotCapturer - ScreenshotCapturer instance for taking screenshots
   * @param metadata - Optional GameMetadata for context
   */
  constructor(
    logger: any,
    name: string,
    private readonly stateAnalyzer: StateAnalyzer,
    private readonly screenshotCapturer: ScreenshotCapturer,
    private readonly metadata?: GameMetadata
  ) {
    super(logger, name);
  }

  /**
   * Check if state analysis strategy is available.
   *
   * @returns true (available if dependencies provided)
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Execute state analysis strategy to find and click start button.
   *
   * @param page - The Stagehand page object
   * @param timeout - Timeout in milliseconds
   * @returns Promise that resolves to StartButtonResult
   */
  async execute(page: AnyPage, timeout: number): Promise<StartButtonResult> {
    const startTime = Date.now();

    this.logger.debug('State analysis strategy starting', { timeout });

    try {
      // Capture HTML and screenshot for state analysis (pre-start baseline)
      const pageAny = page as any;
      const html = await pageAny.evaluate(() => document.documentElement.outerHTML);
      const screenshot = await this.screenshotCapturer.capture(page, 'pre_start');

      this.logger.trace('State captured for LLM analysis', {
        htmlLength: html.length,
        screenshotPath: screenshot.path,
      });

      // Get sanitized HTML
      const sanitizedHTML = this.stateAnalyzer.sanitizeHTML(html);

      // Ask LLM for recommendation
      const recommendation = await this.stateAnalyzer.analyzeAndRecommendAction({
        html: sanitizedHTML,
        screenshot: screenshot.path,
        previousActions: [],
        metadata: this.metadata,
        goal: 'Find and click the start/play button to begin the game',
      });

      this.logger.debug('LLM recommendation received', {
        action: recommendation.action,
        confidence: recommendation.confidence,
        reasoning: recommendation.reasoning,
      });

      // Execute recommendation
      if (recommendation.action === 'click' && typeof recommendation.target === 'object') {
        const { x, y } = recommendation.target as { x: number; y: number };
        await pageAny.click(x, y);

        this.logger.action('click', {
          strategy: 'state_analysis',
          target: 'LLM recommended',
          x,
          y,
          confidence: recommendation.confidence,
          reasoning: recommendation.reasoning,
        });

        await this.postClickDelay(TIMEOUTS.POST_START_DELAY);

        return {
          success: true,
          strategy: 'state_analysis',
          attempts: 1,
          duration: Date.now() - startTime,
          coordinates: { x, y },
        };
      }

      // Try alternatives if primary failed or wasn't a click
      for (let i = 0; i < recommendation.alternatives.length; i++) {
        const alt = recommendation.alternatives[i];
        if (alt.action === 'click' && typeof alt.target === 'object') {
          const { x, y } = alt.target as { x: number; y: number };

          this.logger.debug('Trying alternative recommendation', {
            alternative: i + 1,
            x,
            y,
          });

          await pageAny.click(x, y);

          this.logger.action('click', {
            strategy: 'state_analysis',
            target: `LLM alternative ${i + 1}`,
            x,
            y,
            reasoning: alt.reasoning,
          });

          await this.postClickDelay(TIMEOUTS.POST_START_DELAY);

          return {
            success: true,
            strategy: 'state_analysis',
            attempts: i + 2,
            duration: Date.now() - startTime,
            coordinates: { x, y },
          };
        }
      }

      return {
        success: false,
        strategy: 'state_analysis',
        attempts: 1 + recommendation.alternatives.length,
        duration: Date.now() - startTime,
        error: 'No click action recommended',
      };
    } catch (error) {
      const qaError = categorizeError(error, TestPhase.START_BUTTON_DETECTION);
      this.logger.debug('State analysis strategy error', {
        category: qaError.category,
        message: qaError.message,
        recoverable: qaError.recoverable,
        context: qaError.context,
      });
      return {
        success: false,
        strategy: 'state_analysis',
        attempts: 1,
        duration: Date.now() - startTime,
        error: qaError.message,
      };
    }
  }
}

