# Stagehand Agent Work Review: Reusable Components for Adaptive Agent

**Date**: November 7, 2025
**Scope**: Commits after `11fb326c6432397fe923b2968746c90112ff2b17`
**Conclusion**: Stagehand Agent underperforms Adaptive Agent, but significant work can be salvaged

---

## Executive Summary

After reviewing 42 commits of Stagehand Agent development, I've identified **valuable components that should be integrated into your Adaptive Agent**:

### ✅ High-Value Components (Recommend Applying)
1. **Enhanced GameMetadata with `specialInstructions`** - Canvas-based game support
2. **Instruction Builder Logic** - Metadata-to-prompt transformation
3. **Canvas Game Detection System** - Multi-signal detection for canvas games
4. **Test Instruction Script** - Development tool for prompt debugging

### ⚠️ Medium-Value Components (Consider Selectively)
5. **OpenRouter Integration** - Model flexibility (if you want multi-provider support)

### ❌ Low-Value Components (Not Worth Porting)
6. Stagehand-specific action tracking types
7. Stagehand Agent orchestration code

---

## Detailed Analysis

### 1. Enhanced GameMetadata with `specialInstructions` ✅ **HIGH VALUE**

**What was built:**
```typescript
// Added to GameMetadata interface
specialInstructions?: {
  gameType?: string;              // "canvas-mouse-clicker", "idle-clicker", etc.
  inputMethod?: string;           // "mouse-clicks-only", "keyboard-only", etc.
  canvasBased?: boolean;          // Flag for canvas-rendered games
  clickTargets?: Array<{          // Coordinate-based click specifications
    type: string;                 // "canvas-coordinates"
    target: string;               // "canvas"
    strategy: string;             // "random-positions-in-bounds"
    frequency: string;            // "2-per-second"
    bounds: {
      description: string;
      xPercent: string;           // "20% to 80% of canvas width"
      yPercent: string;           // "15% to 90% of canvas height"
      note: string;
    };
    instructions: string;
  }>;
  avoidClicking?: string[];       // Areas to avoid (edges, UI areas)
  expectedBehavior?: {            // What should happen after actions
    immediateResponse: string;
    afterMultipleClicks: string;
    progressionIndicator: string;
  };
  canvasInteraction?: {           // Canvas-specific interaction method
    method: string;               // "coordinate-based-clicking"
    targetElement: string;        // "canvas"
    coordinateStrategy: string;   // "random-positions-within-grid-bounds"
    note: string;
  };
};
```

**Why it's valuable for Adaptive Agent:**

1. **Solves Canvas Game Problem**: Your current Adaptive Agent likely struggles with canvas-based games (Brick Breaker Idle, etc.) because:
   - Canvas games render everything on `<canvas>` element (no DOM buttons to click)
   - DOM selectors don't work for game elements
   - Requires coordinate-based clicking within canvas bounds

2. **Provides Click Strategy**: `clickTargets[0].bounds` tells agent exactly where to click:
   ```typescript
   // Instead of blind clicking, agent knows:
   bounds: {
     xPercent: "20% to 80% of canvas width",  // Center grid area
     yPercent: "15% to 90% of canvas height",  // Avoid UI areas
   }
   ```

3. **Guides Expected Behavior**: `expectedBehavior` helps StateAnalyzer understand success:
   ```typescript
   expectedBehavior: {
     immediateResponse: "brick shows damage animation",
     afterMultipleClicks: "currency increases, bricks disappear",
     progressionIndicator: "Level counter increases"
   }
   ```

**Recommendation**: **APPLY TO ADAPTIVE AGENT**

**How to apply:**
1. Keep `specialInstructions` field in `GameMetadata` interface (already added)
2. Update `StateAnalyzer.analyzeAndRecommendAction()` to use `specialInstructions`:
   - Pass `metadata.specialInstructions` to STATE_ANALYSIS_PROMPT
   - Include canvas detection flag, click bounds, expected behavior
   - Add canvas-specific reasoning examples in prompt
3. Update `GameInteractor.executeRecommendation()` to handle canvas clicks:
   - When `metadata.specialInstructions.canvasBased === true`:
     - Find canvas element first
     - Click at coordinates within `bounds.xPercent/yPercent` ranges
     - Use `expectedBehavior` for validation
4. Test with Brick Breaker Idle metadata (already created)

**Estimated effort**: 2-3 hours

---

### 2. Instruction Builder Logic (`buildStagehandInstruction`) ✅ **HIGH VALUE**

**What was built:**

A comprehensive metadata-to-prompt transformation function (`src/utils/stagehand-agent.ts:76-266`):

```typescript
export function buildStagehandInstruction(metadata?: GameMetadata): string {
  const sections: string[] = [];

  // 1. Game Goal (description)
  sections.push(`Game Goal: Test this ${genre} game. ${description}`);

  // 2. Starting Goal (testing strategy instructions)
  sections.push(`Starting Goal: ${goals.join('; ')}.`);

  // 3. Available Controls (input schema)
  sections.push(`Available Controls: ${controls.join(', ')}.`);

  // 4. Interaction Method (canvas vs DOM detection)
  if (isCanvasBased) {
    sections.push('IMPORTANT: This is a canvas-based game...');
    sections.push('Key guidelines for canvas-based games:');
    // ... 7 specific guidelines
  }

  // 5. Click Targets and Strategy
  sections.push('Click Targets and Strategy:');
  sections.push(`- ${instructions}`);
  sections.push(`- Click within bounds: ${boundsDesc}`);

  // 6. Success Indicators
  sections.push('Success Indicators:');
  metadata.successIndicators.forEach(i => sections.push(`- ${i.description}`));

  // 7. Validation Checks
  sections.push('Validation Checks:');

  // 8. Important Notes
  sections.push('Important Notes:');

  return sections.join('\n');
}
```

**Why it's valuable for Adaptive Agent:**

1. **Enhances STATE_ANALYSIS_PROMPT**: Your Adaptive Agent uses `StateAnalyzer.analyzeAndRecommendAction()` which builds prompts. This logic shows **what context to include**:
   - Game goal and description (context)
   - Expected controls (what to try)
   - Canvas vs DOM detection (how to interact)
   - Success indicators (what to verify)
   - Validation checks (what to test)

2. **Canvas Detection Logic** (lines 129-142):
   ```typescript
   const hasCanvasBasedFlag = metadata.specialInstructions?.canvasBased === true;
   const hasCanvasClickTargets = metadata.specialInstructions?.clickTargets?.some(t =>
     t.type === 'canvas-coordinates' || t.target === 'canvas'
   );
   const hasCanvasActions = metadata.inputSchema?.actions?.some(a => {
     return (a as any).target === 'canvas-coordinates';
   });
   const isCanvasBased = hasCanvasBasedFlag || hasCanvasClickTargets || hasCanvasActions;
   ```
   This **multi-signal detection** is more robust than checking a single flag.

3. **Structured Prompt Building**: Shows how to organize metadata into coherent LLM instructions.

**Recommendation**: **APPLY TO ADAPTIVE AGENT**

**How to apply:**
1. Create new function `buildAdaptiveQAPrompt(metadata, currentState, actionHistory)` based on this logic
2. Integrate into `StateAnalyzer.analyzeAndRecommendAction()`:
   ```typescript
   // OLD (current):
   const prompt = STATE_ANALYSIS_PROMPT + `\n\nHTML: ${html}\n\nScreenshot: [image]`;

   // NEW (with metadata context):
   const contextualPrompt = buildAdaptiveQAPrompt(metadata, currentState, actionHistory);
   const prompt = contextualPrompt + `\n\nHTML: ${html}\n\nScreenshot: [image]`;
   ```
3. Include canvas detection logic in prompt building
4. Add success indicators and validation checks to help LLM understand goals

**Estimated effort**: 1-2 hours

---

### 3. Canvas Game Detection System ✅ **HIGH VALUE**

**What was built:**

Multi-signal canvas detection (from `buildStagehandInstruction` lines 129-142):

```typescript
// Three signals to detect canvas-based games:
const hasCanvasBasedFlag = metadata.specialInstructions?.canvasBased === true;
const hasCanvasClickTargets = metadata.specialInstructions?.clickTargets?.some(t =>
  t.type === 'canvas-coordinates' || t.target === 'canvas'
);
const hasCanvasActions = metadata.inputSchema?.actions?.some(a => {
  return (a as any).target === 'canvas-coordinates';
});
const isCanvasBased = hasCanvasBasedFlag || hasCanvasClickTargets || hasCanvasActions;
```

**Why it's valuable for Adaptive Agent:**

1. **Robust Detection**: Checks 3 different metadata fields (not just one flag)
2. **Automatic Behavior Switching**: Once detected, agent knows to:
   - Use coordinate-based clicking instead of DOM selectors
   - Look for visual changes in screenshots (not DOM mutations)
   - Check canvas element first before clicking

**Recommendation**: **APPLY TO ADAPTIVE AGENT**

**How to apply:**
1. Add to `runAdaptiveQA()` after metadata loading:
   ```typescript
   const isCanvasBased = detectCanvasGame(metadata);
   // Pass to StateAnalyzer and GameInteractor
   ```
2. Update `StateAnalyzer` constructor to accept `isCanvasBased` flag
3. Update `STATE_ANALYSIS_PROMPT` to include canvas-specific guidance when flag is true
4. Update `GameInteractor.clickAtCoordinates()` to find canvas element first when flag is true

**Estimated effort**: 1 hour

---

### 4. Test Instruction Script (`test-instruction.mjs`) ✅ **HIGH VALUE**

**What was built:**

Development tool for testing prompt generation (124 lines):

```bash
$ bun test-instruction.mjs _game-examples/brick-breaker-idle/metadata.json

📄 Reading metadata from: /path/to/metadata.json

================================================================================
AGENT INSTRUCTION OUTPUT
================================================================================
Game Goal: Test this idle-clicker game. Click-based idle game...
Starting Goal: Start the game; Test brick clicking; Verify currency increases.
Available Controls: ClickBrick, OpenUpgrades, OpenSettings.
...

📊 ANALYSIS:
- Total length: 2847 characters
- Total lines: 42
- Estimated tokens: ~712 (rough estimate: 4 chars per token)

✅ KEY SECTIONS:
  ✓ Game Goal
  ✓ Starting Goal
  ✓ Available Controls
  ✓ Canvas-based detection
  ✓ Click targets
  ✓ Success indicators
  ...
```

**Why it's valuable for Adaptive Agent:**

1. **Prompt Debugging**: Quickly see what context is being passed to LLM
2. **Metadata Validation**: Verify all fields are extracted correctly
3. **Cost Estimation**: Token count helps predict API costs
4. **Development Speed**: Iterate on prompts without running full tests

**Recommendation**: **APPLY TO ADAPTIVE AGENT**

**How to apply:**
1. Copy `test-instruction.mjs` to `test-adaptive-prompt.mjs`
2. Update to call `buildAdaptiveQAPrompt()` instead of `buildStagehandInstruction()`
3. Add analysis for Adaptive-specific fields (action history, state progression)
4. Use during development to validate STATE_ANALYSIS_PROMPT changes

**Estimated effort**: 30 minutes

---

### 5. OpenRouter Integration ⚠️ **MEDIUM VALUE**

**What was built:**

Complete multi-provider LLM system (4 commits, 1000+ lines):
- `OpenRouterProvider` service class
- Configuration types and constants
- Environment variable handling
- Model validation and fallback logic
- Integration with Stagehand via `AISdkClient`

**Why it might be valuable:**

1. **Model Flexibility**: Easy to switch between providers:
   - OpenAI GPT-4o (current)
   - Anthropic Claude 3.7 Sonnet (future)
   - Google Gemini (future)
2. **Cost Optimization**: Use cheaper models for some operations:
   - Expensive model for complex state analysis
   - Cheap model for simple vision checks
3. **Fallback Strategy**: If one provider has outage, switch to another

**Why it might NOT be valuable:**

1. **Current Stack Works**: You're already using OpenAI GPT-4 Vision successfully
2. **Complexity**: Adds 500+ lines of code for marginal benefit
3. **Limited CUA Models**: Only OpenAI has computer-use-preview model working
4. **Stagehand-Specific**: OpenRouter integration was built for Stagehand agent, not general use

**Recommendation**: **DEFER (Unless You Need Multi-Provider Support)**

**If you decide to apply:**
1. Keep `OpenRouterConfig` types (already added to `config.types.ts`)
2. Keep `OPENROUTER_DEFAULTS` constants (already added to `constants.ts`)
3. Extract `OpenRouterProvider` class to use for vision API calls (not just Stagehand)
4. Update `VisionAnalyzer` to use OpenRouterProvider instead of direct OpenAI client

**Estimated effort**: 4-6 hours (if you want it, but probably not worth it)

---

### 6. Stagehand-Specific Types ❌ **LOW VALUE**

**What was built:**

TypeScript interfaces for Stagehand agent results:
- `StagehandAgentAction` (52 lines)
- `StagehandAgentResult` (22 lines)
- `StagehandAgentMetadata` (29 lines)

**Why it's NOT valuable:**

1. **Stagehand-Only**: These types are for tracking Stagehand agent actions, not relevant to Adaptive Agent
2. **Already Have Equivalent**: Adaptive Agent has `ActionRecommendation`, `AlternativeAction`, `CapturedState`
3. **Different Paradigm**: Stagehand agent is autonomous (black box), Adaptive Agent is iterative (you control loop)

**Recommendation**: **DO NOT APPLY**

---

## Canvas-Based Game Support: Implementation Plan

Based on the review, here's how to add canvas game support to your Adaptive Agent:

### Step 1: Keep Enhanced Metadata (Already Done ✅)

The `specialInstructions` field is already in `GameMetadata` interface. Keep it.

### Step 2: Update StateAnalyzer to Use Canvas Context (1-2 hours)

**File**: `src/core/state-analyzer.ts`

```typescript
// Update analyzeAndRecommendAction to include canvas context
async analyzeAndRecommendAction(
  goal: string,
  html: string,
  screenshot: Screenshot,
  previousActions: string[],
  metadata?: GameMetadata
): Promise<ActionRecommendation | null> {

  // NEW: Build context-aware prompt
  const contextPrompt = this.buildContextualPrompt(goal, metadata, previousActions);

  // Build full prompt with context + current state
  const fullPrompt = `
${contextPrompt}

Current HTML Structure:
${sanitizedHtml}

Previous actions taken:
${previousActions.join('\n')}

Based on the current state, what should I do next?
`;

  // ... rest of existing code
}

// NEW: Helper to build contextual prompt
private buildContextualPrompt(goal: string, metadata?: GameMetadata, previousActions: string[]): string {
  const sections: string[] = [];

  sections.push(`Goal: ${goal}`);

  // Detect canvas-based game
  const isCanvasBased = this.isCanvasGame(metadata);

  if (isCanvasBased && metadata?.specialInstructions) {
    sections.push('\nIMPORTANT: This is a canvas-based game.');
    sections.push('- All game elements are rendered on <canvas>, not as DOM elements');
    sections.push('- Use coordinate-based clicking, not CSS selectors');
    sections.push('- Visual changes will only appear in screenshots, not HTML');

    // Add click bounds if available
    const clickTarget = metadata.specialInstructions.clickTargets?.[0];
    if (clickTarget?.bounds) {
      sections.push(`\nClick within bounds: ${clickTarget.bounds.description}`);
      sections.push(`- X: ${clickTarget.bounds.xPercent}`);
      sections.push(`- Y: ${clickTarget.bounds.yPercent}`);
    }

    // Add expected behavior
    if (metadata.specialInstructions.expectedBehavior) {
      const eb = metadata.specialInstructions.expectedBehavior;
      sections.push('\nExpected behavior:');
      if (eb.immediateResponse) {
        sections.push(`- Immediate: ${eb.immediateResponse}`);
      }
      if (eb.afterMultipleClicks) {
        sections.push(`- After multiple clicks: ${eb.afterMultipleClicks}`);
      }
    }
  }

  // Add success indicators
  if (metadata?.successIndicators && metadata.successIndicators.length > 0) {
    sections.push('\nSuccess indicators to verify:');
    metadata.successIndicators.forEach(indicator => {
      sections.push(`- ${indicator.description}`);
    });
  }

  return sections.join('\n');
}

// NEW: Canvas game detection
private isCanvasGame(metadata?: GameMetadata): boolean {
  if (!metadata?.specialInstructions) return false;

  const si = metadata.specialInstructions;
  const hasFlag = si.canvasBased === true;
  const hasClickTargets = si.clickTargets?.some(t =>
    t.type === 'canvas-coordinates' || t.target === 'canvas'
  ) ?? false;
  const hasCanvasActions = metadata.inputSchema?.actions?.some(a => {
    if (typeof a === 'object' && a !== null && 'target' in a) {
      const target = (a as any).target;
      return target === 'canvas-coordinates' || target === 'canvas-ui-area';
    }
    return false;
  }) ?? false;

  return hasFlag || hasClickTargets || hasCanvasActions;
}
```

### Step 3: Update GameInteractor for Canvas Clicking (1 hour)

**File**: `src/core/game-interactor.ts`

```typescript
// Update executeRecommendation to handle canvas clicks
async executeRecommendation(
  page: AnyPage,
  recommendation: ActionRecommendation,
  metadata?: GameMetadata
): Promise<boolean> {
  try {
    const { action, target } = recommendation;

    if (action === 'click' && typeof target === 'object' && 'x' in target && 'y' in target) {
      // Check if canvas-based game
      const isCanvasBased = this.isCanvasGame(metadata);

      if (isCanvasBased) {
        // NEW: Canvas-based click
        return await this.clickCanvasCoordinates(page, target.x, target.y, metadata);
      } else {
        // Existing: Direct coordinate click
        return await this.clickAtCoordinates(page, target.x, target.y);
      }
    }

    // ... rest of existing code
  }
}

// NEW: Canvas-aware clicking
private async clickCanvasCoordinates(
  page: AnyPage,
  xPercent: number,
  yPercent: number,
  metadata?: GameMetadata
): Promise<boolean> {
  try {
    // Find canvas element
    const canvasExists = await page.locator('canvas').count() > 0;
    if (!canvasExists) {
      this.logger.warn('Canvas element not found', { op: 'clickCanvasCoordinates' });
      return false;
    }

    // Get canvas bounding box
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) {
      this.logger.warn('Canvas bounding box not found', { op: 'clickCanvasCoordinates' });
      return false;
    }

    // Convert percentage to absolute coordinates
    const x = box.x + (box.width * xPercent);
    const y = box.y + (box.height * yPercent);

    this.logger.info('Clicking canvas coordinates', {
      op: 'clickCanvasCoordinates',
      xPercent,
      yPercent,
      absoluteX: x,
      absoluteY: y,
      canvasBox: box
    });

    // Click at coordinates
    await page.click(x, y);

    // Wait for visual feedback
    await page.waitForTimeout(500);

    return true;
  } catch (error) {
    this.logger.error('Failed to click canvas coordinates', error);
    return false;
  }
}

// Helper: Check if canvas game (same logic as StateAnalyzer)
private isCanvasGame(metadata?: GameMetadata): boolean {
  // ... same implementation as StateAnalyzer.isCanvasGame()
}
```

### Step 4: Update STATE_ANALYSIS_PROMPT (30 min)

**File**: `src/vision/prompts.ts`

```typescript
export const STATE_ANALYSIS_PROMPT = `
You are analyzing a browser game to determine the next action.

IMPORTANT - Coordinate Accuracy for Canvas Games:
- If this is a canvas-based game, all game elements are rendered ON THE CANVAS, not as DOM elements
- For canvas games, you must provide coordinates as PERCENTAGES of canvas width/height (0.0 to 1.0)
  - Example: To click center of canvas, use { x: 0.5, y: 0.5 }
  - Example: To click top-left quadrant, use { x: 0.25, y: 0.25 }
- For DOM games, provide absolute pixel coordinates
- Check the game context to determine if it's canvas-based or DOM-based

... rest of existing prompt
`;
```

### Step 5: Test with Canvas Game (1 hour)

1. Use existing `_game-examples/brick-breaker-idle/metadata.json`
2. Run Adaptive QA mode:
   ```bash
   ENABLE_ADAPTIVE_QA=true bun run src/main.ts https://game-url --metadata ./_game-examples/brick-breaker-idle/metadata.json
   ```
3. Verify:
   - Agent detects canvas game
   - Agent clicks within brick grid bounds (20-80% width, 15-90% height)
   - Agent observes currency increases in screenshots
   - Agent tries multiple clicks to progress

---

## Cost-Benefit Summary

| Component | Effort | Value | Priority |
|-----------|--------|-------|----------|
| Enhanced Metadata (`specialInstructions`) | Already done | High | ✅ Keep |
| Instruction Builder Logic | 1-2 hours | High | ✅ Apply |
| Canvas Detection System | 1 hour | High | ✅ Apply |
| Canvas Click Implementation | 1 hour | High | ✅ Apply |
| Test Instruction Script | 30 min | Medium | ✅ Apply |
| StateAnalyzer Context Enhancement | 1-2 hours | High | ✅ Apply |
| OpenRouter Integration | 4-6 hours | Low (for now) | ❌ Defer |
| Stagehand-Specific Types | N/A | None | ❌ Ignore |

**Total estimated effort to apply valuable components: 5-7 hours**

**Expected impact:**
- Canvas-based games (Brick Breaker Idle, etc.) will become playable
- Better context awareness in STATE_ANALYSIS_PROMPT
- More targeted clicking strategies
- Better success validation

---

## Recommended Action Plan

### Phase 1: Canvas Game Support (3-4 hours)
1. ✅ Keep enhanced metadata (already done)
2. Add canvas detection to StateAnalyzer (1 hour)
3. Add canvas clicking to GameInteractor (1 hour)
4. Update STATE_ANALYSIS_PROMPT with canvas guidance (30 min)
5. Test with Brick Breaker Idle (1 hour)

### Phase 2: Prompt Enhancement (2-3 hours)
6. Extract instruction builder logic into `buildAdaptiveQAPrompt()` (1 hour)
7. Integrate into StateAnalyzer (1 hour)
8. Copy test script for prompt debugging (30 min)
9. Test with multiple games (pong, snake, brick-breaker)

### Phase 3: Cleanup (30 min)
10. Remove Stagehand Agent code (runStagehandAgentQA, types, tests)
11. Update README to remove Stagehand Agent mode
12. Update feature flags (remove ENABLE_STAGEHAND_AGENT)

### Phase 4 (Optional): OpenRouter Integration (4-6 hours)
13. Only do this if you want multi-provider support for cost optimization or fallback

---

## Files to Keep vs Remove

### ✅ Keep (Contains Reusable Logic)
- `src/types/game-test.types.ts` (enhanced GameMetadata with specialInstructions)
- `src/utils/stagehand-agent.ts` (instruction builder logic to port to Adaptive)
- `test-instruction.mjs` (development tool, adapt for Adaptive Agent)
- `_game-examples/brick-breaker-idle/metadata.json` (canvas game example)

### ⚠️ Keep Conditionally (If You Want OpenRouter)
- `src/services/openrouter-provider.ts`
- `src/types/config.types.ts` (OpenRouterConfig interface)
- `src/config/constants.ts` (OPENROUTER_DEFAULTS)

### ❌ Remove (Stagehand-Specific, Not Needed)
- `src/main.ts:runStagehandAgentQA()` function (~350 lines)
- `tests/integration/stagehand-agent.test.ts` (9 tests)
- `StagehandAgentAction`, `StagehandAgentResult`, `StagehandAgentMetadata` types
- `STAGEHAND_AGENT_DEFAULTS` constants
- `enableStagehandAgent` feature flag
- Stagehand Agent documentation sections in README

---

## Questions to Consider

1. **Do you want multi-provider LLM support?**
   - Yes → Keep OpenRouter integration, adapt for VisionAnalyzer
   - No → Remove OpenRouter code (save 500+ lines)

2. **Are canvas-based games important to your use case?**
   - Yes → Prioritize canvas support implementation (Phase 1)
   - No → Defer canvas support, focus on DOM game improvements

3. **How often do you debug prompts during development?**
   - Often → Copy and adapt `test-instruction.mjs` for Adaptive Agent
   - Rarely → Skip the test script

---

## Conclusion

**Bottom Line**: ~30% of the Stagehand Agent work is valuable and should be salvaged:

✅ **Apply to Adaptive Agent** (5-7 hours):
- Enhanced metadata with canvas game support
- Instruction builder logic for better prompts
- Canvas detection and clicking
- Test/debug tooling

❌ **Discard** (saves ~800 lines):
- Stagehand agent orchestration
- Stagehand-specific types and tracking
- Most of OpenRouter integration (unless you want multi-provider)

**ROI**: Investing 5-7 hours to port these components will significantly improve your Adaptive Agent's ability to handle canvas-based games and provide better contextual prompts.
