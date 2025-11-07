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
  GameMetadata,
  InputAction,
  InputAxis,
  LoadingIndicator,
  SuccessIndicator,
  TestingStrategy,
  OpenRouterConfig,
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

  it('should import GameMetadata type correctly', () => {
    // Verify that GameMetadata type can be imported
    expect(true).toBe(true);
  });

  it('should allow creating GameMetadata with all fields', () => {
    // Verify that GameMetadata object can be created with all optional fields
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
      genre: 'arcade',
      description: 'Test game description',
      expectedControls: 'Use arrow keys to move',
      inputSchema: {
        type: 'javascript',
        content: 'gameBuilder.createAxis("Move")',
        actions: [
          {
            name: 'Pause',
            keys: ['Escape'],
            description: 'Pause the game',
          },
        ],
        axes: [
          {
            name: 'MoveVertical',
            keys: ['ArrowDown', 'ArrowUp'],
            description: 'Move vertically',
          },
        ],
      },
      loadingIndicators: [
        {
          type: 'element',
          pattern: '#start-btn',
          description: 'Start button appears',
        },
      ],
      successIndicators: [
        {
          type: 'score_change',
          description: 'Score increments',
          selector: '#score',
        },
      ],
      testingStrategy: {
        waitBeforeInteraction: 2000,
        interactionDuration: 30000,
        criticalActions: ['Pause'],
        criticalAxes: ['MoveVertical'],
        instructions: 'Test game',
      },
    };

    expect(metadata.genre).toBe('arcade');
    expect(metadata.inputSchema.actions?.[0]?.name).toBe('Pause');
    expect(metadata.inputSchema.axes?.[0]?.name).toBe('MoveVertical');
  });

  it('should allow creating GameMetadata with minimal required fields', () => {
    // Verify that GameMetadata can be created with only required fields
    const metadata: GameMetadata = {
      inputSchema: {
        type: 'semantic',
        content: 'Use arrow keys to move',
      },
    };

    expect(metadata.inputSchema.type).toBe('semantic');
  });

  it('should allow GameTestRequest with metadata field', () => {
    // Verify that GameTestRequest accepts optional metadata field
    const requestWithMetadata: GameTestRequest = {
      gameUrl: 'https://example.com/game',
      metadata: {
        inputSchema: {
          type: 'javascript',
          content: 'gameBuilder.createAxis("Move")',
        },
      },
    };

    const requestWithoutMetadata: GameTestRequest = {
      gameUrl: 'https://example.com/game',
    };

    expect(requestWithMetadata.metadata).toBeDefined();
    expect(requestWithMetadata.metadata?.inputSchema.type).toBe('javascript');
    expect(requestWithoutMetadata.metadata).toBeUndefined();
  });

  it('should allow GameTestRequest with deprecated inputSchema field', () => {
    // Verify backwards compatibility: GameTestRequest still accepts deprecated inputSchema
    const requestWithOldSchema: GameTestRequest = {
      gameUrl: 'https://example.com/game',
      inputSchema: {
        type: 'semantic',
        content: 'Use arrow keys to move',
        actions: ['Jump'],
        axes: ['MoveHorizontal'],
      },
    };

    expect(requestWithOldSchema.inputSchema).toBeDefined();
    expect(requestWithOldSchema.inputSchema?.type).toBe('semantic');
  });

  it('should support InputAction interface structure', () => {
    // Verify InputAction interface structure
    const action: InputAction = {
      name: 'Jump',
      keys: ['Space'],
      description: 'Jump action',
    };

    expect(action.name).toBe('Jump');
    expect(action.keys).toEqual(['Space']);
    expect(action.description).toBe('Jump action');
  });

  it('should support InputAxis interface structure', () => {
    // Verify InputAxis interface structure
    const axis1D: InputAxis = {
      name: 'MoveHorizontal',
      keys: ['ArrowLeft', 'ArrowRight'],
      description: 'Move horizontally',
    };

    const axis2D: InputAxis = {
      name: 'Move',
      keys: ['w', 'a', 's', 'd'],
      description: 'Move in 2D',
      is2D: true,
    };

    expect(axis1D.name).toBe('MoveHorizontal');
    expect(axis1D.is2D).toBeUndefined();
    expect(axis2D.is2D).toBe(true);
  });

  it('should support LoadingIndicator interface structure', () => {
    // Verify LoadingIndicator interface structure
    const indicator: LoadingIndicator = {
      type: 'element',
      pattern: '#start-btn',
      description: 'Start button appears',
      selector: '#start-btn',
    };

    expect(indicator.type).toBe('element');
    expect(indicator.pattern).toBe('#start-btn');
    expect(indicator.selector).toBe('#start-btn');
  });

  it('should support SuccessIndicator interface structure', () => {
    // Verify SuccessIndicator interface structure
    const indicator: SuccessIndicator = {
      type: 'score_change',
      description: 'Score increments',
      selector: '#score',
    };

    expect(indicator.type).toBe('score_change');
    expect(indicator.description).toBe('Score increments');
    expect(indicator.selector).toBe('#score');
  });

  it('should support TestingStrategy interface structure', () => {
    // Verify TestingStrategy interface structure
    const strategy: TestingStrategy = {
      waitBeforeInteraction: 2000,
      interactionDuration: 30000,
      criticalActions: ['Pause'],
      criticalAxes: ['MoveVertical'],
      instructions: 'Test game',
    };

    expect(strategy.waitBeforeInteraction).toBe(2000);
    expect(strategy.interactionDuration).toBe(30000);
    expect(strategy.criticalActions).toEqual(['Pause']);
    expect(strategy.criticalAxes).toEqual(['MoveVertical']);
    expect(strategy.instructions).toBe('Test game');
  });

  it('should import OpenRouterConfig type correctly', () => {
    // Verify that OpenRouterConfig type can be imported and used
    const openRouterConfig: OpenRouterConfig = {
      apiKey: 'or-test-key',
      agentModel: 'anthropic/claude-3.5-sonnet',
      executionModel: 'openai/gpt-4o-mini',
    };

    expect(openRouterConfig.apiKey).toBe('or-test-key');
    expect(openRouterConfig.agentModel).toBe('anthropic/claude-3.5-sonnet');
    expect(openRouterConfig.executionModel).toBe('openai/gpt-4o-mini');
  });

  it('should allow OpenRouterConfig without executionModel', () => {
    // Verify that executionModel is optional
    const openRouterConfig: OpenRouterConfig = {
      apiKey: 'or-test-key',
      agentModel: 'anthropic/claude-3.5-sonnet',
    };

    expect(openRouterConfig.apiKey).toBe('or-test-key');
    expect(openRouterConfig.agentModel).toBe('anthropic/claude-3.5-sonnet');
    expect(openRouterConfig.executionModel).toBeUndefined();
  });

  it('should allow TestConfig with openrouter field', () => {
    // Verify that TestConfig accepts optional openrouter field
    const testConfig: TestConfig = {
      maxDuration: 240000,
      loadTimeout: 60000,
      screenshotCount: 3,
      featureFlags: {
        enableCaching: false,
        enableProgressUpdates: false,
        enableErrorRecovery: false,
        enableScreenshotCleanup: false,
        enableDetailedLogging: false,
        enableAdaptiveQA: false,
        enableDOMStrategy: true,
        enableNaturalLanguageStrategy: true,
        enableVisionStrategy: true,
        enableStateAnalysisStrategy: false,
        enableStagehandAgent: false,
      },
      openrouter: {
        apiKey: 'or-test-key',
        agentModel: 'anthropic/claude-3.5-sonnet',
        executionModel: 'openai/gpt-4o-mini',
      },
    };

    expect(testConfig.openrouter).toBeDefined();
    expect(testConfig.openrouter?.apiKey).toBe('or-test-key');
    expect(testConfig.openrouter?.agentModel).toBe('anthropic/claude-3.5-sonnet');
    expect(testConfig.openrouter?.executionModel).toBe('openai/gpt-4o-mini');
  });

  it('should allow TestConfig without openrouter field', () => {
    // Verify that openrouter is optional
    const testConfig: TestConfig = {
      maxDuration: 240000,
      loadTimeout: 60000,
      screenshotCount: 3,
      featureFlags: {
        enableCaching: false,
        enableProgressUpdates: false,
        enableErrorRecovery: false,
        enableScreenshotCleanup: false,
        enableDetailedLogging: false,
        enableAdaptiveQA: false,
        enableDOMStrategy: true,
        enableNaturalLanguageStrategy: true,
        enableVisionStrategy: true,
        enableStateAnalysisStrategy: false,
        enableStagehandAgent: false,
      },
    };

    expect(testConfig.openrouter).toBeUndefined();
  });
});

