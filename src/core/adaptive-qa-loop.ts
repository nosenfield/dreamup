/**
 * Adaptive QA Loop for iterative action-based game testing.
 *
 * This module provides the AdaptiveQALoop class that coordinates an iterative
 * loop of LLM-powered Action Group recommendations and game state analysis.
 * 
 * The loop uses an Action Group-based approach:
 * - Iteration 1: 1-3 Action Groups, each with 1 action (different strategies)
 * - Iteration 2+: 1 Action Group per successful group, each with 1-5 actions
 * - Iteration 3+: 1 Action Group per successful group, each with 1-10 actions
 * 
 * Groups are executed in confidence order within each iteration.
 * Success is measured at the group level (strategy level), not individual action level.
 * 
 * The loop continues until one of the termination conditions is met:
 * - Maximum duration reached
 * - Budget limit reached
 * - LLM recommends completion (returns 0 groups)
 * - Zero successful groups in an iteration
 *
 * @module core.adaptive-qa-loop
 */

import type { AnyPage } from '@browserbasehq/stagehand';
import { Logger, TestPhase } from '../utils/logger';
import type { StateAnalyzer } from './state-analyzer';
import type { GameInteractor } from './game-interactor';
import type { GameMetadata, Action, ActionGroups, ActionGroup, SuccessfulActionGroup, CapturedState } from '../types';
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
  completionReason: 'max_duration' | 'budget_limit' | 'llm_complete' | 'zero_successful_groups' | 'error';
}

/**
 * Adaptive QA Loop class for iterative action-based game testing.
 *
 * Coordinates an iterative loop of:
 * 1. LLM-powered Action Group recommendations
 * 2. Group execution (actions executed in confidence order)
 * 3. State capture and progression checking (at group level)
 * 4. Budget and duration monitoring
 *
 * Uses Action Group-based approach:
 * - Actions grouped by strategy/reasoning
 * - Success measured at group level
 * - Iterations expand successful strategies
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
    let completionReason: AdaptiveLoopResult['completionReason'] = 'max_duration';
    let currentIteration = 1;
    let successfulGroups: SuccessfulActionGroup[] = [];

    this.logger.action('screenshot', {
      stage: 'initial',
      path: currentState.screenshot.path,
      timing: 'loop_start',
    });

    // Outer loop: Iterations (no max, continues until termination)
    while (true) {
      const elapsed = Date.now() - loopStartTime;

      this.logger.iteration(currentIteration, Infinity, {
        elapsed,
        actionsPerformed: actionHistory.length,
        screenshotsCaptured: screenshots.length,
        successfulGroupsFromPreviousIteration: successfulGroups.length,
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

      // Ask LLM: "What Action Groups should I try?"
      const goal = currentIteration === 1
        ? 'Play the game'
        : 'Continue playing and progress through the game';

      this.logger.info('Requesting Action Groups', {
        iteration: currentIteration,
        goal,
        successfulGroupsCount: successfulGroups.length,
      });

      const groups: ActionGroups = await this.stateAnalyzer.analyzeAndRecommendAction(
        {
          html: currentState.html,
          screenshot: currentState.screenshot.path,
          previousActions: actionHistory,
          metadata: this.metadata,
          goal,
        },
        currentIteration,
        successfulGroups.length > 0 ? successfulGroups : undefined
      );

      // If no groups returned, terminate
      if (groups.length === 0) {
        this.logger.info('LLM returned zero groups - terminating', {
          iteration: currentIteration,
        });
        completionReason = 'llm_complete';
        break;
      }

      this.logger.info('Received Action Groups', {
        iteration: currentIteration,
        groupCount: groups.length,
        groups: groups.map(g => ({
          reasoning: g.reasoning,
          confidence: g.confidence,
          actionCount: g.actions.length,
        })),
      });

      // Sort groups by confidence (descending - highest first)
      const sortedGroups = [...groups].sort((a, b) => b.confidence - a.confidence);

      // Track successful groups for this iteration
      const iterationSuccessfulGroups: SuccessfulActionGroup[] = [];

      // Inner loop: Execute groups in confidence order
      for (let groupIndex = 0; groupIndex < sortedGroups.length; groupIndex++) {
        const group = sortedGroups[groupIndex];
        
        // Log action group separator
        this.logger.separator(`\n${'='.repeat(60)}\n>>> Executing Action Group ${groupIndex + 1}/${sortedGroups.length} <<<\n${'='.repeat(60)}`);
        
        // Execute group and assess
        const result = await this.executeActionGroup(page, group, currentState);

        // Add all executed actions to history
        actionHistory.push(...result.executedActions);

        // Add screenshots
        screenshots.push(result.afterScreenshot);

        // If group was successful, track it for next iteration
        if (result.success && result.stateProgressed) {
          iterationSuccessfulGroups.push({
            reasoning: group.reasoning,
            actions: result.executedActions,
            beforeScreenshot: result.beforeScreenshot,
            afterScreenshot: result.afterScreenshot,
            confidence: group.confidence,
          });
        }

        // Update current state for next group
        currentState = result.afterState;
        stateCheckCount++;
      }

      // If zero successful groups, terminate
      if (iterationSuccessfulGroups.length === 0) {
        this.logger.warn('Zero successful groups in iteration', {
          iteration: currentIteration,
          groupCount: groups.length,
        });
        completionReason = 'zero_successful_groups';
        break;
      }

      // Prepare for next iteration
      successfulGroups = iterationSuccessfulGroups;
      currentIteration++;
    }

    const finalCost = calculateEstimatedCost(
      actionHistory.length,
      screenshots.length,
      stateCheckCount
    );

    this.logger.endPhase(TestPhase.ADAPTIVE_QA_LOOP, {
      iterations: currentIteration,
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

  /**
   * Execute an Action Group and assess success at group level.
   * 
   * Executes all actions in the group sequentially, then assesses
   * state progression by comparing before-first-action vs after-last-action.
   * 
   * @param page - The Stagehand page object
   * @param group - The Action Group to execute
   * @param currentState - Current game state before group execution
   * @returns Result with executed actions, screenshots, and success status
   */
  private async executeActionGroup(
    page: AnyPage,
    group: ActionGroup,
    currentState: CapturedState
  ): Promise<{
    executedActions: Action[];
    beforeScreenshot: string;
    afterScreenshot: string;
    beforeState: CapturedState;
    afterState: CapturedState;
    success: boolean;
    stateProgressed: boolean;
  }> {
    this.logger.info('Action Group Details', {
      reasoning: group.reasoning,
      confidence: group.confidence,
      actionCount: group.actions.length,
    });

    // Capture state BEFORE first action
    const beforeState = currentState;
    const beforeScreenshot = beforeState.screenshot.path;

    // Execute all actions in the group
    const executedActions: Action[] = [];
    
    // Log action separator banner
    this.logger.separator(`\n${'-'.repeat(60)}\n--- Executing ${group.actions.length} Action(s) in Group ---\n${'-'.repeat(60)}`);
    
    for (let i = 0; i < group.actions.length; i++) {
      const actionRec = group.actions[i];
      
      // Log individual action separator
      this.logger.separator(`\n--- Action ${i + 1}/${group.actions.length} ---`);

      // Check if LLM says we're done
      if (actionRec.action === 'complete') {
        this.logger.info('LLM recommends completion within group', {
          reasoning: actionRec.reasoning,
          actionIndex: i + 1,
          totalActions: group.actions.length,
        });
        // Still execute the action to record it, but mark as complete
        executedActions.push({
          action: 'complete',
          target: '',
          reasoning: actionRec.reasoning,
          timestamp: Date.now(),
          success: true,
          stateProgressed: true,
        });
        break;
      }

      this.logger.info('Executing action in group', {
        actionIndex: i + 1,
        totalActions: group.actions.length,
        action: actionRec.action,
        confidence: actionRec.confidence,
        reasoning: actionRec.reasoning,
      });

      // Execute action
      const executed = await this.gameInteractor.executeRecommendationPublic(page, actionRec);

      // Wait for state change
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create Action with success (execution result)
      // Note: stateProgressed will be set after all actions are executed
      const action: Action = {
        action: actionRec.action,
        target: actionRec.target,
        reasoning: actionRec.reasoning,
        timestamp: Date.now(),
        success: executed,
        stateProgressed: false, // Will be updated after group assessment
      };

      executedActions.push(action);

      // Log the action
      this.logger.action(actionRec.action, {
        ...(actionRec.action === 'click' && typeof actionRec.target === 'object'
          ? { x: Math.round(actionRec.target.x), y: Math.round(actionRec.target.y) }
          : { key: actionRec.target }),
        confidence: actionRec.confidence,
        reasoning: actionRec.reasoning,
        actionIndex: i + 1,
        totalActions: group.actions.length,
        success: executed,
      });

      if (executed) {
        this.logger.info('Action executed successfully', {
          actionIndex: i + 1,
          action: actionRec.action,
        });
      } else {
        this.logger.warn('Action execution failed', {
          actionIndex: i + 1,
          action: actionRec.action,
        });
      }
    }

    // Capture state AFTER last action
    const afterState = await this.gameInteractor.captureCurrentState(page);
    const afterScreenshot = afterState.screenshot.path;

    // Check if state progressed (compare before-first vs after-last)
    this.logger.debug('Checking state progression for group', {
      reasoning: group.reasoning,
      actionCount: executedActions.length,
    });
    
    const stateProgressed = await this.stateAnalyzer.hasStateProgressed(
      beforeScreenshot,
      afterScreenshot
    );

    // Determine group success: all actions executed AND state progressed
    const allActionsExecuted = executedActions.every(a => a.success);
    const groupSuccess = allActionsExecuted && stateProgressed;

    // Update stateProgressed for all actions in the group
    executedActions.forEach(action => {
      action.stateProgressed = stateProgressed;
    });

    // Log group result
    if (groupSuccess) {
      this.logger.info('Action Group executed successfully and state progressed', {
        reasoning: group.reasoning,
        actionCount: executedActions.length,
      });
    } else if (allActionsExecuted && !stateProgressed) {
      this.logger.warn('Action Group executed but state did not progress', {
        reasoning: group.reasoning,
        actionCount: executedActions.length,
      });
    } else {
      this.logger.warn('Action Group execution failed', {
        reasoning: group.reasoning,
        actionCount: executedActions.length,
        failedActions: executedActions.filter(a => !a.success).length,
      });
    }

    return {
      executedActions,
      beforeScreenshot,
      afterScreenshot,
      beforeState,
      afterState,
      success: groupSuccess,
      stateProgressed,
    };
  }
}

