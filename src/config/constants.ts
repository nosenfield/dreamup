/**
 * Configuration constants for game testing.
 * 
 * This module defines timeout values, thresholds, and file paths
 * used throughout the application. All values can be overridden
 * via environment variables.
 * 
 * @module config.constants
 */

import type { Timeouts, Thresholds } from '../types/config.types';

/**
 * Timeout values in milliseconds for various operations.
 * 
 * All values can be overridden via environment variables:
 * - MAX_TEST_DURATION: Maximum duration for entire test (default: 240000ms = 4 minutes)
 * - GAME_LOAD_TIMEOUT: Timeout for game loading (default: 60000ms = 60 seconds)
 * - INTERACTION_TIMEOUT: Timeout for interactions (default: 90000ms = 90 seconds)
 * - SCREENSHOT_TIMEOUT: Timeout for screenshot capture (default: 10000ms = 10 seconds)
 * - PAGE_NAVIGATION_TIMEOUT: Timeout for page navigation (default: 30000ms = 30 seconds)
 */
export const TIMEOUTS: Timeouts = {
  /** Maximum duration for the entire test execution in milliseconds */
  MAX_TEST_DURATION: parseInt(
    process.env.MAX_TEST_DURATION || '240000',
    10
  ),

  /** Timeout for waiting for game to load in milliseconds */
  GAME_LOAD_TIMEOUT: parseInt(
    process.env.GAME_LOAD_TIMEOUT || '60000',
    10
  ),

  /** Timeout for interaction sequences in milliseconds */
  INTERACTION_TIMEOUT: parseInt(
    process.env.INTERACTION_TIMEOUT || '90000',
    10
  ),

  /** Timeout for individual screenshot capture in milliseconds */
  SCREENSHOT_TIMEOUT: parseInt(
    process.env.SCREENSHOT_TIMEOUT || '10000',
    10
  ),

  /** Timeout for page navigation in milliseconds */
  PAGE_NAVIGATION_TIMEOUT: parseInt(
    process.env.PAGE_NAVIGATION_TIMEOUT || '30000',
    10
  ),
};

/**
 * Threshold values for test evaluation and behavior.
 * 
 * These values define pass/fail criteria and default behavior.
 */
export const THRESHOLDS: Thresholds = {
  /** Minimum playability score to consider a test as "pass" (0-100 scale) */
  PLAYABILITY_PASS_SCORE: 50,

  /** Maximum number of retry attempts (0 = fail immediately in MVP) */
  MAX_RETRIES: 0,

  /** Default number of screenshots to capture during a test */
  SCREENSHOT_COUNT: 3,
};

/**
 * File system paths for output directories.
 * 
 * All paths use /tmp for Lambda compatibility (ephemeral storage).
 */
export const PATHS = {
  /** Base output directory in Lambda /tmp */
  OUTPUT_DIR: '/tmp/game-qa-output',

  /** Subdirectory for screenshots */
  SCREENSHOTS_SUBDIR: 'screenshots',

  /** Subdirectory for test reports */
  REPORTS_SUBDIR: 'reports',
} as const;

