# System Patterns: DreamUp

**Last Updated**: November 3, 2025

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

### Pattern 2: Vision-First Interaction
**When to use**: Canvas games with no accessible DOM elements
**Why**: GPT-4 Vision can detect UI elements in rendered pixels
**Example**:
```typescript
// Strategy 1: Try natural language first (faster, cheaper)
try {
  await page.act("click the start button");
} catch {
  // Strategy 2: Fallback to vision (slower, more expensive)
  const screenshot = await page.screenshot();
  const elements = await visionAnalyzer.findClickableElements(screenshot);
  const startButton = elements.find(e => e.label.includes('start'));
  await page.mouse.click(startButton.x, startButton.y);
}
```

### Pattern 3: Multi-Signal Detection
**When to use**: Detecting if game has fully loaded and is ready
**Why**: Games have inconsistent loading indicators (or none at all)
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
