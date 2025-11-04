# Task List: DreamUp QA Agent (Iterative Development)

**Development Approach**: Iterative (build → test → iterate)

**Original Detailed Plan**: See `task-list-waterfall-original.md` for comprehensive acceptance criteria, test plans, and detailed specifications.

---

## Why Iterative?

Based on expert recommendation and game engine context:
1. **De-risk early**: Validate Browserbase works in 2-3 hours (not 30+ hours)
2. **Real game feedback**: Test with actual games at each iteration
3. **Incremental complexity**: Add one feature at a time
4. **Working software faster**: Iteration 1 gives working (basic) agent in 2-3 hours

**Key Insight**: The game engine provides InputSchema (JavaScript snippets or semantic descriptions) that inform what controls to test. Start simple, add complexity incrementally.

---

## Completed Foundation (Phases 0-2)

✅ **Phase 0**: Project Setup (4/4 tasks)
✅ **Phase 1**: Type Definitions & Configuration (3/3 tasks)
✅ **Phase 2**: Utility Modules (3/3 tasks)

**Status**: Foundation complete. Ready for iterative feature development.

---

## Iteration Roadmap

| Iteration | Focus | Time | Status |
|-----------|-------|------|--------|
| **Iteration 1** | Minimal Working Agent | 2-3 hrs | 🔜 Next |
| **Iteration 2** | Basic Interaction | 3-4 hrs | ⏳ Pending |
| **Iteration 3** | Detection & Monitoring | 4-5 hrs | ⏳ Pending |
| **Iteration 4** | Vision Analysis | 5-7 hrs | ⏳ Pending |
| **Iteration 5** | Input Schema & Polish | 6-8 hrs | ⏳ Pending |

**Total Estimated Time**: 20-27 hours (remaining)

---

## Iteration 1: Minimal Working Agent

**Goal**: Validate Browserbase integration, load a game, take screenshot

**Time**: 2-3 hours

### Tasks

#### I1.1: Implement Browser Manager
**Effort**: M (2-3 hours)
**Status**: `[⚠️]` - **RUNTIME BUG: Requires Stagehand v3 upgrade**
**Original Reference**: P3.1 in `task-list-waterfall-original.md`

**⚠️ CRITICAL NOTE**: Initial implementation with Stagehand v1.x discovered runtime bug - Playwright incompatibility with Bun. **Requires upgrade to Stagehand v3.0.1** (see `_docs/stagehand-v3-upgrade-guide.md`).

**Implementation**:
- [x] Create `src/core/browser-manager.ts`
- [x] Implement `BrowserManager` class
  - [x] `initialize()` - Create Browserbase session, connect Stagehand
  - [x] `navigate(url)` - Navigate to URL with timeout and networkidle
  - [x] `cleanup()` - Close browser session
- [x] Add error handling and logging
- [x] Write integration tests with mock Browserbase
- [ ] **BUG FIX**: Upgrade to Stagehand v3.0.1 (15-20 min)

**Acceptance Criteria**:
- [x] Browser initializes successfully (with mocks)
- [x] Can navigate to URLs (with mocks)
- [x] Cleanup releases resources (with mocks)
- [x] Errors are caught and logged
- [ ] **Real game test passes** (blocked by Playwright/Bun bug)

---

#### I1.2: Implement Minimal Main Orchestration
**Effort**: S (1 hour)
**Status**: `[ ]`
**Original Reference**: P5.1 (simplified version) in `task-list-waterfall-original.md`

**Implementation**:
- [ ] Create `src/main.ts` with minimal `runQA()` function
  - [ ] Generate session ID (nanoid)
  - [ ] Initialize BrowserManager
  - [ ] Navigate to game URL
  - [ ] Take single screenshot
  - [ ] Cleanup browser
  - [ ] Return minimal result (status: 'pass', placeholder score)
- [ ] Add CLI entry point (`if (import.meta.main)`)
- [ ] Add comprehensive error handling
- [ ] Add logging at each step

**Acceptance Criteria**:
- [ ] Can run: `bun run src/main.ts <game-url>`
- [ ] Successfully loads game in Browserbase
- [ ] Captures screenshot to output directory
- [ ] Returns without errors
- [ ] Logs structured JSON

**Test with Real Game**:
```bash
bun run src/main.ts https://example-game-url.com
# Expected: Screenshot saved to output/screenshots/
# Validate: Browserbase session works, game loads
```

---

### Iteration 1 Complete When:
- [ ] Real game loads in Browserbase
- [ ] Screenshot captured and saved
- [ ] No errors in execution
- [ ] Structured logs show each step
- [ ] Can run multiple games in sequence

**Next**: Iteration 2 (add keyboard interaction)

---

## Iteration 2: Basic Interaction

**Goal**: Add keyboard input simulation, capture before/after screenshots

**Time**: 3-4 hours

### Tasks

#### I2.1: Implement Basic Game Interactor
**Effort**: M (2-3 hours)
**Status**: `[ ]`
**Original Reference**: P3.5 (partial - 60%) in `task-list-waterfall-original.md`

**Implementation**:
- [ ] Create `src/core/game-interactor.ts`
- [ ] Implement `GameInteractor` class
  - [ ] `simulateKeyboardInput(page, duration)` - Send WASD, arrows, space
  - [ ] `clickAtCoordinates(page, x, y)` - Helper for mouse clicks
- [ ] Add error handling for interaction failures
- [ ] Write unit tests with mock page

**Scope for Iteration 2** (simplified):
- ✅ Keyboard simulation (WASD, arrows, space, enter)
- ✅ Mouse clicks at coordinates
- ❌ Vision-based element detection (add in Iteration 4)
- ❌ InputSchema parsing (add in Iteration 5)

**Acceptance Criteria**:
- [ ] Can send keyboard inputs
- [ ] Can click at specific coordinates
- [ ] Interactions don't crash browser
- [ ] Errors handled gracefully

---

#### I2.2: Implement Basic Screenshot Capturer
**Effort**: S (1 hour)
**Status**: `[ ]`
**Original Reference**: P3.4 (partial - 40%) in `task-list-waterfall-original.md`

**Implementation**:
- [ ] Create `src/core/screenshot-capturer.ts`
- [ ] Implement `ScreenshotCapturer` class
  - [ ] `capture(page, stage)` - Take screenshot, save to file
  - [ ] Return Screenshot object with id, path, timestamp

**Scope for Iteration 2** (simplified):
- ✅ Capture single screenshot at specific stage
- ❌ Parallel capture (add in Iteration 5)
- ❌ Screenshot organization/cleanup (add in Iteration 5)

**Acceptance Criteria**:
- [ ] Screenshots save correctly with unique IDs
- [ ] Stage information tracked (initial_load, after_interaction, final_state)
- [ ] Errors handled gracefully

---

#### I2.3: Expand Main Orchestration
**Effort**: S (30 min)
**Status**: `[ ]`

**Implementation**:
- [ ] Update `src/main.ts` to use GameInteractor and ScreenshotCapturer
  - [ ] Capture screenshot before interaction
  - [ ] Simulate keyboard inputs (30 seconds)
  - [ ] Capture screenshot after interaction
  - [ ] Return result with screenshot paths

**Acceptance Criteria**:
- [ ] Three screenshots captured (initial, after interaction, final)
- [ ] Keyboard inputs sent to game
- [ ] No errors during interaction

**Test with Real Game**:
```bash
bun run src/main.ts https://example-platformer-game.com
# Expected: 3 screenshots showing game state changes
# Validate: Keyboard inputs affect game (character moves, etc.)
```

---

### Iteration 2 Complete When:
- [ ] Keyboard inputs sent to real game
- [ ] Game responds to inputs (visible in screenshots)
- [ ] Before/after screenshots captured
- [ ] No interaction errors

**Next**: Iteration 3 (add detection and monitoring)

---

## Iteration 3: Detection & Monitoring

**Goal**: Detect game type, monitor console errors

**Time**: 4-5 hours

### Tasks

#### I3.1: Implement Game Detector
**Effort**: L (3-4 hours)
**Status**: `[ ]`
**Original Reference**: P3.2 (full implementation) in `task-list-waterfall-original.md`

**Implementation**:
- [ ] Create `src/core/game-detector.ts`
- [ ] Define `GameType` enum (CANVAS, IFRAME, DOM, UNKNOWN)
- [ ] Implement `GameDetector` class
  - [ ] `detectType(page)` - Check for canvas, iframe, DOM patterns
  - [ ] `waitForGameReady(page, timeout)` - Multi-signal detection
    - [ ] Canvas exists
    - [ ] Canvas rendering (not blank)
    - [ ] Network idle
    - [ ] No loading text
  - [ ] `isCanvasRendering(page)` - Helper to check canvas has pixels
  - [ ] `detectIframe(page)` - Helper to detect iframes
- [ ] Write unit tests with mocked pages

**Acceptance Criteria**:
- [ ] Correctly detects canvas games
- [ ] Correctly detects iframe games
- [ ] Waits for game ready state (3/4 signals)
- [ ] Timeouts work correctly
- [ ] Tests cover all game types

---

#### I3.2: Implement Error Monitor
**Effort**: M (2-3 hours)
**Status**: `[ ]`
**Original Reference**: P3.3 (full implementation) in `task-list-waterfall-original.md`

**Implementation**:
- [ ] Create `src/core/error-monitor.ts`
- [ ] Implement `ErrorMonitor` class
  - [ ] `startMonitoring(page)` - Listen to console errors/warnings
  - [ ] `getErrors()` - Retrieve all captured errors
  - [ ] `hasErrors()` - Check if any errors occurred
  - [ ] `hasCriticalError()` - Check for JS errors/crashes
  - [ ] `stopMonitoring()` - Clean up listeners
- [ ] Write unit tests with mock console events

**Acceptance Criteria**:
- [ ] Captures console errors
- [ ] Captures console warnings
- [ ] Can retrieve all errors
- [ ] Correctly identifies critical errors
- [ ] Tests verify error capture

---

#### I3.3: Expand Main Orchestration
**Effort**: XS (30 min)
**Status**: `[ ]`

**Implementation**:
- [ ] Update `src/main.ts` to use GameDetector and ErrorMonitor
  - [ ] Detect game type after navigation
  - [ ] Wait for game ready before interaction
  - [ ] Start error monitoring
  - [ ] Include game type and errors in result metadata

**Acceptance Criteria**:
- [ ] Game type detected correctly
- [ ] Waits for game to be ready before interaction
- [ ] Console errors captured in result
- [ ] Metadata includes game type and error count

**Test with Real Game**:
```bash
bun run src/main.ts https://example-canvas-game.com
# Expected: Detects game type as "canvas", waits for ready, captures any errors
# Validate: Game type is correct, ready detection works
```

---

### Iteration 3 Complete When:
- [ ] Game type detected accurately on real games
- [ ] Ready detection prevents premature interaction
- [ ] Console errors captured during test
- [ ] Metadata enriched with detection results

**Next**: Iteration 4 (add vision analysis)

---

## Iteration 4: Vision Analysis

**Goal**: Integrate GPT-4 Vision for playability scoring and element detection

**Time**: 5-7 hours

### Tasks

#### I4.1: Create Vision Prompts
**Effort**: M (2-3 hours)
**Status**: `[ ]`
**Original Reference**: P4.1 (full implementation) in `task-list-waterfall-original.md`

**Implementation**:
- [ ] Create `src/vision/prompts.ts`
- [ ] Define `GAME_ANALYSIS` prompt (analyze screenshots for playability)
- [ ] Define `FIND_CLICKABLE_ELEMENTS` prompt (detect UI elements)
- [ ] Define `DETECT_CRASH` prompt (identify error screens)
- [ ] Add prompt versioning/tracking
- [ ] Include examples (few-shot learning)

**Acceptance Criteria**:
- [ ] Prompts are clear and specific
- [ ] Prompts reference the Zod schemas
- [ ] Prompts include examples
- [ ] Prompts are exported and reusable

---

#### I4.2: Implement Vision Analyzer
**Effort**: L (4-5 hours)
**Status**: `[ ]`
**Original Reference**: P4.2 (full implementation) in `task-list-waterfall-original.md`

**Implementation**:
- [ ] Create `src/vision/analyzer.ts`
- [ ] Implement `VisionAnalyzer` class
  - [ ] `constructor()` - Initialize OpenAI client
  - [ ] `analyzeScreenshots(screenshots)` - Analyze playability
    - [ ] Load screenshots from disk
    - [ ] Convert to base64
    - [ ] Build multi-modal prompt
    - [ ] Call `generateObject()` with gameTestResultSchema
    - [ ] Return parsed GameTestResult
  - [ ] `findClickableElements(screenshot)` - Detect elements
  - [ ] `detectCrash(screenshot)` - Check for crashes
  - [ ] Add error handling for API failures
  - [ ] Add token counting/logging
- [ ] Write integration tests with OpenAI API

**Acceptance Criteria**:
- [ ] Can analyze multiple screenshots
- [ ] Returns valid GameTestResult
- [ ] Can find clickable elements
- [ ] Can detect crashes
- [ ] Handles API errors gracefully
- [ ] Tests verify vision analysis

---

#### I4.3: Complete Game Interactor with Vision
**Effort**: M (2 hours)
**Status**: `[ ]`
**Original Reference**: P3.5 (remaining 40%) in `task-list-waterfall-original.md`

**Implementation**:
- [ ] Update `src/core/game-interactor.ts`
- [ ] Add `findAndClickStart(page)` method
  - [ ] Strategy 1: Try Stagehand natural language (`page.act("click start button")`)
  - [ ] Strategy 2: Fallback to vision-based detection
    - [ ] Take screenshot
    - [ ] Use VisionAnalyzer to find start button
    - [ ] Click at returned coordinates
- [ ] Add error handling for vision fallback

**Acceptance Criteria**:
- [ ] Can find start button with natural language
- [ ] Falls back to vision if natural language fails
- [ ] Clicks at correct coordinates
- [ ] Works with both canvas and DOM games

---

#### I4.4: Expand Main Orchestration
**Effort**: M (1-2 hours)
**Status**: `[ ]`

**Implementation**:
- [ ] Update `src/main.ts` to use VisionAnalyzer
  - [ ] Find and click start button before interaction
  - [ ] Analyze screenshots with vision after test
  - [ ] Use vision result for playability score
  - [ ] Determine pass/fail based on score (>= 50 = pass)
  - [ ] Include vision analysis in result

**Acceptance Criteria**:
- [ ] Start button found and clicked automatically
- [ ] Vision analysis provides playability score
- [ ] Pass/fail determined correctly
- [ ] Result includes issues from vision analysis

**Test with Real Game**:
```bash
bun run src/main.ts https://example-game.com
# Expected: Finds start button, interacts, scores playability (0-100)
# Validate: Score reflects actual game state, issues identified
```

---

### Iteration 4 Complete When:
- [ ] Vision accurately scores playability on real games
- [ ] Start button detection works (natural language or vision)
- [ ] Issues identified by vision are relevant
- [ ] Pass/fail threshold working correctly

**Next**: Iteration 5 (input schema and polish)

---

## Iteration 5: Input Schema & Polish

**Goal**: Parse InputSchema, polish features, prepare for production

**Time**: 6-8 hours

### Tasks

#### I5.1: Implement Input Schema Parser
**Effort**: M (2-3 hours)
**Status**: `[ ]`
**New Feature**: Not in original waterfall plan

**Implementation**:
- [ ] Create `src/core/input-schema-parser.ts`
- [ ] Implement `InputSchemaParser` class
  - [ ] `parse(inputSchema)` - Extract actions and axes
  - [ ] `getActionsToTest()` - Return list of actions (e.g., ['Jump', 'Shoot'])
  - [ ] `getAxesToTest()` - Return list of axes (e.g., ['MoveHorizontal'])
  - [ ] `inferKeybindings()` - Parse JavaScript snippets for key bindings
  - [ ] `parseSemanticDescription()` - Extract controls from text
- [ ] Write unit tests with example input schemas

**Acceptance Criteria**:
- [ ] Can parse JavaScript input schemas
- [ ] Can parse semantic descriptions
- [ ] Returns testable actions and axes
- [ ] Handles missing or malformed schemas gracefully

---

#### I5.2: Integrate Input Schema into Interactor
**Effort**: M (2 hours)
**Status**: `[ ]`

**Implementation**:
- [ ] Update `src/core/game-interactor.ts`
- [ ] Add `simulateGameplayWithSchema(page, inputSchema, duration)` method
  - [ ] Parse inputSchema to get expected controls
  - [ ] Test specific actions (send key bindings)
  - [ ] Test specific axes (send directional inputs)
  - [ ] Fallback to generic inputs if no schema provided
- [ ] Update vision prompts to include input schema context

**Acceptance Criteria**:
- [ ] Tests actions from input schema
- [ ] Tests axes from input schema
- [ ] Gracefully handles missing schema
- [ ] Vision prompts reference expected controls

---

#### I5.3: Complete Screenshot Capturer
**Effort**: S (1-2 hours)
**Status**: `[ ]`
**Original Reference**: P3.4 (remaining 60%) in `task-list-waterfall-original.md`

**Implementation**:
- [ ] Update `src/core/screenshot-capturer.ts`
- [ ] Add `captureAll(page, stages)` method for parallel capture
- [ ] Add screenshot organization (group by session)
- [ ] Implement cleanup logic (respect ENABLE_SCREENSHOT_CLEANUP flag)

**Acceptance Criteria**:
- [ ] Can capture multiple screenshots in parallel
- [ ] Screenshots organized by session
- [ ] Cleanup works when flag enabled

---

#### I5.4: Implement CLI and Lambda Interfaces
**Effort**: M (2-3 hours)
**Status**: `[ ]`
**Original Reference**: P5.2, P5.3 (full implementation) in `task-list-waterfall-original.md`

**Implementation**:
- [ ] Add CLI interface to `src/main.ts`
  - [ ] Parse command line arguments
  - [ ] Support: `bun run src/main.ts <game-url> [--input-schema <path>]`
  - [ ] Print formatted results to console
  - [ ] Exit with appropriate code (0 = pass, 1 = fail/error)
- [ ] Add Lambda handler to `src/main.ts`
  - [ ] Export `handler` function
  - [ ] Parse Lambda event (gameUrl, inputSchema, config)
  - [ ] Return formatted Lambda response
- [ ] Add package.json scripts

**Acceptance Criteria**:
- [ ] CLI runs from command line
- [ ] Lambda handler exports correctly
- [ ] Input schema can be passed via CLI or Lambda event
- [ ] Exit codes work correctly

---

#### I5.5: Comprehensive Testing & Validation
**Effort**: L (4-6 hours)
**Status**: `[ ]`
**Original Reference**: P6 (full implementation) in `task-list-waterfall-original.md`

**Implementation**:
- [ ] Create test fixtures (`tests/fixtures/sample-games.ts`)
  - [ ] Add 5+ test game URLs (canvas, iframe, DOM)
  - [ ] Add expected results for each
- [ ] Write comprehensive unit tests (target 70%+ coverage)
- [ ] Write integration tests (`tests/integration/qa-agent.test.ts`)
  - [ ] Test full flow with simple game
  - [ ] Test canvas game detection
  - [ ] Test iframe game detection
  - [ ] Test error handling (invalid URL)
  - [ ] Test timeout scenarios
  - [ ] Test vision analysis accuracy
- [ ] Manual testing with 10+ real games
  - [ ] Verify screenshot quality
  - [ ] Verify vision analysis accuracy
  - [ ] Test edge cases (slow loading, crashes, etc.)

**Acceptance Criteria**:
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] 70%+ code coverage
- [ ] 80%+ accuracy on test games
- [ ] No false positives (passing broken games)
- [ ] Edge cases handled correctly

---

#### I5.6: Documentation & Deployment Prep
**Effort**: M (3-4 hours)
**Status**: `[ ]`
**Original Reference**: P7 (full implementation) in `task-list-waterfall-original.md`

**Implementation**:
- [ ] Update README.md
  - [ ] Usage examples (CLI and Lambda)
  - [ ] InputSchema examples
  - [ ] Configuration guide
  - [ ] Troubleshooting section
- [ ] Create API.md documenting interfaces
- [ ] Add inline JSDoc comments to all public APIs
- [ ] Create Lambda deployment script
- [ ] Create Lambda configuration template
- [ ] Document deployment process
- [ ] Performance optimization
  - [ ] Profile execution times
  - [ ] Optimize screenshot resolution
  - [ ] Optimize vision prompts
  - [ ] Document performance characteristics

**Acceptance Criteria**:
- [ ] README is comprehensive
- [ ] All setup steps documented
- [ ] Code has JSDoc comments
- [ ] Lambda deployment documented
- [ ] Tests complete in <4 minutes average
- [ ] Vision API costs <$0.05 per test

---

### Iteration 5 Complete When:
- [ ] Input schema parsing works for JavaScript and semantic formats
- [ ] CLI and Lambda interfaces working
- [ ] All tests passing (unit + integration)
- [ ] Documentation complete
- [ ] Lambda deployment ready
- [ ] Performance targets met

**Status**: MVP COMPLETE 🎉

---

## Success Metrics

| Metric | Baseline (Manual) | Target (DreamUp) | Status |
|--------|------------------|------------------|--------|
| Time per test | 15-30 min | <4 min | TBD |
| Cost per test | $5-10 | <$0.05 | TBD |
| False positive rate | N/A | <1% | TBD |
| False negative rate | N/A | <20% | TBD |
| Critical bug detection | Variable | 80%+ | TBD |

---

## Testing Strategy

### After Each Iteration
- Run with at least 1 real game
- Verify new feature works as expected
- Check for regressions in previous features
- Update Memory Bank with learnings

### Continuous Testing
- Unit tests run on every file change
- Integration tests run before committing
- Manual smoke tests with real games

### Edge Cases to Test
- [ ] Very slow loading games (60s+)
- [ ] Games with splash screens
- [ ] Games with multiple start buttons
- [ ] Games that crash intentionally
- [ ] Games with no visible UI
- [ ] Canvas games vs iframe games vs DOM games

---

## Notes

### Game Engine Context
- **Scene Stack**: Canvas2D/3D (ECS runtime), UI (DOM), Composite (layers)
- **Input System**: Actions (discrete events), Axes (continuous -1 to 1)
- **Input Schema**: First-party games provide JS snippets, third-party games provide semantic descriptions

### Development Principles
1. **Test early, test often**: Real games after every iteration
2. **Fail fast**: Discover issues in hours, not weeks
3. **Incremental complexity**: Add one feature at a time
4. **Working software**: Every iteration produces a working agent

### Reference Documents
- **Original detailed plan**: `task-list-waterfall-original.md`
- **Architecture**: `architecture.md`
- **Technical concerns**: `technical-concerns.md`
- **System patterns**: `memory-bank/systemPatterns.md`

---

**Current Status**: Ready to begin Iteration 1
**Next Action**: Implement Browser Manager (I1.1)
