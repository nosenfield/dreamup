# Progress Tracker: DreamUp

**Last Updated**: November 5, 2025
**Development Approach**: Iterative (5 iterations)

---

## 🔄 Strategic Pivot to Iterative Development

**Switched from waterfall phases to iterative development** based on expert recommendation and game engine context.

**Why**: De-risk early (validate Browserbase in 2-3 hours, not 30+), test with real games after each iteration, build working software incrementally.

**Original plan**: Archived in `_docs/task-list-waterfall-original.md` (full details preserved)
**Current plan**: `_docs/task-list.md` (iteration-based, same work, different order)

---

## Project Milestones

- [x] **Milestone 1: Foundation Complete** (Phase 0-2) - ✅ COMPLETE
- [x] **Milestone 2: Iteration 1-2 Complete** (Minimal agent + interaction) - ✅ COMPLETE
- [x] **Milestone 3: Iteration 3-4 Complete** (Detection + vision) - ✅ COMPLETE
- [ ] **Milestone 4: MVP Complete** (Iteration 5 + polish) - 8-10 hours

**Current Milestone**: Milestone 4 (Iteration 5)

---

## Iteration Status

### Iteration 1: Minimal Working Agent
**Goal**: Validate Browserbase integration, load game, take screenshot
**Status**: ✅ COMPLETE
**Progress**: 2/2 tasks complete

- [x] I1.1: Implement Browser Manager (2-3 hours) ✅ COMPLETE (including Stagehand v3 upgrade)
- [x] I1.2: Implement Minimal Main Orchestration (1 hour) ✅ COMPLETE

**Completion Criteria**:
- [x] Real game loads in Browserbase ✅ VERIFIED
- [x] Screenshot captured and saved ✅ VERIFIED
- [x] No errors in execution ✅ VERIFIED

**Critical Issue Resolved**:
- ✅ Upgraded to Stagehand v3.0.1 (Nov 4, 2025)
- ✅ Playwright/Bun incompatibility resolved
- ✅ Real game test passing (2048 game tested successfully)
- ✅ Screenshot captured and saved without errors

### Iteration 2: Basic Interaction
**Goal**: Add keyboard input simulation
**Status**: ✅ COMPLETE
**Progress**: 3/3 tasks complete

- [x] I2.1: Implement Basic Game Interactor (2-3 hours) ✅ COMPLETE (Nov 4, 2025)
- [x] I2.2: Implement Basic Screenshot Capturer (1 hour) ✅ COMPLETE (Nov 4, 2025)
- [x] I2.3: Expand Main Orchestration (30 min) ✅ COMPLETE (Nov 4, 2025)

### Iteration 3: Detection & Monitoring
**Goal**: Detect game type, monitor console errors
**Status**: ✅ Complete
**Progress**: 3/3 tasks

- [x] I3.1: Implement Game Detector (3-4 hours) ✅ COMPLETE (Nov 4, 2025)
- [x] I3.2: Implement Error Monitor (2-3 hours) ✅ COMPLETE (Nov 4, 2025)
- [x] I3.3: Expand Main Orchestration (30 min) ✅ COMPLETE (Nov 4, 2025)

### Iteration 4: Vision Analysis
**Goal**: Integrate GPT-4 Vision for playability scoring
**Status**: ✅ Complete
**Progress**: 4/4 tasks

- [x] I4.1: Create Vision Prompts (2-3 hours) ✅ COMPLETE (Nov 4, 2025)
- [x] I4.2: Implement Vision Analyzer (4-5 hours) ✅ COMPLETE (Nov 4, 2025)
- [x] I4.3: Complete Game Interactor with Vision (2 hours) ✅ COMPLETE (Nov 4, 2025)
- [x] I4.4: Expand Main Orchestration (1-2 hours) ✅ COMPLETE (Nov 5, 2025)

### Iteration 5: Input Schema & Polish
**Goal**: Parse InputSchema, polish features, prepare for production
**Status**: 📋 In Progress (I5.0 + I5.1 + I5.2 + I5.3 Complete)
**Progress**: 4.5/7 tasks (documentation + I5.0 + I5.1 + I5.2 + I5.3 complete)

- [x] **Documentation Phase** (Nov 5, 2025) ✅ COMPLETE
  - Defined GameMetadata type system architecture
  - Created example metadata files (Pong, Snake)
  - Added Pattern 10: Metadata-Driven Testing
  - Updated task-list.md with I5.0 and refined I5.1/I5.2/I5.4
  - Commit: `aa17175` - 5 files changed, 461 insertions
- [x] I5.0: Define GameMetadata Type System (1-2 hours) ✅ COMPLETE (Nov 5, 2025)
  - Created 6 new interfaces: GameMetadata, InputAction, InputAxis, LoadingIndicator, SuccessIndicator, TestingStrategy
  - Created Zod schemas in `src/schemas/metadata.schema.ts` with validation helpers
  - Updated InputSchema to support both old (`string[]`) and new (structured arrays) formats
  - Added `metadata` field to GameTestRequest, marked `inputSchema` as deprecated
  - 48 tests passing (15 type tests + 33 schema validation tests)
  - Validated example metadata files (Pong, Snake) against schemas
  - Foundation ready for I5.1 and I5.2
- [x] I5.1: Implement Input Schema Parser (2-3 hours) ✅ COMPLETE (Nov 5, 2025)
  - Created InputSchemaParser class with parse(), parseJavaScript(), parseSemantic(), inferKeybindings()
  - Parses GameBuilder API calls (createAction, createAxis, createAxis2D patterns)
  - Parses semantic natural language descriptions (arrow keys, WASD, spacebar, etc.)
  - Handles structured arrays, string[] arrays, and content-only schemas
  - 24 tests passing (comprehensive coverage)
  - Ready for I5.2 (GameInteractor integration)
- [x] I5.2: Integrate Metadata into GameInteractor (2-3 hours) ✅ COMPLETE (Nov 5, 2025)
  - Implemented simulateGameplayWithMetadata() in GameInteractor
    - Uses InputSchemaParser to extract actions/axes from metadata
    - Prioritizes critical actions/axes from testingStrategy
    - Maps key names to Stagehand key codes (w → KeyW, etc.)
    - Falls back to generic inputs when metadata missing or no keys found
    - Uses testingStrategy.interactionDuration (defaults to 30000ms)
  - Updated main.ts to handle metadata
    - Extracts metadata from request (handles both metadata and deprecated inputSchema)
    - Uses testingStrategy.waitBeforeInteraction and interactionDuration
    - Passes metadata to GameInteractor and VisionAnalyzer
  - Enhanced vision prompts with metadata context
    - Adds game genre and expected controls to prompt
    - Helps vision model understand what controls to look for
  - Updated tests: 70 tests passing (38 unit + 32 integration)
    - 10 new tests for simulateGameplayWithMetadata()
    - 4 new tests for metadata integration
    - Backwards compatibility verified
  - Ready for I5.3 (Screenshot Capturer enhancements)
- [x] I5.3: Complete Screenshot Capturer (1-2 hours) ✅ COMPLETE (Nov 5, 2025)
  - Implemented metadata-based screenshot timing in ScreenshotCapturer
    - Added captureAtOptimalTime() method that waits for loading/success indicators
    - Waits for loading indicators before initial_load screenshot
    - Waits for success indicators before after_interaction screenshot
    - Falls back gracefully if indicators timeout or metadata missing
  - Implemented parallel screenshot capture
    - Added captureAll() method for capturing multiple screenshots simultaneously
    - Uses Promise.allSettled() to handle partial failures gracefully
    - Returns array of successfully captured screenshots
  - Implemented cleanup logic in FileManager
    - Updated cleanup() to delete session directories when flag enabled
    - Uses fs/promises.rm with recursive deletion
    - Handles missing directories and errors gracefully
  - Integrated into main.ts
    - Uses captureAtOptimalTime() for initial and after_interaction screenshots when metadata available
    - Calls cleanup() at end of test if ENABLE_SCREENSHOT_CLEANUP flag enabled
    - Maintains backwards compatibility (works without metadata)
  - Updated tests: 12 new tests passing (8 unit + 4 integration)
    - Tests for captureAtOptimalTime() with metadata
    - Tests for captureAll() parallel capture
    - Tests for FileManager cleanup functionality
    - Integration tests for metadata timing in main.ts
  - All 72 related tests passing (no regressions)
  - Ready for I5.4 (CLI and Lambda Interfaces)
- [ ] I5.4: Implement CLI and Lambda Interfaces (2-3 hours)
- [ ] I5.5: Comprehensive Testing & Validation (4-6 hours)
- [ ] I5.6: Documentation & Deployment Prep (3-4 hours)

### Bug Fixes (Post-Iteration 4)
**Status**: ✅ Complete (Nov 5, 2025)
**Progress**: 2/2 issues fixed

- [x] **Fix #1**: Agent skips HTML button detection for hybrid canvas+HTML games ✅ FIXED
  - Added DOM selection as Strategy 1 (before natural language and vision)
  - 10 common selectors for start/play buttons
  - Performance: instant vs. 3-5s for vision API
  - Cost: $0.00 vs. ~$0.01 per vision call
- [x] **Fix #2**: Vision reports incorrect coordinates for start buttons ✅ FIXED
  - Enhanced FIND_CLICKABLE_ELEMENTS_PROMPT with accuracy guidance
  - Added concrete examples with specific pixel measurements
  - Version bump: 1.0.0 → 1.1.0
  - Tested with Pacman game (funhtml5games.com/pacman)

---

## Completed Foundation (Phases 0-2)

### Phase 0: Project Setup & Configuration
**Status**: ✅ Complete
**Progress**: 4/4 tasks

- [x] P0.1: Initialize Project Structure
- [x] P0.2: Install Dependencies
- [x] P0.3: Configure TypeScript
- [x] P0.4: Environment Configuration

### Phase 1: Type Definitions & Configuration
**Status**: ✅ Complete (with enhancements)
**Progress**: 3/3 tasks + InputSchema enhancement

- [x] P1.1: Define Core Types (enhanced with InputSchema)
- [x] P1.2: Create Configuration Constants
- [x] P1.3: Create Zod Schemas

### Phase 2: Utility Modules
**Status**: ✅ Complete
**Progress**: 3/3 tasks

- [x] P2.1: Create Logger Utility
- [x] P2.2: Create Timeout Utility
- [x] P2.3: Create File Manager Utility

---

## Completed Tasks Details

### Template Overlay (Pre-Phase 0)
- [x] Copy ai-project-template structure into dreamup directory
- [x] Rename memory-bank template files
- [x] Fill all memory bank files with DreamUp details

### Phase 0: Project Setup & Configuration
- [x] P0.1: Initialize Project Structure
  - Verified directory structure matches architecture.md
  - Updated `.gitignore` to exclude `output/` directory
  - Created `.gitkeep` files for output directories
  - Verified `package.json` has correct name "dreamup"
- [x] P0.2: Install Dependencies
  - Installed dev dependencies: `@types/bun`, `@types/node`, `typescript`
  - Verified all packages installed successfully with `bun install`
  - Confirmed `bun run` command works correctly
  - Note: Bun has built-in test runner (`bun:test`), so no Jest/Vitest needed
  - Note: Skipped `dotenv` as Bun automatically loads `.env` files
- [x] P0.3: Configure TypeScript
  - Verified `tsconfig.json` meets all task requirements
  - Tested TypeScript compilation with `bun build src/main.ts` - successful
  - Verified TypeScript type checking with `tsc --noEmit` - no errors
  - Existing config includes additional strict checks and path mappings
- [x] P0.4: Environment Configuration
  - Verified `.env.example` is tracked in git (already exists and committed)
  - Verified `.env` exists locally with credentials (user confirmed)
  - Updated `README.md` with comprehensive setup instructions
  - Documented environment variables, API key setup, and Bun's automatic .env loading

### Phase 1: Type Definitions & Configuration
- [x] P1.1: Define Core Types
  - Created `src/types/game-test.types.ts` with all 8 required interfaces
  - Created `src/types/config.types.ts` with all 3 required interfaces
  - Created `src/types/index.ts` to export all types
  - All types include comprehensive JSDoc comments
  - TypeScript compilation passes with no errors (`tsc --noEmit`)
  - Unit tests created and passing to verify type imports work
  - Types match architecture.md specifications
  - **Enhancement**: Added InputSchema interface (Nov 3, 2025)
    - Supports game-specific input information (javascript/semantic types)
    - Added optional inputSchema field to GameTestRequest
    - Comprehensive JSDoc documentation for actions and axes
    - Unit tests added (3 new tests, all passing, 5 total in types.test.ts)
- [x] P1.2: Create Configuration Constants
  - Created `src/config/constants.ts` with TIMEOUTS, THRESHOLDS, and PATHS objects
  - Created `src/config/feature-flags.ts` with DEFAULT_FLAGS and getFeatureFlags() function
  - Created `src/config/index.ts` to export all configuration
  - All constants support environment variable overrides
  - Feature flags load from environment variables (DEBUG, ENABLE_*)
  - All constants have comprehensive JSDoc comments
  - TypeScript compilation passes with no errors (`tsc --noEmit`)
  - Unit tests created and passing (15 tests, all passing)
  - Constants match architecture.md specifications
- [x] P1.3: Create Zod Schemas
  - Created `src/vision/schema.ts` with issueSchema, clickableElementSchema, and gameTestResultSchema
  - Exported TypeScript types via z.infer<> for all schemas
  - Added validation helpers (validateIssue, validateClickableElement, validateGameTestResult)
  - All schemas include comprehensive JSDoc comments
  - TypeScript compilation passes with no errors (`tsc --noEmit`)
  - Unit tests created and passing (25 tests, all passing)
  - Schemas match architecture.md specifications
  - **Phase 1 Complete!** All 3 tasks finished

### Phase 2: Utility Modules
- [x] P2.1: Create Logger Utility
  - Created `src/utils/logger.ts` with Logger class and LogLevel enum
  - Implemented methods: `info()`, `warn()`, `error()`, `debug()`
  - All logs output structured JSON for CloudWatch compatibility
  - Debug logs respect `enableDetailedLogging` flag from feature flags
  - Logger supports context object (module, op, correlationId)
  - Created `src/utils/index.ts` to export logger utilities
  - All code includes comprehensive JSDoc comments
  - TypeScript compilation passes with no errors (`tsc --noEmit`)
  - Unit tests created and passing (19 tests, all passing)
  - Logger matches logging guidelines and architecture.md specifications
- [x] P2.2: Create Timeout Utility
  - Created `src/utils/timeout.ts` with `withTimeout()` function and `TimeoutError` class
  - Wrapped `p-timeout` with typed helpers for promise timeout functionality
  - Supports custom error messages or default format: "Operation timed out after {milliseconds}ms"
  - Handles edge cases: Infinity timeout, zero/negative timeouts, immediate resolve/reject
  - Re-exports `TIMEOUTS` constants from config for convenience
  - Created `src/utils/index.ts` to export timeout utilities
  - All code includes comprehensive JSDoc comments
  - TypeScript compilation passes with no errors (`tsc --noEmit`)
  - Unit tests created and passing (17 tests, all passing)
  - Timeout utility matches architecture.md specifications and systemPatterns.md invariant
- [x] P2.3: Create File Manager Utility
  - Created `src/utils/file-manager.ts` with FileManager class
  - Implemented `ensureOutputDirectory()` to create directories recursively
  - Implemented `saveScreenshot()` to save PNG buffers with unique IDs (nanoid)
  - Implemented `saveReport()` to save JSON reports with indentation
  - Implemented `getScreenshotPath()` and `getReportPath()` for path generation
  - Implemented `cleanup()` as stub for future implementation
  - All file operations use PATHS constants from config (/tmp/game-qa-output)
  - Screenshots saved as PNG files with unique IDs and stage information
  - Reports saved as JSON files with proper formatting
  - Created `src/utils/index.ts` to export FileManager
  - All code includes comprehensive JSDoc comments
  - TypeScript compilation passes with no errors (`tsc --noEmit`)
  - Unit tests created and passing (23 tests, all passing)
  - FileManager matches architecture.md specifications
  - **Phase 2 Complete!** All 3 utility tasks finished

### Iteration 1: Minimal Working Agent
- [x] I1.1: Implement Browser Manager (Nov 4, 2025) ✅ COMPLETE
- [x] I1.2: Implement Minimal Main Orchestration (Nov 4, 2025) ✅ COMPLETE

### Iteration 2: Basic Interaction
- [x] I2.1: Implement Basic Game Interactor (Nov 4, 2025) ✅ COMPLETE
  - Created `src/core/game-interactor.ts` with GameInteractor class
  - Implemented `simulateKeyboardInput()` - Sends WASD, arrows, space, enter keys over duration
  - Implemented `clickAtCoordinates()` - Mouse click at pixel coordinates
  - Added comprehensive error handling with structured logging
  - All operations wrapped with timeout utilities (INTERACTION_TIMEOUT)
  - Validates coordinates are non-negative integers
  - Cycles through available keys over specified duration with 150ms delays
  - Created `src/core/index.ts` to export GameInteractor
  - Unit tests: 18 tests, all passing
  - TypeScript compilation passes
  - Follows dependency injection pattern (logger/config in constructor)
  - Uses existing Logger and timeout utilities
  - **Bug Fix** (Nov 4, 2025): Fixed keyboard/mouse input to use correct Stagehand API
    - Changed from Playwright/Puppeteer API (`page.keyboard.press()`) to Stagehand API (`page.keyPress()`)
    - Changed from `page.mouse.click(x, y)` to Stagehand's `page.click(x, y)`
    - Stagehand Page exposes keyPress() and click() directly, not via keyboard/mouse properties
    - Added error handling to continue simulation even if individual key presses fail
    - Fixed by reading Stagehand type definitions (node_modules/@browserbasehq/stagehand/dist/index.d.ts)
    - Real game test now passes keyboard input successfully
  - **Acceptance Criteria Met**: ✅ Can send keyboard inputs, ✅ Can click at coordinates, ✅ Interactions don't crash browser, ✅ Errors handled gracefully

- [x] I2.2: Implement Basic Screenshot Capturer (Nov 4, 2025) ✅ COMPLETE
  - Created `src/core/screenshot-capturer.ts` with ScreenshotCapturer class
  - Implemented `capture()` method - Takes screenshot from page, saves via FileManager
  - Supports all stage types (initial_load, after_interaction, final_state)
  - Wraps operations with timeout (SCREENSHOT_TIMEOUT)
  - Added comprehensive error handling with structured logging
  - Created `src/core/index.ts` to export ScreenshotCapturer
  - Unit tests: 9 tests, all passing
  - TypeScript compilation passes
  - Follows dependency injection pattern (logger/fileManager in constructor)
  - Uses existing Logger, FileManager, and timeout utilities
  - **Acceptance Criteria Met**: ✅ Screenshots save correctly with unique IDs, ✅ Stage information tracked, ✅ Errors handled gracefully

- [x] I2.3: Expand Main Orchestration (Nov 4, 2025) ✅ COMPLETE
  - Updated `src/main.ts` to use GameInteractor and ScreenshotCapturer
  - Integrated keyboard input simulation (30 seconds duration)
  - Captures 3 screenshots: initial_load, after_interaction, final_state
  - Returns result with all screenshot paths
  - Updated integration tests for new flow (11 tests, all passing)
  - **Acceptance Criteria Met**: ✅ Three screenshots captured, ✅ Keyboard inputs sent, ✅ No errors during interaction
  - **Iteration 2 Complete!** Ready for real game testing

### Iteration 1: Minimal Working Agent
- [x] I1.1: Implement Browser Manager (Nov 4, 2025) ✅ COMPLETE
  - Created `src/core/browser-manager.ts` with BrowserManager class
  - Implemented `initialize()` - Creates Browserbase session, connects Stagehand
  - Implemented `navigate(url)` - Navigates to URL with networkidle wait
  - Implemented `cleanup()` - Closes browser session and releases resources
  - Added comprehensive error handling with structured logging
  - All operations wrapped with timeout utilities
  - Created `src/core/index.ts` to export BrowserManager
  - Integration tests: 11 tests, all passing
  - TypeScript compilation passes
  - Follows dependency injection pattern (logger/config in constructor)
  - Uses existing Logger and timeout utilities
  - ✅ **CRITICAL FIX**: Upgraded to Stagehand v3.0.1 (Nov 4, 2025)
    - Resolved Playwright/Bun incompatibility runtime bug
    - Updated package.json to use `@browserbasehq/stagehand@3.0.1`
    - Updated code to use `stagehand.context.pages()[0]` API (v3 context API)
    - Changed Page type import to `AnyPage` from Stagehand v3 exports
    - Updated integration tests with v3 mock structure
    - All 151 tests passing, TypeScript compilation passes
    - **Bun-compatible** - ✅ Real game test verified (2048 game, screenshot captured successfully)
- [x] I1.2: Implement Minimal Main Orchestration (Nov 4, 2025)
  - Updated `src/main.ts` with `runQA()` function
  - Generate session ID using nanoid
  - Initialize BrowserManager with environment variables
  - Navigate to game URL
  - Capture screenshot using page.screenshot()
  - Save screenshot using FileManager
  - Return minimal GameTestResult (status: 'pass', score: 50 placeholder)
  - Implement CLI entry point with URL validation
  - Comprehensive error handling with try-catch-finally
  - Always cleanup browser even on errors
  - Structured logging at each step
  - Integration tests: 10 tests, all passing
  - TypeScript compilation passes
  - **Iteration 1 Complete!** Minimal working agent ready for real game testing

### Strategic Enhancements
- [x] InputSchema Support Added (Nov 3, 2025)
  - Added InputSchema interface to src/types/game-test.types.ts
  - Updated GameTestRequest with optional inputSchema field
  - Added Pattern 6 to memory-bank/systemPatterns.md
  - 3 new unit tests (all passing)
  - Enables game-specific control information for better testing
- [x] Strategic Pivot to Iterative Development (Nov 3, 2025)
  - Reorganized Phases 3-7 into 5 iterations
  - Archived original plan in task-list-waterfall-original.md
  - Created new iteration-based task-list.md
  - Updated Memory Bank documentation

---

## In Progress

**Current Task**: Iteration 5 (I5.0: Define GameMetadata Type System)
**Status**: Documentation complete, ready for implementation
**Previous Task**: ✅ I5.0 Documentation Phase complete - Architecture defined, examples created, patterns documented

---

## What's Working

### Foundation (Phase 0-2) ✅
- Project structure and configuration
- All type definitions (including InputSchema enhancement)
- Configuration constants and feature flags
- Zod schemas for validation
- Logger utility (structured JSON logging)
- Timeout utility (promise timeout handling)
- File Manager utility (screenshot/report storage)

### Test Coverage
- 59 utility tests passing (logger, timeout, file-manager)
- 25 schema validation tests passing
- 15 config tests passing
- 5 type definition tests passing (including InputSchema)
- 18 game-interactor unit tests passing
- 9 screenshot-capturer unit tests passing
- 11 browser-manager integration tests passing
- 28 main orchestration integration tests passing (updated for I3.3)
- 23 error-monitor unit tests passing
- 23 game-detector unit tests passing
- 14 vision-analyzer unit tests passing
- **Total: 230+ tests passing**
- **Type Safety**: Fixed 25 TypeScript type errors across test suite (Nov 5, 2025)
  - Bun mock system requires explicit type assertions
  - See Pattern 9 in systemPatterns.md for best practices

---

## Known Issues

None - all tests passing, TypeScript compilation clean

---

## Technical Debt

### Ready Detection for DOM Games (Low Priority)
**Current behavior**: DOM games (pure HTML/CSS/JS without canvas) trigger 60-second timeout during ready detection because they fail canvas-based signals.

**Why it works**: System safely waits full timeout to ensure game has loaded, then proceeds successfully. Game interaction and testing work correctly.

**Production improvements** (post-MVP):
1. **Add DOM-specific ready signals**:
   - Check for interactive elements (buttons, inputs, game container)
   - Check if JavaScript event listeners are attached
   - Check if game-specific classes/IDs are present
   - Check document.readyState === 'complete'
2. **Game-type-specific timeouts**:
   - DOM games: 10-15 seconds (faster load)
   - Canvas games: 60 seconds (needs rendering time)
   - Iframe games: 30 seconds (cross-origin delays)
3. **Adaptive ready detection**:
   - Use game type to select appropriate signal set
   - Require 3/4 signals from type-specific checks
   - Log which signals passed/failed for debugging

**Impact**: Low - current behavior is safe and effective. Optimization would reduce test time by ~45 seconds for DOM games.

**Validation**: Tested with 2048 (DOM game) - timeout occurs, but test completes successfully with correct results.

---

## Time Tracking

| Phase/Iteration | Estimated | Actual | Variance |
|-----------------|-----------|--------|----------|
| **Foundation (Phases 0-2)** | **12-16 hours** | **TBD** | **-** |
| Phase 0 | 3-4 hours | TBD | - |
| Phase 1 | 5-6 hours | TBD | - |
| Phase 2 | 4-6 hours | TBD | - |
| **Iterations (1-5)** | **22-29 hours** | **TBD** | **-** |
| Iteration 1 | 2-3 hours | TBD | - |
| Iteration 2 | 3-4 hours | TBD | - |
| Iteration 3 | 4-5 hours | TBD | - |
| Iteration 4 | 5-7 hours | TBD | - |
| Iteration 5 | 8-10 hours | TBD | - |
| **Ad-hoc Enhancements** | **<1 hour** | **<1 hour** | **-** |
| InputSchema Support | <1 hour | <1 hour | - |
| **Total MVP** | **34-46 hours** | **TBD** | **-** |

**Note**: Original waterfall estimate was 67-94 hours. Iterative approach reduces time through:
- Earlier testing (fewer rework cycles)
- Incremental complexity (simpler debugging)
- Focused iterations (clear scope per iteration)

**Iteration 5 Update** (Nov 5, 2025): Time increased from 6-8h to 8-10h to include I5.0 (Define GameMetadata Type System), which provides foundation for metadata-driven testing.
