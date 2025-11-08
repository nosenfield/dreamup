/**
 * Adaptive QA Loop for iterative action-based game testing.
 *
 * This module provides the AdaptiveQALoop class that coordinates an iterative
 * loop of LLM-powered action recommendations and game state analysis. The loop
 * continues until one of the termination conditions is met:
 * - Maximum actions reached
 * - Maximum duration reached
 * - Budget limit reached
 * - LLM recommends completion
 *
 * @module core.adaptive-qa-loop
 */

import type { AnyPage } from '@browserbasehq/stagehand';
import { Logger, TestPhase } from '../utils/logger';
import type { StateAnalyzer } from './state-analyzer';
import type { GameInteractor } from './game-interactor';
import type { GameMetadata, Action, ActionRecommendations } from '../types';
import type { AdaptiveTestConfig } from '../types/config.types';
import { calculateEstimatedCost } from '../utils/adaptive-qa';

/**
 * Result of an adaptive QA loop execution.
 */
export interface AdaptiveLoopResult {
  /** Array of screenshot file paths captured during the loop */
  screenshots: string[];
  
  /** Array of actions performed during the loop */
  actionHistory: Action[];
  
  /** Number of state progression checks performed */
  stateCheckCount: number;
  
  /** Estimated cost in USD for the loop */
  estimatedCost: number;
  
  /** Reason why the loop terminated */
  completionReason: 'max_actions' | 'max_duration' | 'budget_limit' | 'llm_complete' | 'error';
}

/**
 * Adaptive QA Loop class for iterative action-based game testing.
 *
 * Coordinates an iterative loop of:
 * 1. LLM-powered action recommendations
 * 2. Action execution
 * 3. State capture and progression checking
 * 4. Budget and duration monitoring
 *
 * The loop continues until one of the termination conditions is met.
 *
 * @example
 * ```typescript
 * const logger = new Logger({ module: 'qa-agent' });
 * const loop = new AdaptiveQALoop(
 *   logger,
 *   stateAnalyzer,
 *   gameInteractor,
 *   adaptiveConfig,
 *   metadata
 * );
 *
 * const result = await loop.run(page);
 * console.log(`Loop completed: ${result.completionReason}`);
 * ```
 */
export class AdaptiveQALoop {
  /**
   * Create a new AdaptiveQALoop instance.
   *
   * @param logger - Logger instance for structured logging
   * @param stateAnalyzer - StateAnalyzer instance for LLM recommendations
   * @param gameInteractor - GameInteractor instance for action execution
   * @param config - Adaptive test configuration (budget, duration, actions)
   * @param metadata - Optional GameMetadata for context
   */
  constructor(
    private readonly logger: Logger,
    private readonly stateAnalyzer: StateAnalyzer,
    private readonly gameInteractor: GameInteractor,
    private readonly config: AdaptiveTestConfig,
    private readonly metadata?: GameMetadata
  ) {}

  /**
   * Run the adaptive QA loop.
   *
   * Executes an iterative loop of action recommendations, execution, and
   * state analysis until one of the termination conditions is met.
   *
   * @param page - The Stagehand page object
   * @returns Promise that resolves to AdaptiveLoopResult
   */
  async run(page: AnyPage): Promise<AdaptiveLoopResult> {
    this.logger.beginPhase(TestPhase.ADAPTIVE_QA_LOOP, {
      maxActions: this.config.maxActions,
      maxDuration: this.config.maxDuration,
      maxBudget: this.config.maxBudget,
    });

    // Capture initial state
    this.logger.info('Capturing initial state');
    let currentState = await this.gameInteractor.captureCurrentState(page);
    const screenshots: string[] = [currentState.screenshot.path];
    const actionHistory: Action[] = [];

    const loopStartTime = Date.now();
    let stateCheckCount = 0;
    let completionReason: AdaptiveLoopResult['completionReason'] = 'max_actions';

    this.logger.action('screenshot', {
      stage: 'initial',
      path: currentState.screenshot.path,
      timing: 'loop_start',
    });

    for (let i = 0; i < this.config.maxActions; i++) {
      const elapsed = Date.now() - loopStartTime;

      this.logger.iteration(i + 1, this.config.maxActions, {
        elapsed,
        actionsPerformed: actionHistory.length,
        screenshotsCaptured: screenshots.length,
      });

      // Check duration limit
      if (elapsed >= this.config.maxDuration) {
        this.logger.warn('Max duration reached', { elapsed, maxDuration: this.config.maxDuration });
        completionReason = 'max_duration';
        break;
      }

      // Check budget
      const estimatedCost = calculateEstimatedCost(
        actionHistory.length,
        screenshots.length,
        stateCheckCount
      );

      if (estimatedCost >= this.config.maxBudget * 0.9) {
        this.logger.warn('Approaching budget limit', {
          estimatedCost,
          budgetLimit: this.config.maxBudget * 0.9,
        });
        completionReason = 'budget_limit';
        break;
      }

      // Ask LLM: "What should I do next?"
      const goal = i === 0
        ? 'Start the game and begin playing'
        : 'Continue playing and progress through the game';

      this.logger.info('Requesting action recommendations', { goal });

      const recommendations: ActionRecommendations = await this.stateAnalyzer.analyzeAndRecommendAction({
        html: currentState.html,
        screenshot: currentState.screenshot.path,
        previousActions: actionHistory,
        metadata: this.metadata,
        goal,
      });

      this.logger.info('Received recommendations', {
        actionCount: recommendations.length,
        actions: recommendations.map(r => ({
          action: r.action,
          confidence: r.confidence,
        })),
      });

      // Try ALL recommendations in sequence (no early stop on success)
      for (let actionIdx = 0; actionIdx < recommendations.length; actionIdx++) {
        const recommendation = recommendations[actionIdx];

        // Check if LLM says we're done
        if (recommendation.action === 'complete') {
          this.logger.info('LLM recommends completion', {
            reasoning: recommendation.reasoning,
            actionIndex: actionIdx + 1,
            totalActions: recommendations.length,
          });
          completionReason = 'llm_complete';
          break;
        }

        this.logger.info('Executing recommendation', {
          actionIndex: actionIdx + 1,
          totalActions: recommendations.length,
          action: recommendation.action,
          confidence: recommendation.confidence,
          reasoning: recommendation.reasoning,
        });

        // Execute recommended action
        const executed = await this.gameInteractor.executeRecommendationPublic(page, recommendation);

        if (executed) {
          const action: Action = {
            action: recommendation.action,
            target: recommendation.target,
            reasoning: recommendation.reasoning,
            timestamp: Date.now(),
          };
          actionHistory.push(action);

          // Log the action with full details
          this.logger.action(recommendation.action, {
            ...(recommendation.action === 'click' && typeof recommendation.target === 'object'
              ? { x: recommendation.target.x, y: recommendation.target.y }
              : { key: recommendation.target }),
            confidence: recommendation.confidence,
            reasoning: recommendation.reasoning,
            actionIndex: actionIdx + 1,
            totalActions: recommendations.length,
          });
        } else {
          this.logger.warn('Recommendation execution failed', {
            actionIndex: actionIdx + 1,
            totalActions: recommendations.length,
            action: recommendation.action,
            willContinue: actionIdx < recommendations.length - 1,
          });
        }

        // If we hit a 'complete' action, break out of the recommendations loop
        if (completionReason === 'llm_complete') {
          break;
        }
      }

      // If we hit a 'complete' action, break out of the outer loop too
      if (completionReason === 'llm_complete') {
        break;
      }

      // Wait for state change
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Capture new state
      const newState = await this.gameInteractor.captureCurrentState(page);
      screenshots.push(newState.screenshot.path);

      this.logger.action('screenshot', {
        stage: `iteration_${i + 1}`,
        path: newState.screenshot.path,
        timing: 'post_action',
      });

      // Check if state actually changed (detect stuck loops)
      stateCheckCount++;
      this.logger.debug('Checking state progression');
      const hasProgressed = await this.stateAnalyzer.hasStateProgressed(
        currentState.screenshot.path,
        newState.screenshot.path
      );

      if (!hasProgressed && actionHistory.length > 0) {
        this.logger.warn('State has not progressed - may be stuck', {
          lastAction: actionHistory[actionHistory.length - 1].action,
          iteration: i + 1,
        });
      } else if (hasProgressed) {
        this.logger.info('State progressed successfully');
      }

      currentState = newState;
    }

    const finalCost = calculateEstimatedCost(
      actionHistory.length,
      screenshots.length,
      stateCheckCount
    );

    this.logger.endPhase(TestPhase.ADAPTIVE_QA_LOOP, {
      actionsPerformed: actionHistory.length,
      screenshotsCaptured: screenshots.length,
      stateChecks: stateCheckCount,
      estimatedCost: finalCost,
      completionReason,
    });

    return {
      screenshots,
      actionHistory,
      stateCheckCount,
      estimatedCost: finalCost,
      completionReason,
    };
  }
}

