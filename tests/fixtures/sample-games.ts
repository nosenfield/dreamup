/**
 * Test fixtures for sample games used in comprehensive testing.
 * 
 * This module provides game URLs and expected results for testing
 * the QA agent with various game types (canvas, iframe, DOM).
 * 
 * @module fixtures.sample-games
 */

import type { GameType } from '../../src/types/game-test.types';
import type { GameMetadata } from '../../src/types';

/**
 * Expected result for a game test.
 */
export interface ExpectedGameResult {
  /** Expected game type detection */
  gameType: GameType;
  
  /** Expected playability score range (min, max) */
  playabilityScoreRange?: [number, number];
  
  /** Expected status (pass/fail/error) */
  expectedStatus?: 'pass' | 'fail' | 'error';
  
  /** Whether game should have console errors */
  hasConsoleErrors?: boolean;
  
  /** Whether game should load successfully */
  shouldLoad: boolean;
  
  /** Description of what to expect */
  description: string;
}

/**
 * Test game fixture with URL and expected results.
 */
export interface TestGameFixture {
  /** Game name/identifier */
  name: string;
  
  /** Game URL */
  url: string;
  
  /** Game type (canvas, iframe, DOM, or UNKNOWN) */
  gameType: GameType;
  
  /** Optional metadata for the game */
  metadata?: GameMetadata;
  
  /** Expected test results */
  expected: ExpectedGameResult;
  
  /** Notes about this game */
  notes?: string;
}

/**
 * Collection of test games for comprehensive testing.
 * 
 * These games are used for:
 * - Integration testing
 * - Manual testing validation
 * - Edge case testing
 */
export const TEST_GAMES: TestGameFixture[] = [
  // Canvas Games
  {
    name: 'Pong (Canvas)',
    url: 'https://example.com/pong',
    gameType: 'canvas' as GameType,
    expected: {
      gameType: 'canvas' as GameType,
      playabilityScoreRange: [70, 100],
      expectedStatus: 'pass',
      hasConsoleErrors: false,
      shouldLoad: true,
      description: 'Classic Pong game with canvas rendering',
    },
    notes: 'Simple canvas game, good for basic functionality testing',
  },
  {
    name: 'Snake (Canvas)',
    url: 'https://example.com/snake',
    gameType: 'canvas' as GameType,
    expected: {
      gameType: 'canvas' as GameType,
      playabilityScoreRange: [70, 100],
      expectedStatus: 'pass',
      hasConsoleErrors: false,
      shouldLoad: true,
      description: 'Classic Snake game with canvas rendering',
    },
    notes: 'More complex canvas game with multiple inputs',
  },
  
  // Iframe Games
  {
    name: 'Iframe Game Example',
    url: 'https://example.com/iframe-game',
    gameType: 'iframe' as GameType,
    expected: {
      gameType: 'iframe' as GameType,
      playabilityScoreRange: [60, 100],
      expectedStatus: 'pass',
      hasConsoleErrors: false,
      shouldLoad: true,
      description: 'Game embedded in iframe',
    },
    notes: 'Tests cross-origin iframe detection',
  },
  
  // DOM Games
  {
    name: 'DOM Game Example',
    url: 'https://example.com/dom-game',
    gameType: 'dom' as GameType,
    expected: {
      gameType: 'dom' as GameType,
      playabilityScoreRange: [50, 100],
      expectedStatus: 'pass',
      hasConsoleErrors: false,
      shouldLoad: true,
      description: 'Pure DOM-based game without canvas',
    },
    notes: 'Tests DOM game detection (like 2048)',
  },
  
  // Edge Cases
  {
    name: 'Slow Loading Game',
    url: 'https://example.com/slow-game',
    gameType: 'canvas' as GameType,
    expected: {
      gameType: 'canvas' as GameType,
      playabilityScoreRange: [0, 100],
      expectedStatus: 'pass',
      hasConsoleErrors: false,
      shouldLoad: true,
      description: 'Game that takes 30+ seconds to load',
    },
    notes: 'Tests timeout handling and patience',
  },
  {
    name: 'Broken Game (Crashes)',
    url: 'https://example.com/broken-game',
    gameType: 'canvas' as GameType,
    expected: {
      gameType: 'canvas' as GameType,
      playabilityScoreRange: [0, 50],
      expectedStatus: 'fail',
      hasConsoleErrors: true,
      shouldLoad: false,
      description: 'Game that crashes on load or interaction',
    },
    notes: 'Tests error detection and crash handling',
  },
];

/**
 * Get a test game fixture by name.
 * 
 * @param name - Name of the game fixture
 * @returns Test game fixture or undefined if not found
 */
export function getTestGame(name: string): TestGameFixture | undefined {
  return TEST_GAMES.find(game => game.name === name);
}

/**
 * Get all test games of a specific type.
 * 
 * @param gameType - Game type to filter by
 * @returns Array of test game fixtures matching the type
 */
export function getTestGamesByType(gameType: GameType): TestGameFixture[] {
  return TEST_GAMES.filter(game => game.gameType === gameType);
}

/**
 * Get all canvas games.
 */
export function getCanvasGames(): TestGameFixture[] {
  return getTestGamesByType('canvas' as GameType);
}

/**
 * Get all iframe games.
 */
export function getIframeGames(): TestGameFixture[] {
  return getTestGamesByType('iframe' as GameType);
}

/**
 * Get all DOM games.
 */
export function getDOMGames(): TestGameFixture[] {
  return getTestGamesByType('dom' as GameType);
}

/**
 * Get edge case games (slow loading, broken, etc.).
 */
export function getEdgeCaseGames(): TestGameFixture[] {
  return TEST_GAMES.filter(game => 
    game.name.includes('Slow') || 
    game.name.includes('Broken') ||
    game.name.includes('Edge')
  );
}

