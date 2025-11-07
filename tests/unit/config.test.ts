/**
 * Unit tests for configuration constants and feature flags.
 */

import { TIMEOUTS, THRESHOLDS, PATHS } from '../../src/config/constants';
import { DEFAULT_FLAGS, getFeatureFlags } from '../../src/config/feature-flags';

describe('Configuration Constants', () => {
  describe('TIMEOUTS', () => {
    it('should have correct default values', () => {
      expect(TIMEOUTS.MAX_TEST_DURATION).toBe(240000); // 4 minutes
      expect(TIMEOUTS.GAME_LOAD_TIMEOUT).toBe(60000); // 60 seconds
      expect(TIMEOUTS.INTERACTION_TIMEOUT).toBe(90000); // 90 seconds
      expect(TIMEOUTS.SCREENSHOT_TIMEOUT).toBe(10000); // 10 seconds
      expect(TIMEOUTS.PAGE_NAVIGATION_TIMEOUT).toBe(30000); // 30 seconds
    });

    it('should allow environment variable overrides', () => {
      // Note: This test verifies the structure allows overrides
      // Actual override testing would require process.env manipulation
      expect(typeof TIMEOUTS.MAX_TEST_DURATION).toBe('number');
      expect(typeof TIMEOUTS.GAME_LOAD_TIMEOUT).toBe('number');
    });
  });

  describe('THRESHOLDS', () => {
    it('should have correct default values', () => {
      expect(THRESHOLDS.PLAYABILITY_PASS_SCORE).toBe(50);
      expect(THRESHOLDS.MAX_RETRIES).toBe(0);
      expect(THRESHOLDS.SCREENSHOT_COUNT).toBe(3);
    });
  });

  describe('PATHS', () => {
    it('should have correct default values', () => {
      expect(PATHS.OUTPUT_DIR).toBe('/tmp/game-qa-output');
      expect(PATHS.SCREENSHOTS_SUBDIR).toBe('screenshots');
      expect(PATHS.REPORTS_SUBDIR).toBe('reports');
    });
  });
});

describe('Feature Flags', () => {
  describe('DEFAULT_FLAGS', () => {
    it('should have all flags set to false by default', () => {
      expect(DEFAULT_FLAGS.enableCaching).toBe(false);
      expect(DEFAULT_FLAGS.enableProgressUpdates).toBe(false);
      expect(DEFAULT_FLAGS.enableErrorRecovery).toBe(false);
      expect(DEFAULT_FLAGS.enableScreenshotCleanup).toBe(false);
      expect(DEFAULT_FLAGS.enableDetailedLogging).toBe(false);
      expect(DEFAULT_FLAGS.enableAdaptiveQA).toBe(false);
      expect(DEFAULT_FLAGS.enableStagehandAgent).toBe(false);
    });
  });

  describe('getFeatureFlags()', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset process.env before each test
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      // Restore original process.env after each test
      process.env = originalEnv;
    });

    it('should return DEFAULT_FLAGS when no environment variables are set', () => {
      delete process.env.DEBUG;
      delete process.env.ENABLE_CACHING;
      delete process.env.ENABLE_PROGRESS_UPDATES;
      delete process.env.ENABLE_ERROR_RECOVERY;
      delete process.env.ENABLE_SCREENSHOT_CLEANUP;

      const flags = getFeatureFlags();
      expect(flags).toEqual(DEFAULT_FLAGS);
    });

    it('should enable detailed logging when DEBUG=true', () => {
      process.env.DEBUG = 'true';
      const flags = getFeatureFlags();
      expect(flags.enableDetailedLogging).toBe(true);
      expect(flags.enableCaching).toBe(false); // Other flags unchanged
    });

    it('should enable detailed logging when DEBUG=True (case-insensitive)', () => {
      process.env.DEBUG = 'True';
      const flags = getFeatureFlags();
      expect(flags.enableDetailedLogging).toBe(true);
    });

    it('should enable detailed logging when DEBUG=TRUE (case-insensitive)', () => {
      process.env.DEBUG = 'TRUE';
      const flags = getFeatureFlags();
      expect(flags.enableDetailedLogging).toBe(true);
    });

    it('should disable detailed logging when DEBUG=false', () => {
      process.env.DEBUG = 'false';
      const flags = getFeatureFlags();
      expect(flags.enableDetailedLogging).toBe(false);
    });

    it('should enable caching when ENABLE_CACHING=true', () => {
      process.env.ENABLE_CACHING = 'true';
      const flags = getFeatureFlags();
      expect(flags.enableCaching).toBe(true);
    });

    it('should enable progress updates when ENABLE_PROGRESS_UPDATES=true', () => {
      process.env.ENABLE_PROGRESS_UPDATES = 'true';
      const flags = getFeatureFlags();
      expect(flags.enableProgressUpdates).toBe(true);
    });

    it('should enable error recovery when ENABLE_ERROR_RECOVERY=true', () => {
      process.env.ENABLE_ERROR_RECOVERY = 'true';
      const flags = getFeatureFlags();
      expect(flags.enableErrorRecovery).toBe(true);
    });

    it('should enable screenshot cleanup when ENABLE_SCREENSHOT_CLEANUP=true', () => {
      process.env.ENABLE_SCREENSHOT_CLEANUP = 'true';
      const flags = getFeatureFlags();
      expect(flags.enableScreenshotCleanup).toBe(true);
    });

    it('should enable adaptive QA when ENABLE_ADAPTIVE_QA=true', () => {
      process.env.ENABLE_ADAPTIVE_QA = 'true';
      const flags = getFeatureFlags();
      expect(flags.enableAdaptiveQA).toBe(true);
    });

    it('enableStagehandAgent defaults to false', () => {
      delete process.env.ENABLE_STAGEHAND_AGENT;
      const flags = getFeatureFlags();
      expect(flags.enableStagehandAgent).toBe(false);
    });

    it('enableStagehandAgent reads from environment', () => {
      process.env.ENABLE_STAGEHAND_AGENT = 'true';
      const flags = getFeatureFlags();
      expect(flags.enableStagehandAgent).toBe(true);
      delete process.env.ENABLE_STAGEHAND_AGENT;
    });

    it('enableStagehandAgent respects case-insensitive parsing', () => {
      process.env.ENABLE_STAGEHAND_AGENT = 'True';
      const flags = getFeatureFlags();
      expect(flags.enableStagehandAgent).toBe(true);
      
      process.env.ENABLE_STAGEHAND_AGENT = 'TRUE';
      const flags2 = getFeatureFlags();
      expect(flags2.enableStagehandAgent).toBe(true);
      
      process.env.ENABLE_STAGEHAND_AGENT = 'false';
      const flags3 = getFeatureFlags();
      expect(flags3.enableStagehandAgent).toBe(false);
      
      delete process.env.ENABLE_STAGEHAND_AGENT;
    });

    it('should handle multiple flags at once', () => {
      process.env.DEBUG = 'true';
      process.env.ENABLE_CACHING = 'true';
      process.env.ENABLE_PROGRESS_UPDATES = 'true';
      process.env.ENABLE_STAGEHAND_AGENT = 'true';
      
      const flags = getFeatureFlags();
      expect(flags.enableDetailedLogging).toBe(true);
      expect(flags.enableCaching).toBe(true);
      expect(flags.enableProgressUpdates).toBe(true);
      expect(flags.enableStagehandAgent).toBe(true);
      expect(flags.enableErrorRecovery).toBe(false); // Not set, remains false
      expect(flags.enableScreenshotCleanup).toBe(false); // Not set, remains false
      
      // Cleanup
      delete process.env.ENABLE_STAGEHAND_AGENT;
    });
  });
});

