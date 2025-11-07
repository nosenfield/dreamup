/**
 * Stagehand Agent utility functions.
 *
 * Provides helper functions for working with Stagehand's autonomous agent,
 * including instruction building and screenshot extraction.
 *
 * @module utils.stagehand-agent
 */

import type { GameMetadata } from '../types/game-test.types.js';

/**
 * Builds natural language instruction for Stagehand agent from game metadata
 *
 * Generates detailed QA testing instructions including:
 * - Game genre and type
 * - Expected controls (from InputSchema)
 * - Testing objectives (from testingStrategy.instructions or defaults)
 * - Time-based completion criteria
 *
 * @param metadata - Optional game metadata for context
 * @returns Natural language instruction string for agent.execute()
 *
 * @example
 * // With metadata
 * const instruction = buildStagehandInstruction(pongMetadata);
 * // "Test this arcade game. Expected controls: Pause, RightPaddleVertical.
 * //  Your objectives: Start the game; Test paddle controls; Score at least one point.
 * //  Play for about 2 minutes or until you reach a clear completion point."
 *
 * // Without metadata (fallback)
 * const instruction = buildStagehandInstruction();
 * // "Play this browser game and test basic functionality. Try different controls..."
 *
 * @see https://docs.stagehand.dev/v3/basics/agent (agent instruction format)
 * @see _docs/architecture.md (GameMetadata structure)
 */
export function buildStagehandInstruction(metadata?: GameMetadata): string {
  // Fallback for missing metadata
  if (!metadata) {
    return 'Play this browser game and test basic functionality. Try different controls and interactions. Look for any errors or unusual behavior. Play for about 2 minutes or until you reach a clear stopping point.';
  }

  // Extract genre
  const genre = metadata.genre || 'browser game';

  // Extract controls from InputSchema
  const controls: string[] = [];

  if (metadata.inputSchema?.actions) {
    const actionNames = metadata.inputSchema.actions.map(action =>
      typeof action === 'string' ? action : action.name
    );
    controls.push(...actionNames);
  }

  if (metadata.inputSchema?.axes) {
    const axisNames = metadata.inputSchema.axes.map(axis =>
      typeof axis === 'string' ? axis : axis.name
    );
    controls.push(...axisNames);
  }

  const controlsText = controls.length > 0
    ? `Expected controls: ${controls.join(', ')}. `
    : '';

  // Extract testing objectives from testingStrategy
  // Note: TestingStrategy has `instructions` (string), not `goals` (string[])
  // If instructions exist, split by semicolon; otherwise use defaults
  let objectivesText: string;
  if (metadata.testingStrategy?.instructions) {
    // Split instructions by semicolon and clean up whitespace
    const goals = metadata.testingStrategy.instructions
      .split(';')
      .map(g => g.trim())
      .filter(g => g.length > 0);
    objectivesText = `Your objectives: ${goals.join('; ')}.`;
  } else {
    // Default objectives
    const defaultGoals = [
      'Start the game',
      'Test basic controls',
      'Try to progress through gameplay',
    ];
    objectivesText = `Your objectives: ${defaultGoals.join('; ')}.`;
  }

  // Add special instructions if available (more detailed guidance)
  let specialInstructionsText = '';
  if (metadata.specialInstructions) {
    const si = metadata.specialInstructions;
    const parts: string[] = [];

    // Add click targets/strategy
    if (si.clickTargets && Array.isArray(si.clickTargets) && si.clickTargets.length > 0) {
      const target = si.clickTargets[0];
      if (target.selector) {
        parts.push(`Focus on clicking in the area defined by: ${target.selector}`);
      }
      if (target.bounds) {
        parts.push(`Click within bounds: ${target.bounds.description || 'center grid area'}`);
      }
      if (target.frequency) {
        parts.push(`Click frequency: ${target.frequency}`);
      }
    }

    // Add expected behavior
    if (si.expectedBehavior) {
      const eb = si.expectedBehavior;
      if (eb.immediateResponse) {
        parts.push(`You should see: ${eb.immediateResponse}`);
      }
      if (eb.afterMultipleClicks) {
        parts.push(`After multiple clicks: ${eb.afterMultipleClicks}`);
      }
    }

    // Add avoid clicking areas
    if (si.avoidClicking && Array.isArray(si.avoidClicking) && si.avoidClicking.length > 0) {
      parts.push(`Avoid clicking: ${si.avoidClicking.join(', ')}`);
    }

    if (parts.length > 0) {
      specialInstructionsText = ` ${parts.join('. ')}.`;
    }
  }

  // Add validation checks from testingStrategy if available
  let validationText = '';
  if (metadata.testingStrategy?.validationChecks && Array.isArray(metadata.testingStrategy.validationChecks)) {
    const checks = metadata.testingStrategy.validationChecks;
    if (checks.length > 0) {
      validationText = ` Verify: ${checks.join('; ')}.`;
    }
  }

  // Build complete instruction
  return `Test this ${genre} game. ${controlsText}${objectivesText}${specialInstructionsText}${validationText} Play for about 2 minutes or until you reach a clear completion point (like game over, level complete, or winning the game).`;
}

/**
 * Attempts to extract screenshot paths from Stagehand agent actions
 *
 * Checks if agent actions contain screenshot data. Based on current
 * Stagehand documentation, actions likely do NOT include screenshots,
 * but this function provides forward compatibility if API changes.
 *
 * NOTE: Current Stagehand API (v3) does NOT include screenshots in actions.
 * This function provides forward compatibility if future versions add this.
 * For now, always returns empty array - screenshots must be captured manually.
 *
 * @param actions - Array of agent actions from AgentResult
 * @returns Array of screenshot file paths (likely empty with current API)
 *
 * @see https://docs.stagehand.dev/v3/references/agent (AgentAction structure)
 */
export function extractScreenshotsFromActions(actions: any[]): string[] {
  // Current API returns: { type, reasoning, completed, url, timestamp }
  // No screenshot field documented - this is forward compatibility only

  const screenshots: string[] = [];

  for (const action of actions) {
    // Check for screenshot field (may be added in future Stagehand versions)
    if (action.screenshot && typeof action.screenshot === 'string') {
      screenshots.push(action.screenshot);
    }

    // Check for screenshots array field
    if (Array.isArray(action.screenshots)) {
      screenshots.push(...action.screenshots.filter(s => typeof s === 'string'));
    }
  }

  return screenshots;
}

