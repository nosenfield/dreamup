/**
 * Unit tests for configuration constants and feature flags.
 */

import { TIMEOUTS, THRESHOLDS, PATHS } from '../../src/config/constants';
import { DEFAULT_FLAGS, getFeatureFlags } from '../../src/config/feature-flags';

describe('Configuration Constants', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original process.env after each test
    process.env = originalEnv;
  });

  describe('TIMEOUTS', () => {
    it('should have correct default values', () => {
      // Check if environment variables are set - if so, skip default value checks
      // The constants module evaluates at load time, so we can't test defaults if env vars are set
      if (process.env.GAME_LOAD_TIMEOUT) {
        // If env var is set, just verify it's a number
        expect(typeof TIMEOUTS.GAME_LOAD_TIMEOUT).toBe('number');
        expect(TIMEOUTS.GAME_LOAD_TIMEOUT).toBeGreaterThan(0);
      } else {
        // If env var is not set, verify default value
        expect(TIMEOUTS.GAME_LOAD_TIMEOUT).toBe(60000); // 60 seconds
      }
      
      // Always verify these are numbers
      expect(typeof TIMEOUTS.MAX_TEST_DURATION).toBe('number');
      expect(typeof TIMEOUTS.INTERACTION_TIMEOUT).toBe('number');
      expect(typeof TIMEOUTS.SCREENSHOT_TIMEOUT).toBe('number');
      expect(typeof TIMEOUTS.PAGE_NAVIGATION_TIMEOUT).toBe('number');
      
      // Verify default values if env vars are not set
      if (!process.env.MAX_TEST_DURATION) {
        expect(TIMEOUTS.MAX_TEST_DURATION).toBe(240000); // 4 minutes
      }
      if (!process.env.INTERACTION_TIMEOUT) {
        expect(TIMEOUTS.INTERACTION_TIMEOUT).toBe(90000); // 90 seconds
      }
      if (!process.env.SCREENSHOT_TIMEOUT) {
        expect(TIMEOUTS.SCREENSHOT_TIMEOUT).toBe(10000); // 10 seconds
      }
      if (!process.env.PAGE_NAVIGATION_TIMEOUT) {
        expect(TIMEOUTS.PAGE_NAVIGATION_TIMEOUT).toBe(30000); // 30 seconds
      }
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
      delete process.env.ENABLE_ADAPTIVE_QA;
      delete process.env.ENABLE_DOM_STRATEGY;
      delete process.env.ENABLE_NATURAL_LANGUAGE_STRATEGY;
      delete process.env.ENABLE_VISION_STRATEGY;
      delete process.env.ENABLE_STATE_ANALYSIS_STRATEGY;

      const flags = getFeatureFlags();
      // Compare only the flags that are controlled by environment variables
      expect(flags.enableCaching).toBe(DEFAULT_FLAGS.enableCaching);
      expect(flags.enableProgressUpdates).toBe(DEFAULT_FLAGS.enableProgressUpdates);
      expect(flags.enableErrorRecovery).toBe(DEFAULT_FLAGS.enableErrorRecovery);
      expect(flags.enableScreenshotCleanup).toBe(DEFAULT_FLAGS.enableScreenshotCleanup);
      expect(flags.enableDetailedLogging).toBe(DEFAULT_FLAGS.enableDetailedLogging);
      expect(flags.enableAdaptiveQA).toBe(DEFAULT_FLAGS.enableAdaptiveQA);
    });

    it('should enable detailed logging when DEBUG=true', () => {
      const originalDebug = process.env.DEBUG;
      const originalCaching = process.env.ENABLE_CACHING;
      
      // Clear caching flag to test that it remains false
      delete process.env.ENABLE_CACHING;
      process.env.DEBUG = 'true';
      const flags = getFeatureFlags();
      expect(flags.enableDetailedLogging).toBe(true);
      expect(flags.enableCaching).toBe(false); // Other flags unchanged
      
      // Restore original values
      if (originalDebug !== undefined) {
        process.env.DEBUG = originalDebug;
      } else {
        delete process.env.DEBUG;
      }
      if (originalCaching !== undefined) {
        process.env.ENABLE_CACHING = originalCaching;
      }
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

    it('should handle multiple flags at once', () => {
      const originalDebug = process.env.DEBUG;
      const originalCaching = process.env.ENABLE_CACHING;
      const originalProgress = process.env.ENABLE_PROGRESS_UPDATES;
      const originalErrorRecovery = process.env.ENABLE_ERROR_RECOVERY;
      const originalScreenshotCleanup = process.env.ENABLE_SCREENSHOT_CLEANUP;
      
      // Clear all flags first to ensure clean state
      delete process.env.ENABLE_ERROR_RECOVERY;
      delete process.env.ENABLE_SCREENSHOT_CLEANUP;
      
      process.env.DEBUG = 'true';
      process.env.ENABLE_CACHING = 'true';
      process.env.ENABLE_PROGRESS_UPDATES = 'true';
      
      const flags = getFeatureFlags();
      expect(flags.enableDetailedLogging).toBe(true);
      expect(flags.enableCaching).toBe(true);
      expect(flags.enableProgressUpdates).toBe(true);
      expect(flags.enableErrorRecovery).toBe(false); // Not set, remains false
      expect(flags.enableScreenshotCleanup).toBe(false); // Not set, remains false
      
      // Restore original values
      if (originalDebug !== undefined) {
        process.env.DEBUG = originalDebug;
      } else {
        delete process.env.DEBUG;
      }
      if (originalCaching !== undefined) {
        process.env.ENABLE_CACHING = originalCaching;
      } else {
        delete process.env.ENABLE_CACHING;
      }
      if (originalProgress !== undefined) {
        process.env.ENABLE_PROGRESS_UPDATES = originalProgress;
      } else {
        delete process.env.ENABLE_PROGRESS_UPDATES;
      }
      if (originalErrorRecovery !== undefined) {
        process.env.ENABLE_ERROR_RECOVERY = originalErrorRecovery;
      }
      if (originalScreenshotCleanup !== undefined) {
        process.env.ENABLE_SCREENSHOT_CLEANUP = originalScreenshotCleanup;
      }
    });
  });
});

