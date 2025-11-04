/**
 * File manager utility for handling file operations.
 * 
 * This module provides a FileManager class for managing screenshots and
 * reports in the Lambda /tmp directory. All file operations use the paths
 * defined in config constants.
 * 
 * @module utils.file-manager
 */

import { nanoid } from 'nanoid';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PATHS } from '../config/constants';
import type { Screenshot, GameTestResult } from '../types/game-test.types';

/**
 * File manager for handling screenshot and report file operations.
 * 
 * Provides methods for creating directories, saving screenshots as PNG files,
 * saving reports as JSON files, and generating file paths. All operations
 * use the Lambda /tmp directory for ephemeral storage.
 * 
 * @example
 * ```typescript
 * const fileManager = new FileManager('session-123');
 * 
 * // Ensure directories exist
 * await fileManager.ensureOutputDirectory();
 * 
 * // Save screenshot
 * const screenshot = await fileManager.saveScreenshot(pngBuffer, 'initial_load');
 * 
 * // Save report
 * const reportPath = await fileManager.saveReport(gameTestResult);
 * ```
 */
export class FileManager {
  private sessionId: string;

  /**
   * Create a new FileManager instance.
   * 
   * @param sessionId - Optional session ID for organizing files. If not provided,
   *   a unique ID will be generated using nanoid.
   */
  constructor(sessionId?: string) {
    this.sessionId = sessionId || nanoid();
  }

  /**
   * Ensure output directories exist.
   * 
   * Creates the base output directory and subdirectories for screenshots
   * and reports if they don't already exist. Uses recursive directory creation
   * to handle nested paths.
   * 
   * @throws {Error} If directory creation fails
   * 
   * @example
   * ```typescript
   * await fileManager.ensureOutputDirectory();
   * // Creates:
   * // /tmp/game-qa-output/
   * // /tmp/game-qa-output/screenshots/{sessionId}/
   * // /tmp/game-qa-output/reports/{sessionId}/
   * ```
   */
  async ensureOutputDirectory(): Promise<void> {
    const screenshotsDir = join(PATHS.OUTPUT_DIR, PATHS.SCREENSHOTS_SUBDIR, this.sessionId);
    const reportsDir = join(PATHS.OUTPUT_DIR, PATHS.REPORTS_SUBDIR, this.sessionId);

    try {
      // Create directories recursively
      await mkdir(screenshotsDir, { recursive: true });
      await mkdir(reportsDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create output directories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Save a screenshot as a PNG file.
   * 
   * Saves the provided PNG buffer to a file in the screenshots directory.
   * Generates a unique ID for the screenshot if not provided.
   * 
   * @param buffer - PNG image buffer (Buffer or Uint8Array)
   * @param stage - Stage of the test when screenshot was taken
   * @param id - Optional unique identifier for the screenshot. If not provided,
   *   a unique ID will be generated using nanoid.
   * @returns Screenshot object with id, path, timestamp, and stage
   * @throws {Error} If file write fails
   * 
   * @example
   * ```typescript
   * const screenshot = await fileManager.saveScreenshot(pngBuffer, 'initial_load');
   * // Returns: { id: 'abc123', path: '/tmp/game-qa-output/screenshots/session-123/abc123.png', ... }
   * ```
   */
  async saveScreenshot(
    buffer: Buffer | Uint8Array,
    stage: Screenshot['stage'],
    id?: string
  ): Promise<Screenshot> {
    const screenshotId = id || nanoid();
    const filename = `${screenshotId}.png`;
    const path = join(PATHS.OUTPUT_DIR, PATHS.SCREENSHOTS_SUBDIR, this.sessionId, filename);

    try {
      // Ensure directory exists
      await this.ensureOutputDirectory();

      // Write file
      await writeFile(path, buffer);

      return {
        id: screenshotId,
        path,
        timestamp: Date.now(),
        stage,
      };
    } catch (error) {
      throw new Error(`Failed to save screenshot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Save a test report as a JSON file.
   * 
   * Saves the provided GameTestResult to a JSON file in the reports directory.
   * The file is formatted with indentation for readability.
   * 
   * @param report - GameTestResult object to save
   * @returns File path where the report was saved
   * @throws {Error} If file write fails
   * 
   * @example
   * ```typescript
   * const reportPath = await fileManager.saveReport(gameTestResult);
   * // Returns: '/tmp/game-qa-output/reports/session-123/report.json'
   * ```
   */
  async saveReport(report: GameTestResult): Promise<string> {
    const filename = 'report.json';
    const path = join(PATHS.OUTPUT_DIR, PATHS.REPORTS_SUBDIR, this.sessionId, filename);

    try {
      // Ensure directory exists
      await this.ensureOutputDirectory();

      // Convert report to JSON with indentation
      const jsonContent = JSON.stringify(report, null, 2);

      // Write file
      await writeFile(path, jsonContent, 'utf-8');

      return path;
    } catch (error) {
      throw new Error(`Failed to save report: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the file path for a screenshot.
   * 
   * Generates the file path for a screenshot with the given ID.
   * Does not check if the file exists.
   * 
   * @param id - Screenshot identifier
   * @returns Full file path for the screenshot
   * 
   * @example
   * ```typescript
   * const path = fileManager.getScreenshotPath('abc123');
   * // Returns: '/tmp/game-qa-output/screenshots/session-123/abc123.png'
   * ```
   */
  getScreenshotPath(id: string): string {
    const filename = `${id}.png`;
    return join(PATHS.OUTPUT_DIR, PATHS.SCREENSHOTS_SUBDIR, this.sessionId, filename);
  }

  /**
   * Get the file path for the test report.
   * 
   * Generates the file path for the report file.
   * Does not check if the file exists.
   * 
   * @returns Full file path for the report
   * 
   * @example
   * ```typescript
   * const path = fileManager.getReportPath();
   * // Returns: '/tmp/game-qa-output/reports/session-123/report.json'
   * ```
   */
  getReportPath(): string {
    const filename = 'report.json';
    return join(PATHS.OUTPUT_DIR, PATHS.REPORTS_SUBDIR, this.sessionId, filename);
  }

  /**
   * Cleanup files (stub for future implementation).
   * 
   * This method is a placeholder for future cleanup functionality.
   * Currently does nothing, but will be implemented to delete screenshots
   * and reports when the enableScreenshotCleanup feature flag is enabled.
   * 
   * @returns Promise that resolves to void
   * 
   * @example
   * ```typescript
   * await fileManager.cleanup();
   * // Currently does nothing, future: deletes files if cleanup enabled
   * ```
   */
  async cleanup(): Promise<void> {
    // Stub for future implementation
    // Future: Delete screenshots and reports if enableScreenshotCleanup is true
    return Promise.resolve();
  }
}

