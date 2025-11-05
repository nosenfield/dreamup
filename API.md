# API Documentation

Complete API reference for DreamUp game testing agent.

## Table of Contents

- [Main Entry Point](#main-entry-point)
- [Core Modules](#core-modules)
  - [BrowserManager](#browsermanager)
  - [GameDetector](#gamedetector)
  - [GameInteractor](#gameinteractor)
  - [ScreenshotCapturer](#screenshotcapturer)
  - [ErrorMonitor](#errormonitor)
  - [InputSchemaParser](#inputschemaparser)
- [Vision Module](#vision-module)
  - [VisionAnalyzer](#visionanalyzer)
  - [Vision Prompts](#vision-prompts)
  - [Vision Schemas](#vision-schemas)
- [Utilities](#utilities)
  - [Logger](#logger)
  - [FileManager](#filemanager)
  - [Timeout Utilities](#timeout-utilities)
- [Type Definitions](#type-definitions)
- [Configuration](#configuration)

## Main Entry Point

### `runQA(gameUrl, request?)`

Main orchestration function that performs automated QA testing of a browser-based game.

**Parameters:**
- `gameUrl` (string, required): The URL of the game to test
- `request` (Partial<GameTestRequest>, optional): Optional request containing metadata or inputSchema

**Returns:** Promise<GameTestResult>

**Example:**
```typescript
import { runQA } from './main';

const result = await runQA('https://example.com/game', {
  metadata: {
    metadataVersion: '1.0.0',
    genre: 'arcade',
    inputSchema: {
      type: 'javascript',
      content: 'gameBuilder.createAction("Jump").bindKey("Space")'
    }
  }
});

console.log(`Status: ${result.status}`);
console.log(`Score: ${result.playability_score}`);
```

### `handler(event)`

AWS Lambda handler function for running QA tests.

**Parameters:**
- `event` (LambdaEvent): Lambda event containing gameUrl and optional metadata/inputSchema

**Returns:** Promise<LambdaResponse>

**Example:**
```typescript
import { handler } from './main';

const event = {
  gameUrl: 'https://example.com/game',
  metadata: {
    metadataVersion: '1.0.0',
    inputSchema: {
      type: 'javascript',
      content: 'gameBuilder.createAction("Jump").bindKey("Space")'
    }
  }
};

const response = await handler(event);
// Returns: { statusCode: 200, body: JSON.stringify(result), headers: {...} }
```

### `loadMetadataFromFile(filePath)`

Load and validate metadata from a JSON file.

**Parameters:**
- `filePath` (string): Path to metadata.json file (relative or absolute)

**Returns:** Promise<LoadMetadataResult>

**Example:**
```typescript
import { loadMetadataFromFile } from './main';

const result = await loadMetadataFromFile('./_game-examples/pong/metadata.json');
if (result.success) {
  console.log('Metadata loaded:', result.data);
} else {
  console.error('Error:', result.error);
}
```

### `parseCLIArgs(args?)`

Parse CLI arguments for game URL and metadata path.

**Parameters:**
- `args` (string[], optional): Command line arguments array (defaults to process.argv)

**Returns:** { gameUrl: string; metadataPath?: string }

**Example:**
```typescript
import { parseCLIArgs } from './main';

const { gameUrl, metadataPath } = parseCLIArgs();
```

## Core Modules

### BrowserManager

Manages Browserbase sessions and Stagehand automation.

**Constructor:**
```typescript
new BrowserManager(config: BrowserManagerConfig)
```

**Configuration:**
```typescript
interface BrowserManagerConfig {
  apiKey: string;
  projectId: string;
  logger: Logger;
  initTimeout?: number;
  navigateTimeout?: number;
}
```

**Methods:**

#### `initialize(): Promise<AnyPage>`

Initialize browser session with Browserbase and Stagehand.

**Returns:** Promise<AnyPage> - Stagehand Page object

**Throws:** TimeoutError, Error

**Example:**
```typescript
const browser = new BrowserManager({
  apiKey: process.env.BROWSERBASE_API_KEY!,
  projectId: process.env.BROWSERBASE_PROJECT_ID!,
  logger
});

const page = await browser.initialize();
```

#### `navigate(url: string): Promise<void>`

Navigate to a URL and wait for network idle.

**Parameters:**
- `url` (string): URL to navigate to

**Returns:** Promise<void>

**Throws:** TimeoutError, Error

**Example:**
```typescript
await browser.navigate('https://example.com/game');
```

#### `cleanup(): Promise<void>`

Close browser session and release resources.

**Returns:** Promise<void>

**Example:**
```typescript
await browser.cleanup();
```

### GameDetector

Detects game type and waits for game ready state.

**Constructor:**
```typescript
new GameDetector(config: GameDetectorConfig)
```

**Configuration:**
```typescript
interface GameDetectorConfig {
  logger: Logger;
  gameLoadTimeout?: number;
}
```

**Enum:**
```typescript
enum GameType {
  CANVAS = 'canvas',
  IFRAME = 'iframe',
  DOM = 'dom',
  UNKNOWN = 'unknown'
}
```

**Methods:**

#### `detectType(page: AnyPage): Promise<GameType>`

Detect the type of game (canvas, iframe, DOM, or unknown).

**Parameters:**
- `page` (AnyPage): Stagehand Page object

**Returns:** Promise<GameType>

**Example:**
```typescript
const detector = new GameDetector({ logger });
const gameType = await detector.detectType(page);
console.log(`Game type: ${gameType}`); // 'canvas', 'iframe', 'dom', or 'unknown'
```

#### `waitForGameReady(page: AnyPage, timeout?: number): Promise<boolean>`

Wait for game to reach ready state using multi-signal detection.

**Parameters:**
- `page` (AnyPage): Stagehand Page object
- `timeout` (number, optional): Timeout in milliseconds (default: GAME_LOAD_TIMEOUT)

**Returns:** Promise<boolean> - true if game is ready, false if timeout

**Example:**
```typescript
const isReady = await detector.waitForGameReady(page, 60000);
if (isReady) {
  console.log('Game is ready!');
}
```

### GameInteractor

Simulates user input in browser-based games.

**Constructor:**
```typescript
new GameInteractor(config: GameInteractorConfig)
```

**Configuration:**
```typescript
interface GameInteractorConfig {
  logger: Logger;
  interactionTimeout?: number;
  visionAnalyzer?: VisionAnalyzer;
  screenshotCapturer?: ScreenshotCapturer;
}
```

**Methods:**

#### `findAndClickStart(page: AnyPage): Promise<boolean>`

Find and click the start/play button using multiple strategies.

**Parameters:**
- `page` (AnyPage): Stagehand Page object

**Returns:** Promise<boolean> - true if start button found and clicked

**Strategies:**
1. DOM selectors (fast, no cost)
2. Natural language commands via Stagehand
3. Vision-based fallback (if visionAnalyzer provided)

**Example:**
```typescript
const interactor = new GameInteractor({ logger });
const clicked = await interactor.findAndClickStart(page);
if (clicked) {
  console.log('Start button clicked!');
}
```

#### `simulateGameplay(page: AnyPage, duration: number): Promise<void>`

Simulate generic keyboard input for a specified duration.

**Parameters:**
- `page` (AnyPage): Stagehand Page object
- `duration` (number): Duration in milliseconds

**Returns:** Promise<void>

**Example:**
```typescript
await interactor.simulateGameplay(page, 30000); // 30 seconds
```

#### `simulateGameplayWithMetadata(page: AnyPage, metadata: GameMetadata): Promise<void>`

Simulate gameplay using metadata-driven input (actions and axes).

**Parameters:**
- `page` (AnyPage): Stagehand Page object
- `metadata` (GameMetadata): Game metadata with inputSchema

**Returns:** Promise<void>

**Example:**
```typescript
const metadata = await loadMetadataFromFile('./metadata.json');
if (metadata.success) {
  await interactor.simulateGameplayWithMetadata(page, metadata.data);
}
```

#### `clickAtCoordinates(page: AnyPage, x: number, y: number): Promise<void>`

Click at specific pixel coordinates.

**Parameters:**
- `page` (AnyPage): Stagehand Page object
- `x` (number): X coordinate
- `y` (number): Y coordinate

**Returns:** Promise<void>

**Example:**
```typescript
await interactor.clickAtCoordinates(page, 100, 200);
```

### ScreenshotCapturer

Captures screenshots from game pages.

**Constructor:**
```typescript
new ScreenshotCapturer(config: ScreenshotCapturerConfig)
```

**Configuration:**
```typescript
interface ScreenshotCapturerConfig {
  logger: Logger;
  fileManager: FileManager;
  screenshotTimeout?: number;
}
```

**Methods:**

#### `capture(page: AnyPage, stage: string): Promise<Screenshot>`

Capture a screenshot at a specific stage.

**Parameters:**
- `page` (AnyPage): Stagehand Page object
- `stage` (string): Stage identifier ('initial_load', 'after_interaction', 'final_state')

**Returns:** Promise<Screenshot>

**Example:**
```typescript
const capturer = new ScreenshotCapturer({ logger, fileManager });
const screenshot = await capturer.capture(page, 'initial_load');
console.log(`Screenshot saved: ${screenshot.path}`);
```

#### `captureAtOptimalTime(page: AnyPage, stage: string, metadata?: GameMetadata): Promise<Screenshot>`

Capture screenshot at optimal time using metadata indicators.

**Parameters:**
- `page` (AnyPage): Stagehand Page object
- `stage` (string): Stage identifier
- `metadata` (GameMetadata, optional): Game metadata with loading/success indicators

**Returns:** Promise<Screenshot>

**Example:**
```typescript
const screenshot = await capturer.captureAtOptimalTime(
  page,
  'initial_load',
  metadata
);
```

#### `captureAll(page: AnyPage, stages: string[]): Promise<Screenshot[]>`

Capture multiple screenshots in parallel.

**Parameters:**
- `page` (AnyPage): Stagehand Page object
- `stages` (string[]): Array of stage identifiers

**Returns:** Promise<Screenshot[]> - Array of successfully captured screenshots

**Example:**
```typescript
const screenshots = await capturer.captureAll(page, [
  'initial_load',
  'after_interaction',
  'final_state'
]);
```

### ErrorMonitor

Monitors console errors and warnings during game execution.

**Constructor:**
```typescript
new ErrorMonitor(config: ErrorMonitorConfig)
```

**Configuration:**
```typescript
interface ErrorMonitorConfig {
  logger: Logger;
}
```

**Methods:**

#### `startMonitoring(page: AnyPage): Promise<void>`

Start monitoring console errors and warnings.

**Parameters:**
- `page` (AnyPage): Stagehand Page object

**Returns:** Promise<void>

**Example:**
```typescript
const monitor = new ErrorMonitor({ logger });
await monitor.startMonitoring(page);
```

#### `getErrors(): ConsoleError[]`

Get all captured console errors and warnings.

**Returns:** ConsoleError[] - Array of console errors

**Example:**
```typescript
const errors = monitor.getErrors();
console.log(`Captured ${errors.length} errors`);
```

#### `hasErrors(): boolean`

Check if any errors or warnings were captured.

**Returns:** boolean

**Example:**
```typescript
if (monitor.hasErrors()) {
  console.log('Game has errors!');
}
```

#### `hasCriticalError(): boolean`

Check if any critical errors (not warnings) were captured.

**Returns:** boolean

**Example:**
```typescript
if (monitor.hasCriticalError()) {
  console.log('Game has critical errors!');
}
```

#### `stopMonitoring(): Promise<void>`

Stop monitoring and cleanup listeners.

**Returns:** Promise<void>

**Example:**
```typescript
await monitor.stopMonitoring();
```

### InputSchemaParser

Parses input schemas from GameMetadata to extract actions and axes.

**Constructor:**
```typescript
new InputSchemaParser(config: InputSchemaParserConfig)
```

**Configuration:**
```typescript
interface InputSchemaParserConfig {
  logger: Logger;
}
```

**Methods:**

#### `parse(metadata: GameMetadata): ParsedInputSchema`

Parse metadata to extract actions and axes.

**Parameters:**
- `metadata` (GameMetadata): Game metadata

**Returns:** ParsedInputSchema

**Example:**
```typescript
const parser = new InputSchemaParser({ logger });
const parsed = parser.parse(metadata);
console.log(`Found ${parsed.actions.length} actions`);
console.log(`Found ${parsed.axes.length} axes`);
```

#### `parseJavaScript(content: string): ParsedInputSchema`

Parse JavaScript GameBuilder API content.

**Parameters:**
- `content` (string): JavaScript content with GameBuilder API calls

**Returns:** ParsedInputSchema

**Example:**
```typescript
const content = "gameBuilder.createAction('Jump').bindKey('Space')";
const parsed = parser.parseJavaScript(content);
```

#### `parseSemantic(content: string): ParsedInputSchema`

Parse semantic natural language descriptions.

**Parameters:**
- `content` (string): Natural language description

**Returns:** ParsedInputSchema

**Example:**
```typescript
const content = "Use arrow keys to move, Space to jump";
const parsed = parser.parseSemantic(content);
```

#### `inferKeybindings(metadata: GameMetadata): string[]`

Infer all keybindings from metadata (flattened list).

**Parameters:**
- `metadata` (GameMetadata): Game metadata

**Returns:** string[] - Array of unique key names

**Example:**
```typescript
const keys = parser.inferKeybindings(metadata);
console.log(`Game uses keys: ${keys.join(', ')}`);
```

## Vision Module

### VisionAnalyzer

Analyzes game screenshots using GPT-4 Vision.

**Constructor:**
```typescript
new VisionAnalyzer(config: VisionAnalyzerConfig)
```

**Configuration:**
```typescript
interface VisionAnalyzerConfig {
  logger: Logger;
  apiKey?: string; // Defaults to OPENAI_API_KEY env var
}
```

**Methods:**

#### `analyzeScreenshots(screenshots: Screenshot[], metadata?: GameMetadata): Promise<GameTestResult>`

Analyze multiple screenshots for playability assessment.

**Parameters:**
- `screenshots` (Screenshot[]): Array of screenshots to analyze
- `metadata` (GameMetadata, optional): Game metadata for context

**Returns:** Promise<GameTestResult>

**Example:**
```typescript
const analyzer = new VisionAnalyzer({ logger });
const result = await analyzer.analyzeScreenshots(screenshots, metadata);
console.log(`Playability score: ${result.playability_score}`);
```

#### `findClickableElements(screenshot: Screenshot): Promise<ClickableElement[]>`

Find clickable UI elements in a screenshot.

**Parameters:**
- `screenshot` (Screenshot): Screenshot to analyze

**Returns:** Promise<ClickableElement[]> - Array of clickable elements

**Example:**
```typescript
const elements = await analyzer.findClickableElements(screenshot);
console.log(`Found ${elements.length} clickable elements`);
```

#### `detectCrash(screenshot: Screenshot): Promise<boolean>`

Detect if game has crashed or is in error state.

**Parameters:**
- `screenshot` (Screenshot): Screenshot to analyze

**Returns:** Promise<boolean> - true if crash detected

**Example:**
```typescript
const hasCrashed = await analyzer.detectCrash(screenshot);
if (hasCrashed) {
  console.log('Game has crashed!');
}
```

### Vision Prompts

Pre-defined prompts for vision analysis:

- `GAME_ANALYSIS_PROMPT`: Analyzes screenshots for playability
- `FIND_CLICKABLE_ELEMENTS_PROMPT`: Finds clickable UI elements
- `DETECT_CRASH_PROMPT`: Detects crashes and errors
- `PROMPT_VERSION`: Current prompt version (for tracking)

### Vision Schemas

Zod schemas for vision analysis results:

- `gameTestResultSchema`: Validates GameTestResult
- `clickableElementSchema`: Validates ClickableElement
- `issueSchema`: Validates Issue

Validation functions:
- `validateGameTestResult(data)`: Validate GameTestResult
- `validateClickableElement(data)`: Validate ClickableElement
- `validateIssue(data)`: Validate Issue

## Utilities

### Logger

Structured JSON logging for CloudWatch compatibility.

**Constructor:**
```typescript
new Logger(context: LoggerContext)
```

**Context:**
```typescript
interface LoggerContext {
  module: string;
  op?: string;
  correlationId?: string;
}
```

**Methods:**

#### `info(message: string, data?: object): void`

Log info message.

**Example:**
```typescript
const logger = new Logger({ module: 'qa-agent', op: 'runQA' });
logger.info('Starting test', { gameUrl: 'https://example.com/game' });
```

#### `warn(message: string, data?: object): void`

Log warning message.

**Example:**
```typescript
logger.warn('Slow response', { duration: 5000 });
```

#### `error(message: string, data?: object): void`

Log error message.

**Example:**
```typescript
logger.error('Test failed', { error: error.message });
```

#### `debug(message: string, data?: object): void`

Log debug message (only if DEBUG=true).

**Example:**
```typescript
logger.debug('Debug info', { details: '...' });
```

### FileManager

Manages file operations for screenshots and reports.

**Constructor:**
```typescript
new FileManager(sessionId: string)
```

**Methods:**

#### `ensureOutputDirectory(): Promise<void>`

Ensure output directory exists.

**Returns:** Promise<void>

#### `saveScreenshot(buffer: Buffer, stage: string): Promise<Screenshot>`

Save screenshot buffer to file.

**Parameters:**
- `buffer` (Buffer): PNG buffer
- `stage` (string): Stage identifier

**Returns:** Promise<Screenshot>

#### `saveReport(data: object): Promise<string>`

Save JSON report to file.

**Parameters:**
- `data` (object): Report data

**Returns:** Promise<string> - Path to saved report

#### `cleanup(): Promise<void>`

Cleanup session directories (if ENABLE_SCREENSHOT_CLEANUP=true).

**Returns:** Promise<void>

### Timeout Utilities

#### `withTimeout<T>(promise: Promise<T>, timeout: number, message?: string): Promise<T>`

Wrap a promise with a timeout.

**Parameters:**
- `promise` (Promise<T>): Promise to wrap
- `timeout` (number): Timeout in milliseconds
- `message` (string, optional): Custom error message

**Returns:** Promise<T>

**Throws:** TimeoutError

**Example:**
```typescript
import { withTimeout } from './utils/timeout';
import { TIMEOUTS } from './config/constants';

const result = await withTimeout(
  someAsyncOperation(),
  TIMEOUTS.GAME_LOAD_TIMEOUT,
  'Game load timed out'
);
```

#### `TimeoutError`

Error class for timeout errors.

## Type Definitions

### GameTestRequest

Request interface for QA tests.

```typescript
interface GameTestRequest {
  gameUrl: string;
  metadata?: GameMetadata;
  inputSchema?: InputSchema; // Deprecated, use metadata.inputSchema
  config?: TestConfig;
}
```

### GameTestResult

Result interface from QA tests.

```typescript
interface GameTestResult {
  status: 'pass' | 'fail' | 'error';
  playability_score: number; // 0-100
  screenshots: Screenshot[];
  issues: Issue[];
  metadata: TestMetadata;
}
```

### GameMetadata

Comprehensive game metadata structure.

```typescript
interface GameMetadata {
  metadataVersion: string;
  genre?: string;
  description?: string;
  expectedControls?: string;
  inputSchema: InputSchema;
  loadingIndicators?: LoadingIndicator[];
  successIndicators?: SuccessIndicator[];
  testingStrategy?: TestingStrategy;
}
```

### InputSchema

Input schema structure (JavaScript or semantic).

```typescript
interface InputSchema {
  type: 'javascript' | 'semantic';
  content: string;
  actions?: InputAction[];
  axes?: InputAxis[];
}
```

### InputAction

Discrete action definition (e.g., Jump, Shoot).

```typescript
interface InputAction {
  name: string;
  keys: string[];
  description?: string;
}
```

### InputAxis

Continuous axis definition (e.g., MoveHorizontal, MoveVertical).

```typescript
interface InputAxis {
  name: string;
  keys: string[];
  description?: string;
  is2D?: boolean;
}
```

### Screenshot

Screenshot metadata.

```typescript
interface Screenshot {
  id: string;
  path: string;
  timestamp: number;
  stage: 'initial_load' | 'after_interaction' | 'final_state';
}
```

### Issue

Issue identified during testing.

```typescript
interface Issue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  screenshot?: string;
}
```

### TestMetadata

Test execution metadata.

```typescript
interface TestMetadata {
  sessionId: string;
  gameUrl: string;
  duration: number;
  gameType: GameType;
  consoleErrors: ConsoleError[];
}
```

## Configuration

### FeatureFlags

Feature flags configuration.

```typescript
interface FeatureFlags {
  enableCaching: boolean;
  enableProgressUpdates: boolean;
  enableErrorRecovery: boolean;
  enableScreenshotCleanup: boolean;
  enableDetailedLogging: boolean;
}
```

### Timeouts

Timeout configuration.

```typescript
interface Timeouts {
  MAX_TEST_DURATION: number;
  GAME_LOAD_TIMEOUT: number;
  INTERACTION_TIMEOUT: number;
  SCREENSHOT_TIMEOUT: number;
  PAGE_NAVIGATION_TIMEOUT: number;
  POST_START_DELAY: number;
}
```

### Thresholds

Threshold configuration.

```typescript
interface Thresholds {
  PLAYABILITY_PASS_SCORE: number; // 0-100
  MAX_RETRIES: number;
  SCREENSHOT_COUNT: number;
}
```

---

For usage examples, see [README.md](README.md).  
For deployment instructions, see [_docs/deployment.md](_docs/deployment.md).

