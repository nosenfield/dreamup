/**
 * Start Detector orchestrator for coordinating start button detection strategies.
 *
 * This module provides the StartDetector class that coordinates multiple
 * strategies (DOM, natural language, vision, state analysis) to find and
 * click the start button. Strategies are tried in priority order until
 * one succeeds.
 *
 * @module core.start-detection.start-detector
 */

import type { AnyPage } from '@browserbasehq/stagehand';
import { Logger, TestPhase } from '../../utils/logger';
import { getFeatureFlags } from '../../config/feature-flags';
import { categorizeError } from '../../utils/errors';
import { BaseStartStrategy, StartButtonResult } from './base-strategy';
import { DOMStrategy } from './dom-strategy';
import { NaturalLanguageStrategy } from './natural-language-strategy';
import { VisionStrategy } from './vision-strategy';
import { StateAnalysisStrategy } from './state-analysis-strategy';
import type { VisionAnalyzer } from '../../vision/analyzer';
import type { ScreenshotCapturer } from '../screenshot-capturer';
import type { StateAnalyzer } from '../state-analyzer';
import type { GameMetadata } from '../../types';

/**
 * Configuration for StartDetector.
 */
export interface StartDetectorConfig {
  /** Logger instance for structured logging */
  logger: Logger;
  
  /** Optional timeout for the operation (default: 90000ms) */
  timeout?: number;
  
  /** Optional VisionAnalyzer for vision strategy */
  visionAnalyzer?: VisionAnalyzer;
  
  /** Optional ScreenshotCapturer for vision and state analysis strategies */
  screenshotCapturer?: ScreenshotCapturer;
  
  /** Optional StateAnalyzer for state analysis strategy */
  stateAnalyzer?: StateAnalyzer;
  
  /** Optional GameMetadata for context in state analysis */
  metadata?: GameMetadata;
}

/**
 * Start Detector orchestrator.
 *
 * Coordinates multiple strategies to find and click the start button:
 * 1. DOM selector strategy (fastest, most reliable)
 * 2. Natural language strategy (Stagehand page.act())
 * 3. Vision strategy (GPT-4 Vision element detection)
 * 4. State analysis strategy (LLM-powered state analysis)
 *
 * Strategies are tried in order until one succeeds.
 *
 * @example
 * ```typescript
 * const logger = new Logger({ module: 'qa-agent' });
 * const detector = new StartDetector({
 *   logger,
 *   timeout: 90000,
 *   visionAnalyzer,
 *   screenshotCapturer,
 *   stateAnalyzer,
 *   metadata,
 * });
 *
 * const result = await detector.findAndClickStart(page);
 * if (result.success) {
 *   console.log(`Start button clicked using ${result.strategy}`);
 * }
 * ```
 */
export class StartDetector {
  private readonly strategies: BaseStartStrategy[];
  private readonly logger: Logger;
  private readonly timeout: number;

  /**
   * Create a new StartDetector instance.
   *
   * @param config - Configuration object with logger and optional dependencies
   */
  constructor(config: StartDetectorConfig) {
    this.logger = config.logger;
    this.timeout = config.timeout ?? 90000;

    const flags = getFeatureFlags();

    // Initialize strategies in priority order
    this.strategies = [
      flags.enableDOMStrategy ? new DOMStrategy(this.logger, 'dom') : null,
      flags.enableNaturalLanguageStrategy ? new NaturalLanguageStrategy(this.logger, 'natural_language') : null,
      flags.enableVisionStrategy && config.visionAnalyzer && config.screenshotCapturer
        ? new VisionStrategy(this.logger, 'vision', config.visionAnalyzer, config.screenshotCapturer)
        : null,
      flags.enableStateAnalysisStrategy && config.stateAnalyzer && config.screenshotCapturer
        ? new StateAnalysisStrategy(this.logger, 'state_analysis', config.stateAnalyzer, config.screenshotCapturer, config.metadata)
        : null,
    ].filter((s): s is BaseStartStrategy => s !== null && s.isAvailable());
  }

  /**
   * Find and click the start button using available strategies.
   *
   * Tries strategies in priority order until one succeeds.
   * Logs phase banners and action details using the enhanced logger.
   *
   * @param page - The Stagehand page object
   * @returns Promise that resolves to StartButtonResult
   */
  async findAndClickStart(page: AnyPage): Promise<StartButtonResult> {
    this.logger.beginPhase(TestPhase.START_BUTTON_DETECTION, {
      strategiesAvailable: this.strategies.map(s => (s as any).name),
      timeout: this.timeout,
    });

    for (let i = 0; i < this.strategies.length; i++) {
      const strategy = this.strategies[i];
      const strategyName = (strategy as any).name;

      this.logger.info(`Trying strategy ${i + 1}/${this.strategies.length}: ${strategyName}`);

      try {
        const result = await strategy.execute(page, this.timeout);

        if (result.success) {
          this.logger.info(`Strategy succeeded: ${strategyName}`, {
            attempts: result.attempts,
            duration: result.duration,
            coordinates: result.coordinates,
          });

          this.logger.endPhase(TestPhase.START_BUTTON_DETECTION, {
            success: true,
            strategy: strategyName,
            totalAttempts: result.attempts,
            totalDuration: result.duration,
          });

          return result;
        } else {
          this.logger.warn(`Strategy failed: ${strategyName}`, {
            attempts: result.attempts,
            duration: result.duration,
            error: result.error,
          });
        }
      } catch (error) {
        const qaError = categorizeError(error, TestPhase.START_BUTTON_DETECTION);
        this.logger.error(`Strategy error: ${strategyName}`, {
          category: qaError.category,
          message: qaError.message,
          recoverable: qaError.recoverable,
          context: qaError.context,
        });
      }
    }

    // All strategies failed
    this.logger.endPhase(TestPhase.START_BUTTON_DETECTION, {
      success: false,
      strategiesTried: this.strategies.length,
    });

    return {
      success: false,
      strategy: 'none',
      attempts: this.strategies.length,
      duration: 0,
      error: 'All strategies failed',
    };
  }
}

