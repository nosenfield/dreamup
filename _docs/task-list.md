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
| **Iteration 1** | Minimal Working Agent | 2-3 hrs | ✅ Complete |
| **Iteration 2** | Basic Interaction | 3-4 hrs | ✅ Complete |
| **Iteration 3** | Detection & Monitoring | 4-5 hrs | ✅ Complete |
| **Iteration 4** | Vision Analysis | 5-7 hrs | ✅ Complete |
| **Iteration 5** | Input Schema & Polish | 8-10 hrs | ✅ Complete |

**Total Estimated Time**: 22-29 hours (✅ Complete)

---

## Iteration 1: Minimal Working Agent

**Goal**: Validate Browserbase integration, load a game, take screenshot

**Time**: 2-3 hours

### Tasks

#### I1.1: Implement Browser Manager
**Effort**: M (2-3 hours)
**Status**: `[x]` - ✅ COMPLETE
**Original Reference**: P3.1 in `task-list-waterfall-original.md`

**Implementation**:
- [x] Create `src/core/browser-manager.ts`
- [x] Implement `BrowserManager` class
  - [x] `initialize()` - Create Browserbase session, connect Stagehand
  - [x] `navigate(url)` - Navigate to URL with timeout and networkidle
  - [x] `cleanup()` - Close browser session
- [x] Add error handling and logging
- [x] Write integration tests with mock Browserbase
- [x] **BUG FIX**: Upgrade to Stagehand v3.0.1 ✅ COMPLETE

**Acceptance Criteria**:
- [x] Browser initializes successfully (with mocks)
- [x] Can navigate to URLs (with mocks)
- [x] Cleanup releases resources (with mocks)
- [x] Errors are caught and logged
- [x] **Real game test passes** ✅ Stagehand v3 upgrade complete - Bun-compatible

---

#### I1.2: Implement Minimal Main Orchestration
**Effort**: S (1 hour)
**Status**: `[x]` - ✅ COMPLETE
**Original Reference**: P5.1 (simplified version) in `task-list-waterfall-original.md`

**Implementation**:
- [x] Create `src/main.ts` with minimal `runQA()` function
  - [x] Generate session ID (nanoid)
  - [x] Initialize BrowserManager
  - [x] Navigate to game URL
  - [x] Take single screenshot
  - [x] Cleanup browser
  - [x] Return minimal result (status: 'pass', placeholder score)
- [x] Add CLI entry point (`if (import.meta.main)`)
- [x] Add comprehensive error handling
- [x] Add logging at each step

**Acceptance Criteria**:
- [x] Can run: `bun run src/main.ts <game-url>`
- [x] Successfully loads game in Browserbase
- [x] Captures screenshot to output directory
- [x] Returns without errors
- [x] Logs structured JSON

**Test with Real Game**:
```bash
bun run src/main.ts https://example-game-url.com
# Expected: Screenshot saved to output/screenshots/
# Validate: Browserbase session works, game loads
```

---

### Iteration 1 Complete When:
- [x] Real game loads in Browserbase
- [x] Screenshot captured and saved
- [x] No errors in execution
- [x] Structured logs show each step
- [x] Can run multiple games in sequence

**Next**: Iteration 2 (add keyboard interaction)

---

## Iteration 2: Basic Interaction

**Goal**: Add keyboard input simulation, capture before/after screenshots

**Time**: 3-4 hours

### Tasks

#### I2.1: Implement Basic Game Interactor
**Effort**: M (2-3 hours)
**Status**: `[x]` - ✅ COMPLETE
**Original Reference**: P3.5 (partial - 60%) in `task-list-waterfall-original.md`

**Implementation**:
- [x] Create `src/core/game-interactor.ts`
- [x] Implement `GameInteractor` class
  - [x] `simulateKeyboardInput(page, duration)` - Send WASD, arrows, space
  - [x] `clickAtCoordinates(page, x, y)` - Helper for mouse clicks
- [x] Add error handling for interaction failures
- [x] Write unit tests with mock page

**Scope for Iteration 2** (simplified):
- ✅ Keyboard simulation (WASD, arrows, space, enter)
- ✅ Mouse clicks at coordinates
- ❌ Vision-based element detection (add in Iteration 4)
- ❌ InputSchema parsing (add in Iteration 5)

**Acceptance Criteria**:
- [x] Can send keyboard inputs
- [x] Can click at specific coordinates
- [x] Interactions don't crash browser
- [x] Errors handled gracefully

---

#### I2.2: Implement Basic Screenshot Capturer
**Effort**: S (1 hour)
**Status**: `[x]` - ✅ COMPLETE
**Original Reference**: P3.4 (partial - 40%) in `task-list-waterfall-original.md`

**Implementation**:
- [x] Create `src/core/screenshot-capturer.ts`
- [x] Implement `ScreenshotCapturer` class
  - [x] `capture(page, stage)` - Take screenshot, save to file
  - [x] Return Screenshot object with id, path, timestamp

**Scope for Iteration 2** (simplified):
- ✅ Capture single screenshot at specific stage
- ❌ Parallel capture (add in Iteration 5)
- ❌ Screenshot organization/cleanup (add in Iteration 5)

**Acceptance Criteria**:
- [x] Screenshots save correctly with unique IDs
- [x] Stage information tracked (initial_load, after_interaction, final_state)
- [x] Errors handled gracefully

---

#### I2.3: Expand Main Orchestration
**Effort**: S (30 min)
**Status**: `[x]` - ✅ COMPLETE

**Implementation**:
- [x] Update `src/main.ts` to use GameInteractor and ScreenshotCapturer
  - [x] Capture screenshot before interaction
  - [x] Simulate keyboard inputs (30 seconds)
  - [x] Capture screenshot after interaction
  - [x] Return result with screenshot paths

**Acceptance Criteria**:
- [x] Three screenshots captured (initial, after interaction, final)
- [x] Keyboard inputs sent to game
- [x] No errors during interaction

**Test with Real Game**:
```bash
bun run src/main.ts https://example-platformer-game.com
# Expected: 3 screenshots showing game state changes
# Validate: Keyboard inputs affect game (character moves, etc.)
```

---

### Iteration 2 Complete When:
- [x] Keyboard inputs sent to real game
- [x] Game responds to inputs (visible in screenshots)
- [x] Before/after screenshots captured
- [x] No interaction errors

**Next**: Iteration 3 (add detection and monitoring)

---

## Iteration 3: Detection & Monitoring

**Goal**: Detect game type, monitor console errors

**Time**: 4-5 hours

### Tasks

#### I3.1: Implement Game Detector
**Effort**: L (3-4 hours)
**Status**: `[x]` - ✅ COMPLETE
**Original Reference**: P3.2 (full implementation) in `task-list-waterfall-original.md`

**Implementation**:
- [x] Create `src/core/game-detector.ts`
- [x] Define `GameType` enum (CANVAS, IFRAME, DOM, UNKNOWN)
- [x] Implement `GameDetector` class
  - [x] `detectType(page)` - Check for canvas, iframe, DOM patterns
  - [x] `waitForGameReady(page, timeout)` - Multi-signal detection
    - [x] Canvas exists
    - [x] Canvas rendering (not blank)
    - [x] Network idle
    - [x] No loading text
  - [x] `isCanvasRendering(page)` - Helper to check canvas has pixels
  - [x] `detectIframe(page)` - Helper to detect iframes
- [x] Write unit tests with mocked pages

**Acceptance Criteria**:
- [x] Correctly detects canvas games
- [x] Correctly detects iframe games
- [x] Waits for game ready state (3/4 signals)
- [x] Timeouts work correctly
- [x] Tests cover all game types

---

#### I3.2: Implement Error Monitor
**Effort**: M (2-3 hours)
**Status**: `[x]` - ✅ COMPLETE
**Original Reference**: P3.3 (full implementation) in `task-list-waterfall-original.md`

**Implementation**:
- [x] Create `src/core/error-monitor.ts`
- [x] Implement `ErrorMonitor` class
  - [x] `startMonitoring(page)` - Listen to console errors/warnings
  - [x] `getErrors()` - Retrieve all captured errors
  - [x] `hasErrors()` - Check if any errors occurred
  - [x] `hasCriticalError()` - Check for JS errors/crashes
  - [x] `stopMonitoring()` - Clean up listeners
- [x] Write unit tests with mock console events

**Acceptance Criteria**:
- [x] Captures console errors
- [x] Captures console warnings
- [x] Can retrieve all errors
- [x] Correctly identifies critical errors
- [x] Tests verify error capture

---

#### I3.3: Expand Main Orchestration
**Effort**: XS (30 min)
**Status**: `[x]` - ✅ COMPLETE

**Implementation**:
- [x] Update `src/main.ts` to use GameDetector and ErrorMonitor
  - [x] Detect game type after navigation
  - [x] Wait for game ready before interaction
  - [x] Start error monitoring
  - [x] Include game type and errors in result metadata

**Acceptance Criteria**:
- [x] Game type detected correctly
- [x] Waits for game to be ready before interaction
- [x] Console errors captured in result
- [x] Metadata includes game type and error count

**Test with Real Game**:
```bash
bun run src/main.ts https://example-canvas-game.com
# Expected: Detects game type as "canvas", waits for ready, captures any errors
# Validate: Game type is correct, ready detection works
```

---

### Iteration 3 Complete When:
- [x] Game type detected accurately on real games
- [x] Ready detection prevents premature interaction
- [x] Console errors captured during test
- [x] Metadata enriched with detection results

**Next**: Iteration 4 (add vision analysis)

---

## Iteration 4: Vision Analysis

**Goal**: Integrate GPT-4 Vision for playability scoring and element detection

**Time**: 5-7 hours

### Tasks

#### I4.1: Create Vision Prompts
**Effort**: M (2-3 hours)
**Status**: `[x]` - ✅ COMPLETE
**Original Reference**: P4.1 (full implementation) in `task-list-waterfall-original.md`

**Implementation**:
- [x] Create `src/vision/prompts.ts`
- [x] Define `GAME_ANALYSIS` prompt (analyze screenshots for playability)
- [x] Define `FIND_CLICKABLE_ELEMENTS` prompt (detect UI elements)
- [x] Define `DETECT_CRASH` prompt (identify error screens)
- [x] Add prompt versioning/tracking
- [x] Include examples (few-shot learning)

**Acceptance Criteria**:
- [x] Prompts are clear and specific
- [x] Prompts reference the Zod schemas
- [x] Prompts include examples
- [x] Prompts are exported and reusable

---

#### I4.2: Implement Vision Analyzer
**Effort**: L (4-5 hours)
**Status**: `[x]` - ✅ COMPLETE
**Original Reference**: P4.2 (full implementation) in `task-list-waterfall-original.md`

**Implementation**:
- [x] Create `src/vision/analyzer.ts`
- [x] Implement `VisionAnalyzer` class
  - [x] `constructor()` - Initialize OpenAI client
  - [x] `analyzeScreenshots(screenshots)` - Analyze playability
    - [x] Load screenshots from disk
    - [x] Convert to base64
    - [x] Build multi-modal prompt
    - [x] Call `generateObject()` with gameTestResultSchema
    - [x] Return parsed GameTestResult
  - [x] `findClickableElements(screenshot)` - Detect elements
  - [x] `detectCrash(screenshot)` - Check for crashes
  - [x] Add error handling for API failures
  - [x] Add token counting/logging
- [x] Write integration tests with OpenAI API

**Acceptance Criteria**:
- [x] Can analyze multiple screenshots
- [x] Returns valid GameTestResult
- [x] Can find clickable elements
- [x] Can detect crashes
- [x] Handles API errors gracefully
- [x] Tests verify vision analysis

---

#### I4.3: Complete Game Interactor with Vision
**Effort**: M (2 hours)
**Status**: `[x]` - ✅ COMPLETE
**Original Reference**: P3.5 (remaining 40%) in `task-list-waterfall-original.md`

**Implementation**:
- [x] Update `src/core/game-interactor.ts`
- [x] Add `findAndClickStart(page)` method
  - [x] Strategy 1: Try DOM selection (fastest)
  - [x] Strategy 2: Try Stagehand natural language (`page.act("click start button")`)
  - [x] Strategy 3: Fallback to vision-based detection
    - [x] Take screenshot
    - [x] Use VisionAnalyzer to find start button
    - [x] Click at returned coordinates
- [x] Add error handling for vision fallback

**Acceptance Criteria**:
- [x] Can find start button with DOM selection
- [x] Can find start button with natural language
- [x] Falls back to vision if natural language fails
- [x] Clicks at correct coordinates
- [x] Works with both canvas and DOM games

---

#### I4.4: Expand Main Orchestration
**Effort**: M (1-2 hours)
**Status**: `[x]` - ✅ COMPLETE

**Implementation**:
- [x] Update `src/main.ts` to use VisionAnalyzer
  - [x] Find and click start button before interaction
  - [x] Analyze screenshots with vision after test
  - [x] Use vision result for playability score
  - [x] Determine pass/fail based on score (>= 50 = pass)
  - [x] Include vision analysis in result

**Acceptance Criteria**:
- [x] Start button found and clicked automatically
- [x] Vision analysis provides playability score
- [x] Pass/fail determined correctly
- [x] Result includes issues from vision analysis

**Test with Real Game**:
```bash
bun run src/main.ts https://example-game.com
# Expected: Finds start button, interacts, scores playability (0-100)
# Validate: Score reflects actual game state, issues identified
```

---

### Iteration 4 Complete When:
- [x] Vision accurately scores playability on real games
- [x] Start button detection works (DOM, natural language, or vision)
- [x] Issues identified by vision are relevant
- [x] Pass/fail threshold working correctly

**Next**: Iteration 5 (input schema and polish)

---

## Iteration 5: Input Schema & Polish

**Goal**: Parse InputSchema, polish features, prepare for production

**Time**: 8-10 hours (updated from 6-8 to include I5.0)

### Tasks

#### I5.0: Define GameMetadata Type System
**Effort**: S (1-2 hours)
**Status**: `[x]` - ✅ COMPLETE
**New Task**: Foundation for I5.1 and I5.2

**Implementation**:
- [x] Update `src/types/game-test.types.ts`
  - [x] Create `GameMetadata` interface (container for all metadata)
  - [x] Create `InputAction` interface (structured action with keys)
  - [x] Create `InputAxis` interface (structured axis with keys)
  - [x] Create `LoadingIndicator` interface (hints for ready detection)
  - [x] Create `SuccessIndicator` interface (hints for validation)
  - [x] Create `TestingStrategy` interface (timing and priorities)
  - [x] Update `InputSchema` to use `InputAction[]` and `InputAxis[]`
  - [x] Update `GameTestRequest` to add `metadata?: GameMetadata`
  - [x] Mark `inputSchema` as deprecated (keep for backwards compat)
- [x] Create Zod schemas in `src/schemas/metadata.schema.ts`
  - [x] `gameMetadataSchema` for validation
  - [x] Export inferred types for consistency
- [x] Update `src/types/index.ts` to export new types
- [x] Create example metadata files
  - [x] `_game-examples/pong/metadata.json`
  - [x] `_game-examples/snake/metadata.json`
- [x] Write unit tests in `tests/unit/types.test.ts`
  - [x] Test GameMetadata type imports
  - [x] Test Zod schema validation
  - [x] Test backwards compatibility with old inputSchema

**Acceptance Criteria**:
- [x] All new types exported and importable
- [x] Zod schemas validate example metadata files
- [x] TypeScript compilation passes with no errors
- [x] Unit tests verify type structure
- [x] Example metadata files follow schema exactly
- [x] Backwards compatible with existing inputSchema usage

**Example GameMetadata Structure**:
```json
{
  "metadataVersion": "1.0.0",
  "genre": "arcade",
  "inputSchema": {
    "type": "javascript",
    "actions": [{"name": "Pause", "keys": ["Escape"]}],
    "axes": [{"name": "MoveVertical", "keys": ["ArrowDown", "ArrowUp"]}]
  },
  "testingStrategy": {
    "waitBeforeInteraction": 2000,
    "interactionDuration": 30000,
    "criticalActions": ["Pause"]
  }
}
```

---

#### I5.1: Implement Input Schema Parser
**Effort**: M (2-3 hours)
**Status**: `[x]` - ✅ COMPLETE
**Depends On**: I5.0 (metadata types must exist first)

**Implementation**:
- [x] Create `src/core/input-schema-parser.ts`
- [x] Implement `InputSchemaParser` class
  - [x] `parse(metadata: GameMetadata)` - Extract actions and axes from metadata
  - [x] `parseJavaScript(content: string)` - Parse GameBuilder API calls from JS code
  - [x] `parseSemantic(content: string)` - Extract controls from semantic text
  - [x] `inferKeybindings(actions, axes)` - Flatten to key list for testing
- [x] Write unit tests with Pong/Snake metadata files
- [x] Update `src/core/index.ts` to export InputSchemaParser

**Acceptance Criteria**:
- [x] Can parse GameMetadata with JavaScript input schemas
- [x] Can parse GameMetadata with semantic descriptions
- [x] Returns structured InputAction[] and InputAxis[]
- [x] Handles missing or malformed metadata gracefully
- [x] Works with both metadata.json files (Pong/Snake)

---

#### I5.2: Integrate Metadata into GameInteractor
**Effort**: M (2-3 hours)
**Status**: `[x]` - ✅ COMPLETE
**Depends On**: I5.0, I5.1

**Implementation**:
- [x] Update `src/core/game-interactor.ts`
- [x] Add `simulateGameplayWithMetadata(page, metadata, duration)` method
  - [x] Parse metadata.inputSchema to get controls (use InputSchemaParser)
  - [x] Test critical actions first (from testingStrategy.criticalActions)
  - [x] Test critical axes first (from testingStrategy.criticalAxes)
  - [x] Test remaining inputs
  - [x] Fallback to generic inputs if no metadata provided
- [x] Update `src/main.ts` to pass metadata
  - [x] Extract metadata from request.metadata || request.inputSchema (backwards compat)
  - [x] Pass metadata to GameInteractor
- [x] Update `src/vision/prompts.ts` to include expectedControls from metadata
  - [x] Add metadata.expectedControls to GAME_ANALYSIS_PROMPT context
  - [x] Add metadata.genre to prompt for better context

**Acceptance Criteria**:
- [x] Tests actions from metadata.inputSchema
- [x] Tests axes from metadata.inputSchema
- [x] Prioritizes criticalActions/criticalAxes from testingStrategy
- [x] Gracefully handles missing metadata
- [x] Vision prompts reference metadata.expectedControls
- [x] Backwards compatible with old inputSchema field (converts to metadata)

---

#### I5.3: Complete Screenshot Capturer
**Effort**: S (1-2 hours)
**Status**: `[x]` - ✅ COMPLETE
**Original Reference**: P3.4 (remaining 60%) in `task-list-waterfall-original.md`

**Implementation**:
- [x] Update `src/core/screenshot-capturer.ts`
- [x] Add `captureAtOptimalTime()` method for metadata-based timing
- [x] Add `captureAll(page, stages)` method for parallel capture
- [x] Implement cleanup logic in FileManager (respect ENABLE_SCREENSHOT_CLEANUP flag)
- [x] Integrate metadata timing into main.ts

**Acceptance Criteria**:
- [x] Can capture screenshots at optimal times using indicators
- [x] Can capture multiple screenshots in parallel
- [x] Screenshots organized by session
- [x] Cleanup works when flag enabled
- [x] Gracefully handles missing metadata

---

#### I5.4: Implement CLI and Lambda Interfaces
**Effort**: M (2-3 hours)
**Status**: `[x]` - ✅ COMPLETE
**Original Reference**: P5.2, P5.3 (full implementation) in `task-list-waterfall-original.md`

**Implementation**:
- [x] Add CLI argument parsing to `src/main.ts`
  - [x] Parse command line arguments with proper flags
  - [x] Support: `bun run src/main.ts <game-url> [--metadata <path>]`
  - [x] Load metadata.json from file path if provided
  - [x] Print formatted results to console
  - [x] Exit with appropriate code (0 = pass, 1 = fail/error)
- [x] Add Lambda handler to `src/main.ts`
  - [x] Export `handler` function
  - [x] Parse Lambda event (gameUrl, metadata?, inputSchema?, config)
  - [x] Support both metadata and inputSchema in event (backwards compat for Lambda)
  - [x] Convert inputSchema to metadata if metadata not provided
  - [x] Return formatted Lambda response
- [x] Add package.json scripts

**Acceptance Criteria**:
- [x] CLI runs from command line with URL argument
- [x] CLI accepts optional --metadata flag to load metadata.json
- [x] Lambda handler exports correctly
- [x] Lambda supports both metadata and inputSchema in event (converts inputSchema to metadata)
- [x] Exit codes work correctly
- [x] Helpful error messages for missing arguments

---

#### I5.5: Comprehensive Testing & Validation
**Effort**: L (4-6 hours)
**Status**: `[x]` - ✅ COMPLETE
**Original Reference**: P6 (full implementation) in `task-list-waterfall-original.md`

**Implementation**:
- [x] Create test fixtures (`tests/fixtures/sample-games.ts`)
  - [x] Add 7+ test game URLs (canvas, iframe, DOM)
  - [x] Add expected results for each
- [x] Write comprehensive unit tests (target 70%+ coverage)
- [x] Write integration tests (`tests/integration/main.test.ts`)
  - [x] Test full flow with simple game
  - [x] Test canvas game detection
  - [x] Test iframe game detection
  - [x] Test error handling (invalid URL)
  - [x] Test timeout scenarios
  - [x] Test vision analysis accuracy
  - [x] Test edge cases and game type detection
- [x] Create manual testing guide (`_docs/testing-guide.md`)
  - [x] Document testing procedures
  - [x] List 12+ test games with expected results
  - [x] Provide validation checklist

**Acceptance Criteria**:
- [x] All unit tests pass
- [x] All integration tests pass
- [x] 60+ tests passing (comprehensive coverage)
- [x] Edge cases handled correctly
- [x] Manual testing guide created

---

#### I5.6: Documentation & Deployment Prep
**Effort**: M (3-4 hours)
**Status**: `[x]` - ✅ COMPLETE
**Original Reference**: P7 (full implementation) in `task-list-waterfall-original.md`

**Implementation**:
- [x] Update README.md
  - [x] Usage examples (CLI and Lambda)
  - [x] InputSchema examples
  - [x] Configuration guide
  - [x] Troubleshooting section
  - [x] Performance documentation
- [x] Create API.md documenting interfaces
- [x] Add inline JSDoc comments to all public APIs
- [x] Create Lambda deployment script (`scripts/deploy-lambda.sh`)
- [x] Create Lambda configuration template (`scripts/lambda-config.json`)
- [x] Document deployment process (`_docs/deployment.md`)
- [x] Performance optimization
  - [x] Document performance characteristics
  - [x] Document optimization tips

**Acceptance Criteria**:
- [x] README is comprehensive
- [x] All setup steps documented
- [x] Code has JSDoc comments
- [x] Lambda deployment documented
- [x] Performance characteristics documented
- [x] API.md created with complete API reference

---

### Iteration 5 Complete When:
- [x] Input schema parsing works for JavaScript and semantic formats
- [x] CLI and Lambda interfaces working
- [x] All tests passing (unit + integration)
- [x] Documentation complete
- [x] Lambda deployment ready
- [x] Performance targets met

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

**Current Status**: MVP Complete - Ready for production deployment 🎉
**Next Action**: Deploy to AWS Lambda or run manual tests with real games
