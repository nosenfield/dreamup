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
import { BrowserManager, GameInteractor, ScreenshotCapturer, GameDetector, ErrorMonitor, GameType, StateAnalyzer, AdaptiveQALoop } from './core';
import { VisionAnalyzer } from './vision';
import { FileManager } from './utils/file-manager';
import { Logger, TestPhase } from './utils/logger';
import { TIMEOUTS } from './config/constants';
import { getFeatureFlags } from './config/feature-flags';
import { validateGameMetadata } from './schemas/metadata.schema';
import { mergeAdaptiveConfig } from './utils/adaptive-qa';
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

    // Capture pre-start screenshot (TRUE baseline before any interaction)
    logger.beginPhase(TestPhase.SCREENSHOT_CAPTURE, { stage: 'pre_start' });
    const preStartScreenshot = await screenshotCapturer.capture(page, 'pre_start');
    logger.action('screenshot', {
      stage: 'pre_start',
      path: preStartScreenshot.path,
      timing: 'before_start_button',
    });
    logger.endPhase(TestPhase.SCREENSHOT_CAPTURE, { screenshotId: preStartScreenshot.id });

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

    // Capture post-start screenshot (after start button clicked)
    logger.beginPhase(TestPhase.SCREENSHOT_CAPTURE, { stage: 'post_start' });
    const postStartScreenshot = metadata
      ? await screenshotCapturer.captureAtOptimalTime(page, 'post_start', metadata)
      : await screenshotCapturer.capture(page, 'post_start');
    logger.action('screenshot', {
      stage: 'post_start',
      path: postStartScreenshot.path,
      timing: 'after_start_button',
    });
    logger.endPhase(TestPhase.SCREENSHOT_CAPTURE, { screenshotId: postStartScreenshot.id });

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
          screenshotCount: 4,
        });

        const visionResult = await visionAnalyzer.analyzeScreenshots([
          preStartScreenshot,
          postStartScreenshot,
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
        preStartScreenshot.path,
        postStartScreenshot.path,
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

    // Run adaptive QA loop
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
          stage: (index === 0 ? 'pre_start' : index === screenshots.length - 1 ? 'final_state' : 'after_interaction') as 'pre_start' | 'post_start' | 'after_interaction' | 'final_state',
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

    // Use final cost from adaptive loop
    const finalCost = loopResult.estimatedCost;

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
    if (event.metadata) {
      request.metadata = event.metadata;
    } else if (event.inputSchema) {
      // Backwards compatibility: convert inputSchema to metadata
      request.inputSchema = event.inputSchema;
    }

    // Run QA test
    const result = await runQA(event.gameUrl, request);

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

  // Check feature flag for adaptive mode
  const flags = getFeatureFlags();
  const useAdaptiveMode = flags.enableAdaptiveQA;

  if (useAdaptiveMode) {
    console.log('🚀 Running in Adaptive QA mode (iterative action loop)');
  }

  // Run QA test (adaptive or standard based on feature flag)
  const qaFunction = useAdaptiveMode ? runAdaptiveQA : runQA;
  
  qaFunction(gameUrl, request)
    .then((result) => {
      // Print result as formatted JSON
      console.log('\n📊 QA Test Result:');
      console.log(JSON.stringify(result, null, 2));

      // Exit with appropriate code
      if (result.status === 'pass') {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Fatal error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
