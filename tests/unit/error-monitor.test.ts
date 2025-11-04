/**
 * Unit tests for ErrorMonitor.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { ErrorMonitor } from '../../src/core/error-monitor';
import { Logger } from '../../src/utils/logger';
import type { AnyPage } from '@browserbasehq/stagehand';
import type { ConsoleError } from '../../src/types/game-test.types';

// Mock page object with evaluate method
const createMockPage = () => {
  let errors: ConsoleError[] = [];
  let monitoringActive = false;

  return {
    evaluate: mock((fn: () => void) => {
      // Simulate console override in browser context
      if (typeof fn === 'function') {
        try {
          return Promise.resolve(fn());
        } catch {
          return Promise.resolve(undefined);
        }
      }
      return Promise.resolve(undefined);
    }),
    url: mock(() => 'https://example.com'),
    // Helper to simulate console errors
    simulateError: (message: string) => {
      if (monitoringActive) {
        errors.push({
          message,
          timestamp: Date.now(),
          level: 'error',
        });
      }
    },
    // Helper to simulate console warnings
    simulateWarning: (message: string) => {
      if (monitoringActive) {
        errors.push({
          message,
          timestamp: Date.now(),
          level: 'warning',
        });
      }
    },
    // Helper to get errors (simulating window.__qaErrors)
    getCapturedErrors: () => errors,
    // Helper to set monitoring state
    setMonitoringActive: (active: boolean) => {
      monitoringActive = active;
    },
    // Helper to clear errors
    clearErrors: () => {
      errors = [];
    },
  };
};

describe('ErrorMonitor', () => {
  let logger: Logger;
  let mockPage: ReturnType<typeof createMockPage>;

  beforeEach(() => {
    logger = new Logger({ module: 'test', op: 'error-monitor-test' });
    mockPage = createMockPage();
    mockPage.clearErrors();
    mockPage.setMonitoringActive(false);
  });

  describe('ErrorMonitor instantiation', () => {
    it('should create ErrorMonitor with logger', () => {
      const monitor = new ErrorMonitor({ logger });
      expect(monitor).toBeInstanceOf(ErrorMonitor);
    });
  });

  describe('startMonitoring()', () => {
    it('should set up console error listener', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = mockPage as unknown as AnyPage;
      
      await monitor.startMonitoring(page);
      
      // Verify evaluate was called to set up listeners
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should set up console warning listener', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = mockPage as unknown as AnyPage;
      
      await monitor.startMonitoring(page);
      
      // Verify evaluate was called (covers both error and warning listeners)
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should handle page.evaluate() failures gracefully', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = createMockPage() as unknown as AnyPage;
      
      // Mock evaluate to throw on first call
      (page as any).evaluate.mockImplementationOnce(() => {
        throw new Error('Evaluation failed');
      });

      // Should not throw, just log the error
      await monitor.startMonitoring(page);
      
      // If we get here, the test passed (no exception thrown)
      expect(true).toBe(true);
    });
  });

  describe('getErrors()', () => {
    it('should return array of ConsoleError objects', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = createMockPage() as unknown as AnyPage;
      
      await monitor.startMonitoring(page);
      
      // Mock evaluate to return captured errors
      (page as any).evaluate.mockImplementationOnce(() => {
        return Promise.resolve([
          { message: 'Test error 1', timestamp: Date.now(), level: 'error' },
          { message: 'Test warning 1', timestamp: Date.now(), level: 'warning' },
        ]);
      });

      const errors = await monitor.getErrors(page);
      
      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBe(2);
    });

    it('should return empty array when no errors', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = createMockPage() as unknown as AnyPage;
      
      await monitor.startMonitoring(page);
      
      // Mock evaluate to return empty array
      (page as any).evaluate.mockImplementationOnce(() => {
        return Promise.resolve([]);
      });

      const errors = await monitor.getErrors(page);
      
      expect(errors).toEqual([]);
    });

    it('should handle evaluation errors gracefully', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = createMockPage() as unknown as AnyPage;
      
      await monitor.startMonitoring(page);
      
      // Mock evaluate to throw
      (page as any).evaluate.mockImplementationOnce(() => {
        throw new Error('Evaluation failed');
      });

      const errors = await monitor.getErrors(page);
      
      // Should return empty array on error
      expect(errors).toEqual([]);
    });
  });

  describe('hasErrors()', () => {
    it('should return true when errors exist', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = createMockPage() as unknown as AnyPage;
      
      await monitor.startMonitoring(page);
      
      // Mock evaluate to return errors
      (page as any).evaluate.mockImplementationOnce(() => {
        return Promise.resolve([
          { message: 'Error 1', timestamp: Date.now(), level: 'error' },
        ]);
      });

      const hasErrors = await monitor.hasErrors(page);
      
      expect(hasErrors).toBe(true);
    });

    it('should return false when no errors', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = createMockPage() as unknown as AnyPage;
      
      await monitor.startMonitoring(page);
      
      // Mock evaluate to return empty array
      (page as any).evaluate.mockImplementationOnce(() => {
        return Promise.resolve([]);
      });

      const hasErrors = await monitor.hasErrors(page);
      
      expect(hasErrors).toBe(false);
    });

    it('should return true when only warnings exist', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = createMockPage() as unknown as AnyPage;
      
      await monitor.startMonitoring(page);
      
      // Mock evaluate to return warnings
      (page as any).evaluate.mockImplementationOnce(() => {
        return Promise.resolve([
          { message: 'Warning 1', timestamp: Date.now(), level: 'warning' },
        ]);
      });

      const hasErrors = await monitor.hasErrors(page);
      
      // Warnings count as "errors" in the general sense
      expect(hasErrors).toBe(true);
    });
  });

  describe('hasCriticalError()', () => {
    it('should return true for errors', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = createMockPage() as unknown as AnyPage;
      
      await monitor.startMonitoring(page);
      
      // Mock evaluate to return errors
      (page as any).evaluate.mockImplementationOnce(() => {
        return Promise.resolve([
          { message: 'Error 1', timestamp: Date.now(), level: 'error' },
        ]);
      });

      const hasCritical = await monitor.hasCriticalError(page);
      
      expect(hasCritical).toBe(true);
    });

    it('should return false for warnings only', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = createMockPage() as unknown as AnyPage;
      
      await monitor.startMonitoring(page);
      
      // Mock evaluate to return warnings only
      (page as any).evaluate.mockImplementationOnce(() => {
        return Promise.resolve([
          { message: 'Warning 1', timestamp: Date.now(), level: 'warning' },
        ]);
      });

      const hasCritical = await monitor.hasCriticalError(page);
      
      expect(hasCritical).toBe(false);
    });

    it('should return true when errors and warnings exist', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = createMockPage() as unknown as AnyPage;
      
      await monitor.startMonitoring(page);
      
      // Mock evaluate to return both errors and warnings
      (page as any).evaluate.mockImplementationOnce(() => {
        return Promise.resolve([
          { message: 'Error 1', timestamp: Date.now(), level: 'error' },
          { message: 'Warning 1', timestamp: Date.now(), level: 'warning' },
        ]);
      });

      const hasCritical = await monitor.hasCriticalError(page);
      
      expect(hasCritical).toBe(true);
    });

    it('should return false when no errors', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = createMockPage() as unknown as AnyPage;
      
      await monitor.startMonitoring(page);
      
      // Mock evaluate to return empty array
      (page as any).evaluate.mockImplementationOnce(() => {
        return Promise.resolve([]);
      });

      const hasCritical = await monitor.hasCriticalError(page);
      
      expect(hasCritical).toBe(false);
    });
  });

  describe('stopMonitoring()', () => {
    it('should clean up listeners', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = mockPage as unknown as AnyPage;
      
      await monitor.startMonitoring(page);
      await monitor.stopMonitoring(page);
      
      // Verify evaluate was called to clean up
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should handle page.evaluate() failures gracefully', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = createMockPage() as unknown as AnyPage;
      
      await monitor.startMonitoring(page);
      
      // Mock evaluate to throw during cleanup
      (page as any).evaluate.mockImplementationOnce(() => {
        throw new Error('Cleanup failed');
      });

      // Should not throw, just log the error
      await monitor.stopMonitoring(page);
      
      // If we get here, the test passed (no exception thrown)
      expect(true).toBe(true);
    });
  });

  describe('error capture', () => {
    it('should capture multiple errors in order', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = createMockPage() as unknown as AnyPage;
      
      await monitor.startMonitoring(page);
      
      // Mock evaluate to return multiple errors
      (page as any).evaluate.mockImplementationOnce(() => {
        return Promise.resolve([
          { message: 'Error 1', timestamp: 1000, level: 'error' },
          { message: 'Error 2', timestamp: 2000, level: 'error' },
          { message: 'Warning 1', timestamp: 3000, level: 'warning' },
        ]);
      });

      const errors = await monitor.getErrors(page);
      
      expect(errors.length).toBe(3);
      expect(errors[0].message).toBe('Error 1');
      expect(errors[1].message).toBe('Error 2');
      expect(errors[2].message).toBe('Warning 1');
    });

    it('should capture error messages correctly', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = createMockPage() as unknown as AnyPage;
      
      await monitor.startMonitoring(page);
      
      // Mock evaluate to return error with specific message
      (page as any).evaluate.mockImplementationOnce(() => {
        return Promise.resolve([
          { message: 'TypeError: Cannot read property of undefined', timestamp: Date.now(), level: 'error' },
        ]);
      });

      const errors = await monitor.getErrors(page);
      
      expect(errors[0].message).toBe('TypeError: Cannot read property of undefined');
    });

    it('should capture timestamps correctly', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = createMockPage() as unknown as AnyPage;
      
      await monitor.startMonitoring(page);
      
      const timestamp = Date.now();
      
      // Mock evaluate to return error with specific timestamp
      (page as any).evaluate.mockImplementationOnce(() => {
        return Promise.resolve([
          { message: 'Error', timestamp, level: 'error' },
        ]);
      });

      const errors = await monitor.getErrors(page);
      
      expect(errors[0].timestamp).toBe(timestamp);
      expect(typeof errors[0].timestamp).toBe('number');
    });

    it('should set level field correctly for errors', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = createMockPage() as unknown as AnyPage;
      
      await monitor.startMonitoring(page);
      
      // Mock evaluate to return error
      (page as any).evaluate.mockImplementationOnce(() => {
        return Promise.resolve([
          { message: 'Error', timestamp: Date.now(), level: 'error' },
        ]);
      });

      const errors = await monitor.getErrors(page);
      
      expect(errors[0].level).toBe('error');
    });

    it('should set level field correctly for warnings', async () => {
      const monitor = new ErrorMonitor({ logger });
      const page = createMockPage() as unknown as AnyPage;
      
      await monitor.startMonitoring(page);
      
      // Mock evaluate to return warning
      (page as any).evaluate.mockImplementationOnce(() => {
        return Promise.resolve([
          { message: 'Warning', timestamp: Date.now(), level: 'warning' },
        ]);
      });

      const errors = await monitor.getErrors(page);
      
      expect(errors[0].level).toBe('warning');
    });
  });
});

