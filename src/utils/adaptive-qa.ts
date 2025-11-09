/**
 * Adaptive QA helper functions for budget calculation and screenshot distribution.
 * 
 * This module provides utility functions for managing adaptive QA loops,
 * including budget calculation, cost estimation, and screenshot timing.
 * 
 * @module utils.adaptive-qa
 */

import { ADAPTIVE_COSTS } from '../config/constants';
import type { AdaptiveTestConfig } from '../types/config.types';

/**
 * Calculate maximum number of screenshots based on budget.
 * 
 * Reserves budget for final multi-image analysis, then calculates
 * how many screenshots can be captured with remaining budget.
 * 
 * @param maxBudget - Maximum budget in USD per test
 * @returns Maximum number of screenshots (minimum 3, maximum 20)
 * 
 * @example
 * ```typescript
 * const maxScreenshots = calculateScreenshotBudget(0.50);
 * // Returns ~20 screenshots (0.50 - 0.10 reserved) / 0.02 per screenshot
 * ```
 */
export function calculateScreenshotBudget(maxBudget: number): number {
  const reservedForFinalAnalysis = ADAPTIVE_COSTS.RESERVED_FOR_FINAL_ANALYSIS;
  const costPerScreenshot = ADAPTIVE_COSTS.COST_PER_SCREENSHOT;
  
  const availableBudget = maxBudget - reservedForFinalAnalysis;
  const maxScreenshots = Math.floor(availableBudget / costPerScreenshot);
  
  // Clamp between 3 (minimum) and 20 (maximum)
  return Math.max(3, Math.min(maxScreenshots, 20));
}

/**
 * Calculate estimated cost based on actions and screenshots performed.
 * 
 * Estimates the current cost of the adaptive QA loop based on:
 * - Number of LLM action recommendations (costPerActionRecommendation)
 * - Number of state progression checks (costPerStateCheck)
 * - Number of screenshots captured (costPerScreenshot)
 * 
 * @param actionCount - Number of actions performed
 * @param screenshotCount - Number of screenshots captured
 * @param stateCheckCount - Number of state progression checks performed
 * @returns Estimated cost in USD
 * 
 * @example
 * ```typescript
 * const cost = calculateEstimatedCost(5, 6, 3);
 * // Returns: (5 * 0.02) + (6 * 0.02) + (3 * 0.03) = 0.31
 * ```
 */
export function calculateEstimatedCost(
  actionCount: number,
  screenshotCount: number,
  stateCheckCount: number = 0
): number {
  const actionCost = actionCount * ADAPTIVE_COSTS.COST_PER_ACTION_RECOMMENDATION;
  const screenshotCost = screenshotCount * ADAPTIVE_COSTS.COST_PER_SCREENSHOT;
  const stateCheckCost = stateCheckCount * ADAPTIVE_COSTS.COST_PER_STATE_CHECK;
  
  return actionCost + screenshotCost + stateCheckCost;
}

/**
 * Distribute screenshot timestamps over total duration.
 * 
 * Creates a non-linear distribution with more screenshots early
 * (initial state, start button) and fewer during gameplay.
 * Always includes: t=0 (initial), t=2s (post-start), t=final
 * 
 * @param totalDuration - Total duration in milliseconds
 * @param screenshotCount - Total number of screenshots to capture
 * @returns Array of timestamps in milliseconds when to capture screenshots
 * 
 * @example
 * ```typescript
 * const timestamps = distributeScreenshotsOverTime(60000, 5);
 * // Returns: [0, 2000, 15400, 30800, 46200, 60000]
 * ```
 */
export function distributeScreenshotsOverTime(
  totalDuration: number,
  screenshotCount: number
): number[] {
  const timestamps: number[] = [];
  
  // Always capture: t=0 (initial), t=2s (post-start), t=final
  timestamps.push(0);
  timestamps.push(2000);
  
  // Distribute remaining screenshots between post-start and final
  const remaining = screenshotCount - 3; // -3 for initial, post-start, final
  if (remaining > 0) {
    const interval = (totalDuration - 2000) / (remaining + 1);
    for (let i = 1; i <= remaining; i++) {
      timestamps.push(2000 + (interval * i));
    }
  }
  
  timestamps.push(totalDuration); // Final screenshot
  
  return timestamps.sort((a, b) => a - b); // Ensure sorted
}

/**
 * Merge adaptive config with defaults.
 * 
 * @param config - Partial adaptive config (may override defaults)
 * @returns Complete adaptive config with defaults applied
 */
export function mergeAdaptiveConfig(
  config?: Partial<AdaptiveTestConfig>
): AdaptiveTestConfig {
  const defaults = {
    maxBudget: 0.50,
    maxDuration: 240000,
    screenshotStrategy: 'fixed' as const,
    llmCallStrategy: 'eager' as const,
  };
  
  return {
    ...defaults,
    ...config,
  };
}

