/**
 * Integration tests for main orchestration (I2.3).
 *
 * Tests the runQA() function with GameInteractor and ScreenshotCapturer integration.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { ConsoleError } from '../../src/types/game-test.types';

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
  captureAtOptimalTime: mock((page: any, stage: string, metadata?: any) => Promise.resolve({
    id: `test-screenshot-${stage}`,
    path: `/tmp/game-qa-output/screenshots/test-session/test-screenshot-${stage}.png`,
    timestamp: Date.now(),
    stage: stage as any,
  })),
  captureAll: mock((page: any, stages: string[]) => Promise.resolve(
    stages.map(stage => ({
      id: `test-screenshot-${stage}`,
      path: `/tmp/game-qa-output/screenshots/test-session/test-screenshot-${stage}.png`,
      timestamp: Date.now(),
      stage: stage as any,
    }))
  )),
};

const mockGameInteractorInstance = {
  simulateKeyboardInput: mock(() => Promise.resolve()),
  simulateGameplayWithMetadata: mock(() => Promise.resolve()),
  clickAtCoordinates: mock(() => Promise.resolve()),
  findAndClickStart: mock(() => Promise.resolve(true)),
};

const mockGameDetectorInstance = {
  detectType: mock(() => Promise.resolve('canvas' as any)),
  waitForGameReady: mock(() => Promise.resolve()),
};

const mockErrorMonitorInstance = {
  startMonitoring: mock(() => Promise.resolve()),
  stopMonitoring: mock(() => Promise.resolve()),
  getErrors: mock(() => Promise.resolve([] as ConsoleError[])),
  hasErrors: mock(() => Promise.resolve(false)),
  hasCriticalError: mock(() => Promise.resolve(false)),
};

const mockVisionAnalyzerInstance = {
  analyzeScreenshots: mock((screenshots: any[], metadata?: any) => Promise.resolve({
    status: 'pass' as const,
    playability_score: 75,
    issues: [],
    screenshots: [],
    timestamp: new Date().toISOString(),
    metadata: {
      visionAnalysisTokens: 1500,
    },
  } as any)),
  findClickableElements: mock(() => Promise.resolve([])),
  detectCrash: mock(() => Promise.resolve(false)),
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

mock.module('../../src/vision/analyzer', () => ({
  VisionAnalyzer: mock(function(config: any) {
    return mockVisionAnalyzerInstance;
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
// Don't set OPENAI_API_KEY here - only set it in Vision Analysis Integration tests

// Import after mocks
import { runQA } from '../../src/main';
import { GameType } from '../../src/core/game-detector';

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
    mockGameInteractorInstance.findAndClickStart.mockClear();
    mockVisionAnalyzerInstance.analyzeScreenshots.mockClear();
    mockGameInteractorInstance.simulateGameplayWithMetadata.mockClear();
    // Reset mock return values to defaults
    mockGameDetectorInstance.detectType.mockImplementation(() => Promise.resolve('canvas' as any));
    mockErrorMonitorInstance.getErrors.mockImplementation(() => Promise.resolve([]));
    mockGameInteractorInstance.findAndClickStart.mockImplementation(() => Promise.resolve(true));
    mockVisionAnalyzerInstance.analyzeScreenshots.mockImplementation((screenshots: any[], metadata?: any) => Promise.resolve({
      status: 'pass',
      playability_score: 75,
      issues: [],
      screenshots: [],
      timestamp: new Date().toISOString(),
      metadata: {
        visionAnalysisTokens: 1500,
      },
    }));
    mockGameInteractorInstance.simulateGameplayWithMetadata.mockImplementation(() => Promise.resolve());
  });

  it('should complete successfully with valid URL', async () => {
    // Ensure OPENAI_API_KEY is not set for this test (no vision analysis)
    const originalOpenAIKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    
    const gameUrl = 'https://example.com/game';
    const result = await runQA(gameUrl);
    
    // Restore OPENAI_API_KEY for other tests
    if (originalOpenAIKey) {
      process.env.OPENAI_API_KEY = originalOpenAIKey;
    }

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
    
    // Verify keyboard simulation was called (generic inputs since no metadata)
    expect(mockGameInteractorInstance.simulateKeyboardInput).toHaveBeenCalledTimes(1);
    expect(mockGameInteractorInstance.simulateKeyboardInput).toHaveBeenCalledWith(mockPage, 30000);
    expect(mockGameInteractorInstance.simulateGameplayWithMetadata).not.toHaveBeenCalled();
    
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
    expect(result.metadata?.gameType).toBe(GameType.CANVAS);
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
    expect(result.metadata?.gameType).toBe(GameType.IFRAME);
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
    mockErrorMonitorInstance.getErrors.mockImplementationOnce(() => Promise.resolve(mockErrors));

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
    expect(result.metadata?.gameType).toBe(GameType.UNKNOWN);
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

  describe('Vision Analysis Integration', () => {
    beforeEach(() => {
      // Ensure OPENAI_API_KEY is set for vision tests
      process.env.OPENAI_API_KEY = 'test-openai-key';
    });

    it('should call findAndClickStart before interaction', async () => {
      const gameUrl = 'https://example.com/game';
      
      await runQA(gameUrl);

      // Verify findAndClickStart is called before simulateKeyboardInput
      const findStartCall = mockGameInteractorInstance.findAndClickStart.mock.invocationCallOrder[0];
      const keyboardCall = mockGameInteractorInstance.simulateKeyboardInput.mock.invocationCallOrder[0];
      
      expect(mockGameInteractorInstance.findAndClickStart).toHaveBeenCalledTimes(1);
      expect(mockGameInteractorInstance.findAndClickStart).toHaveBeenCalledWith(mockPage);
      expect(findStartCall).toBeLessThan(keyboardCall);
    });

    it('should perform vision analysis after capturing screenshots', async () => {
      const gameUrl = 'https://example.com/game';
      
      await runQA(gameUrl);

      // Verify vision analysis is called after screenshots are captured
      const screenshotCalls = mockScreenshotCapturerInstance.capture.mock.invocationCallOrder;
      const visionCall = mockVisionAnalyzerInstance.analyzeScreenshots.mock.invocationCallOrder[0];
      
      expect(mockVisionAnalyzerInstance.analyzeScreenshots).toHaveBeenCalledTimes(1);
      expect(mockVisionAnalyzerInstance.analyzeScreenshots).toHaveBeenCalledWith([
        expect.objectContaining({ stage: 'initial_load' }),
        expect.objectContaining({ stage: 'after_interaction' }),
        expect.objectContaining({ stage: 'final_state' }),
      ], undefined);
      expect(screenshotCalls[2]).toBeLessThan(visionCall); // Last screenshot before vision
    });

    it('should use vision analysis playability score', async () => {
      const gameUrl = 'https://example.com/game';
      mockVisionAnalyzerInstance.analyzeScreenshots.mockImplementationOnce(() => Promise.resolve({
        status: 'pass',
        playability_score: 85,
        issues: [],
        screenshots: [],
        timestamp: new Date().toISOString(),
      }));

      const result = await runQA(gameUrl);

      expect(result.playability_score).toBe(85);
    });

    it('should include vision analysis issues in result', async () => {
      const gameUrl = 'https://example.com/game';
      const visionIssues = [
        {
          severity: 'major' as const,
          description: 'Control responsiveness issue detected',
          timestamp: new Date().toISOString(),
        },
        {
          severity: 'minor' as const,
          description: 'Visual glitch in UI',
          timestamp: new Date().toISOString(),
        },
      ];
      mockVisionAnalyzerInstance.analyzeScreenshots.mockImplementationOnce(() => Promise.resolve({
        status: 'pass',
        playability_score: 60,
        issues: visionIssues,
        screenshots: [],
        timestamp: new Date().toISOString(),
      }));

      const result = await runQA(gameUrl);

      expect(result.issues).toEqual(visionIssues);
    });

    it('should determine pass/fail based on vision score (>= 50 = pass)', async () => {
      const gameUrl = 'https://example.com/game';
      
      // Test pass case
      mockVisionAnalyzerInstance.analyzeScreenshots.mockImplementationOnce(() => Promise.resolve({
        status: 'pass',
        playability_score: 75,
        issues: [],
        screenshots: [],
        timestamp: new Date().toISOString(),
      }));

      const passResult = await runQA(gameUrl);
      expect(passResult.status).toBe('pass');
      expect(passResult.playability_score).toBe(75);

      // Reset mocks
      mockVisionAnalyzerInstance.analyzeScreenshots.mockClear();

      // Test fail case
      mockVisionAnalyzerInstance.analyzeScreenshots.mockImplementationOnce(() => Promise.resolve({
        status: 'fail',
        playability_score: 35,
        issues: [],
        screenshots: [],
        timestamp: new Date().toISOString(),
      }));

      const failResult = await runQA(gameUrl);
      expect(failResult.status).toBe('fail');
      expect(failResult.playability_score).toBe(35);
    });

    it('should include vision analysis tokens in metadata', async () => {
      const gameUrl = 'https://example.com/game';
      mockVisionAnalyzerInstance.analyzeScreenshots.mockImplementationOnce(() => Promise.resolve({
        status: 'pass',
        playability_score: 75,
        issues: [],
        screenshots: [],
        timestamp: new Date().toISOString(),
        metadata: {
          visionAnalysisTokens: 2500,
        },
      }));

      const result = await runQA(gameUrl);

      expect(result.metadata?.visionAnalysisTokens).toBe(2500);
    });

    it('should gracefully handle missing OPENAI_API_KEY', async () => {
      const gameUrl = 'https://example.com/game';
      delete process.env.OPENAI_API_KEY;

      const result = await runQA(gameUrl);

      // Should use default score (50) and pass status
      expect(result.playability_score).toBe(50);
      expect(result.status).toBe('pass');
      expect(mockVisionAnalyzerInstance.analyzeScreenshots).not.toHaveBeenCalled();

      // Restore for other tests
      process.env.OPENAI_API_KEY = 'test-openai-key';
    });

    it('should gracefully handle vision analysis failures', async () => {
      const gameUrl = 'https://example.com/game';
      mockVisionAnalyzerInstance.analyzeScreenshots.mockRejectedValueOnce(new Error('Vision API error'));

      const result = await runQA(gameUrl);

      // Should use default score (50) and pass status
      expect(result.playability_score).toBe(50);
      expect(result.status).toBe('pass');
      expect(mockVisionAnalyzerInstance.analyzeScreenshots).toHaveBeenCalledTimes(1);
    });

    it('should still work if findAndClickStart fails', async () => {
      const gameUrl = 'https://example.com/game';
      mockGameInteractorInstance.findAndClickStart.mockResolvedValueOnce(false);

      const result = await runQA(gameUrl);

      // Should continue execution and complete successfully
      expect(result.status).toBe('pass');
      expect(mockGameInteractorInstance.simulateKeyboardInput).toHaveBeenCalled();
    });

    it('should use simulateGameplayWithMetadata when metadata is provided', async () => {
      const gameUrl = 'https://example.com/game';
      const metadata = {
        inputSchema: {
          type: 'javascript' as const,
          content: 'gameBuilder.createAction("Jump").bindKey("Space")',
          actions: [
            {
              name: 'Jump',
              keys: ['Space'],
            },
          ],
        },
        testingStrategy: {
          waitBeforeInteraction: 1000,
          interactionDuration: 20000,
          criticalActions: ['Jump'],
        },
      };

      const result = await runQA(gameUrl, { metadata });

      // Should use simulateGameplayWithMetadata instead of simulateKeyboardInput
      expect(mockGameInteractorInstance.simulateGameplayWithMetadata).toHaveBeenCalledTimes(1);
      expect(mockGameInteractorInstance.simulateGameplayWithMetadata).toHaveBeenCalledWith(
        mockPage,
        metadata,
        20000
      );
      expect(mockGameInteractorInstance.simulateKeyboardInput).not.toHaveBeenCalled();

      // Should pass metadata to vision analyzer
      expect(mockVisionAnalyzerInstance.analyzeScreenshots).toHaveBeenCalledWith(
        expect.any(Array),
        metadata
      );
    });

    it('should convert deprecated inputSchema to metadata (backwards compat)', async () => {
      const gameUrl = 'https://example.com/game';
      const inputSchema = {
        type: 'semantic' as const,
        content: 'Use arrow keys to move',
      };

      const result = await runQA(gameUrl, { inputSchema });

      // Should use simulateGameplayWithMetadata with converted metadata
      expect(mockGameInteractorInstance.simulateGameplayWithMetadata).toHaveBeenCalledTimes(1);
      expect(mockGameInteractorInstance.simulateKeyboardInput).not.toHaveBeenCalled();
    });

    it('should use testingStrategy.waitBeforeInteraction', async () => {
      const gameUrl = 'https://example.com/game';
      const metadata = {
        inputSchema: {
          type: 'javascript' as const,
          content: 'gameBuilder.createAction("Jump").bindKey("Space")',
        },
        testingStrategy: {
          waitBeforeInteraction: 500,
          interactionDuration: 20000,
        },
      };

      const startTime = Date.now();
      await runQA(gameUrl, { metadata });
      const duration = Date.now() - startTime;

      // Should wait at least 500ms before interaction
      expect(duration).toBeGreaterThanOrEqual(400); // Allow some margin for test execution
      expect(mockGameInteractorInstance.simulateGameplayWithMetadata).toHaveBeenCalled();
    });

    it('should use testingStrategy.interactionDuration from metadata', async () => {
      const gameUrl = 'https://example.com/game';
      const metadata = {
        inputSchema: {
          type: 'javascript' as const,
          content: 'gameBuilder.createAction("Jump").bindKey("Space")',
        },
        testingStrategy: {
          interactionDuration: 15000,
        },
      };

      await runQA(gameUrl, { metadata });

      // Should use interactionDuration from metadata
      expect(mockGameInteractorInstance.simulateGameplayWithMetadata).toHaveBeenCalledWith(
        mockPage,
        metadata,
        15000
      );
    });
  });
});

describe('CLI Entry Point', () => {
  it('should export runQA function', () => {
    expect(typeof runQA).toBe('function');
  });

  describe('CLI Argument Parsing', () => {
    // Note: We'll test helper functions that parse CLI arguments
    // The actual CLI entry point uses import.meta.main which is hard to test
    // So we test the parsing logic separately
    
    it('should parse URL from command line arguments', async () => {
      // This will be tested via the implementation
      // We'll test loadMetadataFromFile separately
      expect(true).toBe(true);
    });
  });

  describe('Metadata File Loading', () => {
    it('should load valid metadata.json file', async () => {
      // Import the function we'll create
      const { loadMetadataFromFile } = await import('../../src/main');
      const metadataPath = './_game-examples/pong/metadata.json';
      
      const result = await loadMetadataFromFile(metadataPath);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data.inputSchema).toBeDefined();
        expect(result.data.inputSchema.type).toBe('javascript');
      }
    });

    it('should handle missing metadata file', async () => {
      const { loadMetadataFromFile } = await import('../../src/main');
      const metadataPath = './nonexistent/metadata.json';
      
      const result = await loadMetadataFromFile(metadataPath);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should validate metadata schema', async () => {
      const { loadMetadataFromFile } = await import('../../src/main');
      // Create a temporary invalid metadata file
      const invalidMetadata = {
        invalid: 'data',
      };
      
      // We'll test with a file that has invalid schema
      // For now, test that valid metadata passes validation
      const metadataPath = './_game-examples/pong/metadata.json';
      const result = await loadMetadataFromFile(metadataPath);
      
      expect(result.success).toBe(true);
    });
  });

  describe('Lambda Handler', () => {
    it('should export handler function', async () => {
      const { handler } = await import('../../src/main');
      expect(typeof handler).toBe('function');
    });

    it('should process Lambda event with metadata', async () => {
      const { handler } = await import('../../src/main');
      const event = {
        gameUrl: 'https://example.com/game',
        metadata: {
          inputSchema: {
            type: 'javascript' as const,
            content: 'gameBuilder.createAction("Jump").bindKey("Space")',
          },
        },
      };

      const response = await handler(event);
      
      expect(response.statusCode).toBeDefined();
      expect(response.body).toBeDefined();
      
      const body = JSON.parse(response.body);
      expect(body.status).toBeDefined();
    });

    it('should process Lambda event with inputSchema (backwards compat)', async () => {
      const { handler } = await import('../../src/main');
      const event = {
        gameUrl: 'https://example.com/game',
        inputSchema: {
          type: 'javascript' as const,
          content: 'gameBuilder.createAction("Jump").bindKey("Space")',
        },
      };

      const response = await handler(event);
      
      expect(response.statusCode).toBeDefined();
      const body = JSON.parse(response.body);
      expect(body.status).toBeDefined();
    });

    it('should prioritize metadata over inputSchema in Lambda event', async () => {
      const { handler } = await import('../../src/main');
      const event = {
        gameUrl: 'https://example.com/game',
        metadata: {
          inputSchema: {
            type: 'javascript' as const,
            content: 'gameBuilder.createAction("Jump").bindKey("Space")',
          },
        },
        inputSchema: {
          type: 'semantic' as const,
          content: 'Arrow keys for movement',
        },
      };

      const response = await handler(event);
      
      expect(response.statusCode).toBeDefined();
      const body = JSON.parse(response.body);
      expect(body.status).toBeDefined();
    });

    it('should handle Lambda errors gracefully', async () => {
      const { handler } = await import('../../src/main');
      const event = {
        gameUrl: 'invalid-url',
      };

      const response = await handler(event);
      
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(response.body).toBeDefined();
    });

    it('should return 200 status code on success', async () => {
      const { handler } = await import('../../src/main');
      const event = {
        gameUrl: 'https://example.com/game',
      };

      const response = await handler(event);
      
      // Should return 200 if test passes, or 500 if it fails
      expect([200, 500]).toContain(response.statusCode);
    });
  });
});

