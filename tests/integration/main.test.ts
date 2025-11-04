/**
 * Integration tests for minimal main orchestration (I1.2).
 * 
 * Tests the runQA() function and CLI entry point with mocked dependencies.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

// Mock dependencies before importing main
const mockPage = {
  goto: mock(() => Promise.resolve()),
  close: mock(() => Promise.resolve()),
  screenshot: mock(() => Promise.resolve(Buffer.from('fake-png-data'))),
  url: mock(() => 'https://example.com/game'),
};

const mockStagehand = {
  init: mock(() => Promise.resolve()),
  page: mockPage,
};

const mockBrowserManagerInstance = {
  initialize: mock(() => Promise.resolve(mockPage)),
  navigate: mock(() => Promise.resolve()),
  cleanup: mock(() => Promise.resolve()),
  getPage: mock(() => mockPage),
  isBrowserInitialized: mock(() => true),
};

const mockFileManagerInstance = {
  ensureOutputDirectory: mock(() => Promise.resolve()),
  saveScreenshot: mock(() => Promise.resolve({
    id: 'test-screenshot-id',
    path: '/tmp/game-qa-output/screenshots/test-session/test-screenshot-id.png',
    timestamp: Date.now(),
    stage: 'initial_load' as const,
  })),
  saveReport: mock(() => Promise.resolve('/tmp/game-qa-output/reports/test-session/report.json')),
  getSessionId: mock(() => 'test-session'),
};

// Mock modules
mock.module('@browserbasehq/stagehand', () => ({
  Stagehand: mock(() => mockStagehand),
}));

mock.module('../../src/core/browser-manager', () => ({
  BrowserManager: mock(function(config: any) {
    return mockBrowserManagerInstance;
  }),
}));

mock.module('../../src/utils/file-manager', () => ({
  FileManager: mock(function(sessionId?: string) {
    return mockFileManagerInstance;
  }),
}));

// Set environment variables for tests
process.env.BROWSERBASE_API_KEY = 'test-api-key';
process.env.BROWSERBASE_PROJECT_ID = 'test-project-id';

// Import after mocks
import { runQA } from '../../src/main';
import type { GameTestResult } from '../../src/types';

describe('runQA()', () => {
  beforeEach(() => {
    // Reset all mocks
    mockBrowserManagerInstance.initialize.mockClear();
    mockBrowserManagerInstance.navigate.mockClear();
    mockBrowserManagerInstance.cleanup.mockClear();
    mockPage.screenshot.mockClear();
    mockFileManagerInstance.saveScreenshot.mockClear();
    mockFileManagerInstance.ensureOutputDirectory.mockClear();
  });

  it('should complete successfully with valid URL', async () => {
    const gameUrl = 'https://example.com/game';
    const result = await runQA(gameUrl);

    // Verify BrowserManager was initialized
    expect(mockBrowserManagerInstance.initialize).toHaveBeenCalledTimes(1);
    
    // Verify navigation was called
    expect(mockBrowserManagerInstance.navigate).toHaveBeenCalledWith(gameUrl);
    
    // Verify screenshot was taken
    expect(mockPage.screenshot).toHaveBeenCalledTimes(1);
    
    // Verify screenshot was saved
    expect(mockFileManagerInstance.saveScreenshot).toHaveBeenCalledTimes(1);
    expect(mockFileManagerInstance.saveScreenshot).toHaveBeenCalledWith(
      Buffer.from('fake-png-data'),
      'initial_load'
    );
    
    // Verify cleanup was called
    expect(mockBrowserManagerInstance.cleanup).toHaveBeenCalledTimes(1);
    
    // Verify result structure
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('playability_score');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('screenshots');
    expect(result).toHaveProperty('timestamp');
    
    // Verify result values
    expect(result.status).toBe('pass');
    expect(result.playability_score).toBe(50);
    expect(result.issues).toEqual([]);
    expect(result.screenshots).toHaveLength(1);
    expect(result.screenshots[0]).toContain('.png');
  });

  it('should generate session ID', async () => {
    const gameUrl = 'https://example.com/game';
    const result = await runQA(gameUrl);

    // FileManager should have been created (which generates session ID)
    expect(mockFileManagerInstance.saveScreenshot).toHaveBeenCalled();
    
    // Result should have timestamp
    expect(result.timestamp).toBeDefined();
    expect(typeof result.timestamp).toBe('string');
  });

  it('should handle browser initialization errors', async () => {
    mockBrowserManagerInstance.initialize.mockImplementationOnce(() => {
      throw new Error('Failed to initialize browser');
    });

    const gameUrl = 'https://example.com/game';
    const result = await runQA(gameUrl);

    // Should return error status
    expect(result.status).toBe('error');
    expect(result.playability_score).toBe(0);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0].severity).toBe('critical');
    
    // Cleanup should still be called
    expect(mockBrowserManagerInstance.cleanup).toHaveBeenCalledTimes(1);
  });

  it('should handle navigation errors', async () => {
    mockBrowserManagerInstance.navigate.mockImplementationOnce(() => {
      throw new Error('Navigation failed');
    });

    const gameUrl = 'https://example.com/game';
    const result = await runQA(gameUrl);

    // Should return error status
    expect(result.status).toBe('error');
    expect(result.playability_score).toBe(0);
    
    // Cleanup should still be called
    expect(mockBrowserManagerInstance.cleanup).toHaveBeenCalledTimes(1);
  });

  it('should handle screenshot errors', async () => {
    mockPage.screenshot.mockImplementationOnce(() => {
      throw new Error('Screenshot failed');
    });

    const gameUrl = 'https://example.com/game';
    const result = await runQA(gameUrl);

    // Should return error status
    expect(result.status).toBe('error');
    expect(result.playability_score).toBe(0);
    
    // Cleanup should still be called
    expect(mockBrowserManagerInstance.cleanup).toHaveBeenCalledTimes(1);
  });

  it('should handle file save errors', async () => {
    mockFileManagerInstance.saveScreenshot.mockImplementationOnce(() => {
      throw new Error('Failed to save screenshot');
    });

    const gameUrl = 'https://example.com/game';
    const result = await runQA(gameUrl);

    // Should return error status
    expect(result.status).toBe('error');
    expect(result.playability_score).toBe(0);
    
    // Cleanup should still be called
    expect(mockBrowserManagerInstance.cleanup).toHaveBeenCalledTimes(1);
  });

  it('should always call cleanup even on error', async () => {
    mockBrowserManagerInstance.initialize.mockImplementationOnce(() => {
      throw new Error('Test error');
    });

    const gameUrl = 'https://example.com/game';
    await runQA(gameUrl);

    // Cleanup should be called even when initialization fails
    expect(mockBrowserManagerInstance.cleanup).toHaveBeenCalledTimes(1);
  });

  it('should return screenshot path in result', async () => {
    const gameUrl = 'https://example.com/game';
    const result = await runQA(gameUrl);

    expect(result.screenshots).toHaveLength(1);
    expect(result.screenshots[0]).toContain('test-screenshot-id');
    expect(result.screenshots[0]).toMatch(/\.png$/);
  });

  it('should handle missing environment variables', async () => {
    // Temporarily remove env vars
    const originalKey = process.env.BROWSERBASE_API_KEY;
    const originalProjectId = process.env.BROWSERBASE_PROJECT_ID;
    
    delete process.env.BROWSERBASE_API_KEY;
    delete process.env.BROWSERBASE_PROJECT_ID;

    const gameUrl = 'https://example.com/game';
    const result = await runQA(gameUrl);

    // Should return error status
    expect(result.status).toBe('error');
    expect(result.playability_score).toBe(0);
    expect(result.issues[0].description).toContain('Missing required environment variables');

    // Restore env vars
    process.env.BROWSERBASE_API_KEY = originalKey;
    process.env.BROWSERBASE_PROJECT_ID = originalProjectId;
  });
});

describe('CLI Entry Point', () => {
  // Note: CLI testing is complex with Bun's import.meta.main
  // We'll test the CLI functionality manually and verify the function works
  // Full CLI tests will be added in I5.4

  it('should export runQA function', () => {
    expect(typeof runQA).toBe('function');
  });
});

