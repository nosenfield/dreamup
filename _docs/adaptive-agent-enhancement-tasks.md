# Adaptive Agent Enhancement Tasks

**Base Commit**: `11fb326c6432397fe923b2968746c90112ff2b17`
**Goal**: Integrate learnings from Stagehand Agent work to improve Adaptive Agent
**Focus**: Metadata structure, prompt enhancement, canvas game support

---

## Task Overview

| Task | Description | Effort | Priority |
|------|-------------|--------|----------|
| **T1** | Simplify metadata structure (follow metadata-2.json pattern) | 1h | High |
| **T2** | Enhance StateAnalyzer prompts with metadata context | 2h | High |
| **T3** | Add canvas-aware clicking to GameInteractor | 1.5h | High |
| **T4** | Create prompt preview script for debugging | 0.5h | Medium |
| **T5** | Update example metadata files | 0.5h | Low |

**Total Estimated Effort**: 5.5 hours

---

## T1: Simplify Metadata Structure (1 hour)

### Goal
Follow the metadata-2.json pattern where all context is provided as a **narrative string** in `testingStrategy.instructions` rather than scattered across multiple structured fields.

### Why This Works Better
- **LLMs prefer narrative context** over deeply nested JSON structures
- **Single source of truth** - all game-specific guidance in one place
- **Easier to debug** - just read one string to see what agent knows
- **Less cognitive overhead** - no need to parse multiple fields and reconstruct context

### Key Insight from Stagehand Work
The Stagehand Agent instruction builder (`buildStagehandInstruction`) taught us that consolidating context into a narrative string performs better than splitting it across system prompts, structured fields, and notes.

### Implementation

**DO NOT add new fields to GameMetadata interface.** Instead, use the existing `testingStrategy.instructions` field more effectively.

**Pattern to Follow** (from metadata-2.json):

```json
{
  "testingStrategy": {
    "waitBeforeInteraction": 2000,
    "interactionDuration": 30000,
    "criticalActions": ["ClickBrick"],
    "instructions": "This is a canvas-based game where all content is rendered on an HTML5 canvas element, NOT as DOM elements. Find the canvas element, then click on random coordinates within the center grid area where bricks are rendered (approximately 20-80% width, 15-90% height of canvas). Click frequency should be about 2 per second. Verify currency increases after clicks, verify brick health decreases, verify UI updates correctly, and check for console errors. Avoid clicking canvas coordinates outside the brick grid area, the top UI bar area where level/currency text is displayed, or the settings icon area in the top-right corner. When clicking canvas coordinates where bricks are rendered, you should see brick damage animation or number decreases visually on canvas. After multiple clicks, currency number should increase on canvas and bricks should disappear when health reaches 0."
  }
}
```

**What to Include in `instructions` String**:
1. **Game type/architecture** - "canvas-based game", "DOM-based game with iframe", etc.
2. **Interaction method** - How to interact (click coordinates, use DOM selectors, etc.)
3. **Click targets and bounds** - Where to click (e.g., "20-80% width, 15-90% height")
4. **Click frequency** - How often to click (e.g., "2 per second")
5. **Expected behavior** - What should happen (e.g., "brick damage animation")
6. **Success indicators** - What to verify (e.g., "currency increases")
7. **Areas to avoid** - Where NOT to click (e.g., "top UI bar area")
8. **Validation checks** - What to test (e.g., "verify UI updates correctly")

**Files to Update**:
- `_game-examples/brick-breaker-idle/metadata.json` - Simplify to metadata-2.json pattern
- `_game-examples/pong/metadata.json` - Add narrative `instructions` field
- `_game-examples/snake/metadata.json` - Add narrative `instructions` field

**Example for Pong** (create new narrative instructions):

```json
{
  "testingStrategy": {
    "waitBeforeInteraction": 2000,
    "interactionDuration": 30000,
    "criticalActions": ["Pause"],
    "criticalAxes": ["RightPaddleVertical"],
    "instructions": "This is a DOM-based Pong game. Use Arrow keys (ArrowUp, ArrowDown) to control the right paddle. The game starts automatically after loading. Play for 30 seconds to verify paddle movement is responsive and the ball bounces correctly. Press Escape to pause if needed. Success indicators: paddle moves smoothly when arrow keys are pressed, ball bounces off paddles and walls, score updates when ball passes paddle. Verify no console errors occur during gameplay."
  }
}
```

**Gotchas**:
- ⚠️ Keep the `instructions` field as a **single paragraph** or use semicolons/periods, not newlines
- ⚠️ Don't duplicate information between `instructions` and other fields like `notes` or `specialInstructions`
- ⚠️ Keep structured fields (`criticalActions`, `waitBeforeInteraction`) for programmatic access
- ⚠️ The narrative should be **self-contained** - assume the LLM only reads this string

**Acceptance Criteria**:
- [ ] metadata-2.json pattern applied to all example metadata files
- [ ] Each game has comprehensive `instructions` narrative
- [ ] No duplication between `instructions` and other fields
- [ ] Instructions include all 8 key elements listed above

---

## T2: Enhance StateAnalyzer Prompts with Metadata Context (2 hours)

### Goal
Update `StateAnalyzer.buildStateAnalysisPrompt()` to prioritize `testingStrategy.instructions` from metadata context in the STATE_ANALYSIS_PROMPT.

### Why This Matters
Currently, StateAnalyzer includes some metadata context (`expectedControls`, `genre`) but doesn't prioritize the comprehensive `testingStrategy.instructions` field. The instructions field contains game-specific guidance that significantly improves LLM decision-making:
- What type of game it's testing (canvas vs DOM)
- Where it should click (bounds, safe zones)
- What success looks like (expected behavior)
- How to interact (click frequency, patterns)

### Key Learnings from Stagehand Work
The `buildStagehandInstruction()` function showed that providing:
1. Game goal/description
2. Available controls
3. Canvas vs DOM detection
4. Click bounds and expected behavior
5. Success indicators

...significantly improves agent performance.

### Current Implementation Status
✅ **Good News**: `StateAnalyzer` already receives metadata via `GameState` (no constructor changes needed)
✅ **Good News**: `buildStateAnalysisPrompt()` method already exists and includes metadata
⚠️ **Needs Enhancement**: Currently uses `expectedControls` and `genre`, but should prioritize `testingStrategy.instructions`

### Implementation

**Step 1: Enhance buildStateAnalysisPrompt()** (45 min)

Update the existing method to prioritize `testingStrategy.instructions`:

```typescript
// src/core/state-analyzer.ts - update existing buildStateAnalysisPrompt() method

private buildStateAnalysisPrompt(state: GameState): string {
  let prompt = STATE_ANALYSIS_PROMPT;

  // Add goal context
  prompt += `\n\n**Current Goal:** ${state.goal}`;

  // PRIORITY 1: Add game-specific context from testingStrategy.instructions (MOST IMPORTANT)
  if (state.metadata?.testingStrategy?.instructions) {
    prompt += `\n\n**Game Context (IMPORTANT - Follow these instructions carefully):**\n${state.metadata.testingStrategy.instructions}`;
  }

  // PRIORITY 2: Add supplementary metadata context (if instructions not available)
  if (state.metadata) {
    if (state.metadata.expectedControls && !state.metadata.testingStrategy?.instructions) {
      prompt += `\n\n**Expected Controls:** ${state.metadata.expectedControls}`;
    }
    if (state.metadata.genre) {
      prompt += `\n**Game Genre:** ${state.metadata.genre}`;
    }
  }

  // Add previous actions context if available
  if (state.previousActions.length > 0) {
    prompt += `\n\n**Previous Actions Taken:**`;
    state.previousActions.slice(-5).forEach((action, index) => {
      prompt += `\n${index + 1}. ${action.action} on ${JSON.stringify(action.target)} - ${action.reasoning}`;
    });
    prompt += `\n\n**Note:** Avoid repeating these exact actions if they didn't work.`;
  }

  // Add HTML context if available (limited to first 2000 chars to avoid token limits)
  if (state.html) {
    const htmlPreview = state.html.substring(0, 2000);
    prompt += `\n\n**HTML Structure (first 2000 chars):**\n${htmlPreview}`;
    if (state.html.length > 2000) {
      prompt += `\n[... HTML truncated, total length: ${state.html.length} chars]`;
    }
  }

  return prompt;
}
```

**Step 2: Update STATE_ANALYSIS_PROMPT** (30 min)

Enhance the base prompt to work with contextual information:

```typescript
// src/vision/prompts.ts

export const STATE_ANALYSIS_PROMPT = `You are analyzing a game state to recommend the next action to achieve a specific goal.

**IMPORTANT - Use Game Context:**
- If "Game Context" is provided above, follow those instructions carefully
- For canvas-based games: Use coordinate-based clicking (percentages 0.0-1.0 of canvas size)
- For DOM-based games: Use absolute pixel coordinates
- Respect click bounds and avoid areas specified in context
- Follow expected behavior patterns described in context

**IMPORTANT - Coordinate Accuracy:**
For canvas games, coordinates should be percentages (0.0 to 1.0):
- Example: Center of canvas = { x: 0.5, y: 0.5 }
- Example: Top-left quadrant = { x: 0.25, y: 0.25 }
- Example: Brick grid area (20-80% width, 15-90% height) = { x: 0.5, y: 0.5 }

For DOM games, coordinates should be absolute pixels:
- Measure carefully from the screenshot
- Center coordinates on the target element
- Consider element borders and padding
- Example: Button at center of 640x480 image = { x: 320, y: 240 }

**Your Task:**
1. Analyze the current screenshot and HTML
2. Consider the game context and previous actions
3. Recommend the BEST next action to achieve the goal
4. Provide specific coordinates or key names
5. Explain your reasoning clearly

... (rest of existing STATE_ANALYSIS_PROMPT)
`;
```

**Step 3: Verify Metadata Flow** (15 min)

Ensure metadata is passed correctly through the call chain:

```typescript
// In runAdaptiveQA() - metadata is already passed via GameState
const recommendation = await stateAnalyzer.analyzeAndRecommendAction({
  html: sanitizedHTML,
  screenshot: screenshot.path,
  previousActions: actionHistory,
  metadata: metadata,  // ✅ Already passed here
  goal: currentGoal,
});
```

**Gotchas**:
- ⚠️ **Metadata already in GameState**: No need to add to constructor - metadata is passed via `GameState` parameter
- ⚠️ **Enhance existing method**: Don't create new `buildContextualPrompt()` - enhance existing `buildStateAnalysisPrompt()`
- ⚠️ **Prioritize instructions**: Put `testingStrategy.instructions` FIRST in prompt (most important context)
- ⚠️ **Backwards compatible**: Check if `instructions` exists before using (works with old metadata)
- ⚠️ **Keep STATE_ANALYSIS_PROMPT generic**: Specific context comes from metadata, base prompt stays reusable
- ⚠️ **For canvas games**: LLM needs to understand coordinates are percentages (0.0-1.0), not pixels
- ⚠️ **Test with both**: Canvas (Brick Breaker) and DOM (Pong) games to verify prompt works for both

**Files to Modify**:
- `src/core/state-analyzer.ts` (1 change: enhance buildStateAnalysisPrompt method)
- `src/vision/prompts.ts` (1 change: enhance STATE_ANALYSIS_PROMPT with canvas/DOM guidance)

**Testing Considerations**:
- [ ] Unit test: `buildStateAnalysisPrompt()` includes `instructions` when present
- [ ] Unit test: `buildStateAnalysisPrompt()` falls back to `expectedControls` when `instructions` missing
- [ ] Integration test: StateAnalyzer uses `instructions` in actual API call
- [ ] E2E test: Test with Brick Breaker (canvas) - verify instructions are followed
- [ ] E2E test: Test with Pong (DOM) - verify instructions are followed

**Acceptance Criteria**:
- [ ] `buildStateAnalysisPrompt()` prioritizes `testingStrategy.instructions` when available
- [ ] `buildStateAnalysisPrompt()` falls back gracefully when `instructions` missing
- [ ] STATE_ANALYSIS_PROMPT enhanced with canvas/DOM coordinate guidance
- [ ] Metadata context appears in actual LLM prompts (verify via logging)
- [ ] Tested with Brick Breaker (canvas) - instructions followed correctly
- [ ] Tested with Pong (DOM) - instructions followed correctly
- [ ] Backwards compatible with metadata files without `instructions` field

---

## T3: Add Canvas-Aware Clicking to GameInteractor (1.5 hours)

### Goal
Enable GameInteractor to handle canvas-based games by clicking at canvas-relative coordinates instead of viewport-absolute coordinates.

### Why This Matters
Currently, when the LLM recommends clicking at `{ x: 0.5, y: 0.5 }` for a canvas game, GameInteractor clicks at pixel (0.5, 0.5) instead of the center of the canvas element. We need to:
1. Detect canvas-based games from metadata
2. Find the canvas element
3. Convert percentage coordinates to absolute pixels relative to canvas bounds
4. Click within the canvas

### Key Learning from Stagehand Work
Canvas detection should use **multi-signal approach**:
- Check `testingStrategy.instructions` for "canvas-based"
- Check if `inputSchema.actions` mention "canvas coordinates"
- Don't rely on single field

### Implementation

**Step 1: Add Canvas Detection Helper** (15 min)

Create a utility function to detect canvas games from metadata:

```typescript
// src/core/game-interactor.ts - add private method

/**
 * Detect if this is a canvas-based game from metadata.
 * Uses multi-signal approach for robustness.
 *
 * @param metadata - Optional game metadata
 * @returns true if canvas-based game detected, false otherwise
 */
private isCanvasGame(metadata?: GameMetadata): boolean {
  if (!metadata) return false;

  // Signal 1: Check instructions for canvas-based mention
  const instructions = metadata.testingStrategy?.instructions || '';
  const hasCanvasInstructions =
    instructions.toLowerCase().includes('canvas-based') ||
    instructions.toLowerCase().includes('html5 canvas') ||
    instructions.toLowerCase().includes('rendered on canvas');

  // Signal 2: Check if actions mention canvas coordinates
  const hasCanvasActions = metadata.inputSchema?.actions?.some(action => {
    const desc = typeof action === 'string' ? action : action.description || '';
    return desc.toLowerCase().includes('canvas') &&
           (desc.toLowerCase().includes('coordinates') || desc.toLowerCase().includes('within'));
  }) ?? false;

  // Signal 3: Check expectedControls for canvas mention
  const hasCanvasControls =
    metadata.expectedControls?.toLowerCase().includes('canvas') ?? false;

  // Return true if ANY signal detected (OR logic)
  return hasCanvasInstructions || hasCanvasActions || hasCanvasControls;
}
```

**Step 2: Add Canvas Click Handler** (45 min)

Create a method to handle canvas-based clicking:

```typescript
/**
 * Click at canvas-relative coordinates.
 * Converts percentage coordinates (0.0-1.0) to absolute pixels.
 *
 * @param page - The Stagehand page object
 * @param xPercent - X coordinate as percentage of canvas width (0.0-1.0)
 * @param yPercent - Y coordinate as percentage of canvas height (0.0-1.0)
 * @param metadata - Optional game metadata for validation
 * @returns Promise that resolves to true if click succeeded, false otherwise
 */
private async clickCanvasCoordinates(
  page: AnyPage,
  xPercent: number,
  yPercent: number,
  metadata?: GameMetadata
): Promise<boolean> {
  try {
    // Find canvas element using Stagehand's evaluate method
    // Note: Stagehand v3 may not have locator() - use evaluate() instead
    const canvasInfo = await (page as any).evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    });

    if (!canvasInfo) {
      this.logger.warn('Canvas element not found for canvas-based game', {
        op: 'clickCanvasCoordinates',
      });
      return false;
    }

    const box = canvasInfo;

    // Convert percentage to absolute coordinates
    const absoluteX = box.x + (box.width * xPercent);
    const absoluteY = box.y + (box.height * yPercent);

    this.logger.info('Clicking canvas coordinates', {
      op: 'clickCanvasCoordinates',
      canvasBox: { x: box.x, y: box.y, width: box.width, height: box.height },
      percent: { x: xPercent, y: yPercent },
      absolute: { x: absoluteX, y: absoluteY },
    });

    // Click at absolute coordinates (Stagehand API: page.click() not page.mouse.click())
    await page.click(absoluteX, absoluteY);

    // Wait for visual feedback (important for canvas games)
    await new Promise(resolve => setTimeout(resolve, 500));

    return true;
  } catch (error) {
    this.logger.error('Failed to click canvas coordinates', error);
    return false;
  }
}
```

**Step 3: Update executeRecommendation** (30 min)

Modify the action execution logic to route canvas clicks appropriately:

```typescript
/**
 * Execute a recommended action from StateAnalyzer.
 * Handles canvas-based vs DOM-based coordinate systems.
 *
 * @param page - The Stagehand page object
 * @param recommendation - Action recommendation from StateAnalyzer
 * @param metadata - Optional game metadata for canvas detection
 * @returns Promise that resolves to true if action succeeded, false otherwise
 */
async executeRecommendation(
  page: AnyPage,
  recommendation: ActionRecommendation,
  metadata?: GameMetadata
): Promise<boolean> {
  const { action, target } = recommendation;

  try {
    this.logger.info('Executing recommended action', {
      action,
      target,
      isCanvasGame: this.isCanvasGame(metadata),
    });

    if (action === 'click' && typeof target === 'object' && 'x' in target && 'y' in target) {
      const isCanvas = this.isCanvasGame(metadata);

      if (isCanvas) {
        // Canvas game: treat coordinates as percentages (0.0-1.0)
        // Clamp to valid range in case LLM returns values outside bounds
        const xPercent = Math.max(0, Math.min(1, target.x));
        const yPercent = Math.max(0, Math.min(1, target.y));
        return await this.clickCanvasCoordinates(page, xPercent, yPercent, metadata);
      } else {
        // DOM game: treat coordinates as absolute pixels
        return await this.clickAtCoordinates(page, target.x, target.y);
      }
    }

    if (action === 'keypress' && typeof target === 'string') {
      await this.simulateKeyPress(page, target);
      return true;
    }

    if (action === 'wait' && typeof target === 'number') {
      await new Promise(resolve => setTimeout(resolve, target));
      return true;
    }

    if (action === 'complete') {
      this.logger.info('Action marked as complete by StateAnalyzer');
      return true;
    }

    this.logger.warn('Unknown action type', { action });
    return false;
  } catch (error) {
    this.logger.error('Failed to execute recommendation', error);
    return false;
  }
}
```

**Step 4: Update captureCurrentState** (Optional - if not already passing metadata)

If `captureCurrentState()` is used in adaptive loop, ensure it has access to metadata:

```typescript
// In runAdaptiveQA() - when calling captureCurrentState
const currentState = await gameInteractor.captureCurrentState(page, screenshotCapturer);
// Make sure metadata is available to executeRecommendation later
```

**Gotchas**:
- ⚠️ **Coordinate System Confusion**: Canvas games use 0.0-1.0 (percentages), DOM games use pixels (e.g., 450)
- ⚠️ **Multiple Canvas Elements**: Some games have multiple canvases - use `.first()` to get the main one
- ⚠️ **Canvas Not Ready**: Canvas element may exist but not be fully rendered - check `boundingBox()` returns valid dimensions
- ⚠️ **Viewport vs Canvas Coordinates**: Canvas position changes if page scrolls - always get fresh `boundingBox()`
- ⚠️ **Clamp Percentages**: LLM might return x=1.2 or y=-0.1 - clamp to [0,1] range
- ⚠️ **Visual Feedback Delay**: Canvas games update visually, not in DOM - add delay after click
- ⚠️ **Stagehand API**: Use `page.click(x, y)` not `page.mouse.click()` (Stagehand v3 API)
- ⚠️ **Stagehand Locator**: Verify `page.locator()` works with Stagehand v3 - may need to use `page.evaluate()` to find canvas

**Test Cases to Verify**:

```typescript
// Test 1: Canvas game click (Brick Breaker)
// Input: { x: 0.5, y: 0.5 } (center of canvas)
// Expected: Click at center of canvas element (not pixel 0.5, 0.5!)

// Test 2: DOM game click (Pong)
// Input: { x: 450, y: 300 } (absolute pixels)
// Expected: Click at pixel (450, 300)

// Test 3: Canvas game with bounds
// Input: { x: 0.7, y: 0.8 } (brick grid area)
// Expected: Click at 70% width, 80% height of canvas

// Test 4: Canvas game with clamping
// Input: { x: 1.5, y: -0.2 } (out of bounds)
// Expected: Clamped to { x: 1.0, y: 0.0 } before clicking
```

**Files to Modify**:
- `src/core/game-interactor.ts` (3 new methods: isCanvasGame, clickCanvasCoordinates, update executeRecommendation)

**Acceptance Criteria**:
- [ ] isCanvasGame() detects canvas games from metadata
- [ ] clickCanvasCoordinates() converts percentages to absolute pixels
- [ ] executeRecommendation() routes clicks to correct handler
- [ ] Coordinate clamping prevents out-of-bounds clicks
- [ ] Tested with Brick Breaker (canvas) - clicks in brick area
- [ ] Tested with Pong (DOM) - clicks at absolute coordinates
- [ ] Visual feedback delay added after canvas clicks

---

## T4: Create Prompt Preview Script for Debugging (0.5 hours)

### Goal
Create a script to preview the exact prompt being sent to StateAnalyzer, similar to `test-instruction.mjs` from Stagehand work.

### Why This Matters
When debugging why the agent makes bad decisions, you need to see:
- What context is being included
- How the prompt is structured
- What metadata fields are being used
- Approximate token count for cost estimation

### Implementation

**Create Script**: `test-adaptive-prompt.mjs`

```javascript
#!/usr/bin/env bun

/**
 * Test script for Adaptive Agent prompt generation
 *
 * Usage:
 *   bun test-adaptive-prompt.mjs [path-to-metadata.json]
 *
 * Example:
 *   bun test-adaptive-prompt.mjs _game-examples/brick-breaker-idle/metadata.json
 */

// Get metadata file path from command line or use default
const metadataPath = process.argv[2] || '_game-examples/brick-breaker-idle/metadata.json';

console.log(`📄 Reading metadata from: ${metadataPath}\n`);

try {
  // Read and parse metadata using Bun APIs
  const file = Bun.file(metadataPath);
  if (!(await file.exists())) {
    throw new Error(`File not found: ${metadataPath}`);
  }
  const metadata = await file.json();

  // Build contextual prompt (mimics StateAnalyzer.buildContextualPrompt)
  const goal = "Find and click the start button";
  const previousActions = []; // Empty for initial state

  const sections = [];

  // 1. Add goal
  sections.push(`Goal: ${goal}`);

  // 2. Add game-specific context from metadata
  if (metadata.testingStrategy?.instructions) {
    sections.push('\nGame Context:');
    sections.push(metadata.testingStrategy.instructions);
  }

  // 3. Add previous actions if any
  if (previousActions.length > 0) {
    sections.push('\nPrevious actions taken:');
    sections.push(previousActions.join('\n'));
  }

  const contextPrompt = sections.join('\n');

  // Simulate STATE_ANALYSIS_PROMPT (abbreviated for display)
  const stateAnalysisPrompt = `
You are analyzing a browser game to determine the next action.

IMPORTANT - Use Game Context:
- If "Game Context" is provided above, follow those instructions carefully
- For canvas-based games: Use coordinate-based clicking (percentages 0.0-1.0)
- For DOM-based games: Use absolute pixel coordinates

... (full STATE_ANALYSIS_PROMPT would be here)
`;

  const fullPrompt = `
${contextPrompt}

${stateAnalysisPrompt}

Current HTML structure:
<html>...</html> (sanitized HTML would be here)

Based on the screenshot and HTML above, what should I do next?
`;

  // Display results
  console.log('='.repeat(80));
  console.log('ADAPTIVE AGENT PROMPT PREVIEW');
  console.log('='.repeat(80));
  console.log(fullPrompt);
  console.log('\n' + '='.repeat(80));

  // Analysis
  console.log('\n📊 ANALYSIS:');
  console.log(`- Total length: ${fullPrompt.length} characters`);
  console.log(`- Total lines: ${fullPrompt.split('\n').length}`);
  console.log(`- Estimated tokens: ~${Math.ceil(fullPrompt.length / 4)} (rough: 4 chars/token)`);

  // Check for key sections
  const checks = {
    'Goal present': fullPrompt.includes('Goal:'),
    'Game Context present': metadata.testingStrategy?.instructions && fullPrompt.includes('Game Context:'),
    'Canvas detection': fullPrompt.toLowerCase().includes('canvas'),
    'Instructions included': metadata.testingStrategy?.instructions && fullPrompt.includes(metadata.testingStrategy.instructions),
    'State analysis prompt': fullPrompt.includes('You are analyzing'),
  };

  console.log('\n✅ KEY SECTIONS:');
  Object.entries(checks).forEach(([key, value]) => {
    console.log(`  ${value ? '✓' : '✗'} ${key}`);
  });

  // Section breakdown
  console.log('\n📋 CONTEXT BREAKDOWN:');
  if (metadata.description) {
    console.log(`  - Game description: ${metadata.description.length} chars`);
  }
  if (metadata.testingStrategy?.instructions) {
    console.log(`  - Testing instructions: ${metadata.testingStrategy.instructions.length} chars`);
  }
  if (metadata.testingStrategy?.criticalActions) {
    console.log(`  - Critical actions: ${metadata.testingStrategy.criticalActions.length}`);
  }
  if (metadata.successIndicators) {
    console.log(`  - Success indicators: ${metadata.successIndicators.length}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Prompt preview generated successfully!');
  console.log('='.repeat(80));
  console.log(`\n💡 This prompt will be sent to GPT-4 Vision in StateAnalyzer.analyzeAndRecommendAction()`);
  console.log(`   along with the current screenshot and HTML structure.`);

} catch (error) {
  console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  if (error instanceof Error && error.message.includes('not found')) {
    console.error(`\nFile not found: ${metadataPath}`);
    console.error('Usage: bun test-adaptive-prompt.mjs [path-to-metadata.json]');
  } else if (error instanceof SyntaxError) {
    console.error(`\nInvalid JSON in file: ${metadataPath}`);
  }
  process.exit(1);
}
```

**Make it executable**:

```bash
chmod +x test-adaptive-prompt.mjs
```

**Usage Examples**:

```bash
# Test with Brick Breaker metadata
bun test-adaptive-prompt.mjs _game-examples/brick-breaker-idle/metadata.json

# Test with Pong metadata
bun test-adaptive-prompt.mjs _game-examples/pong/metadata.json

# Test with Snake metadata
bun test-adaptive-prompt.mjs _game-examples/snake/metadata.json
```

**Expected Output**:

```
📄 Reading metadata from: .../brick-breaker-idle/metadata.json

================================================================================
ADAPTIVE AGENT PROMPT PREVIEW
================================================================================
Goal: Find and click the start button

Game Context:
This is a canvas-based game where all content is rendered on an HTML5 canvas...

You are analyzing a browser game to determine the next action...

================================================================================

📊 ANALYSIS:
- Total length: 2847 characters
- Total lines: 42
- Estimated tokens: ~712

✅ KEY SECTIONS:
  ✓ Goal present
  ✓ Game Context present
  ✓ Canvas detection
  ✓ Instructions included
  ✓ State analysis prompt

📋 CONTEXT BREAKDOWN:
  - Game description: 123 chars
  - Testing instructions: 847 chars
  - Critical actions: 1
  - Success indicators: 5

================================================================================
✅ Prompt preview generated successfully!
================================================================================
```

**Files to Create**:
- `test-adaptive-prompt.mjs` (new script)

**Gotchas**:
- ⚠️ **Use Bun APIs**: Use `Bun.file()` instead of Node.js `fs.readFileSync()` for better Bun compatibility
- ⚠️ Keep script simple - don't import from `src/` to avoid build complications
- ⚠️ Mimic the logic from StateAnalyzer but don't require actual implementation
- ⚠️ Show abbreviated STATE_ANALYSIS_PROMPT for readability
- ⚠️ Script should work even if StateAnalyzer implementation changes

**Acceptance Criteria**:
- [ ] Script runs with `bun test-adaptive-prompt.mjs`
- [ ] Shows full contextual prompt preview
- [ ] Displays token count estimate
- [ ] Validates key sections are present
- [ ] Works with all example metadata files

---

## T5: Update Example Metadata Files (0.5 hours)

### Goal
Update Pong and Snake metadata to follow the simplified metadata-2.json pattern with comprehensive `testingStrategy.instructions`.

### Implementation

**File 1: `_game-examples/pong/metadata.json`**

```json
{
  "metadataVersion": "1.0.0",
  "genre": "arcade",
  "description": "Classic Pong game with two paddles and a bouncing ball.",
  "expectedControls": "Arrow keys for paddle movement, Escape to pause.",
  "inputSchema": {
    "type": "javascript",
    "content": "gameBuilder.createAction('Pause').bindKey('Escape')\ngameBuilder.createAxis('RightPaddleVertical').bindKeys('ArrowDown', 'ArrowUp')",
    "actions": [
      {
        "name": "Pause",
        "keys": ["Escape"],
        "description": "Pause the game"
      }
    ],
    "axes": [
      {
        "name": "RightPaddleVertical",
        "keys": ["ArrowDown", "ArrowUp"],
        "description": "Control right paddle movement"
      }
    ]
  },
  "loadingIndicators": [
    {
      "type": "element",
      "pattern": "#start-btn",
      "description": "Start button appears when game is ready"
    }
  ],
  "successIndicators": [
    {
      "type": "score_change",
      "description": "Score increments when ball passes paddle"
    }
  ],
  "testingStrategy": {
    "waitBeforeInteraction": 2000,
    "interactionDuration": 30000,
    "criticalActions": ["Pause"],
    "criticalAxes": ["RightPaddleVertical"],
    "instructions": "This is a DOM-based Pong game. The game uses standard HTML elements for rendering. After the game loads, look for a Start button (usually with id='start-btn' or similar) and click it to begin. Once the game starts, use the Arrow keys (ArrowUp and ArrowDown) to control the right paddle. The paddle should move smoothly in response to key presses. The ball should bounce off paddles and walls. Verify the score increments when the ball passes a paddle. Press Escape to pause the game if needed. Play for about 30 seconds to verify all mechanics work correctly. Success indicators: paddle responds to arrow keys, ball bounces correctly, score updates, no console errors. The game is considered working if the ball bounces and paddles respond to input."
  }
}
```

**File 2: `_game-examples/snake/metadata.json`**

```json
{
  "metadataVersion": "1.0.0",
  "genre": "arcade",
  "description": "Classic Snake game where the snake grows by eating food.",
  "expectedControls": "Arrow keys or WASD for directional movement.",
  "inputSchema": {
    "type": "semantic",
    "content": "Use arrow keys (ArrowUp, ArrowDown, ArrowLeft, ArrowRight) or WASD keys to move the snake in four directions.",
    "actions": [],
    "axes": [
      {
        "name": "Move",
        "keys": ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"],
        "description": "Move snake in 4 directions",
        "is2D": true
      }
    ]
  },
  "loadingIndicators": [
    {
      "type": "element",
      "pattern": "#start-btn",
      "description": "Start button appears when game is ready"
    }
  ],
  "successIndicators": [
    {
      "type": "element_visible",
      "description": "Snake is visible on screen and moving"
    },
    {
      "type": "score_change",
      "description": "Score increases when snake eats food"
    }
  ],
  "testingStrategy": {
    "waitBeforeInteraction": 2000,
    "interactionDuration": 30000,
    "criticalAxes": ["Move"],
    "instructions": "This is a DOM-based Snake game. The game uses standard HTML elements or canvas for rendering. After loading, look for a Start button and click it to begin. Once started, use Arrow keys (ArrowUp, ArrowDown, ArrowLeft, ArrowRight) or WASD keys to change the snake's direction. The snake should move continuously in the current direction and turn when you press a directional key. Try all four directions to verify responsive controls. Look for food items on the screen - when the snake eats food, it should grow longer and the score should increase. Play for about 30 seconds, testing all four directions and trying to eat at least one food item. Success indicators: snake moves continuously, direction changes work, snake grows when eating food, score increments, no console errors. Avoid running into walls or the snake's own body as this typically ends the game."
  }
}
```

**Files to Update**:
- `_game-examples/pong/metadata.json`
- `_game-examples/snake/metadata.json`

**Acceptance Criteria**:
- [ ] Both files follow metadata-2.json pattern
- [ ] Comprehensive `instructions` field covers all game-specific context
- [ ] No duplication between fields
- [ ] Instructions include game type, controls, expected behavior, success criteria

---

## Integration Checklist

After completing all tasks, verify the full integration:

### Functional Tests

- [ ] **T1**: metadata-2.json pattern applied to all examples
- [ ] **T2**: StateAnalyzer uses metadata context in prompts
- [ ] **T3**: Canvas clicks work correctly (test with Brick Breaker)
- [ ] **T4**: Prompt preview script works for all games
- [ ] **T5**: All example metadata files updated

### E2E Verification

Test Adaptive QA mode with each game:

```bash
# Test 1: Brick Breaker (canvas game)
ENABLE_ADAPTIVE_QA=true bun run src/main.ts https://brick-breaker-url \
  --metadata ./_game-examples/brick-breaker-idle/metadata.json

# Expected: Agent clicks within canvas bounds, currency increases

# Test 2: Pong (DOM game)
ENABLE_ADAPTIVE_QA=true bun run src/main.ts https://pong-url \
  --metadata ./_game-examples/pong/metadata.json

# Expected: Agent clicks start button, uses arrow keys, score updates

# Test 3: Snake (DOM game)
ENABLE_ADAPTIVE_QA=true bun run src/main.ts https://snake-url \
  --metadata ./_game-examples/snake/metadata.json

# Expected: Agent clicks start, tries all 4 directions, eats food
```

### Success Criteria (Final)

- [ ] Canvas games (Brick Breaker) receive coordinate clicks within bounds
- [ ] DOM games (Pong, Snake) receive absolute pixel coordinate clicks
- [ ] StateAnalyzer prompts include game context from metadata
- [ ] Prompt preview script helps debug context issues
- [ ] All metadata files follow simplified pattern
- [ ] No regressions in existing Standard or Adaptive QA modes

---

## Estimated Timeline

| Phase | Tasks | Duration |
|-------|-------|----------|
| **Phase 1** | T1: Metadata simplification | 1 hour |
| **Phase 2** | T2: StateAnalyzer enhancement | 2 hours |
| **Phase 3** | T3: Canvas-aware clicking | 1.5 hours |
| **Phase 4** | T4: Prompt preview script | 0.5 hours |
| **Phase 5** | T5: Update examples | 0.5 hours |
| **Testing** | E2E verification | 1 hour |
| **Total** | | **6.5 hours** |

---

## Key Learnings Applied

From the Stagehand Agent implementation, we're applying:

1. **Narrative over Structure**: metadata-2.json pattern (single instructions string > nested fields)
2. **Context in Prompts**: Include game-specific context in LLM prompts for better decisions
3. **Canvas Detection**: Multi-signal approach (check multiple fields, not just one flag)
4. **Coordinate Systems**: Canvas (percentages 0.0-1.0) vs DOM (absolute pixels)
5. **Debug Tooling**: Preview scripts to see exactly what LLM receives

## What We're NOT Bringing Over

- ❌ Stagehand Agent orchestration (too autonomous, less controllable)
- ❌ OpenRouter integration (not needed yet)
- ❌ Complex metadata fields (`specialInstructions`, `uiElements`, etc.)
- ❌ Stagehand-specific types and action tracking

## Next Steps After This Work

Once these tasks are complete, consider:

1. **Test with more canvas games** to validate coordinate clicking
2. **Tune prompt engineering** based on prompt preview insights
3. **Add cost tracking** to compare Standard vs Adaptive mode costs
4. **Consider OpenRouter** if you want to experiment with different models
5. **Document patterns** in systemPatterns.md for future reference
