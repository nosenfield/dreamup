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
import { BrowserManager } from './core/browser-manager';
import { FileManager } from './utils/file-manager';
import { Logger } from './utils/logger';
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
  const sessionId = nanoid();
  const logger = new Logger({
    module: 'qa-agent',
    op: 'runQA',
    correlationId: sessionId,
  });

  logger.info('Starting QA test', { gameUrl, sessionId });

  const fileManager = new FileManager(sessionId);
  let browserManager: BrowserManager | null = null;

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

    // Take screenshot
    logger.info('Capturing screenshot', {});
    const screenshotBuffer = await page.screenshot();
    logger.info('Screenshot captured', { bufferSize: screenshotBuffer.length });

    // Save screenshot
    logger.info('Saving screenshot', {});
    const screenshot = await fileManager.saveScreenshot(screenshotBuffer, 'initial_load');
    logger.info('Screenshot saved', { 
      screenshotId: screenshot.id,
      screenshotPath: screenshot.path,
    });

    // Create result
    const result: GameTestResult = {
      status: 'pass',
      playability_score: 50, // Placeholder score for I1.2
      issues: [],
      screenshots: [screenshot.path],
      timestamp: new Date().toISOString(),
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

    const errorResult: GameTestResult = {
      status: 'error',
      playability_score: 0,
      issues: [errorIssue],
      screenshots: [],
      timestamp: new Date().toISOString(),
    };

    return errorResult;

  } finally {
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
