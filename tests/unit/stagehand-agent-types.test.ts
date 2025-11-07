/**
 * Unit tests for Stagehand Agent types and constants.
 */

import { describe, test, expect } from 'bun:test';
import type {
  StagehandAgentAction,
  StagehandAgentResult,
  StagehandAgentMetadata,
  TestMetadata,
} from '../../src/types/index.js';
import { STAGEHAND_AGENT_DEFAULTS } from '../../src/config/index.js';

describe('Stagehand Agent Types', () => {
  test('StagehandAgentAction type exists and has correct structure', () => {
    const action: StagehandAgentAction = {
      type: 'click',
      reasoning: 'Clicking start button',
      completed: false,
      url: 'https://example.com/game',
      timestamp: new Date().toISOString(),
    };

    expect(action.type).toBe('click');
    expect(action.reasoning).toBe('Clicking start button');
    expect(action.completed).toBe(false);
    expect(action.url).toBe('https://example.com/game');
    expect(typeof action.timestamp).toBe('string');
  });

  test('StagehandAgentResult type exists and has correct structure', () => {
    const result: StagehandAgentResult = {
      success: true,
      message: 'Task completed successfully',
      actions: [],
      completed: true,
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        inference_time_ms: 2000,
      },
    };

    expect(result.success).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.message).toBe('Task completed successfully');
    expect(Array.isArray(result.actions)).toBe(true);
    expect(result.usage?.input_tokens).toBe(1000);
    expect(result.usage?.output_tokens).toBe(500);
    expect(result.usage?.inference_time_ms).toBe(2000);
  });

  test('StagehandAgentMetadata type exists', () => {
    const metadata: StagehandAgentMetadata = {
      success: true,
      completed: true,
      actionCount: 5,
      actions: [],
      message: 'Test completed',
    };

    expect(metadata.actionCount).toBe(5);
    expect(metadata.success).toBe(true);
    expect(metadata.completed).toBe(true);
    expect(metadata.message).toBe('Test completed');
    expect(Array.isArray(metadata.actions)).toBe(true);
  });

  test('StagehandAgentMetadata includes usage when available', () => {
    const metadata: StagehandAgentMetadata = {
      success: true,
      completed: true,
      actionCount: 3,
      actions: [],
      message: 'Test completed',
      usage: {
        input_tokens: 2000,
        output_tokens: 1000,
        inference_time_ms: 5000,
      },
    };

    expect(metadata.usage?.input_tokens).toBe(2000);
    expect(metadata.usage?.output_tokens).toBe(1000);
    expect(metadata.usage?.inference_time_ms).toBe(5000);
  });

  test('TestMetadata accepts stagehandAgent field', () => {
    const metadata: Partial<TestMetadata> = {
      sessionId: 'test-123',
      gameUrl: 'https://example.com/game',
      stagehandAgent: {
        success: true,
        completed: true,
        actionCount: 3,
        actions: [],
        message: 'Game tested successfully',
      },
    };

    expect(metadata.stagehandAgent?.success).toBe(true);
    expect(metadata.stagehandAgent?.completed).toBe(true);
    expect(metadata.stagehandAgent?.actionCount).toBe(3);
    expect(metadata.stagehandAgent?.message).toBe('Game tested successfully');
  });

  test('STAGEHAND_AGENT_DEFAULTS has correct structure', () => {
    expect(STAGEHAND_AGENT_DEFAULTS.MAX_STEPS).toBe(25);
    expect(STAGEHAND_AGENT_DEFAULTS.MODEL).toBe('openai/computer-use-preview');
    expect(STAGEHAND_AGENT_DEFAULTS.HIGHLIGHT_CURSOR).toBe(false);
    expect(typeof STAGEHAND_AGENT_DEFAULTS.SYSTEM_PROMPT).toBe('string');
    expect(STAGEHAND_AGENT_DEFAULTS.SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  test('STAGEHAND_AGENT_DEFAULTS.SYSTEM_PROMPT contains QA tester context', () => {
    const prompt = STAGEHAND_AGENT_DEFAULTS.SYSTEM_PROMPT.toLowerCase();
    expect(prompt).toContain('qa');
    expect(prompt).toContain('test');
  });
});

