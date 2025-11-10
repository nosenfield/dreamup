/**
 * Unit tests for ScreenshotCapturer.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { ScreenshotCapturer } from '../../src/core/screenshot-capturer';
import { Logger } from '../../src/utils/logger';
import { FileManager } from '../../src/utils/file-manager';
import { TIMEOUTS } from '../../src/config/constants';
import { TimeoutError } from '../../src/utils/timeout';
import type { AnyPage } from '@browserbasehq/stagehand';
import type { Screenshot } from '../../src/types/game-test.types';
import { GameType } from '../../src/core/game-detector';
import type { GameMetadata } from '../../src/types/game-test.types';

// Mock page object
const createMockPage = () => ({
  screenshot: mock(() => Promise.resolve(Buffer.from('fake-png-data'))),
  url: mock(() => 'https://example.com'),
});

describe('ScreenshotCapturer', () => {
  let logger: Logger;
  let fileManager: FileManager;
  let mockPage: ReturnType<typeof createMockPage>;
  let sessionId: string;

  beforeEach(() => {
    logger = new Logger({ module: 'test', op: 'screenshot-capturer-test' });
    sessionId = 'test-session-' + Date.now();
    fileManager = new FileManager(sessionId);
    mockPage = createMockPage();
    // Reset mocks
    mockPage.screenshot.mockClear();
  });

  describe('ScreenshotCapturer instantiation', () => {
    it('should create ScreenshotCapturer with logger and fileManager', () => {
      const capturer = new ScreenshotCapturer({ logger, fileManager });
      expect(capturer).toBeInstanceOf(ScreenshotCapturer);
    });

    it('should create ScreenshotCapturer with custom timeout', () => {
      const customTimeout = 5000;
      const capturer = new ScreenshotCapturer({
        logger,
        fileManager,
        screenshotTimeout: customTimeout,
      });
      expect(capturer).toBeInstanceOf(ScreenshotCapturer);
    });
  });

  describe('capture()', () => {
    it('should capture screenshot and save to file', async () => {
      const capturer = new ScreenshotCapturer({ logger, fileManager });
      const page = mockPage as unknown as AnyPage;

      const screenshot = await capturer.capture(page, 'initial_load');

      // Verify page.screenshot was called
      expect(mockPage.screenshot).toHaveBeenCalledTimes(1);

      // Verify screenshot object structure
      expect(screenshot).toHaveProperty('id');
      expect(screenshot).toHaveProperty('path');
      expect(screenshot).toHaveProperty('timestamp');
      expect(screenshot).toHaveProperty('stage');
      expect(screenshot.stage).toBe('initial_load');
      expect(typeof screenshot.id).toBe('string');
      expect(typeof screenshot.path).toBe('string');
      expect(typeof screenshot.timestamp).toBe('number');
    });

    it('should support all stage types', async () => {
      const capturer = new ScreenshotCapturer({ logger, fileManager });
      const page = mockPage as unknown as AnyPage;

      const stages: Screenshot['stage'][] = ['initial_load', 'after_interaction', 'final_state'];

      for (const stage of stages) {
        const screenshot = await capturer.capture(page, stage);
        expect(screenshot.stage).toBe(stage);
      }

      expect(mockPage.screenshot).toHaveBeenCalledTimes(3);
    });

    it('should wrap operations with timeout', async () => {
      const capturer = new ScreenshotCapturer({
        logger,
        fileManager,
        screenshotTimeout: 100, // Very short timeout
      });
      const page = mockPage as unknown as AnyPage;

      // Mock a slow screenshot
      mockPage.screenshot.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(Buffer.from('fake-data')), 500);
        });
      });

      await expect(
        capturer.capture(page, 'initial_load')
      ).rejects.toThrow();
    });

    it('should handle page.screenshot() errors', async () => {
      const capturer = new ScreenshotCapturer({ logger, fileManager });
      const page = mockPage as unknown as AnyPage;

      // Mock screenshot error
      mockPage.screenshot.mockImplementationOnce(() => {
        throw new Error('Screenshot failed');
      });

      await expect(
        capturer.capture(page, 'initial_load')
      ).rejects.toThrow('Screenshot failed');
    });

    it('should handle missing screenshot method', async () => {
      const capturer = new ScreenshotCapturer({ logger, fileManager });
      const page = {} as unknown as AnyPage;

      await expect(
        capturer.capture(page, 'initial_load')
      ).rejects.toThrow();
    });

    it('should handle FileManager.saveScreenshot errors', async () => {
      const capturer = new ScreenshotCapturer({ logger, fileManager });
      const page = mockPage as unknown as AnyPage;

      // Mock FileManager error by creating a capturer with a fileManager that will fail
      const errorFileManager = {
        saveScreenshot: mock(() => {
          throw new Error('Failed to save screenshot');
        }),
      } as unknown as FileManager;

      const errorCapturer = new ScreenshotCapturer({
        logger,
        fileManager: errorFileManager,
      });

      await expect(
        errorCapturer.capture(page, 'initial_load')
      ).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should log errors during screenshot capture', async () => {
      const errorSpy = mock();
      logger.error = errorSpy;

      const capturer = new ScreenshotCapturer({ logger, fileManager });
      const page = mockPage as unknown as AnyPage;

      mockPage.screenshot.mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      await expect(
        capturer.capture(page, 'initial_load')
      ).rejects.toThrow();

      // Logger should have been called
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('captureAll()', () => {
    it('should capture multiple screenshots in parallel', async () => {
      const capturer = new ScreenshotCapturer({ logger, fileManager });
      const page = mockPage as unknown as AnyPage;

      const stages: Screenshot['stage'][] = ['initial_load', 'after_interaction', 'final_state'];
      const screenshots = await capturer.captureAll(page, stages);

      expect(screenshots).toHaveLength(3);
      expect(mockPage.screenshot).toHaveBeenCalledTimes(3);
      expect(screenshots[0].stage).toBe('initial_load');
      expect(screenshots[1].stage).toBe('after_interaction');
      expect(screenshots[2].stage).toBe('final_state');
    });

    it('should handle partial failures gracefully', async () => {
      const capturer = new ScreenshotCapturer({ logger, fileManager });
      const page = mockPage as unknown as AnyPage;

      // Mock second screenshot to fail
      let callCount = 0;
      mockPage.screenshot.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Screenshot failed');
        }
        return Promise.resolve(Buffer.from('fake-png-data'));
      });

      const stages: Screenshot['stage'][] = ['initial_load', 'after_interaction', 'final_state'];
      const screenshots = await capturer.captureAll(page, stages);

      // Should return successful screenshots only
      expect(screenshots.length).toBeGreaterThan(0);
      expect(screenshots.length).toBeLessThan(3);
    });

    it('should return empty array if all screenshots fail', async () => {
      const capturer = new ScreenshotCapturer({ logger, fileManager });
      const page = mockPage as unknown as AnyPage;

      mockPage.screenshot.mockImplementation(() => {
        throw new Error('All screenshots failed');
      });

      const stages: Screenshot['stage'][] = ['initial_load', 'after_interaction'];
      const screenshots = await capturer.captureAll(page, stages);

      expect(screenshots).toHaveLength(0);
    });
  });

  describe('captureAtOptimalTime()', () => {
    it('should wait for loading indicators before capture', async () => {
      const capturer = new ScreenshotCapturer({ logger, fileManager });
      const page = mockPage as unknown as AnyPage;

      // Mock page.evaluate to simulate loading indicator detection
      const evaluateMock = mock(() => Promise.resolve(true));
      (page as any).evaluate = evaluateMock;

      const metadata = {
        inputSchema: {
          type: 'javascript' as const,
          content: 'test',
        },
        loadingIndicators: [
          {
            type: 'element' as const,
            pattern: '#start-btn',
            description: 'Start button appears',
          },
        ],
      };

      // Mock waitForElement to resolve quickly
      (page as any).waitForSelector = mock(() => Promise.resolve());
      (page as any).waitForTimeout = mock(() => Promise.resolve());

      const screenshot = await capturer.captureAtOptimalTime(
        page,
        'initial_load',
        metadata
      );

      expect(screenshot).toBeDefined();
      expect(screenshot.stage).toBe('initial_load');
    });

    it('should fall back to immediate capture if no metadata', async () => {
      const capturer = new ScreenshotCapturer({ logger, fileManager });
      const page = mockPage as unknown as AnyPage;

      const screenshot = await capturer.captureAtOptimalTime(
        page,
        'initial_load',
        undefined
      );

      expect(screenshot).toBeDefined();
      expect(mockPage.screenshot).toHaveBeenCalledTimes(1);
    });

    it('should timeout and capture anyway if indicators never appear', async () => {
      const capturer = new ScreenshotCapturer({ logger, fileManager });
      const page = mockPage as unknown as AnyPage;

      // Mock waitForSelector to timeout
      (page as any).waitForSelector = mock(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        });
      });

      const metadata = {
        inputSchema: {
          type: 'javascript' as const,
          content: 'test',
        },
        loadingIndicators: [
          {
            type: 'element' as const,
            pattern: '#never-appears',
            description: 'Element that never appears',
          },
        ],
      };

      // Should still capture after timeout
      const screenshot = await capturer.captureAtOptimalTime(
        page,
        'initial_load',
        metadata,
        5000 // 5 second timeout
      );

      expect(screenshot).toBeDefined();
    });
  });

  describe('canvas screenshot capture', () => {
    it('should use canvas.toDataURL() for canvas games when gameType is CANVAS', async () => {
      const capturer = new ScreenshotCapturer({ logger, fileManager });
      const page = mockPage as unknown as AnyPage;

      // Mock page.evaluate to simulate canvas element
      const evaluateMock = mock(() => {
        // Simulate canvas.toDataURL() returning base64 PNG
        const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        return Promise.resolve(base64Data);
      });
      (page as any).evaluate = evaluateMock;

      const screenshot = await capturer.capture(page, 'initial_load', {
        gameType: GameType.CANVAS,
      });

      // Verify page.evaluate was called (for canvas.toDataURL())
      expect(evaluateMock).toHaveBeenCalled();
      // Verify page.screenshot was NOT called
      expect(mockPage.screenshot).not.toHaveBeenCalled();

      // Verify screenshot object structure
      expect(screenshot).toHaveProperty('id');
      expect(screenshot).toHaveProperty('path');
      expect(screenshot).toHaveProperty('stage');
      expect(screenshot.stage).toBe('initial_load');
    });

    it('should use page.screenshot() for non-canvas games', async () => {
      const capturer = new ScreenshotCapturer({ logger, fileManager });
      const page = mockPage as unknown as AnyPage;

      const screenshot = await capturer.capture(page, 'initial_load', {
        gameType: GameType.DOM,
      });

      // Verify page.screenshot was called
      expect(mockPage.screenshot).toHaveBeenCalledTimes(1);
      // Verify screenshot object structure
      expect(screenshot).toHaveProperty('id');
      expect(screenshot).toHaveProperty('path');
      expect(screenshot.stage).toBe('initial_load');
    });

    it('should use page.screenshot() when gameType is not provided', async () => {
      const capturer = new ScreenshotCapturer({ logger, fileManager });
      const page = mockPage as unknown as AnyPage;

      const screenshot = await capturer.capture(page, 'initial_load');

      // Verify page.screenshot was called (default behavior)
      expect(mockPage.screenshot).toHaveBeenCalledTimes(1);
      expect(screenshot).toHaveProperty('id');
      expect(screenshot).toHaveProperty('path');
    });

    it('should detect canvas game from page.evaluate() when gameType not provided', async () => {
      const capturer = new ScreenshotCapturer({ logger, fileManager });
      const page = mockPage as unknown as AnyPage;

      let callCount = 0;
      const evaluateMock = mock(() => {
        callCount++;
        if (callCount === 1) {
          // First call: check for canvas element
          return Promise.resolve({ hasCanvas: true, canvasCount: 1 });
        } else {
          // Second call: get canvas.toDataURL()
          const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
          return Promise.resolve(base64Data);
        }
      });
      (page as any).evaluate = evaluateMock;

      const screenshot = await capturer.capture(page, 'initial_load');

      // Verify page.evaluate was called (for canvas detection and capture)
      expect(evaluateMock).toHaveBeenCalled();
      // Verify page.screenshot was NOT called
      expect(mockPage.screenshot).not.toHaveBeenCalled();
      expect(screenshot).toHaveProperty('id');
      expect(screenshot).toHaveProperty('path');
    });

    it('should fallback to page.screenshot() if canvas capture fails', async () => {
      const capturer = new ScreenshotCapturer({ logger, fileManager });
      const page = mockPage as unknown as AnyPage;

      // Mock page.evaluate to throw error (canvas capture fails)
      const evaluateMock = mock(() => {
        throw new Error('Canvas capture failed');
      });
      (page as any).evaluate = evaluateMock;

      const screenshot = await capturer.capture(page, 'initial_load', {
        gameType: GameType.CANVAS,
      });

      // Verify page.screenshot was called as fallback
      expect(mockPage.screenshot).toHaveBeenCalledTimes(1);
      expect(screenshot).toHaveProperty('id');
      expect(screenshot).toHaveProperty('path');
    });

    it('should fallback to page.screenshot() if canvas element not found', async () => {
      const capturer = new ScreenshotCapturer({ logger, fileManager });
      const page = mockPage as unknown as AnyPage;

      // Mock page.evaluate to return null (no canvas)
      const evaluateMock = mock(() => {
        return Promise.resolve(null);
      });
      (page as any).evaluate = evaluateMock;

      const screenshot = await capturer.capture(page, 'initial_load', {
        gameType: GameType.CANVAS,
      });

      // Verify page.screenshot was called as fallback
      expect(mockPage.screenshot).toHaveBeenCalledTimes(1);
      expect(screenshot).toHaveProperty('id');
      expect(screenshot).toHaveProperty('path');
    });

    it('should handle multiple canvas elements by using first canvas', async () => {
      const capturer = new ScreenshotCapturer({ logger, fileManager });
      const page = mockPage as unknown as AnyPage;

      const evaluateMock = mock(() => {
        // Simulate canvas.toDataURL() returning base64 PNG
        const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        return Promise.resolve(base64Data);
      });
      (page as any).evaluate = evaluateMock;

      const screenshot = await capturer.capture(page, 'initial_load', {
        gameType: GameType.CANVAS,
      });

      expect(evaluateMock).toHaveBeenCalled();
      expect(mockPage.screenshot).not.toHaveBeenCalled();
      expect(screenshot).toHaveProperty('id');
      expect(screenshot).toHaveProperty('path');
    });
  });
});

