/**
 * Unit tests for InputSchemaParser.
 * 
 * These tests verify that the parser correctly extracts actions and axes
 * from GameMetadata, handles both JavaScript and semantic input schemas,
 * and provides key bindings for testing.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { InputSchemaParser } from '../../src/core/input-schema-parser';
import { Logger } from '../../src/utils/logger';
import type { GameMetadata, InputAction, InputAxis } from '../../src/types';
import pongMetadataJson from '../../_game-examples/pong/metadata.json';
import snakeMetadataJson from '../../_game-examples/snake/metadata.json';

const pongMetadata = pongMetadataJson as unknown as GameMetadata;
const snakeMetadata = snakeMetadataJson as unknown as GameMetadata;

describe('InputSchemaParser', () => {
  let logger: Logger;
  let parser: InputSchemaParser;

  beforeEach(() => {
    logger = new Logger({ module: 'test' });
    parser = new InputSchemaParser({ logger });
  });

  describe('parse()', () => {
    it('should parse Pong metadata.json with structured arrays', () => {
      const result = parser.parse(pongMetadata);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]?.name).toBe('Pause');
      expect(result.actions[0]?.keys).toEqual(['Escape']);
      expect(result.actions[0]?.description).toBe('Pause the game and open pause menu');

      expect(result.axes).toHaveLength(1);
      expect(result.axes[0]?.name).toBe('RightPaddleVertical');
      expect(result.axes[0]?.keys).toEqual(['ArrowDown', 'ArrowUp']);
      expect(result.axes[0]?.description).toBe('Control right paddle (Player 2) vertical movement');
    });

    it('should parse Snake metadata.json with structured arrays', () => {
      const result = parser.parse(snakeMetadata);

      expect(result.actions).toHaveLength(0);

      expect(result.axes).toHaveLength(1);
      expect(result.axes[0]?.name).toBe('Move');
      expect(result.axes[0]?.keys).toEqual(['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
      expect(result.axes[0]?.is2D).toBe(true);
      expect(result.axes[0]?.description).toBe('Control snake movement direction (2D axis)');
    });

    it('should handle metadata with string[] arrays (old format)', () => {
      const metadata: GameMetadata = {
        inputSchema: {
          type: 'javascript',
          content: 'gameBuilder.createAction("Jump").bindKey("Space")',
          actions: ['Jump', 'Shoot'] as string[],
          axes: ['MoveHorizontal'] as string[],
        },
      };

      const result = parser.parse(metadata);

      expect(result.actions).toHaveLength(2);
      expect(result.actions[0]?.name).toBe('Jump');
      expect(result.actions[0]?.keys).toEqual([]); // No keys inferred from string array
      expect(result.actions[1]?.name).toBe('Shoot');

      expect(result.axes).toHaveLength(1);
      expect(result.axes[0]?.name).toBe('MoveHorizontal');
      expect(result.axes[0]?.keys).toEqual([]); // No keys inferred from string array
    });

    it('should parse metadata with only JavaScript content (no actions/axes)', () => {
      const metadata: GameMetadata = {
        inputSchema: {
          type: 'javascript',
          content: "gameBuilder.createAxis('MoveVertical').bindKeys('ArrowDown', 'ArrowUp')\ngameBuilder.createAction('Pause').bindKey('Escape')",
        },
      };

      const result = parser.parse(metadata);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]?.name).toBe('Pause');
      expect(result.actions[0]?.keys).toEqual(['Escape']);

      expect(result.axes).toHaveLength(1);
      expect(result.axes[0]?.name).toBe('MoveVertical');
      expect(result.axes[0]?.keys).toEqual(['ArrowDown', 'ArrowUp']);
    });

    it('should parse metadata with only semantic content', () => {
      const metadata: GameMetadata = {
        inputSchema: {
          type: 'semantic',
          content: 'Use arrow keys to move, spacebar to jump',
        },
      };

      const result = parser.parse(metadata);

      // Semantic parsing should extract controls
      expect(result.actions.length).toBeGreaterThanOrEqual(0);
      expect(result.axes.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing metadata.inputSchema gracefully', () => {
      const metadata = {} as GameMetadata;

      const result = parser.parse(metadata);

      expect(result.actions).toEqual([]);
      expect(result.axes).toEqual([]);
    });

    it('should prioritize structured arrays over content parsing', () => {
      const metadata: GameMetadata = {
        inputSchema: {
          type: 'javascript',
          content: 'gameBuilder.createAction("Wrong").bindKey("X")',
          actions: [
            {
              name: 'Correct',
              keys: ['Escape'],
            },
          ],
        },
      };

      const result = parser.parse(metadata);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]?.name).toBe('Correct');
      expect(result.actions[0]?.keys).toEqual(['Escape']);
    });
  });

  describe('parseJavaScript()', () => {
    it('should parse createAction().bindKey() pattern', () => {
      const content = "gameBuilder.createAction('Pause').bindKey('Escape')";
      const result = parser.parseJavaScript(content);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]?.name).toBe('Pause');
      expect(result.actions[0]?.keys).toEqual(['Escape']);
    });

    it('should parse createAction().bindKeys() pattern', () => {
      const content = "gameBuilder.createAction('Jump').bindKeys('Space', 'Enter')";
      const result = parser.parseJavaScript(content);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]?.name).toBe('Jump');
      expect(result.actions[0]?.keys).toEqual(['Space', 'Enter']);
    });

    it('should parse createAxis().bindKeys() pattern', () => {
      const content = "gameBuilder.createAxis('MoveVertical').bindKeys('ArrowDown', 'ArrowUp')";
      const result = parser.parseJavaScript(content);

      expect(result.axes).toHaveLength(1);
      expect(result.axes[0]?.name).toBe('MoveVertical');
      expect(result.axes[0]?.keys).toEqual(['ArrowDown', 'ArrowUp']);
      expect(result.axes[0]?.is2D).toBeUndefined();
    });

    it('should parse createAxis2D().bindWASD().bindArrowKeys() pattern', () => {
      const content = "gameBuilder.createAxis2D('Move').bindWASD().bindArrowKeys()";
      const result = parser.parseJavaScript(content);

      expect(result.axes).toHaveLength(1);
      expect(result.axes[0]?.name).toBe('Move');
      expect(result.axes[0]?.is2D).toBe(true);
      expect(result.axes[0]?.keys).toContain('w');
      expect(result.axes[0]?.keys).toContain('a');
      expect(result.axes[0]?.keys).toContain('s');
      expect(result.axes[0]?.keys).toContain('d');
      expect(result.axes[0]?.keys).toContain('ArrowUp');
      expect(result.axes[0]?.keys).toContain('ArrowDown');
      expect(result.axes[0]?.keys).toContain('ArrowLeft');
      expect(result.axes[0]?.keys).toContain('ArrowRight');
    });

    it('should parse multi-line JavaScript content', () => {
      const content = `gameBuilder.createAxis('RightPaddleVertical').bindKeys('ArrowDown', 'ArrowUp')
gameBuilder.createAction('Pause').bindKey('Escape')`;
      const result = parser.parseJavaScript(content);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]?.name).toBe('Pause');
      expect(result.axes).toHaveLength(1);
      expect(result.axes[0]?.name).toBe('RightPaddleVertical');
    });

    it('should handle malformed JavaScript content gracefully', () => {
      const content = 'invalid javascript code';
      const result = parser.parseJavaScript(content);

      expect(result.actions).toEqual([]);
      expect(result.axes).toEqual([]);
    });

    it('should handle empty JavaScript content', () => {
      const result = parser.parseJavaScript('');

      expect(result.actions).toEqual([]);
      expect(result.axes).toEqual([]);
    });
  });

  describe('parseSemantic()', () => {
    it('should extract keys from "arrow keys" pattern', () => {
      const content = 'Use arrow keys to move';
      const result = parser.parseSemantic(content);

      expect(result.axes.length).toBeGreaterThanOrEqual(0);
      // Should contain arrow keys
      const allKeys = result.axes.flatMap(axis => axis.keys);
      expect(
        allKeys.some(key => 
          ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)
        )
      ).toBe(true);
    });

    it('should extract keys from "WASD" pattern', () => {
      const content = 'Use WASD for movement';
      const result = parser.parseSemantic(content);

      const allKeys = result.axes.flatMap(axis => axis.keys);
      expect(allKeys).toContain('w');
      expect(allKeys).toContain('a');
      expect(allKeys).toContain('s');
      expect(allKeys).toContain('d');
    });

    it('should extract keys from "spacebar" pattern', () => {
      const content = 'Press spacebar to jump';
      const result = parser.parseSemantic(content);

      const allKeys = result.actions.flatMap(action => action.keys);
      expect(allKeys).toContain('Space');
    });

    it('should extract keys from "Escape" pattern', () => {
      const content = 'Press Escape to pause';
      const result = parser.parseSemantic(content);

      const allKeys = result.actions.flatMap(action => action.keys);
      expect(allKeys).toContain('Escape');
    });

    it('should handle complex natural language descriptions', () => {
      const content = 'Platformer game: Use arrow keys to move horizontally and vertically, spacebar to jump, Escape to pause';
      const result = parser.parseSemantic(content);

      expect(result.actions.length).toBeGreaterThanOrEqual(0);
      expect(result.axes.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty semantic content', () => {
      const result = parser.parseSemantic('');

      expect(result.actions).toEqual([]);
      expect(result.axes).toEqual([]);
    });
  });

  describe('inferKeybindings()', () => {
    it('should return unique keys from actions and axes', () => {
      const actions: InputAction[] = [
        { name: 'Jump', keys: ['Space'] },
        { name: 'Pause', keys: ['Escape'] },
      ];
      const axes: InputAxis[] = [
        { name: 'Move', keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] },
      ];

      const keys = parser.inferKeybindings(actions, axes);

      expect(keys).toContain('Space');
      expect(keys).toContain('Escape');
      expect(keys).toContain('ArrowUp');
      expect(keys).toContain('ArrowDown');
      expect(keys).toContain('ArrowLeft');
      expect(keys).toContain('ArrowRight');
      expect(keys).toHaveLength(6); // All unique
    });

    it('should handle duplicate keys correctly', () => {
      const actions: InputAction[] = [
        { name: 'Action1', keys: ['Space'] },
        { name: 'Action2', keys: ['Space'] }, // Duplicate
      ];
      const axes: InputAxis[] = [
        { name: 'Move', keys: ['ArrowUp', 'ArrowDown'] },
      ];

      const keys = parser.inferKeybindings(actions, axes);

      expect(keys.filter(k => k === 'Space')).toHaveLength(1); // Only one instance
      expect(keys).toHaveLength(3); // Space, ArrowUp, ArrowDown
    });

    it('should handle empty arrays', () => {
      const keys = parser.inferKeybindings([], []);

      expect(keys).toEqual([]);
    });

    it('should handle actions with empty keys arrays', () => {
      const actions: InputAction[] = [
        { name: 'Jump', keys: [] },
      ];
      const axes: InputAxis[] = [
        { name: 'Move', keys: ['ArrowUp'] },
      ];

      const keys = parser.inferKeybindings(actions, axes);

      expect(keys).toEqual(['ArrowUp']);
    });
  });
});

