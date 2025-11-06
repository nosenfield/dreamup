/**
 * Vision Analyzer for GPT-4 Vision API integration.
 * 
 * This module provides a VisionAnalyzer class that uses OpenAI GPT-4 Vision
 * to analyze game screenshots, detect clickable elements, and identify crashes.
 * Uses structured outputs with Zod schemas for type-safe responses.
 * 
 * @module vision.analyzer
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { Logger } from '../utils/logger';
import { gameTestResultSchema, clickableElementSchema } from './schema';
import {
  GAME_ANALYSIS_PROMPT,
  FIND_CLICKABLE_ELEMENTS_PROMPT,
  DETECT_CRASH_PROMPT,
  buildGameAnalysisPrompt,
} from './prompts';
import type { Screenshot, ClickableElement, GameTestResult, GameMetadata } from '../types/game-test.types';
import { z } from 'zod';

/**
 * Configuration for VisionAnalyzer.
 */
export interface VisionAnalyzerConfig {
  /** Logger instance for structured logging */
  logger: Logger;
  
  /** Optional OpenAI API key (defaults to OPENAI_API_KEY env var) */
  apiKey?: string;
}

/**
 * Vision Analyzer class for analyzing game screenshots with GPT-4 Vision.
 * 
 * Provides methods for analyzing screenshots for playability, detecting
 * clickable elements, and identifying crashes.
 * 
 * @example
 * ```typescript
 * const logger = new Logger({ module: 'vision-analyzer' });
 * const analyzer = new VisionAnalyzer({ logger });
 * 
 * const result = await analyzer.analyzeScreenshots(screenshots);
 * const elements = await analyzer.findClickableElements('/path/to/screenshot.png');
 * const isCrash = await analyzer.detectCrash('/path/to/screenshot.png');
 * ```
 */
export class VisionAnalyzer {
  private readonly openai: ReturnType<typeof createOpenAI>;
  private readonly logger: Logger;

  /**
   * Create a new VisionAnalyzer instance.
   * 
   * @param config - Configuration object with logger and optional API key
   * @throws {Error} If OpenAI API key is not provided and not in environment
   */
  constructor(config: VisionAnalyzerConfig) {
    this.logger = config.logger;
    
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OpenAI API key is required. Provide it via config.apiKey or set OPENAI_API_KEY environment variable.'
      );
    }

    this.openai = createOpenAI({
      apiKey,
    });

    this.logger.info('VisionAnalyzer initialized', {
      hasApiKey: !!apiKey,
    });
  }

  /**
   * Analyze multiple screenshots to determine game playability.
   * 
   * Uses GPT-4 Vision to analyze a sequence of screenshots (initial load,
   * after interaction, final state) and returns a structured GameTestResult
   * with playability score, status, and identified issues.
   * 
   * @param screenshots - Array of Screenshot objects to analyze
   * @param metadata - Optional GameMetadata for context (expectedControls, genre)
   * @returns Promise that resolves to GameTestResult
   * @throws {Error} If screenshot files cannot be read or API call fails
   * 
   * @example
   * ```typescript
   * const result = await analyzer.analyzeScreenshots([
   *   { id: '1', path: '/tmp/screenshot1.png', timestamp: Date.now(), stage: 'initial_load' },
   *   { id: '2', path: '/tmp/screenshot2.png', timestamp: Date.now(), stage: 'after_interaction' },
   *   { id: '3', path: '/tmp/screenshot3.png', timestamp: Date.now(), stage: 'final_state' },
   * ], metadata);
   * ```
   */
  async analyzeScreenshots(
    screenshots: Screenshot[],
    metadata?: GameMetadata
  ): Promise<GameTestResult> {
    this.logger.info('Starting screenshot analysis', {
      screenshotCount: screenshots.length,
    });

    try {
      // Load screenshots and convert to base64
      const images = await Promise.all(
        screenshots.map(async (screenshot) => {
          const file = Bun.file(screenshot.path);
          const buffer = await file.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          return `data:image/png;base64,${base64}`;
        })
      );

      this.logger.debug('Screenshots loaded and converted to base64', {
        imageCount: images.length,
      });

      // Build prompt with metadata context if available
      const prompt = buildGameAnalysisPrompt(metadata);

      // Build multi-modal prompt content
      const content = [
        {
          type: 'text' as const,
          text: prompt,
        },
        ...images.map((image) => ({
          type: 'image' as const,
          image,
        })),
      ];

      // Call GPT-4 Vision with structured output
      const result = await generateObject({
        model: this.openai('gpt-4-turbo'),
        messages: [{ role: 'user' as const, content }],
        schema: gameTestResultSchema,
        temperature: 0.3,
      });

      // Extract token usage
      const tokenCount = this.countTokens(result.usage);
      if (tokenCount > 0) {
        this.logger.info('Vision analysis completed', {
          tokenCount,
          promptTokens: result.usage?.promptTokens,
          completionTokens: result.usage?.completionTokens,
        });
      }

      // Update screenshots array with actual paths
      const gameTestResult: GameTestResult = {
        ...result.object,
        screenshots: screenshots.map((s) => s.path),
      };

      return gameTestResult;
    } catch (error) {
      this.logger.error('Failed to analyze screenshots', {
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        screenshotCount: screenshots.length,
      });

      throw new Error(
        `Failed to analyze screenshots: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Find clickable elements in a game screenshot.
   * 
   * Uses GPT-4 Vision to detect UI elements (buttons, links, interactive areas)
   * that can be clicked in the game screenshot.
   * 
   * @param screenshotPath - File path to the screenshot image
   * @returns Promise that resolves to array of ClickableElement objects
   * 
   * @example
   * ```typescript
   * const elements = await analyzer.findClickableElements('/tmp/screenshot.png');
   * // Returns: [{ label: 'Start Button', x: 400, y: 300, confidence: 0.95 }, ...]
   * ```
   */
  async findClickableElements(screenshotPath: string): Promise<ClickableElement[]> {
    this.logger.info('Finding clickable elements', {
      screenshotPath,
    });

    try {
      // Load screenshot and convert to base64
      const file = Bun.file(screenshotPath);
      if (!(await file.exists())) {
        this.logger.warn('Screenshot file does not exist', { screenshotPath });
        return [];
      }

      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const imageDataUri = `data:image/png;base64,${base64}`;

      // Build multi-modal prompt content
      const content = [
        {
          type: 'text' as const,
          text: FIND_CLICKABLE_ELEMENTS_PROMPT,
        },
        {
          type: 'image' as const,
          image: imageDataUri,
        },
      ];

      // Call GPT-4 Vision with structured output
      // NOTE: AI SDK requires root schema to be an object, not an array
      // So we wrap the array in an object with an 'elements' property
      const result = await generateObject({
        model: this.openai('gpt-4o'),
        messages: [{ role: 'user' as const, content }],
        schema: z.object({
          elements: z.array(clickableElementSchema),
        }),
        temperature: 0.3,
      });

      this.logger.info('Clickable elements found', {
        elementCount: result.object.elements.length,
      });

      return result.object.elements;
    } catch (error) {
      this.logger.warn('Failed to find clickable elements', {
        error: error instanceof Error ? error.message : String(error),
        screenshotPath,
      });

      // Return empty array on error (non-critical operation)
      return [];
    }
  }

  /**
   * Detect if a screenshot shows a crashed or error state.
   * 
   * Uses GPT-4 Vision to analyze a screenshot and determine if the game
   * has crashed, shown an error, or is in an unrecoverable state.
   * 
   * @param screenshotPath - File path to the screenshot image
   * @returns Promise that resolves to boolean (true if crash detected, false otherwise)
   * 
   * @example
   * ```typescript
   * const isCrash = await analyzer.detectCrash('/tmp/screenshot.png');
   * // Returns: true if crash detected, false otherwise
   * ```
   */
  async detectCrash(screenshotPath: string): Promise<boolean> {
    this.logger.info('Detecting crash state', {
      screenshotPath,
    });

    try {
      // Load screenshot and convert to base64
      const file = Bun.file(screenshotPath);
      if (!(await file.exists())) {
        this.logger.warn('Screenshot file does not exist', { screenshotPath });
        return false;
      }

      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const imageDataUri = `data:image/png;base64,${base64}`;

      // Build multi-modal prompt content
      const content = [
        {
          type: 'text' as const,
          text: DETECT_CRASH_PROMPT,
        },
        {
          type: 'image' as const,
          image: imageDataUri,
        },
      ];

      // Call GPT-4 Vision for text response
      const result = await generateText({
        model: this.openai('gpt-4-turbo'),
        messages: [{ role: 'user' as const, content }],
        temperature: 0.3,
      });

      // Parse response to determine if crash detected
      const responseText = result.text.toLowerCase();
      const crashKeywords = ['crash', 'error', 'failed', 'broken', 'frozen', 'blank'];
      const isCrash = crashKeywords.some((keyword) => responseText.includes(keyword));

      this.logger.info('Crash detection completed', {
        isCrash,
        responseLength: result.text.length,
      });

      return isCrash;
    } catch (error) {
      this.logger.warn('Failed to detect crash', {
        error: error instanceof Error ? error.message : String(error),
        screenshotPath,
      });

      // Return false on error (assume no crash)
      return false;
    }
  }

  /**
   * Count total tokens from API usage response.
   * 
   * @param usage - Usage object from API response (may be undefined)
   * @returns Total token count (prompt + completion), or 0 if unavailable
   */
  private countTokens(usage?: { promptTokens?: number; completionTokens?: number }): number {
    if (!usage) {
      return 0;
    }

    const promptTokens = usage.promptTokens || 0;
    const completionTokens = usage.completionTokens || 0;
    return promptTokens + completionTokens;
  }
}

