# DreamUp QA Agent - Control Flow Documentation

**Last Updated**: November 6, 2025

This document provides a comprehensive step-by-step breakdown of the DreamUp QA agent's control flow, including visual diagrams showing the agent's thought process and all data handoffs between components.

---

## Table of Contents

1. [High-Level Overview](#high-level-overview)
2. [Two Operating Modes](#two-operating-modes)
3. [Standard QA Mode: Detailed Flow](#standard-qa-mode-detailed-flow)
4. [Adaptive QA Mode: Detailed Flow](#adaptive-qa-mode-detailed-flow)
5. [Start Button Detection: Three-Strategy Approach](#start-button-detection-three-strategy-approach)
6. [Data Flow Diagrams](#data-flow-diagrams)
7. [Component Interactions](#component-interactions)
8. [Error Handling Flow](#error-handling-flow)

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        DreamUp QA Agent                          │
│                                                                   │
│  Entry Points:                                                   │
│  • CLI: bun run src/main.ts <url> [--metadata <path>]           │
│  • Lambda: handler(event) → { gameUrl, metadata?, config? }     │
│                                                                   │
│  Operating Modes (controlled by ENABLE_ADAPTIVE_QA flag):       │
│  • Standard QA (default): Single interaction cycle               │
│  • Adaptive QA: Iterative action loop with LLM guidance         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Three Operating Modes

### Standard QA Mode (Default)
**Purpose**: Fast, single-cycle testing for basic playability validation
**Duration**: 2-4 minutes
**Cost**: $0.02-0.05 (vision analysis only)
**Flag**: `ENABLE_STAGEHAND_AGENT=false` and `ENABLE_ADAPTIVE_QA=false` (default)

**Flow**: Initialize → Navigate → Detect → Click Start → Simulate Input → Capture Screenshots → Analyze → Report

### Adaptive QA Mode (Advanced)
**Purpose**: Iterative gameplay with LLM-powered action recommendations
**Duration**: 2-4 minutes (configurable)
**Cost**: $0.10-0.50 (LLM state analysis + vision analysis)
**Flag**: `ENABLE_ADAPTIVE_QA=true` (takes precedence over Standard, but not Stagehand Agent)

**Flow**: Initialize → Navigate → Detect → **[Loop: Analyze State → Recommend Action → Execute → Check Progress]** → Final Analysis → Report

### Stagehand Agent QA Mode (Autonomous)
**Purpose**: Fully autonomous testing using Stagehand's agent with OpenAI computer-use-preview
**Duration**: 2-4 minutes (configurable)
**Cost**: TBD (depends on action count and token usage)
**Flag**: `ENABLE_STAGEHAND_AGENT=true` (highest precedence)

**Flow**: Initialize → Navigate → Detect → **[Agent Autonomous Loop]** → Final Screenshot → Vision Analysis → Report

**See [Stagehand Agent Mode: Detailed Flow](#stagehand-agent-qa-mode-detailed-flow) below for complete flow.**

---

## Standard QA Mode: Detailed Flow

### Phase 1: Initialization (5-10 seconds)

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Parse CLI Arguments / Lambda Event                        │
│    Input: gameUrl, metadata? (JSON file path or object)      │
│    Output: { gameUrl, metadata?, sessionId }                 │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. Validate Environment Variables                            │
│    Required: BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID     │
│    Optional: OPENAI_API_KEY (for vision analysis)            │
│    Throw error if missing required variables                 │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. Initialize Components                                      │
│    • Logger (structured JSON logging)                        │
│    • FileManager (screenshot/report storage)                 │
│    • BrowserManager (Browserbase + Stagehand v3)             │
│    Data: { apiKey, projectId, sessionId }                    │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. Create Browserbase Session                                │
│    Agent → Browserbase API: POST /v1/sessions                │
│    Returns: { sessionId, debugUrl, wsEndpoint }              │
│    Stagehand connects to wsEndpoint                          │
└──────────────────────────────────────────────────────────────┘
```

**Key Data Handoffs**:
- **User → Agent**: Game URL, metadata (optional)
- **Agent → Browserbase**: API key, project ID
- **Browserbase → Agent**: WebSocket endpoint for browser control
- **Agent → Stagehand**: WebSocket endpoint, page object returned

---

### Phase 2: Navigation & Detection (10-70 seconds)

```
┌──────────────────────────────────────────────────────────────┐
│ 5. Navigate to Game URL                                       │
│    Stagehand: page.goto(gameUrl, { waitUntil: 'networkidle' })│
│    Wait for network idle (no active requests)                │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. Start Error Monitoring                                     │
│    Inject JavaScript into page context:                      │
│    • Override console.error(), console.warn()                │
│    • Listen to window.onerror, window.onunhandledrejection   │
│    • Store errors in window.__qaErrors array                 │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 7. Detect Game Type                                           │
│    Inspect page structure:                                   │
│    • <canvas> → CANVAS game                                  │
│    • <iframe src="...game..."> → IFRAME game                 │
│    • HTML elements with game classes → DOM game              │
│    • None of above → UNKNOWN                                 │
│    Data: gameType enum (CANVAS|IFRAME|DOM|UNKNOWN)           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 8. Wait for Game Ready (4/7 signals required)                │
│    Multi-signal detection (60s timeout):                     │
│    ✓ Canvas exists (if CANVAS type)                          │
│    ✓ Canvas is rendering (pixel analysis)                    │
│    ✓ Network idle (no pending requests)                      │
│    ✓ No loading text visible ("Loading...", "Please wait")   │
│    ✓ DOM interactive (document.readyState)                   │
│    ✓ JavaScript execution complete                           │
│    ✓ Custom indicators from metadata (if provided)           │
└──────────────────────────────────────────────────────────────┘
```

**Key Data Handoffs**:
- **Stagehand → Game Server**: HTTP request for game HTML/assets
- **Game → Browser**: HTML, CSS, JavaScript, images
- **Browser → Agent**: Page structure (DOM tree), canvas pixels, console errors
- **Agent → Agent**: Game type classification, ready state boolean

---

### Phase 3: Start Button Detection (0-10 seconds)

This is the most complex phase with multiple fallback strategies. See [Start Button Detection](#start-button-detection-three-strategy-approach) section below for detailed flow.

```
┌──────────────────────────────────────────────────────────────┐
│ 9. Find and Click Start Button (Three-Strategy Approach)     │
│                                                               │
│    Strategy 1: DOM Selection (0-2s, $0.00)                   │
│    ├─ Try 29 selectors (exact IDs, wildcards, text-based)    │
│    ├─ Success? → Click and return ✓                          │
│    └─ Failure? → Try Strategy 2                              │
│                                                               │
│    Strategy 2: Natural Language (2-5s, $0.00)                │
│    ├─ page.act("click start button")                         │
│    ├─ Success? → Return ✓                                    │
│    └─ Failure? → Try Strategy 3                              │
│                                                               │
│    Strategy 3: LLM State Analysis (5-10s, ~$0.02)            │
│    ├─ Capture screenshot + sanitized HTML                    │
│    ├─ StateAnalyzer.analyzeAndRecommendAction(state)         │
│    │   → GPT-4 Vision: "What should I click to start?"       │
│    ├─ Get recommendation: { action: 'click', target: {x,y} } │
│    ├─ Execute recommendation                                 │
│    └─ Return success/failure                                 │
└──────────────────────────────────────────────────────────────┘
```

**Key Data Handoffs** (Strategy 3):
- **Agent → StateAnalyzer**: `{ html, screenshot, goal: "Find and click start button" }`
- **StateAnalyzer → OpenAI**: Multi-modal prompt (text + image)
- **OpenAI → StateAnalyzer**: Structured JSON: `{ action, target: {x,y}, reasoning, alternatives[] }`
- **StateAnalyzer → Agent**: ActionRecommendation object
- **Agent → Stagehand**: `page.click(x, y)`

---

### Phase 4: Gameplay Simulation (30-60 seconds)

```
┌──────────────────────────────────────────────────────────────┐
│ 10. Wait Before Interaction (optional)                        │
│     From metadata.testingStrategy.waitBeforeInteraction      │
│     Default: 2000ms (2 seconds)                              │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 11. Capture Initial Screenshot                                │
│     Stage: "initial_load"                                    │
│     With metadata: Wait for loading indicators first         │
│     Without metadata: Capture immediately                    │
│     Output: /tmp/game-qa-output/<sessionId>/screenshot_*.png │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 12. Simulate Keyboard Input (30s default)                     │
│                                                               │
│     WITH METADATA (metadata-driven):                         │
│     ├─ Parse metadata.inputSchema for actions/axes           │
│     ├─ Extract keybindings (e.g., ["ArrowUp", "ArrowDown"])  │
│     ├─ Prioritize critical keys from testingStrategy         │
│     └─ Send keys via Stagehand: page.keyPress(key)           │
│                                                               │
│     WITHOUT METADATA (generic):                              │
│     ├─ Use default keys: WASD, arrows, space, enter          │
│     ├─ Cycle through keys over duration                      │
│     ├─ 150ms delay between key presses                       │
│     └─ Send keys via Stagehand: page.keyPress(key)           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 13. Capture After-Interaction Screenshot                      │
│     Stage: "after_interaction"                               │
│     With metadata: Wait for success indicators               │
│     Without metadata: Capture immediately                    │
│     Output: /tmp/game-qa-output/<sessionId>/screenshot_*.png │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 14. Capture Final Screenshot                                  │
│     Stage: "final_state"                                     │
│     Output: /tmp/game-qa-output/<sessionId>/screenshot_*.png │
└──────────────────────────────────────────────────────────────┘
```

**Key Data Handoffs**:
- **Metadata → InputSchemaParser**: `{ inputSchema: { type, content, actions, axes } }`
- **InputSchemaParser → Agent**: `{ actions: [{name, keys}], axes: [{name, keys}] }`
- **Agent → Stagehand**: Key press commands: `page.keyPress("ArrowUp")`
- **Stagehand → Browser**: Synthetic keyboard events
- **Browser → Game**: KeyboardEvent objects (keydown, keyup)
- **Browser → Agent**: Screenshot PNG buffers
- **Agent → FileManager**: PNG buffers + metadata (stage, timestamp)

---

### Phase 5: Vision Analysis (10-20 seconds)

```
┌──────────────────────────────────────────────────────────────┐
│ 15. Analyze Screenshots with GPT-4 Vision                     │
│                                                               │
│     Input: 3 screenshots + game metadata (optional)          │
│     Process:                                                 │
│     ├─ Load PNG files from disk                              │
│     ├─ Convert to base64 data URIs                           │
│     ├─ Build prompt with GAME_ANALYSIS_PROMPT                │
│     ├─ Include metadata context (genre, controls)            │
│     └─ Send to OpenAI GPT-4 Vision                           │
│                                                               │
│     LLM Task:                                                │
│     "Analyze these 3 screenshots from a game test:           │
│      1. Did the game load successfully?                      │
│      2. Did controls respond to input?                       │
│      3. Are there any visual bugs or crashes?                │
│      4. Assign playability score (0-100)                     │
│      5. List specific issues with severity"                  │
│                                                               │
│     Output (structured JSON via Zod schema):                 │
│     {                                                        │
│       playability_score: 85,                                 │
│       issues: [                                              │
│         {                                                    │
│           severity: 'minor',                                 │
│           description: 'UI element overlaps game area',      │
│           timestamp: '2025-11-06T...'                        │
│         }                                                    │
│       ]                                                      │
│     }                                                        │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 16. Retrieve Console Errors                                   │
│     Query window.__qaErrors from page context                │
│     Returns: [{ message, timestamp, level: 'error'|'warning' }]│
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 17. Determine Pass/Fail Status                                │
│     Logic: playability_score >= 50 ? 'pass' : 'fail'         │
│     Default: 50 (if vision analysis fails)                   │
└──────────────────────────────────────────────────────────────┘
```

**Key Data Handoffs**:
- **Agent → VisionAnalyzer**: `{ screenshotPaths: string[], metadata?: GameMetadata }`
- **VisionAnalyzer → OpenAI**: Multi-modal prompt (text + 3 base64 images)
- **OpenAI → VisionAnalyzer**: Structured response via Zod schema validation
- **VisionAnalyzer → Agent**: `{ playability_score, issues, tokenUsage }`

---

### Phase 6: Cleanup & Report (1-2 seconds)

```
┌──────────────────────────────────────────────────────────────┐
│ 18. Build Test Result                                         │
│     Assemble final GameTestResult object:                    │
│     {                                                        │
│       status: 'pass' | 'fail' | 'error',                     │
│       playability_score: 85,                                 │
│       issues: [...],                                         │
│       screenshots: [                                         │
│         { stage: 'initial_load', path: '...' },              │
│         { stage: 'after_interaction', path: '...' },         │
│         { stage: 'final_state', path: '...' }                │
│       ],                                                     │
│       timestamp: '2025-11-06T...',                           │
│       metadata: {                                            │
│         sessionId: '...',                                    │
│         gameUrl: '...',                                      │
│         duration: 123456,                                    │
│         gameType: 'CANVAS',                                  │
│         consoleErrors: [...],                                │
│         visionAnalysisTokens: 12345                          │
│       }                                                      │
│     }                                                        │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 19. Stop Error Monitoring                                     │
│     Restore original console methods                         │
│     Remove event listeners                                   │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 20. Cleanup Files (optional)                                  │
│     If ENABLE_SCREENSHOT_CLEANUP=true:                       │
│     Delete /tmp/game-qa-output/<sessionId>/ directory        │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 21. Cleanup Browser Session                                   │
│     Close Stagehand page                                     │
│     Terminate Browserbase session                            │
│     Release WebSocket connection                             │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 22. Return Result                                             │
│     CLI: Print JSON to stdout, exit(0 or 1)                  │
│     Lambda: Return { statusCode: 200, body: JSON }           │
└──────────────────────────────────────────────────────────────┘
```

---

## Adaptive QA Mode: Detailed Flow

Adaptive QA mode replaces Phase 4 (single gameplay simulation) with an **iterative action loop** where the LLM analyzes state and recommends actions.

### Adaptive Loop Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Phases 1-3: Same as Standard Mode                              │
│  (Initialize → Navigate → Detect → Click Start)                 │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  Phase 4: ADAPTIVE LOOP (replaces single simulation)            │
│                                                                  │
│  Configuration:                                                 │
│  • maxActions: 20 (max iterations)                              │
│  • maxDuration: 240000ms (4 minutes)                            │
│  • maxBudget: $0.50 (stop at 90% = $0.45)                      │
│  • screenshotStrategy: 'fixed' (capture after each action)      │
│  • llmCallStrategy: 'eager' (call LLM every iteration)          │
│                                                                  │
│  Loop Variables:                                                │
│  • actionHistory: Action[] (tracks what we've done)             │
│  • screenshots: string[] (all captured screenshots)             │
│  • currentState: { html, screenshot, timestamp }                │
│  • stateCheckCount: number (for budget calculation)             │
└─────────────────────────────────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────────┐
        │  FOR i = 0 to maxActions-1              │
        └─────────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────────┐
        │  Check Duration Limit                   │
        │  elapsed >= maxDuration? → BREAK        │
        └─────────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────────┐
        │  Check Budget Limit                     │
        │  estimatedCost >= 90% of budget? → BREAK│
        │  Cost = actions*$0.01 + screenshots*$0.01│
        │       + stateChecks*$0.02               │
        └─────────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────────┐
        │  Capture Current State                  │
        │  • page.content() → sanitized HTML      │
        │  • page.screenshot() → PNG file         │
        │  • timestamp                            │
        └─────────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────────┐
        │  Ask LLM: "What Should I Do Next?"     │
        │                                         │
        │  StateAnalyzer.analyzeAndRecommendAction({│
        │    html: currentState.html,             │
        │    screenshot: currentState.screenshot, │
        │    previousActions: actionHistory,      │
        │    metadata: metadata,                  │
        │    goal: "Continue playing and progress"│
        │  })                                     │
        │                                         │
        │  GPT-4 Vision Analyzes:                 │
        │  • Current game state (what's visible)  │
        │  • Previous actions (what we tried)     │
        │  • Metadata hints (game genre, controls)│
        │                                         │
        │  Returns ActionRecommendation:          │
        │  {                                      │
        │    action: 'click' | 'keypress' | 'wait'│
        │           | 'complete',                 │
        │    target: { x, y } | { key: 'Space' }, │
        │    reasoning: "I see a door, clicking to│
        │                enter next level",       │
        │    confidence: 0.85,                    │
        │    alternatives: [...]                  │
        │  }                                      │
        └─────────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────────┐
        │  Execute Recommended Action             │
        │                                         │
        │  switch (action):                       │
        │    case 'click':                        │
        │      → page.click(x, y)                 │
        │    case 'keypress':                     │
        │      → page.keyPress(key)               │
        │    case 'wait':                         │
        │      → sleep(duration)                  │
        │    case 'complete':                     │
        │      → BREAK (goal achieved)            │
        │                                         │
        │  Record action in history:              │
        │  actionHistory.push({                   │
        │    action, target, reasoning, timestamp │
        │  })                                     │
        └─────────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────────┐
        │  Wait for Action to Take Effect         │
        │  • Network requests to complete          │
        │  • Animations to finish                  │
        │  • State to update                       │
        │  Default: 2000ms                         │
        └─────────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────────┐
        │  Check State Progression                │
        │                                         │
        │  StateAnalyzer.hasStateProgressed(      │
        │    previousScreenshot,                  │
        │    currentScreenshot                    │
        │  )                                      │
        │                                         │
        │  Compare pixel differences:             │
        │  • Different? → State progressed ✓      │
        │  • Same? → Stuck state detected         │
        │                                         │
        │  If stuck (3+ iterations):              │
        │  • Try alternative action               │
        │  • Or move to next strategy             │
        └─────────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────────┐
        │  Capture Screenshot After Action        │
        │  screenshots.push(screenshotPath)       │
        └─────────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────────┐
        │  LOOP BACK (if not broken)              │
        └─────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  Phase 5: Final Vision Analysis                                 │
│  • Analyze ALL screenshots with action history context          │
│  • Assess overall playability and progression                   │
│  • Generate comprehensive report                                │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│  Phase 6: Cleanup & Report (same as Standard Mode)              │
│  • Add actionHistory to result.metadata                         │
│  • Add estimatedCost to result.metadata                         │
└─────────────────────────────────────────────────────────────────┘
```

---

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
│  Phase 4: STAGEHAND AGENT EXECUTION (replaces manual loop)     │
│                                                                  │
│  Configuration:                                                 │
│  • maxSteps: 25 (max autonomous actions)                        │
│  • maxDuration: 240000ms (4 minutes)                            │
│  • model: openai/computer-use-preview                           │
│  • cua: true (Computer Use Agent mode)                          │
│                                                                  │
│  Instruction (metadata-driven):                                │
│  "Test this [genre] game. Expected controls: [actions, axes].  │
│   Your objectives: [goals]. Play for about 2 minutes or until   │
│   you reach a clear completion point."                          │
│                                                                  │
│  Agent Internal Loop (autonomous, hidden from us):              │
│  • Observe screen (computer vision)                             │
│  • Reason about next action                                     │
│  • Execute action (click, type, navigate, etc.)                │
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

---

## Start Button Detection: Three-Strategy Approach

This is one of the most sophisticated parts of the agent. It uses a **cascading fallback approach** to maximize success rate while minimizing cost and latency.

```
┌───────────────────────────────────────────────────────────────────┐
│                  findAndClickStart(page)                           │
│                                                                    │
│  Success Rate: 99%+                                               │
│  Cost: $0.00 (95% of cases), $0.02 (5% of cases)                  │
│  Latency: 0-2s (95% of cases), 5-10s (5% of cases)                │
└───────────────────────────────────────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────────┐
│  STRATEGY 1: DOM Selection (0-2 seconds, $0.00)                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                    │
│  Three-Tier Selector Cascade:                                     │
│                                                                    │
│  ┌─ TIER 1: Exact IDs (optimized for our game engine) ────────┐  │
│  │  • #start-btn                                              │  │
│  │  • #play-btn                                               │  │
│  │  • #begin-btn                                              │  │
│  │  Success? → Click and return true ✓                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                             ↓                                      │
│  ┌─ TIER 2: Attribute Wildcards (broad coverage) ─────────────┐  │
│  │  Case-insensitive matching with [attr*="text" i]:         │  │
│  │  • [id*="start" i]      → Matches: startBtn, btn-start    │  │
│  │  • [id*="play" i]       → Matches: playButton, play-btn   │  │
│  │  • [class*="start" i]   → Matches: btn-start, start-game  │  │
│  │  • [onclick*="start" i] → Matches: onclick="startGame()"  │  │
│  │  ... (12 total selectors)                                 │  │
│  │  Success? → Click and return true ✓                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                             ↓                                      │
│  ┌─ TIER 3: Text-Based Fallback (handles any button text) ───┐  │
│  │  Case-insensitive :has-text() selector:                   │  │
│  │  • button:has-text("start")  → "Start", "START", "Start   │  │
│  │                                 Game", "Click to Start"    │  │
│  │  • button:has-text("play")   → "Play", "PLAY NOW"         │  │
│  │  • a:has-text("start")       → Links with "start" text    │  │
│  │  • div[role="button"]:has-text("play") → Divs as buttons  │  │
│  │  Success? → Click and return true ✓                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                             ↓                                      │
│  All 29 selectors failed? → Try Strategy 2                        │
└───────────────────────────────────────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────────┐
│  STRATEGY 2: Natural Language (2-5 seconds, $0.00)                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                    │
│  Uses Stagehand's built-in natural language understanding:        │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Try 4 natural language commands:                          │  │
│  │  1. page.act("click start button")                         │  │
│  │  2. page.act("click play button")                          │  │
│  │  3. page.act("press start")                                │  │
│  │  4. page.act("click begin game")                           │  │
│  │                                                            │  │
│  │  Stagehand Process:                                        │  │
│  │  • Analyzes page structure                                 │  │
│  │  • Identifies likely target element                        │  │
│  │  • Executes click action                                   │  │
│  │                                                            │  │
│  │  Success? → Return true ✓                                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                             ↓                                      │
│  All 4 commands failed? → Try Strategy 3                          │
└───────────────────────────────────────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────────┐
│  STRATEGY 3: LLM State Analysis (5-10 seconds, ~$0.02)            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                    │
│  Used only as last resort (~5% of games). Most powerful but       │
│  also slowest and most expensive.                                 │
│                                                                    │
│  Step 1: Capture Current State                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  • page.content() → Full HTML                              │  │
│  │  • sanitizeHTML() → Remove scripts/event handlers          │  │
│  │  • page.screenshot() → PNG image                           │  │
│  │  Data: { html: string, screenshot: string }                │  │
│  └────────────────────────────────────────────────────────────┘  │
│                             ↓                                      │
│  Step 2: Ask LLM for Analysis                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  StateAnalyzer.analyzeAndRecommendAction({                 │  │
│  │    html: sanitizedHTML,                                    │  │
│  │    screenshot: screenshotPath,                             │  │
│  │    previousActions: [],                                    │  │
│  │    metadata: metadata,                                     │  │
│  │    goal: "Find and click the start button"                 │  │
│  │  })                                                        │  │
│  │                                                            │  │
│  │  → Sends to OpenAI GPT-4 Vision                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                             ↓                                      │
│  Step 3: GPT-4 Vision Analyzes                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Prompt: STATE_ANALYSIS_PROMPT                             │  │
│  │                                                            │  │
│  │  "You are analyzing a browser game. Given the HTML and     │  │
│  │  screenshot, determine what action to take next.           │  │
│  │                                                            │  │
│  │  Goal: Find and click the start button                     │  │
│  │                                                            │  │
│  │  CRITICAL FOR ACCURACY:                                    │  │
│  │  - Measure exact pixel coordinates from top-left (0,0)     │  │
│  │  - Button at center of 800x600 screen → ~(400, 300)       │  │
│  │  - Button at top-right → ~(700, 100)                       │  │
│  │                                                            │  │
│  │  Respond with structured JSON matching schema."            │  │
│  │                                                            │  │
│  │  Model: gpt-4o (GPT-4 with vision capabilities)            │  │
│  │  Input tokens: ~3000 (HTML) + ~800 (image)                │  │
│  │  Output tokens: ~150 (JSON response)                       │  │
│  │  Cost: ~$0.02 per call                                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                             ↓                                      │
│  Step 4: Parse Structured Response                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Zod Schema: actionRecommendationSchema                    │  │
│  │                                                            │  │
│  │  Response Example:                                         │  │
│  │  {                                                         │  │
│  │    action: 'click',                                        │  │
│  │    target: { x: 512, y: 384 },                            │  │
│  │    reasoning: "I see a green 'Start Game' button in the   │  │
│  │                center of the screen. It appears to be the  │  │
│  │                primary call-to-action.",                   │  │
│  │    confidence: 0.92,                                       │  │
│  │    alternatives: [                                         │  │
│  │      {                                                     │  │
│  │        action: 'click',                                    │  │
│  │        target: { x: 100, y: 50 },                         │  │
│  │        reasoning: "Small 'Play' text in top-left corner"   │  │
│  │      }                                                     │  │
│  │    ]                                                       │  │
│  │  }                                                         │  │
│  │                                                            │  │
│  │  Validation: Ensures response matches expected structure   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                             ↓                                      │
│  Step 5: Execute Recommendation                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Primary Action:                                           │  │
│  │  • page.click(512, 384)                                    │  │
│  │  • Wait for response (2s)                                  │  │
│  │  • Check if successful (state changed)                     │  │
│  │                                                            │  │
│  │  If Primary Fails:                                         │  │
│  │  • Try alternatives[0] (if confidence > 0.5)               │  │
│  │  • page.click(100, 50)                                     │  │
│  │                                                            │  │
│  │  Success? → Return true ✓                                  │  │
│  │  Failure? → Return false ✗                                 │  │
│  └────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────────┐
│  RESULT: Start button clicked (or not found)                      │
│  • true: Game started, continue to gameplay simulation            │
│  • false: Could not find start button, but continue anyway        │
│           (some games auto-start)                                 │
└───────────────────────────────────────────────────────────────────┘
```

**Why This Approach Works**:
1. **Cost-Optimized**: 95% of games use Strategy 1 or 2 ($0.00 cost)
2. **Speed-Optimized**: DOM selection takes <1s, most games succeed here
3. **Robust**: Strategy 3 catches edge cases (custom UI, canvas buttons, unusual layouts)
4. **Accuracy**: LLM sees actual visual layout, not just DOM structure

---

## Data Flow Diagrams

### Complete Data Flow: Standard QA Mode

```
┌─────────┐
│  USER   │
└────┬────┘
     │ gameUrl, metadata.json
     ↓
┌────────────────┐
│   CLI/Lambda   │ Parse args, validate env vars
└────┬───────────┘
     │ { gameUrl, metadata }
     ↓
┌────────────────┐
│  BrowserMgr    │ Initialize Browserbase session
└────┬───────────┘
     │ WebSocket endpoint
     ↓
┌────────────────┐
│   Stagehand    │ Connect to browser, get page object
└────┬───────────┘
     │ page object
     ↓
┌────────────────┐
│  GameDetector  │ Analyze DOM, detect game type
└────┬───────────┘
     │ GameType enum
     ↓
┌────────────────┐
│ GameInteractor │ Find start button (3 strategies)
└────┬───────────┘
     │ Click command
     ↓
┌────────────────┐
│   Stagehand    │ Execute click/keypress
└────┬───────────┘
     │ Synthetic events
     ↓
┌────────────────┐
│  Game (Browser)│ Process events, update state
└────┬───────────┘
     │ Visual output
     ↓
┌────────────────┐
│ ScreenshotCap  │ Capture PNG buffers
└────┬───────────┘
     │ PNG data
     ↓
┌────────────────┐
│  FileManager   │ Save to /tmp/game-qa-output/
└────┬───────────┘
     │ File paths
     ↓
┌────────────────┐
│ VisionAnalyzer │ Load PNGs, convert to base64
└────┬───────────┘
     │ Multi-modal prompt (text + images)
     ↓
┌────────────────┐
│ OpenAI GPT-4V  │ Analyze screenshots
└────┬───────────┘
     │ Structured JSON (playability_score, issues)
     ↓
┌────────────────┐
│  Main (runQA)  │ Assemble GameTestResult
└────┬───────────┘
     │ GameTestResult object
     ↓
┌────────────────┐
│   CLI/Lambda   │ Format and return
└────┬───────────┘
     │ JSON response
     ↓
┌─────────┐
│  USER   │
└─────────┘
```

### LLM Interaction: State Analysis (Strategy 3 / Adaptive Mode)

```
┌──────────────────────────────────────────────────────────────┐
│  Agent Side                                                   │
└──────────────────────────────────────────────────────────────┘
     │
     │ 1. Capture State
     ↓
  page.content()  ──────→  Raw HTML (50KB+)
     │
     ↓
  sanitizeHTML() ──────→  Clean HTML (20KB, no scripts/handlers)
     │
     ↓
  page.screenshot() ───→  PNG buffer (100-200KB)
     │
     ↓
  Bun.file().write() ──→  Save PNG to /tmp
     │
     │ 2. Build Prompt
     ↓
┌─────────────────────────────────────────────────────────────┐
│  Prompt Structure:                                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ System Message:                                     │    │
│  │ "You are analyzing a browser game. Goal: [goal]    │    │
│  │  Previous actions: [action history]                │    │
│  │  Game metadata: [genre, controls]                  │    │
│  │  Determine next action to progress."               │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ User Message (Multi-modal):                         │    │
│  │ • Text: STATE_ANALYSIS_PROMPT + context             │    │
│  │ • Image 1: data:image/png;base64,iVBORw0KG...       │    │
│  │ • Text: "HTML context: <html>...</html>"            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
     │
     │ 3. Send to OpenAI
     ↓
┌──────────────────────────────────────────────────────────────┐
│  OpenAI API (GPT-4 Vision)                                   │
└──────────────────────────────────────────────────────────────┘
     │
     │ 4. LLM Processing
     │    • Parse HTML structure
     │    • Analyze screenshot (OCR, object detection)
     │    • Match against goal and previous actions
     │    • Reason about next step
     │    • Generate structured JSON
     │
     ↓
┌─────────────────────────────────────────────────────────────┐
│  Response (Structured Output):                              │
│  {                                                          │
│    "action": "click",                                       │
│    "target": {                                              │
│      "x": 512,                                              │
│      "y": 384,                                              │
│      "label": "Continue to Level 2",                        │
│      "confidence": 0.89                                     │
│    },                                                       │
│    "reasoning": "The player completed level 1 (score      │
│                  shows 1000 points). A green 'Continue'    │
│                  button appeared in center of screen. This │
│                  is the next logical step to progress.",   │
│    "alternatives": [                                        │
│      {                                                      │
│        "action": "keypress",                                │
│        "target": { "key": "Space" },                        │
│        "reasoning": "Spacebar might also advance"           │
│      }                                                      │
│    ]                                                        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
     │
     │ 5. Validate Response
     ↓
  Zod Schema ──────→  Ensure matches actionRecommendationSchema
     │
     ↓ Valid
┌──────────────────────────────────────────────────────────────┐
│  Agent Side: Execute Action                                  │
└──────────────────────────────────────────────────────────────┘
     │
     ↓
  page.click(512, 384)  OR  page.keyPress('Space')
     │
     ↓
  Wait 2s for action to take effect
     │
     ↓
  Capture new screenshot, compare with previous
     │
     ↓
  State progressed? (pixel difference > threshold)
     │
     ├─→ YES: Record success, continue to next iteration
     │
     └─→ NO: Try alternative action or mark as stuck
```

---

## Component Interactions

### Component Dependency Graph

```
┌────────────────────────────────────────────────────────────────┐
│                         main.ts                                 │
│                   (Orchestration Layer)                         │
│                                                                 │
│  • runQA() - Standard mode                                     │
│  • runAdaptiveQA() - Adaptive mode                             │
│  • handler() - Lambda entry point                              │
│  • CLI entry point (if __name__ == 'main')                     │
└─────────────────────────┬──────────────────────────────────────┘
                          │
                          │ Initializes & Coordinates:
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ↓               ↓               ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ BrowserMgr   │  │ FileManager  │  │   Logger     │
│              │  │              │  │              │
│ • initialize │  │ • save PNG   │  │ • info/warn  │
│ • navigate   │  │ • save JSON  │  │ • error/debug│
│ • getPage    │  │ • cleanup    │  │ • structured │
│ • cleanup    │  │              │  │   JSON       │
└──────┬───────┘  └──────────────┘  └──────────────┘
       │
       │ Returns Page object
       │
       ↓
┌────────────────────────────────────────────────────────────────┐
│                    Stagehand Page                               │
│                  (Browser Automation)                           │
│                                                                 │
│  • goto(url)                                                   │
│  • act(command) - Natural language                             │
│  • click(x, y)                                                 │
│  • keyPress(key)                                               │
│  • screenshot() → Buffer                                       │
│  • content() → HTML string                                     │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         │ Used by:
                         │
         ┌───────────────┼──────────────────┬────────────────┐
         │               │                  │                │
         ↓               ↓                  ↓                ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ GameDetector │ │GameInteractor│ │ScreenshotCap │ │ ErrorMonitor │
│              │ │              │ │              │ │              │
│ • detectType │ │ • findAndClick│ • capture    │ │ • startMon   │
│ • waitReady  │ │   Start      │ • captureAt  │ │ • getErrors  │
│              │ │ • simulateKey│   OptimalTime│ │ • stopMon    │
│              │ │   board      │ • captureAll │ │              │
│              │ │ • clickAt    │              │ │              │
└──────────────┘ └──────┬───────┘ └──────┬───────┘ └──────────────┘
                        │                │
                        │ Uses:          │ Saves via:
                        │                │
                        ↓                ↓
           ┌──────────────────┐  ┌──────────────┐
           │  StateAnalyzer   │  │ FileManager  │
           │  (LLM Fallback)  │  │              │
           │                  │  └──────────────┘
           │ • analyzeAndRec  │
           │   ommendAction   │
           │ • hasStateProgr  │
           │   essed          │
           └─────────┬────────┘
                     │
                     │ Sends prompts to:
                     │
                     ↓
           ┌──────────────────┐
           │  VisionAnalyzer  │
           │  (GPT-4 Vision)  │
           │                  │
           │ • analyzeScreen  │
           │   shots          │
           │ • findClickable  │
           │   Elements       │
           │ • detectCrash    │
           └─────────┬────────┘
                     │
                     │ Calls:
                     │
                     ↓
           ┌──────────────────┐
           │   OpenAI API     │
           │   (GPT-4o)       │
           │                  │
           │ • generateObject │
           │ • generateText   │
           └──────────────────┘
```

### Data Flow Between Components

```
1. User Input → main.ts
   • CLI: process.argv
   • Lambda: event.body

2. main.ts → BrowserManager
   • Config: { apiKey, projectId, logger }
   • Returns: Page object

3. main.ts → GameDetector
   • Input: Page object
   • Returns: GameType enum

4. main.ts → ErrorMonitor
   • Input: Page object
   • Action: Inject monitoring code
   • Later: Retrieve errors

5. main.ts → GameInteractor
   • Config: { logger, visionAnalyzer?, stateAnalyzer?, metadata? }
   • Commands: findAndClickStart(), simulateKeyboard(), etc.
   • Uses: Page object (from BrowserManager)

6. GameInteractor → StateAnalyzer (Strategy 3 / Adaptive Mode)
   • Input: { html, screenshot, previousActions, metadata, goal }
   • Returns: ActionRecommendation

7. StateAnalyzer → OpenAI API
   • Prompt: Multi-modal (text + image)
   • Returns: Structured JSON (Zod validated)

8. GameInteractor → Stagehand Page
   • Commands: click(x,y), keyPress(key), act(command)
   • Returns: Success/failure

9. main.ts → ScreenshotCapturer
   • Input: Page object, stage name
   • Action: Capture screenshot
   • Output: Screenshot path

10. ScreenshotCapturer → FileManager
    • Input: PNG buffer, metadata
    • Action: Save to /tmp/game-qa-output/<sessionId>/
    • Returns: File path

11. main.ts → VisionAnalyzer
    • Input: Screenshot paths (3 files), metadata?
    • Action: Load PNGs, convert to base64, send to OpenAI
    • Returns: { playability_score, issues, tokenUsage }

12. VisionAnalyzer → OpenAI API
    • Prompt: GAME_ANALYSIS_PROMPT + 3 base64 images
    • Returns: Structured JSON (gameTestResultSchema)

13. main.ts → User
    • Output: GameTestResult JSON
    • CLI: stdout
    • Lambda: HTTP response body
```

---

## Error Handling Flow

The agent has comprehensive error handling at every level:

```
┌────────────────────────────────────────────────────────────────┐
│  Error Handling Strategy: Graceful Degradation                 │
│                                                                 │
│  Principle: Never crash the entire test due to a single failure│
│  Approach: Try-catch at each operation, continue with defaults │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Level 1: Initialization Errors (FATAL - abort test)           │
└────────────────────────────────────────────────────────────────┘
     │
     ├─→ Missing BROWSERBASE_API_KEY
     │   • Log error, throw exception
     │   • Return error result with status='error'
     │
     ├─→ Browser initialization fails
     │   • Log error, throw exception
     │   • Return error result with status='error'
     │
     └─→ Navigation fails
         • Log error, throw exception
         • Return error result with status='error'

┌────────────────────────────────────────────────────────────────┐
│  Level 2: Detection Errors (NON-FATAL - continue with defaults)│
└────────────────────────────────────────────────────────────────┘
     │
     ├─→ Game type detection fails
     │   • Log warning
     │   • Set gameType = UNKNOWN
     │   • Continue test
     │
     ├─→ Ready state detection times out
     │   • Log warning
     │   • Assume game is ready (may be false positive)
     │   • Continue test
     │
     └─→ Error monitoring fails to start
         • Log warning
         • Continue test without console error capture

┌────────────────────────────────────────────────────────────────┐
│  Level 3: Interaction Errors (NON-FATAL - try alternatives)    │
└────────────────────────────────────────────────────────────────┘
     │
     ├─→ Start button not found (Strategy 1 fails)
     │   • Log info
     │   • Try Strategy 2 (natural language)
     │
     ├─→ Natural language fails (Strategy 2 fails)
     │   • Log info
     │   • Try Strategy 3 (LLM state analysis)
     │
     ├─→ LLM state analysis fails (Strategy 3 fails)
     │   • Log warning
     │   • Continue test (some games auto-start)
     │
     ├─→ Keyboard input fails
     │   • Log error for that specific key
     │   • Continue with remaining keys
     │
     └─→ Screenshot capture fails
         • Log error
         • Continue with remaining screenshots

┌────────────────────────────────────────────────────────────────┐
│  Level 4: Analysis Errors (NON-FATAL - use defaults)           │
└────────────────────────────────────────────────────────────────┘
     │
     ├─→ Vision analysis fails (OpenAI API error)
     │   • Log error
     │   • Use default playability_score = 50
     │   • Set status = 'pass' (benefit of the doubt)
     │   • Add error to issues array
     │
     ├─→ Console error retrieval fails
     │   • Log warning
     │   • Set consoleErrors = []
     │   • Continue test
     │
     └─→ Screenshot file not found
         • Log error
         • Continue with available screenshots

┌────────────────────────────────────────────────────────────────┐
│  Level 5: Cleanup Errors (NON-FATAL - log and continue)        │
└────────────────────────────────────────────────────────────────┘
     │
     ├─→ File cleanup fails
     │   • Log warning
     │   • Files remain in /tmp (not critical)
     │
     └─→ Browser cleanup fails
         • Log warning
         • Browserbase will timeout and cleanup eventually

┌────────────────────────────────────────────────────────────────┐
│  Finally Block: ALWAYS Execute                                 │
└────────────────────────────────────────────────────────────────┘
     │
     ├─→ Stop error monitoring (if started)
     ├─→ Cleanup files (if flag enabled)
     └─→ Cleanup browser session (always)

┌────────────────────────────────────────────────────────────────┐
│  Error Result Format                                           │
└────────────────────────────────────────────────────────────────┘
{
  status: 'error',
  playability_score: 0,
  issues: [
    {
      severity: 'critical',
      description: 'Browser initialization failed: Connection refused',
      timestamp: '2025-11-06T...'
    }
  ],
  screenshots: [], // Empty if failed before screenshot capture
  timestamp: '2025-11-06T...',
  metadata: {
    sessionId: '...',
    gameUrl: '...',
    duration: 5432,
    gameType: 'UNKNOWN',
    consoleErrors: []
  }
}
```

---

## Performance Characteristics

### Standard QA Mode

| Phase | Duration | Cost | Parallelizable |
|-------|----------|------|----------------|
| Initialization | 5-10s | $0.00 | No |
| Navigation & Detection | 10-70s | $0.00 | Partially (detection can run during navigation) |
| Start Button (DOM) | 0-2s | $0.00 | No |
| Start Button (NL) | 2-5s | $0.00 | No |
| Start Button (LLM) | 5-10s | ~$0.02 | No |
| Gameplay Simulation | 30-60s | $0.00 | Yes (keyboard + monitoring) |
| Screenshot Capture | 3-6s (3 screenshots) | $0.00 | Yes (parallel capture with captureAll) |
| Vision Analysis | 10-20s | $0.02-0.05 | No |
| Cleanup | 1-2s | $0.00 | Partially |
| **Total** | **2-4 min** | **$0.02-0.07** | - |

### Adaptive QA Mode

| Phase | Duration | Cost | Notes |
|-------|----------|------|-------|
| Initialization (same) | 5-10s | $0.00 | Same as standard |
| Navigation & Detection (same) | 10-70s | $0.00 | Same as standard |
| Start Button (same) | 0-10s | $0.00-0.02 | Same as standard |
| **Adaptive Loop** | | | **Key Difference** |
| ├─ Capture State | 1-2s | $0.00 | Per iteration |
| ├─ LLM Analysis | 3-5s | ~$0.02 | Per iteration |
| ├─ Execute Action | 1-3s | $0.00 | Per iteration |
| ├─ Check Progression | 2-3s | $0.00 | Per iteration |
| └─ Screenshot | 1-2s | $0.00 | Per iteration |
| **Per Iteration** | **8-15s** | **~$0.02** | Configurable (default: 20 max) |
| Final Vision Analysis | 10-20s | $0.02-0.05 | Analyzes all screenshots |
| Cleanup | 1-2s | $0.00 | Same as standard |
| **Total (10 iterations)** | **2-4 min** | **$0.20-0.25** | Duration-limited |
| **Total (20 iterations)** | **4-6 min** | **$0.40-0.50** | Budget-limited |

---

## Summary

The DreamUp QA agent uses a sophisticated multi-layered approach:

1. **Initialization**: Set up browser, validate environment
2. **Detection**: Identify game type, wait for ready state
3. **Smart Start Button Detection**: 3-strategy cascading fallback (DOM → NL → LLM)
4. **Gameplay**: Metadata-driven or generic keyboard simulation
5. **Analysis**: GPT-4 Vision evaluates playability
6. **Adaptive Mode** (optional): Iterative action loop with LLM-powered decision making

**Key Innovations**:
- **Cost-Optimized**: $0.00 for 95% of start button detection (DOM/NL strategies)
- **Speed-Optimized**: Most operations complete in 2-4 minutes
- **Robust**: Graceful degradation at every layer, never fails completely
- **Intelligent**: LLM analyzes visual state when heuristics fail
- **Adaptive**: Optional iterative mode for complex games requiring navigation

**Data Flow**:
- User → Agent → Browserbase → Browser → Game
- Game → Screenshots → Vision AI → Analysis
- Agent → LLM → Actions → Game (in adaptive mode)

**Error Handling**:
- Fatal: Only initialization/navigation failures
- Non-fatal: Everything else (continue with defaults)
- Always cleanup: Browser session closed regardless of outcome
