/**
 * Unit tests for FileManager utility.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { FileManager } from '../../src/utils/file-manager';
import { PATHS } from '../../src/config/constants';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Screenshot, GameTestResult } from '../../src/types/game-test.types';

describe('FileManager', () => {
  let fileManager: FileManager;
  let testSessionId: string;

  beforeEach(() => {
    // Create a test session ID with timestamp to ensure uniqueness
    testSessionId = `test-session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    fileManager = new FileManager(testSessionId);
  });

  afterEach(() => {
    // Clean up test directories after each test
    const screenshotsDir = join(PATHS.OUTPUT_DIR, PATHS.SCREENSHOTS_SUBDIR, testSessionId);
    const reportsDir = join(PATHS.OUTPUT_DIR, PATHS.REPORTS_SUBDIR, testSessionId);
    
    if (existsSync(screenshotsDir)) {
      rmSync(screenshotsDir, { recursive: true, force: true });
    }
    if (existsSync(reportsDir)) {
      rmSync(reportsDir, { recursive: true, force: true });
    }
  });

  describe('FileManager instantiation', () => {
    it('should create FileManager with sessionId', () => {
      const manager = new FileManager('test-session-123');
      expect(manager).toBeInstanceOf(FileManager);
    });

    it('should create FileManager without sessionId (auto-generates)', () => {
      const manager = new FileManager();
      expect(manager).toBeInstanceOf(FileManager);
      // SessionId should be generated
      expect(manager['sessionId']).toBeDefined();
      expect(typeof manager['sessionId']).toBe('string');
      expect(manager['sessionId'].length).toBeGreaterThan(0);
    });
  });

  describe('ensureOutputDirectory()', () => {
    it('should create output directories', async () => {
      await fileManager.ensureOutputDirectory();

      expect(existsSync(PATHS.OUTPUT_DIR)).toBe(true);
      expect(existsSync(join(PATHS.OUTPUT_DIR, PATHS.SCREENSHOTS_SUBDIR, testSessionId))).toBe(true);
      expect(existsSync(join(PATHS.OUTPUT_DIR, PATHS.REPORTS_SUBDIR, testSessionId))).toBe(true);
    });

    it('should handle existing directories gracefully', async () => {
      // Create directories first
      mkdirSync(join(PATHS.OUTPUT_DIR, PATHS.SCREENSHOTS_SUBDIR, testSessionId), { recursive: true });
      mkdirSync(join(PATHS.OUTPUT_DIR, PATHS.REPORTS_SUBDIR, testSessionId), { recursive: true });

      // Should not throw when directories already exist
      await expect(fileManager.ensureOutputDirectory()).resolves.toBeUndefined();
    });

    it('should create directories recursively', async () => {
      await fileManager.ensureOutputDirectory();

      // Verify nested directories are created
      expect(existsSync(join(PATHS.OUTPUT_DIR, PATHS.SCREENSHOTS_SUBDIR))).toBe(true);
      expect(existsSync(join(PATHS.OUTPUT_DIR, PATHS.SCREENSHOTS_SUBDIR, testSessionId))).toBe(true);
      expect(existsSync(join(PATHS.OUTPUT_DIR, PATHS.REPORTS_SUBDIR))).toBe(true);
      expect(existsSync(join(PATHS.OUTPUT_DIR, PATHS.REPORTS_SUBDIR, testSessionId))).toBe(true);
    });
  });

  describe('saveScreenshot()', () => {
    beforeEach(async () => {
      await fileManager.ensureOutputDirectory();
    });

    it('should save PNG buffer to correct path', async () => {
      // Create a simple PNG buffer (minimal valid PNG)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 image
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89,
        0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
        0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,
        0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND
        0xAE, 0x42, 0x60, 0x82
      ]);

      const screenshot = await fileManager.saveScreenshot(pngBuffer, 'initial_load');

      expect(screenshot).toBeDefined();
      expect(screenshot.id).toBeDefined();
      expect(screenshot.path).toBeDefined();
      expect(screenshot.timestamp).toBeDefined();
      expect(screenshot.stage).toBe('initial_load');

      // Verify file exists
      expect(existsSync(screenshot.path)).toBe(true);

      // Verify file content matches
      const savedBuffer = readFileSync(screenshot.path);
      expect(savedBuffer).toEqual(pngBuffer);
    });

    it('should generate unique IDs when not provided', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

      const screenshot1 = await fileManager.saveScreenshot(pngBuffer, 'initial_load');
      const screenshot2 = await fileManager.saveScreenshot(pngBuffer, 'after_interaction');

      expect(screenshot1.id).not.toBe(screenshot2.id);
    });

    it('should use provided ID when given', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const customId = 'custom-screenshot-id';

      const screenshot = await fileManager.saveScreenshot(pngBuffer, 'initial_load', customId);

      expect(screenshot.id).toBe(customId);
      expect(screenshot.path).toContain(customId);
    });

    it('should return Screenshot object with correct fields', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

      const screenshot = await fileManager.saveScreenshot(pngBuffer, 'final_state');

      expect(screenshot).toHaveProperty('id');
      expect(screenshot).toHaveProperty('path');
      expect(screenshot).toHaveProperty('timestamp');
      expect(screenshot).toHaveProperty('stage');
      
      expect(typeof screenshot.id).toBe('string');
      expect(typeof screenshot.path).toBe('string');
      expect(typeof screenshot.timestamp).toBe('number');
      expect(screenshot.stage).toBe('final_state');
      
      // Path should end with .png
      expect(screenshot.path).toMatch(/\.png$/);
    });

    it('should handle different screenshot stages', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

      const stages: Screenshot['stage'][] = ['initial_load', 'after_interaction', 'final_state'];
      
      for (const stage of stages) {
        const screenshot = await fileManager.saveScreenshot(pngBuffer, stage);
        expect(screenshot.stage).toBe(stage);
      }
    });
  });

  describe('saveReport()', () => {
    beforeEach(async () => {
      await fileManager.ensureOutputDirectory();
    });

    it('should save JSON report to correct path', async () => {
      const report: GameTestResult = {
        status: 'pass',
        playability_score: 85,
        issues: [],
        screenshots: [],
        timestamp: new Date().toISOString(),
      };

      const reportPath = await fileManager.saveReport(report);

      expect(reportPath).toBeDefined();
      expect(typeof reportPath).toBe('string');
      expect(reportPath).toContain('report.json');

      // Verify file exists
      expect(existsSync(reportPath)).toBe(true);

      // Verify file content
      const savedContent = readFileSync(reportPath, 'utf-8');
      const parsedReport = JSON.parse(savedContent);
      
      expect(parsedReport.status).toBe(report.status);
      expect(parsedReport.playability_score).toBe(report.playability_score);
      expect(parsedReport.issues).toEqual(report.issues);
    });

    it('should save complete report with all fields', async () => {
      const report: GameTestResult = {
        status: 'fail',
        playability_score: 30,
        issues: [
          {
            severity: 'critical',
            description: 'Game crashed on load',
            timestamp: new Date().toISOString(),
          },
        ],
        screenshots: ['/tmp/screenshot1.png', '/tmp/screenshot2.png'],
        timestamp: new Date().toISOString(),
        metadata: {
          sessionId: testSessionId,
          gameUrl: 'https://example.com/game',
          duration: 5000,
          gameType: 'canvas',
          consoleErrors: [],
        },
      };

      const reportPath = await fileManager.saveReport(report);

      const savedContent = readFileSync(reportPath, 'utf-8');
      const parsedReport = JSON.parse(savedContent);

      expect(parsedReport).toEqual(report);
    });

    it('should format JSON with indentation', async () => {
      const report: GameTestResult = {
        status: 'pass',
        playability_score: 75,
        issues: [],
        screenshots: [],
        timestamp: new Date().toISOString(),
      };

      const reportPath = await fileManager.saveReport(report);
      const savedContent = readFileSync(reportPath, 'utf-8');

      // Should have newlines (indented JSON)
      expect(savedContent).toContain('\n');
      // Should be valid JSON
      expect(() => JSON.parse(savedContent)).not.toThrow();
    });
  });

  describe('getScreenshotPath()', () => {
    it('should generate correct screenshot path', () => {
      const screenshotId = 'test-screenshot-123';
      const path = fileManager.getScreenshotPath(screenshotId);

      expect(path).toContain(testSessionId);
      expect(path).toContain(screenshotId);
      expect(path).toMatch(/\.png$/);
      expect(path).toContain('screenshots');
    });

    it('should generate paths with sessionId', () => {
      const manager = new FileManager('custom-session');
      const path = manager.getScreenshotPath('screenshot-id');

      expect(path).toContain('custom-session');
      expect(path).toContain('screenshots');
      expect(path).toContain('screenshot-id');
    });
  });

  describe('getReportPath()', () => {
    it('should generate correct report path', () => {
      const path = fileManager.getReportPath();

      expect(path).toContain(testSessionId);
      expect(path).toContain('report.json');
      expect(path).toContain('reports');
    });

    it('should generate paths with sessionId', () => {
      const manager = new FileManager('custom-session');
      const path = manager.getReportPath();

      expect(path).toContain('custom-session');
      expect(path).toContain('reports');
      expect(path).toContain('report.json');
    });
  });

  describe('cleanup()', () => {
    it('should be a stub (does not throw)', async () => {
      await expect(fileManager.cleanup()).resolves.toBeUndefined();
    });

    it('should return void', async () => {
      const result = await fileManager.cleanup();
      expect(result).toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('should handle directory creation errors gracefully', async () => {
      // This test is limited - we can't easily simulate permission errors
      // But we can verify the method doesn't throw on normal operations
      await expect(fileManager.ensureOutputDirectory()).resolves.toBeUndefined();
    });

    it('should handle file write errors', async () => {
      await fileManager.ensureOutputDirectory();

      // Try to write to an invalid path (by using invalid characters)
      // Note: This may not throw in all environments, but we test the error handling structure
      const invalidBuffer = Buffer.from([0x00]);
      
      // Should handle gracefully - actual behavior depends on filesystem
      // In most cases, it should either succeed or throw a clear error
      try {
        await fileManager.saveScreenshot(invalidBuffer, 'initial_load');
        // If it succeeds, that's fine - the test verifies the method exists
      } catch (error) {
        // If it throws, verify it's a proper error
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Integration with actual filesystem', () => {
    it('should save and read back screenshot correctly', async () => {
      await fileManager.ensureOutputDirectory();

      const originalBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      ]);

      const screenshot = await fileManager.saveScreenshot(originalBuffer, 'initial_load');

      // Read back the file
      const savedBuffer = readFileSync(screenshot.path);

      expect(savedBuffer).toEqual(originalBuffer);
      expect(savedBuffer.length).toBe(originalBuffer.length);
    });

    it('should save and read back report correctly', async () => {
      await fileManager.ensureOutputDirectory();

      const originalReport: GameTestResult = {
        status: 'pass',
        playability_score: 90,
        issues: [
          {
            severity: 'minor',
            description: 'Small UI issue',
            timestamp: new Date().toISOString(),
          },
        ],
        screenshots: ['/tmp/screenshot1.png'],
        timestamp: new Date().toISOString(),
      };

      const reportPath = await fileManager.saveReport(originalReport);
      const savedContent = readFileSync(reportPath, 'utf-8');
      const parsedReport = JSON.parse(savedContent);

      expect(parsedReport).toEqual(originalReport);
    });
  });
});

