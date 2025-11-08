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
import type { GameMetadata, Action, CapturedState, ActionRecommendation } from '../../src/types';

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
    mockStateAnalyzer = {
      analyzeAndRecommendAction: mock(() => Promise.resolve({
        action: 'click',
        target: { x: 100, y: 200 },
        reasoning: 'Test recommendation',
        confidence: 0.9,
        alternatives: [],
      } as ActionRecommendation)),
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
      config.maxActions = 1;
      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);
      
      const result = await loop.run(mockPage);

      expect(result).toBeDefined();
      expect(result.screenshots).toBeInstanceOf(Array);
      expect(result.actionHistory).toBeInstanceOf(Array);
      expect(result.stateCheckCount).toBeGreaterThanOrEqual(0);
      expect(result.estimatedCost).toBeGreaterThanOrEqual(0);
      expect(['max_actions', 'max_duration', 'budget_limit', 'llm_complete', 'error']).toContain(result.completionReason);
    }, 10000);

    it('should capture initial state', async () => {
      config.maxActions = 1;
      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);
      
      await loop.run(mockPage);

      expect(mockGameInteractor.captureCurrentState).toHaveBeenCalled();
    }, 10000);

    it('should terminate at maxActions', async () => {
      config.maxActions = 2;
      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      const result = await loop.run(mockPage);

      expect(result.completionReason).toBe('max_actions');
      expect(result.actionHistory.length).toBeLessThanOrEqual(2);
    }, 10000);

    it('should terminate when LLM recommends completion', async () => {
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockResolvedValueOnce({
        action: 'complete',
        target: '',
        reasoning: 'Test complete',
        confidence: 1.0,
        alternatives: [],
      } as ActionRecommendation);

      config.maxActions = 20;
      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);
      
      const result = await loop.run(mockPage);

      expect(result.completionReason).toBe('llm_complete');
    }, 10000);

    it('should execute recommended actions', async () => {
      config.maxActions = 1;
      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      await loop.run(mockPage);

      expect(mockGameInteractor.executeRecommendationPublic).toHaveBeenCalled();
    }, 10000);

    it('should try alternatives when primary action fails', async () => {
      (mockGameInteractor.executeRecommendationPublic as ReturnType<typeof mock>).mockResolvedValueOnce(false);
      (mockStateAnalyzer.analyzeAndRecommendAction as ReturnType<typeof mock>).mockResolvedValueOnce({
        action: 'click',
        target: { x: 100, y: 200 },
        reasoning: 'Test recommendation',
        confidence: 0.9,
        alternatives: [{
          action: 'click',
          target: { x: 150, y: 250 },
          reasoning: 'Alternative',
        }],
      } as ActionRecommendation);

      config.maxActions = 1;
      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      await loop.run(mockPage);

      // Should try primary, then alternative
      expect(mockGameInteractor.executeRecommendationPublic).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should check state progression', async () => {
      config.maxActions = 1;
      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      await loop.run(mockPage);

      expect(mockStateAnalyzer.hasStateProgressed).toHaveBeenCalled();
    }, 10000);

    it('should calculate estimated cost', async () => {
      config.maxActions = 1;
      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      const result = await loop.run(mockPage);

      expect(result.estimatedCost).toBeGreaterThanOrEqual(0);
    }, 10000);

    it('should log phase banners', async () => {
      const beginPhaseSpy = mock();
      const endPhaseSpy = mock();
      logger.beginPhase = beginPhaseSpy;
      logger.endPhase = endPhaseSpy;

      config.maxActions = 1;
      const loop = new AdaptiveQALoop(logger, mockStateAnalyzer, mockGameInteractor, config, metadata);

      await loop.run(mockPage);

      expect(beginPhaseSpy).toHaveBeenCalled();
      expect(endPhaseSpy).toHaveBeenCalled();
    }, 10000);
  });
});

