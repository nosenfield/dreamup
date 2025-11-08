/**
 * Unit tests for Logger utility.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { Logger, LogLevel, TestPhase } from '../../src/utils/logger';
import { getFeatureFlags } from '../../src/config/feature-flags';

describe('Logger', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalConsoleLog: typeof console.log;

  beforeEach(() => {
    // Save original environment and console.log
    originalEnv = { ...process.env };
    originalConsoleLog = console.log;
    
    // Mock console.log to capture log output
    console.log = mock(() => {});
  });

  afterEach(() => {
    // Restore original environment and console.log
    process.env = originalEnv;
    console.log = originalConsoleLog;
  });

  describe('Logger instantiation', () => {
    it('should create logger with context', () => {
      const logger = new Logger({
        module: 'test-module',
        op: 'testOperation',
        correlationId: 'test-correlation-id',
      });

      expect(logger).toBeInstanceOf(Logger);
    });

    it('should create logger without context', () => {
      const logger = new Logger();
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should create logger with partial context', () => {
      const logger = new Logger({
        module: 'test-module',
      });
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe('info() method', () => {
    it('should output structured JSON log', () => {
      const logger = new Logger({
        module: 'test-module',
        op: 'testOp',
        correlationId: 'test-id',
      });

      logger.info('Test message');

      expect(console.log).toHaveBeenCalled();
      const logCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.level).toBe('info');
      expect(logEntry.module).toBe('test-module');
      expect(logEntry.op).toBe('testOp');
      expect(logEntry.correlationId).toBe('test-id');
      expect(logEntry.msg).toBe('Test message');
      expect(logEntry.ts).toBeDefined();
      expect(typeof logEntry.ts).toBe('string');
    });

    it('should include optional data field', () => {
      const logger = new Logger({
        module: 'test-module',
        op: 'testOp',
        correlationId: 'test-id',
      });

      const testData = { userId: '123', action: 'login' };
      logger.info('Test message', testData);

      const logCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.data).toEqual(testData);
    });

    it('should work without context', () => {
      const logger = new Logger();
      logger.info('Test message');

      const logCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.level).toBe('info');
      expect(logEntry.msg).toBe('Test message');
      expect(logEntry.module).toBeUndefined();
      expect(logEntry.op).toBeUndefined();
      expect(logEntry.correlationId).toBeUndefined();
    });
  });

  describe('warn() method', () => {
    it('should output structured JSON log with warn level', () => {
      const logger = new Logger({
        module: 'test-module',
        op: 'testOp',
        correlationId: 'test-id',
      });

      logger.warn('Warning message');

      const logCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.level).toBe('warn');
      expect(logEntry.msg).toBe('Warning message');
    });

    it('should include optional data field', () => {
      const logger = new Logger();
      const testData = { retryCount: 3 };
      logger.warn('Warning message', testData);

      const logCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.data).toEqual(testData);
    });
  });

  describe('error() method', () => {
    it('should output structured JSON log with error level', () => {
      const logger = new Logger({
        module: 'test-module',
        op: 'testOp',
        correlationId: 'test-id',
      });

      logger.error('Error message');

      const logCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.level).toBe('error');
      expect(logEntry.msg).toBe('Error message');
    });

    it('should include error object when provided', () => {
      const logger = new Logger();
      const testError = new Error('Test error');
      testError.stack = 'Error: Test error\n    at test.js:1:1';

      logger.error('Error message', undefined, testError);

      const logCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.error).toBeDefined();
      expect(logEntry.error.name).toBe('Error');
      expect(logEntry.error.message).toBe('Test error');
      expect(logEntry.error.stack).toBe(testError.stack);
    });

    it('should include both data and error', () => {
      const logger = new Logger();
      const testData = { userId: '123' };
      const testError = new Error('Test error');

      logger.error('Error message', testData, testError);

      const logCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.data).toEqual(testData);
      expect(logEntry.error).toBeDefined();
      expect(logEntry.error.message).toBe('Test error');
    });
  });

  describe('debug() method', () => {
    beforeEach(() => {
      // Reset environment before each test
      process.env = { ...originalEnv };
    });

    it('should log when enableDetailedLogging is true', () => {
      process.env.DEBUG = 'true';
      const flags = getFeatureFlags();
      const logger = new Logger(undefined, flags);

      logger.debug('Debug message');

      expect(console.log).toHaveBeenCalled();
      const logCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.level).toBe('debug');
      expect(logEntry.msg).toBe('Debug message');
    });

    it('should not log when enableDetailedLogging is false', () => {
      process.env.DEBUG = 'false';
      const flags = getFeatureFlags();
      const logger = new Logger(undefined, flags);

      logger.debug('Debug message');

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should not log when DEBUG env var is not set', () => {
      delete process.env.DEBUG;
      const flags = getFeatureFlags();
      const logger = new Logger(undefined, flags);

      logger.debug('Debug message');

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should include optional data field when logging', () => {
      process.env.DEBUG = 'true';
      const flags = getFeatureFlags();
      const logger = new Logger(undefined, flags);
      const testData = { debugInfo: 'test' };

      logger.debug('Debug message', testData);

      const logCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.data).toEqual(testData);
    });
  });

  describe('Log entry format', () => {
    it('should include ISO8601 timestamp', () => {
      const logger = new Logger();
      logger.info('Test message');

      const logCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      // Check ISO8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
      expect(logEntry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      
      // Verify it's a valid date
      const date = new Date(logEntry.ts);
      expect(date.toISOString()).toBe(logEntry.ts);
    });

    it('should include all required fields', () => {
      const logger = new Logger({
        module: 'test-module',
        op: 'testOp',
        correlationId: 'test-id',
      });

      logger.info('Test message');

      const logCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.ts).toBeDefined();
      expect(logEntry.level).toBeDefined();
      expect(logEntry.module).toBeDefined();
      expect(logEntry.op).toBeDefined();
      expect(logEntry.correlationId).toBeDefined();
      expect(logEntry.msg).toBeDefined();
    });

    it('should output valid JSON string', () => {
      const logger = new Logger();
      logger.info('Test message');

      const logCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      
      // Should be a string
      expect(typeof logCall).toBe('string');
      
      // Should be parseable JSON
      expect(() => JSON.parse(logCall)).not.toThrow();
      
      const logEntry = JSON.parse(logCall);
      expect(logEntry).toBeInstanceOf(Object);
    });
  });

  describe('LogLevel enum', () => {
    it('should export LogLevel enum with correct values', () => {
      expect(LogLevel.TRACE).toBe(LogLevel.TRACE);
      expect(LogLevel.DEBUG).toBe(LogLevel.DEBUG);
      expect(LogLevel.INFO).toBe(LogLevel.INFO);
      expect(LogLevel.WARN).toBe(LogLevel.WARN);
      expect(LogLevel.ERROR).toBe(LogLevel.ERROR);
      expect(LogLevel.FATAL).toBe(LogLevel.FATAL);
    });

    it('should have correct string values', () => {
      expect(String(LogLevel.TRACE)).toBe('trace');
      expect(String(LogLevel.DEBUG)).toBe('debug');
      expect(String(LogLevel.INFO)).toBe('info');
      expect(String(LogLevel.WARN)).toBe('warn');
      expect(String(LogLevel.ERROR)).toBe('error');
      expect(String(LogLevel.FATAL)).toBe('fatal');
    });
  });

  describe('TestPhase enum', () => {
    it('should export TestPhase enum with all required phases', () => {
      expect(TestPhase.INITIALIZATION).toBe('initialization');
      expect(TestPhase.NAVIGATION).toBe('navigation');
      expect(TestPhase.GAME_DETECTION).toBe('game_detection');
      expect(TestPhase.START_BUTTON_DETECTION).toBe('start_button_detection');
      expect(TestPhase.GAMEPLAY_SIMULATION).toBe('gameplay_simulation');
      expect(TestPhase.ADAPTIVE_QA_LOOP).toBe('adaptive_qa_loop');
      expect(TestPhase.VISION_ANALYSIS).toBe('vision_analysis');
      expect(TestPhase.SCREENSHOT_CAPTURE).toBe('screenshot_capture');
      expect(TestPhase.CLEANUP).toBe('cleanup');
    });
  });

  describe('beginPhase() method', () => {
    it('should output phase banner with correct format', () => {
      const logger = new Logger();
      logger.beginPhase(TestPhase.START_BUTTON_DETECTION);

      expect(console.log).toHaveBeenCalled();
      const calls = (console.log as ReturnType<typeof mock>).mock.calls;
      
      // Should have 3 calls: banner start, phase details (if any), banner end
      expect(calls.length).toBeGreaterThanOrEqual(1);
      
      // First call should be the banner
      const banner = calls[0][0];
      expect(typeof banner).toBe('string');
      expect(banner).toContain('BEGIN');
      expect(banner).toContain('START BUTTON DETECTION');
      expect(banner).toContain('=');
    });

    it('should include phase details when provided', () => {
      const logger = new Logger();
      logger.beginPhase(TestPhase.START_BUTTON_DETECTION, {
        strategies: ['dom', 'natural_language'],
        timeout: 90000,
      });

      const calls = (console.log as ReturnType<typeof mock>).mock.calls;
      expect(calls.length).toBeGreaterThan(1);
      
      // Find the phase details log entry
      const detailsCall = calls.find(call => {
        try {
          const entry = JSON.parse(call[0]);
          return entry.msg && entry.msg.includes('Phase details');
        } catch {
          return false;
        }
      });
      
      expect(detailsCall).toBeDefined();
      const entry = JSON.parse(detailsCall![0]);
      expect(entry.data).toBeDefined();
      expect(entry.data.strategies).toEqual(['dom', 'natural_language']);
      expect(entry.data.timeout).toBe(90000);
    });
  });

  describe('endPhase() method', () => {
    it('should output phase end banner with correct format', () => {
      const logger = new Logger();
      logger.endPhase(TestPhase.START_BUTTON_DETECTION);

      expect(console.log).toHaveBeenCalled();
      const calls = (console.log as ReturnType<typeof mock>).mock.calls;
      
      const banner = calls[calls.length - 1][0];
      expect(typeof banner).toBe('string');
      expect(banner).toContain('END');
      expect(banner).toContain('START BUTTON DETECTION');
      expect(banner).toContain('=');
    });

    it('should include phase summary when provided', () => {
      const logger = new Logger();
      logger.endPhase(TestPhase.START_BUTTON_DETECTION, {
        success: true,
        strategy: 'dom',
        totalAttempts: 12,
        totalDuration: 234,
      });

      const calls = (console.log as ReturnType<typeof mock>).mock.calls;
      
      // Find the phase summary log entry
      const summaryCall = calls.find(call => {
        try {
          const entry = JSON.parse(call[0]);
          return entry.msg && entry.msg.includes('Phase summary');
        } catch {
          return false;
        }
      });
      
      expect(summaryCall).toBeDefined();
      const entry = JSON.parse(summaryCall![0]);
      expect(entry.data).toBeDefined();
      expect(entry.data.success).toBe(true);
      expect(entry.data.strategy).toBe('dom');
      expect(entry.data.totalAttempts).toBe(12);
    });
  });

  describe('action() method', () => {
    it('should format click actions correctly', () => {
      const logger = new Logger();
      logger.action('click', {
        x: 512,
        y: 384,
        target: 'Start button',
        strategy: 'dom',
      });

      expect(console.log).toHaveBeenCalled();
      const logCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.msg).toContain('ACTION: click');
      expect(logEntry.data).toBeDefined();
      expect(logEntry.data.coordinates).toBe('(512, 384)');
      expect(logEntry.data.target).toBe('Start button');
      expect(logEntry.data.strategy).toBe('dom');
    });

    it('should format keypress actions correctly', () => {
      const logger = new Logger();
      logger.action('keypress', {
        key: 'ArrowUp',
        duration: 100,
      });

      expect(console.log).toHaveBeenCalled();
      const logCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.msg).toContain('ACTION: keypress');
      expect(logEntry.data).toBeDefined();
      expect(logEntry.data.key).toBe('ArrowUp');
      expect(logEntry.data.duration).toBe(100);
    });

    it('should format screenshot actions correctly', () => {
      const logger = new Logger();
      logger.action('screenshot', {
        stage: 'initial_load',
        path: '/tmp/screenshot.png',
        timing: 'before_start_button',
      });

      expect(console.log).toHaveBeenCalled();
      const logCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.msg).toContain('ACTION: screenshot');
      expect(logEntry.data).toBeDefined();
      expect(logEntry.data.stage).toBe('initial_load');
      expect(logEntry.data.path).toBe('/tmp/screenshot.png');
      expect(logEntry.data.timing).toBe('before_start_button');
    });

    it('should handle unknown action types with default formatting', () => {
      const logger = new Logger();
      logger.action('unknown_action', {
        customField: 'customValue',
      });

      expect(console.log).toHaveBeenCalled();
      const logCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);

      expect(logEntry.msg).toContain('ACTION: unknown_action');
      expect(logEntry.data).toBeDefined();
      expect(logEntry.data.customField).toBe('customValue');
    });
  });

  describe('Level-based logging with LOG_LEVEL', () => {
    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    it('should always log ERROR level regardless of LOG_LEVEL', () => {
      process.env.LOG_LEVEL = 'error';
      const logger = new Logger();
      
      logger.error('Error message');
      expect(console.log).toHaveBeenCalled();
      
      (console.log as ReturnType<typeof mock>).mockClear();
      logger.warn('Warn message');
      expect(console.log).not.toHaveBeenCalled();
      
      logger.info('Info message');
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should log WARN and ERROR when LOG_LEVEL=warn', () => {
      process.env.LOG_LEVEL = 'warn';
      const logger = new Logger();
      
      logger.error('Error message');
      expect(console.log).toHaveBeenCalled();
      
      (console.log as ReturnType<typeof mock>).mockClear();
      logger.warn('Warn message');
      expect(console.log).toHaveBeenCalled();
      
      (console.log as ReturnType<typeof mock>).mockClear();
      logger.info('Info message');
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should log INFO, WARN, and ERROR when LOG_LEVEL=info', () => {
      process.env.LOG_LEVEL = 'info';
      const logger = new Logger();
      
      logger.info('Info message');
      expect(console.log).toHaveBeenCalled();
      
      (console.log as ReturnType<typeof mock>).mockClear();
      logger.warn('Warn message');
      expect(console.log).toHaveBeenCalled();
      
      (console.log as ReturnType<typeof mock>).mockClear();
      logger.error('Error message');
      expect(console.log).toHaveBeenCalled();
    });

    it('should log DEBUG when LOG_LEVEL=debug', () => {
      process.env.LOG_LEVEL = 'debug';
      const logger = new Logger();
      
      logger.debug('Debug message');
      expect(console.log).toHaveBeenCalled();
    });

    it('should log TRACE when LOG_LEVEL=trace', () => {
      process.env.LOG_LEVEL = 'trace';
      const logger = new Logger();
      
      logger.trace('Trace message');
      expect(console.log).toHaveBeenCalled();
    });

    it('should default to INFO level when LOG_LEVEL not set', () => {
      delete process.env.LOG_LEVEL;
      delete process.env.DEBUG;
      const flags = getFeatureFlags();
      const logger = new Logger(undefined, flags);
      
      logger.info('Info message');
      expect(console.log).toHaveBeenCalled();
      
      (console.log as ReturnType<typeof mock>).mockClear();
      logger.debug('Debug message');
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should respect DEBUG flag for backward compatibility', () => {
      process.env.DEBUG = 'true';
      delete process.env.LOG_LEVEL;
      const flags = getFeatureFlags();
      const logger = new Logger(undefined, flags);
      
      logger.debug('Debug message');
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('trace() method', () => {
    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    it('should log when LOG_LEVEL=trace', () => {
      process.env.LOG_LEVEL = 'trace';
      const logger = new Logger();
      
      logger.trace('Trace message');
      expect(console.log).toHaveBeenCalled();
      
      const logCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.level).toBe('trace');
      expect(logEntry.msg).toBe('Trace message');
    });

    it('should not log when LOG_LEVEL=info', () => {
      process.env.LOG_LEVEL = 'info';
      const logger = new Logger();
      
      logger.trace('Trace message');
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('iteration() method', () => {
    beforeEach(() => {
      process.env = { ...originalEnv };
      (console.log as ReturnType<typeof mock>).mockClear();
    });

    it('should output iteration banner with plain text', () => {
      const logger = new Logger();
      
      logger.iteration(1, 10);
      
      expect(console.log).toHaveBeenCalled();
      const bannerCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      expect(bannerCall).toContain('--- Iteration 1/10 ---');
      expect(bannerCall).toContain('-'.repeat(60));
    });

    it('should include iteration details when provided', () => {
      const logger = new Logger();
      
      logger.iteration(2, 5, {
        elapsed: 1000,
        actionsPerformed: 3,
        screenshotsCaptured: 4,
      });
      
      expect(console.log).toHaveBeenCalledTimes(2); // Banner + details
      const bannerCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      expect(bannerCall).toContain('--- Iteration 2/5 ---');
      
      const detailsCall = (console.log as ReturnType<typeof mock>).mock.calls[1][0];
      const detailsEntry = JSON.parse(detailsCall);
      expect(detailsEntry.msg).toBe('Iteration details');
      expect(detailsEntry.data.elapsed).toBe(1000);
      expect(detailsEntry.data.actionsPerformed).toBe(3);
      expect(detailsEntry.data.screenshotsCaptured).toBe(4);
    });

    it('should not include details when not provided', () => {
      const logger = new Logger();
      
      logger.iteration(3, 8);
      
      expect(console.log).toHaveBeenCalledTimes(1); // Only banner
      const bannerCall = (console.log as ReturnType<typeof mock>).mock.calls[0][0];
      expect(bannerCall).toContain('--- Iteration 3/8 ---');
    });
  });
});

