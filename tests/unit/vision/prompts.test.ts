/**
 * Unit tests for vision prompts.
 * 
 * Tests that prompts are correctly defined, exported, and contain
 * required elements (schema references, examples, etc.).
 */

import { describe, it, expect } from 'bun:test';
import {
  PROMPT_VERSION,
  GAME_ANALYSIS_PROMPT,
  FIND_CLICKABLE_ELEMENTS_PROMPT,
  DETECT_CRASH_PROMPT,
} from '../../../src/vision/prompts';

describe('Vision Prompts', () => {
  describe('PROMPT_VERSION', () => {
    it('should be defined', () => {
      expect(PROMPT_VERSION).toBeDefined();
    });

    it('should be a non-empty string', () => {
      expect(typeof PROMPT_VERSION).toBe('string');
      expect(PROMPT_VERSION.length).toBeGreaterThan(0);
    });

    it('should follow semantic versioning format', () => {
      // Should match pattern like "1.0.0"
      expect(PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('GAME_ANALYSIS_PROMPT', () => {
    it('should be defined', () => {
      expect(GAME_ANALYSIS_PROMPT).toBeDefined();
    });

    it('should be a non-empty string', () => {
      expect(typeof GAME_ANALYSIS_PROMPT).toBe('string');
      expect(GAME_ANALYSIS_PROMPT.length).toBeGreaterThan(0);
    });

    it('should reference gameTestResultSchema', () => {
      expect(GAME_ANALYSIS_PROMPT.toLowerCase()).toContain('gametestresult');
      expect(GAME_ANALYSIS_PROMPT.toLowerCase()).toContain('schema');
    });

    it('should include instructions for analyzing screenshots', () => {
      const promptLower = GAME_ANALYSIS_PROMPT.toLowerCase();
      expect(
        promptLower.includes('screenshot') || promptLower.includes('image')
      ).toBe(true);
    });

    it('should include instructions for playability score', () => {
      const promptLower = GAME_ANALYSIS_PROMPT.toLowerCase();
      expect(
        promptLower.includes('playability') || promptLower.includes('score')
      ).toBe(true);
    });

    it('should include instructions for issue detection', () => {
      const promptLower = GAME_ANALYSIS_PROMPT.toLowerCase();
      expect(
        promptLower.includes('issue') || promptLower.includes('problem')
      ).toBe(true);
    });

    it('should include examples', () => {
      const promptLower = GAME_ANALYSIS_PROMPT.toLowerCase();
      expect(
        promptLower.includes('example') ||
          promptLower.includes('for instance') ||
          promptLower.includes('e.g.')
      ).toBe(true);
    });

    it('should reference status field (pass/fail/error)', () => {
      const promptLower = GAME_ANALYSIS_PROMPT.toLowerCase();
      expect(
        promptLower.includes('status') ||
          (promptLower.includes('pass') && promptLower.includes('fail'))
      ).toBe(true);
    });
  });

  describe('FIND_CLICKABLE_ELEMENTS_PROMPT', () => {
    it('should be defined', () => {
      expect(FIND_CLICKABLE_ELEMENTS_PROMPT).toBeDefined();
    });

    it('should be a non-empty string', () => {
      expect(typeof FIND_CLICKABLE_ELEMENTS_PROMPT).toBe('string');
      expect(FIND_CLICKABLE_ELEMENTS_PROMPT.length).toBeGreaterThan(0);
    });

    it('should reference clickableElementSchema', () => {
      const promptLower = FIND_CLICKABLE_ELEMENTS_PROMPT.toLowerCase();
      expect(
        promptLower.includes('clickable') && promptLower.includes('schema')
      ).toBe(true);
    });

    it('should include instructions for detecting clickable elements', () => {
      const promptLower = FIND_CLICKABLE_ELEMENTS_PROMPT.toLowerCase();
      expect(
        promptLower.includes('clickable') ||
          promptLower.includes('button') ||
          promptLower.includes('element')
      ).toBe(true);
    });

    it('should include instructions for coordinates', () => {
      const promptLower = FIND_CLICKABLE_ELEMENTS_PROMPT.toLowerCase();
      expect(
        promptLower.includes('coordinate') ||
          promptLower.includes('x') ||
          promptLower.includes('y') ||
          promptLower.includes('position')
      ).toBe(true);
    });

    it('should include instructions for confidence score', () => {
      const promptLower = FIND_CLICKABLE_ELEMENTS_PROMPT.toLowerCase();
      expect(
        promptLower.includes('confidence') ||
          promptLower.includes('certainty')
      ).toBe(true);
    });

    it('should include examples', () => {
      const promptLower = FIND_CLICKABLE_ELEMENTS_PROMPT.toLowerCase();
      expect(
        promptLower.includes('example') ||
          promptLower.includes('for instance') ||
          promptLower.includes('e.g.')
      ).toBe(true);
    });
  });

  describe('DETECT_CRASH_PROMPT', () => {
    it('should be defined', () => {
      expect(DETECT_CRASH_PROMPT).toBeDefined();
    });

    it('should be a non-empty string', () => {
      expect(typeof DETECT_CRASH_PROMPT).toBe('string');
      expect(DETECT_CRASH_PROMPT.length).toBeGreaterThan(0);
    });

    it('should include instructions for detecting crashes', () => {
      const promptLower = DETECT_CRASH_PROMPT.toLowerCase();
      expect(
        promptLower.includes('crash') ||
          promptLower.includes('error') ||
          promptLower.includes('broken')
      ).toBe(true);
    });

    it('should include instructions for identifying error screens', () => {
      const promptLower = DETECT_CRASH_PROMPT.toLowerCase();
      expect(
        promptLower.includes('error') ||
          promptLower.includes('blank') ||
          promptLower.includes('frozen')
      ).toBe(true);
    });

    it('should include examples', () => {
      const promptLower = DETECT_CRASH_PROMPT.toLowerCase();
      expect(
        promptLower.includes('example') ||
          promptLower.includes('for instance') ||
          promptLower.includes('e.g.')
      ).toBe(true);
    });
  });

  describe('Prompt Quality Checks', () => {
    it('should not contain placeholder text', () => {
      const allPrompts = [
        GAME_ANALYSIS_PROMPT,
        FIND_CLICKABLE_ELEMENTS_PROMPT,
        DETECT_CRASH_PROMPT,
      ];

      allPrompts.forEach((prompt) => {
        expect(prompt).not.toContain('TODO');
        expect(prompt).not.toContain('FIXME');
        expect(prompt).not.toContain('XXX');
        expect(prompt).not.toContain('PLACEHOLDER');
      });
    });

    it('should have reasonable length', () => {
      // Prompts should be substantial (at least 200 chars)
      expect(GAME_ANALYSIS_PROMPT.length).toBeGreaterThan(200);
      expect(FIND_CLICKABLE_ELEMENTS_PROMPT.length).toBeGreaterThan(200);
      expect(DETECT_CRASH_PROMPT.length).toBeGreaterThan(200);
    });
  });
});

