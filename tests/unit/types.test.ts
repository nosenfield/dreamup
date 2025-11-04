/**
 * Unit tests for type definitions.
 * 
 * These tests verify that all types can be imported and used correctly.
 * Since types are compile-time only, these tests mainly verify that
 * the TypeScript compiler can resolve all imports.
 */

import type {
  GameType,
  GameTestRequest,
  GameTestResult,
  TestConfig,
  Issue,
  TestMetadata,
  ClickableElement,
  Screenshot,
  ConsoleError,
  FeatureFlags,
  Timeouts,
  Thresholds,
} from '../../src/types';

describe('Type Definitions', () => {
  it('should export all game test types', () => {
    // This test verifies that all types can be imported
    // The actual type checking happens at compile time
    expect(true).toBe(true);
  });

  it('should allow creating type-safe objects', () => {
    // Verify that types work correctly by creating sample objects
    const request: GameTestRequest = {
      gameUrl: 'https://example.com/game',
      sessionId: 'test-session',
    };

    const result: GameTestResult = {
      status: 'pass',
      playability_score: 75,
      issues: [],
      screenshots: [],
      timestamp: new Date().toISOString(),
    };

    const featureFlags: FeatureFlags = {
      enableCaching: false,
      enableProgressUpdates: false,
      enableErrorRecovery: false,
      enableScreenshotCleanup: false,
      enableDetailedLogging: false,
    };

    expect(request.gameUrl).toBe('https://example.com/game');
    expect(result.status).toBe('pass');
    expect(featureFlags.enableCaching).toBe(false);
  });
});

