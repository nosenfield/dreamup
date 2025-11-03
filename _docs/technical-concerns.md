# Technical Concerns & Hurdles

## Purpose
This document identifies technical risks, challenges, and mitigation strategies for the autonomous game testing agent. Each concern includes severity rating, impact analysis, and recommended solutions.

---

## Critical Concerns

### C1: Canvas Game State Detection
**Severity**: HIGH  
**Impact**: Agent cannot determine if game loaded successfully or crashed

#### Problem
Canvas-based games render to a single `<canvas>` element without DOM-based UI. Traditional element detection (`querySelector`, accessibility tree) won't work for:
- Game start buttons rendered in canvas
- In-game UI elements (score, health bars)
- Game over screens
- Loading states

#### Specific Challenges
```typescript
// This WON'T work for canvas games:
await page.act("click the start button"); // No DOM button exists

// Canvas renders everything as pixels:
<canvas id="game" width="800" height="600"></canvas>
```

#### Mitigation Strategies

**Option 1: Vision-First Approach (RECOMMENDED)**
```typescript
// Take screenshot, ask GPT-4 Vision to identify clickable elements
const screenshot = await page.screenshot();
const analysis = await analyzeWithVision(screenshot, 
  "Identify all clickable UI elements and their approximate coordinates"
);

// Use coordinates to click
await page.mouse.click(analysis.startButton.x, analysis.startButton.y);
```

**Pros**: Works with any visual UI  
**Cons**: Higher API costs (~$0.01-0.03 per screenshot), slower than DOM detection

**Option 2: Hybrid Detection**
```typescript
// Check for common patterns
const gameState = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const ctx = canvas?.getContext('2d');
  
  // Check if actively rendering
  let frameCount = 0;
  const checkId = requestAnimationFrame(() => frameCount++);
  
  return {
    hasCanvas: !!canvas,
    isRendering: frameCount > 0,
    canvasSize: canvas ? { width: canvas.width, height: canvas.height } : null
  };
});
```

**Pros**: Fast, no API costs  
**Cons**: Doesn't tell us *what* is rendered, only *that* rendering occurs

**Recommendation**: Use **Option 2 for initial detection** (is game loaded?), then **Option 1 for interaction** (where to click?).

---

### C2: Lambda Cold Start + 5-Minute Timeout
**Severity**: HIGH  
**Impact**: Tests may not complete within Lambda execution limits

#### Problem Breakdown
```
Lambda max execution time: 15 minutes (configurable, but typically 5 min)
Browserbase session startup: 10-30 seconds
Game loading: 5-60 seconds (varies widely)
Interaction sequence: 30-120 seconds
Vision API calls (3-5 screenshots): 5-15 seconds each = 25-75 seconds
Buffer for retries: 30-60 seconds

TOTAL: 2-5 minutes (tight margin)
```

#### Risk Scenarios
1. **Heavy games** (large asset downloads) exceed timeout during load
2. **Network latency** between Lambda and Browserbase adds delays
3. **Vision API rate limits** cause sequential waits
4. **Retry logic** compounds delays (3 retries × 30s = +90s)

#### Mitigation Strategies

**Strategy 1: Aggressive Timeouts**
```typescript
const CONFIG = {
  maxTestDuration: 4 * 60 * 1000, // 4 minutes (1 min buffer)
  gameLoadTimeout: 60 * 1000,     // 60 seconds max load time
  interactionTimeout: 90 * 1000,   // 90 seconds for gameplay
  screenshotTimeout: 10 * 1000,    // 10 seconds per screenshot
  maxRetries: 2                    // Reduce from 3 to 2
};
```

**Strategy 2: Parallel Vision Analysis**
```typescript
// Instead of sequential screenshot → analyze → screenshot → analyze
// Take all screenshots first, then analyze in parallel

const screenshots = await captureAllScreenshots(page);
const analyses = await Promise.all(
  screenshots.map(img => analyzeWithVision(img))
);
```

**Strategy 3: Early Termination Signals**
```typescript
// Fail fast on unrecoverable errors
if (await detectGameCrash(page)) {
  return { status: 'fail', reason: 'game_crashed', elapsed: Date.now() - start };
}

// Skip optional steps if time is running out
if (elapsed > 3.5 * 60 * 1000) {
  logger.warn('Approaching timeout, skipping final validation');
  return generateReport();
}
```

**Strategy 4: Lambda Configuration**
```typescript
// Increase memory allocation (scales CPU proportionally)
// Lambda memory: 1024MB → 3008MB
// This can reduce cold start by 30-50%
```

**Recommendation**: Implement **all four strategies**. Configure Lambda with 10-minute timeout and 2048MB memory as safety margin.

---

### C3: iFrame Embedded Games
**Severity**: MEDIUM-HIGH  
**Impact**: Agent cannot interact with game inside iFrame

#### Problem
If game is embedded in an iFrame:
```html
<iframe src="https://game-host.com/game.html"></iframe>
```

Stagehand/Playwright operates on the parent page by default. Interactions with canvas inside iFrame fail.

#### Detection
```typescript
const iframeInfo = await page.evaluate(() => {
  const iframes = Array.from(document.querySelectorAll('iframe'));
  return iframes.map(iframe => ({
    src: iframe.src,
    hasCanvas: iframe.contentDocument?.querySelector('canvas') !== null
  }));
});
```

#### Mitigation
```typescript
// Get iFrame handle and switch context
const gameFrame = page.frameLocator('iframe[src*="game"]');
const canvas = await gameFrame.locator('canvas').first();

// Now interactions work within iFrame context
await gameFrame.click('text=Start Game');
```

**Complication**: Cross-origin iFrames block `contentDocument` access. Vision analysis becomes **mandatory** for these cases.

**Recommendation**: 
1. Auto-detect iFrames on page load
2. If cross-origin, fallback to vision-only mode
3. Document this limitation for game developers

---

## Medium Concerns

### C4: Inconsistent Game Loading Patterns
**Severity**: MEDIUM  
**Impact**: Agent misses loaded state, reports false negatives

#### Problem
Games use various loading indicators:
- Progress bars (DOM or canvas-rendered)
- "Loading..." text (may be in canvas)
- Splash screens
- No indicator at all (just starts rendering)

#### Example Failure Mode
```typescript
// Agent checks too early
await page.waitForSelector('canvas'); // Canvas exists...
await page.screenshot(); // ...but shows black screen (still loading assets)
```

#### Mitigation
```typescript
// Multi-signal approach
async function waitForGameReady(page: Page, timeout = 60000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const signals = await page.evaluate(() => ({
      hasCanvas: !!document.querySelector('canvas'),
      canvasNotBlank: (() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return false;
        const ctx = canvas.getContext('2d');
        const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        // Check if any pixel is non-black
        return imageData?.data.some(val => val !== 0) ?? false;
      })(),
      noLoadingText: !document.body.innerText.match(/loading|load/i),
      networkIdle: performance.getEntriesByType('resource').length > 0
    }));
    
    // Game ready if 3/4 signals pass
    const readyScore = Object.values(signals).filter(Boolean).length;
    if (readyScore >= 3) return true;
    
    await page.waitForTimeout(1000);
  }
  
  return false; // Timeout
}
```

**Recommendation**: Implement multi-signal detection. If signals conflict, fallback to vision analysis ("Does this screenshot show a game menu or loading screen?").

---

### C5: Vision API Cost at Scale
**Severity**: MEDIUM  
**Impact**: High costs if testing many games

#### Cost Breakdown (GPT-4 Vision - gpt-4-turbo)
```
Input: $10 per 1M tokens
Images: ~765 tokens per image (detail: high)
5 screenshots per test = ~3,825 tokens
Text prompt: ~500 tokens
Total per test: ~4,325 tokens ≈ $0.043 per game test

1,000 games/day = $43/day = $1,290/month
10,000 games/day = $430/day = $12,900/month
```

#### Optimization Strategies

**Strategy 1: Use GPT-4o-mini for Initial Screening**
```typescript
// Cheaper model ($0.15 per 1M input tokens) for simple checks
const quickCheck = await analyzeWithModel(screenshot, 'gpt-4o-mini', 
  "Is this a game screen or an error page? Answer in one word."
);

if (quickCheck === 'error') {
  return { status: 'fail', reason: 'load_failed' };
}

// Use expensive model only for complex analysis
const detailedAnalysis = await analyzeWithModel(screenshot, 'gpt-4-turbo', 
  "Analyze game playability..."
);
```

**Strategy 2: Reduce Screenshot Count**
```typescript
// Adaptive screenshot strategy
const screenshots = [
  'initial_load',    // Always required
  'after_interaction' // Always required
];

// Only take mid-test screenshots if issues detected
if (consoleErrors.length > 0) {
  screenshots.push('error_state');
}
```

**Strategy 3: Batch Analysis**
```typescript
// Send all screenshots in one API call instead of 5 separate calls
// Reduces overhead, same token cost
const batchAnalysis = await generateObject({
  model: openai('gpt-4-turbo'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Analyze this game test sequence...' },
        { type: 'image', image: screenshot1 },
        { type: 'image', image: screenshot2 },
        { type: 'image', image: screenshot3 }
      ]
    }
  ],
  schema: gameTestSchema
});
```

**Recommendation**: Start with full analysis, implement optimizations if monthly costs exceed budget threshold.

---

### C6: Non-Deterministic Game Behavior
**Severity**: MEDIUM  
**Impact**: Flaky tests, inconsistent results

#### Problem
Games may have:
- Random start menus (carousel of game modes)
- Procedural generation (different levels each time)
- Time-based events (daily challenges)
- A/B testing variants

#### Example
```typescript
// Day 1: Game shows "Play Now" button
await page.act('click Play Now');

// Day 2: Same game shows "Start Adventure" button
await page.act('click Play Now'); // FAILS - button doesn't exist
```

#### Mitigation
```typescript
// Use flexible natural language with Stagehand
await page.act('click the button to start the game'); // Adapts to any button text

// Or use vision to find buttons dynamically
const buttonLocation = await findPlayButton(screenshot);
await page.mouse.click(buttonLocation.x, buttonLocation.y);
```

**Recommendation**: Avoid hardcoded text/selectors. Rely on Stagehand's natural language understanding or vision-based detection.

---

## Low Concerns (Monitoring Required)

### C7: Browserbase Session Limits
**Severity**: LOW  
**Impact**: Rate limiting if testing many games concurrently

Check Browserbase plan limits:
- Sessions per minute
- Concurrent sessions
- Total monthly sessions

**Mitigation**: Implement queue system if approaching limits.

---

### C8: OpenAI API Rate Limits
**Severity**: LOW  
**Impact**: Throttling during high-volume testing

Current limits (Tier 4):
- 10,000 requests per minute
- 30,000,000 tokens per minute

Unlikely to hit these with game testing volumes.

**Mitigation**: Implement exponential backoff retry if 429 errors occur.

---

### C9: Screenshot Storage Growth
**Severity**: LOW  
**Impact**: Disk space in Lambda /tmp (512MB limit)

```
5 screenshots × 500KB each = 2.5MB per test
200 tests before /tmp full (unlikely in single invocation)
```

**Mitigation**: Clean up screenshots after test completes, or stream to S3 if persistence needed.

---

## Decision Matrix

| Concern | Severity | Must Address Before Launch? | Estimated Effort |
|---------|----------|------------------------------|------------------|
| C1: Canvas Detection | HIGH | YES | 4-6 hours |
| C2: Lambda Timeout | HIGH | YES | 2-3 hours |
| C3: iFrame Handling | MEDIUM-HIGH | YES | 2-4 hours |
| C4: Loading Detection | MEDIUM | YES | 3-4 hours |
| C5: Vision API Costs | MEDIUM | Monitor first week | 2 hours (if needed) |
| C6: Non-Deterministic Games | MEDIUM | YES (design patterns) | 1-2 hours |
| C7: Browserbase Limits | LOW | NO (monitor) | 1 hour (if needed) |
| C8: OpenAI Rate Limits | LOW | NO (monitor) | 1 hour (if needed) |
| C9: Storage Growth | LOW | NO (monitor) | 30 min (if needed) |

**Total Pre-Launch Effort**: 14-21 hours of problem-solving

---

## Recommended Architecture Decisions

Based on concerns above, recommend:

1. **Vision-First Interaction Model**: Use GPT-4 Vision to detect UI elements and determine click coordinates
2. **Aggressive Timeout Configuration**: 4-minute max test duration, fail-fast on errors
3. **Multi-Signal Game Ready Detection**: Combine canvas check + pixel analysis + network idle
4. **iFrame Auto-Detection**: Switch context automatically, fallback to vision for cross-origin
5. **Flexible Interaction Patterns**: Use Stagehand natural language, avoid hardcoded selectors
6. **Batch Vision Analysis**: Send multiple screenshots in single API call
7. **Lambda Optimization**: 2048MB memory, 10-minute timeout as safety margin

---

## Open Questions for Architecture Phase

Open Questions for Architecture Phase
1. Should we implement caching for repeat tests of same game? (e.g., store "known good" game signature)
- Not for initial development. Include flag / stub implementation for enabling repeat testing in future
2. Do you want real-time progress updates during test, or only final report?
- Final report to start. Include flag / stub implementation for enabling progress updates in future
3. Should agent attempt to recover from errors (reload page), or fail immediately?
- Fail immediately.  Include flag / stub implementation for enabling recovery attempt in future
4. What confidence threshold for playability_score? (e.g., 70+ = pass)
- 50+ = pass
5. Should screenshots be kept after test completes, or deleted to save space?
- Keep screenshots. Include flag / stub implementation for enabling screenshot deletes in future

---

## AI Agent Consumption Notes

This document identifies risks in order of severity. When implementing:
- Address all HIGH severity concerns before launch
- Implement recommended mitigations for MEDIUM concerns
- Monitor LOW concerns during initial deployment
- Reference Decision Matrix for effort estimation
- Use Recommended Architecture Decisions as design constraints
