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
  InputSchema,
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

  it('should import InputSchema type correctly', () => {
    // Verify that InputSchema type can be imported and used
    const inputSchema: InputSchema = {
      type: 'javascript',
      content: 'function handleInput(action, value) { /* ... */ }',
      actions: ['Jump', 'Shoot'],
      axes: ['MoveHorizontal'],
    };

    expect(inputSchema.type).toBe('javascript');
    expect(inputSchema.actions).toEqual(['Jump', 'Shoot']);
    expect(inputSchema.axes).toEqual(['MoveHorizontal']);
  });

  it('should allow GameTestRequest with inputSchema field', () => {
    // Verify that GameTestRequest accepts optional inputSchema field
    const requestWithSchema: GameTestRequest = {
      gameUrl: 'https://example.com/game',
      inputSchema: {
        type: 'semantic',
        content: 'Use arrow keys to move, spacebar to jump',
        actions: ['Jump', 'Shoot'],
        axes: ['MoveHorizontal', 'MoveVertical'],
      },
    };

    const requestWithoutSchema: GameTestRequest = {
      gameUrl: 'https://example.com/game',
    };

    expect(requestWithSchema.inputSchema).toBeDefined();
    expect(requestWithSchema.inputSchema?.type).toBe('semantic');
    expect(requestWithoutSchema.inputSchema).toBeUndefined();
  });

  it('should support both javascript and semantic input schema types', () => {
    // Verify that both schema types are valid
    const jsSchema: InputSchema = {
      type: 'javascript',
      content: 'window.gameControls = { jump: () => {}, shoot: () => {} };',
      actions: ['Jump', 'Shoot'],
    };

    const semanticSchema: InputSchema = {
      type: 'semantic',
      content: 'Platformer game: Use arrow keys to move, spacebar to jump',
      actions: ['Jump'],
      axes: ['MoveHorizontal'],
    };

    expect(jsSchema.type).toBe('javascript');
    expect(semanticSchema.type).toBe('semantic');
    expect(jsSchema.actions).toEqual(['Jump', 'Shoot']);
    expect(semanticSchema.axes).toEqual(['MoveHorizontal']);
  });
});

