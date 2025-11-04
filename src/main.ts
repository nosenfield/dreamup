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
import { BrowserManager, GameInteractor, ScreenshotCapturer, GameDetector, ErrorMonitor, GameType } from './core';
import { FileManager } from './utils/file-manager';
import { Logger } from './utils/logger';
import { TIMEOUTS } from './config/constants';
import type { GameTestResult, Issue } from './types/game-test.types';

/**
 * Run QA test on a game URL.
 * 
 * This is the main orchestration function that performs automated QA testing
 * of a browser-based game. It initializes a browser session, navigates to
 * the game URL, captures a screenshot, and returns a test result.
 * 
 * @param gameUrl - The URL of the game to test
 * @returns Promise that resolves to GameTestResult
 * 
 * @example
 * ```typescript
 * const result = await runQA('https://example.com/game');
 * console.log(`Test status: ${result.status}`);
 * console.log(`Screenshots: ${result.screenshots.length}`);
 * ```
 */
export async function runQA(gameUrl: string): Promise<GameTestResult> {
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

    // Initialize screenshot capturer and game interactor
    const screenshotCapturer = new ScreenshotCapturer({ logger, fileManager });
    const gameInteractor = new GameInteractor({ logger });

    // Capture initial screenshot
    logger.info('Capturing initial screenshot', {});
    const initialScreenshot = await screenshotCapturer.capture(page, 'initial_load');
    logger.info('Initial screenshot captured', {
      screenshotId: initialScreenshot.id,
      screenshotPath: initialScreenshot.path,
    });

    // Simulate keyboard inputs for 30 seconds
    logger.info('Starting keyboard input simulation', { duration: 30000 });
    await gameInteractor.simulateKeyboardInput(page, 30000);
    logger.info('Keyboard input simulation completed', {});

    // Capture screenshot after interaction
    logger.info('Capturing screenshot after interaction', {});
    const afterInteractionScreenshot = await screenshotCapturer.capture(page, 'after_interaction');
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

    // Calculate test duration
    const duration = Date.now() - startTime;

    // Create result with all screenshots and metadata
    const result: GameTestResult = {
      status: 'pass',
      playability_score: 50, // Placeholder score for I2.3
      issues: [],
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
 * CLI entry point for running QA tests from command line.
 * 
 * Usage: `bun run src/main.ts <game-url>`
 * 
 * Example:
 * ```bash
 * bun run src/main.ts https://example.com/game
 * ```
 */
if (import.meta.main) {
  const gameUrl = process.argv[2];

  if (!gameUrl) {
    console.error('Error: Game URL is required');
    console.log('\nUsage: bun run src/main.ts <game-url>');
    console.log('Example: bun run src/main.ts https://example.com/game');
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

  // Run QA test
  runQA(gameUrl)
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
