/**
 * Structured error handling for QA testing.
 * 
 * This module provides error categorization and structured error types
 * for better error handling and debugging throughout the QA testing flow.
 * 
 * @module utils.errors
 */

import { TestPhase } from './logger';

/**
 * Error categories for categorizing different types of errors.
 */
export enum ErrorCategory {
  /** Browser initialization errors (non-recoverable) */
  BROWSER_INIT = 'browser_init',
  
  /** Navigation errors (non-recoverable) */
  NAVIGATION = 'navigation',
  
  /** Game detection errors (recoverable) */
  GAME_DETECTION = 'game_detection',
  
  /** Start button detection errors (recoverable) */
  START_BUTTON = 'start_button',
  
  /** Gameplay simulation errors (recoverable) */
  GAMEPLAY = 'gameplay',
  
  /** Screenshot capture errors (recoverable) */
  SCREENSHOT = 'screenshot',
  
  /** Vision API errors (recoverable) */
  VISION_API = 'vision_api',
  
  /** State analysis errors (recoverable) */
  STATE_ANALYSIS = 'state_analysis',
  
  /** Timeout errors (recoverable) */
  TIMEOUT = 'timeout',
  
  /** Unknown/unclassified errors (non-recoverable) */
  UNKNOWN = 'unknown',
}

/**
 * Structured error class for QA testing.
 * 
 * Extends the standard Error class with additional context:
 * - category: Error category for classification
 * - phase: Test phase when error occurred
 * - recoverable: Whether the error allows continuation
 * - context: Additional error context (optional)
 */
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

/**
 * Categorize an error into a QAError with appropriate category and recoverability.
 * 
 * If the error is already a QAError, returns it as-is.
 * Otherwise, categorizes based on error message patterns.
 * 
 * @param error - The error to categorize (Error, QAError, string, or unknown)
 * @param phase - The test phase when the error occurred
 * @returns A QAError with appropriate category and recoverability
 */
export function categorizeError(error: unknown, phase: TestPhase): QAError {
  // If already a QAError, return as-is
  if (error instanceof QAError) {
    return error;
  }

  // Extract error message (convert to lowercase for case-insensitive matching)
  const message = error instanceof Error ? error.message : String(error);
  const messageLower = message.toLowerCase();

  // Categorize based on message patterns (case-insensitive)
  if (messageLower.includes('timeout') || messageLower.includes('timed out')) {
    return new QAError(message, ErrorCategory.TIMEOUT, phase, true);
  }

  if (messageLower.includes('screenshot')) {
    return new QAError(message, ErrorCategory.SCREENSHOT, phase, true);
  }

  if (messageLower.includes('openai') || messageLower.includes('api')) {
    return new QAError(message, ErrorCategory.VISION_API, phase, true);
  }

  if (messageLower.includes('navigation') || messageLower.includes('navigate')) {
    return new QAError(message, ErrorCategory.NAVIGATION, phase, false);
  }

  if (messageLower.includes('browser') || messageLower.includes('browserbase')) {
    return new QAError(message, ErrorCategory.BROWSER_INIT, phase, false);
  }

  // Default to unknown (non-recoverable)
  return new QAError(message, ErrorCategory.UNKNOWN, phase, false);
}

