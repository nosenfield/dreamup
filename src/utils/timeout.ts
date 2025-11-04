/**
 * Timeout utility for managing promise execution time limits.
 * 
 * This module provides a typed wrapper around p-timeout for adding
 * timeout functionality to promises. All async operations in the
 * application should use this utility to ensure they don't exceed
 * their allocated time budget.
 * 
 * @module utils.timeout
 */

import pTimeout, { TimeoutError as PTimeoutError } from 'p-timeout';
import { TIMEOUTS as TIMEOUTS_CONFIG } from '../config/constants';

/**
 * Timeout error class for timeout operations.
 * 
 * Extends the p-timeout TimeoutError to provide consistent error
 * handling across the application.
 * 
 * @example
 * ```typescript
 * try {
 *   await withTimeout(slowPromise, 1000, 'Operation');
 * } catch (error) {
 *   if (error instanceof TimeoutError) {
 *     // Handle timeout
 *   }
 * }
 * ```
 */
export class TimeoutError extends PTimeoutError {
  /**
   * Create a new TimeoutError.
   * 
   * @param message - Error message
   */
  constructor(message: string) {
    super(message);
    // Name is already set by parent class
    Object.defineProperty(this, 'name', {
      value: 'TimeoutError',
      configurable: true,
    });
  }
}

/**
 * Wrap a promise with a timeout.
 * 
 * Adds timeout functionality to a promise. If the promise doesn't
 * resolve or reject within the specified timeout, it will reject
 * with a TimeoutError.
 * 
 * @template T - The return type of the promise
 * @param promise - Promise to wrap with timeout
 * @param milliseconds - Timeout duration in milliseconds
 * @param message - Optional custom error message. If not provided,
 *   defaults to "Operation timed out after {milliseconds}ms"
 * @returns Promise that will reject with TimeoutError if timeout occurs
 * 
 * @example
 * ```typescript
 * // Basic usage with default message
 * const result = await withTimeout(
 *   fetchData(),
 *   5000
 * );
 * 
 * // With custom message
 * const result = await withTimeout(
 *   fetchData(),
 *   5000,
 *   'Fetching data took too long'
 * );
 * 
 * // With timeout constant
 * const result = await withTimeout(
 *   loadGame(),
 *   TIMEOUTS.GAME_LOAD_TIMEOUT,
 *   'Game loading timed out'
 * );
 * ```
 */
export function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  message?: string
): Promise<T> {
  // Use custom message if provided, otherwise use default format
  const errorMessage = message || `Operation timed out after ${milliseconds}ms`;

  // Handle Infinity timeout (never timeout)
  if (milliseconds === Infinity) {
    return promise;
  }

  // Handle negative or zero timeout (reject immediately)
  if (milliseconds <= 0) {
    return Promise.reject(
      new TimeoutError(`Invalid timeout: ${milliseconds}ms. Timeout must be positive.`)
    );
  }

  // Wrap promise with p-timeout
  return pTimeout(promise, {
    milliseconds,
    message: errorMessage,
  }).catch((error) => {
    // Ensure we throw TimeoutError for timeout cases
    if (error instanceof PTimeoutError) {
      throw new TimeoutError(error.message);
    }
    // Re-throw other errors as-is
    throw error;
  });
}

/**
 * Timeout constants for common operations.
 * 
 * Re-exported from config for convenience. These constants define
 * timeout values for various operations and can be overridden via
 * environment variables.
 * 
 * @example
 * ```typescript
 * import { withTimeout, TIMEOUTS } from './utils/timeout';
 * 
 * const result = await withTimeout(
 *   loadGame(),
 *   TIMEOUTS.GAME_LOAD_TIMEOUT,
 *   'Game loading timed out'
 * );
 * ```
 */
export const TIMEOUTS = TIMEOUTS_CONFIG;

