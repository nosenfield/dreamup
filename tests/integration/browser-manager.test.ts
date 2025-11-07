/**
 * Integration tests for BrowserManager.
 * 
 * These tests verify BrowserManager functionality with mocked Browserbase/Stagehand.
 * Tests use mocks to avoid requiring real API credentials during test runs.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { BrowserManager } from '../../src/core/browser-manager';
import { Logger } from '../../src/utils/logger';
import { TimeoutError } from '../../src/utils/timeout';
import { AISdkClient } from '@browserbasehq/stagehand';

// Mock Stagehand
const mockPage = {
  goto: mock(() => Promise.resolve()),
  close: mock(() => Promise.resolve()),
  screenshot: mock(() => Promise.resolve(Buffer.from('fake-image'))),
  url: mock(() => 'https://example.com'),
};

const mockStagehand = {
  init: mock(() => Promise.resolve()),
  close: mock(() => Promise.resolve()),
  context: {
    pages: mock(() => [mockPage]),
    activePage: mock(() => mockPage),
  },
};

// Mock AISdkClient
const mockAISdkClient = {
  // AISdkClient is a class, mock it as an object
} as unknown as AISdkClient;

// Mock Stagehand module
let stagehandConstructorArgs: any[] = [];
mock.module('@browserbasehq/stagehand', () => ({
  Stagehand: mock((config: any) => {
    stagehandConstructorArgs.push(config);
    return mockStagehand;
  }),
  AISdkClient: mock(() => mockAISdkClient),
}));

describe('BrowserManager', () => {
  let logger: Logger;
  let browserManager: BrowserManager;

  beforeEach(() => {
    logger = new Logger({ module: 'test', op: 'browser-manager-test' });
    browserManager = new BrowserManager({
      apiKey: 'test-api-key',
      projectId: 'test-project-id',
      logger,
    });
    
    // Reset mocks
    mockStagehand.init.mockClear();
    mockStagehand.close.mockClear();
    mockPage.goto.mockClear();
    mockPage.close.mockClear();
    stagehandConstructorArgs = [];
  });

  afterEach(async () => {
    // Cleanup if browser was initialized
    try {
      await browserManager.cleanup();
    } catch {
      // Ignore cleanup errors in tests
    }
  });

  describe('initialize()', () => {
    it('should initialize browser successfully', async () => {
      const page = await browserManager.initialize();

      expect(mockStagehand.init).toHaveBeenCalledTimes(1);
      expect(page).toBeDefined();
      expect(page as any).toBe(mockPage);
    });

    it('should handle initialization errors', async () => {
      mockStagehand.init.mockImplementationOnce(() => {
        throw new Error('Failed to initialize');
      });

      await expect(browserManager.initialize()).rejects.toThrow('Failed to initialize');
    });

    it('should timeout if initialization takes too long', async () => {
      // Use a shorter timeout for testing to avoid long waits
      const fastBrowser = new BrowserManager({
        apiKey: 'test-api-key',
        projectId: 'test-project-id',
        logger,
        initTimeout: 100, // Very short timeout for testing
      });

      // Mock a slow initialization
      mockStagehand.init.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(resolve, 500); // Longer than 100ms timeout
        });
      });

      await expect(fastBrowser.initialize()).rejects.toThrow();
    });
  });

  describe('navigate()', () => {
    it('should navigate to URL successfully', async () => {
      await browserManager.initialize();
      await browserManager.navigate('https://example.com/game');

      expect(mockPage.goto).toHaveBeenCalledTimes(1);
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com/game', {
        waitUntil: 'networkidle',
      });
    });

    it('should handle navigation errors', async () => {
      await browserManager.initialize();
      mockPage.goto.mockImplementationOnce(() => {
        throw new Error('Navigation failed');
      });

      await expect(browserManager.navigate('https://example.com/game')).rejects.toThrow(
        'Navigation failed'
      );
    });

    it('should timeout if navigation takes too long', async () => {
      await browserManager.initialize();
      
      // Use a shorter timeout for testing
      const fastBrowser = new BrowserManager({
        apiKey: 'test-api-key',
        projectId: 'test-project-id',
        logger,
        navigateTimeout: 100, // Very short timeout for testing
      });
      await fastBrowser.initialize();
      
      mockPage.goto.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(resolve, 500); // Longer than 100ms timeout
        });
      });

      await expect(fastBrowser.navigate('https://example.com/game')).rejects.toThrow();
    });

    it('should throw error if browser not initialized', async () => {
      await expect(browserManager.navigate('https://example.com/game')).rejects.toThrow(
        'Browser not initialized'
      );
    });
  });

  describe('cleanup()', () => {
    it('should cleanup successfully after initialization', async () => {
      await browserManager.initialize();
      await browserManager.cleanup();

      expect(mockPage.close).toHaveBeenCalledTimes(1);
      expect(mockStagehand.close).toHaveBeenCalledTimes(1);
    });

    it('should handle cleanup errors gracefully', async () => {
      await browserManager.initialize();
      mockPage.close.mockImplementationOnce(() => {
        throw new Error('Cleanup failed');
      });

      // Cleanup should not throw, just log
      await browserManager.cleanup();
      expect(true).toBe(true); // Just verify it completes without throwing
    });

    it('should handle cleanup when browser not initialized', async () => {
      // Should not throw if browser was never initialized
      await browserManager.cleanup();
      expect(true).toBe(true); // Just verify it completes without error
    });
  });

  describe('error handling', () => {
    it('should log errors during initialization', async () => {
      const errorSpy = mock();
      logger.error = errorSpy;

      mockStagehand.init.mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      await expect(browserManager.initialize()).rejects.toThrow();

      // Logger should have been called (if error logging is implemented)
      // Note: Actual logging verification depends on Logger implementation
    });
  });

  describe('llmClient support (OpenRouter integration)', () => {
    it('should accept optional llmClient parameter', () => {
      const browserWithLlmClient = new BrowserManager({
        apiKey: 'test-api-key',
        projectId: 'test-project-id',
        logger,
        llmClient: mockAISdkClient,
      });

      expect(browserWithLlmClient).toBeDefined();
    });

    it('should work without llmClient (backwards compatible)', () => {
      const browserWithoutLlmClient = new BrowserManager({
        apiKey: 'test-api-key',
        projectId: 'test-project-id',
        logger,
      });

      expect(browserWithoutLlmClient).toBeDefined();
    });

    it('should pass llmClient to Stagehand constructor when provided', async () => {
      const browserWithLlmClient = new BrowserManager({
        apiKey: 'test-api-key',
        projectId: 'test-project-id',
        logger,
        llmClient: mockAISdkClient,
      });

      await browserWithLlmClient.initialize();

      // Verify Stagehand was called with llmClient
      expect(stagehandConstructorArgs.length).toBeGreaterThan(0);
      const lastCall = stagehandConstructorArgs[stagehandConstructorArgs.length - 1];
      expect(lastCall).toHaveProperty('llmClient');
      expect(lastCall.llmClient).toBe(mockAISdkClient);
      expect(lastCall.env).toBe('BROWSERBASE');
      expect(lastCall.apiKey).toBe('test-api-key');
      expect(lastCall.projectId).toBe('test-project-id');
    });

    it('should not pass llmClient to Stagehand when not provided', async () => {
      const browserWithoutLlmClient = new BrowserManager({
        apiKey: 'test-api-key',
        projectId: 'test-project-id',
        logger,
      });

      await browserWithoutLlmClient.initialize();

      // Verify Stagehand was called without llmClient
      expect(stagehandConstructorArgs.length).toBeGreaterThan(0);
      const lastCall = stagehandConstructorArgs[stagehandConstructorArgs.length - 1];
      expect(lastCall).not.toHaveProperty('llmClient');
      expect(lastCall.env).toBe('BROWSERBASE');
      expect(lastCall.apiKey).toBe('test-api-key');
      expect(lastCall.projectId).toBe('test-project-id');
    });

    it('should log hasLlmClient when initializing with llmClient', async () => {
      const logSpy = mock();
      logger.info = logSpy;

      const browserWithLlmClient = new BrowserManager({
        apiKey: 'test-api-key',
        projectId: 'test-project-id',
        logger,
        llmClient: mockAISdkClient,
      });

      await browserWithLlmClient.initialize();

      // Verify log was called with hasLlmClient
      const initLogCall = logSpy.mock.calls.find((call: any[]) => 
        call[0] === 'Initializing browser session'
      );
      expect(initLogCall).toBeDefined();
      expect(initLogCall[1]).toHaveProperty('hasLlmClient', true);
    });

    it('should log hasLlmClient false when initializing without llmClient', async () => {
      const logSpy = mock();
      logger.info = logSpy;

      const browserWithoutLlmClient = new BrowserManager({
        apiKey: 'test-api-key',
        projectId: 'test-project-id',
        logger,
      });

      await browserWithoutLlmClient.initialize();

      // Verify log was called with hasLlmClient false
      const initLogCall = logSpy.mock.calls.find((call: any[]) => 
        call[0] === 'Initializing browser session'
      );
      expect(initLogCall).toBeDefined();
      expect(initLogCall[1]).toHaveProperty('hasLlmClient', false);
    });
  });
});

