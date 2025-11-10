/**
 * Unit tests for error handling utilities.
 * 
 * Tests for ErrorCategory enum, QAError class, and categorizeError function.
 * 
 * @module tests.unit.errors
 */

import { describe, it, expect } from 'bun:test';
import { ErrorCategory, QAError, categorizeError } from '../../src/utils/errors';
import { TestPhase } from '../../src/utils/logger';

describe('ErrorCategory', () => {
  it('should have all expected error categories', () => {
    expect(ErrorCategory.BROWSER_INIT).toBe('browser_init');
    expect(ErrorCategory.NAVIGATION).toBe('navigation');
    expect(ErrorCategory.GAME_DETECTION).toBe('game_detection');
    expect(ErrorCategory.START_BUTTON).toBe('start_button');
    expect(ErrorCategory.GAMEPLAY).toBe('gameplay');
    expect(ErrorCategory.SCREENSHOT).toBe('screenshot');
    expect(ErrorCategory.VISION_API).toBe('vision_api');
    expect(ErrorCategory.STATE_ANALYSIS).toBe('state_analysis');
    expect(ErrorCategory.TIMEOUT).toBe('timeout');
    expect(ErrorCategory.UNKNOWN).toBe('unknown');
  });
});

describe('QAError', () => {
  it('should create QAError with all properties', () => {
    const error = new QAError(
      'Test error message',
      ErrorCategory.TIMEOUT,
      TestPhase.START_BUTTON_DETECTION,
      true,
      { timeout: 5000 }
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(QAError);
    expect(error.message).toBe('Test error message');
    expect(error.category).toBe(ErrorCategory.TIMEOUT);
    expect(error.phase).toBe(TestPhase.START_BUTTON_DETECTION);
    expect(error.recoverable).toBe(true);
    expect(error.context).toEqual({ timeout: 5000 });
    expect(error.name).toBe('QAError');
  });

  it('should create QAError with default recoverable flag', () => {
    const error = new QAError(
      'Test error',
      ErrorCategory.UNKNOWN,
      TestPhase.INITIALIZATION
    );

    expect(error.recoverable).toBe(false);
    expect(error.context).toBeUndefined();
  });

  it('should create QAError with optional context', () => {
    const error = new QAError(
      'Test error',
      ErrorCategory.SCREENSHOT,
      TestPhase.SCREENSHOT_CAPTURE,
      true,
      { path: '/tmp/screenshot.png' }
    );

    expect(error.context).toEqual({ path: '/tmp/screenshot.png' });
  });
});

describe('categorizeError', () => {
  it('should return existing QAError as-is', () => {
    const existingError = new QAError(
      'Existing error',
      ErrorCategory.TIMEOUT,
      TestPhase.GAMEPLAY_SIMULATION,
      true
    );

    const result = categorizeError(existingError, TestPhase.NAVIGATION);

    expect(result).toBe(existingError);
    expect(result.category).toBe(ErrorCategory.TIMEOUT);
    expect(result.phase).toBe(TestPhase.GAMEPLAY_SIMULATION);
  });

  it('should categorize timeout errors as recoverable', () => {
    const error = new Error('Operation timed out after 5000ms');
    const result = categorizeError(error, TestPhase.START_BUTTON_DETECTION);

    expect(result).toBeInstanceOf(QAError);
    expect(result.category).toBe(ErrorCategory.TIMEOUT);
    expect(result.phase).toBe(TestPhase.START_BUTTON_DETECTION);
    expect(result.recoverable).toBe(true);
    expect(result.message).toBe('Operation timed out after 5000ms');
  });

  it('should categorize "timed out" errors as recoverable', () => {
    const error = new Error('Request timed out');
    const result = categorizeError(error, TestPhase.NAVIGATION);

    expect(result.category).toBe(ErrorCategory.TIMEOUT);
    expect(result.recoverable).toBe(true);
  });

  it('should categorize screenshot errors as recoverable', () => {
    const error = new Error('Failed to capture screenshot');
    const result = categorizeError(error, TestPhase.SCREENSHOT_CAPTURE);

    expect(result).toBeInstanceOf(QAError);
    expect(result.category).toBe(ErrorCategory.SCREENSHOT);
    expect(result.phase).toBe(TestPhase.SCREENSHOT_CAPTURE);
    expect(result.recoverable).toBe(true);
  });

  it('should categorize OpenAI/API errors as recoverable', () => {
    const error1 = new Error('OpenAI API error: Rate limit exceeded');
    const result1 = categorizeError(error1, TestPhase.VISION_ANALYSIS);

    expect(result1.category).toBe(ErrorCategory.VISION_API);
    expect(result1.recoverable).toBe(true);

    const error2 = new Error('API request failed');
    const result2 = categorizeError(error2, TestPhase.STATE_ANALYSIS);

    expect(result2.category).toBe(ErrorCategory.VISION_API);
    expect(result2.recoverable).toBe(true);
  });

  it('should categorize navigation errors as non-recoverable', () => {
    const error = new Error('Navigation failed: Page not found');
    const result = categorizeError(error, TestPhase.NAVIGATION);

    expect(result).toBeInstanceOf(QAError);
    expect(result.category).toBe(ErrorCategory.NAVIGATION);
    expect(result.phase).toBe(TestPhase.NAVIGATION);
    expect(result.recoverable).toBe(false);
  });

  it('should categorize "navigate" errors as non-recoverable', () => {
    const error = new Error('Failed to navigate to URL');
    const result = categorizeError(error, TestPhase.NAVIGATION);

    expect(result.category).toBe(ErrorCategory.NAVIGATION);
    expect(result.recoverable).toBe(false);
  });

  it('should categorize browser errors as non-recoverable', () => {
    const error1 = new Error('Browser initialization failed');
    const result1 = categorizeError(error1, TestPhase.INITIALIZATION);

    expect(result1.category).toBe(ErrorCategory.BROWSER_INIT);
    expect(result1.recoverable).toBe(false);

    const error2 = new Error('Browserbase connection error');
    const result2 = categorizeError(error2, TestPhase.INITIALIZATION);

    expect(result2.category).toBe(ErrorCategory.BROWSER_INIT);
    expect(result2.recoverable).toBe(false);
  });

  it('should categorize unknown errors as non-recoverable', () => {
    const error = new Error('Something unexpected happened');
    const result = categorizeError(error, TestPhase.GAMEPLAY_SIMULATION);

    expect(result).toBeInstanceOf(QAError);
    expect(result.category).toBe(ErrorCategory.UNKNOWN);
    expect(result.phase).toBe(TestPhase.GAMEPLAY_SIMULATION);
    expect(result.recoverable).toBe(false);
    expect(result.message).toBe('Something unexpected happened');
  });

  it('should handle non-Error values (strings)', () => {
    const result = categorizeError('String error', TestPhase.INITIALIZATION);

    expect(result).toBeInstanceOf(QAError);
    expect(result.message).toBe('String error');
    expect(result.category).toBe(ErrorCategory.UNKNOWN);
    expect(result.recoverable).toBe(false);
  });

  it('should handle non-Error values (objects)', () => {
    const errorObj = { code: 500, message: 'Internal error' };
    const result = categorizeError(errorObj, TestPhase.VISION_ANALYSIS);

    expect(result).toBeInstanceOf(QAError);
    expect(result.message).toBe('[object Object]');
    expect(result.category).toBe(ErrorCategory.UNKNOWN);
  });

  it('should handle null/undefined errors', () => {
    const result1 = categorizeError(null, TestPhase.NAVIGATION);
    expect(result1).toBeInstanceOf(QAError);
    expect(result1.message).toBe('null');
    expect(result1.category).toBe(ErrorCategory.UNKNOWN);

    const result2 = categorizeError(undefined, TestPhase.GAME_DETECTION);
    expect(result2).toBeInstanceOf(QAError);
    expect(result2.message).toBe('undefined');
    expect(result2.category).toBe(ErrorCategory.UNKNOWN);
  });

  it('should use provided phase for categorization', () => {
    const error = new Error('Some error');
    const result = categorizeError(error, TestPhase.ADAPTIVE_QA_LOOP);

    expect(result.phase).toBe(TestPhase.ADAPTIVE_QA_LOOP);
  });
});

