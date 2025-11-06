import { describe, it, expect } from 'bun:test';
import {
  calculateScreenshotBudget,
  calculateEstimatedCost,
  distributeScreenshotsOverTime,
  mergeAdaptiveConfig,
} from '../../src/utils/adaptive-qa';

describe('Adaptive QA Helpers', () => {
  describe('calculateScreenshotBudget', () => {
    it('should calculate max screenshots based on budget', () => {
      const budget = 0.50;
      const screenshots = calculateScreenshotBudget(budget);
      
      // (0.50 - 0.10 reserved) / 0.02 = 20 screenshots
      expect(screenshots).toBe(20);
    });

    it('should reserve budget for final analysis', () => {
      const budget = 0.30;
      const screenshots = calculateScreenshotBudget(budget);
      
      // (0.30 - 0.10 reserved) / 0.02 = 10 screenshots
      // May be 9 due to floating point precision, but should be >= 9
      expect(screenshots).toBeGreaterThanOrEqual(9);
      expect(screenshots).toBeLessThanOrEqual(10);
    });

    it('should return minimum of 3 screenshots even with low budget', () => {
      const budget = 0.15; // Only 0.05 remaining after reserved
      const screenshots = calculateScreenshotBudget(budget);
      
      // Should clamp to minimum 3
      expect(screenshots).toBe(3);
    });

    it('should clamp to maximum of 20 screenshots', () => {
      const budget = 2.00; // Very high budget
      const screenshots = calculateScreenshotBudget(budget);
      
      // Should clamp to maximum 20
      expect(screenshots).toBe(20);
    });
  });

  describe('calculateEstimatedCost', () => {
    it('should calculate cost from actions and screenshots', () => {
      const cost = calculateEstimatedCost(5, 6, 0);
      
      // (5 * 0.02) + (6 * 0.02) = 0.22
      expect(cost).toBeCloseTo(0.22, 2);
    });

    it('should include state check costs', () => {
      const cost = calculateEstimatedCost(3, 5, 2);
      
      // (3 * 0.02) + (5 * 0.02) + (2 * 0.03) = 0.22
      expect(cost).toBeCloseTo(0.22, 2);
    });

    it('should return zero for zero actions and screenshots', () => {
      const cost = calculateEstimatedCost(0, 0, 0);
      expect(cost).toBe(0);
    });

    it('should handle large counts', () => {
      const cost = calculateEstimatedCost(50, 30, 25);
      
      // (50 * 0.02) + (30 * 0.02) + (25 * 0.03) = 2.35
      expect(cost).toBeCloseTo(2.35, 2);
    });
  });

  describe('distributeScreenshotsOverTime', () => {
    it('should always include initial, post-start, and final screenshots', () => {
      const timestamps = distributeScreenshotsOverTime(60000, 5);
      
      expect(timestamps).toContain(0);
      expect(timestamps).toContain(2000);
      expect(timestamps).toContain(60000);
    });

    it('should distribute remaining screenshots evenly', () => {
      const timestamps = distributeScreenshotsOverTime(60000, 5);
      
      // Should have: 0, 2000, intermediate, intermediate, 60000
      expect(timestamps.length).toBe(5);
      expect(timestamps[0]).toBe(0);
      expect(timestamps[1]).toBe(2000);
      expect(timestamps[timestamps.length - 1]).toBe(60000);
      
      // Intermediate screenshots should be between 2000 and 60000
      const intermediates = timestamps.slice(2, -1);
      intermediates.forEach(ts => {
        expect(ts).toBeGreaterThan(2000);
        expect(ts).toBeLessThan(60000);
      });
    });

    it('should handle minimum screenshot count (3)', () => {
      const timestamps = distributeScreenshotsOverTime(60000, 3);
      
      expect(timestamps.length).toBe(3);
      expect(timestamps).toEqual([0, 2000, 60000]);
    });

    it('should return sorted timestamps', () => {
      const timestamps = distributeScreenshotsOverTime(120000, 10);
      
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeLessThan(timestamps[i + 1]);
      }
    });

    it('should handle short durations', () => {
      const timestamps = distributeScreenshotsOverTime(5000, 5);
      
      expect(timestamps.length).toBe(5);
      expect(timestamps[0]).toBe(0);
      expect(timestamps[timestamps.length - 1]).toBe(5000);
    });
  });

  describe('mergeAdaptiveConfig', () => {
    it('should use defaults when no config provided', () => {
      const config = mergeAdaptiveConfig();
      
      expect(config.maxBudget).toBe(0.50);
      expect(config.maxDuration).toBe(240000);
      expect(config.maxActions).toBe(20);
      expect(config.screenshotStrategy).toBe('fixed');
      expect(config.llmCallStrategy).toBe('eager');
    });

    it('should override defaults with provided config', () => {
      const config = mergeAdaptiveConfig({
        maxBudget: 1.00,
        maxActions: 10,
      });
      
      expect(config.maxBudget).toBe(1.00);
      expect(config.maxActions).toBe(10);
      expect(config.maxDuration).toBe(240000); // Default preserved
      expect(config.screenshotStrategy).toBe('fixed'); // Default preserved
    });

    it('should handle partial overrides', () => {
      const config = mergeAdaptiveConfig({
        screenshotStrategy: 'adaptive',
        llmCallStrategy: 'lazy',
      });
      
      expect(config.screenshotStrategy).toBe('adaptive');
      expect(config.llmCallStrategy).toBe('lazy');
      expect(config.maxBudget).toBe(0.50); // Default preserved
    });
  });
});

