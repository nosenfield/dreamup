/**
 * Unit tests for timeout utility.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { withTimeout, TimeoutError } from '../../src/utils/timeout';
import { TIMEOUTS } from '../../src/config/constants';

describe('Timeout Utility', () => {
  describe('withTimeout()', () => {
    it('should resolve when promise completes within timeout', async () => {
      const fastPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 50);
      });

      const result = await withTimeout(fastPromise, 100, 'Test operation');
      expect(result).toBe('success');
    });

    it('should throw TimeoutError when promise exceeds timeout', async () => {
      const slowPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 200);
      });

      await expect(
        withTimeout(slowPromise, 50, 'Test operation')
      ).rejects.toThrow(TimeoutError);
    });

    it('should use custom error message when provided', async () => {
      const slowPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 200);
      });

      const customMessage = 'Operation took too long';
      await expect(
        withTimeout(slowPromise, 50, customMessage)
      ).rejects.toThrow(customMessage);
    });

    it('should use default error message when not provided', async () => {
      const slowPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 200);
      });

      await expect(
        withTimeout(slowPromise, 50)
      ).rejects.toThrow('Operation timed out after 50ms');
    });

    it('should propagate promise rejection (non-timeout errors)', async () => {
      const failingPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('Custom error')), 50);
      });

      await expect(
        withTimeout(failingPromise, 100, 'Test operation')
      ).rejects.toThrow('Custom error');
    });

    it('should work with immediate resolve', async () => {
      const immediatePromise = Promise.resolve('immediate');

      const result = await withTimeout(immediatePromise, 100, 'Test operation');
      expect(result).toBe('immediate');
    });

    it('should work with immediate reject', async () => {
      const immediateReject = Promise.reject(new Error('Immediate error'));

      await expect(
        withTimeout(immediateReject, 100, 'Test operation')
      ).rejects.toThrow('Immediate error');
    });

    it('should work with different return types', async () => {
      const numberPromise = Promise.resolve(42);
      const objectPromise = Promise.resolve({ key: 'value' });
      const arrayPromise = Promise.resolve([1, 2, 3]);

      expect(await withTimeout(numberPromise, 100, 'Test')).toBe(42);
      expect(await withTimeout(objectPromise, 100, 'Test')).toEqual({ key: 'value' });
      expect(await withTimeout(arrayPromise, 100, 'Test')).toEqual([1, 2, 3]);
    });
  });

  describe('TimeoutError', () => {
    it('should be instance of Error', async () => {
      const slowPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 200);
      });

      try {
        await withTimeout(slowPromise, 50, 'Test operation');
        expect.fail('Should have thrown TimeoutError');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(TimeoutError);
      }
    });

    it('should include timeout duration in default message', async () => {
      const slowPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 200);
      });

      try {
        await withTimeout(slowPromise, 75); // No custom message
        expect.fail('Should have thrown TimeoutError');
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).message).toContain('75');
        expect((error as TimeoutError).message).toContain('timed out');
      }
    });

    it('should have correct error name', async () => {
      const slowPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 200);
      });

      try {
        await withTimeout(slowPromise, 50, 'Test operation');
        expect.fail('Should have thrown TimeoutError');
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).name).toBe('TimeoutError');
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle zero timeout (reject immediately)', async () => {
      const slowPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 100);
      });

      await expect(
        withTimeout(slowPromise, 0, 'Test operation')
      ).rejects.toThrow(TimeoutError);
    });

    it('should handle very short timeout', async () => {
      const slowPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 100);
      });

      await expect(
        withTimeout(slowPromise, 1, 'Test operation')
      ).rejects.toThrow(TimeoutError);
    });

    it('should handle very long timeout', async () => {
      const fastPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 50);
      });

      const result = await withTimeout(fastPromise, 100000, 'Test operation');
      expect(result).toBe('success');
    });

    it('should handle Infinity timeout (never timeout)', async () => {
      const slowPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 100);
      });

      const result = await withTimeout(slowPromise, Infinity, 'Test operation');
      expect(result).toBe('success');
    });

    it('should handle negative timeout gracefully', async () => {
      const fastPromise = Promise.resolve('success');

      // p-timeout handles negative values, but we should test behavior
      // For now, it will likely reject immediately or throw
      await expect(
        withTimeout(fastPromise, -100, 'Test operation')
      ).rejects.toThrow();
    });
  });

  describe('TIMEOUTS constants', () => {
    it('should export TIMEOUTS constants', () => {
      // Import TIMEOUTS from timeout utility
      const { TIMEOUTS: TimeoutUtils } = require('../../src/utils/timeout');
      
      expect(TimeoutUtils).toBeDefined();
      expect(TimeoutUtils.MAX_TEST_DURATION).toBe(TIMEOUTS.MAX_TEST_DURATION);
      expect(TimeoutUtils.GAME_LOAD_TIMEOUT).toBe(TIMEOUTS.GAME_LOAD_TIMEOUT);
      expect(TimeoutUtils.INTERACTION_TIMEOUT).toBe(TIMEOUTS.INTERACTION_TIMEOUT);
      expect(TimeoutUtils.SCREENSHOT_TIMEOUT).toBe(TIMEOUTS.SCREENSHOT_TIMEOUT);
      expect(TimeoutUtils.PAGE_NAVIGATION_TIMEOUT).toBe(TIMEOUTS.PAGE_NAVIGATION_TIMEOUT);
    });
  });
});

