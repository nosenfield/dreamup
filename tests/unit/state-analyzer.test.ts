/**
 * Unit tests for StateAnalyzer.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { StateAnalyzer } from '../../src/core/state-analyzer';
import { Logger } from '../../src/utils/logger';
import type { GameState } from '../../src/types';

// Mock OpenAI SDK
const mockGenerateObject = mock(() => ({
  object: {
    groups: [
      {
        reasoning: 'Test reasoning for group',
        confidence: 0.9,
        actions: [
          {
            action: 'click' as const,
            target: { x: 100, y: 200 },
            reasoning: 'Test reasoning',
            confidence: 0.9,
            alternatives: [],
          },
        ],
      },
    ],
  },
  usage: {
    promptTokens: 100,
    completionTokens: 50,
  },
}));

const mockGenerateText = mock(() => ({
  text: 'YES',
  usage: {
    promptTokens: 50,
    completionTokens: 10,
  },
}));

mock.module('ai', () => ({
  generateObject: mockGenerateObject,
  generateText: mockGenerateText,
}));

describe('StateAnalyzer', () => {
  let logger: Logger;
  let analyzer: StateAnalyzer;

  beforeEach(() => {
    logger = new Logger({ module: 'test', op: 'state-analyzer' });
    analyzer = new StateAnalyzer({
      logger,
      apiKey: 'test-api-key',
    });
  });

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      expect(analyzer).toBeInstanceOf(StateAnalyzer);
    });

    it('should use OPENAI_API_KEY from environment by default', () => {
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'env-api-key';
      
      const envAnalyzer = new StateAnalyzer({ logger });
      expect(envAnalyzer).toBeInstanceOf(StateAnalyzer);
      
      process.env.OPENAI_API_KEY = originalKey;
    });

    it('should throw error when API key is missing', () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      expect(() => {
        new StateAnalyzer({ logger });
      }).toThrow('OpenAI API key is required');
      
      if (originalKey) {
        process.env.OPENAI_API_KEY = originalKey;
      }
    });
  });

  describe('analyzeAndRecommendAction', () => {
    it('should analyze state and return array of ActionGroups', async () => {
      const state: GameState = {
        html: '<div>Test HTML</div>',
        screenshot: '/tmp/test.png',
        previousActions: [],
        goal: 'Find start button',
      };

      // Mock file reading
      const mockFile = {
        exists: async () => true,
        arrayBuffer: async () => new ArrayBuffer(0),
      };
      
      // Create a temporary file for testing
      const testFile = Bun.file('/tmp/test-screenshot.png');
      await Bun.write(testFile, Buffer.from('fake-png-data'));

      const result = await analyzer.analyzeAndRecommendAction(
        {
          ...state,
          screenshot: '/tmp/test-screenshot.png',
        },
        1, // iterationNumber
        undefined // successfulGroups
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.length).toBeLessThanOrEqual(3); // Iteration 1: 1-3 groups
      expect(result[0].reasoning).toBeDefined();
      expect(result[0].confidence).toBeGreaterThanOrEqual(0);
      expect(result[0].confidence).toBeLessThanOrEqual(1);
      expect(result[0].actions).toBeInstanceOf(Array);
      expect(result[0].actions.length).toBeGreaterThanOrEqual(1);
      expect(result[0].actions.length).toBeLessThanOrEqual(1); // Iteration 1: exactly 1 action per group
      if (result[0].actions.length > 0) {
        expect(result[0].actions[0].action).toBeDefined();
        expect(result[0].actions[0].confidence).toBeGreaterThanOrEqual(0);
        expect(result[0].actions[0].confidence).toBeLessThanOrEqual(1);
        expect(result[0].actions[0].reasoning).toBeDefined();
        expect(result[0].actions[0].alternatives).toBeInstanceOf(Array);
      }
    });

    it('should log prompt before sending to LLM', async () => {
      const mockDebug = mock(() => {});
      logger.debug = mockDebug;

      const state: GameState = {
        html: '<div>Test HTML</div>',
        screenshot: '/tmp/test.png',
        previousActions: [],
        goal: 'Find start button',
      };

      // Create a temporary file for testing
      const testFile = Bun.file('/tmp/test-screenshot-prompt.png');
      await Bun.write(testFile, Buffer.from('fake-png-data'));

      await analyzer.analyzeAndRecommendAction(
        {
          ...state,
          screenshot: '/tmp/test-screenshot-prompt.png',
        },
        1,
        undefined
      );

      // Verify debug was called with prompt logging
      const debugCalls = mockDebug.mock.calls;
      const promptLogCall = debugCalls.find((call: any[]) => 
        call[0]?.includes('prompt') || call[1]?.prompt || call[1]?.promptText
      );
      
      expect(promptLogCall).toBeDefined();
      if (promptLogCall && promptLogCall[1]) {
        expect(promptLogCall[1]).toHaveProperty('prompt');
        expect(typeof promptLogCall[1].prompt).toBe('string');
        expect(promptLogCall[1].prompt.length).toBeGreaterThan(0);
        expect(promptLogCall[1]).toHaveProperty('promptLength');
        expect(promptLogCall[1]).toHaveProperty('estimatedTokens');
      }
    });

    it('should handle missing screenshot file gracefully', async () => {
      const state: GameState = {
        html: '<div>Test HTML</div>',
        screenshot: '/tmp/nonexistent.png',
        previousActions: [],
        goal: 'Find start button',
      };

      await expect(
        analyzer.analyzeAndRecommendAction(state, 1, undefined)
      ).rejects.toThrow();
    });
  });

  describe('sanitizeHTML', () => {
    it('should remove script tags', () => {
      const html = '<div>Test</div><script>alert("xss")</script><p>Content</p>';
      const sanitized = analyzer.sanitizeHTML(html);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert("xss")');
      expect(sanitized).toContain('<div>Test</div>');
      expect(sanitized).toContain('<p>Content</p>');
    });

    it('should remove event handlers', () => {
      const html = '<button onclick="doSomething()">Click</button>';
      const sanitized = analyzer.sanitizeHTML(html);
      
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).toContain('<button');
    });

    it('should preserve structure', () => {
      const html = '<div><h1>Title</h1><p>Content</p></div>';
      const sanitized = analyzer.sanitizeHTML(html);
      
      expect(sanitized).toContain('<div>');
      expect(sanitized).toContain('<h1>');
      expect(sanitized).toContain('<p>');
    });
  });

  describe('hasStateProgressed', () => {
    it('should compare screenshots and return boolean', async () => {
      // Create temporary screenshot files
      await Bun.write('/tmp/before.png', Buffer.from('fake-png-before'));
      await Bun.write('/tmp/after.png', Buffer.from('fake-png-after'));

      const progressed = await analyzer.hasStateProgressed(
        '/tmp/before.png',
        '/tmp/after.png'
      );

      expect(typeof progressed).toBe('boolean');
    });

    it('should handle missing files gracefully', async () => {
      const progressed = await analyzer.hasStateProgressed(
        '/tmp/nonexistent-before.png',
        '/tmp/nonexistent-after.png'
      );

      expect(typeof progressed).toBe('boolean');
    });
  });
});

