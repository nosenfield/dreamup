/**
 * Type definitions module for DreamUp game testing agent.
 * 
 * This module exports all TypeScript interfaces and types used throughout
 * the application for type safety and consistency.
 * 
 * @module types
 */

// Export all game test types
export type {
  GameType,
  GameTestRequest,
  GameTestResult,
  TestConfig,
  Issue,
  TestMetadata,
  ClickableElement,
  Screenshot,
  ConsoleError,
  InputSchema,
  GameMetadata,
  InputAction,
  InputAxis,
  LoadingIndicator,
  SuccessIndicator,
  TestingStrategy,
  Action,
  GameState,
  AlternativeAction,
  ActionRecommendation,
  CapturedState,
} from './game-test.types';

// Export all configuration types
export type {
  FeatureFlags,
  Timeouts,
  Thresholds,
  AdaptiveTestConfig,
} from './config.types';

