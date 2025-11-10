/**
 * Unit tests for DOMStrategy.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { DOMStrategy } from '../../../src/core/start-detection/dom-strategy';
import { Logger } from '../../../src/utils/logger';
import type { AnyPage } from '@browserbasehq/stagehand';

describe('DOMStrategy', () => {
  let logger: Logger;
  let strategy: DOMStrategy;
  let mockPage: any;

  beforeEach(() => {
    logger = new Logger({ module: 'test' });
    strategy = new DOMStrategy(logger, 'dom');
    mockPage = {
      locator: mock(() => ({
        first: mock(() => ({
          isVisible: mock(() => Promise.resolve(true)),
          click: mock(() => Promise.resolve()),
          boundingBox: mock(() => Promise.resolve({ x: 100, y: 200, width: 50, height: 30 })),
        })),
      })),
    };
  });

  describe('isAvailable', () => {
    it('should always return true', () => {
      expect(strategy.isAvailable()).toBe(true);
    });
  });

  describe('execute', () => {
    it('should return success when element found and clicked', async () => {
      const result = await strategy.execute(mockPage as AnyPage, 1000);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe('dom');
      expect(result.attempts).toBe(1);
      expect(result.coordinates).toEqual({ x: 125, y: 215 });
    });

    it('should try multiple selectors if first fails', async () => {
      let callCount = 0;
      mockPage.locator = mock((selector: string) => {
        callCount++;
        if (callCount === 1) {
          // First selector fails
          return {
            first: mock(() => ({
              isVisible: mock(() => Promise.resolve(false)),
            })),
          };
        }
        // Second selector succeeds
        return {
          first: mock(() => ({
            isVisible: mock(() => Promise.resolve(true)),
            click: mock(() => Promise.resolve()),
            boundingBox: mock(() => Promise.resolve({ x: 200, y: 300, width: 60, height: 40 })),
          })),
        };
      });

      const result = await strategy.execute(mockPage as AnyPage, 1000);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(result.coordinates).toEqual({ x: 230, y: 320 });
    });

    it('should return failure when no selectors match', async () => {
      mockPage.locator = mock(() => ({
        first: mock(() => ({
          isVisible: mock(() => Promise.resolve(false)),
        })),
      }));

      const result = await strategy.execute(mockPage as AnyPage, 1000);

      expect(result.success).toBe(false);
      expect(result.strategy).toBe('dom');
      expect(result.attempts).toBeGreaterThan(0);
      expect(result.error).toBe('No selectors matched');
    });

    it('should handle click errors gracefully', async () => {
      mockPage.locator = mock(() => ({
        first: mock(() => ({
          isVisible: mock(() => Promise.resolve(true)),
          click: mock(() => Promise.reject(new Error('Click failed'))),
        })),
      }));

      const result = await strategy.execute(mockPage as AnyPage, 1000);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No selectors matched');
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

