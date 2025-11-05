# Architecture Document

## Purpose
This document defines the technical architecture, tech stack, directory structure, and design patterns for the autonomous game testing agent. All decisions are optimized for Lambda deployment with TypeScript/Bun runtime.

---

## System Overview

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     AWS Lambda Function                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Game Testing Agent (main.ts)               │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │   Browser   │  │   Vision    │  │   Reporter   │  │  │
│  │  │   Manager   │  │   Analyzer  │  │              │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘  │  │
│  └─────────┼────────────────┼────────────────┼──────────┘  │
│            │                │                │              │
└────────────┼────────────────┼────────────────┼──────────────┘
             │                │                │
             ▼                ▼                ▼
    ┌────────────────┐  ┌──────────┐  ┌──────────────┐
    │  Browserbase   │  │  OpenAI  │  │  /tmp/output │
    │   (Stagehand)  │  │  GPT-4V  │  │  (Local FS)  │
    └────────────────┘  └──────────┘  └──────────────┘
```

### Request Flow
```
1. Lambda invoked with game URL (optionally with metadata)
2. Initialize Browserbase session with Stagehand
3. Navigate to game URL
4. Detect game type (canvas/iframe/DOM)
5. Wait for game ready state (multi-signal detection)
6. Capture baseline screenshot
7. Execute interaction sequence
   - Find start button (vision or DOM)
   - Click to start game
   - Simulate gameplay inputs (using metadata if provided)
   - Capture interaction screenshots
8. Monitor for errors/crashes
9. Capture final state screenshot
10. Analyze all screenshots with GPT-4 Vision (using metadata context)
11. Generate structured JSON report
12. Save screenshots and report to /tmp
13. Return report to caller
14. Cleanup: Close browser session
```

---

## Game Metadata System

### Overview

The agent supports comprehensive game metadata to improve testing accuracy and efficiency. Metadata includes input controls, testing hints, and strategy recommendations.

### Metadata Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     Metadata Sources                            │
├────────────────────┬───────────────────────────────────────────┤
│                    │                                            │
│  Option A          │  Option C (Future)                        │
│  Static Files      │  Scan Agent                               │
│  (JSON)            │  (Dynamic)                                │
│                    │                                            │
└─────────┬──────────┴──────────────┬─────────────────────────────┘
          │                         │
          └──────────┬──────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │   GameMetadata       │
          │   ┌────────────────┐ │
          │   │ InputSchema    │ │ ← Actions + Axes + Keys
          │   │ Genre          │ │ ← Context
          │   │ Indicators     │ │ ← Loading/Success hints
          │   │ Strategy       │ │ ← Timing + Priorities
          │   └────────────────┘ │
          └──────────┬───────────┘
                     │
          ┌──────────┴───────────┐
          │                      │
          ▼                      ▼
┌──────────────────┐   ┌──────────────────────┐
│ InputSchema      │   │ GameDetector         │
│ Parser           │   │ (uses indicators)    │
│ (I5.1)           │   │                      │
└────────┬─────────┘   └──────────────────────┘
         │
         ▼
┌──────────────────────┐
│ GameInteractor       │
│ (uses parsed inputs) │
│ (I5.2)               │
└──────────────────────┘
```

### Metadata Schema

**Complete type definitions**: See `src/types/game-test.types.ts`

**Core Interfaces**:
- `GameMetadata` - Top-level container for all metadata
- `InputSchema` - Input controls (actions + axes with key bindings)
- `InputAction` - Discrete button events (e.g., Jump, Pause)
- `InputAxis` - Continuous inputs returning -1 to 1 (e.g., MoveHorizontal)
- `LoadingIndicator` - Hints for GameDetector ready state detection
- `SuccessIndicator` - Hints for VisionAnalyzer validation
- `TestingStrategy` - Timing, priorities, and instructions

### Metadata Flow in Request

```typescript
// Option 1: Provide metadata directly
const request: GameTestRequest = {
  gameUrl: 'https://example.com/pong',
  metadata: {
    inputSchema: { /* ... */ },
    genre: 'arcade',
    testingStrategy: { /* ... */ }
  }
};

// Option 2: Load from file (CLI)
// $ bun run src/main.ts https://example.com/pong --metadata ./pong/metadata.json

// Option 3: Backwards compatible (deprecated)
const request: GameTestRequest = {
  gameUrl: 'https://example.com/pong',
  inputSchema: { /* ... */ } // Converted to metadata internally
};
```

### Example Metadata File

See `_game-examples/pong/metadata.json` and `_game-examples/snake/metadata.json` for complete examples.

**Minimal Example**:
```json
{
  "metadataVersion": "1.0.0",
  "genre": "arcade",
  "inputSchema": {
    "type": "javascript",
    "actions": [
      {"name": "Pause", "keys": ["Escape"]}
    ],
    "axes": [
      {"name": "MoveVertical", "keys": ["ArrowDown", "ArrowUp"]}
    ]
  },
  "testingStrategy": {
    "waitBeforeInteraction": 2000,
    "interactionDuration": 30000,
    "criticalActions": ["Pause"]
  }
}
```

### Benefits

1. **Targeted Testing**: Test specific controls instead of random inputs
2. **Faster Tests**: Skip unnecessary waiting with loading indicators
3. **Better Validation**: Check for expected success indicators
4. **Context for Vision**: Provide game genre and controls to GPT-4V
5. **Prioritization**: Test critical actions first
6. **Extensibility**: Easy to add new metadata fields in future

---

## Tech Stack

### Core Dependencies

#### Runtime & Language
```json
{
  "runtime": "bun",
  "language": "TypeScript 5.3+",
  "target": "ES2022"
}
```

**Rationale**: Bun provides native TypeScript support, fast startup, and efficient file I/O for screenshots.

#### Browser Automation
```json
{
  "browserbase": "^1.0.0",
  "stagehand": "^3.0.1"
}
```

**Rationale**: 
- Browserbase provides managed browser infrastructure (no need to bundle Chromium)
- Stagehand offers AI-native automation (natural language commands)
- Works seamlessly in Lambda environment

#### AI/LLM Framework
```json
{
  "ai": "^3.4.0",
  "@ai-sdk/openai": "^0.0.66",
  "zod": "^3.22.4"
}
```

**Rationale**:
- Vercel AI SDK simplifies OpenAI integration
- Native support for GPT-4 Vision multi-modal prompts
- Zod ensures type-safe structured outputs

#### Utilities
```json
{
  "dotenv": "^16.4.5",
  "p-timeout": "^6.1.2",
  "nanoid": "^5.0.7"
}
```

**Rationale**:
- dotenv: Environment variable management
- p-timeout: Robust timeout handling for async operations
- nanoid: Generate unique test session IDs

### Development Dependencies
```json
{
  "@types/bun": "latest",
  "@types/node": "^20.11.0",
  "typescript": "^5.3.3"
}
```

---

## Directory Structure

```
game-qa-agent/
├── src/
│   ├── main.ts                    # Entry point (CLI or Lambda handler)
│   ├── core/
│   │   ├── browser-manager.ts     # Browserbase + Stagehand initialization
│   │   ├── game-detector.ts       # Detect canvas/iframe/DOM games
│   │   ├── game-interactor.ts     # Execute interaction sequences
│   │   ├── error-monitor.ts       # Console errors, crash detection
│   │   ├── screenshot-capturer.ts # Orchestrate screenshot timing
│   │   └── input-schema-parser.ts # NEW (I5.1): Parse metadata.inputSchema
│   ├── vision/
│   │   ├── analyzer.ts            # GPT-4 Vision integration
│   │   ├── prompts.ts             # Vision prompt templates
│   │   └── schema.ts              # Zod schemas for structured output
│   ├── schemas/                   # NEW: Zod validation schemas
│   │   └── metadata.schema.ts     # NEW (I5.0): GameMetadata validation
│   ├── utils/
│   │   ├── logger.ts              # Structured logging
│   │   ├── timeout.ts             # Timeout helpers with p-timeout
│   │   └── file-manager.ts        # Screenshot saving to /tmp
│   ├── config/
│   │   ├── constants.ts           # Timeout values, thresholds
│   │   └── feature-flags.ts       # Future feature toggles
│   └── types/
│       ├── game-test.types.ts     # UPDATED (I5.0): +GameMetadata interfaces
│       └── config.types.ts        # Configuration interfaces
├── _game-examples/                # NEW: Example games with metadata
│   ├── pong/
│   │   ├── game.js
│   │   ├── game.xml
│   │   ├── index.html
│   │   └── metadata.json          # NEW (I5.0): Static metadata
│   └── snake/
│       ├── game.js
│       ├── game.xml
│       ├── index.html
│       └── metadata.json          # NEW (I5.0): Static metadata
├── output/                        # Local dev output (gitignored)
│   └── .gitkeep
├── tests/
│   ├── fixtures/
│   │   └── sample-games.ts        # Test game URLs
│   └── integration/
│       └── qa-agent.test.ts       # Integration tests
├── .env.example                   # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

### File Responsibilities

#### `src/main.ts`
- Export Lambda handler: `export const handler = async (event) => { ... }`
- Export CLI function: `export async function runQA(gameUrl: string) => { ... }`
- Entry point detection (Lambda vs CLI)
- Top-level error handling and logging

#### `src/core/browser-manager.ts`
```typescript
export class BrowserManager {
  async initialize(): Promise<StagehandPage>;
  async navigate(url: string): Promise<void>;
  async cleanup(): Promise<void>;
  // Manages Browserbase session lifecycle
}
```

#### `src/core/game-detector.ts`
```typescript
export enum GameType {
  CANVAS = 'canvas',
  IFRAME = 'iframe',
  DOM = 'dom',
  UNKNOWN = 'unknown'
}

export class GameDetector {
  async detectType(page: Page): Promise<GameType>;
  async waitForGameReady(page: Page, timeout: number): Promise<boolean>;
  // Multi-signal detection: canvas exists, pixels rendered, network idle
}
```

#### `src/core/game-interactor.ts`
```typescript
export class GameInteractor {
  async findAndClickStart(page: Page): Promise<boolean>;
  async simulateGameplay(page: Page, duration: number): Promise<void>;
  // Vision-based or DOM-based interaction strategies
}
```

#### `src/core/error-monitor.ts`
```typescript
export interface ConsoleError {
  message: string;
  timestamp: number;
  level: 'error' | 'warning';
}

export class ErrorMonitor {
  startMonitoring(page: Page): void;
  getErrors(): ConsoleError[];
  hasErrors(): boolean;
}
```

#### `src/core/screenshot-capturer.ts`
```typescript
export interface Screenshot {
  id: string;
  path: string;
  timestamp: number;
  stage: 'initial_load' | 'after_interaction' | 'final_state';
}

export class ScreenshotCapturer {
  async capture(page: Page, stage: string): Promise<Screenshot>;
  async captureAll(page: Page, stages: string[]): Promise<Screenshot[]>;
}
```

#### `src/vision/analyzer.ts`
```typescript
export class VisionAnalyzer {
  async analyzeScreenshots(screenshots: Screenshot[]): Promise<GameTestResult>;
  async findClickableElements(screenshot: Screenshot): Promise<ClickableElement[]>;
  // GPT-4 Vision API integration
}
```

#### `src/vision/prompts.ts`
```typescript
export const PROMPTS = {
  GAME_ANALYSIS: `Analyze this sequence of game screenshots...`,
  FIND_START_BUTTON: `Identify the location of the start/play button...`,
  DETECT_CRASH: `Does this screenshot show a crash or error state?...`
};
```

#### `src/vision/schema.ts`
```typescript
import { z } from 'zod';

export const gameTestResultSchema = z.object({
  status: z.enum(['pass', 'fail', 'error']),
  playability_score: z.number().min(0).max(100),
  issues: z.array(z.object({
    severity: z.enum(['critical', 'major', 'minor']),
    description: z.string(),
    timestamp: z.string()
  })),
  screenshots: z.array(z.string()),
  timestamp: z.string()
});

export type GameTestResult = z.infer<typeof gameTestResultSchema>;
```

#### `src/utils/logger.ts`
```typescript
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export class Logger {
  info(message: string, context?: object): void;
  warn(message: string, context?: object): void;
  error(message: string, error?: Error): void;
  // Structured JSON logging for Lambda CloudWatch
}
```

#### `src/config/constants.ts`
```typescript
export const TIMEOUTS = {
  MAX_TEST_DURATION: 4 * 60 * 1000,      // 4 minutes
  GAME_LOAD_TIMEOUT: 60 * 1000,           // 60 seconds
  INTERACTION_TIMEOUT: 90 * 1000,         // 90 seconds
  SCREENSHOT_TIMEOUT: 10 * 1000,          // 10 seconds
  PAGE_NAVIGATION_TIMEOUT: 30 * 1000      // 30 seconds
};

export const THRESHOLDS = {
  PLAYABILITY_PASS_SCORE: 50,             // >50% = pass
  MAX_RETRIES: 0,                         // Fail immediately (no retries)
  SCREENSHOT_COUNT: 3                     // Default: initial, mid, final
};

export const PATHS = {
  OUTPUT_DIR: '/tmp/game-qa-output',      // Lambda /tmp directory
  SCREENSHOTS_SUBDIR: 'screenshots',
  REPORTS_SUBDIR: 'reports'
};
```

#### `src/config/feature-flags.ts`
```typescript
export interface FeatureFlags {
  enableCaching: boolean;              // Future: cache repeat test results
  enableProgressUpdates: boolean;      // Future: real-time progress streaming
  enableErrorRecovery: boolean;        // Future: retry on failures
  enableScreenshotCleanup: boolean;    // Future: delete screenshots after test
  enableDetailedLogging: boolean;      // Debug mode
}

export const DEFAULT_FLAGS: FeatureFlags = {
  enableCaching: false,
  enableProgressUpdates: false,
  enableErrorRecovery: false,
  enableScreenshotCleanup: false,
  enableDetailedLogging: false
};

// Load from environment or config
export function getFeatureFlags(): FeatureFlags {
  return {
    ...DEFAULT_FLAGS,
    enableDetailedLogging: process.env.DEBUG === 'true'
  };
}
```

---

## Data Models

### Core Types

#### `src/types/game-test.types.ts`
```typescript
export interface GameTestRequest {
  gameUrl: string;
  sessionId?: string;              // Optional: for tracking
  config?: Partial<TestConfig>;    // Optional: override defaults
  inputSchema?: InputSchema;       // Optional: game-specific input info (NEW)
}

export interface InputSchema {
  type: 'javascript' | 'semantic'; // JS snippet or description
  content: string;                 // Input schema content
  actions?: string[];              // Discrete events (Jump, Shoot)
  axes?: string[];                 // Continuous inputs (MoveHorizontal)
}

export interface TestConfig {
  maxDuration: number;
  loadTimeout: number;
  screenshotCount: number;
  featureFlags: FeatureFlags;
}

export interface GameTestResult {
  status: 'pass' | 'fail' | 'error';
  playability_score: number;       // 0-100
  issues: Issue[];
  screenshots: string[];           // File paths
  timestamp: string;               // ISO 8601
  metadata?: TestMetadata;
}

export interface Issue {
  severity: 'critical' | 'major' | 'minor';
  description: string;
  timestamp: string;
}

export interface TestMetadata {
  sessionId: string;
  gameUrl: string;
  duration: number;                // Milliseconds
  gameType: GameType;
  consoleErrors: ConsoleError[];
  visionAnalysisTokens?: number;   // Optional: track API usage
}

export interface ClickableElement {
  label: string;                   // e.g., "Start Game"
  x: number;                       // Pixel coordinates
  y: number;
  confidence: number;              // 0-1
}
```

---

## Component Interactions

### Initialization Sequence
```typescript
// src/main.ts
export async function runQA(gameUrl: string): Promise<GameTestResult> {
  const sessionId = nanoid();
  const startTime = Date.now();
  
  try {
    // 1. Initialize browser
    const browser = new BrowserManager();
    const page = await pTimeout(
      browser.initialize(),
      { milliseconds: 30000, message: 'Browser initialization timeout' }
    );
    
    // 2. Setup monitoring
    const errorMonitor = new ErrorMonitor();
    errorMonitor.startMonitoring(page);
    
    // 3. Navigate to game
    await browser.navigate(gameUrl);
    
    // 4. Detect game type
    const detector = new GameDetector();
    const gameType = await detector.detectType(page);
    
    // 5. Wait for ready
    const isReady = await detector.waitForGameReady(page, TIMEOUTS.GAME_LOAD_TIMEOUT);
    if (!isReady) {
      throw new Error('Game failed to load within timeout');
    }
    
    // 6. Capture & interact
    const capturer = new ScreenshotCapturer(sessionId);
    const interactor = new GameInteractor();
    
    const screenshot1 = await capturer.capture(page, 'initial_load');
    await interactor.findAndClickStart(page);
    await interactor.simulateGameplay(page, 30000); // 30 seconds
    const screenshot2 = await capturer.capture(page, 'after_interaction');
    const screenshot3 = await capturer.capture(page, 'final_state');
    
    // 7. Analyze
    const analyzer = new VisionAnalyzer();
    const result = await analyzer.analyzeScreenshots([
      screenshot1,
      screenshot2,
      screenshot3
    ]);
    
    // 8. Enrich with metadata
    result.metadata = {
      sessionId,
      gameUrl,
      duration: Date.now() - startTime,
      gameType,
      consoleErrors: errorMonitor.getErrors()
    };
    
    // 9. Cleanup
    await browser.cleanup();
    
    return result;
    
  } catch (error) {
    // Fail immediately (no retry)
    return {
      status: 'error',
      playability_score: 0,
      issues: [{
        severity: 'critical',
        description: error.message,
        timestamp: new Date().toISOString()
      }],
      screenshots: [],
      timestamp: new Date().toISOString()
    };
  }
}
```

### Vision Analysis Flow
```typescript
// src/vision/analyzer.ts
export class VisionAnalyzer {
  private openai: OpenAI;
  
  constructor() {
    this.openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  
  async analyzeScreenshots(screenshots: Screenshot[]): Promise<GameTestResult> {
    // Convert screenshots to base64
    const images = await Promise.all(
      screenshots.map(async (s) => {
        const buffer = await Bun.file(s.path).arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        return `data:image/png;base64,${base64}`;
      })
    );
    
    // Build multi-modal prompt
    const content = [
      {
        type: 'text',
        text: PROMPTS.GAME_ANALYSIS
      },
      ...images.map(img => ({
        type: 'image',
        image: img
      }))
    ];
    
    // Call GPT-4 Vision with structured output
    const result = await generateObject({
      model: this.openai('gpt-4-turbo'),
      messages: [{ role: 'user', content }],
      schema: gameTestResultSchema,
      temperature: 0.3 // Lower temperature for consistent evaluation
    });
    
    return result.object;
  }
}
```

---

## Configuration Management

### Environment Variables
```bash
# .env.example

# Browserbase
BROWSERBASE_API_KEY=your_api_key_here
BROWSERBASE_PROJECT_ID=your_project_id_here

# OpenAI
OPENAI_API_KEY=your_openai_key_here

# Optional: Feature Flags
DEBUG=false
ENABLE_CACHING=false
ENABLE_PROGRESS_UPDATES=false
ENABLE_ERROR_RECOVERY=false
ENABLE_SCREENSHOT_CLEANUP=false

# Optional: Override Timeouts (milliseconds)
MAX_TEST_DURATION=240000
GAME_LOAD_TIMEOUT=60000
INTERACTION_TIMEOUT=90000
```

### Lambda Configuration
```typescript
// For deployment (serverless.yml or CDK)
{
  "handler": "src/main.handler",
  "runtime": "provided.al2",  // Custom runtime for Bun
  "timeout": 600,              // 10 minutes (safety margin)
  "memorySize": 2048,          // 2GB (faster cold starts)
  "environment": {
    "BROWSERBASE_API_KEY": "${ssm:browserbase-api-key}",
    "OPENAI_API_KEY": "${ssm:openai-api-key}",
    "NODE_ENV": "production"
  },
  "ephemeralStorage": {
    "size": 512                // 512MB /tmp storage
  }
}
```

---

## Error Handling Strategy

### Error Categories
```typescript
export enum ErrorCategory {
  BROWSER_INIT_FAILED = 'browser_init_failed',
  GAME_LOAD_TIMEOUT = 'game_load_timeout',
  GAME_CRASHED = 'game_crashed',
  INTERACTION_FAILED = 'interaction_failed',
  VISION_API_ERROR = 'vision_api_error',
  TIMEOUT_EXCEEDED = 'timeout_exceeded',
  UNKNOWN = 'unknown'
}
```

### Error Handling Pattern
```typescript
// Centralized error handling
export function handleError(error: unknown, stage: string): GameTestResult {
  const logger = new Logger();
  
  const category = categorizeError(error);
  logger.error(`Error during ${stage}`, { category, error });
  
  return {
    status: 'error',
    playability_score: 0,
    issues: [{
      severity: 'critical',
      description: `Failed at ${stage}: ${getErrorMessage(error)}`,
      timestamp: new Date().toISOString()
    }],
    screenshots: [],
    timestamp: new Date().toISOString()
  };
}
```

---

## Performance Optimization

### Parallel Operations
```typescript
// Capture multiple screenshots without waiting
const [screenshot1, screenshot2, screenshot3] = await Promise.all([
  capturer.capture(page, 'stage1'),
  capturer.capture(page, 'stage2'),
  capturer.capture(page, 'stage3')
]);

// Analyze all screenshots in one API call (batch)
const result = await analyzer.analyzeScreenshots([
  screenshot1,
  screenshot2,
  screenshot3
]);
```

### Timeout Wrappers
```typescript
import pTimeout from 'p-timeout';

// Every async operation wrapped with timeout
const page = await pTimeout(
  browser.initialize(),
  { milliseconds: TIMEOUTS.BROWSER_INIT, message: 'Browser init timeout' }
);
```

### Early Termination
```typescript
// Abort if we detect unrecoverable failure
if (gameType === GameType.UNKNOWN) {
  logger.warn('Cannot determine game type, aborting');
  return generateErrorReport('Unable to detect game type');
}

if (errorMonitor.hasCriticalError()) {
  logger.warn('Critical error detected, aborting test');
  return generateErrorReport('Game crashed');
}
```

---

## Testing Strategy

### Unit Tests
```typescript
// tests/unit/game-detector.test.ts
describe('GameDetector', () => {
  it('should detect canvas games', async () => {
    const detector = new GameDetector();
    const mockPage = createMockPage('<canvas id="game"></canvas>');
    const type = await detector.detectType(mockPage);
    expect(type).toBe(GameType.CANVAS);
  });
});
```

### Integration Tests
```typescript
// tests/integration/qa-agent.test.ts
describe('QA Agent E2E', () => {
  it('should test a simple canvas game', async () => {
    const result = await runQA('https://example.com/simple-game');
    expect(result.status).toBe('pass');
    expect(result.playability_score).toBeGreaterThan(50);
    expect(result.screenshots).toHaveLength(3);
  }, 300000); // 5 minute timeout for E2E
});
```

---

## Deployment Considerations

### Lambda Layer (Bun Runtime)
```typescript
// Use community Bun Lambda layer
// https://github.com/oven-sh/bun/tree/main/packages/bun-lambda

// Or build custom layer:
// 1. Download Bun binary
// 2. Package as layer with bootstrap script
// 3. Attach to Lambda function
```

### Cold Start Optimization
- Use 2048MB memory (faster CPU)
- Keep dependencies minimal
- Lazy-load heavy modules (OpenAI client)
- Reuse Browserbase sessions across invocations (if possible)

### Monitoring
```typescript
// CloudWatch metrics
logger.metric('test_duration', Date.now() - startTime);
logger.metric('playability_score', result.playability_score);
logger.metric('vision_api_tokens', metadata.visionAnalysisTokens);
```

---

## Future Extensions (Stubs)

### Caching System (src/utils/cache.ts)
```typescript
// STUB: For future implementation
export class TestCache {
  async get(gameUrl: string): Promise<GameTestResult | null> {
    // TODO: Check DynamoDB/Redis for cached result
    return null;
  }
  
  async set(gameUrl: string, result: GameTestResult): Promise<void> {
    // TODO: Store result with TTL
  }
}
```

### Progress Streaming (src/utils/progress.ts)
```typescript
// STUB: For future implementation
export class ProgressStreamer {
  async sendUpdate(stage: string, progress: number): Promise<void> {
    // TODO: Stream to EventBridge/WebSocket
  }
}
```

### Error Recovery (src/core/recovery.ts)
```typescript
// STUB: For future implementation
export class ErrorRecovery {
  async attemptRecovery(error: Error, context: any): Promise<boolean> {
    // TODO: Implement retry logic with exponential backoff
    return false;
  }
}
```

---

## AI Agent Consumption Notes

This architecture document provides:
- **Complete type definitions** for all interfaces
- **Detailed file responsibilities** with code examples
- **Data flow diagrams** showing component interactions
- **Configuration patterns** for environment and runtime
- **Error handling strategies** with categorization
- **Performance optimization** techniques
- **Testing approach** with examples
- **Deployment considerations** for Lambda
- **Future extension stubs** for feature flags

When implementing:
1. Start with `src/types/` - define all interfaces first
2. Implement `src/config/constants.ts` and `feature-flags.ts`
3. Build `src/core/` modules in order: browser → detector → interactor
4. Integrate `src/vision/` with schema-first approach
5. Wire everything in `src/main.ts`
6. Add tests incrementally

All modules are designed for:
- **Testability**: Pure functions, dependency injection
- **Observability**: Structured logging at each step
- **Fail-fast**: No silent errors, explicit error returns
- **Type-safety**: Zod schemas for runtime validation
