/**
 * Log file writer for saving logs to local files.
 * 
 * Captures logs starting from "=== BEGIN SCREENSHOT CAPTURE ===" and saves
 * them to a local log file in ./logs/{timestamp}/log.txt
 * 
 * @module utils.log-file-writer
 */

import { mkdir, appendFile } from 'fs/promises';
import { join } from 'path';

/**
 * Log file writer that captures logs to a local file.
 * 
 * Starts capturing logs when it detects "=== BEGIN SCREENSHOT CAPTURE ==="
 * and writes all subsequent logs to ./logs/{timestamp}/log.txt
 */
export class LogFileWriter {
  private logDir: string;
  private logFilePath: string;
  private isCapturing: boolean = false;

  /**
   * Create a new LogFileWriter instance.
   * 
   * @param timestamp - Timestamp for the log directory (e.g., Date.now())
   */
  constructor(timestamp: number) {
    const timestampStr = timestamp.toString();
    this.logDir = join(process.cwd(), 'logs', timestampStr);
    this.logFilePath = join(this.logDir, 'log.txt');
  }

  /**
   * Initialize the log directory.
   * 
   * Creates the log directory if it doesn't exist.
   */
  async initialize(): Promise<void> {
    try {
      await mkdir(this.logDir, { recursive: true });
    } catch (error) {
      throw new Error(
        `Failed to create log directory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Write a log line to the file.
   * 
   * Checks if we should start capturing (when we see "=== BEGIN SCREENSHOT CAPTURE ===")
   * and writes the line to the log file if capturing.
   * 
   * @param line - Log line to write
   */
  async write(line: string): Promise<void> {
    // Check if we should start capturing
    if (!this.isCapturing && line.includes('=== BEGIN SCREENSHOT CAPTURE ===')) {
      this.isCapturing = true;
    }

    // If capturing, write to file
    if (this.isCapturing) {
      try {
        // Write line to file (append mode)
        await appendFile(this.logFilePath, line + '\n', 'utf-8');
      } catch (error) {
        // Don't throw - log file writing is non-critical
        // Just log to console as fallback
        console.error('Failed to write to log file:', error);
      }
    }
  }

  /**
   * Get the log directory path.
   * 
   * @returns Path to the log directory
   */
  getLogDir(): string {
    return this.logDir;
  }

  /**
   * Get the log file path.
   * 
   * @returns Path to the log file
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }

  /**
   * Check if currently capturing logs.
   * 
   * @returns true if capturing, false otherwise
   */
  isActive(): boolean {
    return this.isCapturing;
  }
}

