# Task List: Game QA Agent (0 to 1)

## Purpose
This document provides a complete task breakdown for building the autonomous game testing agent from initial setup to production deployment. Tasks are organized by phase with clear dependencies, acceptance criteria, and effort estimates.

---

## Task Organization

### Symbols
- `[ ]` = Not started
- `[→]` = In progress
- `[✓]` = Complete
- `[!]` = Blocked

### Effort Estimates
- **XS**: < 1 hour
- **S**: 1-2 hours
- **M**: 2-4 hours
- **L**: 4-8 hours
- **XL**: 8+ hours

---

## Phase 0: Project Setup & Configuration

### P0.1: Initialize Project Structure
**Effort**: S (1-2 hours)  
**Dependencies**: None  
**Status**: `[ ]`

**Tasks**:
- [ ] Create project directory: `mkdir game-qa-agent && cd game-qa-agent`
- [ ] Initialize Bun project: `bun init`
- [ ] Create directory structure as per architecture.md
  ```bash
  mkdir -p src/{core,vision,utils,config,types}
  mkdir -p tests/{fixtures,integration,unit}
  mkdir -p output/screenshots output/reports
  ```
- [ ] Create `.gitignore` with:
  - `node_modules/`
  - `output/`
  - `.env`
  - `*.log`
  - `.DS_Store`
- [ ] Create `output/.gitkeep` to preserve directory in git

**Acceptance Criteria**:
- [ ] All directories created
- [ ] `package.json` exists with correct name
- [ ] `.gitignore` properly excludes sensitive files

---

### P0.2: Install Dependencies
**Effort**: XS (30 min)  
**Dependencies**: P0.1  
**Status**: `[ ]`

**Tasks**:
- [ ] Install core dependencies:
  ```bash
  bun add @browserbasehq/sdk @browserbasehq/stagehand
  bun add ai @ai-sdk/openai
  bun add zod dotenv nanoid p-timeout
  ```
- [ ] Install dev dependencies:
  ```bash
  bun add -d @types/bun @types/node typescript
  ```
  **Note**: Bun has a built-in test runner, so no additional testing framework (Jest, Vitest) is needed. Use `bun:test` for test imports.
- [ ] Verify installations: `bun install`

**Acceptance Criteria**:
- [ ] All packages in `package.json`
- [ ] No installation errors
- [ ] `bun run` command available

---

### P0.3: Configure TypeScript
**Effort**: XS (30 min)  
**Dependencies**: P0.2  
**Status**: `[ ]`

**Tasks**:
- [ ] Create `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "ESNext",
      "lib": ["ES2022"],
      "moduleResolution": "bundler",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "resolveJsonModule": true,
      "isolatedModules": true,
      "outDir": "./dist",
      "rootDir": "./src",
      "types": ["bun-types"]
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist", "tests"]
  }
  ```
- [ ] Test TypeScript compilation: `bun build src/main.ts`

**Acceptance Criteria**:
- [ ] TypeScript compiles without errors
- [ ] Type checking enabled in IDE

---

### P0.4: Environment Configuration
**Effort**: XS (30 min)  
**Dependencies**: P0.3  
**Status**: `[ ]`

**Tasks**:
- [ ] Create `.env.example`:
  ```bash
  BROWSERBASE_API_KEY=bb_live_xxxxx
  BROWSERBASE_PROJECT_ID=xxxxx
  OPENAI_API_KEY=sk-xxxxx
  DEBUG=false
  ENABLE_CACHING=false
  ENABLE_PROGRESS_UPDATES=false
  ENABLE_ERROR_RECOVERY=false
  ENABLE_SCREENSHOT_CLEANUP=false
  MAX_TEST_DURATION=240000
  GAME_LOAD_TIMEOUT=60000
  INTERACTION_TIMEOUT=90000
  ```
- [ ] Create `.env` with actual credentials (gitignored)
- [ ] Document setup in README.md

**Acceptance Criteria**:
- [ ] `.env.example` committed to git
- [ ] `.env` exists locally with real credentials
- [ ] Can load environment variables with `dotenv`

---

## Phase 1: Type Definitions & Configuration

### P1.1: Define Core Types
**Effort**: M (2-3 hours)  
**Dependencies**: P0.4  
**Status**: `[ ]`

**Tasks**:
- [ ] Create `src/types/game-test.types.ts`
  - [ ] Define `GameTestRequest` interface
  - [ ] Define `GameTestResult` interface
  - [ ] Define `TestConfig` interface
  - [ ] Define `Issue` interface
  - [ ] Define `TestMetadata` interface
  - [ ] Define `ClickableElement` interface
  - [ ] Define `Screenshot` interface
  - [ ] Define `ConsoleError` interface
- [ ] Create `src/types/config.types.ts`
  - [ ] Define `FeatureFlags` interface
  - [ ] Define `Timeouts` interface
  - [ ] Define `Thresholds` interface
- [ ] Export all types from `src/types/index.ts`

**Acceptance Criteria**:
- [ ] All types defined with JSDoc comments
- [ ] Types compile without errors
- [ ] Can import types in other modules

---

### P1.2: Create Configuration Constants
**Effort**: S (1 hour)  
**Dependencies**: P1.1  
**Status**: `[ ]`

**Tasks**:
- [ ] Create `src/config/constants.ts`
  - [ ] Define `TIMEOUTS` object
  - [ ] Define `THRESHOLDS` object
  - [ ] Define `PATHS` object
  - [ ] Add environment variable overrides
- [ ] Create `src/config/feature-flags.ts`
  - [ ] Define `DEFAULT_FLAGS` constant
  - [ ] Implement `getFeatureFlags()` function
  - [ ] Add environment variable parsing
- [ ] Export all from `src/config/index.ts`

**Acceptance Criteria**:
- [ ] Constants can be imported and used
- [ ] Feature flags load from environment
- [ ] Timeouts can be overridden via env vars

---

### P1.3: Create Zod Schemas
**Effort**: M (2 hours)  
**Dependencies**: P1.1  
**Status**: `[ ]`

**Tasks**:
- [ ] Create `src/vision/schema.ts`
  - [ ] Define `issueSchema` with Zod
  - [ ] Define `gameTestResultSchema` with Zod
  - [ ] Export TypeScript types via `z.infer<>`
  - [ ] Add schema validation helpers
- [ ] Write unit tests for schema validation
  - [ ] Test valid inputs pass
  - [ ] Test invalid inputs fail with clear errors

**Acceptance Criteria**:
- [ ] Schemas validate correctly
- [ ] TypeScript types match runtime schemas
- [ ] Tests pass for valid/invalid data

---

## Phase 2: Utility Modules

### P2.1: Create Logger Utility
**Effort**: S (1-2 hours)  
**Dependencies**: P1.2  
**Status**: `[ ]`

**Tasks**:
- [ ] Create `src/utils/logger.ts`
  - [ ] Define `LogLevel` enum
  - [ ] Implement `Logger` class
  - [ ] Add methods: `info()`, `warn()`, `error()`, `debug()`
  - [ ] Format logs as JSON for CloudWatch
  - [ ] Add context object support
  - [ ] Respect DEBUG flag from feature flags
- [ ] Write unit tests for logger

**Acceptance Criteria**:
- [ ] Logs output structured JSON
- [ ] Debug logs only show when enabled
- [ ] Logger can be instantiated with context

---

### P2.2: Create Timeout Utility
**Effort**: S (1 hour)  
**Dependencies**: P1.2  
**Status**: `[ ]`

**Tasks**:
- [ ] Create `src/utils/timeout.ts`
  - [ ] Wrap `p-timeout` with typed helpers
  - [ ] Add `withTimeout()` function
  - [ ] Add custom timeout error messages
  - [ ] Export timeout constants
- [ ] Write unit tests for timeout utility

**Acceptance Criteria**:
- [ ] Timeouts work correctly
- [ ] Custom error messages appear
- [ ] Tests verify timeout behavior

---

### P2.3: Create File Manager Utility
**Effort**: M (2-3 hours)  
**Dependencies**: P1.2  
**Status**: `[ ]`

**Tasks**:
- [ ] Create `src/utils/file-manager.ts`
  - [ ] Implement `FileManager` class
  - [ ] Add `ensureOutputDirectory()` method
  - [ ] Add `saveScreenshot()` method (save PNG to /tmp)
  - [ ] Add `saveReport()` method (save JSON to /tmp)
  - [ ] Add `getScreenshotPath()` method
  - [ ] Add `cleanup()` method (stub for future)
- [ ] Write unit tests for file operations

**Acceptance Criteria**:
- [ ] Can create output directories
- [ ] Screenshots save correctly as PNG files
- [ ] Reports save correctly as JSON files
- [ ] Paths are correctly generated

---

## Phase 3: Core Browser Automation

### P3.1: Implement Browser Manager
**Effort**: M (3-4 hours)  
**Dependencies**: P2.1, P2.2  
**Status**: `[ ]`

**Tasks**:
- [ ] Create `src/core/browser-manager.ts`
  - [ ] Implement `BrowserManager` class
  - [ ] Add `initialize()` method
    - [ ] Create Browserbase session
    - [ ] Connect Stagehand to session
    - [ ] Return Stagehand page instance
  - [ ] Add `navigate(url)` method
    - [ ] Navigate to URL with timeout
    - [ ] Wait for networkidle
  - [ ] Add `cleanup()` method
    - [ ] Close browser session
    - [ ] Clean up resources
  - [ ] Add error handling for all methods
- [ ] Write integration tests with mock Browserbase

**Acceptance Criteria**:
- [ ] Browser initializes successfully
- [ ] Can navigate to URLs
- [ ] Cleanup releases resources
- [ ] Errors are caught and logged

---

### P3.2: Implement Game Detector
**Effort**: L (5-6 hours)  
**Dependencies**: P3.1  
**Status**: `[ ]`

**Tasks**:
- [ ] Create `src/core/game-detector.ts`
  - [ ] Define `GameType` enum (CANVAS, IFRAME, DOM, UNKNOWN)
  - [ ] Implement `GameDetector` class
  - [ ] Add `detectType(page)` method
    - [ ] Check for canvas elements
    - [ ] Check for iframes
    - [ ] Check for game-related DOM patterns
    - [ ] Return detected type
  - [ ] Add `waitForGameReady(page, timeout)` method
    - [ ] Multi-signal detection:
      - [ ] Canvas exists
      - [ ] Canvas is rendering (not blank)
      - [ ] Network is idle
      - [ ] No loading text visible
    - [ ] Poll signals with 1s interval
    - [ ] Return true if 3/4 signals pass
  - [ ] Add `isCanvasRendering(page)` helper
  - [ ] Add `detectIframe(page)` helper
- [ ] Write unit tests with mocked pages

**Acceptance Criteria**:
- [ ] Correctly detects canvas games
- [ ] Correctly detects iframe games
- [ ] Waits for game ready state
- [ ] Timeouts work correctly
- [ ] Tests cover all game types

---

### P3.3: Implement Error Monitor
**Effort**: M (2-3 hours)  
**Dependencies**: P3.1  
**Status**: `[ ]`

**Tasks**:
- [ ] Create `src/core/error-monitor.ts`
  - [ ] Implement `ErrorMonitor` class
  - [ ] Add `startMonitoring(page)` method
    - [ ] Listen to console errors
    - [ ] Listen to console warnings
    - [ ] Store errors in array
  - [ ] Add `getErrors()` method
  - [ ] Add `hasErrors()` method
  - [ ] Add `hasCriticalError()` method (JS errors, crashes)
  - [ ] Add `stopMonitoring()` method
- [ ] Write unit tests with mock console events

**Acceptance Criteria**:
- [ ] Captures console errors
- [ ] Captures console warnings
- [ ] Can retrieve all errors
- [ ] Correctly identifies critical errors
- [ ] Tests verify error capture

---

### P3.4: Implement Screenshot Capturer
**Effort**: M (2-3 hours)  
**Dependencies**: P2.3, P3.1  
**Status**: `[ ]`

**Tasks**:
- [ ] Create `src/core/screenshot-capturer.ts`
  - [ ] Implement `ScreenshotCapturer` class
  - [ ] Add `capture(page, stage)` method
    - [ ] Take full-page screenshot
    - [ ] Generate unique ID (nanoid)
    - [ ] Save to output directory
    - [ ] Return Screenshot object
  - [ ] Add `captureAll(page, stages)` method
    - [ ] Capture multiple screenshots in parallel
    - [ ] Return array of Screenshot objects
  - [ ] Add error handling for screenshot failures
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Screenshots save correctly
- [ ] Unique IDs generated
- [ ] Parallel capture works
- [ ] Errors handled gracefully
- [ ] Tests verify screenshot creation

---

### P3.5: Implement Game Interactor
**Effort**: L (6-8 hours)  
**Dependencies**: P3.2, P3.4  
**Status**: `[ ]`

**Tasks**:
- [ ] Create `src/core/game-interactor.ts`
  - [ ] Implement `GameInteractor` class
  - [ ] Add `findAndClickStart(page)` method
    - [ ] Strategy 1: Try Stagehand natural language
      - [ ] `page.act("click the start button")`
      - [ ] `page.act("click the play button")`
    - [ ] Strategy 2: Fallback to vision-based detection
      - [ ] Take screenshot
      - [ ] Ask GPT-4V to find start button
      - [ ] Click at returned coordinates
    - [ ] Return success boolean
  - [ ] Add `simulateGameplay(page, duration)` method
    - [ ] Detect game type (canvas vs DOM)
    - [ ] For canvas: simulate keyboard/mouse events
      - [ ] Arrow keys (up, down, left, right)
      - [ ] Spacebar
      - [ ] Mouse clicks at random coordinates
    - [ ] For DOM: use Stagehand to interact
    - [ ] Run for specified duration
  - [ ] Add `clickAtCoordinates(page, x, y)` helper
  - [ ] Add error handling for interaction failures
- [ ] Write integration tests with test games

**Acceptance Criteria**:
- [ ] Can find and click start buttons
- [ ] Can simulate keyboard inputs
- [ ] Can simulate mouse inputs
- [ ] Works with both canvas and DOM games
- [ ] Errors handled gracefully
- [ ] Tests verify interactions

---

## Phase 4: Vision Analysis Integration

### P4.1: Create Vision Prompts
**Effort**: M (2-3 hours)  
**Dependencies**: P1.3  
**Status**: `[ ]`

**Tasks**:
- [ ] Create `src/vision/prompts.ts`
  - [ ] Define `GAME_ANALYSIS` prompt
    ```typescript
    You are analyzing a sequence of screenshots from a browser game test.
    
    Screenshot 1: Initial game load
    Screenshot 2: After user interaction
    Screenshot 3: Final game state
    
    Evaluate:
    1. Did the game load successfully? (no error screens, no blank canvas)
    2. Are controls responsive? (did the game respond to interactions?)
    3. Did the game run without crashes? (no frozen screens, error messages)
    4. Overall playability score (0-100)
    
    Identify any issues with severity levels:
    - critical: Game doesn't load, crashes immediately, unplayable
    - major: Significant bugs, poor performance, broken features
    - minor: Small UI issues, cosmetic problems
    
    Return structured data matching the schema.
    ```
  - [ ] Define `FIND_START_BUTTON` prompt
  - [ ] Define `DETECT_CRASH` prompt
  - [ ] Add prompt versioning/tracking

**Acceptance Criteria**:
- [ ] Prompts are clear and specific
- [ ] Prompts reference the schema
- [ ] Prompts include examples (few-shot)
- [ ] Prompts are exported and reusable

---

### P4.2: Implement Vision Analyzer
**Effort**: L (4-6 hours)  
**Dependencies**: P4.1, P1.3  
**Status**: `[ ]`

**Tasks**:
- [ ] Create `src/vision/analyzer.ts`
  - [ ] Implement `VisionAnalyzer` class
  - [ ] Add `constructor()` - initialize OpenAI client
  - [ ] Add `analyzeScreenshots(screenshots)` method
    - [ ] Load screenshots from disk
    - [ ] Convert to base64
    - [ ] Build multi-modal prompt
    - [ ] Call `generateObject()` with schema
    - [ ] Return parsed GameTestResult
  - [ ] Add `findClickableElements(screenshot)` method
    - [ ] Use FIND_START_BUTTON prompt
    - [ ] Return array of ClickableElement objects
  - [ ] Add `detectCrash(screenshot)` method
    - [ ] Use DETECT_CRASH prompt
    - [ ] Return boolean
  - [ ] Add error handling for API failures
  - [ ] Add token counting/logging
- [ ] Write integration tests with OpenAI API (or mocks)

**Acceptance Criteria**:
- [ ] Can analyze multiple screenshots
- [ ] Returns valid GameTestResult
- [ ] Can find clickable elements
- [ ] Can detect crashes
- [ ] Handles API errors gracefully
- [ ] Tests verify vision analysis

---

## Phase 5: Main Orchestration

### P5.1: Implement Main QA Function
**Effort**: L (5-7 hours)  
**Dependencies**: P3.5, P4.2  
**Status**: `[ ]`

**Tasks**:
- [ ] Create `src/main.ts`
  - [ ] Import all core modules
  - [ ] Implement `runQA(gameUrl, config?)` function
    - [ ] Generate session ID
    - [ ] Initialize browser manager
    - [ ] Setup error monitor
    - [ ] Navigate to game URL
    - [ ] Detect game type
    - [ ] Wait for game ready
    - [ ] Capture initial screenshot
    - [ ] Find and click start button
    - [ ] Simulate gameplay
    - [ ] Capture interaction screenshots
    - [ ] Analyze with vision
    - [ ] Enrich result with metadata
    - [ ] Save report to /tmp
    - [ ] Cleanup browser
    - [ ] Return result
  - [ ] Add comprehensive error handling
  - [ ] Add timeout wrapper for entire test
  - [ ] Add logging at each step
- [ ] Write integration tests with real games

**Acceptance Criteria**:
- [ ] Full end-to-end test works
- [ ] Returns valid GameTestResult
- [ ] Saves screenshots and report
- [ ] Completes within timeout
- [ ] Handles errors gracefully
- [ ] Tests verify full flow

---

### P5.2: Implement CLI Interface
**Effort**: M (2-3 hours)  
**Dependencies**: P5.1  
**Status**: `[ ]`

**Tasks**:
- [ ] Add CLI entry point to `src/main.ts`
  - [ ] Check if running as CLI (`if (import.meta.main)`)
  - [ ] Parse command line arguments
    - [ ] `bun run src/main.ts <game-url>`
  - [ ] Call `runQA()` with URL
  - [ ] Print formatted results to console
  - [ ] Exit with appropriate code (0 = pass, 1 = fail/error)
- [ ] Add package.json scripts:
  ```json
  {
    "scripts": {
      "qa": "bun run src/main.ts",
      "test": "bun test"
    }
  }
  ```
- [ ] Test CLI with sample games

**Acceptance Criteria**:
- [ ] Can run: `bun run qa https://example.com/game`
- [ ] Prints readable output
- [ ] Exit codes work correctly
- [ ] Help text available

---

### P5.3: Implement Lambda Handler
**Effort**: M (2-3 hours)  
**Dependencies**: P5.1  
**Status**: `[ ]`

**Tasks**:
- [ ] Add Lambda handler to `src/main.ts`
  - [ ] Export `handler` function
  - [ ] Parse Lambda event
    ```typescript
    interface LambdaEvent {
      gameUrl: string;
      config?: Partial<TestConfig>;
    }
    ```
  - [ ] Call `runQA()` with event data
  - [ ] Return formatted response
    ```typescript
    {
      statusCode: 200,
      body: JSON.stringify(result)
    }
    ```
  - [ ] Add error handling for Lambda context
- [ ] Create Lambda deployment package script
- [ ] Test locally with Lambda emulator (if available)

**Acceptance Criteria**:
- [ ] Lambda handler exports correctly
- [ ] Handles Lambda events
- [ ] Returns proper Lambda response
- [ ] Can be packaged for deployment

---

## Phase 6: Testing & Validation

### P6.1: Create Test Fixtures
**Effort**: S (1-2 hours)  
**Dependencies**: None  
**Status**: `[ ]`

**Tasks**:
- [ ] Create `tests/fixtures/sample-games.ts`
  - [ ] Add URLs for test games:
    - [ ] Simple puzzle game (tic-tac-toe, etc.)
    - [ ] Simple platformer (if available)
    - [ ] Canvas-based game
    - [ ] iFrame-embedded game
  - [ ] Add expected test results for each
- [ ] Document test games in README

**Acceptance Criteria**:
- [ ] At least 3 test game URLs
- [ ] Games are publicly accessible
- [ ] Expected results documented

---

### P6.2: Write Unit Tests
**Effort**: L (6-8 hours)  
**Dependencies**: All implementation tasks  
**Status**: `[ ]`

**Tasks**:
- [ ] Write unit tests for all utilities
  - [ ] Logger tests
  - [ ] Timeout tests
  - [ ] File manager tests
- [ ] Write unit tests for core modules
  - [ ] Game detector tests
  - [ ] Error monitor tests
  - [ ] Screenshot capturer tests
- [ ] Write unit tests for vision module
  - [ ] Schema validation tests
  - [ ] Prompt tests
- [ ] Achieve >70% code coverage

**Acceptance Criteria**:
- [ ] All unit tests pass
- [ ] Coverage >70%
- [ ] Tests run with `bun test`

---

### P6.3: Write Integration Tests
**Effort**: L (6-8 hours)  
**Dependencies**: P6.1, P5.1  
**Status**: `[ ]`

**Tasks**:
- [ ] Create `tests/integration/qa-agent.test.ts`
  - [ ] Test full flow with simple game
  - [ ] Test canvas game detection
  - [ ] Test iframe game detection
  - [ ] Test error handling (invalid URL)
  - [ ] Test timeout scenarios
  - [ ] Test vision analysis accuracy
- [ ] Run integration tests against real Browserbase/OpenAI
- [ ] Document test environment setup

**Acceptance Criteria**:
- [ ] All integration tests pass
- [ ] Tests complete within reasonable time
- [ ] Tests verify end-to-end functionality

---

### P6.4: Manual Testing & Validation
**Effort**: M (3-4 hours)  
**Dependencies**: P6.3  
**Status**: `[ ]`

**Tasks**:
- [ ] Test with 10+ different games manually
- [ ] Verify screenshot quality
- [ ] Verify vision analysis accuracy
- [ ] Test edge cases:
  - [ ] Very slow loading games
  - [ ] Games with splash screens
  - [ ] Games with multiple start buttons
  - [ ] Games that crash intentionally
- [ ] Document any issues found

**Acceptance Criteria**:
- [ ] 80%+ accuracy on test games
- [ ] No false positives (passing broken games)
- [ ] Edge cases handled correctly

---

## Phase 7: Documentation & Deployment

### P7.1: Write Documentation
**Effort**: M (3-4 hours)  
**Dependencies**: P6.4  
**Status**: `[ ]`

**Tasks**:
- [ ] Update README.md with:
  - [ ] Project overview
  - [ ] Installation instructions
  - [ ] Usage examples (CLI and Lambda)
  - [ ] Configuration guide
  - [ ] Architecture overview (link to architecture.md)
  - [ ] Troubleshooting section
- [ ] Create CONTRIBUTING.md
- [ ] Create API.md documenting interfaces
- [ ] Add inline JSDoc comments to all public APIs

**Acceptance Criteria**:
- [ ] README is comprehensive
- [ ] All setup steps documented
- [ ] Code has JSDoc comments

---

### P7.2: Prepare Lambda Deployment
**Effort**: M (3-4 hours)  
**Dependencies**: P5.3  
**Status**: `[ ]`

**Tasks**:
- [ ] Create deployment package script
  - [ ] Bundle code with dependencies
  - [ ] Include Bun runtime layer
  - [ ] Create ZIP for Lambda upload
- [ ] Create Lambda configuration template
  - [ ] IAM roles and permissions
  - [ ] Environment variables
  - [ ] Timeout and memory settings
- [ ] Document deployment process
- [ ] Test deployment to AWS (if access available)

**Acceptance Criteria**:
- [ ] Deployment package builds successfully
- [ ] Lambda configuration documented
- [ ] Deployment process documented

---

### P7.3: Performance Optimization
**Effort**: M (2-4 hours)  
**Dependencies**: P6.4  
**Status**: `[ ]`

**Tasks**:
- [ ] Profile test execution times
- [ ] Optimize screenshot capture (resolution, format)
- [ ] Optimize vision prompts (reduce tokens)
- [ ] Implement parallel operations where possible
- [ ] Tune timeout values based on real data
- [ ] Document performance characteristics

**Acceptance Criteria**:
- [ ] Tests complete in <4 minutes average
- [ ] Vision API costs <$0.05 per test
- [ ] No unnecessary delays

---

### P7.4: Security Review
**Effort**: S (1-2 hours)  
**Dependencies**: P7.2  
**Status**: `[ ]`

**Tasks**:
- [ ] Review environment variable handling
- [ ] Ensure credentials never logged
- [ ] Review screenshot data (PII concerns)
- [ ] Add input validation for game URLs
- [ ] Review Lambda permissions (least privilege)
- [ ] Document security considerations

**Acceptance Criteria**:
- [ ] No credentials in logs
- [ ] URL validation prevents SSRF
- [ ] Lambda has minimal permissions

---

## Phase 8: Future Enhancements (Post-MVP)

### P8.1: Implement Caching System
**Effort**: L (6-8 hours)  
**Status**: `[ ]` (Future)

**Tasks**:
- [ ] Design cache key strategy (URL + version hash)
- [ ] Implement cache storage (DynamoDB or Redis)
- [ ] Add cache lookup in main flow
- [ ] Add TTL configuration
- [ ] Add cache invalidation endpoint

---

### P8.2: Implement Progress Streaming
**Effort**: M (4-6 hours)  
**Status**: `[ ]` (Future)

**Tasks**:
- [ ] Design progress event schema
- [ ] Implement EventBridge/WebSocket publisher
- [ ] Add progress updates throughout test flow
- [ ] Create client example for receiving updates

---

### P8.3: Implement Error Recovery
**Effort**: L (6-8 hours)  
**Status**: `[ ]` (Future)

**Tasks**:
- [ ] Design retry strategy (exponential backoff)
- [ ] Implement page reload on errors
- [ ] Add retry limit configuration
- [ ] Add telemetry for retry effectiveness

---

### P8.4: Implement Screenshot Cleanup
**Effort**: S (1-2 hours)  
**Status**: `[ ]` (Future)

**Tasks**:
- [ ] Add cleanup logic to FileManager
- [ ] Implement conditional cleanup based on flag
- [ ] Optionally upload to S3 before deletion
- [ ] Add cleanup to Lambda lifecycle

---

## Summary

### Total Effort Estimate
- **Phase 0**: 3-4 hours (Setup)
- **Phase 1**: 5-6 hours (Types & Config)
- **Phase 2**: 4-6 hours (Utilities)
- **Phase 3**: 15-20 hours (Core Automation)
- **Phase 4**: 6-9 hours (Vision Integration)
- **Phase 5**: 9-13 hours (Orchestration)
- **Phase 6**: 16-22 hours (Testing)
- **Phase 7**: 9-14 hours (Documentation & Deployment)

**Total MVP**: 67-94 hours (~2-3 weeks for 1 developer)

### Critical Path
```
P0 (Setup) → P1 (Types) → P2 (Utils) → P3 (Browser) → P4 (Vision) → P5 (Main) → P6 (Testing) → P7 (Deploy)
```

### Milestone Checkpoints

**Milestone 1: Foundation Complete** (After P2)
- [ ] Project structure ready
- [ ] All types defined
- [ ] Utilities working

**Milestone 2: Core Features Complete** (After P4)
- [ ] Browser automation working
- [ ] Vision analysis working
- [ ] Can detect and interact with games

**Milestone 3: MVP Complete** (After P6)
- [ ] Full end-to-end flow working
- [ ] Tests passing
- [ ] Ready for manual testing

**Milestone 4: Production Ready** (After P7)
- [ ] Documentation complete
- [ ] Lambda deployment ready
- [ ] Performance optimized

---

## Development Tips

### Getting Started
1. Complete Phase 0 in one sitting (setup)
2. Implement types before any logic (Phase 1)
3. Build utilities first (Phase 2)
4. Test each module in isolation before integration

### Testing Strategy
- Write unit tests alongside implementation
- Use TDD for complex logic (game detection, vision analysis)
- Test with real games early and often
- Keep integration tests fast (use mocks where possible)

### Common Pitfalls
- Don't skip type definitions - they save time later
- Test timeout logic thoroughly - Lambda has hard limits
- Vision prompts require iteration - start simple
- Screenshot quality affects analysis - don't over-compress

### When Stuck
1. Check architecture.md for design patterns
2. Review technical-concerns.md for known issues
3. Reference required-reading.md for documentation
4. Test with simplified games first

---

## AI Agent Consumption Notes

This task list is designed for:
- **Sequential execution** - tasks build on previous tasks
- **Clear acceptance criteria** - know when task is done
- **Effort estimates** - plan time allocation
- **Dependency tracking** - understand blockers
- **Incremental validation** - test as you build

When implementing:
1. Follow phases in order (don't skip ahead)
2. Mark tasks complete as you go
3. Run tests after each phase
4. Update effort estimates based on actual time
5. Document any deviations from plan
