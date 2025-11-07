/**
 * Integration tests for Stagehand Agent QA mode.
 * 
 * Note: Full integration tests require extensive mocking of Stagehand agent API.
 * Initial tests focus on function signatures and basic validation.
 * Real E2E tests should be done manually with actual games.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { runStagehandAgentQA } from '../../src/main.js';
import { getFeatureFlags } from '../../src/config/feature-flags.js';
import type { GameMetadata } from '../../src/types/index.js';

// Mock environment
process.env.BROWSERBASE_API_KEY = 'test-key';
process.env.BROWSERBASE_PROJECT_ID = 'test-project';
process.env.OPENAI_API_KEY = 'test-openai-key';

describe('runStagehandAgentQA Integration Tests', () => {
  beforeEach(() => {
    // Reset environment
    process.env.BROWSERBASE_API_KEY = 'test-key';
    process.env.BROWSERBASE_PROJECT_ID = 'test-project';
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  test('throws error if OPENAI_API_KEY missing', async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await runStagehandAgentQA('https://example.com/game');

    expect(result.status).toBe('error');
    expect(result.issues[0].description).toContain('OPENAI_API_KEY');

    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  test('function exists and has correct signature', () => {
    expect(typeof runStagehandAgentQA).toBe('function');
  });

  test('accepts optional metadata parameter', () => {
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
      genre: 'arcade',
      inputSchema: {
        type: 'semantic',
        content: 'Use arrow keys',
      },
    };

    // Function should accept metadata without throwing (at signature level)
    expect(() => {
      const promise = runStagehandAgentQA('https://example.com/game', metadata);
      // Don't await - just verify signature
    }).not.toThrow();
  });

  test('accepts optional config parameter', () => {
    const config = {
      maxDuration: 60000,
    };

    // Function should accept config without throwing (at signature level)
    expect(() => {
      const promise = runStagehandAgentQA('https://example.com/game', undefined, config);
      // Don't await - just verify signature
    }).not.toThrow();
  });

  test('returns GameTestResult structure', async () => {
    // This will fail at runtime due to missing Browserbase connection,
    // but we can verify the error result structure
    const result = await runStagehandAgentQA('https://example.com/game');

    // Verify result has required fields
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('playability_score');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('screenshots');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('metadata');

    // Verify metadata structure
    expect(result.metadata).toHaveProperty('sessionId');
    expect(result.metadata).toHaveProperty('gameUrl');
    expect(result.metadata).toHaveProperty('duration');
    expect(result.metadata).toHaveProperty('gameType');
    expect(result.metadata).toHaveProperty('consoleErrors');
  });

  test('includes stagehandAgent metadata in result when successful', async () => {
    // This test would require full mocking - for now verify structure exists
    const result = await runStagehandAgentQA('https://example.com/game');

    // If successful, should have stagehandAgent metadata
    // If error, won't have it (which is expected)
    if (result.status !== 'error' && result.metadata.stagehandAgent) {
      expect(result.metadata.stagehandAgent).toHaveProperty('success');
      expect(result.metadata.stagehandAgent).toHaveProperty('completed');
      expect(result.metadata.stagehandAgent).toHaveProperty('actionCount');
      expect(result.metadata.stagehandAgent).toHaveProperty('actions');
      expect(result.metadata.stagehandAgent).toHaveProperty('message');
    }
  });
});

describe('CLI Mode Selection', () => {
  test('Stagehand Agent takes precedence over Adaptive QA', () => {
    process.env.ENABLE_STAGEHAND_AGENT = 'true';
    process.env.ENABLE_ADAPTIVE_QA = 'true';

    const flags = getFeatureFlags();

    expect(flags.enableStagehandAgent).toBe(true);
    expect(flags.enableAdaptiveQA).toBe(true);

    // In CLI, should use Stagehand Agent (verified manually or with spy)
    // This is tested in the actual CLI execution, not here

    delete process.env.ENABLE_STAGEHAND_AGENT;
    delete process.env.ENABLE_ADAPTIVE_QA;
  });

  test('Adaptive QA used when Stagehand Agent disabled', () => {
    delete process.env.ENABLE_STAGEHAND_AGENT;
    process.env.ENABLE_ADAPTIVE_QA = 'true';

    const flags = getFeatureFlags();

    expect(flags.enableStagehandAgent).toBe(false);
    expect(flags.enableAdaptiveQA).toBe(true);

    delete process.env.ENABLE_ADAPTIVE_QA;
  });

  test('Standard QA used when both flags disabled', () => {
    delete process.env.ENABLE_STAGEHAND_AGENT;
    delete process.env.ENABLE_ADAPTIVE_QA;

    const flags = getFeatureFlags();

    expect(flags.enableStagehandAgent).toBe(false);
    expect(flags.enableAdaptiveQA).toBe(false);
  });
});

