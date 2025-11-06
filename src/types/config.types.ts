/**
 * Configuration type definitions for game testing.
 * 
 * This module defines interfaces for feature flags, timeouts, and thresholds
 * used throughout the application.
 * 
 * @module config.types
 */

/**
 * Feature flags for enabling/disabling optional features.
 * 
 * All features are disabled by default in MVP. Future enhancements
 * will enable these flags when implemented.
 */
export interface FeatureFlags {
  /** Enable caching of test results (future: DynamoDB/Redis cache) */
  enableCaching: boolean;
  
  /** Enable real-time progress updates (future: EventBridge/WebSocket streaming) */
  enableProgressUpdates: boolean;
  
  /** Enable error recovery with retry logic (future: exponential backoff retries) */
  enableErrorRecovery: boolean;
  
  /** Enable automatic cleanup of screenshots after test (future: delete from /tmp) */
  enableScreenshotCleanup: boolean;
  
  /** Enable detailed debug logging (controlled by DEBUG environment variable) */
  enableDetailedLogging: boolean;
  
  /** Enable adaptive QA mode (iterative action loop with LLM) */
  enableAdaptiveQA: boolean;
}

/**
 * Timeout values in milliseconds for various operations.
 */
export interface Timeouts {
  /** Maximum duration for the entire test execution (default: 240000ms = 4 minutes) */
  MAX_TEST_DURATION: number;

  /** Timeout for waiting for game to load (default: 60000ms = 60 seconds) */
  GAME_LOAD_TIMEOUT: number;

  /** Timeout for interaction sequences (default: 90000ms = 90 seconds) */
  INTERACTION_TIMEOUT: number;

  /** Timeout for individual screenshot capture (default: 10000ms = 10 seconds) */
  SCREENSHOT_TIMEOUT: number;

  /** Timeout for page navigation (default: 30000ms = 30 seconds) */
  PAGE_NAVIGATION_TIMEOUT: number;

  /** Delay after clicking start button to allow game initialization (default: 2000ms = 2 seconds) */
  POST_START_DELAY: number;
}

/**
 * Threshold values for test evaluation and behavior.
 */
export interface Thresholds {
  /** Minimum playability score to consider a test as "pass" (default: 50) */
  PLAYABILITY_PASS_SCORE: number;
  
  /** Maximum number of retry attempts (default: 0 for MVP - fail immediately) */
  MAX_RETRIES: number;
  
  /** Default number of screenshots to capture during a test (default: 3) */
  SCREENSHOT_COUNT: number;
}

/**
 * Configuration for adaptive QA testing mode.
 * 
 * Controls the iterative action loop behavior, including budget limits,
 * action limits, and screenshot strategy.
 */
export interface AdaptiveTestConfig {
  /** Maximum budget in USD per test (default: 0.50) */
  maxBudget: number;
  
  /** Maximum duration in milliseconds (default: 240000 = 4 minutes) */
  maxDuration: number;
  
  /** Maximum number of actions to perform (default: 20) */
  maxActions: number;
  
  /** Screenshot capture strategy: 'fixed' (distribute evenly) or 'adaptive' (based on state changes) */
  screenshotStrategy: 'fixed' | 'adaptive';
  
  /** LLM call strategy: 'eager' (call every iteration) or 'lazy' (skip if state unchanged) */
  llmCallStrategy: 'eager' | 'lazy';
}

