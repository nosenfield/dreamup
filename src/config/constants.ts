/**
 * Configuration constants for game testing.
 * 
 * This module defines timeout values, thresholds, and file paths
 * used throughout the application. All values can be overridden
 * via environment variables.
 * 
 * @module config.constants
 */

import type { Timeouts, Thresholds, AdaptiveTestConfig } from '../types/config.types';

/**
 * Timeout values in milliseconds for various operations.
 *
 * All values can be overridden via environment variables:
 * - MAX_TEST_DURATION: Maximum duration for entire test (default: 240000ms = 4 minutes)
 * - GAME_LOAD_TIMEOUT: Timeout for game loading (default: 60000ms = 60 seconds)
 * - INTERACTION_TIMEOUT: Timeout for interactions (default: 90000ms = 90 seconds)
 * - SCREENSHOT_TIMEOUT: Timeout for screenshot capture (default: 10000ms = 10 seconds)
 * - PAGE_NAVIGATION_TIMEOUT: Timeout for page navigation (default: 30000ms = 30 seconds)
 * - POST_START_DELAY: Delay after clicking start button (default: 2000ms = 2 seconds)
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

  /** Delay after clicking start button to allow game initialization in milliseconds */
  POST_START_DELAY: parseInt(
    process.env.POST_START_DELAY || '2000',
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

/**
 * Default adaptive test configuration values.
 * 
 * These can be overridden via AdaptiveTestConfig in GameTestRequest.
 */
export const ADAPTIVE_DEFAULTS: AdaptiveTestConfig = {
  /** Maximum budget in USD per test (default: 0.50) */
  maxBudget: 0.50,
  
  /** Maximum duration in milliseconds (default: 240000 = 4 minutes) */
  maxDuration: 240000,
  
  /** Maximum number of actions to perform (default: 20) */
  maxActions: 20,
  
  /** Screenshot capture strategy */
  screenshotStrategy: 'fixed',
  
  /** LLM call strategy */
  llmCallStrategy: 'eager',
};

/**
 * Cost calculation constants for adaptive QA.
 * 
 * Used to estimate costs and manage budget limits.
 */
export const ADAPTIVE_COSTS = {
  /** Cost per screenshot analysis in USD (GPT-4V with 1 image) */
  COST_PER_SCREENSHOT: 0.02,
  
  /** Cost per LLM action recommendation in USD (GPT-4V with 1 image + HTML) */
  COST_PER_ACTION_RECOMMENDATION: 0.02,
  
  /** Cost per state progression check in USD (GPT-4V with 2 images) */
  COST_PER_STATE_CHECK: 0.03,
  
  /** Budget reserved for final multi-image analysis in USD */
  RESERVED_FOR_FINAL_ANALYSIS: 0.10,
} as const;

/**
 * Stagehand Agent QA Mode Configuration
 *
 * Uses Stagehand's autonomous agent with OpenAI computer-use-preview model.
 * Agent handles observe-act loop internally without manual state management.
 *
 * @see https://docs.stagehand.dev/v3/basics/agent
 * @see https://platform.openai.com/docs/models/computer-use-preview
 */
export const STAGEHAND_AGENT_DEFAULTS = {
  /**
   * Maximum number of autonomous actions agent can take
   * Higher = more exploration, higher cost
   * Lower = faster execution, may not complete complex tasks
   */
  MAX_STEPS: 25,

  /**
   * OpenAI model for computer use with vision capabilities
   * Supports autonomous screen control via Computer Use Agent (CUA) mode
   */
  MODEL: 'openai/computer-use-preview',

  /**
   * Whether to show visual cursor highlights during execution
   * Useful for debugging but may interfere with game UI
   */
  HIGHLIGHT_CURSOR: false,

  /**
   * System prompt for agent behavior
   * Instructs agent to act as QA tester
   */
  SYSTEM_PROMPT: 'You are a QA tester for browser games. Your goal is to test all functionality, try different controls, look for bugs, and explore the game thoroughly. Report any errors or unusual behavior you encounter.',
} as const;

/**
 * Default OpenRouter configuration for Stagehand Agent.
 * 
 * Provides model selection defaults for OpenRouter integration.
 * Models must be in provider/model format (e.g., "anthropic/claude-3.5-sonnet").
 * 
 * @see https://openrouter.ai/docs/models
 */
export const OPENROUTER_DEFAULTS = {
  /** Default agent model for autonomous testing */
  AGENT_MODEL: 'anthropic/claude-3.5-sonnet',

  /** Default execution model for tool calls (if not specified, uses AGENT_MODEL) */
  EXECUTION_MODEL: undefined as string | undefined,

  /** OpenRouter API base URL */
  BASE_URL: 'https://openrouter.ai/api/v1',
} as const;

