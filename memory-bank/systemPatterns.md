# System Patterns: DreamUp

**Last Updated**: November 4, 2025

## Architecture Overview

### System Design
Lambda-based serverless architecture with external browser infrastructure (Browserbase) and AI analysis (OpenAI). Single-function design optimized for stateless execution.

```
┌─────────────────────────────────────────────────────────────┐
│                     AWS Lambda Function                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Game Testing Agent (main.ts)             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │   Browser   │  │   Vision    │  │   Reporter   │  │  │
│  │  │   Manager   │  │   Analyzer  │  │              │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘  │  │
│  └─────────┼────────────────┼────────────────┼──────────┘  │
└────────────┼────────────────┼────────────────┼──────────────┘
             │                │                │
             ▼                ▼                ▼
    ┌────────────────┐  ┌──────────┐  ┌──────────────┐
    │  Browserbase   │  │  OpenAI  │  │  /tmp/output │
    │   (Stagehand)  │  │  GPT-4V  │  │  (Local FS)  │
    └────────────────┘  └──────────┘  └──────────────┘
```

### Module Structure
```
src/
├── main.ts                    # Orchestration (CLI + Lambda handler)
├── core/                      # Browser automation
│   ├── browser-manager.ts     # Session lifecycle
│   ├── game-detector.ts       # Canvas/iframe/DOM detection
│   ├── game-interactor.ts     # AI-powered interaction
│   ├── error-monitor.ts       # Console error capture
│   └── screenshot-capturer.ts # Screenshot orchestration
├── vision/                    # AI analysis
│   ├── analyzer.ts            # GPT-4 Vision API
│   ├── prompts.ts             # Prompt templates
│   └── schema.ts              # Zod validation schemas
├── utils/                     # Cross-cutting concerns
│   ├── logger.ts              # Structured JSON logging
│   ├── timeout.ts             # p-timeout wrappers
│   └── file-manager.ts        # /tmp file I/O
├── config/                    # Configuration
│   ├── constants.ts           # Timeouts, thresholds, paths
│   └── feature-flags.ts       # Future feature toggles
└── types/                     # TypeScript interfaces
    ├── game-test.types.ts
    └── config.types.ts
```

---

## Design Patterns

### Pattern 1: Fail-Fast Error Handling
**When to use**: All async operations that can timeout or fail
**Why**: Lambda has hard time limits, no retry logic in MVP
**Example**:
```typescript
try {
  const result = await pTimeout(
    browser.initialize(),
    { milliseconds: 30000, message: 'Browser init timeout' }
  );
} catch (error) {
  logger.error('Browser initialization failed', { error });
  return {
    status: 'error',
    playability_score: 0,
    issues: [{ severity: 'critical', description: error.message, timestamp: new Date().toISOString() }],
    screenshots: [],
    timestamp: new Date().toISOString()
  };
}
```

### Pattern 2: Three-Strategy Start Button Detection
**When to use**: Finding and clicking start/play buttons in games
**Why**: Hybrid games may have HTML buttons, canvas buttons, or both. Try fastest/cheapest methods first.
**Strategy order** (Nov 5, 2025 update):
1. **DOM selection** (instant, $0.00) - HTML buttons above/below canvas
2. **Natural language** (1-2s, $0.00) - Stagehand's `page.act()` for rendered UI
3. **Vision fallback** (3-5s, ~$0.01) - GPT-4V for canvas-only buttons

**Example**:
```typescript
// Strategy 1: Try DOM selection first (NEW - fastest for HTML buttons)
const selectors = ['button:has-text("Start")', 'button:has-text("Play")', ...];
for (const selector of selectors) {
  const element = await page.locator(selector).first();
  if (await element.isVisible()) {
    await element.click();
    return true; // Success - instant, free
  }
}

// Strategy 2: Try natural language (for rendered UI elements)
try {
  await page.act("click the start button");
  return true;
} catch {
  // Strategy 3: Fallback to vision (for canvas-only buttons)
  const screenshot = await page.screenshot();
  const elements = await visionAnalyzer.findClickableElements(screenshot);
  const startButton = elements.find(e => e.label.includes('start'));
  await page.click(startButton.x, startButton.y);
  return true;
}
```

**Performance impact**:
- Pacman (HTML button): Was 3-5s vision call → Now instant DOM click
- Pure canvas games: Unchanged (DOM fails, vision works as before)
- Hybrid games: Significantly faster and cheaper

### Pattern 3: Multi-Signal Detection
**When to use**: Detecting if game has fully loaded and is ready
**Why**: Games have inconsistent loading indicators (or none at all)
**Current limitation**: Signals are canvas-focused, causing DOM games to timeout (safe but slow)

**Example**:
```typescript
const signals = {
  hasCanvas: !!document.querySelector('canvas'),
  canvasNotBlank: pixelData.some(val => val !== 0),
  noLoadingText: !document.body.innerText.match(/loading/i),
  networkIdle: performance.getEntriesByType('resource').length > 0
};
const readyScore = Object.values(signals).filter(Boolean).length;
return readyScore >= 3; // 3 out of 4 signals must pass
```

**Known issue**: DOM games (pure HTML/CSS/JS without canvas) fail `hasCanvas` and `canvasNotBlank`, achieving only 2/4 signals. System correctly waits full timeout (60s) before proceeding. This is **safe behavior** - game loads completely and testing succeeds.

**Production improvements** (see Technical Debt in progress.md):
- Add game-type-specific signal sets (DOM signals, canvas signals, iframe signals)
- Adjust timeouts based on game type (DOM: 10-15s, Canvas: 60s, Iframe: 30s)
- Log which signals passed/failed for debugging
- DOM-specific signals: interactive elements, event listeners, document.readyState

**Example DOM-specific signals**:
```typescript
// For DOM games detected by GameDetector
const domSignals = {
  hasInteractiveElements: !!document.querySelector('button, input, [onclick], [role="button"]'),
  documentComplete: document.readyState === 'complete',
  noLoadingText: !document.body.innerText.match(/loading|please wait/i),
  networkIdle: performance.getEntriesByType('resource').length > 0
};
```

### Pattern 4: Dependency Injection
**When to use**: All core classes
**Why**: Testability, flexibility to swap implementations
**Example**:
```typescript
export class BrowserManager {
  constructor(
    private readonly config: BrowserConfig,
    private readonly logger: Logger
  ) {}
}
```

### Pattern 5: Zod Schema-First Validation
**When to use**: All external API responses (OpenAI Vision)
**Why**: Runtime type safety, prevents invalid data from propagating
**Example**:
```typescript
const gameTestResultSchema = z.object({
  status: z.enum(['pass', 'fail', 'error']),
  playability_score: z.number().min(0).max(100),
  issues: z.array(issueSchema)
});

const result = await generateObject({
  model: openai('gpt-4-turbo'),
  messages: [{ role: 'user', content }],
  schema: gameTestResultSchema // Zod ensures valid response
});
```

### Pattern 6: Input Schema Support
**When to use**: Games that provide additional control information
**Why**: Helps QA agent understand game-specific input methods and interact more effectively
**Example**:
```typescript
// First-party games provide JavaScript snippets
const jsSchema: InputSchema = {
  type: 'javascript',
  content: 'window.gameControls = { jump: () => {}, shoot: () => {} };',
  actions: ['Jump', 'Shoot'],
};

// Third-party games provide semantic descriptions
const semanticSchema: InputSchema = {
  type: 'semantic',
  content: 'Platformer game: Use arrow keys to move, spacebar to jump',
  actions: ['Jump'],
  axes: ['MoveHorizontal', 'MoveVertical'],
};

// Usage in GameTestRequest
const request: GameTestRequest = {
  gameUrl: 'https://example.com/game',
  inputSchema: jsSchema, // Optional - enhances interaction accuracy
};
```

**Key concepts**:
- **Actions**: Discrete button events (Jump, Shoot, Interact)
- **Axes**: Continuous inputs returning -1.0 to 1.0 (MoveHorizontal, MoveVertical)
- **JavaScript type**: Executable code snippets for first-party games
- **Semantic type**: Human-readable descriptions for third-party games

---

### Pattern 7: Bun/Stagehand Compatibility
**When to use**: Always - when using Stagehand with Bun runtime
**Why**: Playwright is incompatible with Bun; must use Stagehand v3+ which uses CDP directly
**Critical**: Stagehand v1.x will fail at runtime with Playwright error

**Example (CORRECT)**:
```typescript
// ✅ Use Stagehand v3.0.1+ with Browserbase
import { Stagehand } from '@browserbasehq/stagehand'; // v3.0.1+

const stagehand = new Stagehand({
  env: 'BROWSERBASE',  // Cloud browsers via CDP
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
});

await stagehand.init(); // ✅ Works - v3 uses CDP, not Playwright

// Page access (v3 API)
const page = stagehand.page; // Convenience getter
// OR: const page = stagehand.context.pages()[0];
```

**Anti-pattern (INCORRECT)**:
```typescript
// ❌ Stagehand v1.x with Bun
import { Stagehand } from '@browserbasehq/stagehand'; // v1.0.0

const stagehand = new Stagehand({ env: 'BROWSERBASE', ... });
await stagehand.init(); // ❌ FAILS: "Playwright does not support Bun"
```

**Key concepts**:
- **Stagehand v1/v2**: Built on Playwright → Incompatible with Bun
- **Stagehand v3**: Built on Chrome DevTools Protocol (CDP) → Bun-compatible
- **Browserbase mode**: Cloud browsers eliminate need for local Chromium
- **Always verify version**: `package.json` must show `"@browserbasehq/stagehand": "^3.0.1"`

**Runtime error to watch for**:
```
Error: Playwright does not currently support the Bun runtime environment.
Please use Node.js instead.
```

If you see this error, upgrade to Stagehand v3: `bun add @browserbasehq/stagehand@3.0.1`

**See also**: `_docs/stagehand-v3-upgrade-guide.md` for migration instructions

---

### Pattern 8: Stagehand Native API (Not Playwright/Puppeteer)
**When to use**: All keyboard/mouse input with Stagehand Page objects
**Why**: Stagehand Page has its own API that differs from Playwright/Puppeteer
**Critical**: Do NOT use `page.keyboard.press()` or `page.mouse.click()` - these don't exist on Stagehand Page

**Example (CORRECT)**:
```typescript
import type { AnyPage } from '@browserbasehq/stagehand';

// ✅ Use Stagehand's native keyboard API
async function sendKeyboardInput(page: AnyPage) {
  const pageAny = page as any;

  // Stagehand exposes keyPress() directly on page
  await pageAny.keyPress('ArrowUp', { delay: 0 });
  await pageAny.keyPress('Space', { delay: 100 });
  await pageAny.keyPress('Enter');
}

// ✅ Use Stagehand's native mouse API
async function clickAt(page: AnyPage, x: number, y: number) {
  const pageAny = page as any;

  // Stagehand exposes click() directly on page with coordinates
  await pageAny.click(x, y);
  await pageAny.click(100, 200, { button: 'right', clickCount: 2 });
}

// ✅ Use Stagehand's native typing API
async function typeText(page: AnyPage, text: string) {
  const pageAny = page as any;

  // Stagehand exposes type() directly on page
  await pageAny.type(text, { delay: 50 });
}
```

**Anti-pattern (INCORRECT)**:
```typescript
// ❌ Trying to use Playwright/Puppeteer keyboard API
async function sendKeyboardInput(page: AnyPage) {
  const pageAny = page as any;

  // ❌ FAILS: page.keyboard doesn't exist on Stagehand Page
  await pageAny.keyboard.press('Space');  // TypeError: undefined is not an object
}

// ❌ Trying to use Playwright/Puppeteer mouse API
async function clickAt(page: AnyPage, x: number, y: number) {
  const pageAny = page as any;

  // ❌ FAILS: page.mouse doesn't exist on Stagehand Page
  await pageAny.mouse.click(x, y);  // TypeError: undefined is not an object
}
```

**Key Stagehand Page API methods** (see node_modules/@browserbasehq/stagehand/dist/index.d.ts):
- `page.keyPress(key: string, options?: { delay?: number })` - Press a single key (line 842)
- `page.type(text: string, options?: { delay?: number })` - Type text string (line 833)
- `page.click(x: number, y: number, options?: { button?: "left" | "right" | "middle", clickCount?: number })` - Click at coordinates (line 781)
- `page.goto(url: string, options?: { waitUntil?: LoadState })` - Navigate to URL (line 690)
- `page.screenshot(options?: { fullPage?: boolean })` - Capture screenshot (line 732)
- `page.evaluate(fn: Function | string, arg?: any)` - Execute JavaScript (line 767)

**Why this matters**:
- Stagehand v3 uses CDP (Chrome DevTools Protocol) directly, not Playwright/Puppeteer
- The Page class has its own implementation that mirrors but differs from Playwright
- Type definitions show `AnyPage = PlaywrightPage | PuppeteerPage | PatchrightPage | Page` but at runtime with Browserbase you get Stagehand's `Page` class
- The `keyboard` and `mouse` properties that exist on Playwright/Puppeteer pages do NOT exist on Stagehand Page

**Runtime error to watch for**:
```
TypeError: undefined is not an object (evaluating 'page.keyboard.press')
TypeError: undefined is not an object (evaluating 'page.mouse.click')
```

If you see these errors, you're using Playwright/Puppeteer API on a Stagehand Page. Switch to Stagehand's native methods.

**See also**:
- Pattern 7 for Bun/Stagehand compatibility
- `src/core/game-interactor.ts` for reference implementation

---

### Pattern 9: Bun Test Mocking Best Practices
**When to use**: Writing tests with Bun's mock system
**Why**: Bun's type inference differs from Jest/Vitest; requires explicit type hints
**Context**: Fixed 25 type errors across test suite (Nov 5, 2025)

**Best Practice 1: Enum Usage**
Always use enum constants instead of string literals when the type is an enum.

```typescript
import { GameType } from '../../src/core/game-detector';

// ❌ Bad - TypeScript type error
expect(result.metadata?.gameType).toBe('canvas');

// ✅ Good - Use enum constant
expect(result.metadata?.gameType).toBe(GameType.CANVAS);
```

**Best Practice 2: Mock Return Types**
Type mock return values explicitly when they contain arrays or complex types.

```typescript
import type { ConsoleError } from '../../src/types/game-test.types';

// ❌ Bad - TypeScript infers never[]
getErrors: mock(() => Promise.resolve([]))

// ✅ Good - Explicit type assertion
getErrors: mock(() => Promise.resolve([] as ConsoleError[]))
```

**Best Practice 3: Mock Method Calls**
Use `mockImplementationOnce` instead of `mockResolvedValueOnce` for type-cast mocks.

```typescript
// ❌ Bad - Type errors with cast mocks
mockErrorMonitor.getErrors.mockResolvedValueOnce(mockErrors);

// ✅ Good - mockImplementationOnce provides better type flexibility
mockErrorMonitor.getErrors.mockImplementationOnce(() =>
  Promise.resolve(mockErrors)
);
```

**Best Practice 4: Array Type Inference in Mocks**
Provide type hints when mapping over mock call arrays.

```typescript
// ❌ Bad - TypeScript infers any[] or undefined[]
const pressedKeys = mockPage.keyPress.mock.calls.map((call) => call[0]);

// ✅ Good - Explicit type assertions
const pressedKeys = mockPage.keyPress.mock.calls.map(
  (call: any[]) => call[0] as string
);
```

**Best Practice 5: Flexible Mock Return Structures**
Use `as any` on mock return values when tests need different return type structures.

```typescript
// ✅ Good - Allows flexible return types across different tests
const mockVisionAnalyzer = {
  analyzeScreenshots: mock(() => Promise.resolve({
    status: 'pass' as const,  // const assertion for literal types
    playability_score: 75,
    issues: [],
    screenshots: [],
    timestamp: new Date().toISOString(),
  } as any)),  // Flexible typing for test variations
};
```

**Best Practice 6: Accessing Mock Methods on Cast Objects**
When mocks are cast to specific types, use `as any` to access Bun mock methods.

```typescript
// ❌ Bad - Mock methods hidden by type cast
visionAnalyzer.findClickableElements.mockResolvedValueOnce([...]);

// ✅ Good - Cast to any to access mock methods
(visionAnalyzer.findClickableElements as any).mockImplementationOnce(() =>
  Promise.resolve([...])
);
```

**Why this pattern matters**:
- Bun's mock system has different type inference than Jest/Vitest
- TypeScript often infers empty arrays as `never[]`
- Mock return types must be explicitly typed for complex objects
- Type-cast mocks hide their mock methods from TypeScript
- `mockImplementationOnce` provides better type compatibility than `mockResolvedValueOnce`

**Common mistakes to avoid**:
1. Using string literals instead of enum constants → Always import enums
2. Leaving array types implicit → Always add type assertions
3. Using `mockResolvedValueOnce` with cast mocks → Use `mockImplementationOnce`
4. Missing `as const` on literal types → Add for proper type inference
5. Not using `as any` on flexible mock structures → Blocks test variations

**Testing impact**: Following these patterns eliminated 25 type errors across 5 test files, ensuring 90+ tests compile and run cleanly.

---

## Key Invariants

### Invariant 1: Every Test Returns a Report
Even on errors, always return a GameTestResult with status='error'. Never throw unhandled exceptions that leave caller without data.

### Invariant 2: Screenshots Captured Before Analysis
Vision analysis must never run without screenshots. If screenshot capture fails, return error immediately.

### Invariant 3: Timeouts at Every Layer
All async operations wrapped with p-timeout. No operation can exceed its allocated time budget.

### Invariant 4: Structured Logging Only
All logs output JSON for CloudWatch parsing. Never use console.log, always use Logger class.

### Invariant 5: No State Between Invocations
Lambda function is stateless. Each invocation starts fresh, no reliance on /tmp persistence.

---

## Data Flow

### Request/Response Cycle

1. **Initialization**
   - Parse input (gameUrl + optional config + optional inputSchema)
   - Generate session ID (nanoid)
   - Initialize logger with context
   - Extract input schema if provided (for use in interaction phase)

2. **Browser Session**
   - Create Browserbase session (30s timeout)
   - Connect Stagehand to session
   - Start error monitoring

3. **Game Detection**
   - Navigate to URL (30s timeout)
   - Detect game type (canvas/iframe/DOM)
   - Multi-signal wait for game ready (60s timeout)

4. **Interaction Sequence**
   - Capture initial screenshot
   - Find start button (Stagehand or vision)
   - Click start
   - Simulate gameplay (30s duration)
   - Capture interaction screenshots
   - Capture final screenshot

5. **Analysis**
   - Load screenshots from /tmp
   - Convert to base64
   - Batch send to GPT-4 Vision
   - Parse structured response with Zod

6. **Reporting**
   - Enrich result with metadata
   - Save report to /tmp/reports/
   - Return GameTestResult

7. **Cleanup**
   - Close browser session
   - Clean up resources

### State Management
No application state. All state is local to single invocation:
- Browser session (managed by BrowserManager)
- Screenshots (stored in /tmp)
- Error logs (accumulated in ErrorMonitor)

---

## Integration Points

### External Service 1: Browserbase
- **Purpose**: Managed browser infrastructure, provides headless Chrome instances
- **How we use it**: Create session via API, connect Stagehand to session, execute automation
- **Failure handling**: Fail immediately with error status, log API response for debugging
- **Rate limits**: Check account plan limits, implement queue if needed

### External Service 2: OpenAI GPT-4 Vision
- **Purpose**: Analyze screenshots for game playability, detect UI elements
- **How we use it**: Batch send screenshots with structured prompt, validate response with Zod
- **Failure handling**: Retry once on 429 (rate limit), fail immediately on other errors
- **Rate limits**: 10,000 RPM (Tier 4), unlikely to hit with game testing volumes
- **Cost optimization**: Use gpt-4-turbo (cheaper than gpt-4), batch screenshots in single call

---

## Performance Considerations

### Optimization Strategy
1. **Parallel operations**: Capture screenshots in parallel where possible
2. **Batch API calls**: Send all screenshots to GPT-4 in single request
3. **Early termination**: Detect crashes early, skip remaining steps
4. **Aggressive timeouts**: Fail fast to avoid wasting Lambda execution time

### Caching Strategy (Stub for Future)
- **enableCaching flag**: Currently false, no caching in MVP
- **Future design**: Cache GameTestResult by game URL hash, TTL 24 hours
- **Cache key**: `game:${sha256(gameUrl)}`
- **Storage**: DynamoDB or Redis

### Scaling Approach
- **Horizontal scaling**: Lambda auto-scales, no limit on concurrent executions
- **Cost scaling**: Linear with test volume ($0.05 per test)
- **Rate limit scaling**: Browserbase and OpenAI rate limits are bottleneck
- **Mitigation**: Implement queue (SQS) if approaching rate limits

---

## Pattern 10: Metadata-Driven Testing

**When to use**: When game metadata is available (static files or scan agent)
**Why**: Improves test accuracy and efficiency by targeting specific controls instead of random inputs
**Context**: Introduced in Iteration 5 (I5.0-I5.2)

**Example (CORRECT)**:
```typescript
// With metadata - targeted testing
const metadata: GameMetadata = {
  inputSchema: {
    type: 'javascript',
    content: '// GameBuilder code...',
    actions: [
      { name: 'Pause', keys: ['Escape'], description: 'Pause the game' }
    ],
    axes: [
      { name: 'MoveVertical', keys: ['ArrowDown', 'ArrowUp'], description: 'Move paddle' }
    ]
  },
  genre: 'arcade',
  testingStrategy: {
    waitBeforeInteraction: 2000,
    interactionDuration: 30000,
    criticalActions: ['Pause'],
    criticalAxes: ['MoveVertical']
  }
};

// GameInteractor uses metadata for targeted testing
await gameInteractor.simulateGameplayWithMetadata(page, metadata, 30000);
// Result: Tests Escape key (Pause), ArrowDown/Up (Move), prioritizes critical inputs
```

**Anti-pattern (INCORRECT - Random Testing)**:
```typescript
// Without metadata - random inputs
await gameInteractor.simulateKeyboardInput(page, 30000);
// Result: Tests WASD, arrows, space, enter - may miss game-specific controls
```

**Key concepts**:
- **GameMetadata**: Container for all game information (input schema, genre, hints, strategy)
- **InputAction**: Discrete button press (e.g., Jump, Pause) with key bindings
- **InputAxis**: Continuous input -1 to 1 (e.g., MoveHorizontal) with key bindings
- **TestingStrategy**: Timing and priority hints for the agent
- **Backwards Compatibility**: Old `inputSchema` field still works, converted to metadata internally

**Metadata Sources**:
- **Option A (MVP)**: Static `metadata.json` files alongside game files
- **Option C (Future)**: Scan agent generates metadata dynamically from game code
- **Hybrid (Production)**: Cache scan results, fallback to static files

**Benefits**:
- **Accuracy**: Test controls that actually exist in game
- **Efficiency**: Skip unnecessary key combinations
- **Context**: Provide genre and controls to vision analysis
- **Validation**: Check for expected success indicators
- **Prioritization**: Test critical controls first

**Usage in Request**:
```typescript
// Provide metadata directly
const request: GameTestRequest = {
  gameUrl: 'https://example.com/pong',
  metadata: {
    inputSchema: { /* ... */ },
    genre: 'arcade',
    testingStrategy: { /* ... */ }
  }
};

// CLI usage
// $ bun run src/main.ts https://example.com/pong --metadata ./pong/metadata.json

// Backwards compatible (deprecated)
const request: GameTestRequest = {
  gameUrl: 'https://example.com/pong',
  inputSchema: { /* ... */ } // Converted to metadata.inputSchema internally
};
```

**Metadata Structure**:
```typescript
interface GameMetadata {
  inputSchema: InputSchema;           // Required: Input controls
  genre?: string;                     // Optional: Game genre (arcade, puzzle, etc.)
  description?: string;               // Optional: Game description
  expectedControls?: string;          // Optional: Human-readable control description
  loadingIndicators?: LoadingIndicator[]; // Optional: Hints for ready detection
  successIndicators?: SuccessIndicator[]; // Optional: Hints for validation
  testingStrategy?: TestingStrategy;  // Optional: Timing and priorities
  metadataVersion?: string;           // Optional: Schema version (e.g., "1.0.0")
}
```

**See also**:
- Pattern 6 (Input Schema Support) - Original design, now part of GameMetadata
- `_docs/architecture.md` - Full metadata system documentation
- `_game-examples/*/metadata.json` - Example metadata files
