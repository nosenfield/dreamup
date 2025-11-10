/**
 * Unit tests for AdaptiveQALoop.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { AdaptiveQALoop } from '../../src/core/adaptive-qa-loop';
import type { AdaptiveLoopResult } from '../../src/core/adaptive-qa-loop';
import { Logger } from '../../src/utils/logger';
import type { AnyPage } from '@browserbasehq/stagehand';
import type { StateAnalyzer } from '../../src/core/state-analyzer';
import type { GameInteractor } from '../../src/core/game-interactor';
import type { AdaptiveTestConfig } from '../../src/types/config.types';
import type { GameMetadata, Action, CapturedState, ActionGroups } from '../../src/types';

describe('AdaptiveQALoop', () => {
  let logger: Logger;
  let mockStateAnalyzer: StateAnalyzer;
  let mockGameInteractor: GameInteractor;
  let config: AdaptiveTestConfig;
  let metadata: GameMetadata | undefined;
  let loop: AdaptiveQALoop;
  let mockPage: AnyPage;

  beforeEach(() => {
    logger = new Logger({ module: 'test' });
    
    // Mock StateAnalyzer
    // Default: Return groups for first iteration, then empty groups to terminate
    mockStateAnalyzer = {
      analyzeAndRecommendAction: mock(() => Promise.resolve([
        {
          reasoning: 'Test strategy',
          confidence: 0.9,
          actions: [
            {
              action: 'click',
              target: { x: 100, y: 200 },
              reasoning: 'Test recommendation',
              confidence: 0.9,
              alternatives: [],
            },
          ],
        },
      ] as ActionGroups)).mockImplementationOnce(() => Promise.resolve([
        {
          reasoning: 'Test strategy',
          confidence: 0.9,
          actions: [
            {
              action: 'click',
              target: { x: 100, y: 200 },
              reasoning: 'Test recommendation',
              confidence: 0.9,
              alternatives: [],
            },
          ],
        },
      ] as ActionGroups)).mockImplementationOnce(() => Promise.resolve([] as ActionGroups)),
      hasStateProgressed: mock(() => Promise.resolve(false)), // Default: no state progression to terminate
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
      maxBudget: 0.50,
      maxDuration: 240000,
      maxActions: 20,
      screenshotStrategy: 'fixed',
      llmCallStrategy: 'eager',
    };

    metadata = undefined;
    loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);
    mockPage = {} as AnyPage;
  });

  describe('constructor', () => {
    it('should create AdaptiveQALoop with all dependencies', () => {
      expect(loop).toBeDefined();
    });
  });

  describe('run', () => {
    it('should return AdaptiveLoopResult', async () => {
      // Ensure loop terminates properly
      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValue(false);
      
      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);
      
      const result = await loop.run(mockPage);

      expect(result).toBeDefined();
      expect(result.screenshots).toBeInstanceOf(Array);
      expect(result.actionHistory).toBeInstanceOf(Array);
      expect(result.stateCheckCount).toBeGreaterThanOrEqual(0);
      expect(result.estimatedCost).toBeGreaterThanOrEqual(0);
      expect(['max_duration', 'budget_limit', 'llm_complete', 'zero_successful_groups', 'error']).toContain(result.completionReason);
    }, 10000);

    it('should capture initial state', async () => {
      // Ensure loop terminates properly
      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValue(false);
      
      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);
      
      await loop.run(mockPage);

      expect(mockGameInteractor.captureCurrentState).toHaveBeenCalled();
    }, 10000);

    it('should terminate when zero successful groups', async () => {
      // Mock hasStateProgressed to return false (no state progression)
      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValue(false);
      
      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      const result = await loop.run(mockPage);

      expect(result.completionReason).toBe('zero_successful_groups');
    }, 10000);

    it('should terminate when LLM recommends completion', async () => {
      // Mock to return zero groups (LLM says no more strategies)
      // Reset the default mock implementation
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockReset();
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockResolvedValue([] as ActionGroups);

      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);
      
      const result = await loop.run(mockPage);

      expect(result.completionReason).toBe('llm_complete');
    }, 10000);

    it('should execute recommended actions', async () => {
      // Reset mocks to ensure proper termination
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockResolvedValueOnce([
        {
          reasoning: 'Test strategy',
          confidence: 0.9,
          actions: [
            {
              action: 'click',
              target: { x: 100, y: 200 },
              reasoning: 'Test recommendation',
              confidence: 0.9,
              alternatives: [],
            },
          ],
        },
      ] as ActionGroups).mockResolvedValueOnce([] as ActionGroups);
      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValue(false);
      
      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      await loop.run(mockPage);

      expect(mockGameInteractor.executeRecommendationPublic).toHaveBeenCalled();
    }, 10000);

    it('should try all actions in a group in sequence', async () => {
      // Reset mocks to ensure clean state
      (mockGameInteractor.executeRecommendationPublic as ReturnType<typeof mock>).mockReset();
      (mockGameInteractor.executeRecommendationPublic as ReturnType<typeof mock>).mockResolvedValue(true);
      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValue(false); // Terminate after first iteration
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockReset();
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockResolvedValueOnce([
        {
          reasoning: 'Test strategy with multiple actions',
          confidence: 0.9,
          actions: [
            {
              action: 'click',
              target: { x: 100, y: 200 },
              reasoning: 'First action',
              confidence: 0.9,
              alternatives: [],
            },
            {
              action: 'click',
              target: { x: 150, y: 250 },
              reasoning: 'Second action',
              confidence: 0.8,
              alternatives: [],
            },
            {
              action: 'click',
              target: { x: 200, y: 300 },
              reasoning: 'Third action',
              confidence: 0.7,
              alternatives: [],
            },
          ],
        },
      ] as ActionGroups).mockResolvedValueOnce([] as ActionGroups); // Terminate after first iteration

      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      await loop.run(mockPage);

      // Should try ALL 3 actions in the group in sequence
      expect(mockGameInteractor.executeRecommendationPublic).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should check state progression after each group', async () => {
      (mockGameInteractor.executeRecommendationPublic as ReturnType<typeof mock>).mockResolvedValue(true);
      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValue(false); // Terminate after first iteration
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockResolvedValueOnce([
        {
          reasoning: 'Test strategy',
          confidence: 0.9,
          actions: [
            {
              action: 'click',
              target: { x: 100, y: 200 },
              reasoning: 'First action',
              confidence: 0.9,
              alternatives: [],
            },
            {
              action: 'click',
              target: { x: 150, y: 250 },
              reasoning: 'Second action',
              confidence: 0.8,
              alternatives: [],
            },
          ],
        },
      ] as ActionGroups).mockResolvedValueOnce([] as ActionGroups); // Terminate after first iteration

      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      await loop.run(mockPage);

      // Should check state progression after the group (1 group = 1 check)
      expect(mockStateAnalyzer.hasStateProgressed).toHaveBeenCalledTimes(1);
    }, 10000);

    it('should track success and stateProgressed for each action', async () => {
      (mockGameInteractor.executeRecommendationPublic as ReturnType<typeof mock>).mockResolvedValue(true);
      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValueOnce(true);
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockResolvedValueOnce([
        {
          reasoning: 'Test strategy',
          confidence: 0.9,
          actions: [
            {
              action: 'click',
              target: { x: 100, y: 200 },
              reasoning: 'Test action',
              confidence: 0.9,
              alternatives: [],
            },
          ],
        },
      ] as ActionGroups);

      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      const result = await loop.run(mockPage);

      // Check that action has mandatory fields
      expect(result.actionHistory.length).toBeGreaterThan(0);
      const action = result.actionHistory[0];
      expect(action).toHaveProperty('success');
      expect(action).toHaveProperty('stateProgressed');
      expect(typeof action.success).toBe('boolean');
      expect(typeof action.stateProgressed).toBe('boolean');
    }, 10000);

    it('should track failed actions', async () => {
      (mockGameInteractor.executeRecommendationPublic as ReturnType<typeof mock>).mockResolvedValue(false);
      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValueOnce(false);
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockResolvedValueOnce([
        {
          reasoning: 'Failed strategy',
          confidence: 0.9,
          actions: [
            {
              action: 'click',
              target: { x: 100, y: 200 },
              reasoning: 'Failed action',
              confidence: 0.9,
              alternatives: [],
            },
          ],
        },
      ] as ActionGroups);

      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      const result = await loop.run(mockPage);

      // Failed actions should still be tracked
      expect(result.actionHistory.length).toBe(1);
      const action = result.actionHistory[0];
      expect(action.success).toBe(false);
      expect(action.stateProgressed).toBe(false);
    }, 10000);

    it('should calculate estimated cost', async () => {
      // Make hasStateProgressed return false to terminate after first iteration
      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValue(false);
      
      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      const result = await loop.run(mockPage);

      expect(result.estimatedCost).toBeGreaterThanOrEqual(0);
    }, 10000);

    it('should log phase banners', async () => {
      const beginPhaseSpy = mock();
      const endPhaseSpy = mock();
      logger.beginPhase = beginPhaseSpy;
      logger.endPhase = endPhaseSpy;

      // Make hasStateProgressed return false to terminate after first iteration
      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValue(false);
      
      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      await loop.run(mockPage);

      expect(beginPhaseSpy).toHaveBeenCalled();
      expect(endPhaseSpy).toHaveBeenCalled();
    }, 10000);

    it('should execute groups in confidence order (highest first)', async () => {
      const executionOrder: number[] = [];
      
      (mockGameInteractor.executeRecommendationPublic as ReturnType<typeof mock>).mockReset();
      (mockGameInteractor.executeRecommendationPublic as ReturnType<typeof mock>).mockImplementation(async (page, recommendation) => {
        // Track execution order by confidence
        executionOrder.push(recommendation.confidence);
        return true;
      });

      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValue(false); // Terminate after first iteration
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockReset();
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockResolvedValueOnce([
        {
          reasoning: 'Low confidence strategy',
          confidence: 0.5,
          actions: [
            {
              action: 'click',
              target: { x: 100, y: 200 },
              reasoning: 'Low confidence action',
              confidence: 0.5,
              alternatives: [],
            },
          ],
        },
        {
          reasoning: 'High confidence strategy',
          confidence: 0.9,
          actions: [
            {
              action: 'click',
              target: { x: 200, y: 300 },
              reasoning: 'High confidence action',
              confidence: 0.9,
              alternatives: [],
            },
          ],
        },
        {
          reasoning: 'Medium confidence strategy',
          confidence: 0.7,
          actions: [
            {
              action: 'click',
              target: { x: 300, y: 400 },
              reasoning: 'Medium confidence action',
              confidence: 0.7,
              alternatives: [],
            },
          ],
        },
      ] as ActionGroups);

      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      await loop.run(mockPage);

      // Should execute in confidence order: 0.9, 0.7, 0.5 (highest first)
      // Note: Since hasStateProgressed returns false, only the first group executes before termination
      // But we can still verify the order of groups that were attempted
      expect(executionOrder.length).toBeGreaterThanOrEqual(1);
      if (executionOrder.length >= 3) {
        expect(executionOrder[0]).toBe(0.9); // Highest confidence first
        expect(executionOrder[1]).toBe(0.7); // Medium confidence second
        expect(executionOrder[2]).toBe(0.5); // Lowest confidence last
      } else {
        // If only one group executed, it should be the highest confidence one
        expect(executionOrder[0]).toBe(0.9);
      }
    }, 15000);

    it('should track successful groups across iterations', async () => {
      let iterationNumber = 0;
      const successfulGroupsPassed: any[] = [];

      (mockGameInteractor.executeRecommendationPublic as ReturnType<typeof mock>).mockReset();
      (mockGameInteractor.executeRecommendationPublic as ReturnType<typeof mock>).mockResolvedValue(true);
      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValue(true);
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockReset();
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockImplementation(async (state, iterNum, successfulGroups) => {
        iterationNumber = iterNum;
        if (successfulGroups) {
          successfulGroupsPassed.push(successfulGroups);
        }

        if (iterNum === 1) {
          return [
            {
              reasoning: 'Iteration 1 strategy',
              confidence: 0.9,
              actions: [
                {
                  action: 'click',
                  target: { x: 100, y: 200 },
                  reasoning: 'Iteration 1 action',
                  confidence: 0.9,
                  alternatives: [],
                },
              ],
            },
          ] as ActionGroups;
        } else if (iterNum === 2) {
          return [
            {
              reasoning: 'Iteration 2 strategy',
              confidence: 0.85,
              actions: [
                {
                  action: 'click',
                  target: { x: 150, y: 250 },
                  reasoning: 'Iteration 2 action',
                  confidence: 0.85,
                  alternatives: [],
                },
              ],
            },
          ] as ActionGroups;
        } else {
          // Terminate after iteration 2
          return [] as ActionGroups;
        }
      });

      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      await loop.run(mockPage);

      // Should have called analyzeAndRecommendAction for iteration 2 with successful groups
      expect(iterationNumber).toBeGreaterThanOrEqual(2);
      expect(successfulGroupsPassed.length).toBeGreaterThan(0);
      expect(successfulGroupsPassed[0]).toBeDefined();
      expect(Array.isArray(successfulGroupsPassed[0])).toBe(true);
      expect(successfulGroupsPassed[0].length).toBeGreaterThan(0);
      expect(successfulGroupsPassed[0][0]).toHaveProperty('reasoning');
      expect(successfulGroupsPassed[0][0]).toHaveProperty('actions');
      expect(successfulGroupsPassed[0][0]).toHaveProperty('confidence');
    }, 10000);

    it('should continue iterations when groups succeed', async () => {
      let iterationCount = 0;

      (mockGameInteractor.executeRecommendationPublic as ReturnType<typeof mock>).mockReset();
      (mockGameInteractor.executeRecommendationPublic as ReturnType<typeof mock>).mockResolvedValue(true);
      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValue(true);
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockReset();
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockImplementation(async (state, iterNum) => {
        iterationCount = Math.max(iterationCount, iterNum);
        
        if (iterNum >= 3) {
          // Terminate after iteration 3
          return [] as ActionGroups;
        }

        return [
          {
            reasoning: `Iteration ${iterNum} strategy`,
            confidence: 0.9,
            actions: [
              {
                action: 'click',
                target: { x: 100, y: 200 },
                reasoning: `Iteration ${iterNum} action`,
                confidence: 0.9,
                alternatives: [],
              },
            ],
          },
        ] as ActionGroups;
      });

      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      await loop.run(mockPage);

      // Should have continued to at least iteration 3
      expect(iterationCount).toBeGreaterThanOrEqual(3);
    }, 10000);

    it('should update current state after each group', async () => {
      let captureStateCallCount = 0;

      (mockGameInteractor.captureCurrentState as ReturnType<typeof mock>).mockReset();
      (mockGameInteractor.captureCurrentState as ReturnType<typeof mock>).mockImplementation(async (page) => {
        captureStateCallCount++;
        return {
          html: `<div>State ${captureStateCallCount}</div>`,
          screenshot: {
            id: `screenshot-${captureStateCallCount}`,
            path: `/tmp/screenshot-${captureStateCallCount}.png`,
            timestamp: Date.now(),
            stage: 'initial_load' as const,
          },
          timestamp: Date.now(),
        } as CapturedState;
      });

      (mockGameInteractor.executeRecommendationPublic as ReturnType<typeof mock>).mockReset();
      (mockGameInteractor.executeRecommendationPublic as ReturnType<typeof mock>).mockResolvedValue(true);
      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValue(false); // Terminate after first iteration
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockReset();
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockResolvedValueOnce([
        {
          reasoning: 'First group',
          confidence: 0.9,
          actions: [
            {
              action: 'click',
              target: { x: 100, y: 200 },
              reasoning: 'First action',
              confidence: 0.9,
              alternatives: [],
            },
          ],
        },
        {
          reasoning: 'Second group',
          confidence: 0.8,
          actions: [
            {
              action: 'click',
              target: { x: 150, y: 250 },
              reasoning: 'Second action',
              confidence: 0.8,
              alternatives: [],
            },
          ],
        },
      ] as ActionGroups);

      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      await loop.run(mockPage);

      // Should capture state multiple times: initial + after each group
      expect(captureStateCallCount).toBeGreaterThanOrEqual(3); // Initial + 2 groups
    }, 15000);

    it('should log iteration number and group details', async () => {
      const iterationSpy = mock();
      logger.iteration = iterationSpy;

      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValue(false);
      
      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      await loop.run(mockPage);

      // Should have logged iteration details
      expect(iterationSpy).toHaveBeenCalled();
      const iterationCalls = iterationSpy.mock.calls;
      expect(iterationCalls.length).toBeGreaterThan(0);
      
      // Check that iteration was called with iteration number and details
      const firstCall = iterationCalls[0];
      expect(firstCall[0]).toBe(1); // Iteration 1
      expect(firstCall[2]).toHaveProperty('elapsed');
    }, 10000);

    it('should handle multiple successful groups in one iteration', async () => {
      let successfulGroupsCount = 0;

      (mockGameInteractor.executeRecommendationPublic as ReturnType<typeof mock>).mockReset();
      (mockGameInteractor.executeRecommendationPublic as ReturnType<typeof mock>).mockResolvedValue(true);
      (mockStateAnalyzer.hasStateProgressed as ReturnType<typeof mock>).mockResolvedValue(true);
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockReset();
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockImplementation(async (state, iterNum, successfulGroups) => {
        if (successfulGroups) {
          successfulGroupsCount = successfulGroups.length;
        }

        if (iterNum === 1) {
          // Return 3 groups for iteration 1
          return [
            {
              reasoning: 'Strategy 1',
              confidence: 0.9,
              actions: [
                {
                  action: 'click',
                  target: { x: 100, y: 200 },
                  reasoning: 'Action 1',
                  confidence: 0.9,
                  alternatives: [],
                },
              ],
            },
            {
              reasoning: 'Strategy 2',
              confidence: 0.8,
              actions: [
                {
                  action: 'click',
                  target: { x: 150, y: 250 },
                  reasoning: 'Action 2',
                  confidence: 0.8,
                  alternatives: [],
                },
              ],
            },
            {
              reasoning: 'Strategy 3',
              confidence: 0.7,
              actions: [
                {
                  action: 'click',
                  target: { x: 200, y: 300 },
                  reasoning: 'Action 3',
                  confidence: 0.7,
                  alternatives: [],
                },
              ],
            },
          ] as ActionGroups;
        } else {
          // Terminate after iteration 1
          return [] as ActionGroups;
        }
      });

      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      await loop.run(mockPage);

      // All 3 groups should succeed and be passed to iteration 2
      expect(successfulGroupsCount).toBe(3);
    }, 10000);
  });
});

