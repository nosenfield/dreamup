/**
 * Unit tests for metadata schema validation.
 * 
 * These tests verify that Zod schemas correctly validate metadata objects
 * and that example metadata files pass validation.
 */

import { describe, it, expect } from 'bun:test';
import {
  inputActionSchema,
  inputAxisSchema,
  inputSchemaSchema,
  loadingIndicatorSchema,
  successIndicatorSchema,
  testingStrategySchema,
  gameMetadataSchema,
  validateInputAction,
  validateInputAxis,
  validateInputSchema,
  validateLoadingIndicator,
  validateSuccessIndicator,
  validateTestingStrategy,
  validateGameMetadata,
  type InputActionFromSchema,
  type InputAxisFromSchema,
  type InputSchemaFromSchema,
  type LoadingIndicatorFromSchema,
  type SuccessIndicatorFromSchema,
  type TestingStrategyFromSchema,
  type GameMetadataFromSchema,
} from '../../src/schemas/metadata.schema';
import type {
  InputAction,
  InputAxis,
  InputSchema,
  LoadingIndicator,
  SuccessIndicator,
  TestingStrategy,
  GameMetadata,
} from '../../src/types';
// Import JSON files using Bun.file() for runtime loading
import pongMetadataJson from '../../_game-examples/pong/metadata.json';
import snakeMetadataJson from '../../_game-examples/snake/metadata.json';

// Parse JSON files (they're already objects when imported)
const pongMetadata = pongMetadataJson as unknown;
const snakeMetadata = snakeMetadataJson as unknown;

describe('Metadata Schema Validation', () => {
  describe('inputActionSchema', () => {
    it('should validate valid InputAction', () => {
      const action = {
        name: 'Pause',
        keys: ['Escape'],
        description: 'Pause the game',
      };

      const result = inputActionSchema.safeParse(action);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Pause');
        expect(result.data.keys).toEqual(['Escape']);
      }
    });

    it('should validate InputAction without description', () => {
      const action = {
        name: 'Jump',
        keys: ['Space'],
      };

      const result = inputActionSchema.safeParse(action);
      expect(result.success).toBe(true);
    });

    it('should reject InputAction with missing name', () => {
      const action = {
        keys: ['Space'],
      };

      const result = inputActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });

    it('should reject InputAction with missing keys', () => {
      const action = {
        name: 'Jump',
      };

      const result = inputActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });
  });

  describe('inputAxisSchema', () => {
    it('should validate valid InputAxis', () => {
      const axis = {
        name: 'MoveHorizontal',
        keys: ['ArrowLeft', 'ArrowRight'],
        description: 'Move horizontally',
      };

      const result = inputAxisSchema.safeParse(axis);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('MoveHorizontal');
        expect(result.data.is2D).toBeUndefined();
      }
    });

    it('should validate InputAxis with is2D flag', () => {
      const axis = {
        name: 'Move',
        keys: ['w', 'a', 's', 'd'],
        is2D: true,
      };

      const result = inputAxisSchema.safeParse(axis);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is2D).toBe(true);
      }
    });

    it('should reject InputAxis with invalid is2D type', () => {
      const axis = {
        name: 'Move',
        keys: ['w', 'a', 's', 'd'],
        is2D: 'true', // Should be boolean
      };

      const result = inputAxisSchema.safeParse(axis);
      expect(result.success).toBe(false);
    });
  });

  describe('inputSchemaSchema', () => {
    it('should validate InputSchema with old format (string arrays)', () => {
      const schema = {
        type: 'javascript',
        content: 'gameBuilder.createAxis("Move")',
        actions: ['Jump', 'Shoot'],
        axes: ['MoveHorizontal'],
      };

      const result = inputSchemaSchema.safeParse(schema);
      expect(result.success).toBe(true);
    });

    it('should validate InputSchema with new format (structured arrays)', () => {
      const schema = {
        type: 'javascript',
        content: 'gameBuilder.createAxis("Move")',
        actions: [
          { name: 'Pause', keys: ['Escape'] },
        ],
        axes: [
          { name: 'MoveVertical', keys: ['ArrowDown', 'ArrowUp'] },
        ],
      };

      const result = inputSchemaSchema.safeParse(schema);
      expect(result.success).toBe(true);
    });

    it('should validate InputSchema with semantic type', () => {
      const schema = {
        type: 'semantic',
        content: 'Use arrow keys to move',
      };

      const result = inputSchemaSchema.safeParse(schema);
      expect(result.success).toBe(true);
    });

    it('should reject InputSchema with invalid type', () => {
      const schema = {
        type: 'invalid',
        content: 'test',
      };

      const result = inputSchemaSchema.safeParse(schema);
      expect(result.success).toBe(false);
    });
  });

  describe('loadingIndicatorSchema', () => {
    it('should validate element type LoadingIndicator', () => {
      const indicator = {
        type: 'element',
        pattern: '#start-btn',
        description: 'Start button appears',
        selector: '#start-btn',
      };

      const result = loadingIndicatorSchema.safeParse(indicator);
      expect(result.success).toBe(true);
    });

    it('should validate text type LoadingIndicator', () => {
      const indicator = {
        type: 'text',
        pattern: 'PONG',
        description: 'Game title displays',
      };

      const result = loadingIndicatorSchema.safeParse(indicator);
      expect(result.success).toBe(true);
    });

    it('should reject LoadingIndicator with invalid type', () => {
      const indicator = {
        type: 'invalid',
        pattern: 'test',
        description: 'test',
      };

      const result = loadingIndicatorSchema.safeParse(indicator);
      expect(result.success).toBe(false);
    });
  });

  describe('successIndicatorSchema', () => {
    it('should validate score_change type SuccessIndicator', () => {
      const indicator = {
        type: 'score_change',
        description: 'Score increments',
        selector: '#score',
      };

      const result = successIndicatorSchema.safeParse(indicator);
      expect(result.success).toBe(true);
    });

    it('should validate animation type SuccessIndicator', () => {
      const indicator = {
        type: 'animation',
        description: 'Ball moves smoothly',
      };

      const result = successIndicatorSchema.safeParse(indicator);
      expect(result.success).toBe(true);
    });

    it('should reject SuccessIndicator with invalid type', () => {
      const indicator = {
        type: 'invalid',
        description: 'test',
      };

      const result = successIndicatorSchema.safeParse(indicator);
      expect(result.success).toBe(false);
    });
  });

  describe('testingStrategySchema', () => {
    it('should validate valid TestingStrategy', () => {
      const strategy = {
        waitBeforeInteraction: 2000,
        interactionDuration: 30000,
        criticalActions: ['Pause'],
        criticalAxes: ['MoveVertical'],
        instructions: 'Test game',
      };

      const result = testingStrategySchema.safeParse(strategy);
      expect(result.success).toBe(true);
    });

    it('should validate TestingStrategy with minimal fields', () => {
      const strategy = {
        waitBeforeInteraction: 2000,
        interactionDuration: 30000,
      };

      const result = testingStrategySchema.safeParse(strategy);
      expect(result.success).toBe(true);
    });

    it('should reject TestingStrategy with negative waitBeforeInteraction', () => {
      const strategy = {
        waitBeforeInteraction: -1000,
        interactionDuration: 30000,
      };

      const result = testingStrategySchema.safeParse(strategy);
      expect(result.success).toBe(false);
    });

    it('should reject TestingStrategy with missing required fields', () => {
      const strategy = {
        waitBeforeInteraction: 2000,
        // Missing interactionDuration
      };

      const result = testingStrategySchema.safeParse(strategy);
      expect(result.success).toBe(false);
    });
  });

  describe('gameMetadataSchema', () => {
    it('should validate Pong metadata.json file', () => {
      const result = gameMetadataSchema.safeParse(pongMetadata);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.genre).toBe('arcade');
        expect(result.data.inputSchema.type).toBe('javascript');
        expect(result.data.loadingIndicators?.length).toBe(2);
        expect(result.data.successIndicators?.length).toBe(3);
      }
    });

    it('should validate Snake metadata.json file', () => {
      const result = gameMetadataSchema.safeParse(snakeMetadata);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.genre).toBe('arcade');
        expect(result.data.inputSchema.type).toBe('javascript');
        expect(result.data.inputSchema.axes?.[0]?.is2D).toBe(true);
      }
    });

    it('should validate GameMetadata with minimal required fields', () => {
      const metadata = {
        inputSchema: {
          type: 'semantic',
          content: 'Use arrow keys to move',
        },
      };

      const result = gameMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(true);
    });

    it('should reject GameMetadata with missing inputSchema', () => {
      const metadata = {
        genre: 'arcade',
      };

      const result = gameMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(false);
    });

    it('should reject GameMetadata with invalid inputSchema', () => {
      const metadata = {
        inputSchema: {
          type: 'invalid',
          content: 'test',
        },
      };

      const result = gameMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(false);
    });
  });

  describe('Validation helper functions', () => {
    it('should validate InputAction using helper function', () => {
      const action = {
        name: 'Pause',
        keys: ['Escape'],
      };

      const result = validateInputAction(action);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Pause');
      }
    });

    it('should validate InputAxis using helper function', () => {
      const axis = {
        name: 'Move',
        keys: ['w', 'a', 's', 'd'],
        is2D: true,
      };

      const result = validateInputAxis(axis);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is2D).toBe(true);
      }
    });

    it('should validate GameMetadata using helper function', () => {
      const result = validateGameMetadata(pongMetadata);
      expect(result.success).toBe(true);
    });

    it('should return error for invalid GameMetadata', () => {
      const invalidMetadata = {
        inputSchema: {
          type: 'invalid',
          content: 'test',
        },
      };

      const result = validateGameMetadata(invalidMetadata);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Type inference', () => {
    it('should match TypeScript InputAction interface', () => {
      const action: InputAction = {
        name: 'Pause',
        keys: ['Escape'],
        description: 'Pause',
      };

      const validated: InputActionFromSchema = action;
      expect(validated.name).toBe('Pause');
    });

    it('should match TypeScript InputAxis interface', () => {
      const axis: InputAxis = {
        name: 'Move',
        keys: ['w', 'a', 's', 'd'],
        is2D: true,
      };

      const validated: InputAxisFromSchema = axis;
      expect(validated.is2D).toBe(true);
    });

    it('should match TypeScript GameMetadata interface', () => {
      const metadata: GameMetadata = {
        inputSchema: {
          type: 'semantic',
          content: 'Use arrow keys',
        },
        genre: 'arcade',
      };

      const validated: GameMetadataFromSchema = metadata;
      expect(validated.genre).toBe('arcade');
    });
  });
});

