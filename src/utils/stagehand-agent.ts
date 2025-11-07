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
 * Builds minimal system prompt for Stagehand agent
 *
 * The system prompt provides only the core role definition. All game-specific
 * context (game goal, starting goal, controls, interaction method, etc.) is
 * included in the instruction (buildStagehandInstruction) to avoid duplication
 * and ensure all context is available in one place.
 *
 * @param metadata - Optional game metadata (currently unused, kept for API consistency)
 * @returns Minimal system prompt string with role definition only
 *
 * @example
 * const prompt = buildStagehandSystemPrompt();
 * // "You are a QA tester for browser games. Your goal is to test all functionality,
 * //  try different controls, look for bugs, and explore the game thoroughly.
 * //  Report any errors or unusual behavior you encounter."
 *
 * @see https://docs.stagehand.dev/v3/basics/agent (agent system prompt format)
 */
export function buildStagehandSystemPrompt(_metadata?: GameMetadata): string {
  // Minimal role definition only - all game-specific context goes in instruction
  // Metadata parameter is kept for API consistency but not used
  return 'You are a QA tester for browser games. Your goal is to test all functionality, try different controls, look for bugs, and explore the game thoroughly. Report any errors or unusual behavior you encounter.';
}

/**
 * Builds comprehensive instruction for Stagehand agent from game metadata
 *
 * This instruction contains ALL game-specific context needed for testing:
 * - Game goal (description)
 * - Starting goal (testing strategy instructions)
 * - Available controls (input schema)
 * - Interaction method (canvas vs DOM)
 * - Special instructions (click targets, bounds, frequency, expected behavior)
 * - Success indicators (what to look for)
 * - Validation checks (what to verify)
 * - Important notes (critical context)
 * - Areas to avoid clicking
 *
 * All context is in one place (the instruction) to avoid duplication with
 * the system prompt, which only contains the minimal role definition.
 *
 * @param metadata - Optional game metadata for context
 * @returns Comprehensive instruction string for agent.execute()
 *
 * @example
 * // With full metadata
 * const instruction = buildStagehandInstruction(canvasMetadata);
 * // "Test this idle-clicker game. Game goal: Click-based idle game where you...
 * //  Starting goal: Start the game; Test brick clicking; Verify currency increases.
 * //  Available controls: ClickBrick, OpenUpgrades, OpenSettings.
 * //  IMPORTANT: This is a canvas-based game...
 * //  Click targets: Find canvas element, click within bounds (20-80% width, 15-90% height)...
 * //  Expected behavior: When clicking, you should see brick damage animation...
 * //  Success indicators: Currency increases, bricks disappear when health reaches 0...
 * //  Validation checks: Verify currency increases, verify brick health decreases..."
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

  const sections: string[] = [];

  // 1. Game Goal (description)
  const genre = metadata.genre || 'browser game';
  if (metadata.description) {
    sections.push(`Game Goal: Test this ${genre} game. ${metadata.description}`);
  } else {
    sections.push(`Game Goal: Test this ${genre} game.`);
  }

  // 2. Starting Goal (testing strategy instructions)
  if (metadata.testingStrategy?.instructions) {
    const goals = metadata.testingStrategy.instructions
      .split(';')
      .map(g => g.trim())
      .filter(g => g.length > 0);
    sections.push(`Starting Goal: ${goals.join('; ')}.`);
  } else {
    const defaultGoals = [
      'Start the game',
      'Test basic controls',
      'Try to progress through gameplay',
    ];
    sections.push(`Starting Goal: ${defaultGoals.join('; ')}.`);
  }

  // 3. Available Controls (input schema)
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
  if (controls.length > 0) {
    sections.push(`Available Controls: ${controls.join(', ')}.`);
  } else if (metadata.expectedControls) {
    sections.push(`Available Controls: ${metadata.expectedControls}.`);
  }

  // 4. Interaction Method (canvas vs DOM)
  const hasCanvasBasedFlag = metadata.specialInstructions?.canvasBased === true;
  const hasCanvasClickTargets = metadata.specialInstructions?.clickTargets?.some(t => 
    t.type === 'canvas-coordinates' || t.target === 'canvas'
  ) ?? false;
  // Check if actions have 'target' property (extended property not in InputAction interface)
  const hasCanvasActions = metadata.inputSchema?.actions?.some(a => {
    if (typeof a === 'object' && a !== null && 'target' in a) {
      const target = (a as { target?: string }).target;
      return target === 'canvas-coordinates' || target === 'canvas-ui-area';
    }
    return false;
  }) ?? false;
  const isCanvasBased = hasCanvasBasedFlag || hasCanvasClickTargets || hasCanvasActions;

  if (isCanvasBased) {
    sections.push('\nIMPORTANT: This is a canvas-based game where all content (game elements, UI, buttons) is rendered on an HTML5 canvas element, NOT as DOM elements.');
    sections.push('Key guidelines for canvas-based games:');
    sections.push('- Use coordinate-based clicking on the canvas element, not CSS selectors');
    sections.push('- Find the canvas element first, then click on coordinates within it');
    sections.push('- Visual feedback is critical - observe the canvas for changes after each action');
    sections.push('- Cannot use DOM element selectors (querySelector, getElementById) for game elements');
    sections.push('- All interactions must be coordinate-based within the canvas bounds');
    sections.push('- Use screenshot analysis to verify game state changes (currency, score, animations)');
    sections.push('- Click on coordinates where game elements are visually rendered, not where DOM elements might be');
  } else {
    sections.push('\nThis game uses DOM elements for interaction. Use standard element selection methods (CSS selectors, text matching) to find and interact with game elements.');
  }

  // 5. Special Instructions - Click Targets and Interaction Details
  if (metadata.specialInstructions) {
    const si = metadata.specialInstructions;
    
    if (si.clickTargets && Array.isArray(si.clickTargets) && si.clickTargets.length > 0) {
      const target = si.clickTargets[0];
      sections.push('\nClick Targets and Strategy:');
      
      if (target.instructions) {
        sections.push(`- ${target.instructions}`);
      }
      
      if (target.bounds) {
        const boundsDesc = target.bounds.description || 'center grid area';
        sections.push(`- Click within bounds: ${boundsDesc}`);
        if (target.bounds.xPercent) {
          sections.push(`  X coordinates: ${target.bounds.xPercent}`);
        }
        if (target.bounds.yPercent) {
          sections.push(`  Y coordinates: ${target.bounds.yPercent}`);
        }
        if (target.bounds.note) {
          sections.push(`  Note: ${target.bounds.note}`);
        }
      }
      
      if (target.frequency) {
        sections.push(`- Click frequency: ${target.frequency}`);
      }
      
      if (target.strategy) {
        sections.push(`- Clicking strategy: ${target.strategy}`);
      }
    }

    // Canvas Interaction Details
    if (si.canvasInteraction) {
      const ci = si.canvasInteraction;
      sections.push('\nCanvas Interaction Details:');
      if (ci.method) {
        sections.push(`- Method: ${ci.method}`);
      }
      if (ci.targetElement) {
        sections.push(`- Target element: ${ci.targetElement}`);
      }
      if (ci.coordinateStrategy) {
        sections.push(`- Coordinate strategy: ${ci.coordinateStrategy}`);
      }
      if (ci.note) {
        sections.push(`- ${ci.note}`);
      }
    }

    // Expected Behavior
    if (si.expectedBehavior) {
      const eb = si.expectedBehavior;
      sections.push('\nExpected Behavior:');
      if (eb.immediateResponse) {
        sections.push(`- Immediate response: ${eb.immediateResponse}`);
      }
      if (eb.afterMultipleClicks) {
        sections.push(`- After multiple clicks: ${eb.afterMultipleClicks}`);
      }
      if (eb.progressionIndicator) {
        sections.push(`- Progression indicator: ${eb.progressionIndicator}`);
      }
    }

    // Areas to Avoid
    if (si.avoidClicking && Array.isArray(si.avoidClicking) && si.avoidClicking.length > 0) {
      sections.push('\nAreas to Avoid Clicking:');
      si.avoidClicking.forEach(area => {
        sections.push(`- ${area}`);
      });
    }
  }

  // 6. Success Indicators (what to look for to verify the game is working)
  if (metadata.successIndicators && Array.isArray(metadata.successIndicators) && metadata.successIndicators.length > 0) {
    sections.push('\nSuccess Indicators (verify these to confirm the game is working):');
    metadata.successIndicators.forEach(indicator => {
      sections.push(`- ${indicator.description}`);
    });
  }

  // 7. Validation Checks (what to verify during testing)
  // Note: validationChecks is an extended property not in TestingStrategy interface
  const testingStrategy = metadata.testingStrategy as { validationChecks?: string[] } | undefined;
  if (testingStrategy?.validationChecks && Array.isArray(testingStrategy.validationChecks) && testingStrategy.validationChecks.length > 0) {
    sections.push('\nValidation Checks (verify these during testing):');
    testingStrategy.validationChecks.forEach((check: string) => {
      sections.push(`- ${check}`);
    });
  }

  // 8. Important Notes (critical context)
  // Note: notes is an extended property not in GameMetadata interface
  const metadataWithNotes = metadata as { notes?: string[] };
  if (metadataWithNotes.notes && Array.isArray(metadataWithNotes.notes) && metadataWithNotes.notes.length > 0) {
    sections.push('\nImportant Notes:');
    metadataWithNotes.notes.forEach((note: string) => {
      sections.push(`- ${note}`);
    });
  }

  // 9. Time-based completion criteria
  sections.push('\nPlay for about 2 minutes or until you reach a clear completion point (like game over, level complete, or winning the game).');

  return sections.join('\n');
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
      screenshots.push(...action.screenshots.filter((s: unknown) => typeof s === 'string'));
    }
  }

  return screenshots;
}

