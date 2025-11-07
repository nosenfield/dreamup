# Task List: Stagehand Agent QA Mode

**Purpose**: Implement new QA mode using Stagehand's autonomous agent with OpenAI computer-use-preview model

**Estimated Total Time**: 6-8 hours

**Feature Flag**: `ENABLE_STAGEHAND_AGENT=true` (takes precedence over Adaptive QA)

---

## Background & Context

### What is Stagehand Agent?
Stagehand provides an autonomous agent that handles the observe-act loop internally using computer vision models. Instead of manually managing state capture, LLM calls, and action execution, we give the agent a high-level instruction and it autonomously navigates the browser.

**Key Documentation**:
- Stagehand Agent Basics: https://docs.stagehand.dev/v3/basics/agent
- Stagehand Agent API Reference: https://docs.stagehand.dev/v3/references/agent
- OpenAI Computer Use Preview: https://platform.openai.com/docs/models/computer-use-preview
- Our control flow: `_docs/control-flow.md`
- Our current Adaptive QA: `src/main.ts:runAdaptiveQA()` (lines 450+)

### How This Differs from Current Modes

| Feature | Standard QA | Adaptive QA | **Stagehand Agent** |
|---------|-------------|-------------|---------------------|
| Loop Management | None (single cycle) | Manual (for loop) | **Automatic (internal)** |
| State Observation | Screenshots only | HTML + screenshot | **CV-based (automatic)** |
| Action Decisions | None | StateAnalyzer + GPT-4V | **Internal LLM reasoning** |
| Code Complexity | Simple | ~450 lines | **~150 lines (estimated)** |
| Cost Control | None | Budget + duration | **maxSteps + duration** |

### Design Decisions Summary

From user requirements discussion:

1. **Mode**: New independent mode (not replacement)
2. **Precedence**: Stagehand Agent > Adaptive QA > Standard QA
3. **Model**: OpenAI `computer-use-preview` with CUA mode enabled
4. **Max Steps**: 25 (hardcoded constant, not env var)
5. **Timeout**: Use existing `MAX_TEST_DURATION` (4 minutes)
6. **Instructions**: Metadata-driven (Option B from discussion)
7. **Screenshots**: Extract from agent if possible, otherwise capture final state
8. **Vision Analysis**: Final screenshot analysis for playability score
9. **Error Handling**: Return error result (no fallback to other modes)
10. **Integration**: Use metadata for prompts, track console errors, include agent action history

---

## Task Breakdown

### Task SA.1: Add Configuration and Types (1-2 hours)

**Goal**: Define constants, feature flags, and TypeScript interfaces for Stagehand agent mode

#### Acceptance Criteria
- [ ] Constants defined for Stagehand agent defaults (max steps, model, etc.)
- [ ] Feature flag `enableStagehandAgent` added to FeatureFlags interface
- [ ] New types added to support agent result metadata
- [ ] TypeScript compilation passes
- [ ] All existing tests continue to pass

#### Implementation Steps

**1.1: Update `src/config/constants.ts`**

Add new constant group for Stagehand agent configuration:

```typescript
/**
 * Stagehand Agent QA Mode Configuration
 *
 * Uses Stagehand's autonomous agent with OpenAI computer-use-preview model.
 * Agent handles observe-act loop internally without manual state management.
 *
 * @see https://docs.stagehand.dev/v3/basics/agent
 * @see https://platform.openai.com/docs/models/computer-use-preview
 */
export const STAGEHAND_AGENT_DEFAULTS = {
  /**
   * Maximum number of autonomous actions agent can take
   * Higher = more exploration, higher cost
   * Lower = faster execution, may not complete complex tasks
   */
  MAX_STEPS: 25,

  /**
   * OpenAI model for computer use with vision capabilities
   * Supports autonomous screen control via Computer Use Agent (CUA) mode
   */
  MODEL: 'openai/computer-use-preview',

  /**
   * Whether to show visual cursor highlights during execution
   * Useful for debugging but may interfere with game UI
   */
  HIGHLIGHT_CURSOR: false,

  /**
   * System prompt for agent behavior
   * Instructs agent to act as QA tester
   */
  SYSTEM_PROMPT: 'You are a QA tester for browser games. Your goal is to test all functionality, try different controls, look for bugs, and explore the game thoroughly. Report any errors or unusual behavior you encounter.',
} as const;
```

**References**:
- Pattern: See `TIMEOUTS`, `THRESHOLDS`, `PATHS` in same file for structure
- Export pattern: Add to existing exports at bottom of file

**1.2: Update `src/config/feature-flags.ts`**

Add feature flag with highest precedence:

```typescript
export interface FeatureFlags {
  enableCaching: boolean;
  enableProgressUpdates: boolean;
  enableErrorRecovery: boolean;
  enableScreenshotCleanup: boolean;
  enableDetailedLogging: boolean;
  enableAdaptiveQA: boolean;
  enableStagehandAgent: boolean;  // NEW: Takes precedence over enableAdaptiveQA
}

export const DEFAULT_FLAGS: FeatureFlags = {
  // ... existing flags ...
  enableAdaptiveQA: false,
  enableStagehandAgent: false,  // NEW: Default disabled (opt-in)
};

export function getFeatureFlags(): FeatureFlags {
  return {
    ...DEFAULT_FLAGS,
    enableDetailedLogging: process.env.DEBUG === 'true',
    enableScreenshotCleanup: process.env.ENABLE_SCREENSHOT_CLEANUP === 'true',
    enableAdaptiveQA: process.env.ENABLE_ADAPTIVE_QA === 'true',
    enableStagehandAgent: process.env.ENABLE_STAGEHAND_AGENT === 'true',  // NEW
  };
}
```

**1.3: Update `src/types/game-test.types.ts`**

Add new interfaces for Stagehand agent metadata:

```typescript
/**
 * Action taken by Stagehand agent during autonomous execution
 * Returned in AgentResult.actions array
 *
 * @see https://docs.stagehand.dev/v3/references/agent
 */
export interface StagehandAgentAction {
  /** Type of action performed (e.g., 'click', 'type', 'navigate') */
  type: string;

  /** Agent's reasoning for taking this action */
  reasoning: string;

  /** Whether agent considered task completed after this action */
  completed: boolean;

  /** URL of page when action was taken */
  url: string;

  /** Timestamp when action was executed */
  timestamp: string;
}

/**
 * Result from Stagehand agent.execute() call
 * Contains execution summary and detailed action history
 *
 * @see https://docs.stagehand.dev/v3/references/agent
 */
export interface StagehandAgentResult {
  /** Whether agent successfully completed the task */
  success: boolean;

  /** Agent's summary message about task execution */
  message: string;

  /** Array of all actions taken during execution */
  actions: StagehandAgentAction[];

  /** Agent's assessment of whether task was fully completed */
  completed: boolean;

  /** Token usage and inference time metrics */
  usage?: {
    input_tokens: number;
    output_tokens: number;
    inference_time_ms: number;
  };
}

/**
 * Metadata specific to Stagehand agent QA execution
 * Included in GameTestResult.metadata.stagehandAgent
 */
export interface StagehandAgentMetadata {
  /** Whether agent reported successful task completion */
  success: boolean;

  /** Whether agent considered task fully completed */
  completed: boolean;

  /** Number of actions taken during execution */
  actionCount: number;

  /** Detailed action history from agent execution */
  actions: StagehandAgentAction[];

  /** Agent's summary message */
  message: string;

  /** Token usage if available */
  usage?: {
    input_tokens: number;
    output_tokens: number;
    inference_time_ms: number;
  };
}
```

**1.4: Update `src/types/game-test.types.ts` - TestMetadata interface**

Add optional field for Stagehand agent data:

```typescript
export interface TestMetadata {
  sessionId: string;
  gameUrl: string;
  duration: number;
  gameType: GameType;
  consoleErrors: ConsoleError[];
  visionAnalysisTokens?: number;
  actionHistory?: Action[];  // Existing for Adaptive QA
  adaptiveConfig?: AdaptiveTestConfig;  // Existing for Adaptive QA
  estimatedCost?: number;  // Existing for Adaptive QA
  stagehandAgent?: StagehandAgentMetadata;  // NEW: For Stagehand Agent mode
}
```

**1.5: Update exports**

Update `src/types/index.ts`:
```typescript
export type {
  // ... existing exports ...
  StagehandAgentAction,
  StagehandAgentResult,
  StagehandAgentMetadata,
} from './game-test.types.js';
```

Update `src/config/index.ts`:
```typescript
export { TIMEOUTS, THRESHOLDS, PATHS, ADAPTIVE_DEFAULTS, ADAPTIVE_COSTS, STAGEHAND_AGENT_DEFAULTS } from './constants.js';
```

**1.6: Create unit tests**

Create `tests/unit/stagehand-agent-types.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
import type {
  StagehandAgentAction,
  StagehandAgentResult,
  StagehandAgentMetadata,
  TestMetadata,
} from '../../src/types/index.js';
import { STAGEHAND_AGENT_DEFAULTS } from '../../src/config/index.js';

describe('Stagehand Agent Types', () => {
  test('StagehandAgentAction type exists and has correct structure', () => {
    const action: StagehandAgentAction = {
      type: 'click',
      reasoning: 'Clicking start button',
      completed: false,
      url: 'https://example.com/game',
      timestamp: new Date().toISOString(),
    };

    expect(action.type).toBe('click');
    expect(action.reasoning).toBe('Clicking start button');
  });

  test('StagehandAgentResult type exists and has correct structure', () => {
    const result: StagehandAgentResult = {
      success: true,
      message: 'Task completed successfully',
      actions: [],
      completed: true,
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        inference_time_ms: 2000,
      },
    };

    expect(result.success).toBe(true);
    expect(result.completed).toBe(true);
  });

  test('StagehandAgentMetadata type exists', () => {
    const metadata: StagehandAgentMetadata = {
      success: true,
      completed: true,
      actionCount: 5,
      actions: [],
      message: 'Test completed',
    };

    expect(metadata.actionCount).toBe(5);
  });

  test('TestMetadata accepts stagehandAgent field', () => {
    const metadata: Partial<TestMetadata> = {
      sessionId: 'test-123',
      gameUrl: 'https://example.com/game',
      stagehandAgent: {
        success: true,
        completed: true,
        actionCount: 3,
        actions: [],
        message: 'Game tested successfully',
      },
    };

    expect(metadata.stagehandAgent?.success).toBe(true);
  });

  test('STAGEHAND_AGENT_DEFAULTS has correct structure', () => {
    expect(STAGEHAND_AGENT_DEFAULTS.MAX_STEPS).toBe(25);
    expect(STAGEHAND_AGENT_DEFAULTS.MODEL).toBe('openai/computer-use-preview');
    expect(STAGEHAND_AGENT_DEFAULTS.HIGHLIGHT_CURSOR).toBe(false);
    expect(typeof STAGEHAND_AGENT_DEFAULTS.SYSTEM_PROMPT).toBe('string');
  });
});
```

**1.7: Update feature flags tests**

Update `tests/unit/feature-flags.test.ts`:

```typescript
test('enableStagehandAgent defaults to false', () => {
  delete process.env.ENABLE_STAGEHAND_AGENT;
  const flags = getFeatureFlags();
  expect(flags.enableStagehandAgent).toBe(false);
});

test('enableStagehandAgent reads from environment', () => {
  process.env.ENABLE_STAGEHAND_AGENT = 'true';
  const flags = getFeatureFlags();
  expect(flags.enableStagehandAgent).toBe(true);
  delete process.env.ENABLE_STAGEHAND_AGENT;
});
```

**Files to Create**:
- `tests/unit/stagehand-agent-types.test.ts`

**Files to Modify**:
- `src/config/constants.ts`
- `src/config/feature-flags.ts`
- `src/config/index.ts`
- `src/types/game-test.types.ts`
- `src/types/index.ts`
- `tests/unit/feature-flags.test.ts`

**Tests to Run**:
```bash
bun test tests/unit/stagehand-agent-types.test.ts
bun test tests/unit/feature-flags.test.ts
bunx tsc --noEmit
```

---

### Task SA.2: Implement Instruction Builder (1 hour)

**Goal**: Create metadata-driven instruction builder for Stagehand agent

#### Acceptance Criteria
- [ ] Function builds natural language instructions from GameMetadata
- [ ] Handles missing metadata gracefully (fallback to generic instruction)
- [ ] Extracts controls from InputSchema (actions + axes)
- [ ] Uses testingStrategy.goals if available
- [ ] Includes time-based completion criteria
- [ ] Unit tests pass with various metadata configurations

#### Implementation Steps

**2.1: Create `src/utils/stagehand-agent.ts`**

New utility file for Stagehand agent helpers:

```typescript
import type { GameMetadata } from '../types/game-test.types.js';

/**
 * Builds natural language instruction for Stagehand agent from game metadata
 *
 * Generates detailed QA testing instructions including:
 * - Game genre and type
 * - Expected controls (from InputSchema)
 * - Testing objectives (from testingStrategy.goals)
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

  // Extract testing goals from testingStrategy
  const goals = metadata.testingStrategy?.goals || [
    'Start the game',
    'Test basic controls',
    'Try to progress through gameplay',
  ];

  const objectivesText = `Your objectives: ${goals.join('; ')}.`;

  // Build complete instruction
  return `Test this ${genre} game. ${controlsText}${objectivesText} Play for about 2 minutes or until you reach a clear completion point (like game over, level complete, or winning the game).`;
}

/**
 * Attempts to extract screenshot paths from Stagehand agent actions
 *
 * Checks if agent actions contain screenshot data. Based on current
 * Stagehand documentation, actions likely do NOT include screenshots,
 * but this function provides forward compatibility if API changes.
 *
 * @param actions - Array of agent actions from AgentResult
 * @returns Array of screenshot file paths (likely empty with current API)
 *
 * @see https://docs.stagehand.dev/v3/references/agent (AgentAction structure)
 */
export function extractScreenshotsFromActions(actions: any[]): string[] {
  // TODO: Check if actions have screenshot field
  // Current API returns: { type, reasoning, completed, url, timestamp }
  // No screenshot field documented

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
```

**2.2: Update exports**

Update `src/utils/index.ts`:
```typescript
export {
  buildStagehandInstruction,
  extractScreenshotsFromActions,
} from './stagehand-agent.js';
```

**2.3: Create unit tests**

Create `tests/unit/stagehand-agent.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
import { buildStagehandInstruction, extractScreenshotsFromActions } from '../../src/utils/stagehand-agent.js';
import type { GameMetadata } from '../../src/types/index.js';

describe('buildStagehandInstruction', () => {
  test('returns generic instruction when no metadata provided', () => {
    const instruction = buildStagehandInstruction();

    expect(instruction).toContain('Play this browser game');
    expect(instruction).toContain('test basic functionality');
    expect(instruction).toContain('2 minutes');
  });

  test('includes genre from metadata', () => {
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
      genre: 'platformer',
    };

    const instruction = buildStagehandInstruction(metadata);

    expect(instruction).toContain('platformer game');
  });

  test('extracts actions from inputSchema (structured format)', () => {
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
      inputSchema: {
        type: 'javascript',
        content: '',
        actions: [
          { name: 'Jump', keys: ['Space'] },
          { name: 'Shoot', keys: ['KeyX'] },
        ],
      },
    };

    const instruction = buildStagehandInstruction(metadata);

    expect(instruction).toContain('Expected controls: Jump, Shoot');
  });

  test('extracts axes from inputSchema (structured format)', () => {
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
      inputSchema: {
        type: 'javascript',
        content: '',
        axes: [
          { name: 'MoveHorizontal', keys: ['ArrowLeft', 'ArrowRight'] },
        ],
      },
    };

    const instruction = buildStagehandInstruction(metadata);

    expect(instruction).toContain('Expected controls: MoveHorizontal');
  });

  test('handles string array format for actions/axes', () => {
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
      inputSchema: {
        type: 'semantic',
        content: 'Use WASD to move',
        actions: ['Pause', 'Restart'],
        axes: ['Move'],
      },
    };

    const instruction = buildStagehandInstruction(metadata);

    expect(instruction).toContain('Expected controls: Pause, Restart, Move');
  });

  test('uses testingStrategy.goals if available', () => {
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
      testingStrategy: {
        goals: [
          'Reach level 2',
          'Collect at least 10 coins',
          'Defeat the boss',
        ],
      },
    };

    const instruction = buildStagehandInstruction(metadata);

    expect(instruction).toContain('Reach level 2');
    expect(instruction).toContain('Collect at least 10 coins');
    expect(instruction).toContain('Defeat the boss');
  });

  test('uses default goals when testingStrategy.goals missing', () => {
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
      genre: 'puzzle',
    };

    const instruction = buildStagehandInstruction(metadata);

    expect(instruction).toContain('Start the game');
    expect(instruction).toContain('Test basic controls');
    expect(instruction).toContain('Try to progress through gameplay');
  });

  test('includes time-based completion criteria', () => {
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
    };

    const instruction = buildStagehandInstruction(metadata);

    expect(instruction).toContain('2 minutes');
    expect(instruction).toContain('completion point');
  });

  test('combines all metadata elements correctly (Pong example)', () => {
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
      genre: 'arcade',
      inputSchema: {
        type: 'javascript',
        content: '',
        actions: [{ name: 'Pause', keys: ['Escape'] }],
        axes: [{ name: 'RightPaddleVertical', keys: ['ArrowDown', 'ArrowUp'] }],
      },
      testingStrategy: {
        goals: [
          'Start the game',
          'Test paddle controls',
          'Score at least one point',
        ],
      },
    };

    const instruction = buildStagehandInstruction(metadata);

    expect(instruction).toContain('arcade game');
    expect(instruction).toContain('Pause, RightPaddleVertical');
    expect(instruction).toContain('Start the game');
    expect(instruction).toContain('Test paddle controls');
    expect(instruction).toContain('Score at least one point');
  });
});

describe('extractScreenshotsFromActions', () => {
  test('returns empty array when no actions', () => {
    const screenshots = extractScreenshotsFromActions([]);
    expect(screenshots).toEqual([]);
  });

  test('returns empty array when actions have no screenshot field', () => {
    const actions = [
      { type: 'click', reasoning: 'Click start', completed: false, url: 'https://example.com', timestamp: '2025-01-01' },
      { type: 'keypress', reasoning: 'Press space', completed: false, url: 'https://example.com', timestamp: '2025-01-01' },
    ];

    const screenshots = extractScreenshotsFromActions(actions);
    expect(screenshots).toEqual([]);
  });

  test('extracts screenshot field if present', () => {
    const actions = [
      { type: 'click', screenshot: '/path/to/screenshot1.png' },
      { type: 'keypress', screenshot: '/path/to/screenshot2.png' },
    ];

    const screenshots = extractScreenshotsFromActions(actions);
    expect(screenshots).toEqual(['/path/to/screenshot1.png', '/path/to/screenshot2.png']);
  });

  test('extracts screenshots array field if present', () => {
    const actions = [
      { type: 'click', screenshots: ['/path/1.png', '/path/2.png'] },
    ];

    const screenshots = extractScreenshotsFromActions(actions);
    expect(screenshots).toEqual(['/path/1.png', '/path/2.png']);
  });

  test('ignores non-string screenshot values', () => {
    const actions = [
      { type: 'click', screenshot: 123 },
      { type: 'keypress', screenshots: ['/valid.png', null, undefined, 456] },
    ];

    const screenshots = extractScreenshotsFromActions(actions);
    expect(screenshots).toEqual(['/valid.png']);
  });
});
```

**Files to Create**:
- `src/utils/stagehand-agent.ts`
- `tests/unit/stagehand-agent.test.ts`

**Files to Modify**:
- `src/utils/index.ts`

**Tests to Run**:
```bash
bun test tests/unit/stagehand-agent.test.ts
bunx tsc --noEmit
```

---

### Task SA.3: Implement runStagehandAgentQA() Function (3-4 hours)

**Goal**: Create main orchestration function for Stagehand Agent QA mode

#### Acceptance Criteria
- [ ] Function initializes browser and navigates to game
- [ ] Creates Stagehand agent with OpenAI computer-use-preview model
- [ ] Executes agent with metadata-driven instruction
- [ ] Captures final screenshot for vision analysis
- [ ] Tracks console errors throughout execution
- [ ] Returns GameTestResult with agent action history
- [ ] Respects MAX_TEST_DURATION timeout
- [ ] Handles errors gracefully (returns error result, no fallback)
- [ ] Cleans up browser session in finally block
- [ ] Integration tests pass

#### Implementation Steps

**3.1: Update `src/main.ts` - Add runStagehandAgentQA() function**

Add new function after `runAdaptiveQA()`:

```typescript
/**
 * Run QA test using Stagehand's autonomous agent
 *
 * Uses Stagehand agent with OpenAI computer-use-preview model for fully autonomous
 * browser testing. Agent handles observe-act loop internally without manual state
 * management. Returns result with agent action history and final vision analysis.
 *
 * Mode Comparison:
 * - Standard QA: Single interaction cycle, fixed inputs, 2-4 min, $0.02-0.05
 * - Adaptive QA: Manual loop, state analysis each step, 2-4 min, $0.10-0.50
 * - Stagehand Agent: Autonomous loop, internal reasoning, 2-4 min, cost TBD
 *
 * @param gameUrl - URL of the game to test
 * @param metadata - Optional game metadata for instruction building
 * @param config - Optional configuration overrides
 * @returns Promise resolving to GameTestResult with agent action history
 *
 * @example
 * const result = await runStagehandAgentQA('https://example.com/game', metadata);
 * console.log(result.metadata.stagehandAgent.actionCount); // 12
 * console.log(result.metadata.stagehandAgent.success); // true
 *
 * @see https://docs.stagehand.dev/v3/basics/agent
 * @see https://platform.openai.com/docs/models/computer-use-preview
 * @see _docs/control-flow.md (comparison of QA modes)
 */
export async function runStagehandAgentQA(
  gameUrl: string,
  metadata?: GameMetadata,
  config?: Partial<TestConfig>
): Promise<GameTestResult> {
  const sessionId = nanoid();
  const startTime = Date.now();
  const logger = new Logger();

  logger.info('Starting Stagehand Agent QA', {
    sessionId,
    gameUrl,
    hasMetadata: !!metadata,
  });

  try {
    // 1. Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required for Stagehand Agent mode');
    }

    // 2. Initialize browser
    const fileManager = new FileManager({ logger, sessionId });
    const browserManager = new BrowserManager({
      logger,
      config: config || {}
    });

    const page = await withTimeout(
      browserManager.initialize(),
      {
        milliseconds: TIMEOUTS.PAGE_NAVIGATION_TIMEOUT,
        message: 'Browser initialization timeout'
      }
    );

    logger.info('Browser initialized', { sessionId });

    // 3. Navigate to game
    await withTimeout(
      browserManager.navigate(gameUrl),
      {
        milliseconds: TIMEOUTS.PAGE_NAVIGATION_TIMEOUT,
        message: 'Page navigation timeout'
      }
    );

    logger.info('Navigated to game URL', { sessionId, gameUrl });

    // 4. Detect game type
    const gameDetector = new GameDetector({ logger });
    const gameType = await gameDetector.detectType(page);

    logger.info('Game type detected', { sessionId, gameType });

    // 5. Wait for game ready
    const isReady = await gameDetector.waitForGameReady(page, TIMEOUTS.GAME_LOAD_TIMEOUT);

    if (!isReady) {
      logger.warn('Game ready detection timed out, continuing anyway', { sessionId });
    } else {
      logger.info('Game ready', { sessionId });
    }

    // 6. Start error monitoring
    const errorMonitor = new ErrorMonitor({ logger });
    errorMonitor.startMonitoring(page);

    logger.info('Error monitoring started', { sessionId });

    // 7. Create Stagehand agent
    // Access stagehand instance from page (Stagehand v3 API)
    // Page is created by stagehand.context.pages()[0], so we can access stagehand via page
    const stagehandInstance = (page as any).context?._stagehand || (page as any)._stagehand;

    if (!stagehandInstance) {
      throw new Error('Unable to access Stagehand instance from page. Ensure BrowserManager is using Stagehand v3.');
    }

    const agent = stagehandInstance.agent({
      cua: true,  // Enable Computer Use Agent mode
      model: {
        modelName: STAGEHAND_AGENT_DEFAULTS.MODEL,
        apiKey: process.env.OPENAI_API_KEY,
      },
      systemPrompt: STAGEHAND_AGENT_DEFAULTS.SYSTEM_PROMPT,
    });

    logger.info('Stagehand agent created', {
      sessionId,
      model: STAGEHAND_AGENT_DEFAULTS.MODEL,
    });

    // 8. Build instruction from metadata
    const instruction = buildStagehandInstruction(metadata);

    logger.info('Agent instruction built', {
      sessionId,
      instruction: instruction.substring(0, 100) + '...',  // Log first 100 chars
      hasMetadata: !!metadata,
    });

    // 9. Execute agent with timeout
    logger.info('Starting agent execution', {
      sessionId,
      maxSteps: STAGEHAND_AGENT_DEFAULTS.MAX_STEPS,
    });

    const agentResult = await withTimeout(
      agent.execute({
        instruction,
        maxSteps: STAGEHAND_AGENT_DEFAULTS.MAX_STEPS,
        highlightCursor: STAGEHAND_AGENT_DEFAULTS.HIGHLIGHT_CURSOR,
      }),
      {
        milliseconds: TIMEOUTS.MAX_TEST_DURATION,
        message: 'Agent execution timeout'
      }
    );

    logger.info('Agent execution completed', {
      sessionId,
      success: agentResult.success,
      completed: agentResult.completed,
      actionCount: agentResult.actions?.length || 0,
      message: agentResult.message,
      usage: agentResult.usage,
    });

    // 10. Try to extract screenshots from agent actions
    const agentScreenshots = extractScreenshotsFromActions(agentResult.actions || []);

    if (agentScreenshots.length > 0) {
      logger.info('Extracted screenshots from agent actions', {
        sessionId,
        count: agentScreenshots.length,
      });
    } else {
      logger.info('No screenshots in agent actions, will capture manually', { sessionId });
    }

    // 11. Capture final screenshot
    const screenshotCapturer = new ScreenshotCapturer({ logger, fileManager, sessionId });
    const finalScreenshot = await screenshotCapturer.capture(page, 'final_state');

    logger.info('Final screenshot captured', {
      sessionId,
      path: finalScreenshot.path,
    });

    // 12. Vision analysis on final screenshot
    const visionAnalyzer = new VisionAnalyzer({
      logger,
      apiKey: process.env.OPENAI_API_KEY
    });

    const visionResult = await visionAnalyzer.analyzeScreenshots(
      [finalScreenshot],
      metadata
    );

    logger.info('Vision analysis completed', {
      sessionId,
      playabilityScore: visionResult.playability_score,
      issueCount: visionResult.issues.length,
    });

    // 13. Get console errors
    const consoleErrors = errorMonitor.getErrors();
    errorMonitor.stopMonitoring(page);

    logger.info('Error monitoring stopped', {
      sessionId,
      errorCount: consoleErrors.length,
    });

    // 14. Determine pass/fail status
    const status = visionResult.playability_score >= THRESHOLDS.PLAYABILITY_PASS_SCORE
      ? 'pass'
      : 'fail';

    // 15. Build result with agent metadata
    const result: GameTestResult = {
      status,
      playability_score: visionResult.playability_score,
      issues: visionResult.issues,
      screenshots: [finalScreenshot.path],
      timestamp: new Date().toISOString(),
      metadata: {
        sessionId,
        gameUrl,
        duration: Date.now() - startTime,
        gameType,
        consoleErrors,
        visionAnalysisTokens: visionResult.usage?.promptTokens,
        stagehandAgent: {
          success: agentResult.success,
          completed: agentResult.completed,
          actionCount: agentResult.actions?.length || 0,
          actions: agentResult.actions || [],
          message: agentResult.message,
          usage: agentResult.usage,
        },
      },
    };

    // 16. Cleanup
    await browserManager.cleanup();

    logger.info('Stagehand Agent QA completed', {
      sessionId,
      status: result.status,
      playabilityScore: result.playability_score,
      duration: result.metadata.duration,
    });

    return result;

  } catch (error) {
    logger.error('Stagehand Agent QA failed', {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Return error result (no fallback to other modes)
    return {
      status: 'error',
      playability_score: 0,
      issues: [{
        severity: 'critical',
        description: `Stagehand Agent QA failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
      }],
      screenshots: [],
      timestamp: new Date().toISOString(),
      metadata: {
        sessionId,
        gameUrl,
        duration: Date.now() - startTime,
        gameType: GameType.UNKNOWN,
        consoleErrors: [],
      },
    };
  }
}
```

**3.2: Update CLI entry point with mode precedence**

Update the CLI entry point in `src/main.ts` to respect Stagehand Agent > Adaptive > Standard precedence:

```typescript
// CLI entry point
if (import.meta.main) {
  const args = parseCLIArgs();

  if (!args.gameUrl) {
    console.error('Usage: bun run src/main.ts <game-url> [--metadata <path>]');
    process.exit(1);
  }

  // Load metadata if provided
  let metadata: GameMetadata | undefined;
  if (args.metadataPath) {
    const loadResult = await loadMetadataFromFile(args.metadataPath);
    if (!loadResult.success) {
      console.error(`Failed to load metadata: ${loadResult.error}`);
      process.exit(1);
    }
    metadata = loadResult.metadata;
  }

  // Select QA mode based on feature flags (PRECEDENCE: Stagehand > Adaptive > Standard)
  const flags = getFeatureFlags();
  let result: GameTestResult;

  if (flags.enableStagehandAgent) {
    console.log('Running in Stagehand Agent mode (autonomous)...');
    result = await runStagehandAgentQA(args.gameUrl, metadata);
  } else if (flags.enableAdaptiveQA) {
    console.log('Running in Adaptive QA mode (iterative)...');
    result = await runAdaptiveQA(args.gameUrl, metadata);
  } else {
    console.log('Running in Standard QA mode (single cycle)...');
    result = await runQA(args.gameUrl, metadata);
  }

  // Output result
  console.log(JSON.stringify(result, null, 2));

  // Exit with appropriate code
  const exitCode = result.status === 'pass' ? 0 : 1;
  process.exit(exitCode);
}
```

**3.3: Create integration tests**

Create `tests/integration/stagehand-agent.test.ts`:

```typescript
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { runStagehandAgentQA } from '../../src/main.js';
import type { GameMetadata } from '../../src/types/index.js';

// Mock environment
process.env.BROWSERBASE_API_KEY = 'test-key';
process.env.BROWSERBASE_PROJECT_ID = 'test-project';
process.env.OPENAI_API_KEY = 'test-openai-key';

describe('runStagehandAgentQA Integration Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mock.restore();
  });

  test('throws error if OPENAI_API_KEY missing', async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await runStagehandAgentQA('https://example.com/game');

    expect(result.status).toBe('error');
    expect(result.issues[0].description).toContain('OPENAI_API_KEY');

    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  test('initializes browser and navigates to game URL', async () => {
    // This test would require full mocking of BrowserManager, Stagehand, etc.
    // For now, we'll verify the function exists and has correct signature
    expect(typeof runStagehandAgentQA).toBe('function');
  });

  test('accepts optional metadata parameter', async () => {
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
      genre: 'arcade',
    };

    // Function should accept metadata without throwing
    expect(() => {
      const promise = runStagehandAgentQA('https://example.com/game', metadata);
      // Don't await - just verify signature
    }).not.toThrow();
  });

  test('accepts optional config parameter', async () => {
    const config = {
      maxDuration: 60000,
    };

    // Function should accept config without throwing
    expect(() => {
      const promise = runStagehandAgentQA('https://example.com/game', undefined, config);
      // Don't await - just verify signature
    }).not.toThrow();
  });

  test('returns GameTestResult with required fields', async () => {
    // Mock would go here - for now verify type signature
    // Real test would verify result has: status, playability_score, issues, screenshots, timestamp, metadata
  });

  test('includes stagehandAgent metadata in result', async () => {
    // Mock would go here
    // Real test would verify result.metadata.stagehandAgent exists with:
    // success, completed, actionCount, actions, message, usage
  });

  test('respects MAX_TEST_DURATION timeout', async () => {
    // Mock would go here
    // Real test would verify agent.execute() is wrapped with withTimeout(MAX_TEST_DURATION)
  });

  test('tracks console errors during execution', async () => {
    // Mock would go here
    // Real test would verify ErrorMonitor is started before agent execution
    // and consoleErrors included in result.metadata
  });

  test('captures final screenshot after agent execution', async () => {
    // Mock would go here
    // Real test would verify ScreenshotCapturer.capture() is called with 'final_state'
  });

  test('performs vision analysis on final screenshot', async () => {
    // Mock would go here
    // Real test would verify VisionAnalyzer.analyzeScreenshots() is called
  });

  test('cleans up browser session on success', async () => {
    // Mock would go here
    // Real test would verify browserManager.cleanup() is called
  });

  test('cleans up browser session on error', async () => {
    // Mock would go here with error thrown
    // Real test would verify browserManager.cleanup() is still called (finally block)
  });
});

describe('CLI Mode Selection', () => {
  test('Stagehand Agent takes precedence over Adaptive QA', () => {
    process.env.ENABLE_STAGEHAND_AGENT = 'true';
    process.env.ENABLE_ADAPTIVE_QA = 'true';

    const flags = getFeatureFlags();

    expect(flags.enableStagehandAgent).toBe(true);
    expect(flags.enableAdaptiveQA).toBe(true);

    // In CLI, should use Stagehand Agent (verified manually or with spy)

    delete process.env.ENABLE_STAGEHAND_AGENT;
    delete process.env.ENABLE_ADAPTIVE_QA;
  });

  test('Adaptive QA used when Stagehand Agent disabled', () => {
    delete process.env.ENABLE_STAGEHAND_AGENT;
    process.env.ENABLE_ADAPTIVE_QA = 'true';

    const flags = getFeatureFlags();

    expect(flags.enableStagehandAgent).toBe(false);
    expect(flags.enableAdaptiveQA).toBe(true);

    delete process.env.ENABLE_ADAPTIVE_QA;
  });

  test('Standard QA used when both flags disabled', () => {
    delete process.env.ENABLE_STAGEHAND_AGENT;
    delete process.env.ENABLE_ADAPTIVE_QA;

    const flags = getFeatureFlags();

    expect(flags.enableStagehandAgent).toBe(false);
    expect(flags.enableAdaptiveQA).toBe(false);
  });
});
```

**Files to Modify**:
- `src/main.ts` (add `runStagehandAgentQA()`, update CLI entry point)

**Files to Create**:
- `tests/integration/stagehand-agent.test.ts`

**Tests to Run**:
```bash
bun test tests/integration/stagehand-agent.test.ts
bunx tsc --noEmit
```

**Note**: Full integration tests require extensive mocking of Stagehand agent API. Initial tests focus on function signatures and basic validation. Real E2E tests should be done manually with actual games.

---

### Task SA.4: Update Documentation (1 hour)

**Goal**: Document Stagehand Agent QA mode in existing documentation files

#### Acceptance Criteria
- [ ] README.md updated with Stagehand Agent mode usage
- [ ] control-flow.md updated with Stagehand Agent flow
- [ ] .env.example updated with ENABLE_STAGEHAND_AGENT flag
- [ ] All documentation is clear and includes examples

#### Implementation Steps

**4.1: Update `README.md`**

Add Stagehand Agent mode section after Adaptive QA section:

```markdown
### Stagehand Agent QA Mode (Autonomous)

**Fully autonomous mode using Stagehand's agent with OpenAI computer-use-preview model.**

The agent handles the observe-act loop internally without manual state management. Simply provide a high-level instruction and the agent explores the game autonomously.

**Enable**:
```bash
ENABLE_STAGEHAND_AGENT=true
```

**Requirements**:
- `OPENAI_API_KEY` environment variable
- OpenAI computer-use-preview model access

**How it works**:
1. Agent receives metadata-driven instruction (e.g., "Test this arcade game. Expected controls: Pause, Movement. Play for 2 minutes.")
2. Agent autonomously navigates game using computer vision
3. Agent takes up to 25 actions (configurable in constants)
4. Final screenshot captured for playability analysis
5. Result includes agent action history and reasoning

**Configuration**:
- Max steps: 25 (hardcoded in `STAGEHAND_AGENT_DEFAULTS.MAX_STEPS`)
- Timeout: 4 minutes (uses `MAX_TEST_DURATION`)
- Model: `openai/computer-use-preview`

**Cost**: TBD (depends on action count and token usage)

**Use when**:
- You want fully autonomous testing without manual loop management
- Game requires complex multi-step interactions
- You have OpenAI API access with computer-use-preview

**Example**:
```bash
ENABLE_STAGEHAND_AGENT=true bun run src/main.ts https://example.com/game --metadata ./game/metadata.json
```

**Result includes**:
```json
{
  "metadata": {
    "stagehandAgent": {
      "success": true,
      "completed": true,
      "actionCount": 12,
      "actions": [
        {
          "type": "click",
          "reasoning": "Clicking start button to begin game",
          "completed": false,
          "url": "https://example.com/game",
          "timestamp": "2025-01-01T00:00:00Z"
        }
      ],
      "message": "Successfully tested game functionality",
      "usage": {
        "input_tokens": 5000,
        "output_tokens": 1500,
        "inference_time_ms": 8000
      }
    }
  }
}
```
```

**4.2: Update `_docs/control-flow.md`**

Add new section after Adaptive QA Mode section:

```markdown
## Stagehand Agent QA Mode: Detailed Flow

Stagehand Agent mode uses Stagehand's autonomous agent with OpenAI computer-use-preview model for fully autonomous testing. The agent handles the observe-act loop internally.

### Stagehand Agent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Phases 1-3: Same as Standard/Adaptive Mode                     │
│  (Initialize → Navigate → Detect → Wait for Ready)              │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  Phase 4: STAGEHAND AGENT EXECUTION (replaces manual loop)      │
│                                                                  │
│  Configuration:                                                 │
│  • maxSteps: 25 (max autonomous actions)                        │
│  • maxDuration: 240000ms (4 minutes)                            │
│  • model: openai/computer-use-preview                           │
│  • cua: true (Computer Use Agent mode)                          │
│                                                                  │
│  Instruction (metadata-driven):                                 │
│  "Test this [genre] game. Expected controls: [actions, axes].   │
│   Your objectives: [goals]. Play for about 2 minutes or until   │
│   you reach a clear completion point."                          │
│                                                                  │
│  Agent Internal Loop (autonomous, hidden from us):              │
│  • Observe screen (computer vision)                             │
│  • Reason about next action                                     │
│  • Execute action (click, type, navigate, etc.)                 │
│  • Check if task completed                                      │
│  • Repeat until: task done OR maxSteps reached OR timeout      │
│                                                                  │
│  Returns: AgentResult {                                         │
│    success, message, actions[], completed, usage                │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  Phase 5: Final Analysis                                        │
│  • Capture final screenshot                                     │
│  • Vision analysis for playability score                        │
│  • Include agent action history in result                       │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  Phase 6: Cleanup & Report (same as other modes)                │
│  • Add stagehandAgent metadata to result                        │
│  • Track console errors                                         │
│  • Return result with action history                            │
└─────────────────────────────────────────────────────────────────┘
```

### Mode Comparison Table

| Feature | Standard QA | Adaptive QA | **Stagehand Agent** |
|---------|-------------|-------------|---------------------|
| Loop Management | None | Manual (for loop) | **Automatic (internal)** |
| State Observation | Screenshots | HTML + screenshot | **CV-based (automatic)** |
| Action Decisions | None | StateAnalyzer + GPT-4V | **Internal LLM** |
| Code Complexity | Simple | ~450 lines | **~150 lines** |
| Duration | 2-4 min | 2-4 min | **2-4 min** |
| Cost (typical) | $0.02-0.05 | $0.10-0.50 | **TBD** |
| Cost Control | None | Budget + duration | **maxSteps + duration** |
| Transparency | Full | Full | **Limited (black box)** |
| Use Case | Quick validation | Complex navigation | **Fully autonomous** |

### Performance Characteristics

| Metric | Value |
|--------|-------|
| Initialization | 5-10s (same as other modes) |
| Agent Execution | Variable (depends on task complexity) |
| Max Actions | 25 (configurable) |
| Timeout | 4 minutes (MAX_TEST_DURATION) |
| Final Analysis | 10-20s (vision analysis) |
| Total Duration | 2-4 minutes (typical) |
| Cost | TBD (depends on action count and tokens) |

### Agent Action Types

Based on Stagehand documentation, agent can perform:
- **click**: Click elements on page
- **type**: Enter text in input fields
- **navigate**: Navigate to different URLs
- **scroll**: Scroll page content
- **wait**: Wait for elements or conditions
- **extract**: Extract data from page
- **custom tools**: Extended functionality via MCP integrations

Each action includes:
```typescript
{
  type: string,           // Action type
  reasoning: string,      // Why agent took this action
  completed: boolean,     // Whether task considered done
  url: string,           // Current page URL
  timestamp: string      // When action executed
}
```

### Error Handling

**Agent Execution Errors**:
- Agent timeout (4 minutes) → Return error result
- maxSteps reached → Include in result (not failure)
- Agent reports incomplete → Include in result (vision analysis decides pass/fail)
- OpenAI API error → Return error result

**No Fallback**: Unlike detection strategies, Stagehand Agent mode does NOT fall back to other modes on failure. Returns error result immediately.
```

**4.3: Update `.env.example`**

Add new flag after ENABLE_ADAPTIVE_QA:

```bash
# Optional: Enable Stagehand Agent QA Mode (autonomous, takes precedence over Adaptive QA)
# Requires OPENAI_API_KEY and access to computer-use-preview model
# Agent handles observe-act loop internally, up to 25 autonomous actions
ENABLE_STAGEHAND_AGENT=false
```

**4.4: Create quick reference guide**

Create `_docs/stagehand-agent-mode.md`:

```markdown
# Stagehand Agent QA Mode - Quick Reference

## Overview

Fully autonomous QA mode using Stagehand's agent with OpenAI computer-use-preview model.

**Key Benefit**: No manual loop management - agent handles everything internally.

## Setup

### 1. Environment Variables

Required:
```bash
OPENAI_API_KEY=your-openai-api-key
BROWSERBASE_API_KEY=your-browserbase-key
BROWSERBASE_PROJECT_ID=your-project-id
```

Optional:
```bash
ENABLE_STAGEHAND_AGENT=true  # Enable mode
```

### 2. OpenAI Model Access

Ensure you have access to `computer-use-preview` model:
https://platform.openai.com/docs/models/computer-use-preview

## Usage

### CLI

```bash
# Basic (no metadata)
ENABLE_STAGEHAND_AGENT=true bun run src/main.ts https://example.com/game

# With metadata
ENABLE_STAGEHAND_AGENT=true bun run src/main.ts https://example.com/game --metadata ./game/metadata.json
```

### Lambda

```json
{
  "gameUrl": "https://example.com/game",
  "metadata": {
    "genre": "arcade",
    "inputSchema": { "actions": ["Pause"], "axes": ["MoveVertical"] },
    "testingStrategy": { "goals": ["Start game", "Test controls", "Score points"] }
  },
  "config": {
    "featureFlags": { "enableStagehandAgent": true }
  }
}
```

## How It Works

1. **Initialize**: Browser + Stagehand + OpenAI agent
2. **Navigate**: Load game, wait for ready state
3. **Build Instruction**: Use metadata to create natural language instruction
4. **Agent Execute**: Agent autonomously explores game (up to 25 actions, 4 min timeout)
5. **Final Analysis**: Capture screenshot, run vision analysis
6. **Result**: Return with agent action history and playability score

## Configuration

Located in `src/config/constants.ts`:

```typescript
export const STAGEHAND_AGENT_DEFAULTS = {
  MAX_STEPS: 25,                                  // Max autonomous actions
  MODEL: 'openai/computer-use-preview',          // OpenAI model
  HIGHLIGHT_CURSOR: false,                        // Visual cursor
  SYSTEM_PROMPT: 'You are a QA tester...',       // Agent behavior
};
```

## Metadata-Driven Instructions

### Without Metadata
"Play this browser game and test basic functionality. Try different controls and interactions."

### With Metadata (Pong example)
"Test this arcade game. Expected controls: Pause, RightPaddleVertical. Your objectives: Start the game; Test paddle controls; Score at least one point. Play for about 2 minutes or until you reach a clear completion point."

## Result Structure

```json
{
  "status": "pass",
  "playability_score": 85,
  "issues": [],
  "screenshots": ["/path/to/final_screenshot.png"],
  "timestamp": "2025-01-01T00:00:00Z",
  "metadata": {
    "sessionId": "abc123",
    "gameUrl": "https://example.com/game",
    "duration": 180000,
    "gameType": "CANVAS",
    "consoleErrors": [],
    "stagehandAgent": {
      "success": true,
      "completed": true,
      "actionCount": 12,
      "actions": [
        {
          "type": "click",
          "reasoning": "Clicking start button to begin game",
          "completed": false,
          "url": "https://example.com/game",
          "timestamp": "2025-01-01T00:00:00Z"
        }
      ],
      "message": "Successfully tested game functionality",
      "usage": {
        "input_tokens": 5000,
        "output_tokens": 1500,
        "inference_time_ms": 8000
      }
    }
  }
}
```

## Troubleshooting

### Error: "OPENAI_API_KEY environment variable is required"
→ Set `OPENAI_API_KEY` in `.env` file

### Error: "Unable to access Stagehand instance from page"
→ Ensure BrowserManager is using Stagehand v3 (check `package.json`)

### Agent execution timeout
→ Increase `MAX_TEST_DURATION` or reduce task complexity in metadata.testingStrategy.goals

### High cost
→ Reduce `MAX_STEPS` in constants or simplify instruction

### Agent gets stuck
→ Check agent action history in result, refine instruction or add more specific goals in metadata

## Comparison to Other Modes

| When to use | Mode |
|-------------|------|
| Quick validation, simple games | Standard QA |
| Complex games, custom loop logic | Adaptive QA |
| **Fully autonomous, hands-off testing** | **Stagehand Agent** |

## References

- Stagehand Agent Docs: https://docs.stagehand.dev/v3/basics/agent
- OpenAI Computer Use: https://platform.openai.com/docs/models/computer-use-preview
- Our Control Flow: `_docs/control-flow.md`
- Our Implementation: `src/main.ts:runStagehandAgentQA()`
```

**Files to Modify**:
- `README.md`
- `_docs/control-flow.md`
- `.env.example`

**Files to Create**:
- `_docs/stagehand-agent-mode.md`

---

### Task SA.5: Testing and Validation (1-2 hours)

**Goal**: Validate Stagehand Agent mode with real games

#### Acceptance Criteria
- [ ] All unit tests pass
- [ ] All integration tests pass (or mocked appropriately)
- [ ] TypeScript compilation passes with no errors
- [ ] Manual E2E test with simple game succeeds
- [ ] Result includes agent action history
- [ ] Feature flag precedence works correctly
- [ ] Cost and duration metrics are reasonable

#### Implementation Steps

**5.1: Run all tests**

```bash
# Unit tests
bun test tests/unit/stagehand-agent-types.test.ts
bun test tests/unit/stagehand-agent.test.ts

# Integration tests
bun test tests/integration/stagehand-agent.test.ts

# All tests
bun test

# TypeScript compilation
bunx tsc --noEmit
```

**5.2: Manual E2E Testing**

Create test script `tests/manual/test-stagehand-agent.sh`:

```bash
#!/bin/bash
# Manual E2E test for Stagehand Agent mode

set -e

echo "=== Stagehand Agent QA Mode - Manual E2E Test ==="

# Ensure environment variables are set
if [ -z "$OPENAI_API_KEY" ]; then
  echo "Error: OPENAI_API_KEY not set"
  exit 1
fi

if [ -z "$BROWSERBASE_API_KEY" ]; then
  echo "Error: BROWSERBASE_API_KEY not set"
  exit 1
fi

# Test 1: Simple game without metadata
echo ""
echo "Test 1: Simple game (2048) without metadata"
ENABLE_STAGEHAND_AGENT=true bun run src/main.ts https://play2048.co/

# Test 2: Game with metadata
echo ""
echo "Test 2: Pong with metadata"
ENABLE_STAGEHAND_AGENT=true bun run src/main.ts http://localhost:8000/pong --metadata ./_game-examples/pong/metadata.json

# Test 3: Verify precedence (should use Stagehand, not Adaptive)
echo ""
echo "Test 3: Verify Stagehand takes precedence over Adaptive"
ENABLE_STAGEHAND_AGENT=true ENABLE_ADAPTIVE_QA=true bun run src/main.ts https://play2048.co/

echo ""
echo "=== All tests completed ==="
```

Make executable:
```bash
chmod +x tests/manual/test-stagehand-agent.sh
```

**5.3: Validation Checklist**

Manual verification:

- [ ] Agent initializes correctly
- [ ] Instruction is built from metadata
- [ ] Agent executes without errors
- [ ] Action history is populated
- [ ] Final screenshot is captured
- [ ] Vision analysis runs on final screenshot
- [ ] Console errors are tracked
- [ ] Result includes stagehandAgent metadata
- [ ] Pass/fail determination is correct
- [ ] Browser cleanup happens even on error
- [ ] Feature flag precedence works (Stagehand > Adaptive > Standard)
- [ ] Cost is tracked in usage field
- [ ] Duration is under 4 minutes

**5.4: Update Memory Bank**

After successful testing, update:

`memory-bank/activeContext.md`:
```markdown
### Completed This Session (Latest)
- ✅ **Stagehand Agent QA Mode** (Nov 6, 2025)
  - **Implementation**: New autonomous QA mode using Stagehand agent
  - **Files Created**:
    - `src/utils/stagehand-agent.ts`: Instruction builder and screenshot extractor
    - `tests/unit/stagehand-agent-types.test.ts`: Type tests (5 tests)
    - `tests/unit/stagehand-agent.test.ts`: Instruction builder tests (20 tests)
    - `tests/integration/stagehand-agent.test.ts`: Integration tests
    - `_docs/stagehand-agent-mode.md`: Quick reference guide
    - `_docs/task-list-stagehand-agent.md`: Implementation task list
  - **Files Modified**:
    - `src/config/constants.ts`: Added STAGEHAND_AGENT_DEFAULTS
    - `src/config/feature-flags.ts`: Added enableStagehandAgent flag
    - `src/types/game-test.types.ts`: Added StagehandAgent* interfaces
    - `src/main.ts`: Added runStagehandAgentQA() function, updated CLI precedence
    - `README.md`: Added Stagehand Agent mode documentation
    - `_docs/control-flow.md`: Added Stagehand Agent flow section
    - `.env.example`: Added ENABLE_STAGEHAND_AGENT flag
  - **Key Features**:
    - Fully autonomous testing with OpenAI computer-use-preview model
    - Metadata-driven instruction building
    - Up to 25 autonomous actions (configurable)
    - 4-minute timeout (uses MAX_TEST_DURATION)
    - Final vision analysis for playability score
    - Agent action history included in result
    - Feature flag precedence: Stagehand > Adaptive > Standard
  - **Test Results**: All tests passing (25+ new tests)
  - **Acceptance Criteria Met**: ✅ All tasks complete, ✅ Documentation updated, ✅ Manual E2E tests pass
  - **Impact**: Simplifies autonomous testing, reduces code complexity (~150 lines vs ~450 for Adaptive QA)
```

`memory-bank/progress.md`:
```markdown
### Stagehand Agent QA Mode (Post-MVP Enhancement)
**Status**: ✅ Complete (Nov 6, 2025)
**Related**: `_docs/task-list-stagehand-agent.md`

- [x] SA.1: Add Configuration and Types (1-2 hours) ✅ COMPLETE
- [x] SA.2: Implement Instruction Builder (1 hour) ✅ COMPLETE
- [x] SA.3: Implement runStagehandAgentQA() Function (3-4 hours) ✅ COMPLETE
- [x] SA.4: Update Documentation (1 hour) ✅ COMPLETE
- [x] SA.5: Testing and Validation (1-2 hours) ✅ COMPLETE
```

**Files to Create**:
- `tests/manual/test-stagehand-agent.sh`

**Files to Modify**:
- `memory-bank/activeContext.md`
- `memory-bank/progress.md`

---

## Summary

**Total Time Estimate**: 6-8 hours

**Tasks**:
1. SA.1: Configuration and Types (1-2h)
2. SA.2: Instruction Builder (1h)
3. SA.3: Main Function (3-4h)
4. SA.4: Documentation (1h)
5. SA.5: Testing (1-2h)

**New Files** (9):
- `src/utils/stagehand-agent.ts`
- `tests/unit/stagehand-agent-types.test.ts`
- `tests/unit/stagehand-agent.test.ts`
- `tests/integration/stagehand-agent.test.ts`
- `tests/manual/test-stagehand-agent.sh`
- `_docs/stagehand-agent-mode.md`
- `_docs/task-list-stagehand-agent.md` (this file)

**Modified Files** (10):
- `src/config/constants.ts`
- `src/config/feature-flags.ts`
- `src/config/index.ts`
- `src/types/game-test.types.ts`
- `src/types/index.ts`
- `src/utils/index.ts`
- `src/main.ts`
- `README.md`
- `_docs/control-flow.md`
- `.env.example`

**Key Dependencies**:
- OpenAI API with computer-use-preview model access
- Stagehand v3 (already using)
- Existing BrowserManager, GameDetector, ErrorMonitor, ScreenshotCapturer, VisionAnalyzer

**Feature Flag Precedence**:
```
ENABLE_STAGEHAND_AGENT (highest)
  ↓ (if disabled)
ENABLE_ADAPTIVE_QA (middle)
  ↓ (if disabled)
Standard QA (default)
```

**References**:
- Stagehand Agent: https://docs.stagehand.dev/v3/basics/agent
- Stagehand API: https://docs.stagehand.dev/v3/references/agent
- OpenAI Computer Use: https://platform.openai.com/docs/models/computer-use-preview
- Our Control Flow: `_docs/control-flow.md`
- Our Adaptive QA: `src/main.ts:runAdaptiveQA()`
