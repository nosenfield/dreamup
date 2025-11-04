/**
 * Unit tests for Logger utility.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { Logger, LogLevel } from '../../src/utils/logger';
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
      expect(LogLevel.TRACE).toBe('trace');
      expect(LogLevel.DEBUG).toBe('debug');
      expect(LogLevel.INFO).toBe('info');
      expect(LogLevel.WARN).toBe('warn');
      expect(LogLevel.ERROR).toBe('error');
      expect(LogLevel.FATAL).toBe('fatal');
    });
  });
});

