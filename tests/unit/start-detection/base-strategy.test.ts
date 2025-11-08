/**
 * Unit tests for BaseStartStrategy.
 */

import { describe, it, expect } from 'bun:test';
import { BaseStartStrategy, StartButtonResult } from '../../../src/core/start-detection/base-strategy';
import { Logger } from '../../../src/utils/logger';
import type { AnyPage } from '@browserbasehq/stagehand';

// Concrete implementation for testing
class TestStrategy extends BaseStartStrategy {
  private available: boolean;
  private result: StartButtonResult;

  constructor(
    logger: Logger,
    name: string,
    available: boolean = true,
    result: StartButtonResult
  ) {
    super(logger, name);
    this.available = available;
    this.result = result;
  }

  isAvailable(): boolean {
    return this.available;
  }

  async execute(_page: AnyPage, _timeout: number): Promise<StartButtonResult> {
    return this.result;
  }
}

describe('BaseStartStrategy', () => {
  const logger = new Logger({ module: 'test' });

  describe('constructor', () => {
    it('should create strategy with logger and name', () => {
      const result: StartButtonResult = {
        success: true,
        strategy: 'test',
        attempts: 1,
        duration: 100,
      };
      const strategy = new TestStrategy(logger, 'test', true, result);
      expect(strategy).toBeDefined();
    });
  });

  describe('postClickDelay', () => {
    it('should wait for specified delay', async () => {
      const result: StartButtonResult = {
        success: true,
        strategy: 'test',
        attempts: 1,
        duration: 100,
      };
      const strategy = new TestStrategy(logger, 'test', true, result);
      
      const start = Date.now();
      await strategy['postClickDelay'](50);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some variance
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('isAvailable', () => {
    it('should return true when strategy is available', () => {
      const result: StartButtonResult = {
        success: true,
        strategy: 'test',
        attempts: 1,
        duration: 100,
      };
      const strategy = new TestStrategy(logger, 'test', true, result);
      expect(strategy.isAvailable()).toBe(true);
    });

    it('should return false when strategy is not available', () => {
      const result: StartButtonResult = {
        success: false,
        strategy: 'test',
        attempts: 0,
        duration: 0,
      };
      const strategy = new TestStrategy(logger, 'test', false, result);
      expect(strategy.isAvailable()).toBe(false);
    });
  });

  describe('execute', () => {
    it('should return StartButtonResult', async () => {
      const result: StartButtonResult = {
        success: true,
        strategy: 'test',
        attempts: 1,
        duration: 100,
        coordinates: { x: 100, y: 200 },
      };
      const strategy = new TestStrategy(logger, 'test', true, result);
      
      const mockPage = {} as AnyPage;
      const executionResult = await strategy.execute(mockPage, 1000);
      
      expect(executionResult).toEqual(result);
    });
  });
});

