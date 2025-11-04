/**
 * Core type definitions for game testing functionality.
 * 
 * This module defines all interfaces related to game test requests,
 * results, configuration, and metadata.
 * 
 * @module game-test.types
 */

import type { FeatureFlags } from './config.types';

/**
 * Game type enumeration.
 * 
 * Note: This enum will be properly defined in P3.2 (game-detector.ts).
 * Using a placeholder string literal type for now.
 */
export type GameType = 'canvas' | 'iframe' | 'dom' | 'unknown';

/**
 * Request interface for initiating a game test.
 */
export interface GameTestRequest {
  /** The URL of the game to test */
  gameUrl: string;
  
  /** Optional session ID for tracking and correlation */
  sessionId?: string;
  
  /** Optional configuration overrides for this test */
  config?: Partial<TestConfig>;
}

/**
 * Configuration for a game test execution.
 */
export interface TestConfig {
  /** Maximum duration of the entire test in milliseconds */
  maxDuration: number;
  
  /** Timeout for game loading in milliseconds */
  loadTimeout: number;
  
  /** Number of screenshots to capture during the test */
  screenshotCount: number;
  
  /** Feature flags for enabling/disabling features */
  featureFlags: FeatureFlags;
}

/**
 * Result of a game test execution.
 */
export interface GameTestResult {
  /** Test status: 'pass' (playability_score >= 50), 'fail' (< 50), or 'error' (execution failed) */
  status: 'pass' | 'fail' | 'error';
  
  /** Playability score from 0-100. Higher scores indicate better playability */
  playability_score: number;
  
  /** Array of issues identified during the test */
  issues: Issue[];
  
  /** Array of screenshot file paths captured during the test */
  screenshots: string[];
  
  /** ISO 8601 timestamp of when the test completed */
  timestamp: string;
  
  /** Optional metadata about the test execution */
  metadata?: TestMetadata;
}

/**
 * An issue identified during game testing.
 */
export interface Issue {
  /** Severity level of the issue */
  severity: 'critical' | 'major' | 'minor';
  
  /** Human-readable description of the issue */
  description: string;
  
  /** ISO 8601 timestamp of when the issue was detected */
  timestamp: string;
}

/**
 * Metadata about the test execution.
 */
export interface TestMetadata {
  /** Unique session ID for this test run */
  sessionId: string;
  
  /** URL of the game that was tested */
  gameUrl: string;
  
  /** Total duration of the test in milliseconds */
  duration: number;
  
  /** Detected game type (canvas, iframe, dom, or unknown) */
  gameType: GameType;
  
  /** Array of console errors captured during the test */
  consoleErrors: ConsoleError[];
  
  /** Optional number of tokens used in vision API calls */
  visionAnalysisTokens?: number;
}

/**
 * A clickable element detected in a game screenshot.
 */
export interface ClickableElement {
  /** Label or description of the element (e.g., "Start Game", "Play Button") */
  label: string;
  
  /** X coordinate in pixels (0-based, top-left origin) */
  x: number;
  
  /** Y coordinate in pixels (0-based, top-left origin) */
  y: number;
  
  /** Confidence score from 0-1 indicating detection certainty */
  confidence: number;
}

/**
 * Screenshot captured during game testing.
 */
export interface Screenshot {
  /** Unique identifier for this screenshot */
  id: string;
  
  /** File system path to the screenshot file */
  path: string;
  
  /** Timestamp in milliseconds when the screenshot was captured */
  timestamp: number;
  
  /** Stage of the test when the screenshot was taken */
  stage: 'initial_load' | 'after_interaction' | 'final_state';
}

/**
 * Console error or warning captured during game testing.
 */
export interface ConsoleError {
  /** Error or warning message */
  message: string;
  
  /** Timestamp in milliseconds when the error occurred */
  timestamp: number;
  
  /** Log level: 'error' for JavaScript errors, 'warning' for console warnings */
  level: 'error' | 'warning';
}

