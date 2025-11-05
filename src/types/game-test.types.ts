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
 * Re-exported from game-detector module for type consistency.
 */
export type { GameType } from '../core/game-detector';

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
  
  /** 
   * Optional comprehensive game metadata.
   * 
   * This is the preferred way to provide game-specific information.
   * Includes input schema, genre, loading hints, success indicators, and testing strategy.
   */
  metadata?: GameMetadata;
  
  /** 
   * Optional input schema describing game controls and interaction methods.
   * 
   * @deprecated Use `metadata.inputSchema` instead. This field is kept for backwards
   * compatibility and will be converted to `metadata.inputSchema` internally.
   * 
   * Migration path:
   * ```typescript
   * // Old (deprecated):
   * { gameUrl: '...', inputSchema: {...} }
   * 
   * // New (preferred):
   * { gameUrl: '...', metadata: { inputSchema: {...} } }
   * ```
   */
  inputSchema?: InputSchema;
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
  gameType: import('../core/game-detector').GameType;
  
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

/**
 * Structured input action with key bindings.
 * 
 * Represents a discrete button event (e.g., Jump, Pause) with specific
 * key bindings for testing.
 */
export interface InputAction {
  /** Name of the action (e.g., "Pause", "Jump", "Shoot") */
  name: string;
  
  /** Array of key names that trigger this action (e.g., ["Escape"], ["Space"]) */
  keys: string[];
  
  /** Optional human-readable description of what this action does */
  description?: string;
}

/**
 * Structured input axis with key bindings.
 * 
 * Represents a continuous input axis (e.g., MoveHorizontal, MoveVertical)
 * that returns values from -1.0 to 1.0.
 */
export interface InputAxis {
  /** Name of the axis (e.g., "MoveHorizontal", "MoveVertical", "Move") */
  name: string;
  
  /** Array of key names that control this axis (e.g., ["ArrowLeft", "ArrowRight"]) */
  keys: string[];
  
  /** Optional human-readable description of what this axis controls */
  description?: string;
  
  /** Optional flag indicating this is a 2D axis (uses both X and Y components) */
  is2D?: boolean;
}

/**
 * Input schema describing how to interact with a game.
 * 
 * Provides information about game controls and input methods to help
 * the QA agent understand how to interact with the game.
 * 
 * - Actions: Discrete button events (e.g., Jump, Shoot)
 * - Axes: Continuous inputs that return values from -1 to 1 (e.g., MoveHorizontal)
 * - First-party games provide JS snippets ('javascript' type)
 * - Third-party games provide semantic descriptions ('semantic' type)
 * 
 * **Backwards Compatibility**: The `actions` and `axes` fields support both:
 * - Old format: `string[]` (array of action/axis names)
 * - New format: `InputAction[]` or `InputAxis[]` (structured with key bindings)
 */
export interface InputSchema {
  /** Type of input schema: 'javascript' for executable JS snippets, 'semantic' for descriptions */
  type: 'javascript' | 'semantic';
  
  /** 
   * Content of the input schema.
   * - For 'javascript': Executable JavaScript snippet that defines input handling
   * - For 'semantic': Human-readable description of game controls
   */
  content: string;
  
  /** 
   * Optional array of actions. Supports both formats for backwards compatibility:
   * - Old format: `string[]` (array of action names like ['Jump', 'Shoot'])
   * - New format: `InputAction[]` (structured actions with key bindings)
   * 
   * Examples:
   * - Old: ['Jump', 'Shoot']
   * - New: [{name: 'Jump', keys: ['Space'], description: 'Jump action'}]
   */
  actions?: string[] | InputAction[];
  
  /** 
   * Optional array of axes. Supports both formats for backwards compatibility:
   * - Old format: `string[]` (array of axis names like ['MoveHorizontal'])
   * - New format: `InputAxis[]` (structured axes with key bindings)
   * 
   * Examples:
   * - Old: ['MoveHorizontal', 'MoveVertical']
   * - New: [{name: 'MoveHorizontal', keys: ['ArrowLeft', 'ArrowRight'], description: 'Move horizontally'}]
   * 
   * Axes return values from -1.0 to 1.0 representing input direction/magnitude
   */
  axes?: string[] | InputAxis[];
}

/**
 * Loading indicator hint for game ready detection.
 * 
 * Provides hints to GameDetector about what to look for when determining
 * if a game has finished loading.
 */
export interface LoadingIndicator {
  /** Type of indicator: 'element' (DOM element), 'text' (text content), 'network' (network idle) */
  type: 'element' | 'text' | 'network';
  
  /** Pattern to match (CSS selector for 'element', text content for 'text', not used for 'network') */
  pattern: string;
  
  /** Human-readable description of what this indicator means */
  description: string;
  
  /** Optional CSS selector for element type (alternative to pattern for element type) */
  selector?: string;
}

/**
 * Success indicator hint for game validation.
 * 
 * Provides hints to VisionAnalyzer about what to look for when determining
 * if a game is working correctly.
 */
export interface SuccessIndicator {
  /** 
   * Type of indicator:
   * - 'score_change': Score value should change
   * - 'animation': Visual animation should occur
   * - 'element_visible': Specific element should be visible
   * - 'interaction_response': Game should respond to input
   */
  type: 'score_change' | 'animation' | 'element_visible' | 'interaction_response';
  
  /** Human-readable description of what success looks like */
  description: string;
  
  /** Optional CSS selector for element-based indicators (score_change, element_visible) */
  selector?: string;
}

/**
 * Testing strategy configuration.
 * 
 * Provides timing and priority hints for the QA agent to optimize testing.
 */
export interface TestingStrategy {
  /** Milliseconds to wait after game loads before starting interaction */
  waitBeforeInteraction: number;
  
  /** Total duration of interaction in milliseconds */
  interactionDuration: number;
  
  /** Optional array of action names to test first (critical actions) */
  criticalActions?: string[];
  
  /** Optional array of axis names to test first (critical axes) */
  criticalAxes?: string[];
  
  /** Optional human-readable instructions for testing this game */
  instructions?: string;
}

/**
 * Comprehensive game metadata for enhanced testing.
 * 
 * Contains all information about a game needed for accurate and efficient testing,
 * including input controls, genre, loading hints, success indicators, and testing strategy.
 * 
 * This is the primary way to provide game-specific information to the QA agent.
 * The old `inputSchema` field on GameTestRequest is deprecated but still supported
 * for backwards compatibility.
 */
export interface GameMetadata {
  /** 
   * Required input schema describing game controls and interaction methods.
   * This is the core metadata that enables targeted testing.
   */
  inputSchema: InputSchema;
  
  /** Optional schema version (e.g., "1.0.0") for versioning metadata format */
  metadataVersion?: string;
  
  /** Optional game genre (e.g., "arcade", "puzzle", "platformer") for context */
  genre?: string;
  
  /** Optional human-readable description of the game */
  description?: string;
  
  /** Optional human-readable description of expected controls (e.g., "Use arrow keys to move") */
  expectedControls?: string;
  
  /** Optional array of loading indicators to help GameDetector identify when game is ready */
  loadingIndicators?: LoadingIndicator[];
  
  /** Optional array of success indicators to help VisionAnalyzer validate game functionality */
  successIndicators?: SuccessIndicator[];
  
  /** Optional testing strategy with timing and priority hints */
  testingStrategy?: TestingStrategy;
}

/**
 * Action performed during game testing.
 * 
 * Represents a single action taken by the QA agent with context
 * for tracking action history and avoiding repetition.
 */
export interface Action {
  /** Type of action performed */
  action: 'click' | 'keypress' | 'wait' | 'complete';
  
  /** Target of the action (coordinates for click, key name for keypress, duration for wait) */
  target: string | { x: number; y: number } | number;
  
  /** Reasoning for why this action was taken */
  reasoning: string;
  
  /** Timestamp when the action was performed */
  timestamp: number;
}

/**
 * Game state context for LLM state analysis.
 * 
 * Contains all information needed for the StateAnalyzer to make
 * intelligent decisions about what action to take next.
 */
export interface GameState {
  /** Sanitized HTML content (scripts removed, structure preserved) */
  html: string;
  
  /** File path to current screenshot */
  screenshot: string;
  
  /** Array of previous actions taken */
  previousActions: Action[];
  
  /** Optional game metadata for context */
  metadata?: GameMetadata;
  
  /** Current goal or objective for the agent */
  goal: string;
}

/**
 * Alternative action recommendation.
 * 
 * Provides fallback options when primary recommendation fails.
 */
export interface AlternativeAction {
  /** Type of alternative action */
  action: 'click' | 'keypress' | 'wait';
  
  /** Target of the alternative action */
  target: string | { x: number; y: number } | number;
  
  /** Reasoning for this alternative */
  reasoning: string;
}

/**
 * Action recommendation from LLM state analysis.
 * 
 * Provides intelligent recommendations for what action to take next
 * based on current game state analysis.
 */
export interface ActionRecommendation {
  /** Type of action to perform */
  action: 'click' | 'keypress' | 'wait' | 'complete';
  
  /** 
   * Target of the action:
   * - For 'click': { x: number, y: number } coordinates
   * - For 'keypress': string key name (e.g., "Space", "ArrowUp")
   * - For 'wait': number duration in milliseconds
   * - For 'complete': not used
   */
  target: string | { x: number; y: number } | number;
  
  /** Human-readable reasoning for this recommendation */
  reasoning: string;
  
  /** Confidence score from 0-1 indicating recommendation certainty */
  confidence: number;
  
  /** Array of alternative actions if primary recommendation fails */
  alternatives: AlternativeAction[];
}

