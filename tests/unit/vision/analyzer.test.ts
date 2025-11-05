/**
 * Unit tests for VisionAnalyzer.
 * 
 * Tests the VisionAnalyzer class with mocked OpenAI API calls
 * to verify error handling, utility functions, and API integration.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { VisionAnalyzer } from '../../../src/vision/analyzer';
import { Logger } from '../../../src/utils/logger';
import type { Screenshot, ClickableElement } from '../../../src/types/game-test.types';

// Mock OpenAI API
const mockGenerateObject = mock(() => Promise.resolve({
  object: {
    status: 'pass',
    playability_score: 85,
    issues: [],
    screenshots: ['/path/to/screenshot1.png'],
    timestamp: new Date().toISOString(),
  },
  usage: {
    promptTokens: 100,
    completionTokens: 50,
  },
}));

const mockGenerateText = mock(() => Promise.resolve({
  text: 'The game appears to be running normally.',
  usage: {
    promptTokens: 50,
    completionTokens: 20,
  },
}));

// Mock OpenAI client - must return a callable function that returns model identifier
const mockOpenAIClient = (modelId: string) => modelId;

const mockCreateOpenAI = mock(() => mockOpenAIClient);

// Mock AI SDK functions
mock.module('@ai-sdk/openai', () => ({
  createOpenAI: mockCreateOpenAI,
}));

mock.module('ai', () => ({
  generateObject: mockGenerateObject,
  generateText: mockGenerateText,
}));

describe('VisionAnalyzer', () => {
  let logger: Logger;
  let analyzer: VisionAnalyzer;

  beforeEach(() => {
    logger = new Logger({ module: 'vision-analyzer', op: 'test' });
    mockGenerateObject.mockClear();
    mockGenerateText.mockClear();
    mockCreateOpenAI.mockClear();
    
    // Reset mocks to default behavior
    mockGenerateObject.mockImplementation(() => Promise.resolve({
      object: {
        status: 'pass',
        playability_score: 85,
        issues: [],
        screenshots: ['/path/to/screenshot1.png'],
        timestamp: new Date().toISOString(),
      },
      usage: {
        promptTokens: 100,
        completionTokens: 50,
      },
    }));
    
    mockGenerateText.mockImplementation(() => Promise.resolve({
      text: 'The game appears to be running normally.',
      usage: {
        promptTokens: 50,
        completionTokens: 20,
      },
    }));
  });

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key';
      
      analyzer = new VisionAnalyzer({ logger });
      expect(analyzer).toBeDefined();
      expect(mockCreateOpenAI).toHaveBeenCalledTimes(1);
      
      process.env.OPENAI_API_KEY = originalKey;
    });

    it('should use OPENAI_API_KEY from environment by default', () => {
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key-from-env';
      
      analyzer = new VisionAnalyzer({ logger });
      expect(mockCreateOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-key-from-env',
      });
      
      process.env.OPENAI_API_KEY = originalKey;
    });

    it('should use provided API key when specified', () => {
      analyzer = new VisionAnalyzer({ logger, apiKey: 'custom-key' });
      expect(mockCreateOpenAI).toHaveBeenCalledWith({
        apiKey: 'custom-key',
      });
    });

    it('should throw error when API key is missing', () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      expect(() => {
        analyzer = new VisionAnalyzer({ logger });
      }).toThrow(/OPENAI_API_KEY|api key/i);
      
      process.env.OPENAI_API_KEY = originalKey;
    });
  });

  describe('analyzeScreenshots', () => {
    beforeEach(() => {
      analyzer = new VisionAnalyzer({ logger, apiKey: 'test-key' });
    });

    it('should analyze screenshots and return GameTestResult', async () => {
      const screenshots: Screenshot[] = [
        {
          id: 'screenshot1',
          path: '/tmp/test-screenshot1.png',
          timestamp: Date.now(),
          stage: 'initial_load',
        },
        {
          id: 'screenshot2',
          path: '/tmp/test-screenshot2.png',
          timestamp: Date.now(),
          stage: 'after_interaction',
        },
        {
          id: 'screenshot3',
          path: '/tmp/test-screenshot3.png',
          timestamp: Date.now(),
          stage: 'final_state',
        },
      ];

      // Create dummy PNG files for testing
      const pngBuffer = Buffer.from('fake-png-data');
      await Bun.write('/tmp/test-screenshot1.png', pngBuffer);
      await Bun.write('/tmp/test-screenshot2.png', pngBuffer);
      await Bun.write('/tmp/test-screenshot3.png', pngBuffer);

      const result = await analyzer.analyzeScreenshots(screenshots);

      expect(result).toBeDefined();
      expect(result.status).toBe('pass');
      expect(result.playability_score).toBe(85);
      expect(result.issues).toEqual([]);
      expect(result.screenshots).toHaveLength(3);
      expect(result.screenshots).toEqual([
        '/tmp/test-screenshot1.png',
        '/tmp/test-screenshot2.png',
        '/tmp/test-screenshot3.png',
      ]);
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);

      // Cleanup
      await Bun.write('/tmp/test-screenshot1.png', '');
      await Bun.write('/tmp/test-screenshot2.png', '');
      await Bun.write('/tmp/test-screenshot3.png', '');
    });

    it('should handle API errors gracefully', async () => {
      mockGenerateObject.mockImplementationOnce(() => {
        throw new Error('OpenAI API error');
      });

      const screenshots: Screenshot[] = [
        {
          id: 'screenshot1',
          path: '/tmp/test-screenshot1.png',
          timestamp: Date.now(),
          stage: 'initial_load',
        },
      ];

      const pngBuffer = Buffer.from('fake-png-data');
      await Bun.write('/tmp/test-screenshot1.png', pngBuffer);

      await expect(analyzer.analyzeScreenshots(screenshots)).rejects.toThrow();

      // Cleanup
      await Bun.write('/tmp/test-screenshot1.png', '');
    });

    it('should handle missing screenshot files', async () => {
      const screenshots: Screenshot[] = [
        {
          id: 'screenshot1',
          path: '/tmp/nonexistent-screenshot.png',
          timestamp: Date.now(),
          stage: 'initial_load',
        },
      ];

      await expect(analyzer.analyzeScreenshots(screenshots)).rejects.toThrow();
    });
  });

  describe('findClickableElements', () => {
    beforeEach(() => {
      analyzer = new VisionAnalyzer({ logger, apiKey: 'test-key' });

      mockGenerateObject.mockImplementation(() => Promise.resolve({
        object: {
          elements: [
            {
              label: 'Start Button',
              x: 400,
              y: 300,
              confidence: 0.95,
            },
          ],
        },
        usage: {
          promptTokens: 50,
          completionTokens: 20,
        },
      } as any));
    });

    it('should find clickable elements and return array', async () => {
      const screenshotPath = '/tmp/test-screenshot.png';
      const pngBuffer = Buffer.from('fake-png-data');
      await Bun.write(screenshotPath, pngBuffer);

      const elements = await analyzer.findClickableElements(screenshotPath);

      expect(elements).toBeDefined();
      expect(Array.isArray(elements)).toBe(true);
      expect(elements.length).toBeGreaterThan(0);
      expect(elements[0]).toHaveProperty('label');
      expect(elements[0]).toHaveProperty('x');
      expect(elements[0]).toHaveProperty('y');
      expect(elements[0]).toHaveProperty('confidence');

      // Cleanup
      await Bun.write(screenshotPath, '');
    });

    it('should return empty array on API error', async () => {
      mockGenerateObject.mockImplementationOnce(() => {
        throw new Error('OpenAI API error');
      });

      const screenshotPath = '/tmp/test-screenshot.png';
      const pngBuffer = Buffer.from('fake-png-data');
      await Bun.write(screenshotPath, pngBuffer);

      const elements = await analyzer.findClickableElements(screenshotPath);

      expect(elements).toEqual([]);

      // Cleanup
      await Bun.write(screenshotPath, '');
    });

    it('should return empty array for missing file', async () => {
      const elements = await analyzer.findClickableElements('/tmp/nonexistent.png');
      expect(elements).toEqual([]);
    });
  });

  describe('detectCrash', () => {
    beforeEach(() => {
      analyzer = new VisionAnalyzer({ logger, apiKey: 'test-key' });
    });

    it('should return false for normal screenshot', async () => {
      mockGenerateText.mockImplementationOnce(() => Promise.resolve({
        text: 'The game appears to be running normally.',
        usage: {
          promptTokens: 50,
          completionTokens: 20,
        },
      }));

      const screenshotPath = '/tmp/test-screenshot.png';
      const pngBuffer = Buffer.from('fake-png-data');
      await Bun.write(screenshotPath, pngBuffer);

      const isCrash = await analyzer.detectCrash(screenshotPath);

      expect(isCrash).toBe(false);

      // Cleanup
      await Bun.write(screenshotPath, '');
    });

    it('should return true for crash screenshot', async () => {
      mockGenerateText.mockImplementationOnce(() => Promise.resolve({
        text: 'The game has crashed. A JavaScript error overlay is visible.',
        usage: {
          promptTokens: 50,
          completionTokens: 20,
        },
      }));

      const screenshotPath = '/tmp/test-screenshot.png';
      const pngBuffer = Buffer.from('fake-png-data');
      await Bun.write(screenshotPath, pngBuffer);

      const isCrash = await analyzer.detectCrash(screenshotPath);

      expect(isCrash).toBe(true);

      // Cleanup
      await Bun.write(screenshotPath, '');
    });

    it('should return false on API error', async () => {
      mockGenerateText.mockImplementationOnce(() => {
        throw new Error('OpenAI API error');
      });

      const screenshotPath = '/tmp/test-screenshot.png';
      const pngBuffer = Buffer.from('fake-png-data');
      await Bun.write(screenshotPath, pngBuffer);

      const isCrash = await analyzer.detectCrash(screenshotPath);

      expect(isCrash).toBe(false);

      // Cleanup
      await Bun.write(screenshotPath, '');
    });

    it('should return false for missing file', async () => {
      const isCrash = await analyzer.detectCrash('/tmp/nonexistent.png');
      expect(isCrash).toBe(false);
    });
  });
});

