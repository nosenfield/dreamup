# DreamUp QA Agent - Refactor Plan

**Created:** 2025-11-07
**Status:** Planning
**Branch:** `refactor/logging-and-separation`

## Executive Summary

**Goal:** Improve code maintainability and logging clarity without degrading functionality

**Approach:** Refactor in place - rewrite existing implementation on a new branch

**Priorities:**
1. **P1 (Critical):** Logging improvements, Code separation (start strategies + adaptive loop)
2. **P2 (High):** Error handling improvements
3. **P3 (Medium):** Screenshot timing fix
4. **P4 (Low):** Documentation updates

**Estimated Effort:** ~13 hours of focused work

---

## Phase 1: Logging Infrastructure (P1 - 2 hours)

### **1.1 Enhanced Logger with Phase Separation**

**Goal:** Clear visual separation of test phases with crucial action details

**Changes to `src/utils/logger.ts`:**

```typescript
export enum TestPhase {
  INITIALIZATION = 'initialization',
  NAVIGATION = 'navigation',
  GAME_DETECTION = 'game_detection',
  START_BUTTON_DETECTION = 'start_button_detection',
  GAMEPLAY_SIMULATION = 'gameplay_simulation',
  ADAPTIVE_QA_LOOP = 'adaptive_qa_loop',
  VISION_ANALYSIS = 'vision_analysis',
  SCREENSHOT_CAPTURE = 'screenshot_capture',
  CLEANUP = 'cleanup',
}

export enum LogLevel {
  ERROR = 0,   // Always show
  WARN = 1,    // Production default
  INFO = 2,    // Important milestones
  DEBUG = 3,   // Detailed operations
  TRACE = 4,   // Very verbose
}

export class Logger {
  private currentPhase?: TestPhase;
  private logLevel: LogLevel;

  // New methods
  beginPhase(phase: TestPhase, details?: object): void {
    const banner = `\n${'='.repeat(60)}\n=== BEGIN ${phase.toUpperCase().replace('_', ' ')} ===\n${'='.repeat(60)}`;
    console.log(banner);
    this.currentPhase = phase;
    if (details) {
      this.info(`Phase details`, details);
    }
  }

  endPhase(phase: TestPhase, summary?: object): void {
    if (summary) {
      this.info(`Phase summary`, summary);
    }
    const banner = `${'='.repeat(60)}\n=== END ${phase.toUpperCase().replace('_', ' ')} ===\n${'='.repeat(60)}\n`;
    console.log(banner);
    this.currentPhase = undefined;
  }

  // Enhanced action logging
  action(actionType: string, details: ActionDetails): void {
    const formatted = this.formatActionDetails(actionType, details);
    this.info(`ACTION: ${actionType}`, formatted);
  }

  private formatActionDetails(actionType: string, details: ActionDetails): object {
    switch (actionType) {
      case 'click':
        return {
          coordinates: `(${details.x}, ${details.y})`,
          target: details.target,
          strategy: details.strategy,
        };
      case 'keypress':
        return {
          key: details.key,
          duration: details.duration,
        };
      case 'screenshot':
        return {
          stage: details.stage,
          path: details.path,
          timing: details.timing,
        };
      default:
        return details;
    }
  }

  // Level-based logging
  error(message: string, context?: object): void {
    if (this.logLevel >= LogLevel.ERROR) {
      this.log('ERROR', message, context);
    }
  }

  warn(message: string, context?: object): void {
    if (this.logLevel >= LogLevel.WARN) {
      this.log('WARN', message, context);
    }
  }

  info(message: string, context?: object): void {
    if (this.logLevel >= LogLevel.INFO) {
      this.log('INFO', message, context);
    }
  }

  debug(message: string, context?: object): void {
    if (this.logLevel >= LogLevel.DEBUG) {
      this.log('DEBUG', message, context);
    }
  }

  trace(message: string, context?: object): void {
    if (this.logLevel >= LogLevel.TRACE) {
      this.log('TRACE', message, context);
    }
  }
}

interface ActionDetails {
  x?: number;
  y?: number;
  target?: string;
  strategy?: string;
  key?: string;
  duration?: number;
  stage?: string;
  path?: string;
  timing?: string;
  [key: string]: any;
}
```

**Environment Variables:**
```bash
# .env
LOG_LEVEL=info  # error | warn | info | debug | trace
DEBUG=false     # Keep for backward compatibility (sets LOG_LEVEL=debug)
```

**Example Output:**
```
============================================================
=== BEGIN START BUTTON DETECTION ===
============================================================
[INFO] Phase details: { strategies: ['dom', 'natural_language', 'vision', 'state_analysis'], timeout: 90000 }
[INFO] Trying strategy 1/4: DOM selectors
[DEBUG] DOM selector attempt: #start-btn
[DEBUG] DOM selector failed: Element not found
[DEBUG] DOM selector attempt: button:has-text("start")
[INFO] ACTION: click { coordinates: "(512, 384)", target: "Start button", strategy: "dom" }
[INFO] Phase summary: { success: true, strategy: 'dom', attempts: 12, duration: 234 }
============================================================
=== END START BUTTON DETECTION ===
============================================================
```

---

## Phase 2: Start Button Detection - Code Separation (P1 - 3 hours)

### **2.1 Create Strategy Pattern Structure**

**New Directory:** `src/core/start-detection/`

```
src/core/start-detection/
├── base-strategy.ts           # Abstract base class
├── dom-strategy.ts            # Strategy 1: DOM selectors
├── natural-language-strategy.ts  # Strategy 2: page.act()
├── vision-strategy.ts         # Strategy 3: VisionAnalyzer
├── state-analysis-strategy.ts    # Strategy 4: StateAnalyzer
├── start-detector.ts          # Orchestrator (replaces findAndClickStart)
└── index.ts                   # Exports
```

**2.2 Base Strategy Interface**

`src/core/start-detection/base-strategy.ts`:
```typescript
import type { AnyPage } from '@browserbasehq/stagehand';
import type { Logger } from '../../utils/logger';

export interface StartButtonResult {
  success: boolean;
  strategy: string;
  attempts: number;
  duration: number;
  coordinates?: { x: number; y: number };
  error?: string;
}

export abstract class BaseStartStrategy {
  constructor(
    protected readonly logger: Logger,
    protected readonly name: string
  ) {}

  abstract isAvailable(): boolean;
  abstract execute(page: AnyPage, timeout: number): Promise<StartButtonResult>;

  protected async postClickDelay(delayMs: number): Promise<void> {
    this.logger.debug('Waiting after click', { delayMs });
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}
```

**2.3 DOM Strategy Implementation**

`src/core/start-detection/dom-strategy.ts`:
```typescript
import { BaseStartStrategy, StartButtonResult } from './base-strategy';
import type { AnyPage } from '@browserbasehq/stagehand';
import { withTimeout } from '../../utils/timeout';
import { TIMEOUTS } from '../../config/constants';

export class DOMStrategy extends BaseStartStrategy {
  private readonly selectors = [
    // Tier 1: Exact IDs
    '#start-btn',
    '#play-btn',
    '#begin-btn',

    // Tier 2: Attribute wildcards
    '[id*="start" i]',
    '[id*="play" i]',
    '[id*="begin" i]',
    '[class*="start" i]',
    '[class*="play" i]',
    '[class*="begin" i]',
    '[name*="start" i]',
    '[name*="play" i]',
    '[name*="begin" i]',
    '[onclick*="start" i]',
    '[onclick*="play" i]',
    '[onclick*="begin" i]',

    // Tier 3: Text-based fallback
    'button:has-text("start")',
    'button:has-text("play")',
    'button:has-text("begin")',
    'a:has-text("start")',
    'a:has-text("play")',
    'div[role="button"]:has-text("start")',
    'div[role="button"]:has-text("play")',
  ];

  isAvailable(): boolean {
    return true; // Always available
  }

  async execute(page: AnyPage, timeout: number): Promise<StartButtonResult> {
    const startTime = Date.now();
    const pageAny = page as any;

    this.logger.debug('DOM strategy starting', {
      selectorCount: this.selectors.length,
      timeout,
    });

    for (let i = 0; i < this.selectors.length; i++) {
      const selector = this.selectors[i];

      try {
        this.logger.trace(`Trying DOM selector [${i + 1}/${this.selectors.length}]`, { selector });

        const element = await pageAny.locator(selector).first();
        if (element && (await element.isVisible({ timeout: 1000 }).catch(() => false))) {

          await withTimeout(
            element.click(),
            timeout,
            `DOM click timeout: ${selector}`
          );

          // Get coordinates for logging (approximate from bounding box)
          const box = await element.boundingBox().catch(() => null);
          const coords = box ? { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) } : undefined;

          this.logger.action('click', {
            strategy: 'dom',
            target: selector,
            x: coords?.x,
            y: coords?.y,
          });

          await this.postClickDelay(TIMEOUTS.POST_START_DELAY);

          return {
            success: true,
            strategy: 'dom',
            attempts: i + 1,
            duration: Date.now() - startTime,
            coordinates: coords,
          };
        }
      } catch (error) {
        this.logger.trace('DOM selector failed', {
          selector,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      success: false,
      strategy: 'dom',
      attempts: this.selectors.length,
      duration: Date.now() - startTime,
      error: 'No selectors matched',
    };
  }
}
```

**2.4 Natural Language Strategy Implementation**

`src/core/start-detection/natural-language-strategy.ts`:
```typescript
import { BaseStartStrategy, StartButtonResult } from './base-strategy';
import type { AnyPage } from '@browserbasehq/stagehand';
import { withTimeout } from '../../utils/timeout';
import { TIMEOUTS } from '../../config/constants';

export class NaturalLanguageStrategy extends BaseStartStrategy {
  private readonly phrases = [
    'click start button',
    'click play button',
    'press start',
    'click begin game',
  ];

  isAvailable(): boolean {
    return true; // Available if page.act() exists (checked at runtime)
  }

  async execute(page: AnyPage, timeout: number): Promise<StartButtonResult> {
    const startTime = Date.now();
    const pageAny = page as any;

    if (typeof pageAny.act !== 'function') {
      return {
        success: false,
        strategy: 'natural_language',
        attempts: 0,
        duration: Date.now() - startTime,
        error: 'page.act() not available',
      };
    }

    this.logger.debug('Natural language strategy starting', {
      phraseCount: this.phrases.length,
      timeout,
    });

    for (let i = 0; i < this.phrases.length; i++) {
      const phrase = this.phrases[i];

      try {
        this.logger.trace(`Trying natural language [${i + 1}/${this.phrases.length}]`, { phrase });

        await withTimeout(
          pageAny.act(phrase),
          timeout,
          `Natural language timeout: ${phrase}`
        );

        this.logger.action('click', {
          strategy: 'natural_language',
          target: phrase,
        });

        await this.postClickDelay(TIMEOUTS.POST_START_DELAY);

        return {
          success: true,
          strategy: 'natural_language',
          attempts: i + 1,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        this.logger.trace('Natural language command failed', {
          phrase,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      success: false,
      strategy: 'natural_language',
      attempts: this.phrases.length,
      duration: Date.now() - startTime,
      error: 'All phrases failed',
    };
  }
}
```

**2.5 Vision Strategy Implementation**

`src/core/start-detection/vision-strategy.ts`:
```typescript
import { BaseStartStrategy, StartButtonResult } from './base-strategy';
import type { AnyPage } from '@browserbasehq/stagehand';
import type { VisionAnalyzer } from '../../vision/analyzer';
import type { ScreenshotCapturer } from '../screenshot-capturer';
import { TIMEOUTS } from '../../config/constants';

export class VisionStrategy extends BaseStartStrategy {
  constructor(
    logger: any,
    name: string,
    private readonly visionAnalyzer: VisionAnalyzer,
    private readonly screenshotCapturer: ScreenshotCapturer
  ) {
    super(logger, name);
  }

  isAvailable(): boolean {
    return true; // Available if dependencies provided
  }

  async execute(page: AnyPage, timeout: number): Promise<StartButtonResult> {
    const startTime = Date.now();

    this.logger.debug('Vision strategy starting', { timeout });

    try {
      // Take screenshot for vision analysis
      const screenshot = await this.screenshotCapturer.capture(page, 'initial_load');
      this.logger.trace('Screenshot captured for vision analysis', { path: screenshot.path });

      // Find clickable elements using vision
      const elements = await this.visionAnalyzer.findClickableElements(screenshot.path);

      if (elements.length === 0) {
        return {
          success: false,
          strategy: 'vision',
          attempts: 1,
          duration: Date.now() - startTime,
          error: 'No clickable elements found',
        };
      }

      // Filter for start/play-related buttons
      const startKeywords = ['start', 'play', 'begin', 'go'];
      const startElements = elements.filter((element) => {
        const labelLower = element.label.toLowerCase();
        return (
          startKeywords.some((keyword) => labelLower.includes(keyword)) &&
          element.confidence >= 0.7
        );
      });

      if (startElements.length === 0) {
        return {
          success: false,
          strategy: 'vision',
          attempts: 1,
          duration: Date.now() - startTime,
          error: `No start/play buttons found (found ${elements.length} clickable elements)`,
        };
      }

      // Select element with highest confidence
      const bestElement = startElements.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );

      this.logger.debug('Vision detected start button', {
        label: bestElement.label,
        coordinates: { x: bestElement.x, y: bestElement.y },
        confidence: bestElement.confidence,
      });

      // Click at the coordinates
      const pageAny = page as any;
      await pageAny.click(bestElement.x, bestElement.y);

      this.logger.action('click', {
        strategy: 'vision',
        target: bestElement.label,
        x: bestElement.x,
        y: bestElement.y,
        confidence: bestElement.confidence,
      });

      await this.postClickDelay(TIMEOUTS.POST_START_DELAY);

      return {
        success: true,
        strategy: 'vision',
        attempts: 1,
        duration: Date.now() - startTime,
        coordinates: { x: bestElement.x, y: bestElement.y },
      };
    } catch (error) {
      return {
        success: false,
        strategy: 'vision',
        attempts: 1,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
```

**2.6 State Analysis Strategy Implementation**

`src/core/start-detection/state-analysis-strategy.ts`:
```typescript
import { BaseStartStrategy, StartButtonResult } from './base-strategy';
import type { AnyPage } from '@browserbasehq/stagehand';
import type { StateAnalyzer } from '../state-analyzer';
import type { ScreenshotCapturer } from '../screenshot-capturer';
import type { GameMetadata } from '../../types';
import { TIMEOUTS } from '../../config/constants';

export class StateAnalysisStrategy extends BaseStartStrategy {
  constructor(
    logger: any,
    name: string,
    private readonly stateAnalyzer: StateAnalyzer,
    private readonly screenshotCapturer: ScreenshotCapturer,
    private readonly metadata?: GameMetadata
  ) {
    super(logger, name);
  }

  isAvailable(): boolean {
    return true; // Available if dependencies provided
  }

  async execute(page: AnyPage, timeout: number): Promise<StartButtonResult> {
    const startTime = Date.now();

    this.logger.debug('State analysis strategy starting', { timeout });

    try {
      // Capture HTML and screenshot for state analysis
      const pageAny = page as any;
      const html = await pageAny.evaluate(() => document.documentElement.outerHTML);
      const screenshot = await this.screenshotCapturer.capture(page, 'initial_load');

      this.logger.trace('State captured for LLM analysis', {
        htmlLength: html.length,
        screenshotPath: screenshot.path,
      });

      // Ask LLM for recommendation
      const recommendation = await this.stateAnalyzer.analyzeAndRecommendAction({
        html,
        screenshot: screenshot.path,
        previousActions: [],
        metadata: this.metadata,
        goal: 'Find and click the start button',
      });

      this.logger.debug('LLM recommendation received', {
        action: recommendation.action,
        confidence: recommendation.confidence,
        reasoning: recommendation.reasoning,
      });

      // Execute recommendation
      if (recommendation.action === 'click' && typeof recommendation.target === 'object') {
        const { x, y } = recommendation.target as { x: number; y: number };
        await pageAny.click(x, y);

        this.logger.action('click', {
          strategy: 'state_analysis',
          target: 'LLM recommended',
          x,
          y,
          confidence: recommendation.confidence,
          reasoning: recommendation.reasoning,
        });

        await this.postClickDelay(TIMEOUTS.POST_START_DELAY);

        return {
          success: true,
          strategy: 'state_analysis',
          attempts: 1,
          duration: Date.now() - startTime,
          coordinates: { x, y },
        };
      }

      // Try alternatives if primary failed or wasn't a click
      for (let i = 0; i < recommendation.alternatives.length; i++) {
        const alt = recommendation.alternatives[i];
        if (alt.action === 'click' && typeof alt.target === 'object') {
          const { x, y } = alt.target as { x: number; y: number };

          this.logger.debug('Trying alternative recommendation', {
            alternative: i + 1,
            x,
            y,
          });

          await pageAny.click(x, y);

          this.logger.action('click', {
            strategy: 'state_analysis',
            target: `LLM alternative ${i + 1}`,
            x,
            y,
            reasoning: alt.reasoning,
          });

          await this.postClickDelay(TIMEOUTS.POST_START_DELAY);

          return {
            success: true,
            strategy: 'state_analysis',
            attempts: i + 2,
            duration: Date.now() - startTime,
            coordinates: { x, y },
          };
        }
      }

      return {
        success: false,
        strategy: 'state_analysis',
        attempts: 1 + recommendation.alternatives.length,
        duration: Date.now() - startTime,
        error: 'No click action recommended',
      };
    } catch (error) {
      return {
        success: false,
        strategy: 'state_analysis',
        attempts: 1,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
```

**2.7 Start Detector Orchestrator**

`src/core/start-detection/start-detector.ts`:
```typescript
import type { AnyPage } from '@browserbasehq/stagehand';
import { Logger, TestPhase } from '../../utils/logger';
import { getFeatureFlags } from '../../config/feature-flags';
import { BaseStartStrategy, StartButtonResult } from './base-strategy';
import { DOMStrategy } from './dom-strategy';
import { NaturalLanguageStrategy } from './natural-language-strategy';
import { VisionStrategy } from './vision-strategy';
import { StateAnalysisStrategy } from './state-analysis-strategy';

export interface StartDetectorConfig {
  logger: Logger;
  timeout?: number;
  visionAnalyzer?: any;
  screenshotCapturer?: any;
  stateAnalyzer?: any;
  metadata?: any;
}

export class StartDetector {
  private readonly strategies: BaseStartStrategy[];
  private readonly logger: Logger;
  private readonly timeout: number;

  constructor(config: StartDetectorConfig) {
    this.logger = config.logger;
    this.timeout = config.timeout ?? 90000;

    const flags = getFeatureFlags();

    // Initialize strategies in priority order
    this.strategies = [
      flags.enableDOMStrategy ? new DOMStrategy(this.logger, 'dom') : null,
      flags.enableNaturalLanguageStrategy ? new NaturalLanguageStrategy(this.logger, 'natural_language') : null,
      flags.enableVisionStrategy && config.visionAnalyzer && config.screenshotCapturer
        ? new VisionStrategy(this.logger, 'vision', config.visionAnalyzer, config.screenshotCapturer)
        : null,
      flags.enableStateAnalysisStrategy && config.stateAnalyzer && config.screenshotCapturer
        ? new StateAnalysisStrategy(this.logger, 'state_analysis', config.stateAnalyzer, config.screenshotCapturer, config.metadata)
        : null,
    ].filter((s): s is BaseStartStrategy => s !== null && s.isAvailable());
  }

  async findAndClickStart(page: AnyPage): Promise<StartButtonResult> {
    this.logger.beginPhase(TestPhase.START_BUTTON_DETECTION, {
      strategiesAvailable: this.strategies.map(s => s['name']),
      timeout: this.timeout,
    });

    for (let i = 0; i < this.strategies.length; i++) {
      const strategy = this.strategies[i];
      const strategyName = strategy['name'];

      this.logger.info(`Trying strategy ${i + 1}/${this.strategies.length}: ${strategyName}`);

      try {
        const result = await strategy.execute(page, this.timeout);

        if (result.success) {
          this.logger.info(`Strategy succeeded: ${strategyName}`, {
            attempts: result.attempts,
            duration: result.duration,
            coordinates: result.coordinates,
          });

          this.logger.endPhase(TestPhase.START_BUTTON_DETECTION, {
            success: true,
            strategy: strategyName,
            totalAttempts: result.attempts,
            totalDuration: result.duration,
          });

          return result;
        } else {
          this.logger.warn(`Strategy failed: ${strategyName}`, {
            attempts: result.attempts,
            duration: result.duration,
            error: result.error,
          });
        }
      } catch (error) {
        this.logger.error(`Strategy error: ${strategyName}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // All strategies failed
    this.logger.endPhase(TestPhase.START_BUTTON_DETECTION, {
      success: false,
      strategiesTried: this.strategies.length,
    });

    return {
      success: false,
      strategy: 'none',
      attempts: this.strategies.length,
      duration: 0,
      error: 'All strategies failed',
    };
  }
}
```

**2.8 Index File**

`src/core/start-detection/index.ts`:
```typescript
export * from './base-strategy';
export * from './dom-strategy';
export * from './natural-language-strategy';
export * from './vision-strategy';
export * from './state-analysis-strategy';
export * from './start-detector';
```

**2.9 Update GameInteractor**

`src/core/game-interactor.ts`:
```typescript
// Remove the entire findAndClickStart method (lines 298-550+)
// Replace with:

import { StartDetector } from './start-detection';

// ... in GameInteractor class:

async findAndClickStart(page: AnyPage, timeout?: number): Promise<boolean> {
  const detector = new StartDetector({
    logger: this.logger,
    timeout: timeout ?? this.interactionTimeout,
    visionAnalyzer: this.visionAnalyzer,
    screenshotCapturer: this.screenshotCapturer,
    stateAnalyzer: this.stateAnalyzer,
    metadata: this.metadata,
  });

  const result = await detector.findAndClickStart(page);
  return result.success;
}
```

---

## Phase 3: Adaptive QA Loop - Code Separation (P1 - 3 hours)

### **3.1 Extract to New Module**

**New File:** `src/core/adaptive-qa-loop.ts`

```typescript
import type { AnyPage } from '@browserbasehq/stagehand';
import { Logger, TestPhase } from '../utils/logger';
import { StateAnalyzer } from './state-analyzer';
import { GameInteractor } from './game-interactor';
import type { GameMetadata, Action, AdaptiveConfig } from '../types';
import { calculateEstimatedCost } from '../utils/adaptive-qa';

export interface AdaptiveLoopResult {
  screenshots: string[];
  actionHistory: Action[];
  stateCheckCount: number;
  estimatedCost: number;
  completionReason: 'max_actions' | 'max_duration' | 'budget_limit' | 'llm_complete' | 'error';
}

export class AdaptiveQALoop {
  constructor(
    private readonly logger: Logger,
    private readonly stateAnalyzer: StateAnalyzer,
    private readonly gameInteractor: GameInteractor,
    private readonly config: AdaptiveConfig,
    private readonly metadata?: GameMetadata
  ) {}

  async run(page: AnyPage): Promise<AdaptiveLoopResult> {
    this.logger.beginPhase(TestPhase.ADAPTIVE_QA_LOOP, {
      maxActions: this.config.maxActions,
      maxDuration: this.config.maxDuration,
      maxBudget: this.config.maxBudget,
    });

    // Capture initial state
    this.logger.info('Capturing initial state');
    let currentState = await this.gameInteractor.captureCurrentState(page);
    const screenshots: string[] = [currentState.screenshot.path];
    const actionHistory: Action[] = [];

    const loopStartTime = Date.now();
    let stateCheckCount = 0;
    let completionReason: AdaptiveLoopResult['completionReason'] = 'max_actions';

    this.logger.action('screenshot', {
      stage: 'initial',
      path: currentState.screenshot.path,
      timing: 'loop_start',
    });

    for (let i = 0; i < this.config.maxActions; i++) {
      const elapsed = Date.now() - loopStartTime;

      this.logger.info(`\n--- Iteration ${i + 1}/${this.config.maxActions} ---`, {
        elapsed,
        actionsPerformed: actionHistory.length,
        screenshotsCaptured: screenshots.length,
      });

      // Check duration limit
      if (elapsed >= this.config.maxDuration) {
        this.logger.warn('Max duration reached', { elapsed, maxDuration: this.config.maxDuration });
        completionReason = 'max_duration';
        break;
      }

      // Check budget
      const estimatedCost = calculateEstimatedCost(
        actionHistory.length,
        screenshots.length,
        stateCheckCount
      );

      if (estimatedCost >= this.config.maxBudget * 0.9) {
        this.logger.warn('Approaching budget limit', {
          estimatedCost,
          budgetLimit: this.config.maxBudget * 0.9,
        });
        completionReason = 'budget_limit';
        break;
      }

      // Ask LLM: "What should I do next?"
      const goal = i === 0
        ? 'Start the game and begin playing'
        : 'Continue playing and progress through the game';

      this.logger.info('Requesting action recommendation', { goal });

      const recommendation = await this.stateAnalyzer.analyzeAndRecommendAction({
        html: currentState.html,
        screenshot: currentState.screenshot.path,
        previousActions: actionHistory,
        metadata: this.metadata,
        goal,
      });

      this.logger.info('Received recommendation', {
        action: recommendation.action,
        confidence: recommendation.confidence,
        reasoning: recommendation.reasoning,
      });

      // Check if LLM says we're done
      if (recommendation.action === 'complete') {
        this.logger.info('LLM recommends completion', {
          reasoning: recommendation.reasoning,
        });
        completionReason = 'llm_complete';
        break;
      }

      // Execute recommended action
      const executed = await this.gameInteractor.executeRecommendationPublic(page, recommendation);

      if (executed) {
        const action: Action = {
          action: recommendation.action,
          target: recommendation.target,
          reasoning: recommendation.reasoning,
          timestamp: Date.now(),
        };
        actionHistory.push(action);

        // Log the action with full details
        this.logger.action(recommendation.action, {
          ...(recommendation.action === 'click' && typeof recommendation.target === 'object'
            ? { x: recommendation.target.x, y: recommendation.target.y }
            : { key: recommendation.target }),
          confidence: recommendation.confidence,
          reasoning: recommendation.reasoning,
        });
      } else {
        this.logger.warn('Recommendation execution failed, trying alternative', {
          action: recommendation.action,
        });

        // Try alternative if available
        if (recommendation.alternatives.length > 0) {
          const alternative = recommendation.alternatives[0];
          this.logger.info('Trying alternative action', {
            action: alternative.action,
            reasoning: alternative.reasoning,
          });

          const altExecuted = await this.gameInteractor.executeRecommendationPublic(page, {
            ...alternative,
            confidence: 0.5,
            alternatives: [],
          });

          if (altExecuted) {
            actionHistory.push({
              action: alternative.action,
              target: alternative.target,
              reasoning: alternative.reasoning,
              timestamp: Date.now(),
            });
          }
        }
      }

      // Wait for state change
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Capture new state
      const newState = await this.gameInteractor.captureCurrentState(page);
      screenshots.push(newState.screenshot.path);

      this.logger.action('screenshot', {
        stage: `iteration_${i + 1}`,
        path: newState.screenshot.path,
        timing: 'post_action',
      });

      // Check if state actually changed (detect stuck loops)
      stateCheckCount++;
      this.logger.debug('Checking state progression');
      const hasProgressed = await this.stateAnalyzer.hasStateProgressed(
        currentState.screenshot.path,
        newState.screenshot.path
      );

      if (!hasProgressed && actionHistory.length > 0) {
        this.logger.warn('State has not progressed - may be stuck', {
          lastAction: actionHistory[actionHistory.length - 1].action,
          iteration: i + 1,
        });
      } else if (hasProgressed) {
        this.logger.info('State progressed successfully');
      }

      currentState = newState;
    }

    const finalCost = calculateEstimatedCost(
      actionHistory.length,
      screenshots.length,
      stateCheckCount
    );

    this.logger.endPhase(TestPhase.ADAPTIVE_QA_LOOP, {
      actionsPerformed: actionHistory.length,
      screenshotsCaptured: screenshots.length,
      stateChecks: stateCheckCount,
      estimatedCost: finalCost,
      completionReason,
    });

    return {
      screenshots,
      actionHistory,
      stateCheckCount,
      estimatedCost: finalCost,
      completionReason,
    };
  }
}
```

**3.2 Update main.ts**

```typescript
// In runAdaptiveQA function, replace the entire loop (lines 554-668) with:

import { AdaptiveQALoop } from './core/adaptive-qa-loop';

// ... later in function:

const adaptiveLoop = new AdaptiveQALoop(
  logger,
  stateAnalyzer,
  gameInteractor,
  adaptiveConfig,
  metadata
);

const loopResult = await adaptiveLoop.run(page);

const screenshots = loopResult.screenshots;
const actionHistory = loopResult.actionHistory;
const stateCheckCount = loopResult.stateCheckCount;
```

---

## Phase 4: Screenshot Timing Fix (P3 - 1 hour)

### **4.1 Add Pre-Start Screenshot**

**Changes to `src/main.ts` (Standard QA):**

```typescript
// BEFORE (current - around line 173-192):
try {
  const startButtonClicked = await gameInteractor.findAndClickStart(page);
  // ...
} catch (error) {
  // ...
}

// Capture initial screenshot
const initialScreenshot = await screenshotCapturer.capture(page, 'initial_load');

// AFTER (refactored):

// Capture pre-start screenshot (TRUE baseline before any interaction)
logger.beginPhase(TestPhase.SCREENSHOT_CAPTURE, { stage: 'pre_start' });
const preStartScreenshot = await screenshotCapturer.capture(page, 'pre_start');
logger.action('screenshot', {
  stage: 'pre_start',
  path: preStartScreenshot.path,
  timing: 'before_start_button',
});
logger.endPhase(TestPhase.SCREENSHOT_CAPTURE, { screenshotId: preStartScreenshot.id });

// Find and click start button
try {
  const startButtonClicked = await gameInteractor.findAndClickStart(page);
  // ...
} catch (error) {
  // ...
}

// Capture post-start screenshot (after start button clicked)
logger.beginPhase(TestPhase.SCREENSHOT_CAPTURE, { stage: 'post_start' });
const postStartScreenshot = await screenshotCapturer.capture(page, 'post_start');
logger.action('screenshot', {
  stage: 'post_start',
  path: postStartScreenshot.path,
  timing: 'after_start_button',
});
logger.endPhase(TestPhase.SCREENSHOT_CAPTURE, { screenshotId: postStartScreenshot.id });

// ... later, capture final screenshot after gameplay

// Update vision analysis to use all 3 screenshots:
const visionResult = await visionAnalyzer.analyzeScreenshots([
  preStartScreenshot,    // Before start
  postStartScreenshot,   // After start
  finalScreenshot        // After gameplay
], metadata);
```

**4.2 Update Screenshot Types**

`src/types/game-test.types.ts`:
```typescript
export type ScreenshotStage =
  | 'pre_start'           // NEW: Before any interaction
  | 'post_start'          // NEW: After start button (was 'initial_load')
  | 'after_interaction'   // After gameplay
  | 'final_state';        // End of test
```

**4.3 Update Vision Prompt**

`src/vision/prompts.ts`:
```typescript
export const GAME_ANALYSIS_PROMPT = `You are analyzing a sequence of screenshots from a browser game test to determine playability and identify issues.

**Screenshot Sequence:**
- Screenshot 1: Pre-start (taken before clicking start button) - shows initial landing page
- Screenshot 2: Post-start (taken after clicking start button) - shows game in initial playing state
- Screenshot 3: Final game state (taken at the end of the test) - shows game after interaction

**Evaluation Criteria:**
// ... rest of prompt
`;
```

---

## Phase 5: Error Handling Improvements (P2 - 2 hours)

### **5.1 Structured Error Types**

**New File:** `src/utils/errors.ts`

```typescript
import { TestPhase } from './logger';

export enum ErrorCategory {
  BROWSER_INIT = 'browser_init',
  NAVIGATION = 'navigation',
  GAME_DETECTION = 'game_detection',
  START_BUTTON = 'start_button',
  GAMEPLAY = 'gameplay',
  SCREENSHOT = 'screenshot',
  VISION_API = 'vision_api',
  STATE_ANALYSIS = 'state_analysis',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown',
}

export class QAError extends Error {
  constructor(
    message: string,
    public readonly category: ErrorCategory,
    public readonly phase: TestPhase,
    public readonly recoverable: boolean = false,
    public readonly context?: object
  ) {
    super(message);
    this.name = 'QAError';
  }
}

export function categorizeError(error: unknown, phase: TestPhase): QAError {
  if (error instanceof QAError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  // Categorize based on message patterns
  if (message.includes('timeout') || message.includes('timed out')) {
    return new QAError(message, ErrorCategory.TIMEOUT, phase, true);
  }

  if (message.includes('screenshot')) {
    return new QAError(message, ErrorCategory.SCREENSHOT, phase, true);
  }

  if (message.includes('OpenAI') || message.includes('API')) {
    return new QAError(message, ErrorCategory.VISION_API, phase, true);
  }

  if (message.includes('navigation') || message.includes('navigate')) {
    return new QAError(message, ErrorCategory.NAVIGATION, phase, false);
  }

  if (message.includes('browser') || message.includes('Browserbase')) {
    return new QAError(message, ErrorCategory.BROWSER_INIT, phase, false);
  }

  return new QAError(message, ErrorCategory.UNKNOWN, phase, false);
}
```

**5.2 Error Handling Pattern**

Update error handling throughout the codebase:

```typescript
// In main.ts and other modules:

import { categorizeError, QAError, ErrorCategory } from './utils/errors';

try {
  // ... operation
} catch (error) {
  const qaError = categorizeError(error, TestPhase.CURRENT_PHASE);

  logger.error(`${qaError.category} error in ${qaError.phase}`, {
    message: qaError.message,
    recoverable: qaError.recoverable,
    context: qaError.context,
  });

  if (!qaError.recoverable) {
    throw qaError; // Fatal error, abort
  }

  // Continue with degraded functionality
  logger.warn('Continuing with degraded functionality');
}
```

**5.3 Update core/index.ts**

```typescript
export * from './browser-manager';
export * from './game-detector';
export * from './game-interactor';
export * from './screenshot-capturer';
export * from './error-monitor';
export * from './state-analyzer';
export * from './input-schema-parser';
export * from './start-detection'; // NEW
export * from './adaptive-qa-loop'; // NEW
```

---

## Phase 6: Implementation Plan

### **Step-by-Step Execution Order**

```bash
# 1. Create new branch
git checkout -b refactor/logging-and-separation

# 2. Phase 1: Logging Infrastructure (2 hours)
- Update src/utils/logger.ts
  - Add TestPhase enum
  - Add LogLevel enum
  - Add beginPhase(), endPhase() methods
  - Add action() method with ActionDetails formatting
  - Add level-based logging methods (error, warn, info, debug, trace)
  - Add logLevel property and initialization
- Add LOG_LEVEL to .env.example
- Test logging output manually with a simple test

# 3. Phase 2: Start Button Detection (3 hours)
- Create src/core/start-detection/ directory
- Implement base-strategy.ts
- Implement dom-strategy.ts
- Implement natural-language-strategy.ts
- Implement vision-strategy.ts
- Implement state-analysis-strategy.ts
- Implement start-detector.ts (orchestrator)
- Create index.ts
- Update game-interactor.ts (remove old findAndClickStart, add new one)
- Update src/core/index.ts to export start-detection
- Test start button detection against test games

# 4. Phase 3: Adaptive QA Loop (3 hours)
- Create src/core/adaptive-qa-loop.ts
- Extract loop logic from main.ts
- Update main.ts to use AdaptiveQALoop
- Update src/core/index.ts to export AdaptiveQALoop
- Test adaptive QA mode

# 5. Phase 4: Screenshot Timing (1 hour)
- Update main.ts screenshot capture flow (add pre_start, post_start)
- Update ScreenshotStage type in game-test.types.ts
- Update GAME_ANALYSIS_PROMPT in vision/prompts.ts
- Test screenshot sequence and vision analysis

# 6. Phase 5: Error Handling (2 hours)
- Create src/utils/errors.ts
- Update error handling in main.ts
- Update error handling in strategies
- Update error handling in adaptive-qa-loop.ts
- Test error scenarios (timeout, API failure, etc.)

# 7. Testing & Validation (2 hours)
- Test Standard QA mode end-to-end with test games
- Test Adaptive QA mode end-to-end with test games
- Verify logging output clarity (can identify issues quickly)
- Test error scenarios (timeout, missing API keys, etc.)
- Compare playability scores against original implementation
- Verify screenshot timing (3 shots: pre_start, post_start, final)

# 8. Code Review & Cleanup (1 hour)
- Review all new code for consistency
- Remove any unused imports
- Ensure all files have proper exports
- Check TypeScript types are correct
- Run `bun run build` to verify compilation

# 9. Commit & Document (30 min)
- Commit changes with descriptive message
- Update control-flow.md if needed
- Create PR description with before/after logs
```

---

## Expected Outcomes

### **Before Refactor:**
```
[INFO] Initializing browser manager
[INFO] Browser initialized successfully
[INFO] Navigating to game URL
[INFO] Navigation completed
[INFO] Error monitoring started
[INFO] Game type detected
[INFO] Game ready state confirmed
[INFO] Vision analyzer initialized
[INFO] State analyzer initialized
[INFO] Finding and clicking start button
[DEBUG] DOM selector failed
[DEBUG] DOM selector failed
[DEBUG] DOM selector failed
... (28 more lines)
[INFO] Start button found using DOM selector
[DEBUG] Post-click delay completed (DOM selector)
[INFO] Capturing initial screenshot
[INFO] Initial screenshot captured
[INFO] Starting gameplay simulation
... (hundreds more lines in Adaptive QA)
```

### **After Refactor:**
```
============================================================
=== BEGIN INITIALIZATION ===
============================================================
[INFO] Phase details: { browserbaseProjectId: "xxx", hasOpenAI: true }
[INFO] Browser manager initialized
[INFO] Browser connected
============================================================
=== END INITIALIZATION ===
============================================================

============================================================
=== BEGIN START BUTTON DETECTION ===
============================================================
[INFO] Phase details: { strategies: ['dom', 'natural_language', 'vision', 'state_analysis'], timeout: 90000 }
[INFO] Trying strategy 1/4: dom
[INFO] ACTION: click { coordinates: "(512, 384)", target: "#start-btn", strategy: "dom" }
[INFO] Strategy succeeded: dom
[INFO] Phase summary: { success: true, strategy: 'dom', totalAttempts: 12, totalDuration: 234 }
============================================================
=== END START BUTTON DETECTION ===
============================================================

============================================================
=== BEGIN SCREENSHOT CAPTURE ===
============================================================
[INFO] Phase details: { stage: "pre_start" }
[INFO] ACTION: screenshot { stage: "pre_start", path: "/tmp/...", timing: "before_start_button" }
============================================================
=== END SCREENSHOT CAPTURE ===
============================================================

============================================================
=== BEGIN ADAPTIVE QA LOOP ===
============================================================
[INFO] Phase details: { maxActions: 20, maxDuration: 240000, maxBudget: 0.5 }
[INFO] ACTION: screenshot { stage: "initial", path: "/tmp/...", timing: "loop_start" }

[INFO]
--- Iteration 1/20 ---
[INFO] Iteration details: { elapsed: 123, actionsPerformed: 0, screenshotsCaptured: 1 }
[INFO] Requesting action recommendation: { goal: "Start the game and begin playing" }
[INFO] Received recommendation: { action: 'click', confidence: 0.92, reasoning: "..." }
[INFO] ACTION: click { coordinates: "(400, 300)", confidence: 0.92, reasoning: "Door to next level" }
[INFO] ACTION: screenshot { stage: "iteration_1", path: "/tmp/...", timing: "post_action" }
[INFO] State progressed successfully

[INFO]
--- Iteration 2/20 ---
[INFO] Iteration details: { elapsed: 2456, actionsPerformed: 1, screenshotsCaptured: 2 }
... (clear separation between iterations)

[INFO] Phase summary: { actionsPerformed: 15, screenshotsCaptured: 16, estimatedCost: 0.35, completionReason: 'llm_complete' }
============================================================
=== END ADAPTIVE QA LOOP ===
============================================================
```

### **Debugging Example:**

**Scenario:** Start button detection fails

**Before (hard to find):**
```
[DEBUG] DOM selector failed
[DEBUG] DOM selector failed
... (scroll through 50+ lines)
[INFO] Start button not found - continuing with test anyway
```

**After (immediately visible):**
```
============================================================
=== BEGIN START BUTTON DETECTION ===
============================================================
[INFO] Trying strategy 1/4: dom
[WARN] Strategy failed: dom { attempts: 29, error: "No selectors matched" }
[INFO] Trying strategy 2/4: natural_language
[WARN] Strategy failed: natural_language { attempts: 4, error: "All phrases failed" }
[INFO] Trying strategy 3/4: vision
[WARN] Strategy failed: vision { attempts: 1, error: "No start/play buttons found" }
[INFO] Trying strategy 4/4: state_analysis
[ERROR] state_analysis error in start_button_detection { message: "OpenAI API timeout", recoverable: true }
[INFO] Phase summary: { success: false, strategiesTried: 4 }
============================================================
=== END START BUTTON DETECTION ===
============================================================
```

**Finding the issue:** Within 5 seconds, you can see all 4 strategies failed and why.

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| **Breaking existing functionality** | Work on separate branch, validate against existing test games before merge |
| **Performance degradation** | Profile before/after, ensure no extra LLM calls added |
| **Log verbosity still too high** | Start with INFO level by default, users can set DEBUG/TRACE if needed |
| **Strategy pattern over-engineering** | Keep each strategy simple (~100-150 lines max) |
| **Screenshot timing breaks vision analysis** | Test vision analysis prompt with new 3-shot sequence (pre_start, post_start, final) |
| **Adaptive loop extraction breaks functionality** | Test adaptive QA thoroughly before/after extraction |
| **Merge conflicts if other work in progress** | Create refactor branch early, communicate with team |

---

## Success Criteria

✅ **Logging:** Given a log file, developer can identify the exact phase and action where failure occurred within 30 seconds

✅ **Code Separation:** Start button strategies are in separate files (`src/core/start-detection/`), each <150 lines

✅ **Code Separation:** Adaptive loop is extracted to its own class (`src/core/adaptive-qa-loop.ts`), main.ts is <400 lines

✅ **Maintainability:** Adding a new start button strategy requires:
  - Creating 1 new file (`new-strategy.ts`)
  - Adding 1 line to `start-detector.ts` constructor
  - Adding 1 line to feature flags (optional)

✅ **Functionality:** All existing test games pass with same or better playability scores

✅ **Screenshot Timing:** Vision analysis receives true pre-start baseline screenshot

✅ **Error Clarity:** Errors are categorized and clearly indicate if they're recoverable

✅ **Log Levels:** Setting `LOG_LEVEL=info` reduces log noise by 80%+ compared to current implementation

---

## Timeline Estimate

| Phase | Estimated Time | Priority |
|-------|---------------|----------|
| Phase 1: Logging Infrastructure | 2 hours | P1 |
| Phase 2: Start Detection Separation | 3 hours | P1 |
| Phase 3: Adaptive Loop Extraction | 3 hours | P1 |
| Phase 4: Screenshot Timing Fix | 1 hour | P3 |
| Phase 5: Error Handling | 2 hours | P2 |
| Testing & Validation | 2 hours | - |
| Code Review & Cleanup | 1 hour | - |
| **Total** | **14 hours** | - |

---

## Post-Refactor Benefits

1. **Debugging Speed:** 5-10x faster to identify issues from logs
2. **Code Navigation:** 3x faster to find relevant code (clear file structure)
3. **Adding Features:** 2x faster to add new strategies (just add one file)
4. **Maintenance:** 5x easier to modify one strategy without affecting others
5. **Testing:** 10x easier to unit test individual strategies
6. **Onboarding:** New developers can understand flow in <30 minutes (vs 2+ hours)

---

## Notes

- This plan prioritizes logging and code separation (P1) over documentation (P4)
- Screenshot timing fix is P3 because it's a minor enhancement, not critical
- All changes are backward-compatible with existing `.env` and metadata files (except metadata can be rewritten if needed)
- The refactor preserves all functionality while improving maintainability
- Work happens on `refactor/logging-and-separation` branch to preserve current state

---

**Next Steps:**

1. Review and approve this plan
2. Create branch: `git checkout -b refactor/logging-and-separation`
3. Begin with Phase 1 (Logging Infrastructure)
