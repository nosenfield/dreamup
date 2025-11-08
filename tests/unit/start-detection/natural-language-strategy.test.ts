/**
 * Unit tests for NaturalLanguageStrategy.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { NaturalLanguageStrategy } from '../../../src/core/start-detection/natural-language-strategy';
import { Logger } from '../../../src/utils/logger';
import type { AnyPage } from '@browserbasehq/stagehand';

describe('NaturalLanguageStrategy', () => {
  let logger: Logger;
  let strategy: NaturalLanguageStrategy;
  let mockPage: any;

  beforeEach(() => {
    logger = new Logger({ module: 'test' });
    strategy = new NaturalLanguageStrategy(logger, 'natural_language');
    mockPage = {
      act: mock(() => Promise.resolve()),
    };
  });

  describe('isAvailable', () => {
    it('should always return true', () => {
      expect(strategy.isAvailable()).toBe(true);
    });
  });

  describe('execute', () => {
    it('should return success when page.act() succeeds', async () => {
      const result = await strategy.execute(mockPage as AnyPage, 1000);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe('natural_language');
      expect(result.attempts).toBe(1);
    });

    it('should try multiple phrases if first fails', async () => {
      let callCount = 0;
      mockPage.act = mock((phrase: string) => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('First phrase failed'));
        }
        return Promise.resolve();
      });

      const result = await strategy.execute(mockPage as AnyPage, 1000);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('should return failure when page.act() not available', async () => {
      const pageWithoutAct = {} as AnyPage;
      const result = await strategy.execute(pageWithoutAct, 1000);

      expect(result.success).toBe(false);
      expect(result.strategy).toBe('natural_language');
      expect(result.attempts).toBe(0);
      expect(result.error).toBe('page.act() not available');
    });

    it('should return failure when all phrases fail', async () => {
      mockPage.act = mock(() => Promise.reject(new Error('All phrases failed')));

      const result = await strategy.execute(mockPage as AnyPage, 1000);

      expect(result.success).toBe(false);
      expect(result.strategy).toBe('natural_language');
      expect(result.attempts).toBe(4); // All 4 phrases tried
      expect(result.error).toBe('All phrases failed');
    });

    it('should calculate duration correctly', async () => {
      const start = Date.now();
      const result = await strategy.execute(mockPage as AnyPage, 1000);
      const elapsed = Date.now() - start;

      expect(result.duration).toBeGreaterThanOrEqual(0);
      // Duration includes post-click delay (2000ms), so it should be >= 2000
      expect(result.duration).toBeGreaterThanOrEqual(2000);
      expect(result.duration).toBeLessThan(2100); // Allow some variance
    });
  });
});

