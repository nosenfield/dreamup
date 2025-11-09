/**
 * Unit tests for StateAnalyzer.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { StateAnalyzer } from '../../src/core/state-analyzer';
import { Logger } from '../../src/utils/logger';
import type { GameState, SuccessfulActionGroup } from '../../src/types';

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

    it('should return 1-3 groups with exactly 1 action each for iteration 1', async () => {
      // Mock to return 2 groups for iteration 1
      mockGenerateObject.mockReturnValueOnce({
        object: {
          groups: [
            {
              reasoning: 'First strategy',
              confidence: 0.9,
              actions: [
                {
                  action: 'click' as const,
                  target: { x: 100, y: 200 },
                  reasoning: 'First action',
                  confidence: 0.9,
                  alternatives: [],
                },
              ],
            },
            {
              reasoning: 'Second strategy',
              confidence: 0.7,
              actions: [
                {
                  action: 'keypress' as const,
                  target: 'Enter',
                  reasoning: 'Second action',
                  confidence: 0.7,
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
      });

      const state: GameState = {
        html: '<div>Test HTML</div>',
        screenshot: '/tmp/test.png',
        previousActions: [],
        goal: 'Find start button',
      };

      const testFile = Bun.file('/tmp/test-iter1.png');
      await Bun.write(testFile, Buffer.from('fake-png-data'));

      const result = await analyzer.analyzeAndRecommendAction(
        {
          ...state,
          screenshot: '/tmp/test-iter1.png',
        },
        1, // iteration 1
        undefined
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.length).toBeLessThanOrEqual(3);
      result.forEach(group => {
        expect(group.actions.length).toBe(1); // Exactly 1 action per group for iteration 1
      });
    });

    it('should return groups with 1-5 actions for iteration 2', async () => {
      // Mock to return 1 group with 3 actions for iteration 2
      mockGenerateObject.mockReturnValueOnce({
        object: {
          groups: [
            {
              reasoning: 'Build on successful strategy',
              confidence: 0.85,
              actions: [
                {
                  action: 'click' as const,
                  target: { x: 100, y: 200 },
                  reasoning: 'First action',
                  confidence: 0.85,
                  alternatives: [],
                },
                {
                  action: 'click' as const,
                  target: { x: 150, y: 250 },
                  reasoning: 'Second action',
                  confidence: 0.85,
                  alternatives: [],
                },
                {
                  action: 'click' as const,
                  target: { x: 200, y: 300 },
                  reasoning: 'Third action',
                  confidence: 0.85,
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
      });

      const state: GameState = {
        html: '<div>Test HTML</div>',
        screenshot: '/tmp/test.png',
        previousActions: [],
        goal: 'Continue playing',
      };

      const testFile = Bun.file('/tmp/test-iter2.png');
      await Bun.write(testFile, Buffer.from('fake-png-data'));

      const successfulGroups: SuccessfulActionGroup[] = [
        {
          reasoning: 'Previous successful strategy',
          actions: [
            {
              action: 'click',
              target: { x: 100, y: 200 },
              reasoning: 'Previous action',
              timestamp: Date.now(),
              success: true,
              stateProgressed: true,
            },
          ],
          beforeScreenshot: '/tmp/before.png',
          afterScreenshot: '/tmp/after.png',
          confidence: 0.9,
        },
      ];

      const result = await analyzer.analyzeAndRecommendAction(
        {
          ...state,
          screenshot: '/tmp/test-iter2.png',
        },
        2, // iteration 2
        successfulGroups
      );

      expect(result.length).toBeGreaterThan(0);
      result.forEach(group => {
        expect(group.actions.length).toBeGreaterThanOrEqual(1);
        expect(group.actions.length).toBeLessThanOrEqual(5); // 1-5 actions for iteration 2
      });
    });

    it('should return groups with 1-10 actions for iteration 3+', async () => {
      // Mock to return 1 group with 7 actions for iteration 3
      mockGenerateObject.mockReturnValueOnce({
        object: {
          groups: [
            {
              reasoning: 'Expand successful strategy',
              confidence: 0.9,
              actions: Array.from({ length: 7 }, (_, i) => ({
                action: 'click' as const,
                target: { x: 100 + i * 10, y: 200 + i * 10 },
                reasoning: `Action ${i + 1}`,
                confidence: 0.9,
                alternatives: [],
              })),
            },
          ],
        },
        usage: {
          promptTokens: 100,
          completionTokens: 50,
        },
      });

      const state: GameState = {
        html: '<div>Test HTML</div>',
        screenshot: '/tmp/test.png',
        previousActions: [],
        goal: 'Continue playing',
      };

      const testFile = Bun.file('/tmp/test-iter3.png');
      await Bun.write(testFile, Buffer.from('fake-png-data'));

      const successfulGroups: SuccessfulActionGroup[] = [
        {
          reasoning: 'Previous successful strategy',
          actions: [
            {
              action: 'click',
              target: { x: 100, y: 200 },
              reasoning: 'Previous action',
              timestamp: Date.now(),
              success: true,
              stateProgressed: true,
            },
          ],
          beforeScreenshot: '/tmp/before.png',
          afterScreenshot: '/tmp/after.png',
          confidence: 0.9,
        },
      ];

      const result = await analyzer.analyzeAndRecommendAction(
        {
          ...state,
          screenshot: '/tmp/test-iter3.png',
        },
        3, // iteration 3
        successfulGroups
      );

      expect(result.length).toBeGreaterThan(0);
      result.forEach(group => {
        expect(group.actions.length).toBeGreaterThanOrEqual(1);
        expect(group.actions.length).toBeLessThanOrEqual(10); // 1-10 actions for iteration 3+
      });
    });

    it('should accept successful groups context for iteration 2+', async () => {
      const mockDebug = mock(() => {});
      logger.debug = mockDebug;

      const state: GameState = {
        html: '<div>Test HTML</div>',
        screenshot: '/tmp/test.png',
        previousActions: [],
        goal: 'Continue playing',
      };

      const testFile = Bun.file('/tmp/test-successful-groups.png');
      await Bun.write(testFile, Buffer.from('fake-png-data'));

      const successfulGroups: SuccessfulActionGroup[] = [
        {
          reasoning: 'Previous successful strategy',
          actions: [
            {
              action: 'click',
              target: { x: 100, y: 200 },
              reasoning: 'Previous action',
              timestamp: Date.now(),
              success: true,
              stateProgressed: true,
            },
          ],
          beforeScreenshot: '/tmp/before.png',
          afterScreenshot: '/tmp/after.png',
          confidence: 0.9,
        },
      ];

      await analyzer.analyzeAndRecommendAction(
        {
          ...state,
          screenshot: '/tmp/test-successful-groups.png',
        },
        2, // iteration 2
        successfulGroups
      );

      // Verify that the prompt includes successful group context
      const debugCalls = mockDebug.mock.calls;
      const promptLogCall = debugCalls.find((call: any[]) => 
        call[1]?.prompt && typeof call[1].prompt === 'string'
      );
      
      expect(promptLogCall).toBeDefined();
      if (promptLogCall && promptLogCall[1]?.prompt) {
        const promptText = promptLogCall[1].prompt;
        expect(promptText).toContain('Previous successful strategy');
        expect(promptText).toContain('Successful Action Groups from Previous Iteration');
      }
    });

    it('should handle zero groups returned (termination)', async () => {
      // Mock to return zero groups
      mockGenerateObject.mockReturnValueOnce({
        object: {
          groups: [],
        },
        usage: {
          promptTokens: 100,
          completionTokens: 50,
        },
      });

      const state: GameState = {
        html: '<div>Test HTML</div>',
        screenshot: '/tmp/test.png',
        previousActions: [],
        goal: 'Find start button',
      };

      const testFile = Bun.file('/tmp/test-zero-groups.png');
      await Bun.write(testFile, Buffer.from('fake-png-data'));

      // Zero groups for iteration 1 should throw a validation error
      // (This is expected - zero groups is handled at the AdaptiveQALoop level as termination)
      await expect(
        analyzer.analyzeAndRecommendAction(
          {
            ...state,
            screenshot: '/tmp/test-zero-groups.png',
          },
          1,
          undefined
        )
      ).rejects.toThrow('Invalid ActionGroups');
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

