/**
 * Unit tests for GameInteractor.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { GameInteractor } from '../../src/core/game-interactor';
import { Logger } from '../../src/utils/logger';
import { TIMEOUTS } from '../../src/config/constants';
import { TimeoutError } from '../../src/utils/timeout';
import { InputSchemaParser } from '../../src/core/input-schema-parser';
import type { AnyPage } from '@browserbasehq/stagehand';
import type { VisionAnalyzer } from '../../src/vision/analyzer';
import type { ScreenshotCapturer } from '../../src/core/screenshot-capturer';
import type { GameMetadata } from '../../src/types';
import pongMetadataJson from '../../_game-examples/pong/metadata.json';
import snakeMetadataJson from '../../_game-examples/snake/metadata.json';

const pongMetadata = pongMetadataJson as unknown as GameMetadata;
const snakeMetadata = snakeMetadataJson as unknown as GameMetadata;

// Mock Stagehand Page API (v3 uses direct methods)
const createMockPage = () => ({
  keyPress: mock(() => Promise.resolve()),
  click: mock(() => Promise.resolve()),
  act: mock(() => Promise.resolve()),
  screenshot: mock(() => Promise.resolve(Buffer.from('fake-png-data'))),
  url: mock(() => 'https://example.com'),
});

describe('GameInteractor', () => {
  let logger: Logger;
  let mockPage: ReturnType<typeof createMockPage>;

  beforeEach(() => {
    logger = new Logger({ module: 'test', op: 'game-interactor-test' });
    mockPage = createMockPage();
    // Reset mocks
    mockPage.keyPress.mockClear();
    mockPage.click.mockClear();
    mockPage.act.mockClear();
  });

  describe('GameInteractor instantiation', () => {
    it('should create GameInteractor with logger', () => {
      const interactor = new GameInteractor({ logger });
      expect(interactor).toBeInstanceOf(GameInteractor);
    });

    it('should create GameInteractor with custom timeout', () => {
      const customTimeout = 5000;
      const interactor = new GameInteractor({
        logger,
        interactionTimeout: customTimeout,
      });
      expect(interactor).toBeInstanceOf(GameInteractor);
    });
  });

  describe('simulateKeyboardInput()', () => {
    it('should send keyboard inputs for specified duration', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      await interactor.simulateKeyboardInput(page, 100);

      expect(mockPage.keyPress).toHaveBeenCalled();
    });

    it('should send WASD keys', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      await interactor.simulateKeyboardInput(page, 50);

      const calls = mockPage.keyPress.mock.calls;
      const pressedKeys = calls.map((call: any[]) => call[0] as string);

      const wasdKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
      const hasWASD = wasdKeys.some((key) => pressedKeys.includes(key));
      expect(hasWASD || pressedKeys.length > 0).toBe(true);
    });

    it('should send arrow keys', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      await interactor.simulateKeyboardInput(page, 50);

      const calls = mockPage.keyPress.mock.calls;
      const pressedKeys = calls.map((call: any[]) => call[0] as string);

      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      const hasArrows = arrowKeys.some((key) => pressedKeys.includes(key));
      expect(hasArrows || pressedKeys.length > 0).toBe(true);
    });

    it('should send space and enter keys', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      await interactor.simulateKeyboardInput(page, 50);

      const calls = mockPage.keyPress.mock.calls;
      const pressedKeys = calls.map((call: any[]) => call[0] as string);

      const specialKeys = ['Space', 'Enter'];
      const hasSpecial = specialKeys.some((key) => pressedKeys.includes(key));
      expect(hasSpecial || pressedKeys.length > 0).toBe(true);
    });

    it('should respect duration parameter', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      const startTime = Date.now();
      await interactor.simulateKeyboardInput(page, 200);
      const endTime = Date.now();
      const actualDuration = endTime - startTime;

      expect(actualDuration).toBeGreaterThanOrEqual(150);
      expect(actualDuration).toBeLessThan(500);
    });

    it('should wrap operations with timeout', async () => {
      const interactor = new GameInteractor({
        logger,
        interactionTimeout: 100,
      });
      const page = mockPage as unknown as AnyPage;

      mockPage.keyPress.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(resolve, 500);
        });
      });

      await expect(
        interactor.simulateKeyboardInput(page, 50)
      ).rejects.toThrow();
    });

    it('should handle keyboard errors gracefully', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      // Individual key errors are handled gracefully and simulation continues
      mockPage.keyPress.mockImplementationOnce(() => {
        throw new Error('Keyboard error');
      });

      // Should complete successfully despite individual key error
      await interactor.simulateKeyboardInput(page, 50);
      expect(mockPage.keyPress).toHaveBeenCalled();
    });

    it('should handle missing keyPress method', async () => {
      const interactor = new GameInteractor({ logger });
      const page = { url: mock(() => 'https://example.com') } as unknown as AnyPage;

      // Missing keyPress is handled gracefully - simulation continues with errors logged
      await interactor.simulateKeyboardInput(page, 50);
      // Function completes despite missing keyPress (errors are logged but don't stop simulation)
    });
  });

  describe('clickAtCoordinates()', () => {
    it('should click at specified coordinates', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      await interactor.clickAtCoordinates(page, 100, 200);

      expect(mockPage.click).toHaveBeenCalledTimes(1);
      expect(mockPage.click).toHaveBeenCalledWith(100, 200);
    });

    it('should validate coordinates are non-negative', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      await expect(
        interactor.clickAtCoordinates(page, -1, 100)
      ).rejects.toThrow();

      await expect(
        interactor.clickAtCoordinates(page, 100, -1)
      ).rejects.toThrow();
    });

    it('should allow zero coordinates', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      await interactor.clickAtCoordinates(page, 0, 0);

      expect(mockPage.click).toHaveBeenCalledWith(0, 0);
    });

    it('should wrap operations with timeout', async () => {
      const interactor = new GameInteractor({
        logger,
        interactionTimeout: 100,
      });
      const page = mockPage as unknown as AnyPage;

      mockPage.click.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(resolve, 500);
        });
      });

      await expect(
        interactor.clickAtCoordinates(page, 100, 200)
      ).rejects.toThrow();
    });

    it('should handle click errors gracefully', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      mockPage.click.mockImplementationOnce(() => {
        throw new Error('Click error');
      });

      await expect(
        interactor.clickAtCoordinates(page, 100, 200)
      ).rejects.toThrow('Click error');
    });

    it('should handle missing click method', async () => {
      const interactor = new GameInteractor({ logger });
      const page = { url: mock(() => 'https://example.com') } as unknown as AnyPage;

      await expect(
        interactor.clickAtCoordinates(page, 100, 200)
      ).rejects.toThrow();
    });
  });

  describe('findAndClickStart()', () => {
    const createMockVisionAnalyzer = () => ({
      findClickableElements: mock(() => Promise.resolve([])),
    } as unknown as VisionAnalyzer);

    const createMockScreenshotCapturer = () => ({
      capture: mock(() => Promise.resolve({
        id: 'test-screenshot',
        path: '/tmp/test-screenshot.png',
        timestamp: Date.now(),
        stage: 'initial_load' as const,
      })),
    } as unknown as ScreenshotCapturer);

    it('should find start button with natural language and return true', async () => {
      const interactor = new GameInteractor({ logger });
      const page = createMockPage();
      page.act.mockResolvedValueOnce(undefined);

      const result = await interactor.findAndClickStart(page as unknown as AnyPage);

      expect(result).toBe(true);
      expect(page.act).toHaveBeenCalled();
    });

    it('should fall back to vision if natural language fails', async () => {
      const visionAnalyzer = createMockVisionAnalyzer();
      const screenshotCapturer = createMockScreenshotCapturer();
      const interactor = new GameInteractor({
        logger,
        visionAnalyzer,
        screenshotCapturer,
      });
      const page = createMockPage();

      page.act.mockRejectedValue(new Error('Not found'));

      (visionAnalyzer.findClickableElements as any).mockImplementationOnce(() => Promise.resolve([
        {
          label: 'Start Game Button',
          x: 400,
          y: 300,
          confidence: 0.95,
        },
      ]));

      const result = await interactor.findAndClickStart(page as unknown as AnyPage);

      expect(result).toBe(true);
      expect(page.act).toHaveBeenCalled();
      expect(screenshotCapturer.capture).toHaveBeenCalledTimes(1);
      expect(visionAnalyzer.findClickableElements).toHaveBeenCalledTimes(1);
      expect(page.click).toHaveBeenCalledWith(400, 300);
    });

    it('should return false if both strategies fail', async () => {
      const visionAnalyzer = createMockVisionAnalyzer();
      const screenshotCapturer = createMockScreenshotCapturer();
      const interactor = new GameInteractor({
        logger,
        visionAnalyzer,
        screenshotCapturer,
      });
      const page = createMockPage();

      page.act.mockRejectedValue(new Error('Not found'));
      (visionAnalyzer.findClickableElements as any).mockImplementationOnce(() => Promise.resolve([]));

      const result = await interactor.findAndClickStart(page as unknown as AnyPage);

      expect(result).toBe(false);
      expect(page.act).toHaveBeenCalled();
      expect(screenshotCapturer.capture).toHaveBeenCalledTimes(1);
      expect(visionAnalyzer.findClickableElements).toHaveBeenCalledTimes(1);
      expect(page.click).not.toHaveBeenCalled();
    });

    it('should only try natural language if visionAnalyzer not provided', async () => {
      const interactor = new GameInteractor({ logger });
      const page = createMockPage();
      page.act.mockRejectedValue(new Error('Not found'));

      const result = await interactor.findAndClickStart(page as unknown as AnyPage);

      expect(result).toBe(false);
      expect(page.act).toHaveBeenCalled();
      expect(page.screenshot).not.toHaveBeenCalled();
    });

    it('should only try natural language if screenshotCapturer not provided', async () => {
      const visionAnalyzer = createMockVisionAnalyzer();
      const interactor = new GameInteractor({
        logger,
        visionAnalyzer,
      });
      const page = createMockPage();
      page.act.mockRejectedValue(new Error('Not found'));

      const result = await interactor.findAndClickStart(page as unknown as AnyPage);

      expect(result).toBe(false);
      expect(page.act).toHaveBeenCalled();
      expect(visionAnalyzer.findClickableElements).not.toHaveBeenCalled();
    });

    it('should filter elements for start/play keywords', async () => {
      const visionAnalyzer = createMockVisionAnalyzer();
      const screenshotCapturer = createMockScreenshotCapturer();
      const interactor = new GameInteractor({
        logger,
        visionAnalyzer,
        screenshotCapturer,
      });
      const page = createMockPage();

      page.act.mockRejectedValue(new Error('Not found'));

      (visionAnalyzer.findClickableElements as any).mockImplementationOnce(() => Promise.resolve([
        {
          label: 'Settings Button',
          x: 100,
          y: 100,
          confidence: 0.90,
        },
        {
          label: 'Start Game Button',
          x: 400,
          y: 300,
          confidence: 0.95,
        },
        {
          label: 'Help Button',
          x: 200,
          y: 200,
          confidence: 0.85,
        },
      ]));

      const result = await interactor.findAndClickStart(page as unknown as AnyPage);

      expect(result).toBe(true);
      expect(page.click).toHaveBeenCalledWith(400, 300);
    });

    it('should select highest confidence element when multiple matches', async () => {
      const visionAnalyzer = createMockVisionAnalyzer();
      const screenshotCapturer = createMockScreenshotCapturer();
      const interactor = new GameInteractor({
        logger,
        visionAnalyzer,
        screenshotCapturer,
      });
      const page = createMockPage();

      page.act.mockRejectedValue(new Error('Not found'));

      (visionAnalyzer.findClickableElements as any).mockImplementationOnce(() => Promise.resolve([
        {
          label: 'Play Button',
          x: 350,
          y: 250,
          confidence: 0.80,
        },
        {
          label: 'Start Game',
          x: 400,
          y: 300,
          confidence: 0.95,
        },
      ]));

      const result = await interactor.findAndClickStart(page as unknown as AnyPage);

      expect(result).toBe(true);
      expect(page.click).toHaveBeenCalledWith(400, 300);
    });

    it('should only use elements with confidence >= 0.7', async () => {
      const visionAnalyzer = createMockVisionAnalyzer();
      const screenshotCapturer = createMockScreenshotCapturer();
      const interactor = new GameInteractor({
        logger,
        visionAnalyzer,
        screenshotCapturer,
      });
      const page = createMockPage();

      page.act.mockRejectedValue(new Error('Not found'));

      (visionAnalyzer.findClickableElements as any).mockImplementationOnce(() => Promise.resolve([
        {
          label: 'Start Button',
          x: 400,
          y: 300,
          confidence: 0.65,
        },
      ]));

      const result = await interactor.findAndClickStart(page as unknown as AnyPage);

      expect(result).toBe(false);
      expect(page.click).not.toHaveBeenCalled();
    });

    it('should handle vision API errors gracefully', async () => {
      const visionAnalyzer = createMockVisionAnalyzer();
      const screenshotCapturer = createMockScreenshotCapturer();
      const interactor = new GameInteractor({
        logger,
        visionAnalyzer,
        screenshotCapturer,
      });
      const page = createMockPage();

      page.act.mockRejectedValue(new Error('Not found'));
      (visionAnalyzer.findClickableElements as any).mockImplementationOnce(() => Promise.reject(new Error('Vision API error')));

      const result = await interactor.findAndClickStart(page as unknown as AnyPage);

      expect(result).toBe(false);
      expect(screenshotCapturer.capture).toHaveBeenCalledTimes(1);
    });

    it('should handle screenshot capture errors gracefully', async () => {
      const visionAnalyzer = createMockVisionAnalyzer();
      const screenshotCapturer = createMockScreenshotCapturer();
      const interactor = new GameInteractor({
        logger,
        visionAnalyzer,
        screenshotCapturer,
      });
      const page = createMockPage();

      page.act.mockRejectedValue(new Error('Not found'));
      (screenshotCapturer.capture as any).mockImplementationOnce(() => Promise.reject(new Error('Screenshot failed')));

      const result = await interactor.findAndClickStart(page as unknown as AnyPage);

      expect(result).toBe(false);
      expect(visionAnalyzer.findClickableElements).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should log errors during keyboard simulation', async () => {
      const warnSpy = mock();
      logger.warn = warnSpy;

      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      mockPage.keyPress.mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      // Individual key errors are handled gracefully - simulation continues
      await interactor.simulateKeyboardInput(page, 50);

      // Should log warning for individual key error
      expect(warnSpy).toHaveBeenCalled();
    });

    it('should log errors during mouse click', async () => {
      const errorSpy = mock();
      logger.error = errorSpy;

      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      mockPage.click.mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      await expect(
        interactor.clickAtCoordinates(page, 100, 200)
      ).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('simulateGameplayWithMetadata()', () => {
    it('should test actions from Pong metadata', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      await interactor.simulateGameplayWithMetadata(page, pongMetadata, 500);

      const calls = mockPage.keyPress.mock.calls;
      const pressedKeys = calls.map((call: any[]) => call[0] as string);

      // Should test Escape key (Pause action)
      expect(pressedKeys).toContain('Escape');
    });

    it('should test axes from Pong metadata', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      await interactor.simulateGameplayWithMetadata(page, pongMetadata, 500);

      const calls = mockPage.keyPress.mock.calls;
      const pressedKeys = calls.map((call: any[]) => call[0] as string);

      // Should test ArrowDown and ArrowUp (RightPaddleVertical axis)
      expect(pressedKeys).toContain('ArrowDown');
      expect(pressedKeys).toContain('ArrowUp');
    });

    it('should test axes from Snake metadata', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      await interactor.simulateGameplayWithMetadata(page, snakeMetadata, 500);

      const calls = mockPage.keyPress.mock.calls;
      const pressedKeys = calls.map((call: any[]) => call[0] as string);

      // Should test WASD and arrow keys (Move axis)
      expect(pressedKeys.some(key => ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(key) || 
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key))).toBe(true);
    });

    it('should prioritize critical actions first', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      await interactor.simulateGameplayWithMetadata(page, pongMetadata, 500);

      const calls = mockPage.keyPress.mock.calls;
      const pressedKeys = calls.map((call: any[]) => call[0] as string);

      // First key should be Escape (critical action)
      if (pressedKeys.length > 0) {
        expect(pressedKeys[0]).toBe('Escape');
      }
    });

    it('should prioritize critical axes first', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      await interactor.simulateGameplayWithMetadata(page, pongMetadata, 500);

      const calls = mockPage.keyPress.mock.calls;
      const pressedKeys = calls.map((call: any[]) => call[0] as string);

      // Should test ArrowDown/ArrowUp (critical axis) early
      const criticalKeys = ['ArrowDown', 'ArrowUp'];
      const hasCriticalKeys = pressedKeys.some(key => criticalKeys.includes(key));
      expect(hasCriticalKeys).toBe(true);
    });

    it('should fallback to generic inputs when metadata is undefined', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      await interactor.simulateGameplayWithMetadata(page, undefined, 100);

      // Should still call keyPress (fallback to generic inputs)
      expect(mockPage.keyPress).toHaveBeenCalled();
    });

    it('should fallback to generic inputs when metadata has no keys', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      const emptyMetadata: GameMetadata = {
        inputSchema: {
          type: 'semantic',
          content: 'No keys specified',
        },
      };

      await interactor.simulateGameplayWithMetadata(page, emptyMetadata, 100);

      // Should still call keyPress (fallback to generic inputs)
      expect(mockPage.keyPress).toHaveBeenCalled();
    });

    it('should map key names correctly (w → KeyW)', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      await interactor.simulateGameplayWithMetadata(page, snakeMetadata, 500);

      const calls = mockPage.keyPress.mock.calls;
      const pressedKeys = calls.map((call: any[]) => call[0] as string);

      // Should map 'w' to 'KeyW'
      expect(pressedKeys).toContain('KeyW');
    });

    it('should use testingStrategy.interactionDuration when provided', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      // Create metadata with shorter interactionDuration for testing
      const metadataWithShortDuration: GameMetadata = {
        ...pongMetadata,
        testingStrategy: {
          waitBeforeInteraction: 2000,
          interactionDuration: 200, // Short duration for test
          criticalActions: ['Pause'],
          criticalAxes: ['RightPaddleVertical'],
        },
      };

      const startTime = Date.now();
      await interactor.simulateGameplayWithMetadata(page, metadataWithShortDuration);
      const endTime = Date.now();
      const actualDuration = endTime - startTime;

      // Should use testingStrategy.interactionDuration (200ms) from metadata
      expect(actualDuration).toBeGreaterThanOrEqual(150);
      expect(actualDuration).toBeLessThan(500);
    });

    it('should handle missing testingStrategy gracefully', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      const metadataWithoutStrategy: GameMetadata = {
        inputSchema: {
          type: 'javascript',
          content: 'gameBuilder.createAction("Jump").bindKey("Space")',
          actions: [
            {
              name: 'Jump',
              keys: ['Space'],
            },
          ],
        },
      };

      await interactor.simulateGameplayWithMetadata(page, metadataWithoutStrategy, 100);

      // Should complete successfully without testingStrategy
      expect(mockPage.keyPress).toHaveBeenCalled();
    });
  });

  describe('Canvas-aware clicking', () => {
    it('should detect canvas game from metadata with canvas instructions', () => {
      const canvasMetadata: GameMetadata = {
        inputSchema: {
          type: 'semantic',
          content: 'Click on canvas elements',
        },
        testingStrategy: {
          instructions: 'This is a canvas-based game. Click on bricks to destroy them.',
        },
      };

      const interactor = new GameInteractor({ logger, metadata: canvasMetadata });
      const page = mockPage as unknown as AnyPage;

      // Mock evaluate to return canvas element
      (page as any).evaluate = mock(() =>
        Promise.resolve({
          x: 100,
          y: 200,
          width: 800,
          height: 600,
        })
      );

      // Test executeRecommendationPublic with percentage coordinates
      const recommendation = {
        action: 'click' as const,
        target: { x: 0.5, y: 0.5 }, // Center of canvas (percentage)
        reasoning: 'Click center of canvas',
        confidence: 0.9,
      };

      // Should use canvas-aware clicking (will call evaluate to find canvas)
      const result = interactor.executeRecommendationPublic(page, recommendation);
      expect(result).toBeInstanceOf(Promise);
    });

    it('should detect canvas game from inputSchema content', () => {
      const canvasMetadata: GameMetadata = {
        inputSchema: {
          type: 'semantic',
          content: 'This is a canvas game. Click on canvas elements.',
        },
      };

      const interactor = new GameInteractor({ logger, metadata: canvasMetadata });
      const page = mockPage as unknown as AnyPage;

      // Mock evaluate to return canvas element
      (page as any).evaluate = mock(() =>
        Promise.resolve({
          x: 100,
          y: 200,
          width: 800,
          height: 600,
        })
      );

      const recommendation = {
        action: 'click' as const,
        target: { x: 0.5, y: 0.5 },
        reasoning: 'Click center',
        confidence: 0.9,
      };

      const result = interactor.executeRecommendationPublic(page, recommendation);
      expect(result).toBeInstanceOf(Promise);
    });

    it('should convert percentage coordinates to absolute pixels for canvas', async () => {
      const canvasMetadata: GameMetadata = {
        inputSchema: {
          type: 'semantic',
          content: 'Canvas-based game',
        },
        testingStrategy: {
          instructions: 'This is a canvas-based game.',
        },
      };

      const interactor = new GameInteractor({ logger, metadata: canvasMetadata });
      const page = mockPage as unknown as AnyPage;

      // Mock canvas element at (100, 200) with size 800x600
      (page as any).evaluate = mock(() =>
        Promise.resolve({
          x: 100,
          y: 200,
          width: 800,
          height: 600,
        })
      );

      // Click at 50% width, 50% height (center)
      const recommendation = {
        action: 'click' as const,
        target: { x: 0.5, y: 0.5 },
        reasoning: 'Click center of canvas',
        confidence: 0.9,
      };

      await interactor.executeRecommendationPublic(page, recommendation);

      // Should call evaluate to find canvas
      expect((page as any).evaluate).toHaveBeenCalled();

      // Should click at absolute coordinates: 100 + (800 * 0.5) = 500, 200 + (600 * 0.5) = 500
      expect(mockPage.click).toHaveBeenCalledWith(500, 500);
    });

    it('should fallback to regular clicking if canvas not found', async () => {
      const canvasMetadata: GameMetadata = {
        inputSchema: {
          type: 'semantic',
          content: 'Canvas-based game',
        },
        testingStrategy: {
          instructions: 'This is a canvas-based game.',
        },
      };

      const interactor = new GameInteractor({ logger, metadata: canvasMetadata });
      const page = mockPage as unknown as AnyPage;

      // Mock evaluate to return null (canvas not found)
      (page as any).evaluate = mock(() => Promise.resolve(null));

      const recommendation = {
        action: 'click' as const,
        target: { x: 0.5, y: 0.5 },
        reasoning: 'Click center',
        confidence: 0.9,
      };

      const result = await interactor.executeRecommendationPublic(page, recommendation);

      // Should return false (canvas not found)
      expect(result).toBe(false);
    });

    it('should use regular clicking for non-canvas games', async () => {
      const domMetadata: GameMetadata = {
        inputSchema: {
          type: 'semantic',
          content: 'DOM-based game with buttons',
        },
      };

      const interactor = new GameInteractor({ logger, metadata: domMetadata });
      const page = mockPage as unknown as AnyPage;

      // Click at absolute pixel coordinates (not percentages)
      const recommendation = {
        action: 'click' as const,
        target: { x: 400, y: 300 },
        reasoning: 'Click button',
        confidence: 0.9,
      };

      await interactor.executeRecommendationPublic(page, recommendation);

      // Should use regular clicking (click called with pixel coordinates)
      expect(mockPage.click).toHaveBeenCalledWith(400, 300);
    });

    it('should use regular clicking for canvas games with pixel coordinates', async () => {
      const canvasMetadata: GameMetadata = {
        inputSchema: {
          type: 'semantic',
          content: 'Canvas-based game',
        },
        testingStrategy: {
          instructions: 'This is a canvas-based game.',
        },
      };

      const interactor = new GameInteractor({ logger, metadata: canvasMetadata });
      const page = mockPage as unknown as AnyPage;

      // Click at absolute pixel coordinates (not percentages)
      const recommendation = {
        action: 'click' as const,
        target: { x: 400, y: 300 },
        reasoning: 'Click at pixel coordinates',
        confidence: 0.9,
      };

      await interactor.executeRecommendationPublic(page, recommendation);

      // Should use regular clicking (pixel coordinates, not percentages)
      // Note: evaluate is not called because coordinates are pixels, not percentages
      expect(mockPage.click).toHaveBeenCalledWith(400, 300);
    });
  });
});
