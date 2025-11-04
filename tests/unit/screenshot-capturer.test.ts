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
});

