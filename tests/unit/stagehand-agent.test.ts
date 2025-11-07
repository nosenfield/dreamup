/**
 * Unit tests for Stagehand Agent utility functions.
 */

import { describe, test, expect } from 'bun:test';
import { buildStagehandInstruction, extractScreenshotsFromActions } from '../../src/utils/stagehand-agent.js';
import type { GameMetadata } from '../../src/types/index.js';

describe('buildStagehandInstruction', () => {
  test('returns generic instruction when no metadata provided', () => {
    const instruction = buildStagehandInstruction();

    expect(instruction).toContain('Play this browser game');
    expect(instruction).toContain('test basic functionality');
    expect(instruction).toContain('2 minutes');
  });

  test('includes genre from metadata', () => {
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
      genre: 'platformer',
      inputSchema: {
        type: 'semantic',
        content: 'Use WASD to move',
      },
    };

    const instruction = buildStagehandInstruction(metadata);

    expect(instruction).toContain('platformer game');
  });

  test('extracts actions from inputSchema (structured format)', () => {
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
      inputSchema: {
        type: 'javascript',
        content: '',
        actions: [
          { name: 'Jump', keys: ['Space'] },
          { name: 'Shoot', keys: ['KeyX'] },
        ],
      },
    };

    const instruction = buildStagehandInstruction(metadata);

    expect(instruction).toContain('Expected controls: Jump, Shoot');
  });

  test('extracts axes from inputSchema (structured format)', () => {
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
      inputSchema: {
        type: 'javascript',
        content: '',
        axes: [
          { name: 'MoveHorizontal', keys: ['ArrowLeft', 'ArrowRight'] },
        ],
      },
    };

    const instruction = buildStagehandInstruction(metadata);

    expect(instruction).toContain('Expected controls: MoveHorizontal');
  });

  test('handles string array format for actions/axes', () => {
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
      inputSchema: {
        type: 'semantic',
        content: 'Use WASD to move',
        actions: ['Pause', 'Restart'],
        axes: ['Move'],
      },
    };

    const instruction = buildStagehandInstruction(metadata);

    expect(instruction).toContain('Expected controls: Pause, Restart, Move');
  });

  test('uses testingStrategy.instructions if available', () => {
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
      inputSchema: {
        type: 'semantic',
        content: 'Use arrow keys',
      },
      testingStrategy: {
        waitBeforeInteraction: 2000,
        interactionDuration: 30000,
        instructions: 'Reach level 2; Collect at least 10 coins; Defeat the boss',
      },
    };

    const instruction = buildStagehandInstruction(metadata);

    expect(instruction).toContain('Reach level 2');
    expect(instruction).toContain('Collect at least 10 coins');
    expect(instruction).toContain('Defeat the boss');
  });

  test('uses default goals when testingStrategy.instructions missing', () => {
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
      genre: 'puzzle',
      inputSchema: {
        type: 'semantic',
        content: 'Click to play',
      },
    };

    const instruction = buildStagehandInstruction(metadata);

    expect(instruction).toContain('Start the game');
    expect(instruction).toContain('Test basic controls');
    expect(instruction).toContain('Try to progress through gameplay');
  });

  test('includes time-based completion criteria', () => {
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
      inputSchema: {
        type: 'semantic',
        content: 'Use arrow keys',
      },
    };

    const instruction = buildStagehandInstruction(metadata);

    expect(instruction).toContain('2 minutes');
    expect(instruction).toContain('completion point');
  });

  test('combines all metadata elements correctly (Pong example)', () => {
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
      genre: 'arcade',
      inputSchema: {
        type: 'javascript',
        content: '',
        actions: [{ name: 'Pause', keys: ['Escape'] }],
        axes: [{ name: 'RightPaddleVertical', keys: ['ArrowDown', 'ArrowUp'] }],
      },
      testingStrategy: {
        waitBeforeInteraction: 2000,
        interactionDuration: 30000,
        instructions: 'Start the game; Test paddle controls; Score at least one point',
      },
    };

    const instruction = buildStagehandInstruction(metadata);

    expect(instruction).toContain('arcade game');
    expect(instruction).toContain('Pause, RightPaddleVertical');
    expect(instruction).toContain('Start the game');
    expect(instruction).toContain('Test paddle controls');
    expect(instruction).toContain('Score at least one point');
  });

  test('handles empty arrays for actions/axes', () => {
    const metadata: GameMetadata = {
      metadataVersion: '1.0.0',
      inputSchema: {
        type: 'javascript',
        content: 'No controls defined',
        actions: [],
        axes: [],
      },
    };

    const instruction = buildStagehandInstruction(metadata);

    expect(instruction).not.toContain('Expected controls:');
    expect(instruction).toContain('Test this browser game');
  });

  test('handles missing inputSchema gracefully', () => {
    const metadata: Partial<GameMetadata> = {
      metadataVersion: '1.0.0',
      genre: 'puzzle',
    };

    // This should not throw - will use fallback
    const instruction = buildStagehandInstruction(metadata as GameMetadata);

    expect(typeof instruction).toBe('string');
    expect(instruction.length).toBeGreaterThan(0);
  });
});

describe('extractScreenshotsFromActions', () => {
  test('returns empty array when no actions', () => {
    const screenshots = extractScreenshotsFromActions([]);
    expect(screenshots).toEqual([]);
  });

  test('returns empty array when actions have no screenshot field', () => {
    const actions = [
      { type: 'click', reasoning: 'Click start', completed: false, url: 'https://example.com', timestamp: '2025-01-01' },
      { type: 'keypress', reasoning: 'Press space', completed: false, url: 'https://example.com', timestamp: '2025-01-01' },
    ];

    const screenshots = extractScreenshotsFromActions(actions);
    expect(screenshots).toEqual([]);
  });

  test('extracts screenshot field if present', () => {
    const actions = [
      { type: 'click', screenshot: '/path/to/screenshot1.png' },
      { type: 'keypress', screenshot: '/path/to/screenshot2.png' },
    ];

    const screenshots = extractScreenshotsFromActions(actions);
    expect(screenshots).toEqual(['/path/to/screenshot1.png', '/path/to/screenshot2.png']);
  });

  test('extracts screenshots array field if present', () => {
    const actions = [
      { type: 'click', screenshots: ['/path/1.png', '/path/2.png'] },
    ];

    const screenshots = extractScreenshotsFromActions(actions);
    expect(screenshots).toEqual(['/path/1.png', '/path/2.png']);
  });

  test('ignores non-string screenshot values', () => {
    const actions = [
      { type: 'click', screenshot: 123 },
      { type: 'keypress', screenshots: ['/valid.png', null, undefined, 456] },
    ];

    const screenshots = extractScreenshotsFromActions(actions);
    expect(screenshots).toEqual(['/valid.png']);
  });
});

