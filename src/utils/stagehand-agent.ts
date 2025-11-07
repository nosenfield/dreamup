/**
 * Stagehand Agent utility functions.
 *
 * Provides helper functions for working with Stagehand's autonomous agent,
 * including instruction building, system prompt building, and screenshot extraction.
 *
 * @module utils.stagehand-agent
 */

import type { GameMetadata } from '../types/game-test.types.js';

/**
 * Builds system prompt for Stagehand agent from game metadata
 *
 * Generates a context-aware system prompt that adapts to the game type:
 * - Canvas-based games: Emphasizes coordinate-based clicking and visual analysis
 * - DOM-based games: Emphasizes element selection and interaction
 * - Generic fallback: Standard QA testing prompt
 *
 * @param metadata - Optional game metadata for context
 * @returns System prompt string for agent constructor
 *
 * @example
 * // Canvas-based game
 * const prompt = buildStagehandSystemPrompt(canvasMetadata);
 * // "You are a QA tester for browser games. This is a canvas-based game where
 * //  all content is rendered on HTML5 canvas. Use coordinate-based clicking
 * //  on the canvas element, not DOM selectors..."
 *
 * @see https://docs.stagehand.dev/v3/basics/agent (agent system prompt format)
 */
export function buildStagehandSystemPrompt(metadata?: GameMetadata): string {
  const basePrompt = 'You are a QA tester for browser games. Your goal is to test all functionality, try different controls, look for bugs, and explore the game thoroughly. Report any errors or unusual behavior you encounter.';

  if (!metadata) {
    return basePrompt;
  }

  // Check if this is a canvas-based game
  // Check multiple indicators to be robust
  const hasCanvasBasedFlag = metadata.specialInstructions?.canvasBased === true;
  const hasCanvasClickTargets = metadata.specialInstructions?.clickTargets?.some(t => 
    t.type === 'canvas-coordinates' || t.target === 'canvas'
  ) ?? false;
  const hasCanvasActions = metadata.inputSchema?.actions?.some(a => 
    typeof a === 'object' && (a.target === 'canvas-coordinates' || a.target === 'canvas-ui-area')
  ) ?? false;
  
  const isCanvasBased = hasCanvasBasedFlag || hasCanvasClickTargets || hasCanvasActions;

  if (isCanvasBased) {
    return `${basePrompt}

IMPORTANT: This is a canvas-based game where all content (game elements, UI, buttons) is rendered on an HTML5 canvas element, NOT as DOM elements. 

Key guidelines for canvas-based games:
- Use coordinate-based clicking on the canvas element, not CSS selectors
- Find the canvas element first, then click on coordinates within it
- Visual feedback is critical - observe the canvas for changes after each action
- Cannot use DOM element selectors (querySelector, getElementById) for game elements
- All interactions must be coordinate-based within the canvas bounds
- Use screenshot analysis to verify game state changes (currency, score, animations)
- Click on coordinates where game elements are visually rendered, not where DOM elements might be`;
  }

  // DOM-based game (default)
  return `${basePrompt}

This game uses DOM elements for interaction. Use standard element selection methods (CSS selectors, text matching) to find and interact with game elements.`;
}

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
      
      // Handle canvas-based games differently
      if (si.canvasBased || target.type === 'canvas-coordinates' || target.target === 'canvas') {
        parts.push(`This is a canvas-based game - all content is rendered on an HTML5 canvas element, not as DOM elements`);
        parts.push(`Find the canvas element, then click on coordinates within the canvas where game elements are rendered`);
        if (target.bounds) {
          parts.push(`Click within canvas bounds: ${target.bounds.description || 'center grid area'}`);
          if (target.bounds.xPercent) {
            parts.push(`X coordinates: ${target.bounds.xPercent}`);
          }
          if (target.bounds.yPercent) {
            parts.push(`Y coordinates: ${target.bounds.yPercent}`);
          }
        }
        if (target.instructions) {
          parts.push(target.instructions);
        }
      } else {
        // DOM-based game
        if (target.selector) {
          parts.push(`Focus on clicking in the area defined by: ${target.selector}`);
        }
        if (target.bounds) {
          parts.push(`Click within bounds: ${target.bounds.description || 'center grid area'}`);
        }
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
      if (eb.progressionIndicator) {
        parts.push(`Progression indicator: ${eb.progressionIndicator}`);
      }
    }
    
    // Add canvas interaction details if available
    if (si.canvasInteraction) {
      const ci = si.canvasInteraction;
      parts.push(`Canvas interaction method: ${ci.method || 'coordinate-based-clicking'}`);
      if (ci.note) {
        parts.push(`Note: ${ci.note}`);
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

