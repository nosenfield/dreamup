/**
 * Integration tests for main orchestration (I2.3).
 * 
 * Tests the runQA() function with GameInteractor and ScreenshotCapturer integration.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

// Mock dependencies before importing main
const mockPage = {
  goto: mock(() => Promise.resolve()),
  close: mock(() => Promise.resolve()),
  screenshot: mock(() => Promise.resolve(Buffer.from('fake-png-data'))),
  url: mock(() => 'https://example.com/game'),
  keyboard: {
    press: mock(() => Promise.resolve()),
  },
  mouse: {
    click: mock(() => Promise.resolve()),
  },
};

const mockStagehand = {
  init: mock(() => Promise.resolve()),
  context: {
    pages: mock(() => [mockPage]),
    activePage: mock(() => mockPage),
  },
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
  saveScreenshot: mock((buffer: Buffer, stage: string) => Promise.resolve({
    id: `test-screenshot-${stage}`,
    path: `/tmp/game-qa-output/screenshots/test-session/test-screenshot-${stage}.png`,
    timestamp: Date.now(),
    stage: stage as any,
  })),
  saveReport: mock(() => Promise.resolve('/tmp/game-qa-output/reports/test-session/report.json')),
  getSessionId: mock(() => 'test-session'),
};

const mockScreenshotCapturerInstance = {
  capture: mock((page: any, stage: string) => Promise.resolve({
    id: `test-screenshot-${stage}`,
    path: `/tmp/game-qa-output/screenshots/test-session/test-screenshot-${stage}.png`,
    timestamp: Date.now(),
    stage: stage as any,
  })),
};

const mockGameInteractorInstance = {
  simulateKeyboardInput: mock(() => Promise.resolve()),
  clickAtCoordinates: mock(() => Promise.resolve()),
};

const mockGameDetectorInstance = {
  detectType: mock(() => Promise.resolve('canvas' as any)),
  waitForGameReady: mock(() => Promise.resolve()),
};

const mockErrorMonitorInstance = {
  startMonitoring: mock(() => Promise.resolve()),
  stopMonitoring: mock(() => Promise.resolve()),
  getErrors: mock(() => Promise.resolve([])),
  hasErrors: mock(() => Promise.resolve(false)),
  hasCriticalError: mock(() => Promise.resolve(false)),
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

mock.module('../../src/core/screenshot-capturer', () => ({
  ScreenshotCapturer: mock(function(config: any) {
    return mockScreenshotCapturerInstance;
  }),
}));

mock.module('../../src/core/game-interactor', () => ({
  GameInteractor: mock(function(config: any) {
    return mockGameInteractorInstance;
  }),
}));

mock.module('../../src/core/game-detector', () => ({
  GameDetector: mock(function(config: any) {
    return mockGameDetectorInstance;
  }),
  GameType: {
    CANVAS: 'canvas',
    IFRAME: 'iframe',
    DOM: 'dom',
    UNKNOWN: 'unknown',
  },
}));

mock.module('../../src/core/error-monitor', () => ({
  ErrorMonitor: mock(function(config: any) {
    return mockErrorMonitorInstance;
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
    mockScreenshotCapturerInstance.capture.mockClear();
    mockGameInteractorInstance.simulateKeyboardInput.mockClear();
    mockGameDetectorInstance.detectType.mockClear();
    mockGameDetectorInstance.waitForGameReady.mockClear();
    mockErrorMonitorInstance.startMonitoring.mockClear();
    mockErrorMonitorInstance.stopMonitoring.mockClear();
    mockErrorMonitorInstance.getErrors.mockClear();
    // Reset mock return values to defaults
    mockGameDetectorInstance.detectType.mockImplementation(() => Promise.resolve('canvas' as any));
    mockErrorMonitorInstance.getErrors.mockImplementation(() => Promise.resolve([]));
  });

  it('should complete successfully with valid URL', async () => {
    const gameUrl = 'https://example.com/game';
    const result = await runQA(gameUrl);

    // Verify BrowserManager was initialized
    expect(mockBrowserManagerInstance.initialize).toHaveBeenCalledTimes(1);
    
    // Verify navigation was called
    expect(mockBrowserManagerInstance.navigate).toHaveBeenCalledWith(gameUrl);
    
    // Verify game detection was called
    expect(mockGameDetectorInstance.detectType).toHaveBeenCalledTimes(1);
    expect(mockGameDetectorInstance.detectType).toHaveBeenCalledWith(mockPage);
    
    // Verify wait for game ready was called
    expect(mockGameDetectorInstance.waitForGameReady).toHaveBeenCalledTimes(1);
    expect(mockGameDetectorInstance.waitForGameReady).toHaveBeenCalledWith(mockPage, expect.any(Number));
    
    // Verify error monitoring was started
    expect(mockErrorMonitorInstance.startMonitoring).toHaveBeenCalledTimes(1);
    expect(mockErrorMonitorInstance.startMonitoring).toHaveBeenCalledWith(mockPage);
    
    // Verify 3 screenshots were captured (initial, after interaction, final)
    expect(mockScreenshotCapturerInstance.capture).toHaveBeenCalledTimes(3);
    expect(mockScreenshotCapturerInstance.capture).toHaveBeenCalledWith(mockPage, 'initial_load');
    expect(mockScreenshotCapturerInstance.capture).toHaveBeenCalledWith(mockPage, 'after_interaction');
    expect(mockScreenshotCapturerInstance.capture).toHaveBeenCalledWith(mockPage, 'final_state');
    
    // Verify keyboard simulation was called
    expect(mockGameInteractorInstance.simulateKeyboardInput).toHaveBeenCalledTimes(1);
    expect(mockGameInteractorInstance.simulateKeyboardInput).toHaveBeenCalledWith(mockPage, 30000);
    
    // Verify error monitoring was stopped
    expect(mockErrorMonitorInstance.stopMonitoring).toHaveBeenCalledTimes(1);
    expect(mockErrorMonitorInstance.stopMonitoring).toHaveBeenCalledWith(mockPage);
    
    // Verify errors were retrieved
    expect(mockErrorMonitorInstance.getErrors).toHaveBeenCalledTimes(1);
    expect(mockErrorMonitorInstance.getErrors).toHaveBeenCalledWith(mockPage);
    
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
    expect(result.screenshots).toHaveLength(3); // Three screenshots
    expect(result.screenshots[0]).toContain('.png');
    expect(result.screenshots[1]).toContain('.png');
    expect(result.screenshots[2]).toContain('.png');
    
    // Verify metadata includes game type and errors
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.gameType).toBe('canvas');
    expect(result.metadata?.consoleErrors).toEqual([]);
    expect(result.metadata?.sessionId).toBeDefined();
    expect(result.metadata?.gameUrl).toBe(gameUrl);
    expect(result.metadata?.duration).toBeGreaterThanOrEqual(0);
  });

  it('should generate session ID', async () => {
    const gameUrl = 'https://example.com/game';
    const result = await runQA(gameUrl);

    // ScreenshotCapturer should have been called (which uses FileManager internally)
    expect(mockScreenshotCapturerInstance.capture).toHaveBeenCalled();
    
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
    mockScreenshotCapturerInstance.capture.mockImplementationOnce(() => {
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

  it('should handle keyboard simulation errors', async () => {
    mockGameInteractorInstance.simulateKeyboardInput.mockImplementationOnce(() => {
      throw new Error('Keyboard simulation failed');
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
    mockScreenshotCapturerInstance.capture.mockImplementationOnce(() => {
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

  it('should return screenshot paths in result', async () => {
    const gameUrl = 'https://example.com/game';
    const result = await runQA(gameUrl);

    expect(result.screenshots).toHaveLength(3); // Three screenshots
    expect(result.screenshots[0]).toContain('test-screenshot-initial_load');
    expect(result.screenshots[1]).toContain('test-screenshot-after_interaction');
    expect(result.screenshots[2]).toContain('test-screenshot-final_state');
    expect(result.screenshots[0]).toMatch(/\.png$/);
    expect(result.screenshots[1]).toMatch(/\.png$/);
    expect(result.screenshots[2]).toMatch(/\.png$/);
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

  it('should detect game type and include in metadata', async () => {
    const gameUrl = 'https://example.com/game';
    mockGameDetectorInstance.detectType.mockResolvedValueOnce('iframe' as any);

    const result = await runQA(gameUrl);

    expect(mockGameDetectorInstance.detectType).toHaveBeenCalledWith(mockPage);
    expect(result.metadata?.gameType).toBe('iframe');
  });

  it('should wait for game ready before interaction', async () => {
    const gameUrl = 'https://example.com/game';
    
    await runQA(gameUrl);

    // Verify waitForGameReady is called before simulateKeyboardInput
    const detectTypeCall = mockGameDetectorInstance.detectType.mock.invocationCallOrder[0];
    const waitReadyCall = mockGameDetectorInstance.waitForGameReady.mock.invocationCallOrder[0];
    const keyboardCall = mockGameInteractorInstance.simulateKeyboardInput.mock.invocationCallOrder[0];
    
    expect(detectTypeCall).toBeLessThan(waitReadyCall);
    expect(waitReadyCall).toBeLessThan(keyboardCall);
  });

  it('should capture console errors and include in metadata', async () => {
    const gameUrl = 'https://example.com/game';
    const mockErrors = [
      {
        message: 'Test error',
        timestamp: Date.now(),
        level: 'error' as const,
      },
      {
        message: 'Test warning',
        timestamp: Date.now(),
        level: 'warning' as const,
      },
    ];
    mockErrorMonitorInstance.getErrors.mockResolvedValueOnce(mockErrors);

    const result = await runQA(gameUrl);

    expect(mockErrorMonitorInstance.startMonitoring).toHaveBeenCalledWith(mockPage);
    expect(mockErrorMonitorInstance.getErrors).toHaveBeenCalledWith(mockPage);
    expect(result.metadata?.consoleErrors).toEqual(mockErrors);
  });

  it('should start error monitoring after navigation', async () => {
    const gameUrl = 'https://example.com/game';
    
    await runQA(gameUrl);

    // Verify error monitoring starts after navigation
    const navigateCall = mockBrowserManagerInstance.navigate.mock.invocationCallOrder[0];
    const startMonitoringCall = mockErrorMonitorInstance.startMonitoring.mock.invocationCallOrder[0];
    
    expect(navigateCall).toBeLessThan(startMonitoringCall);
  });

  it('should stop error monitoring before cleanup', async () => {
    const gameUrl = 'https://example.com/game';
    
    await runQA(gameUrl);

    // Verify error monitoring stops before cleanup
    const stopMonitoringCall = mockErrorMonitorInstance.stopMonitoring.mock.invocationCallOrder[0];
    const cleanupCall = mockBrowserManagerInstance.cleanup.mock.invocationCallOrder[0];
    
    expect(stopMonitoringCall).toBeLessThan(cleanupCall);
  });

  it('should handle game detection errors gracefully', async () => {
    const gameUrl = 'https://example.com/game';
    mockGameDetectorInstance.detectType.mockRejectedValueOnce(new Error('Detection failed'));

    const result = await runQA(gameUrl);

    // Should continue with UNKNOWN game type
    expect(result.metadata?.gameType).toBe('unknown');
  });

  it('should handle error monitoring failures gracefully', async () => {
    const gameUrl = 'https://example.com/game';
    mockErrorMonitorInstance.startMonitoring.mockRejectedValueOnce(new Error('Monitoring failed'));

    const result = await runQA(gameUrl);

    // Should continue with empty errors array
    expect(result.metadata?.consoleErrors).toEqual([]);
  });

  it('should include duration in metadata', async () => {
    const gameUrl = 'https://example.com/game';
    const result = await runQA(gameUrl);

    expect(result.metadata?.duration).toBeGreaterThanOrEqual(0);
    expect(typeof result.metadata?.duration).toBe('number');
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

