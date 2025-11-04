/**
 * Unit tests for GameDetector.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { GameDetector, GameType } from '../../src/core/game-detector';
import { Logger } from '../../src/utils/logger';
import { TIMEOUTS } from '../../src/config/constants';
import { TimeoutError } from '../../src/utils/timeout';
import type { AnyPage } from '@browserbasehq/stagehand';

// Mock page object with evaluate method
const createMockPage = (evaluateResult: any = {}) => ({
  evaluate: mock(() => Promise.resolve(evaluateResult)),
  url: mock(() => 'https://example.com'),
});

describe('GameDetector', () => {
  let logger: Logger;
  let mockPage: ReturnType<typeof createMockPage>;

  beforeEach(() => {
    logger = new Logger({ module: 'test', op: 'game-detector-test' });
    mockPage = createMockPage();
  });

  describe('GameDetector instantiation', () => {
    it('should create GameDetector with logger', () => {
      const detector = new GameDetector({ logger });
      expect(detector).toBeInstanceOf(GameDetector);
    });

    it('should create GameDetector with custom timeout', () => {
      const customTimeout = 5000;
      const detector = new GameDetector({
        logger,
        readyTimeout: customTimeout,
      });
      expect(detector).toBeInstanceOf(GameDetector);
    });
  });

  describe('detectType()', () => {
    it('should detect CANVAS game type', async () => {
      const detector = new GameDetector({ logger });
      const page = createMockPage({
        hasCanvas: true,
        canvasCount: 1,
        hasIframe: false,
        iframeCount: 0,
      }) as unknown as AnyPage;

      const gameType = await detector.detectType(page);
      expect(gameType).toBe(GameType.CANVAS);
    });

    it('should detect IFRAME game type when iframe exists', async () => {
      const detector = new GameDetector({ logger });
      const page = createMockPage({
        hasCanvas: false,
        canvasCount: 0,
        hasIframe: true,
        iframeCount: 1,
        iframeHasCanvas: true,
      }) as unknown as AnyPage;

      const gameType = await detector.detectType(page);
      expect(gameType).toBe(GameType.IFRAME);
    });

    it('should detect DOM game type when no canvas or iframe', async () => {
      const detector = new GameDetector({ logger });
      const page = createMockPage({
        hasCanvas: false,
        canvasCount: 0,
        hasIframe: false,
        iframeCount: 0,
        hasGameElements: true,
      }) as unknown as AnyPage;

      const gameType = await detector.detectType(page);
      expect(gameType).toBe(GameType.DOM);
    });

    it('should return UNKNOWN when no game detected', async () => {
      const detector = new GameDetector({ logger });
      const page = createMockPage({
        hasCanvas: false,
        canvasCount: 0,
        hasIframe: false,
        iframeCount: 0,
        hasGameElements: false,
      }) as unknown as AnyPage;

      const gameType = await detector.detectType(page);
      expect(gameType).toBe(GameType.UNKNOWN);
    });

    it('should prioritize CANVAS over IFRAME when both exist', async () => {
      const detector = new GameDetector({ logger });
      const page = createMockPage({
        hasCanvas: true,
        canvasCount: 1,
        hasIframe: true,
        iframeCount: 1,
      }) as unknown as AnyPage;

      const gameType = await detector.detectType(page);
      expect(gameType).toBe(GameType.CANVAS);
    });

    it('should handle evaluation errors gracefully', async () => {
      const detector = new GameDetector({ logger });
      const page = createMockPage() as unknown as AnyPage;
      (page as any).evaluate.mockImplementationOnce(() => {
        throw new Error('Evaluation failed');
      });

      // Should return UNKNOWN on error
      const gameType = await detector.detectType(page);
      expect(gameType).toBe(GameType.UNKNOWN);
    });
  });

  describe('waitForGameReady()', () => {
    it('should return true when 3/4 signals pass', async () => {
      const detector = new GameDetector({ logger });
      const page = createMockPage({
        hasCanvas: true,
        canvasRendering: true,
        networkIdle: true,
        noLoadingText: false, // One signal fails
      }) as unknown as AnyPage;

      const isReady = await detector.waitForGameReady(page, 1000);
      expect(isReady).toBe(true);
      expect((page as any).evaluate).toHaveBeenCalled();
    });

    it('should return true when all 4 signals pass', async () => {
      const detector = new GameDetector({ logger });
      const page = createMockPage({
        hasCanvas: true,
        canvasRendering: true,
        networkIdle: true,
        noLoadingText: true,
      }) as unknown as AnyPage;

      const isReady = await detector.waitForGameReady(page, 1000);
      expect(isReady).toBe(true);
    });

    it('should return false when only 2/4 signals pass', async () => {
      const detector = new GameDetector({ logger });
      const page = createMockPage({
        hasCanvas: true,
        canvasRendering: true,
        networkIdle: false,
        noLoadingText: false,
      }) as unknown as AnyPage;

      const isReady = await detector.waitForGameReady(page, 1000);
      expect(isReady).toBe(false);
    });

    it('should timeout and return false', async () => {
      const detector = new GameDetector({ logger });
      const page = createMockPage({
        hasCanvas: false,
        canvasRendering: false,
        networkIdle: false,
        noLoadingText: false,
      }) as unknown as AnyPage;

      const isReady = await detector.waitForGameReady(page, 500);
      expect(isReady).toBe(false);
    });

    it('should poll every 1 second', async () => {
      const detector = new GameDetector({ logger });
      let callCount = 0;
      const page = createMockPage({
        hasCanvas: false,
        canvasRendering: false,
        networkIdle: false,
        noLoadingText: false,
      }) as unknown as AnyPage;

      // Mock to return ready after 2 calls
      (page as any).evaluate.mockImplementation(() => {
        callCount++;
        if (callCount >= 2) {
          return Promise.resolve({
            hasCanvas: true,
            canvasRendering: true,
            networkIdle: true,
            noLoadingText: true,
          });
        }
        return Promise.resolve({
          hasCanvas: false,
          canvasRendering: false,
          networkIdle: false,
          noLoadingText: false,
        });
      });

      const isReady = await detector.waitForGameReady(page, 3000);
      expect(isReady).toBe(true);
      expect(callCount).toBeGreaterThanOrEqual(2);
    });

    it('should handle evaluation errors during polling', async () => {
      const detector = new GameDetector({ logger });
      const page = createMockPage() as unknown as AnyPage;
      (page as any).evaluate.mockImplementation(() => {
        throw new Error('Evaluation failed');
      });

      const isReady = await detector.waitForGameReady(page, 1000);
      expect(isReady).toBe(false);
    });
  });

  describe('isCanvasRendering()', () => {
    it('should return true when canvas has non-black pixels', async () => {
      const detector = new GameDetector({ logger });
      const page = createMockPage({
        hasCanvas: true,
        canvasHasPixels: true,
      }) as unknown as AnyPage;

      const isRendering = await detector.isCanvasRendering(page);
      expect(isRendering).toBe(true);
    });

    it('should return false when canvas is blank', async () => {
      const detector = new GameDetector({ logger });
      const page = createMockPage({
        hasCanvas: true,
        canvasHasPixels: false,
      }) as unknown as AnyPage;

      const isRendering = await detector.isCanvasRendering(page);
      expect(isRendering).toBe(false);
    });

    it('should return false when no canvas exists', async () => {
      const detector = new GameDetector({ logger });
      const page = createMockPage({
        hasCanvas: false,
        canvasHasPixels: false,
      }) as unknown as AnyPage;

      const isRendering = await detector.isCanvasRendering(page);
      expect(isRendering).toBe(false);
    });

    it('should handle evaluation errors', async () => {
      const detector = new GameDetector({ logger });
      const page = createMockPage() as unknown as AnyPage;
      (page as any).evaluate.mockImplementationOnce(() => {
        throw new Error('Evaluation failed');
      });

      const isRendering = await detector.isCanvasRendering(page);
      expect(isRendering).toBe(false);
    });
  });

  describe('detectIframe()', () => {
    it('should detect iframe with game content', async () => {
      const detector = new GameDetector({ logger });
      const page = createMockPage({
        hasIframe: true,
        iframeCount: 1,
        iframeHasCanvas: true,
      }) as unknown as AnyPage;

      const iframeDetected = await detector.detectIframe(page);
      expect(iframeDetected).toBe(true);
    });

    it('should return false when no iframe exists', async () => {
      const detector = new GameDetector({ logger });
      const page = createMockPage({
        hasIframe: false,
        iframeCount: 0,
      }) as unknown as AnyPage;

      const iframeDetected = await detector.detectIframe(page);
      expect(iframeDetected).toBe(false);
    });

    it('should return false when iframe has no canvas', async () => {
      const detector = new GameDetector({ logger });
      const page = createMockPage({
        hasIframe: true,
        iframeCount: 1,
        iframeHasCanvas: false,
      }) as unknown as AnyPage;

      const iframeDetected = await detector.detectIframe(page);
      expect(iframeDetected).toBe(false);
    });

    it('should handle evaluation errors', async () => {
      const detector = new GameDetector({ logger });
      const page = createMockPage() as unknown as AnyPage;
      (page as any).evaluate.mockImplementationOnce(() => {
        throw new Error('Evaluation failed');
      });

      const iframeDetected = await detector.detectIframe(page);
      expect(iframeDetected).toBe(false);
    });
  });

  describe('timeout handling', () => {
    it('should wrap detectType with timeout and return UNKNOWN', async () => {
      const detector = new GameDetector({ 
        logger,
        readyTimeout: 100, // Very short timeout for testing
      });
      const page = createMockPage() as unknown as AnyPage;
      (page as any).evaluate.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({}), 5000);
        });
      });

      // Should timeout and return UNKNOWN (not throw)
      const gameType = await detector.detectType(page);
      expect(gameType).toBe(GameType.UNKNOWN);
    });
  });
});

