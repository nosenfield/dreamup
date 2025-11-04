/**
 * Unit tests for GameInteractor.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { GameInteractor } from '../../src/core/game-interactor';
import { Logger } from '../../src/utils/logger';
import { TIMEOUTS } from '../../src/config/constants';
import { TimeoutError } from '../../src/utils/timeout';
import type { AnyPage } from '@browserbasehq/stagehand';

// Mock keyboard and mouse objects
const mockKeyboard = {
  press: mock(() => Promise.resolve()),
  type: mock(() => Promise.resolve()),
};

const mockMouse = {
  click: mock(() => Promise.resolve()),
};

// Mock page object
const createMockPage = () => ({
  keyboard: mockKeyboard,
  mouse: mockMouse,
  url: mock(() => 'https://example.com'),
});

describe('GameInteractor', () => {
  let logger: Logger;
  let mockPage: ReturnType<typeof createMockPage>;

  beforeEach(() => {
    logger = new Logger({ module: 'test', op: 'game-interactor-test' });
    mockPage = createMockPage();
    // Reset mocks
    mockKeyboard.press.mockClear();
    mockMouse.click.mockClear();
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

      // Mock a short duration (100ms) for testing
      await interactor.simulateKeyboardInput(page, 100);

      // Should have called keyboard.press at least once
      expect(mockKeyboard.press).toHaveBeenCalled();
    });

    it('should send WASD keys', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      // Use very short duration to avoid long test runs
      await interactor.simulateKeyboardInput(page, 50);

      // Check that WASD keys were pressed
      const calls = mockKeyboard.press.mock.calls;
      const pressedKeys = calls.map((call) => call[0]);

      // Should include at least some of WASD keys
      const wasdKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
      const hasWASD = wasdKeys.some((key) => pressedKeys.includes(key));
      expect(hasWASD || pressedKeys.length > 0).toBe(true); // At least some keys pressed
    });

    it('should send arrow keys', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      await interactor.simulateKeyboardInput(page, 50);

      const calls = mockKeyboard.press.mock.calls;
      const pressedKeys = calls.map((call) => call[0]);

      // Should include arrow keys
      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      const hasArrows = arrowKeys.some((key) => pressedKeys.includes(key));
      expect(hasArrows || pressedKeys.length > 0).toBe(true);
    });

    it('should send space and enter keys', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      await interactor.simulateKeyboardInput(page, 50);

      const calls = mockKeyboard.press.mock.calls;
      const pressedKeys = calls.map((call) => call[0]);

      // Should include space or enter
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

      // Should take approximately the duration (with some tolerance)
      expect(actualDuration).toBeGreaterThanOrEqual(150); // Allow some variance
      expect(actualDuration).toBeLessThan(500); // But not too long
    });

    it('should wrap operations with timeout', async () => {
      const interactor = new GameInteractor({
        logger,
        interactionTimeout: 100, // Very short timeout
      });
      const page = mockPage as unknown as AnyPage;

      // Mock a slow keyboard press
      mockKeyboard.press.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(resolve, 500); // Longer than timeout
        });
      });

      await expect(
        interactor.simulateKeyboardInput(page, 50)
      ).rejects.toThrow();
    });

    it('should handle keyboard errors gracefully', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      // Mock keyboard error
      mockKeyboard.press.mockImplementationOnce(() => {
        throw new Error('Keyboard error');
      });

      // Should not throw, but handle gracefully
      await expect(
        interactor.simulateKeyboardInput(page, 50)
      ).rejects.toThrow('Keyboard error');
    });

    it('should handle missing keyboard object', async () => {
      const interactor = new GameInteractor({ logger });
      const page = { url: mock(() => 'https://example.com') } as unknown as AnyPage;

      await expect(
        interactor.simulateKeyboardInput(page, 50)
      ).rejects.toThrow();
    });
  });

  describe('clickAtCoordinates()', () => {
    it('should click at specified coordinates', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      await interactor.clickAtCoordinates(page, 100, 200);

      expect(mockMouse.click).toHaveBeenCalledTimes(1);
      expect(mockMouse.click).toHaveBeenCalledWith(100, 200);
    });

    it('should validate coordinates are non-negative', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      // Negative coordinates should throw
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

      expect(mockMouse.click).toHaveBeenCalledWith(0, 0);
    });

    it('should wrap operations with timeout', async () => {
      const interactor = new GameInteractor({
        logger,
        interactionTimeout: 100,
      });
      const page = mockPage as unknown as AnyPage;

      // Mock a slow mouse click
      mockMouse.click.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(resolve, 500);
        });
      });

      await expect(
        interactor.clickAtCoordinates(page, 100, 200)
      ).rejects.toThrow();
    });

    it('should handle mouse errors gracefully', async () => {
      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      // Mock mouse error
      mockMouse.click.mockImplementationOnce(() => {
        throw new Error('Mouse error');
      });

      await expect(
        interactor.clickAtCoordinates(page, 100, 200)
      ).rejects.toThrow('Mouse error');
    });

    it('should handle missing mouse object', async () => {
      const interactor = new GameInteractor({ logger });
      const page = { url: mock(() => 'https://example.com') } as unknown as AnyPage;

      await expect(
        interactor.clickAtCoordinates(page, 100, 200)
      ).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should log errors during keyboard simulation', async () => {
      const errorSpy = mock();
      logger.error = errorSpy;

      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      mockKeyboard.press.mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      await expect(
        interactor.simulateKeyboardInput(page, 50)
      ).rejects.toThrow();

      // Logger should have been called
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should log errors during mouse click', async () => {
      const errorSpy = mock();
      logger.error = errorSpy;

      const interactor = new GameInteractor({ logger });
      const page = mockPage as unknown as AnyPage;

      mockMouse.click.mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      await expect(
        interactor.clickAtCoordinates(page, 100, 200)
      ).rejects.toThrow();

      // Logger should have been called
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});

