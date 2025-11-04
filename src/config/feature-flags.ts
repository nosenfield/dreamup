/**
 * Feature flags configuration for game testing.
 * 
 * This module defines feature flags that can be enabled/disabled
 * via environment variables. All features are disabled by default
 * in MVP, with future enhancements planned.
 * 
 * @module config.feature-flags
 */

import type { FeatureFlags } from '../types/config.types';

/**
 * Default feature flags configuration.
 * 
 * All features are disabled by default in MVP. Future enhancements
 * will enable these flags when implemented.
 */
export const DEFAULT_FLAGS: FeatureFlags = {
  /** Enable caching of test results (future: DynamoDB/Redis cache) */
  enableCaching: false,

  /** Enable real-time progress updates (future: EventBridge/WebSocket streaming) */
  enableProgressUpdates: false,

  /** Enable error recovery with retry logic (future: exponential backoff retries) */
  enableErrorRecovery: false,

  /** Enable automatic cleanup of screenshots after test (future: delete from /tmp) */
  enableScreenshotCleanup: false,

  /** Enable detailed debug logging (controlled by DEBUG environment variable) */
  enableDetailedLogging: false,
};

/**
 * Parse a boolean string value from environment variable.
 * 
 * @param value - The string value from process.env
 * @returns true if value is 'true', 'True', or 'TRUE', false otherwise
 */
function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return value.toLowerCase() === 'true';
}

/**
 * Get feature flags configuration with environment variable overrides.
 * 
 * Feature flags can be set via environment variables:
 * - DEBUG: Enable detailed logging (default: false)
 * - ENABLE_CACHING: Enable result caching (default: false)
 * - ENABLE_PROGRESS_UPDATES: Enable progress streaming (default: false)
 * - ENABLE_ERROR_RECOVERY: Enable error recovery (default: false)
 * - ENABLE_SCREENSHOT_CLEANUP: Enable screenshot cleanup (default: false)
 * 
 * @returns FeatureFlags object with environment variable overrides applied
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    ...DEFAULT_FLAGS,
    enableDetailedLogging: parseBoolean(process.env.DEBUG),
    enableCaching: parseBoolean(process.env.ENABLE_CACHING),
    enableProgressUpdates: parseBoolean(process.env.ENABLE_PROGRESS_UPDATES),
    enableErrorRecovery: parseBoolean(process.env.ENABLE_ERROR_RECOVERY),
    enableScreenshotCleanup: parseBoolean(process.env.ENABLE_SCREENSHOT_CLEANUP),
  };
}

