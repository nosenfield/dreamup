/**
 * File manager utility for handling file operations.
 * 
 * This module provides a FileManager class for managing screenshots and
 * reports in the Lambda /tmp directory. All file operations use the paths
 * defined in config constants.
 * 
 * @module utils.file-manager
 */

import { mkdir, writeFile, rm } from 'fs/promises';
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
 * const screenshot = await fileManager.saveScreenshot(pngBuffer, 'pre_start');
 * 
 * // Save report
 * const reportPath = await fileManager.saveReport(gameTestResult);
 * ```
 */
export class FileManager {
  private sessionId: string;
  private localLogDir?: string;
  private screenshotCounter: number = 0;

  /**
   * Create a new FileManager instance.
   * 
   * @param sessionId - Optional session ID for organizing files. If not provided,
   *   a unique ID will be generated using timestamp.
   * @param localLogDir - Optional local log directory path (e.g., './logs/{timestamp}')
   */
  constructor(sessionId?: string, localLogDir?: string) {
    this.sessionId = sessionId || Date.now().toString();
    this.localLogDir = localLogDir;
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
   * const screenshot = await fileManager.saveScreenshot(pngBuffer, 'pre_start');
   * // Returns: { id: 'abc123', path: '/tmp/game-qa-output/screenshots/session-123/abc123.png', ... }
   * ```
   */
  async saveScreenshot(
    buffer: Buffer | Uint8Array,
    stage: Screenshot['stage'],
    id?: string
  ): Promise<Screenshot> {
    // Use timestamp for filename, or provided id if given
    const timestamp = Date.now();
    // Ensure uniqueness by adding counter if id not provided
    // This handles cases where multiple screenshots are saved in the same millisecond
    const screenshotId = id || `${timestamp}-${this.screenshotCounter++}`;
    const filename = `${screenshotId}.png`;
    const path = join(PATHS.OUTPUT_DIR, PATHS.SCREENSHOTS_SUBDIR, this.sessionId, filename);

    try {
      // Ensure directory exists
      await this.ensureOutputDirectory();

      // Write file to /tmp (primary location)
      await writeFile(path, buffer);

      // Also save to local logs directory if provided
      if (this.localLogDir) {
        try {
          const localScreenshotsDir = join(this.localLogDir, 'screenshots');
          await mkdir(localScreenshotsDir, { recursive: true });
          const localPath = join(localScreenshotsDir, filename);
          await writeFile(localPath, buffer);
        } catch (localError) {
          // Don't fail if local save fails - log directory might not be available
          // This is a non-critical operation
        }
      }

      return {
        id: screenshotId,
        path,
        timestamp,
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
   * Cleanup files for this session.
   * 
   * Deletes all screenshots and reports for this session if the cleanup flag
   * is enabled. Handles missing directories gracefully.
   * 
   * @param enableCleanup - Whether cleanup is enabled (from feature flag)
   * @returns Promise that resolves to void
   * 
   * @example
   * ```typescript
   * const flags = getFeatureFlags();
   * await fileManager.cleanup(flags.enableScreenshotCleanup);
   * ```
   */
  async cleanup(enableCleanup: boolean): Promise<void> {
    if (!enableCleanup) {
      return;
    }

    const screenshotsDir = join(PATHS.OUTPUT_DIR, PATHS.SCREENSHOTS_SUBDIR, this.sessionId);
    const reportsDir = join(PATHS.OUTPUT_DIR, PATHS.REPORTS_SUBDIR, this.sessionId);

    try {
      // Delete both directories in parallel
      await Promise.allSettled([
        rm(screenshotsDir, { recursive: true, force: true }).catch(() => {
          // Directory doesn't exist or permission error - ignore
        }),
        rm(reportsDir, { recursive: true, force: true }).catch(() => {
          // Directory doesn't exist or permission error - ignore
        }),
      ]);
    } catch {
      // Ignore any errors during cleanup - don't fail the test
    }
  }
}

