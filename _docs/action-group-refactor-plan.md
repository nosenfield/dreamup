# Action Group-Based Adaptive QA Loop - Implementation Plan

**Created:** 2025-11-08  
**Status:** Planning  
**Branch:** `refactor/action-groups`

## Executive Summary

**Goal:** Refactor adaptive QA loop from flat action arrays to Action Group-based approach with iteration-based expansion

**Approach:** Major architectural change - groups actions by strategy/reasoning, assesses success at group level, expands successful strategies across iterations

**Key Changes:**
- Action Groups: Actions grouped by shared reasoning/strategy
- Iteration-based expansion: 1-3 groups (1 action each) → 1-5 actions per group → 1-10 actions per group
- Group-level assessment: Success measured at strategy level, not individual action level
- Confidence ordering: Groups executed in confidence order within each iteration

**Estimated Effort:** 6-8 hours

---

## Requirements Summary

### Desired Flow

**Iteration 1:**
- Send initial game state (post start button) to LLM
- Receive 1-3 ordered Action Groups with 1 action each
- Groups ordered by LLM confidence rating
- For each Action Group:
  - Take all actions in the group
  - Take a screenshot
  - Assess if successfully progressed

**Iteration 2:**
- For each successful Action Group from Iteration 1:
  - Send the Action Group info (reasoning, actions, before/after images)
  - Receive a new Action Group with 1-5 actions related to the previous successful Action Group
- For each new Action Group:
  - Take all actions in the group
  - Take a screenshot
  - Assess if successfully progressed

**Iteration 3+:**
- For each successful Action Group from previous iteration:
  - Send the Action Group info
  - Receive a new Action Group with 1-10 actions related to the previous successful Action Group
- Execute and assess as above

**Termination:**
- If zero successful Action Groups in an iteration → end the test
- Also terminate on: max_actions, max_duration, budget_limit, llm_complete

### Key Decisions

1. **Action execution within group:** Continue executing all actions in group even if individual action fails, then assess group as a whole
2. **Screenshot timing:** Screenshot at end of group (after all actions)
3. **Group success criteria:** State progressed after executing all actions in the group (regardless of individual action execution success)
4. **Iteration limits:** No maximum number of iterations
5. **Execution order:** Groups executed in confidence order (highest first) within each iteration
6. **State assessment:** Compare before-first-action vs after-last-action
7. **Successful group data:** Include reasoning, all actions, before screenshot, after screenshot, confidence score

---

## Files to Modify

- `src/types/game-test.types.ts` - Add `ActionGroup` interface and update related types
- `src/vision/schema.ts` - Add `actionGroupSchema` and `actionGroupsSchema`
- `src/core/state-analyzer.ts` - Update to return ActionGroups instead of flat array
- `src/vision/prompts.ts` - Update prompts for group-based approach with iteration-specific instructions
- `src/core/adaptive-qa-loop.ts` - Refactor to handle iterations, groups, and group-level state assessment
- `tests/unit/state-analyzer.test.ts` - Update tests for ActionGroups
- `tests/unit/adaptive-qa-loop.test.ts` - Update tests for iteration/group flow
- `memory-bank/activeContext.md` - Update current focus
- `memory-bank/progress.md` - Track progress

---

## Implementation Steps

### Step 1: Define ActionGroup Types and Schema

**1.1 Add ActionGroup interface to `src/types/game-test.types.ts`:**

```typescript
/**
 * Action Group representing a strategy with multiple related actions.
 * 
 * Actions in a group share the same logical reasoning/strategy.
 * Success is measured at the group level, not individual action level.
 */
export interface ActionGroup {
  /** Shared reasoning/strategy description for all actions in this group */
  reasoning: string;
  
  /** LLM confidence score (0-1) for this strategy */
  confidence: number;
  
  /** Array of actions to execute in this group (1-10 depending on iteration) */
  actions: ActionRecommendation[];
  
  /** Screenshot path before first action (added after execution) */
  beforeScreenshot?: string;
  
  /** Screenshot path after last action (added after execution) */
  afterScreenshot?: string;
  
  /** Whether the group was successful (added after assessment) */
  success?: boolean;
  
  /** Whether state progressed after executing all actions (added after assessment) */
  stateProgressed?: boolean;
}

/**
 * Array of Action Groups.
 */
export type ActionGroups = ActionGroup[];

/**
 * Successful Action Group data passed to next iteration.
 * 
 * Contains all information needed for LLM to generate related Action Groups.
 */
export interface SuccessfulActionGroup {
  /** Strategy description/reasoning */
  reasoning: string;
  
  /** All actions that were executed (with outcomes) */
  actions: Action[];
  
  /** Screenshot path before first action */
  beforeScreenshot: string;
  
  /** Screenshot path after last action */
  afterScreenshot: string;
  
  /** LLM confidence score for this strategy */
  confidence: number;
}
```

**1.2 Create actionGroupSchema in `src/vision/schema.ts`:**

```typescript
/**
 * Schema for validating ActionGroup objects.
 * 
 * Represents a strategy with multiple related actions that share reasoning.
 */
export const actionGroupSchema = z.object({
  /** Shared reasoning/strategy description */
  reasoning: z.string().min(10).max(500),
  
  /** LLM confidence score (0-1) */
  confidence: z.number().min(0).max(1),
  
  /** Array of actions in this group */
  actions: z.array(actionRecommendationSchema),
});

/**
 * Schema for validating ActionGroups array.
 * 
 * Wrapped in object for generateObject compatibility.
 */
export const actionGroupsSchema = z.object({
  groups: z.array(actionGroupSchema),
});

// Type exports
export type ActionGroupFromSchema = z.infer<typeof actionGroupSchema>;
export type ActionGroupsFromSchema = z.infer<typeof actionGroupsSchema>['groups'];
```

**1.3 Add validation function:**

```typescript
export function validateActionGroups(
  data: unknown,
  iterationNumber: number
): ValidationResult<ActionGroupsFromSchema> {
  const result = actionGroupsSchema.safeParse(data);
  
  if (!result.success) {
    return { success: false, error: result.error };
  }
  
  const groups = result.data.groups;
  
  // Validate group count based on iteration
  if (iterationNumber === 1 && (groups.length < 1 || groups.length > 3)) {
    return {
      success: false,
      error: new z.ZodError([{
        code: 'custom',
        path: ['groups'],
        message: 'Iteration 1 must have 1-3 groups',
      }]),
    };
  }
  
  // Validate action count per group based on iteration
  for (const group of groups) {
    const actionCount = group.actions.length;
    
    if (iterationNumber === 1 && actionCount !== 1) {
      return {
        success: false,
        error: new z.ZodError([{
          code: 'custom',
          path: ['groups', groups.indexOf(group), 'actions'],
          message: 'Iteration 1 groups must have exactly 1 action',
        }]),
      };
    }
    
    if (iterationNumber === 2 && (actionCount < 1 || actionCount > 5)) {
      return {
        success: false,
        error: new z.ZodError([{
          code: 'custom',
          path: ['groups', groups.indexOf(group), 'actions'],
          message: 'Iteration 2 groups must have 1-5 actions',
        }]),
      };
    }
    
    if (iterationNumber >= 3 && (actionCount < 1 || actionCount > 10)) {
      return {
        success: false,
        error: new z.ZodError([{
          code: 'custom',
          path: ['groups', groups.indexOf(group), 'actions'],
          message: 'Iteration 3+ groups must have 1-10 actions',
        }]),
      };
    }
  }
  
  return { success: true, data: groups };
}
```

### Step 2: Update StateAnalyzer for ActionGroups

**2.1 Update `analyzeAndRecommendAction()` signature:**

```typescript
async analyzeAndRecommendAction(
  state: GameState,
  iterationNumber: number,
  successfulGroups?: SuccessfulActionGroup[]
): Promise<ActionGroups> {
  // Implementation
}
```

**2.2 Update `buildStateAnalysisPrompt()`:**

- Add iteration-specific instructions:
  - **Iteration 1:** "Return 1-3 Action Groups, each with 1 action, ordered by confidence. Each group represents a different strategy to try."
  - **Iteration 2:** "For each successful Action Group provided, return 1 Action Group with 1-5 related actions that build on that strategy."
  - **Iteration 3+:** "For each successful Action Group provided, return 1 Action Group with 1-10 related actions that expand that strategy."
- Include successful Action Group context:
  - Reasoning/strategy description
  - Actions that were executed
  - Before/after screenshots
  - Confidence score
- Update output format to reflect ActionGroups structure

**2.3 Update `generateObject` call:**

```typescript
const result = await generateObject({
  model: this.openai('gpt-4-turbo'),
  messages: [{ role: 'user' as const, content }],
  schema: actionGroupsSchema,
  temperature: 0.3,
});

const groups = result.object.groups;
// Validate with iteration-specific rules
const validation = validateActionGroups(result.object, iterationNumber);
if (!validation.success) {
  throw new Error(`Invalid ActionGroups: ${validation.error.message}`);
}
return validation.data;
```

**2.4 Update logging:**

```typescript
this.logger.info('Received Action Groups', {
  iterationNumber,
  groupCount: groups.length,
  groups: groups.map(g => ({
    reasoning: g.reasoning,
    confidence: g.confidence,
    actionCount: g.actions.length,
  })),
});
```

### Step 3: Refactor AdaptiveQALoop for Iterations and Groups

**3.1 Add iteration tracking:**

```typescript
let currentIteration = 1;
let successfulGroups: SuccessfulActionGroup[] = [];
```

**3.2 Refactor main loop structure:**

```typescript
// Outer loop: Iterations (no max, continues until termination)
while (true) {
  // Check termination conditions
  if (elapsed >= maxDuration) break;
  if (estimatedCost >= maxBudget * 0.9) break;
  
  // Request Action Groups for this iteration
  const groups = await this.stateAnalyzer.analyzeAndRecommendAction(
    currentState,
    currentIteration,
    successfulGroups.length > 0 ? successfulGroups : undefined
  );
  
  // If no groups returned, terminate
  if (groups.length === 0) {
    completionReason = 'llm_complete';
    break;
  }
  
  // Sort groups by confidence (descending)
  const sortedGroups = [...groups].sort((a, b) => b.confidence - a.confidence);
  
  // Track successful groups for this iteration
  const iterationSuccessfulGroups: SuccessfulActionGroup[] = [];
  
  // Inner loop: Execute groups in confidence order
  for (const group of sortedGroups) {
    // Execute group and assess
    const result = await this.executeActionGroup(page, group, currentState);
    
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
  }
  
  // If zero successful groups, terminate
  if (iterationSuccessfulGroups.length === 0) {
    completionReason = 'zero_successful_groups';
    break;
  }
  
  // Prepare for next iteration
  successfulGroups = iterationSuccessfulGroups;
  currentIteration++;
}
```

**3.3 Add `executeActionGroup()` method:**

```typescript
private async executeActionGroup(
  page: AnyPage,
  group: ActionGroup,
  stateBeforeGroup: CapturedState
): Promise<{
  success: boolean;
  stateProgressed: boolean;
  executedActions: Action[];
  beforeScreenshot: string;
  afterScreenshot: string;
  afterState: CapturedState;
}> {
  this.logger.info('Executing Action Group', {
    reasoning: group.reasoning,
    confidence: group.confidence,
    actionCount: group.actions.length,
  });
  
  const beforeScreenshot = stateBeforeGroup.screenshot.path;
  const executedActions: Action[] = [];
  
  // Execute all actions in group (continue even if individual action fails)
  for (const recommendation of group.actions) {
    if (recommendation.action === 'complete') {
      // Handle completion
      break;
    }
    
    const executed = await this.gameInteractor.executeRecommendationPublic(
      page,
      recommendation
    );
    
    // Wait for state change
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create Action with outcome
    const action: Action = {
      action: recommendation.action,
      target: recommendation.target,
      reasoning: recommendation.reasoning,
      timestamp: Date.now(),
      success: executed,
      stateProgressed: false, // Will be set after group assessment
    };
    
    executedActions.push(action);
  }
  
  // Capture state after all actions
  const stateAfterGroup = await this.gameInteractor.captureCurrentState(page);
  const afterScreenshot = stateAfterGroup.screenshot.path;
  
  // Assess state progression (before-first vs after-last)
  const stateProgressed = await this.stateAnalyzer.hasStateProgressed(
    beforeScreenshot,
    afterScreenshot
  );
  
  // Update all actions with state progression result
  executedActions.forEach(action => {
    action.stateProgressed = stateProgressed;
  });
  
  const success = executedActions.some(a => a.success) && stateProgressed;
  
  this.logger.info('Action Group execution complete', {
    reasoning: group.reasoning,
    success,
    stateProgressed,
    executedActionCount: executedActions.length,
  });
  
  return {
    success,
    stateProgressed,
    executedActions,
    beforeScreenshot,
    afterScreenshot,
    afterState: stateAfterGroup,
  };
}
```

**3.4 Update termination conditions:**

```typescript
export interface AdaptiveLoopResult {
  // ... existing fields
  completionReason: 
    | 'max_actions' 
    | 'max_duration' 
    | 'budget_limit' 
    | 'llm_complete'
    | 'zero_successful_groups'  // NEW
    | 'error';
}
```

**3.5 Update logging:**

```typescript
this.logger.iteration(currentIteration, {
  groupCount: groups.length,
  successfulGroupCount: iterationSuccessfulGroups.length,
  elapsed,
});
```

### Step 4: Update Prompts for Group-Based Approach

**4.1 Update `STATE_ANALYSIS_PROMPT` in `src/vision/prompts.ts`:**

Add iteration-specific sections:

```typescript
export const STATE_ANALYSIS_PROMPT = `
You are analyzing a game state and recommending actions to progress the game.

## Action Groups

Actions should be organized into Action Groups. Each Action Group represents a strategy with multiple related actions that share the same logical reasoning.

### Iteration 1
- Return 1-3 Action Groups
- Each group should have exactly 1 action
- Each group represents a different strategy to try
- Order groups by your confidence in the strategy (highest confidence first)

### Iteration 2
- For each successful Action Group provided, return 1 Action Group
- Each group should have 1-5 actions that build on the successful strategy
- Actions should be related and follow the same reasoning as the successful group

### Iteration 3+
- For each successful Action Group provided, return 1 Action Group
- Each group should have 1-10 actions that expand the successful strategy
- Actions should be related and follow the same reasoning as the successful group

## Output Format

Return an object with a "groups" array. Each group should have:
- reasoning: Strategy description (shared by all actions in group)
- confidence: Your confidence in this strategy (0-1)
- actions: Array of actions to execute in this group

## Examples

### Iteration 1 Example
{
  "groups": [
    {
      "reasoning": "Click the start button to begin the game",
      "confidence": 0.9,
      "actions": [
        {
          "action": "click",
          "target": { "x": 400, "y": 300 },
          "reasoning": "Start button is at center of screen",
          "confidence": 0.9
        }
      ]
    },
    {
      "reasoning": "Press Enter key to start the game",
      "confidence": 0.7,
      "actions": [
        {
          "action": "keypress",
          "target": "Enter",
          "reasoning": "Enter key might start the game",
          "confidence": 0.7
        }
      ]
    }
  ]
}

### Iteration 2+ Example
{
  "groups": [
    {
      "reasoning": "Continue clicking the upgrade button multiple times to progress",
      "confidence": 0.85,
      "actions": [
        {
          "action": "click",
          "target": { "x": 500, "y": 400 },
          "reasoning": "First upgrade click",
          "confidence": 0.85
        },
        {
          "action": "click",
          "target": { "x": 500, "y": 400 },
          "reasoning": "Second upgrade click",
          "confidence": 0.85
        },
        {
          "action": "click",
          "target": { "x": 500, "y": 400 },
          "reasoning": "Third upgrade click",
          "confidence": 0.85
        }
      ]
    }
  ]
}
`;
```

### Step 5: Update Tests

**5.1 Update `state-analyzer.test.ts`:**

```typescript
describe('analyzeAndRecommendAction with ActionGroups', () => {
  it('should return ActionGroups for iteration 1', async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        groups: [
          {
            reasoning: 'Test strategy',
            confidence: 0.9,
            actions: [{ action: 'click', target: { x: 100, y: 200 }, reasoning: 'Test', confidence: 0.9 }],
          },
        ],
      },
    });
    
    const groups = await analyzer.analyzeAndRecommendAction(
      mockState,
      1, // iteration 1
      undefined
    );
    
    expect(groups).toHaveLength(1);
    expect(groups[0].actions).toHaveLength(1);
  });
  
  it('should accept successful groups for iteration 2+', async () => {
    const successfulGroups: SuccessfulActionGroup[] = [
      {
        reasoning: 'Previous successful strategy',
        actions: [/* ... */],
        beforeScreenshot: '/path/before.png',
        afterScreenshot: '/path/after.png',
        confidence: 0.9,
      },
    ];
    
    const groups = await analyzer.analyzeAndRecommendAction(
      mockState,
      2, // iteration 2
      successfulGroups
    );
    
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('Previous successful strategy'),
          }),
        ]),
      })
    );
  });
});
```

**5.2 Update `adaptive-qa-loop.test.ts`:**

```typescript
describe('Action Group execution', () => {
  it('should execute groups in confidence order', async () => {
    const groups: ActionGroups = [
      { reasoning: 'Low confidence', confidence: 0.5, actions: [/* ... */] },
      { reasoning: 'High confidence', confidence: 0.9, actions: [/* ... */] },
    ];
    
    mockStateAnalyzer.analyzeAndRecommendAction.mockResolvedValue(groups);
    
    await loop.run(mockPage);
    
    // Verify high confidence group executed first
    expect(mockGameInteractor.executeRecommendationPublic).toHaveBeenCalledWith(
      mockPage,
      groups[1].actions[0] // High confidence group first
    );
  });
  
  it('should assess state at group level', async () => {
    // Test that hasStateProgressed is called with before-first and after-last screenshots
  });
  
  it('should track successful groups across iterations', async () => {
    // Test that successful groups from iteration 1 are passed to iteration 2
  });
  
  it('should terminate on zero successful groups', async () => {
    // Test termination when no groups succeed
  });
});
```

---

## Test Plan

### Unit Tests

**StateAnalyzer:**
- [ ] Returns ActionGroups for iteration 1 (1-3 groups, 1 action each)
- [ ] Returns ActionGroups for iteration 2+ (1-5 actions per group for iter 2, 1-10 for iter 3+)
- [ ] Accepts successful groups context
- [ ] Validates group count and action count based on iteration
- [ ] Handles zero groups returned (termination)

**AdaptiveQALoop:**
- [ ] Executes groups in confidence order
- [ ] Executes all actions in group before assessing
- [ ] Assesses state at group level (before-first vs after-last)
- [ ] Tracks successful groups across iterations
- [ ] Terminates on zero successful groups
- [ ] Continues iterations when groups succeed
- [ ] Updates current state after each group
- [ ] Logs iteration number and group details

### Integration Tests

- [ ] Full iteration flow (Iteration 1 → 2 → 3)
- [ ] Group execution with multiple actions
- [ ] State progression detection at group level
- [ ] Termination conditions (zero groups, budget, duration)
- [ ] Successful group context passed correctly

---

## Acceptance Criteria

- [ ] LLM returns ActionGroups (not flat array)
- [ ] Iteration 1: 1-3 groups, 1 action each, ordered by confidence
- [ ] Iteration 2+: 1 group per successful group, 1-5 actions per group
- [ ] Iteration 3+: 1 group per successful group, 1-10 actions per group
- [ ] Groups executed in confidence order (highest first)
- [ ] State assessed at group level (before-first vs after-last)
- [ ] Successful groups tracked and passed to next iteration
- [ ] Zero successful groups terminates test
- [ ] All existing tests pass (where applicable)
- [ ] Logging shows iteration number, group confidence, group-level outcomes

---

## Risk Analysis

- **Risk 1**: Breaking existing functionality  
  **Mitigation**: Comprehensive test coverage, incremental refactor, maintain backward compatibility where possible

- **Risk 2**: LLM doesn't follow group structure  
  **Mitigation**: Clear prompts with examples, schema validation, error handling

- **Risk 3**: Performance degradation (more LLM calls)  
  **Mitigation**: Fewer screenshots per iteration (group-level vs action-level), monitor costs, optimize prompts

- **Risk 4**: Complex state tracking  
  **Mitigation**: Clear data structures, extensive logging, unit tests for state management

- **Risk 5**: Iteration limits unclear  
  **Mitigation**: Document termination conditions clearly, add logging for iteration progression

- **Risk 6**: Schema validation complexity  
  **Mitigation**: Comprehensive validation function with clear error messages, test edge cases

---

## Memory Bank Updates

- [ ] Update `activeContext.md` (current focus: Action Group refactor)
- [ ] Update `progress.md` (add new feature task)
- [ ] Update `systemPatterns.md` (document Action Group pattern)

---

## Notes

- This is a **breaking change** - existing tests will need updates
- Action Groups represent strategies, not just collections of actions
- Success is measured at strategy level, not individual action level
- Iterations expand successful strategies (1 action → 1-5 actions → 1-10 actions)
- Groups are executed sequentially in confidence order within each iteration
- State assessment happens once per group (after all actions complete)

---

**Status**: Ready for implementation  
**Next Step**: Get approval, then begin Step 1 (Type definitions and schema)

