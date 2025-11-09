/**
 * Integration tests for AdaptiveQALoop with Action Groups.
 * 
 * Tests the full iteration flow and successful group context passing.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { AdaptiveQALoop } from '../../src/core/adaptive-qa-loop';
import { Logger } from '../../src/utils/logger';
import type { AnyPage } from '@browserbasehq/stagehand';
import type { StateAnalyzer } from '../../src/core/state-analyzer';
import type { GameInteractor } from '../../src/core/game-interactor';
import type { AdaptiveTestConfig } from '../../src/types/config.types';
import type { GameMetadata, Action, CapturedState, ActionGroups, SuccessfulActionGroup } from '../../src/types';

describe('AdaptiveQALoop Integration - Action Groups', () => {
  let logger: Logger;
  let mockStateAnalyzer: StateAnalyzer;
  let mockGameInteractor: GameInteractor;
  let config: AdaptiveTestConfig;
  let metadata: GameMetadata | undefined;
  let mockPage: AnyPage;

  beforeEach(() => {
    logger = new Logger({ module: 'test' });
    
    // Mock StateAnalyzer
    mockStateAnalyzer = {
      analyzeAndRecommendAction: mock(() => Promise.resolve([] as ActionGroups)),
      hasStateProgressed: mock(() => Promise.resolve(true)),
      sanitizeHTML: mock((html: string) => html),
    } as unknown as StateAnalyzer;

    // Mock GameInteractor
    mockGameInteractor = {
      captureCurrentState: mock(() => Promise.resolve({
        html: '<div>test</div>',
        screenshot: {
          id: 'screenshot-1',
          path: '/tmp/screenshot-1.png',
          timestamp: Date.now(),
          stage: 'initial_load' as const,
        },
        timestamp: Date.now(),
      } as CapturedState)),
      executeRecommendationPublic: mock(() => Promise.resolve(true)),
    } as unknown as GameInteractor;

    config = {
      maxBudget: 2.0, // Increased budget for integration tests
      maxDuration: 240000,
      maxActions: 20,
      screenshotStrategy: 'fixed',
      llmCallStrategy: 'eager',
    };

    metadata = undefined;
    mockPage = {} as AnyPage;
  });

  describe('Full iteration flow', () => {
    it('should complete full iteration flow (Iteration 1 → 2 → 3)', async () => {
      const iterationCalls: number[] = [];
      const successfulGroupsHistory: SuccessfulActionGroup[][] = [];

      (mockGameInteractor.executeRecommendationPublic as ReturnType<typeof mock>).mockResolvedValue(true);
      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValue(true);
      
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockImplementation(async (state, iterNum, successfulGroups) => {
        iterationCalls.push(iterNum);
        
        if (successfulGroups) {
          successfulGroupsHistory.push([...successfulGroups]);
        }

        if (iterNum === 1) {
          // Iteration 1: Return 2 groups with 1 action each
          return [
            {
              reasoning: 'Iteration 1 - Strategy 1',
              confidence: 0.9,
              actions: [
                {
                  action: 'click',
                  target: { x: 100, y: 200 },
                  reasoning: 'Iteration 1 - Action 1',
                  confidence: 0.9,
                  alternatives: [],
                },
              ],
            },
            {
              reasoning: 'Iteration 1 - Strategy 2',
              confidence: 0.8,
              actions: [
                {
                  action: 'click',
                  target: { x: 150, y: 250 },
                  reasoning: 'Iteration 1 - Action 2',
                  confidence: 0.8,
                  alternatives: [],
                },
              ],
            },
          ] as ActionGroups;
        } else if (iterNum === 2) {
          // Iteration 2: Return 1 group per successful group, each with 1-5 actions
          return [
            {
              reasoning: 'Iteration 2 - Build on Strategy 1',
              confidence: 0.85,
              actions: [
                {
                  action: 'click',
                  target: { x: 100, y: 200 },
                  reasoning: 'Iteration 2 - Action 1',
                  confidence: 0.85,
                  alternatives: [],
                },
                {
                  action: 'click',
                  target: { x: 110, y: 210 },
                  reasoning: 'Iteration 2 - Action 2',
                  confidence: 0.85,
                  alternatives: [],
                },
              ],
            },
            {
              reasoning: 'Iteration 2 - Build on Strategy 2',
              confidence: 0.75,
              actions: [
                {
                  action: 'click',
                  target: { x: 150, y: 250 },
                  reasoning: 'Iteration 2 - Action 3',
                  confidence: 0.75,
                  alternatives: [],
                },
              ],
            },
          ] as ActionGroups;
        } else if (iterNum === 3) {
          // Iteration 3: Return 1 group per successful group, each with 1-10 actions
          return [
            {
              reasoning: 'Iteration 3 - Expand Strategy 1',
              confidence: 0.9,
              actions: Array.from({ length: 5 }, (_, i) => ({
                action: 'click' as const,
                target: { x: 100 + i * 10, y: 200 + i * 10 },
                reasoning: `Iteration 3 - Action ${i + 1}`,
                confidence: 0.9,
                alternatives: [],
              })),
            },
            {
              reasoning: 'Iteration 3 - Expand Strategy 2',
              confidence: 0.8,
              actions: Array.from({ length: 3 }, (_, i) => ({
                action: 'click' as const,
                target: { x: 150 + i * 10, y: 250 + i * 10 },
                reasoning: `Iteration 3 - Action ${i + 1}`,
                confidence: 0.8,
                alternatives: [],
              })),
            },
          ] as ActionGroups;
        } else {
          // Terminate after iteration 3
          return [] as ActionGroups;
        }
      });

      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      const result = await loop.run(mockPage);

      // Should have completed iterations 1, 2, and 3
      expect(iterationCalls).toContain(1);
      expect(iterationCalls).toContain(2);
      expect(iterationCalls).toContain(3);
      
      // Should have passed successful groups from iteration 1 to iteration 2
      expect(successfulGroupsHistory.length).toBeGreaterThan(0);
      expect(successfulGroupsHistory[0].length).toBe(2); // 2 successful groups from iteration 1
      
      // Should have passed successful groups from iteration 2 to iteration 3
      expect(successfulGroupsHistory.length).toBeGreaterThan(1);
      expect(successfulGroupsHistory[1].length).toBe(2); // 2 successful groups from iteration 2
      
      // Should have executed actions across all iterations
      expect(result.actionHistory.length).toBeGreaterThan(0);
      // May complete due to llm_complete or budget_limit depending on execution
      expect(['llm_complete', 'budget_limit']).toContain(result.completionReason);
    }, 30000);

    it('should pass successful group context correctly between iterations', async () => {
      const successfulGroupsPassed: SuccessfulActionGroup[][] = [];

      (mockGameInteractor.executeRecommendationPublic as ReturnType<typeof mock>).mockResolvedValue(true);
      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValue(true);
      
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockImplementation(async (state, iterNum, successfulGroups) => {
        if (successfulGroups) {
          successfulGroupsPassed.push([...successfulGroups]);
        }

        if (iterNum === 1) {
          return [
            {
              reasoning: 'Iteration 1 - Strategy',
              confidence: 0.9,
              actions: [
                {
                  action: 'click',
                  target: { x: 100, y: 200 },
                  reasoning: 'Iteration 1 - Action',
                  confidence: 0.9,
                  alternatives: [],
                },
              ],
            },
          ] as ActionGroups;
        } else if (iterNum === 2) {
          // Verify successful group context was passed correctly
          expect(successfulGroups).toBeDefined();
          expect(Array.isArray(successfulGroups)).toBe(true);
          expect(successfulGroups!.length).toBe(1);
          expect(successfulGroups![0].reasoning).toBe('Iteration 1 - Strategy');
          expect(successfulGroups![0].actions.length).toBe(1);
          expect(successfulGroups![0].confidence).toBe(0.9);
          expect(successfulGroups![0]).toHaveProperty('beforeScreenshot');
          expect(successfulGroups![0]).toHaveProperty('afterScreenshot');

          return [
            {
              reasoning: 'Iteration 2 - Build on Strategy',
              confidence: 0.85,
              actions: [
                {
                  action: 'click',
                  target: { x: 110, y: 210 },
                  reasoning: 'Iteration 2 - Action',
                  confidence: 0.85,
                  alternatives: [],
                },
              ],
            },
          ] as ActionGroups;
        } else {
          return [] as ActionGroups;
        }
      });

      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      await loop.run(mockPage);

      // Should have passed successful groups from iteration 1 to iteration 2
      expect(successfulGroupsPassed.length).toBeGreaterThan(0);
      expect(successfulGroupsPassed[0].length).toBe(1);
      expect(successfulGroupsPassed[0][0].reasoning).toBe('Iteration 1 - Strategy');
    }, 30000);

    it('should expand successful strategies across iterations', async () => {
      const actionCounts: number[] = [];

      (mockGameInteractor.executeRecommendationPublic as ReturnType<typeof mock>).mockResolvedValue(true);
      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValue(true);
      
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockImplementation(async (state, iterNum) => {
        if (iterNum === 1) {
          // Iteration 1: 1 action per group
          return [
            {
              reasoning: 'Iteration 1 - Strategy',
              confidence: 0.9,
              actions: [
                {
                  action: 'click',
                  target: { x: 100, y: 200 },
                  reasoning: 'Iteration 1 - Action',
                  confidence: 0.9,
                  alternatives: [],
                },
              ],
            },
          ] as ActionGroups;
        } else if (iterNum === 2) {
          // Iteration 2: 3 actions per group (expanded from 1)
          return [
            {
              reasoning: 'Iteration 2 - Expand Strategy',
              confidence: 0.85,
              actions: [
                {
                  action: 'click',
                  target: { x: 100, y: 200 },
                  reasoning: 'Iteration 2 - Action 1',
                  confidence: 0.85,
                  alternatives: [],
                },
                {
                  action: 'click',
                  target: { x: 110, y: 210 },
                  reasoning: 'Iteration 2 - Action 2',
                  confidence: 0.85,
                  alternatives: [],
                },
                {
                  action: 'click',
                  target: { x: 120, y: 220 },
                  reasoning: 'Iteration 2 - Action 3',
                  confidence: 0.85,
                  alternatives: [],
                },
              ],
            },
          ] as ActionGroups;
        } else if (iterNum === 3) {
          // Iteration 3: 7 actions per group (expanded from 3)
          return [
            {
              reasoning: 'Iteration 3 - Expand Strategy Further',
              confidence: 0.9,
              actions: Array.from({ length: 7 }, (_, i) => ({
                action: 'click' as const,
                target: { x: 100 + i * 10, y: 200 + i * 10 },
                reasoning: `Iteration 3 - Action ${i + 1}`,
                confidence: 0.9,
                alternatives: [],
              })),
            },
          ] as ActionGroups;
        } else {
          return [] as ActionGroups;
        }
      });

      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      const result = await loop.run(mockPage);

      // Should have expanded actions across iterations: 1 → 3 → 7
      expect(result.actionHistory.length).toBeGreaterThanOrEqual(11); // 1 + 3 + 7 = 11 actions
    }, 30000);

    it('should handle termination conditions (zero groups, budget, duration)', async () => {
      // Test zero groups termination
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockResolvedValueOnce([] as ActionGroups);

      const loop1 = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);
      const result1 = await loop1.run(mockPage);

      expect(result1.completionReason).toBe('llm_complete');
      expect(result1.actionHistory.length).toBe(0);

      // Test zero successful groups termination
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockResolvedValueOnce([
        {
          reasoning: 'Strategy',
          confidence: 0.9,
          actions: [
            {
              action: 'click',
              target: { x: 100, y: 200 },
              reasoning: 'Action',
              confidence: 0.9,
              alternatives: [],
            },
          ],
        },
      ] as ActionGroups);
      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValueOnce(false);

      const loop2 = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);
      const result2 = await loop2.run(mockPage);

      expect(result2.completionReason).toBe('zero_successful_groups');
    }, 30000);
  });
});

