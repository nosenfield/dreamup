/**
 * Unit tests for Zod schema validation.
 */

import { z } from 'zod';
import {
  issueSchema,
  clickableElementSchema,
  gameTestResultSchema,
  validateIssue,
  validateClickableElement,
  validateGameTestResult,
} from '../../src/vision/schema';

describe('Zod Schemas', () => {
  describe('issueSchema', () => {
    it('should validate a valid issue', () => {
      const validIssue = {
        severity: 'critical' as const,
        description: 'Game crashed on startup',
        timestamp: '2025-11-03T10:00:00.000Z',
      };

      const result = issueSchema.safeParse(validIssue);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validIssue);
      }
    });

    it('should validate all severity levels', () => {
      const severities = ['critical', 'major', 'minor'] as const;
      
      severities.forEach((severity) => {
        const issue = {
          severity,
          description: 'Test issue',
          timestamp: '2025-11-03T10:00:00.000Z',
        };
        
        const result = issueSchema.safeParse(issue);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid severity', () => {
      const invalidIssue = {
        severity: 'invalid',
        description: 'Test issue',
        timestamp: '2025-11-03T10:00:00.000Z',
      };

      const result = issueSchema.safeParse(invalidIssue);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const incompleteIssue = {
        severity: 'critical',
        // missing description and timestamp
      };

      const result = issueSchema.safeParse(incompleteIssue);
      expect(result.success).toBe(false);
    });

    it('should reject wrong field types', () => {
      const wrongTypeIssue = {
        severity: 'critical',
        description: 123, // should be string
        timestamp: '2025-11-03T10:00:00.000Z',
      };

      const result = issueSchema.safeParse(wrongTypeIssue);
      expect(result.success).toBe(false);
    });
  });

  describe('clickableElementSchema', () => {
    it('should validate a valid clickable element', () => {
      const validElement = {
        label: 'Start Game',
        x: 100,
        y: 200,
        confidence: 0.95,
      };

      const result = clickableElementSchema.safeParse(validElement);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validElement);
      }
    });

    it('should validate boundary values', () => {
      const boundaryElement = {
        label: 'Button',
        x: 0,
        y: 0,
        confidence: 0.0,
      };

      const result = clickableElementSchema.safeParse(boundaryElement);
      expect(result.success).toBe(true);
    });

    it('should reject negative coordinates', () => {
      const invalidElement = {
        label: 'Button',
        x: -1,
        y: 100,
        confidence: 0.5,
      };

      const result = clickableElementSchema.safeParse(invalidElement);
      expect(result.success).toBe(false);
    });

    it('should reject confidence out of range', () => {
      const invalidElement = {
        label: 'Button',
        x: 100,
        y: 100,
        confidence: 1.5, // > 1.0
      };

      const result = clickableElementSchema.safeParse(invalidElement);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const incompleteElement = {
        label: 'Button',
        // missing x, y, confidence
      };

      const result = clickableElementSchema.safeParse(incompleteElement);
      expect(result.success).toBe(false);
    });
  });

  describe('gameTestResultSchema', () => {
    it('should validate a valid game test result', () => {
      const validResult = {
        status: 'pass' as const,
        playability_score: 75,
        issues: [
          {
            severity: 'minor' as const,
            description: 'Small UI issue',
            timestamp: '2025-11-03T10:00:00.000Z',
          },
        ],
        screenshots: ['/tmp/screenshot1.png', '/tmp/screenshot2.png'],
        timestamp: '2025-11-03T10:05:00.000Z',
      };

      const result = gameTestResultSchema.safeParse(validResult);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validResult);
      }
    });

    it('should validate all status values', () => {
      const statuses = ['pass', 'fail', 'error'] as const;
      
      statuses.forEach((status) => {
        const result = {
          status,
          playability_score: 50,
          issues: [],
          screenshots: [],
          timestamp: '2025-11-03T10:00:00.000Z',
        };
        
        const parseResult = gameTestResultSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      });
    });

    it('should validate playability_score boundaries', () => {
      const boundaryScores = [0, 50, 100];
      
      boundaryScores.forEach((score) => {
        const result = {
          status: 'pass' as const,
          playability_score: score,
          issues: [],
          screenshots: [],
          timestamp: '2025-11-03T10:00:00.000Z',
        };
        
        const parseResult = gameTestResultSchema.safeParse(result);
        expect(parseResult.success).toBe(true);
      });
    });

    it('should reject playability_score out of range', () => {
      const invalidResults = [
        {
          status: 'pass' as const,
          playability_score: -1, // < 0
          issues: [],
          screenshots: [],
          timestamp: '2025-11-03T10:00:00.000Z',
        },
        {
          status: 'pass' as const,
          playability_score: 101, // > 100
          issues: [],
          screenshots: [],
          timestamp: '2025-11-03T10:00:00.000Z',
        },
      ];

      invalidResults.forEach((result) => {
        const parseResult = gameTestResultSchema.safeParse(result);
        expect(parseResult.success).toBe(false);
      });
    });

    it('should allow empty arrays for issues and screenshots', () => {
      const result = {
        status: 'pass' as const,
        playability_score: 75,
        issues: [],
        screenshots: [],
        timestamp: '2025-11-03T10:00:00.000Z',
      };

      const parseResult = gameTestResultSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should validate multiple issues', () => {
      const result = {
        status: 'fail' as const,
        playability_score: 30,
        issues: [
          {
            severity: 'critical' as const,
            description: 'Game crashes',
            timestamp: '2025-11-03T10:00:00.000Z',
          },
          {
            severity: 'major' as const,
            description: 'Performance issues',
            timestamp: '2025-11-03T10:01:00.000Z',
          },
        ],
        screenshots: ['/tmp/screenshot1.png'],
        timestamp: '2025-11-03T10:05:00.000Z',
      };

      const parseResult = gameTestResultSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const invalidResult = {
        status: 'invalid',
        playability_score: 50,
        issues: [],
        screenshots: [],
        timestamp: '2025-11-03T10:00:00.000Z',
      };

      const parseResult = gameTestResultSchema.safeParse(invalidResult);
      expect(parseResult.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const incompleteResult = {
        status: 'pass' as const,
        // missing playability_score, issues, screenshots, timestamp
      };

      const parseResult = gameTestResultSchema.safeParse(incompleteResult);
      expect(parseResult.success).toBe(false);
    });

    it('should reject invalid issue in issues array', () => {
      const invalidResult = {
        status: 'pass' as const,
        playability_score: 75,
        issues: [
          {
            severity: 'invalid', // invalid severity
            description: 'Test',
            timestamp: '2025-11-03T10:00:00.000Z',
          },
        ],
        screenshots: [],
        timestamp: '2025-11-03T10:00:00.000Z',
      };

      const parseResult = gameTestResultSchema.safeParse(invalidResult);
      expect(parseResult.success).toBe(false);
    });
  });

  describe('Validation Helpers', () => {
    describe('validateIssue', () => {
      it('should return success for valid issue', () => {
        const validIssue = {
          severity: 'critical' as const,
          description: 'Test issue',
          timestamp: '2025-11-03T10:00:00.000Z',
        };

        const result = validateIssue(validIssue);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validIssue);
        }
      });

      it('should return error for invalid issue', () => {
        const invalidIssue = {
          severity: 'invalid',
          description: 'Test',
          timestamp: '2025-11-03T10:00:00.000Z',
        };

        const result = validateIssue(invalidIssue);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });
    });

    describe('validateClickableElement', () => {
      it('should return success for valid element', () => {
        const validElement = {
          label: 'Start Button',
          x: 100,
          y: 200,
          confidence: 0.9,
        };

        const result = validateClickableElement(validElement);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validElement);
        }
      });

      it('should return error for invalid element', () => {
        const invalidElement = {
          label: 'Button',
          x: -1,
          y: 100,
          confidence: 0.5,
        };

        const result = validateClickableElement(invalidElement);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });
    });

    describe('validateGameTestResult', () => {
      it('should return success for valid result', () => {
        const validResult = {
          status: 'pass' as const,
          playability_score: 75,
          issues: [],
          screenshots: [],
          timestamp: '2025-11-03T10:00:00.000Z',
        };

        const result = validateGameTestResult(validResult);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validResult);
        }
      });

      it('should return error for invalid result', () => {
        const invalidResult = {
          status: 'pass' as const,
          playability_score: 150, // out of range
          issues: [],
          screenshots: [],
          timestamp: '2025-11-03T10:00:00.000Z',
        };

        const result = validateGameTestResult(invalidResult);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });
    });
  });
});

