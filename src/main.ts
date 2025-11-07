/**
 * DreamUp - Autonomous Game QA Agent
 * Entry point for CLI and Lambda handler
 * 
 * This module provides the main orchestration function `runQA()` that executes
 * automated QA testing of browser-based games. It handles browser initialization,
 * navigation, screenshot capture, and result reporting.
 * 
 * @module main
 */

import { nanoid } from 'nanoid';
import { resolve } from 'path';
import { BrowserManager, GameInteractor, ScreenshotCapturer, GameDetector, ErrorMonitor, GameType, StateAnalyzer } from './core';
import { VisionAnalyzer } from './vision';
import { FileManager } from './utils/file-manager';
import { Logger } from './utils/logger';
import { TIMEOUTS, THRESHOLDS, STAGEHAND_AGENT_DEFAULTS } from './config/constants';
import { getFeatureFlags } from './config/feature-flags';
import { validateGameMetadata } from './schemas/metadata.schema';
import { calculateEstimatedCost, mergeAdaptiveConfig } from './utils/adaptive-qa';
import { buildStagehandInstruction, buildStagehandSystemPrompt, extractScreenshotsFromActions } from './utils/stagehand-agent';
import { withTimeout } from './utils/timeout';
import { OpenRouterProvider } from './services/openrouter-provider';
import { AISdkClient } from '@browserbasehq/stagehand';
import type { GameTestResult, Issue, GameTestRequest, GameMetadata, InputSchema, TestConfig, Action, Screenshot } from './types/game-test.types';

/**
 * Run QA test on a game URL.
 * 
 * This is the main orchestration function that performs automated QA testing
 * of a browser-based game. It initializes a browser session, navigates to
 * the game URL, captures a screenshot, and returns a test result.
 * 
 * @param gameUrl - The URL of the game to test
 * @param request - Optional GameTestRequest containing metadata or inputSchema (for backwards compat)
 * @returns Promise that resolves to GameTestResult
 * 
 * @example
 * ```typescript
 * const result = await runQA('https://example.com/game');
 * console.log(`Test status: ${result.status}`);
 * console.log(`Screenshots: ${result.screenshots.length}`);
 * ```
 */
export async function runQA(gameUrl: string, request?: Partial<GameTestRequest>): Promise<GameTestResult> {
  const startTime = Date.now();
  const sessionId = nanoid();
  const logger = new Logger({
    module: 'qa-agent',
    op: 'runQA',
    correlationId: sessionId,
  });

  logger.info('Starting QA test', { gameUrl, sessionId });

  const fileManager = new FileManager(sessionId);
  let browserManager: BrowserManager | null = null;
  let errorMonitor: ErrorMonitor | null = null;
  let gameType: GameType = GameType.UNKNOWN;
  let visionAnalyzer: VisionAnalyzer | null = null;
  let stateAnalyzer: StateAnalyzer | null = null;

  try {
    // Validate environment variables
    const browserbaseApiKey = process.env.BROWSERBASE_API_KEY;
    const browserbaseProjectId = process.env.BROWSERBASE_PROJECT_ID;

    if (!browserbaseApiKey || !browserbaseProjectId) {
      throw new Error('Missing required environment variables: BROWSERBASE_API_KEY and/or BROWSERBASE_PROJECT_ID');
    }

    // Initialize browser
    logger.info('Initializing browser manager', {});
    browserManager = new BrowserManager({
      apiKey: browserbaseApiKey,
      projectId: browserbaseProjectId,
      logger,
    });

    const page = await browserManager.initialize();
    logger.info('Browser initialized successfully', {});

    // Navigate to game URL
    logger.info('Navigating to game URL', { gameUrl });
    await browserManager.navigate(gameUrl);
    logger.info('Navigation completed', {});

    // Initialize game detector and error monitor
    const gameDetector = new GameDetector({ logger });
    errorMonitor = new ErrorMonitor({ logger });

    // Start error monitoring (early to capture loading errors)
    try {
      await errorMonitor.startMonitoring(page);
      logger.info('Error monitoring started', {});
    } catch (error) {
      logger.warn('Failed to start error monitoring', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Detect game type
    try {
      gameType = await gameDetector.detectType(page);
      logger.info('Game type detected', { gameType });
    } catch (error) {
      logger.warn('Failed to detect game type', {
        error: error instanceof Error ? error.message : String(error),
      });
      gameType = GameType.UNKNOWN;
    }

    // Wait for game to be ready before interaction
    try {
      await gameDetector.waitForGameReady(page, TIMEOUTS.GAME_LOAD_TIMEOUT);
      logger.info('Game ready state confirmed', {});
    } catch (error) {
      logger.warn('Failed to confirm game ready state', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue anyway - game may still be functional
    }

    // Initialize vision analyzer (optional - requires OPENAI_API_KEY)
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (openaiApiKey) {
        visionAnalyzer = new VisionAnalyzer({ logger, apiKey: openaiApiKey });
        logger.info('Vision analyzer initialized', {});
        
        // Initialize state analyzer (same API key)
        stateAnalyzer = new StateAnalyzer({ logger, apiKey: openaiApiKey });
        logger.info('State analyzer initialized', {});
      } else {
        logger.warn('OPENAI_API_KEY not found - vision and state analysis will be skipped', {});
      }
    } catch (error) {
      logger.warn('Failed to initialize vision/state analyzers', {
        error: error instanceof Error ? error.message : String(error),
      });
      visionAnalyzer = null;
      stateAnalyzer = null;
    }

    // Initialize screenshot capturer and game interactor
    const screenshotCapturer = new ScreenshotCapturer({ logger, fileManager });
    
    // Extract metadata from request (handle both metadata and deprecated inputSchema)
    let metadata: GameMetadata | undefined = undefined;
    if (request) {
      if (request.metadata) {
        metadata = request.metadata;
      } else if (request.inputSchema) {
        // Backwards compatibility: convert inputSchema to metadata
        metadata = {
          inputSchema: request.inputSchema,
        };
      }
    }
    
    const gameInteractor = new GameInteractor({
      logger,
      visionAnalyzer: visionAnalyzer ?? undefined,
      screenshotCapturer,
      stateAnalyzer: stateAnalyzer ?? undefined,
      metadata,
    });

    // Use testingStrategy.waitBeforeInteraction if available
    const waitBeforeInteraction = metadata?.testingStrategy?.waitBeforeInteraction ?? 0;
    if (waitBeforeInteraction > 0) {
      logger.info('Waiting before interaction', { waitMs: waitBeforeInteraction });
      await new Promise(resolve => setTimeout(resolve, waitBeforeInteraction));
    }

    // Try to find and click start button before interaction
    try {
      const startButtonClicked = await gameInteractor.findAndClickStart(page);
      if (startButtonClicked) {
        logger.info('Start button found and clicked', {});
      } else {
        logger.warn('Start button not found - continuing with test anyway', {});
      }
    } catch (error) {
      logger.warn('Failed to find and click start button', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue anyway - start button may not be required
    }

    // Capture initial screenshot (using metadata-based timing if available)
    logger.info('Capturing initial screenshot', { hasMetadata: !!metadata });
    const initialScreenshot = metadata
      ? await screenshotCapturer.captureAtOptimalTime(page, 'initial_load', metadata)
      : await screenshotCapturer.capture(page, 'initial_load');
    logger.info('Initial screenshot captured', {
      screenshotId: initialScreenshot.id,
      screenshotPath: initialScreenshot.path,
    });

    // Simulate gameplay inputs (use metadata if available, otherwise generic inputs)
    const interactionDuration = metadata?.testingStrategy?.interactionDuration ?? 30000;
    logger.info('Starting gameplay simulation', { 
      duration: interactionDuration,
      hasMetadata: !!metadata,
    });
    
    if (metadata) {
      await gameInteractor.simulateGameplayWithMetadata(page, metadata, interactionDuration);
    } else {
      await gameInteractor.simulateKeyboardInput(page, interactionDuration);
    }
    
    logger.info('Gameplay simulation completed', {});

    // Capture screenshot after interaction (using metadata-based timing if available)
    logger.info('Capturing screenshot after interaction', { hasMetadata: !!metadata });
    const afterInteractionScreenshot = metadata
      ? await screenshotCapturer.captureAtOptimalTime(page, 'after_interaction', metadata)
      : await screenshotCapturer.capture(page, 'after_interaction');
    logger.info('Screenshot after interaction captured', {
      screenshotId: afterInteractionScreenshot.id,
      screenshotPath: afterInteractionScreenshot.path,
    });

    // Capture final screenshot
    logger.info('Capturing final screenshot', {});
    const finalScreenshot = await screenshotCapturer.capture(page, 'final_state');
    logger.info('Final screenshot captured', {
      screenshotId: finalScreenshot.id,
      screenshotPath: finalScreenshot.path,
    });

    // Retrieve console errors before stopping monitoring
    let consoleErrors: Array<{ message: string; timestamp: number; level: 'error' | 'warning' }> = [];
    if (errorMonitor) {
      try {
        consoleErrors = await errorMonitor.getErrors(page);
        logger.info('Console errors retrieved', { errorCount: consoleErrors.length });
      } catch (error) {
        logger.warn('Failed to retrieve console errors', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Perform vision analysis if available
    let playabilityScore = 50; // Default score
    let visionIssues: Issue[] = [];
    let visionAnalysisTokens: number | undefined;

    if (visionAnalyzer) {
      try {
        logger.info('Starting vision analysis', {
          screenshotCount: 3,
        });

        const visionResult = await visionAnalyzer.analyzeScreenshots([
          initialScreenshot,
          afterInteractionScreenshot,
          finalScreenshot,
        ], metadata);

        playabilityScore = visionResult.playability_score;
        visionIssues = visionResult.issues;
        visionAnalysisTokens = visionResult.metadata?.visionAnalysisTokens;

        logger.info('Vision analysis completed', {
          playabilityScore,
          issueCount: visionIssues.length,
          tokens: visionAnalysisTokens,
        });
      } catch (error) {
        logger.warn('Vision analysis failed - using default score', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with default score
      }
    }

    // Determine pass/fail status based on score
    const status: 'pass' | 'fail' = playabilityScore >= 50 ? 'pass' : 'fail';

    // Calculate test duration
    const duration = Date.now() - startTime;

    // Create result with all screenshots and metadata
    const result: GameTestResult = {
      status,
      playability_score: playabilityScore,
      issues: visionIssues,
      screenshots: [
        initialScreenshot.path,
        afterInteractionScreenshot.path,
        finalScreenshot.path,
      ],
      timestamp: new Date().toISOString(),
      metadata: {
        sessionId,
        gameUrl,
        duration,
        gameType,
        consoleErrors,
        ...(visionAnalysisTokens !== undefined && { visionAnalysisTokens }),
      },
    };

    logger.info('QA test completed successfully', {
      status: result.status,
      playabilityScore: result.playability_score,
      screenshotCount: result.screenshots.length,
    });

    return result;

  } catch (error) {
    logger.error('QA test failed', {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });

    // Create error result
    const errorIssue: Issue = {
      severity: 'critical',
      description: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };

    // Try to retrieve console errors even on error
    let consoleErrors: Array<{ message: string; timestamp: number; level: 'error' | 'warning' }> = [];
    if (errorMonitor) {
      try {
        const page = browserManager?.getPage();
        if (page) {
          consoleErrors = await errorMonitor.getErrors(page);
        }
      } catch {
        // Ignore errors when retrieving errors on failure
      }
    }

    const duration = Date.now() - startTime;
    const errorResult: GameTestResult = {
      status: 'error',
      playability_score: 0,
      issues: [errorIssue],
      screenshots: [],
      timestamp: new Date().toISOString(),
      metadata: {
        sessionId,
        gameUrl,
        duration,
        gameType: GameType.UNKNOWN, // Default to UNKNOWN on error
        consoleErrors,
      },
    };

    return errorResult;

  } finally {
    // Stop error monitoring before cleanup
    if (errorMonitor && browserManager) {
      try {
        const page = browserManager.getPage();
        if (page) {
          await errorMonitor.stopMonitoring(page);
          logger.info('Error monitoring stopped', {});
        }
      } catch (error) {
        logger.warn('Failed to stop error monitoring', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Cleanup files if cleanup flag is enabled
    const flags = getFeatureFlags();
    if (flags.enableScreenshotCleanup) {
      try {
        logger.info('Cleaning up session files', { sessionId });
        await fileManager.cleanup(flags.enableScreenshotCleanup);
        logger.info('Session files cleaned up', {});
      } catch (cleanupError) {
        logger.warn('Error during file cleanup', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
    }

    // Always cleanup browser
    if (browserManager) {
      try {
        logger.info('Cleaning up browser session', {});
        await browserManager.cleanup();
        logger.info('Browser cleanup completed', {});
      } catch (cleanupError) {
        logger.warn('Error during browser cleanup', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
    }
  }
}

/**
 * Run adaptive QA test on a game URL using iterative action loop.
 * 
 * This function implements Phase 3 of the migration plan: full adaptive gameplay
 * with state progression awareness. It uses LLM to recommend actions iteratively,
 * tracks state progression, and respects budget limits.
 * 
 * @param gameUrl - The URL of the game to test
 * @param request - Optional GameTestRequest containing metadata and adaptiveConfig
 * @returns Promise that resolves to GameTestResult
 * 
 * @example
 * ```typescript
 * const result = await runAdaptiveQA('https://example.com/game', {
 *   metadata: { ... },
 *   adaptiveConfig: { maxBudget: 0.50, maxActions: 20 }
 * });
 * ```
 */
export async function runAdaptiveQA(
  gameUrl: string,
  request?: Partial<GameTestRequest>
): Promise<GameTestResult> {
  const startTime = Date.now();
  const sessionId = nanoid();
  const logger = new Logger({
    module: 'qa-agent',
    op: 'runAdaptiveQA',
    correlationId: sessionId,
  });

  logger.info('Starting adaptive QA test', { gameUrl, sessionId });

  const fileManager = new FileManager(sessionId);
  let browserManager: BrowserManager | null = null;
  let errorMonitor: ErrorMonitor | null = null;
  let gameType: GameType = GameType.UNKNOWN;
  let visionAnalyzer: VisionAnalyzer | null = null;
  let stateAnalyzer: StateAnalyzer | null = null;

  try {
    // Validate environment variables
    const browserbaseApiKey = process.env.BROWSERBASE_API_KEY;
    const browserbaseProjectId = process.env.BROWSERBASE_PROJECT_ID;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!browserbaseApiKey || !browserbaseProjectId) {
      throw new Error('Missing required environment variables: BROWSERBASE_API_KEY and/or BROWSERBASE_PROJECT_ID');
    }

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY required for adaptive QA mode');
    }

    // Merge adaptive config with defaults
    const adaptiveConfig = mergeAdaptiveConfig(request?.adaptiveConfig);
    logger.info('Adaptive config', {
      maxBudget: adaptiveConfig.maxBudget,
      maxDuration: adaptiveConfig.maxDuration,
      maxActions: adaptiveConfig.maxActions,
      screenshotStrategy: adaptiveConfig.screenshotStrategy,
      llmCallStrategy: adaptiveConfig.llmCallStrategy,
    });

    // Initialize browser
    logger.info('Initializing browser manager', {});
    browserManager = new BrowserManager({
      apiKey: browserbaseApiKey,
      projectId: browserbaseProjectId,
      logger,
    });

    const page = await browserManager.initialize();
    logger.info('Browser initialized successfully', {});

    // Navigate to game URL
    logger.info('Navigating to game URL', { gameUrl });
    await browserManager.navigate(gameUrl);
    logger.info('Navigation completed', {});

    // Initialize game detector and error monitor
    const gameDetector = new GameDetector({ logger });
    errorMonitor = new ErrorMonitor({ logger });

    // Start error monitoring
    try {
      await errorMonitor.startMonitoring(page);
      logger.info('Error monitoring started', {});
    } catch (error) {
      logger.warn('Failed to start error monitoring', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Detect game type
    try {
      gameType = await gameDetector.detectType(page);
      logger.info('Game type detected', { gameType });
    } catch (error) {
      logger.warn('Failed to detect game type', {
        error: error instanceof Error ? error.message : String(error),
      });
      gameType = GameType.UNKNOWN;
    }

    // Wait for game to be ready
    try {
      await gameDetector.waitForGameReady(page, TIMEOUTS.GAME_LOAD_TIMEOUT);
      logger.info('Game ready state confirmed', {});
    } catch (error) {
      logger.warn('Failed to confirm game ready state', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Initialize vision and state analyzers (required for adaptive mode)
    visionAnalyzer = new VisionAnalyzer({ logger, apiKey: openaiApiKey });
    stateAnalyzer = new StateAnalyzer({ logger, apiKey: openaiApiKey });
    logger.info('Vision and state analyzers initialized', {});

    // Initialize screenshot capturer and game interactor
    const screenshotCapturer = new ScreenshotCapturer({ logger, fileManager });

    // Extract metadata from request
    let metadata: GameMetadata | undefined = undefined;
    if (request) {
      if (request.metadata) {
        metadata = request.metadata;
      }
    }

    const gameInteractor = new GameInteractor({
      logger,
      visionAnalyzer,
      screenshotCapturer,
      stateAnalyzer,
      metadata,
    });

    // Wait before interaction if specified
    const waitBeforeInteraction = metadata?.testingStrategy?.waitBeforeInteraction ?? 0;
    if (waitBeforeInteraction > 0) {
      logger.info('Waiting before interaction', { waitMs: waitBeforeInteraction });
      await new Promise(resolve => setTimeout(resolve, waitBeforeInteraction));
    }

    // Capture initial state
    logger.info('Capturing initial state', {});
    let currentState = await gameInteractor.captureCurrentState(page);
    const screenshots: string[] = [currentState.screenshot.path];
    const actionHistory: Action[] = [];

    // Adaptive loop
    const loopStartTime = Date.now();
    let stateCheckCount = 0;

    for (let i = 0; i < adaptiveConfig.maxActions; i++) {
      // Check duration limit
      const elapsed = Date.now() - loopStartTime;
      if (elapsed >= adaptiveConfig.maxDuration) {
        logger.info('Max duration reached, stopping adaptive loop', {
          elapsed,
          maxDuration: adaptiveConfig.maxDuration,
        });
        break;
      }

      logger.info('Adaptive loop iteration', {
        iteration: i + 1,
        actionsPerformed: actionHistory.length,
        elapsed,
      });

      // Check budget
      const estimatedCost = calculateEstimatedCost(
        actionHistory.length,
        screenshots.length,
        stateCheckCount
      );
      if (estimatedCost >= adaptiveConfig.maxBudget * 0.9) {
        logger.warn('Approaching budget limit, stopping adaptive loop', {
          estimatedCost,
          maxBudget: adaptiveConfig.maxBudget,
        });
        break;
      }

      // Ask LLM: "What should I do next?"
      const goal = i === 0
        ? 'Start the game and begin playing'
        : 'Continue playing and progress through the game';

      const recommendation = await stateAnalyzer.analyzeAndRecommendAction({
        html: currentState.html,
        screenshot: currentState.screenshot.path,
        previousActions: actionHistory,
        metadata,
        goal,
      });

      // Check if LLM says we're done
      if (recommendation.action === 'complete') {
        logger.info('LLM recommends completing test', {
          reasoning: recommendation.reasoning,
        });
        break;
      }

      // Execute recommended action
      const executed = await gameInteractor.executeRecommendationPublic(page, recommendation);

      if (executed) {
        actionHistory.push({
          action: recommendation.action,
          target: recommendation.target,
          reasoning: recommendation.reasoning,
          timestamp: Date.now(),
        });
      } else {
        logger.warn('Recommendation execution failed, trying alternative', {
          action: recommendation.action,
        });

        // Try alternative if available
        if (recommendation.alternatives.length > 0) {
          const alternative = recommendation.alternatives[0];
          logger.info('Trying alternative action', {
            alternative: alternative.action,
          });
          const altExecuted = await gameInteractor.executeRecommendationPublic(page, {
            ...alternative,
            confidence: 0.5, // Lower confidence for alternatives
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
      const newState = await gameInteractor.captureCurrentState(page);
      screenshots.push(newState.screenshot.path);

      // Check if state actually changed (detect stuck loops)
      stateCheckCount++;
      const hasProgressed = await stateAnalyzer.hasStateProgressed(
        currentState.screenshot.path,
        newState.screenshot.path,
      );

      if (!hasProgressed && actionHistory.length > 0) {
        logger.warn('State has not progressed, may be stuck', {
          lastAction: actionHistory[actionHistory.length - 1].action,
        });
      }

      currentState = newState;
    }

    logger.info('Adaptive loop completed', {
      actionsPerformed: actionHistory.length,
      screenshotsCaptured: screenshots.length,
    });

    // Retrieve console errors
    let consoleErrors: Array<{ message: string; timestamp: number; level: 'error' | 'warning' }> = [];
    if (errorMonitor) {
      try {
        consoleErrors = await errorMonitor.getErrors(page);
        logger.info('Console errors retrieved', { errorCount: consoleErrors.length });
      } catch (error) {
        logger.warn('Failed to retrieve console errors', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Final vision analysis
    let playabilityScore = 50;
    let visionIssues: Issue[] = [];
    let visionAnalysisTokens: number | undefined;

    if (visionAnalyzer && screenshots.length > 0) {
      try {
        logger.info('Starting final vision analysis', {
          screenshotCount: screenshots.length,
        });

        // Convert screenshot paths to Screenshot objects for vision analyzer
        const screenshotObjects = screenshots.map((path, index): Screenshot => ({
          id: `screenshot-${index}`,
          path,
          timestamp: Date.now(),
          stage: (index === 0 ? 'initial_load' : index === screenshots.length - 1 ? 'final_state' : 'after_interaction') as 'initial_load' | 'after_interaction' | 'final_state',
        }));

        const visionResult = await visionAnalyzer.analyzeScreenshots(
          screenshotObjects,
          metadata
        );

        playabilityScore = visionResult.playability_score;
        visionIssues = visionResult.issues;
        visionAnalysisTokens = visionResult.metadata?.visionAnalysisTokens;

        logger.info('Final vision analysis completed', {
          playabilityScore,
          issueCount: visionIssues.length,
          tokens: visionAnalysisTokens,
        });
      } catch (error) {
        logger.warn('Final vision analysis failed - using default score', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Calculate final cost estimate
    const finalCost = calculateEstimatedCost(
      actionHistory.length,
      screenshots.length,
      stateCheckCount
    );

    // Determine pass/fail status
    const status: 'pass' | 'fail' = playabilityScore >= 50 ? 'pass' : 'fail';

    // Calculate test duration
    const duration = Date.now() - startTime;

    // Create result
    const result: GameTestResult = {
      status,
      playability_score: playabilityScore,
      issues: visionIssues,
      screenshots,
      timestamp: new Date().toISOString(),
      metadata: {
        sessionId,
        gameUrl,
        duration,
        gameType,
        consoleErrors,
        actionHistory,
        adaptiveConfig,
        estimatedCost: finalCost,
        ...(visionAnalysisTokens !== undefined && { visionAnalysisTokens }),
      },
    };

    logger.info('Adaptive QA test completed successfully', {
      status: result.status,
      playabilityScore: result.playability_score,
      actionsPerformed: actionHistory.length,
      screenshotsCaptured: screenshots.length,
      estimatedCost: finalCost,
    });

    return result;

  } catch (error) {
    logger.error('Adaptive QA test failed', {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });

    const errorIssue: Issue = {
      severity: 'critical',
      description: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };

    let consoleErrors: Array<{ message: string; timestamp: number; level: 'error' | 'warning' }> = [];
    if (errorMonitor) {
      try {
        const page = browserManager?.getPage();
        if (page) {
          consoleErrors = await errorMonitor.getErrors(page);
        }
      } catch {
        // Ignore
      }
    }

    const duration = Date.now() - startTime;
    const errorResult: GameTestResult = {
      status: 'error',
      playability_score: 0,
      issues: [errorIssue],
      screenshots: [],
      timestamp: new Date().toISOString(),
      metadata: {
        sessionId,
        gameUrl,
        duration,
        gameType: GameType.UNKNOWN,
        consoleErrors,
      },
    };

    return errorResult;

  } finally {
    // Stop error monitoring
    if (errorMonitor && browserManager) {
      try {
        const page = browserManager.getPage();
        if (page) {
          await errorMonitor.stopMonitoring(page);
        }
      } catch (error) {
        logger.warn('Failed to stop error monitoring', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Cleanup files if enabled
    const flags = getFeatureFlags();
    if (flags.enableScreenshotCleanup) {
      try {
        await fileManager.cleanup(flags.enableScreenshotCleanup);
      } catch (cleanupError) {
        logger.warn('Error during file cleanup', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
    }

    // Always cleanup browser
    if (browserManager) {
      try {
        await browserManager.cleanup();
      } catch (cleanupError) {
        logger.warn('Error during browser cleanup', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
    }
  }
}

/**
 * Run QA test using Stagehand's autonomous agent
 *
 * Uses Stagehand agent with OpenAI computer-use-preview model for fully autonomous
 * browser testing. Agent handles observe-act loop internally without manual state
 * management. Returns result with agent action history and final vision analysis.
 *
 * Mode Comparison:
 * - Standard QA: Single interaction cycle, fixed inputs, 2-4 min, $0.02-0.05
 * - Adaptive QA: Manual loop, state analysis each step, 2-4 min, $0.10-0.50
 * - Stagehand Agent: Autonomous loop, internal reasoning, 2-4 min, cost TBD
 *
 * @param gameUrl - URL of the game to test
 * @param metadata - Optional game metadata for instruction building
 * @param config - Optional configuration overrides
 * @returns Promise resolving to GameTestResult with agent action history
 *
 * @example
 * const result = await runStagehandAgentQA('https://example.com/game', metadata);
 * console.log(result.metadata.stagehandAgent.actionCount); // 12
 * console.log(result.metadata.stagehandAgent.success); // true
 *
 * @see https://docs.stagehand.dev/v3/basics/agent
 * @see https://platform.openai.com/docs/models/computer-use-preview
 * @see _docs/control-flow.md (comparison of QA modes)
 */
export async function runStagehandAgentQA(
  gameUrl: string,
  metadata?: GameMetadata,
  config?: Partial<TestConfig>
): Promise<GameTestResult> {
  const sessionId = nanoid();
  const startTime = Date.now();
  const logger = new Logger({
    module: 'qa-agent',
    op: 'runStagehandAgentQA',
    correlationId: sessionId,
  });
  let browserManager: BrowserManager | null = null;

  logger.info('Starting Stagehand Agent QA', {
    sessionId,
    gameUrl,
    hasMetadata: !!metadata,
  });

  try {
    // 1. Validate OpenAI API key (still needed for vision analysis)
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required for vision analysis');
    }

    // 2. Initialize OpenRouter provider
    const openRouterProvider = new OpenRouterProvider({
      logger,
      apiKey: config?.openrouter?.apiKey,
      agentModel: config?.openrouter?.agentModel,
      executionModel: config?.openrouter?.executionModel,
    });

    const { agentModel } = openRouterProvider.getModelConfig();

    logger.info('OpenRouter provider initialized', {
      sessionId,
      agentModel,
      hasExecutionModel: !!openRouterProvider.getExecutionModel(),
    });

    // 3. Create AI SDK model instance from OpenRouter
    const model = openRouterProvider.getAISdkModel();

    // 4. Create AISdkClient with OpenRouter model
    const llmClient = new AISdkClient({ model });

    logger.info('AISdkClient created with OpenRouter model', {
      sessionId,
      agentModel,
    });

    // 5. Determine environment (LOCAL or BROWSERBASE)
    // LOCAL env bypasses Browserbase API client, which may avoid modelApiKey requirement
    const useLocalEnv = process.env.STAGEHAND_ENV === 'LOCAL' || config?.env === 'LOCAL';
    const env: 'BROWSERBASE' | 'LOCAL' = useLocalEnv ? 'LOCAL' : 'BROWSERBASE';

    // 6. Validate Browserbase credentials (only required for BROWSERBASE)
    const browserbaseApiKey = process.env.BROWSERBASE_API_KEY;
    const browserbaseProjectId = process.env.BROWSERBASE_PROJECT_ID;

    if (env === 'BROWSERBASE' && (!browserbaseApiKey || !browserbaseProjectId)) {
      throw new Error('Missing required environment variables: BROWSERBASE_API_KEY and/or BROWSERBASE_PROJECT_ID');
    }

    // 7. Initialize browser with LLM client
    const fileManager = new FileManager(sessionId);
    browserManager = new BrowserManager({
      apiKey: browserbaseApiKey,
      projectId: browserbaseProjectId,
      env,  // Use LOCAL or BROWSERBASE
      logger,
      llmClient,  // Pass OpenRouter LLM client
      // modelApiKey only required for BROWSERBASE env (LOCAL doesn't call apiClient.init())
      modelApiKey: env === 'BROWSERBASE' ? openRouterProvider.getApiKey() : undefined,
    });

    const page = await withTimeout(
      browserManager.initialize(),
      TIMEOUTS.PAGE_NAVIGATION_TIMEOUT,
      'Browser initialization timeout'
    );

    logger.info('Browser initialized with OpenRouter LLM client', { sessionId });

    // 4. Navigate to game
    await withTimeout(
      browserManager.navigate(gameUrl),
      TIMEOUTS.PAGE_NAVIGATION_TIMEOUT,
      'Page navigation timeout'
    );

    logger.info('Navigated to game URL', { sessionId, gameUrl });

    // 5. Detect game type
    const gameDetector = new GameDetector({ logger });
    let gameType: GameType = GameType.UNKNOWN;
    try {
      gameType = await gameDetector.detectType(page);
      logger.info('Game type detected', { sessionId, gameType });
    } catch (error) {
      logger.warn('Failed to detect game type', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 6. Wait for game ready
    try {
      const isReady = await gameDetector.waitForGameReady(page, TIMEOUTS.GAME_LOAD_TIMEOUT);
      if (!isReady) {
        logger.warn('Game ready detection timed out, continuing anyway', { sessionId });
      } else {
        logger.info('Game ready', { sessionId });
      }
    } catch (error) {
      logger.warn('Failed to confirm game ready state', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 7. Start error monitoring
    const errorMonitor = new ErrorMonitor({ logger });
    try {
      await errorMonitor.startMonitoring(page);
      logger.info('Error monitoring started', { sessionId });
    } catch (error) {
      logger.warn('Failed to start error monitoring', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 8. Create Stagehand agent
    // Access Stagehand instance from BrowserManager (not from page)
    const stagehandInstance = browserManager.getStagehand();

    if (!stagehandInstance) {
      throw new Error(
        'Stagehand instance not available. ' +
        'Ensure BrowserManager.initialize() was called successfully. ' +
        'This may indicate a Browserbase connection issue.'
      );
    }

    // 8.5. Build system prompt from metadata (canvas-aware)
    const systemPrompt = buildStagehandSystemPrompt(metadata);

    // Create agent with CUA model name for validation
    // NOTE: When using AISdkClient, the actual model comes from llmClient,
    // but we need to pass model name for CUA validation
    const agent = stagehandInstance.agent({
      cua: true,  // Enable Computer Use Agent mode
      model: agentModel,  // Pass model name for CUA validation (actual model comes from llmClient)
      systemPrompt,  // Use metadata-aware system prompt
    });

    logger.info('Stagehand agent created', {
      sessionId,
      agentModel,  // Log which model is being used
      note: 'Model configured via AISdkClient at Stagehand initialization',
    });

    // 9. Build instruction from metadata
    const instruction = buildStagehandInstruction(metadata);

    logger.info('Agent instruction built', {
      sessionId,
      instruction: instruction.substring(0, 100) + '...',  // Log first 100 chars
      hasMetadata: !!metadata,
    });

    // 10. Execute agent with timeout
    logger.info('Starting agent execution', {
      sessionId,
      maxSteps: STAGEHAND_AGENT_DEFAULTS.MAX_STEPS,
    });

    const agentResult = await withTimeout(
      agent.execute({
        instruction,
        maxSteps: STAGEHAND_AGENT_DEFAULTS.MAX_STEPS,
        highlightCursor: STAGEHAND_AGENT_DEFAULTS.HIGHLIGHT_CURSOR,
      }),
      TIMEOUTS.MAX_TEST_DURATION,
      'Agent execution timeout'
    );

    logger.info('Agent execution completed', {
      sessionId,
      success: agentResult.success,
      completed: agentResult.completed,
      actionCount: agentResult.actions?.length || 0,
      message: agentResult.message,
      usage: agentResult.usage,
    });

    // 11. Try to extract screenshots from agent actions
    const agentScreenshots = extractScreenshotsFromActions(agentResult.actions || []);

    if (agentScreenshots.length > 0) {
      logger.info('Extracted screenshots from agent actions', {
        sessionId,
        count: agentScreenshots.length,
      });
    } else {
      logger.info('No screenshots in agent actions, will capture manually', { sessionId });
    }

    // 12. Capture final screenshot
    const screenshotCapturer = new ScreenshotCapturer({ logger, fileManager, sessionId });
    const finalScreenshot = await screenshotCapturer.capture(page, 'final_state');

    logger.info('Final screenshot captured', {
      sessionId,
      path: finalScreenshot.path,
    });

    // 13. Vision analysis on final screenshot
    const visionAnalyzer = new VisionAnalyzer({
      logger,
      apiKey: process.env.OPENAI_API_KEY!
    });

    const visionResult = await visionAnalyzer.analyzeScreenshots(
      [finalScreenshot],
      metadata
    );

    logger.info('Vision analysis completed', {
      sessionId,
      playabilityScore: visionResult.playability_score,
      issueCount: visionResult.issues.length,
    });

    // 14. Get console errors
    let consoleErrors: any[] = [];
    try {
      consoleErrors = errorMonitor.getErrors();
      await errorMonitor.stopMonitoring(page);
      logger.info('Error monitoring stopped', {
        sessionId,
        errorCount: consoleErrors.length,
      });
    } catch (error) {
      logger.warn('Failed to stop error monitoring', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 15. Determine pass/fail status
    const status = visionResult.playability_score >= THRESHOLDS.PLAYABILITY_PASS_SCORE
      ? 'pass'
      : 'fail';

    // 16. Build result with agent metadata
    // Aggregate costs: agent usage + vision analysis tokens
    const totalInputTokens = (agentResult.usage?.input_tokens || 0) + (visionResult.usage?.promptTokens || 0);
    const totalOutputTokens = (agentResult.usage?.output_tokens || 0) + (visionResult.usage?.completionTokens || 0);

    // Convert agent actions to our StagehandAgentAction format
    // Log raw action structure for debugging (first click action)
    const firstClickAction = agentResult.actions?.find((a: any) => a.type === 'click' || a.action === 'click');
    if (firstClickAction) {
      logger.debug('Raw click action structure', {
        sessionId,
        rawAction: JSON.stringify(firstClickAction, null, 2),
        actionKeys: Object.keys(firstClickAction),
      });
    }

    const actions = (agentResult.actions || []).map((action: any) => {
      // Extract all available fields from Stagehand's action
      const mapped: any = {
        type: action.type || action.action || 'unknown',
        reasoning: action.reasoning || '',
        // Only set completed if taskCompleted is explicitly provided by Stagehand
        // taskCompleted indicates if the overall task was completed after this action
        // If not provided, we don't set it (undefined) rather than defaulting to false
        completed: action.completed !== undefined ? action.completed : (action.taskCompleted !== undefined ? action.taskCompleted : undefined),
        url: action.url || action.pageUrl || gameUrl,
        timestamp: action.timestamp || action.timeMs ? new Date(action.timeMs || Date.now()).toISOString() : new Date().toISOString(),
      };

      // Capture click coordinates if available (check multiple possible field names)
      if (mapped.type === 'click') {
        if (action.coordinates) {
          mapped.coordinates = action.coordinates;
        } else if (action.x !== undefined && action.y !== undefined) {
          mapped.coordinates = { x: action.x, y: action.y };
        } else if (action.target && typeof action.target === 'object' && 'x' in action.target && 'y' in action.target) {
          mapped.coordinates = { x: action.target.x, y: action.target.y };
        } else if (action.position) {
          mapped.coordinates = action.position;
        }
      }

      // Capture any other execution details
      if (action.element) mapped.element = action.element;
      if (action.selector) mapped.selector = action.selector;
      if (action.text) mapped.text = action.text;
      if (action.key) mapped.key = action.key;
      if (action.value) mapped.value = action.value;
      if (action.pageText) mapped.pageText = action.pageText;
      if (action.instruction) mapped.instruction = action.instruction;

      // Preserve any other fields we might not know about
      const knownFields = ['type', 'action', 'reasoning', 'completed', 'taskCompleted', 'url', 'pageUrl', 'timestamp', 'timeMs', 'coordinates', 'x', 'y', 'target', 'position', 'element', 'selector', 'text', 'key', 'value', 'pageText', 'instruction'];
      const unknownFields = Object.keys(action).filter(k => !knownFields.includes(k));
      if (unknownFields.length > 0) {
        mapped._raw = {};
        unknownFields.forEach(field => {
          mapped._raw[field] = action[field];
        });
      }

      return mapped;
    });

    const result: GameTestResult = {
      status,
      playability_score: visionResult.playability_score,
      issues: visionResult.issues,
      screenshots: [finalScreenshot.path],
      timestamp: new Date().toISOString(),
      metadata: {
        sessionId,
        gameUrl,
        duration: Date.now() - startTime,
        gameType,
        consoleErrors,
        visionAnalysisTokens: visionResult.usage?.promptTokens,
        stagehandAgent: {
          success: agentResult.success,
          completed: agentResult.completed,
          actionCount: actions.length,
          actions,
          message: agentResult.message,
          agentModel,  // Record which model was used
          usage: {
            ...agentResult.usage,
            // Add aggregated totals if needed
            totalInputTokens,
            totalOutputTokens,
          },
        },
      },
    };

    // 17. Cleanup (always runs, even on errors)
    await browserManager.cleanup();

    logger.info('Stagehand Agent QA completed', {
      sessionId,
      status: result.status,
      playabilityScore: result.playability_score,
      duration: result.metadata.duration,
    });

    return result;

  } catch (error) {
    logger.error('Stagehand Agent QA failed', {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Ensure cleanup happens even on error
    try {
      if (browserManager) {
        await browserManager.cleanup();
      }
    } catch (cleanupError) {
      logger.warn('Error during cleanup after failure', {
        sessionId,
        cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    }

    // Return error result (no fallback to other modes)
    return {
      status: 'error',
      playability_score: 0,
      issues: [{
        severity: 'critical',
        description: `Stagehand Agent QA failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
      }],
      screenshots: [],
      timestamp: new Date().toISOString(),
      metadata: {
        sessionId,
        gameUrl,
        duration: Date.now() - startTime,
        gameType: GameType.UNKNOWN,
        consoleErrors: [],
      },
    };
  }
}

/**
 * Result interface for loading metadata from file.
 */
export interface LoadMetadataResult {
  /** Whether the metadata was successfully loaded and validated */
  success: boolean;
  /** The parsed and validated GameMetadata (only present if success is true) */
  data?: GameMetadata;
  /** Error message (only present if success is false) */
  error?: string;
}

/**
 * Load and validate metadata from a JSON file.
 * 
 * @param filePath - Path to metadata.json file (relative or absolute)
 * @returns Promise that resolves to LoadMetadataResult
 * 
 * @example
 * ```typescript
 * const result = await loadMetadataFromFile('./_game-examples/pong/metadata.json');
 * if (result.success) {
 *   console.log('Metadata loaded:', result.data);
 * }
 * ```
 */
export async function loadMetadataFromFile(filePath: string): Promise<LoadMetadataResult> {
  try {
    // Resolve path relative to current working directory
    const resolvedPath = resolve(process.cwd(), filePath);
    
    // Read file using Bun.file()
    const file = Bun.file(resolvedPath);
    
    // Check if file exists
    if (!(await file.exists())) {
      return {
        success: false,
        error: `Metadata file not found: ${resolvedPath}`,
      };
    }

    // Read and parse JSON
    const content = await file.text();
    let parsedData: unknown;
    
    try {
      parsedData = JSON.parse(content);
    } catch (parseError) {
      return {
        success: false,
        error: `Invalid JSON in metadata file: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      };
    }

    // Validate against schema
    const validationResult = validateGameMetadata(parsedData);
    
    if (!validationResult.success) {
      return {
        success: false,
        error: `Metadata validation failed: ${validationResult.error.message}`,
      };
    }

    return {
      success: true,
      data: validationResult.data,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to load metadata file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Parse CLI arguments.
 * 
 * @param args - Command line arguments array (defaults to process.argv)
 * @returns Object with gameUrl and optional metadataPath
 */
export function parseCLIArgs(args: string[] = process.argv): { gameUrl: string; metadataPath?: string } {
  const gameUrl = args[2];
  let metadataPath: string | undefined;

  // Parse --metadata flag
  const metadataIndex = args.indexOf('--metadata');
  if (metadataIndex !== -1 && metadataIndex + 1 < args.length) {
    metadataPath = args[metadataIndex + 1];
  }

  return { gameUrl, metadataPath };
}

/**
 * Lambda event interface for AWS Lambda handler.
 */
export interface LambdaEvent {
  /** The URL of the game to test */
  gameUrl: string;
  
  /** Optional comprehensive game metadata */
  metadata?: GameMetadata;
  
  /** 
   * Optional input schema (deprecated, kept for backwards compatibility)
   * @deprecated Use metadata.inputSchema instead
   */
  inputSchema?: InputSchema;
  
  /** Optional configuration overrides */
  config?: Partial<TestConfig>;
}

/**
 * Lambda response interface.
 */
export interface LambdaResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}

/**
 * AWS Lambda handler for running QA tests.
 * 
 * This function is designed to be deployed as an AWS Lambda function.
 * It accepts a Lambda event containing gameUrl and optional metadata/inputSchema,
 * runs the QA test, and returns a Lambda-compatible response.
 * 
 * @param event - Lambda event containing gameUrl and optional metadata/inputSchema
 * @returns Promise that resolves to LambdaResponse
 * 
 * @example
 * ```typescript
 * const event = {
 *   gameUrl: 'https://example.com/game',
 *   metadata: { inputSchema: {...} }
 * };
 * const response = await handler(event);
 * // Returns: { statusCode: 200, body: JSON.stringify(result) }
 * ```
 */
export async function handler(event: LambdaEvent): Promise<LambdaResponse> {
  const headers = {
    'Content-Type': 'application/json',
  };

  try {
    // Validate required fields
    if (!event.gameUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required field: gameUrl',
        }),
        headers,
      };
    }

    // Validate URL format
    try {
      new URL(event.gameUrl);
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `Invalid URL format: ${event.gameUrl}`,
        }),
        headers,
      };
    }

    // Prepare request object (handle both metadata and inputSchema)
    const request: Partial<GameTestRequest> = {
      config: event.config,
    };

    // Prioritize metadata over inputSchema (backwards compatibility)
    let metadata: GameMetadata | undefined;
    if (event.metadata) {
      request.metadata = event.metadata;
      metadata = event.metadata;
    } else if (event.inputSchema) {
      // Backwards compatibility: convert inputSchema to metadata
      request.inputSchema = event.inputSchema;
      // Note: metadata will be undefined, runQA will handle conversion internally
    }

    // Select QA mode based on feature flags (PRECEDENCE: Stagehand > Adaptive > Standard)
    const flags = getFeatureFlags();
    let result: GameTestResult;

    if (flags.enableStagehandAgent) {
      // Load OpenRouter config from environment
      const openRouterConfig = OpenRouterProvider.fromEnvironment();
      if (!openRouterConfig) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'OPENROUTER_API_KEY is required for Stagehand Agent mode',
            message: 'Get your API key at: https://openrouter.ai/keys',
          }),
          headers,
        };
      }
      result = await runStagehandAgentQA(event.gameUrl, metadata, {
        openrouter: openRouterConfig,
      });
    } else if (flags.enableAdaptiveQA) {
      result = await runAdaptiveQA(event.gameUrl, request);
    } else {
      result = await runQA(event.gameUrl, request);
    }

    // Determine status code based on result status
    let statusCode = 200;
    if (result.status === 'fail') {
      statusCode = 500; // Server error for failed tests
    } else if (result.status === 'error') {
      statusCode = 500; // Server error for errors
    }

    return {
      statusCode,
      body: JSON.stringify(result),
      headers,
    };
  } catch (error) {
    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: errorMessage,
      }),
      headers,
    };
  }
}

/**
 * CLI entry point for running QA tests from command line.
 * 
 * Usage: `bun run src/main.ts <game-url> [--metadata <path>]`
 * 
 * Examples:
 * ```bash
 * bun run src/main.ts https://example.com/game
 * bun run src/main.ts https://example.com/game --metadata ./_game-examples/pong/metadata.json
 * ```
 */
if (import.meta.main) {
  // Parse CLI arguments
  const { gameUrl, metadataPath } = parseCLIArgs();

  if (!gameUrl) {
    console.error('Error: Game URL is required');
    console.log('\nUsage: bun run src/main.ts <game-url> [--metadata <path>]');
    console.log('Example: bun run src/main.ts https://example.com/game');
    console.log('Example: bun run src/main.ts https://example.com/game --metadata ./_game-examples/pong/metadata.json');
    process.exit(1);
  }

  // Validate URL format (basic check)
  try {
    new URL(gameUrl);
  } catch {
    console.error('Error: Invalid URL format');
    console.log(`Provided URL: ${gameUrl}`);
    process.exit(1);
  }

  // Load metadata if provided
  let request: Partial<GameTestRequest> | undefined;
  if (metadataPath) {
    const metadataResult = await loadMetadataFromFile(metadataPath);
    if (!metadataResult.success) {
      console.error('Error loading metadata:', metadataResult.error);
      process.exit(1);
    }
    request = {
      metadata: metadataResult.data,
    };
  }

  // Select QA mode based on feature flags (PRECEDENCE: Stagehand > Adaptive > Standard)
  const flags = getFeatureFlags();

  try {
    let result: GameTestResult;

    if (flags.enableStagehandAgent) {
      console.log('🤖 Running in Stagehand Agent mode (autonomous)...');
      
      // Load OpenRouter config from environment
      const openRouterConfig = OpenRouterProvider.fromEnvironment();
      if (!openRouterConfig) {
        console.error('Error: OPENROUTER_API_KEY is required for Stagehand Agent mode');
        console.error('Get your API key at: https://openrouter.ai/keys');
        process.exit(1);
      }
      
      const metadata = request?.metadata;
      result = await runStagehandAgentQA(gameUrl, metadata, {
        openrouter: openRouterConfig,
      });
    } else if (flags.enableAdaptiveQA) {
      console.log('🚀 Running in Adaptive QA mode (iterative action loop)...');
      result = await runAdaptiveQA(gameUrl, request);
    } else {
      console.log('📊 Running in Standard QA mode (single cycle)...');
      result = await runQA(gameUrl, request);
    }

    // Print result as formatted JSON
    console.log('\n📊 QA Test Result:');
    console.log(JSON.stringify(result, null, 2));

    // Exit with appropriate code
    if (result.status === 'pass') {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
