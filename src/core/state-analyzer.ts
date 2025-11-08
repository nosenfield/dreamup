/**
 * State Analyzer for LLM-powered adaptive decision making.
 *
 * This module provides the StateAnalyzer class that uses GPT-4 Vision
 * to analyze game state and recommend next actions when heuristic
 * approaches fail.
 *
 * @module core.state-analyzer
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { Logger } from '../utils/logger';
import { STATE_ANALYSIS_PROMPT } from '../vision/prompts';
import { actionRecommendationsSchema } from '../vision/schema';
import type { GameState, ActionRecommendations } from '../types';

/**
 * Configuration for StateAnalyzer.
 */
export interface StateAnalyzerConfig {
  /** Logger instance for structured logging */
  logger: Logger;
  
  /** Optional OpenAI API key (defaults to OPENAI_API_KEY env var) */
  apiKey?: string;
}

/**
 * LLM-powered game state analyzer for adaptive decision making.
 * 
 * Uses GPT-4 Vision to analyze game state (HTML + screenshot + history)
 * and recommend next actions when heuristic approaches fail.
 * 
 * @example
 * ```typescript
 * const logger = new Logger({ module: 'qa-agent' });
 * const analyzer = new StateAnalyzer({ logger });
 * 
 * const recommendation = await analyzer.analyzeAndRecommendAction({
 *   html: sanitizedHTML,
 *   screenshot: '/path/to/screenshot.png',
 *   previousActions: [],
 *   goal: 'Find and click the start button'
 * });
 * 
 * if (recommendation.action === 'click') {
 *   await page.click(recommendation.target.x, recommendation.target.y);
 * }
 * ```
 */
export class StateAnalyzer {
  private readonly openai: ReturnType<typeof createOpenAI>;
  private readonly logger: Logger;

  /**
   * Create a new StateAnalyzer instance.
   * 
   * @param config - Configuration object with logger and optional API key
   * @throws {Error} If OpenAI API key is not provided and not in environment
   */
  constructor(config: StateAnalyzerConfig) {
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

    this.logger.info('StateAnalyzer initialized', {
      hasApiKey: !!apiKey,
    });
  }

  /**
   * Analyze current game state and recommend actions.
   * 
   * Uses GPT-4 Vision to analyze HTML structure and screenshot,
   * then recommends 1-20 actions to try in sequence to achieve the specified goal.
   * All actions will be attempted, not just the first successful one.
   * This is useful for idle games that require many clicks to progress.
   * 
   * @param state - Current game state (HTML + screenshot + history + goal)
   * @returns Promise that resolves to array of 1-20 ActionRecommendations
   * @throws {Error} If screenshot file cannot be read or API call fails
   * 
   * @example
   * ```typescript
   * const recommendations = await analyzer.analyzeAndRecommendAction({
   *   html: '<div>...</div>',
   *   screenshot: '/path/to/screenshot.png',
   *   previousActions: [],
   *   goal: 'Click multiple buttons to progress'
   * });
   * // Returns array of 1-20 actions to try in sequence
   * ```
   */
  async analyzeAndRecommendAction(
    state: GameState
  ): Promise<ActionRecommendations> {
    this.logger.info('Starting state analysis', {
      goal: state.goal,
      previousActionsCount: state.previousActions.length,
      hasMetadata: !!state.metadata,
    });

    try {
      // Load screenshot and convert to base64
      const file = Bun.file(state.screenshot);
      if (!(await file.exists())) {
        throw new Error(`Screenshot file not found: ${state.screenshot}`);
      }

      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const imageDataUri = `data:image/png;base64,${base64}`;

      this.logger.debug('Screenshot loaded and converted to base64', {
        screenshotPath: state.screenshot,
      });

      // Build prompt with state context
      const prompt = this.buildStateAnalysisPrompt(state);

      // Build multi-modal prompt content
      const content = [
        {
          type: 'text' as const,
          text: prompt,
        },
        {
          type: 'image' as const,
          image: imageDataUri,
        },
      ];

      // Call GPT-4 Vision with structured output
      const result = await generateObject({
        model: this.openai('gpt-4-turbo'),
        messages: [{ role: 'user' as const, content }],
        schema: actionRecommendationsSchema,
        temperature: 0.3,
      });

      const recommendations = result.object.recommendations;

      this.logger.info('State analysis completed', {
        actionCount: recommendations.length,
        actions: recommendations.map(r => ({
          action: r.action,
          confidence: r.confidence,
        })),
      });

      return recommendations;
    } catch (error) {
      this.logger.error('State analysis failed', {
        error: error instanceof Error ? error.message : String(error),
        screenshotPath: state.screenshot,
      });
      throw error;
    }
  }

  /**
   * Analyze if game state has progressed (screen changed).
   * 
   * Uses GPT-4 Vision to compare two screenshots and determine
   * if the game state has meaningfully changed. Used to detect
   * stuck states where actions don't produce results.
   * 
   * @param previousScreenshot - Path to previous screenshot
   * @param currentScreenshot - Path to current screenshot
   * @returns Promise that resolves to `true` if state progressed, `false` otherwise
   * 
   * @example
   * ```typescript
   * const progressed = await analyzer.hasStateProgressed(
   *   '/path/to/before.png',
   *   '/path/to/after.png'
   * );
   * if (!progressed) {
   *   console.log('Game state did not change - may be stuck');
   * }
   * ```
   */
  async hasStateProgressed(
    previousScreenshot: string,
    currentScreenshot: string
  ): Promise<boolean> {
    this.logger.debug('Checking state progression', {
      previousScreenshot,
      currentScreenshot,
    });

    try {
      // Load both screenshots
      const [prevFile, currFile] = await Promise.all([
        Bun.file(previousScreenshot),
        Bun.file(currentScreenshot),
      ]);

      if (!(await prevFile.exists()) || !(await currFile.exists())) {
        this.logger.warn('Screenshot files not found for state progression check', {
          previousExists: await prevFile.exists(),
          currentExists: await currFile.exists(),
        });
        return false; // Assume no progression if files missing
      }

      const [prevBuffer, currBuffer] = await Promise.all([
        prevFile.arrayBuffer(),
        currFile.arrayBuffer(),
      ]);

      const prevBase64 = Buffer.from(prevBuffer).toString('base64');
      const currBase64 = Buffer.from(currBuffer).toString('base64');

      const prevImage = `data:image/png;base64,${prevBase64}`;
      const currImage = `data:image/png;base64,${currBase64}`;

      // Simple prompt for comparison
      const prompt = `Compare these two game screenshots and determine if the game state has meaningfully changed.

**Previous Screenshot:** The state before an action was taken
**Current Screenshot:** The state after an action was taken

**Question:** Has the game state progressed? (e.g., screen changed, UI updated, game advanced)

Respond with ONLY "YES" if state has progressed, or "NO" if state is the same or stuck.`;

      const result = await generateText({
        model: this.openai('gpt-4-turbo'),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image', image: prevImage },
              { type: 'image', image: currImage },
            ],
          },
        ],
        temperature: 0.1, // Low temperature for consistent comparison
      });

      const text = result.text.trim().toUpperCase();
      const progressed = text.includes('YES');

      this.logger.debug('State progression check completed', {
        progressed,
        response: result.text.substring(0, 100),
      });

      return progressed;
    } catch (error) {
      this.logger.warn('State progression check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Assume progression if check fails (don't block on errors)
      return true;
    }
  }

  /**
   * Build state analysis prompt with context.
   * 
   * @param state - Game state with HTML, screenshot, history, and goal
   * @returns Prompt string with state context
   */
  private buildStateAnalysisPrompt(state: GameState): string {
    let prompt = STATE_ANALYSIS_PROMPT;

    // Add goal context
    prompt += `\n\n**Current Goal:** ${state.goal}`;

    // Add previous actions context with success/failure feedback
    if (state.previousActions.length > 0) {
      // Get last 20 actions for feedback (prioritize recent actions)
      const recentActions = state.previousActions.slice(-20);
      
      // Separate successful and failed actions
      const successfulActions = recentActions.filter(a => a.success && a.stateProgressed);
      const failedActions = recentActions.filter(a => !a.success || !a.stateProgressed);
      
      // Build patterns from successful actions
      if (successfulActions.length > 0) {
        prompt += `\n\n**✅ Successful Actions (Build on these patterns):**`;
        
        // Group successful actions by type and extract patterns
        const clickActions = successfulActions.filter(a => a.action === 'click' && typeof a.target === 'object');
        const keypressActions = successfulActions.filter(a => a.action === 'keypress');
        
        if (clickActions.length > 0) {
          prompt += `\n\n**Successful Click Patterns:**`;
          clickActions.slice(-10).forEach((action, index) => {
            const target = action.target as { x: number; y: number };
            prompt += `\n${index + 1}. Click at (${target.x}, ${target.y}) - ${action.reasoning}`;
            prompt += `\n   ✅ This action successfully changed game state.`;
          });
          prompt += `\n\n**Strategy:** Generate multiple related click actions around these successful coordinates. For example, if clicking at (400, 500) was successful, try clicking at nearby coordinates like (400, 510), (410, 500), (390, 500), etc.`;
        }
        
        if (keypressActions.length > 0) {
          prompt += `\n\n**Successful Keypress Patterns:**`;
          keypressActions.slice(-10).forEach((action, index) => {
            prompt += `\n${index + 1}. Keypress "${action.target}" - ${action.reasoning}`;
            prompt += `\n   ✅ This action successfully changed game state.`;
          });
          prompt += `\n\n**Strategy:** Continue using these successful keypress patterns.`;
        }
        
        // Show other successful actions
        const otherSuccessful = successfulActions.filter(a => 
          !(a.action === 'click' && typeof a.target === 'object') && a.action !== 'keypress'
        );
        if (otherSuccessful.length > 0) {
          prompt += `\n\n**Other Successful Actions:**`;
          otherSuccessful.slice(-5).forEach((action, index) => {
            prompt += `\n${index + 1}. ${action.action} on ${JSON.stringify(action.target)} - ${action.reasoning}`;
            prompt += `\n   ✅ This action successfully changed game state.`;
          });
        }
      }
      
      // Show failed actions to avoid repeating
      if (failedActions.length > 0) {
        prompt += `\n\n**❌ Failed Actions (Avoid repeating these):**`;
        failedActions.slice(-10).forEach((action, index) => {
          const failureReason = !action.success 
            ? 'execution failed' 
            : 'execution succeeded but state did not progress';
          prompt += `\n${index + 1}. ${action.action} on ${JSON.stringify(action.target)} - ${action.reasoning}`;
          prompt += `\n   ❌ ${failureReason}. Do not repeat this exact action.`;
        });
        prompt += `\n\n**Strategy:** Avoid repeating these exact failed actions. Try different approaches or coordinates.`;
      }
      
      // Summary of action outcomes
      const totalActions = recentActions.length;
      const successRate = successfulActions.length / totalActions;
      prompt += `\n\n**Action Outcome Summary:**`;
      prompt += `\n- Total actions: ${totalActions}`;
      prompt += `\n- Successful (executed + state progressed): ${successfulActions.length}`;
      prompt += `\n- Failed: ${failedActions.length}`;
      prompt += `\n- Success rate: ${(successRate * 100).toFixed(1)}%`;
      
      if (successRate > 0.5) {
        prompt += `\n\n**Note:** You're doing well! Continue building on successful patterns.`;
      } else if (successRate > 0.2) {
        prompt += `\n\n**Note:** Some actions are working. Focus on successful patterns and try variations.`;
      } else {
        prompt += `\n\n**Note:** Most actions are failing. Try completely different approaches or coordinates.`;
      }
    }

    // Add metadata context if available
    if (state.metadata) {
      if (state.metadata.expectedControls) {
        prompt += `\n\n**Expected Controls:** ${state.metadata.expectedControls}`;
      }
      if (state.metadata.genre) {
        prompt += `\n**Game Genre:** ${state.metadata.genre}`;
      }
    }

    // Add HTML context if available (limited to first 2000 chars to avoid token limits)
    if (state.html) {
      const htmlPreview = state.html.substring(0, 2000);
      prompt += `\n\n**HTML Structure (first 2000 chars):**\n${htmlPreview}`;
      if (state.html.length > 2000) {
        prompt += `\n[... HTML truncated, total length: ${state.html.length} chars]`;
      }
    }

    return prompt;
  }

  /**
   * Sanitize HTML content by removing scripts but preserving structure.
   * 
   * Useful for providing HTML context to LLM without including
   * executable JavaScript that could confuse the model.
   * 
   * @param html - Raw HTML content
   * @returns Sanitized HTML with scripts removed
   */
  sanitizeHTML(html: string): string {
    // Remove script tags and their content
    let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove style tags (optional, but reduces noise)
    sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // Remove event handlers from attributes (onclick, onload, etc.)
    sanitized = sanitized.replace(/\s+on\w+="[^"]*"/gi, '');
    sanitized = sanitized.replace(/\s+on\w+='[^']*'/gi, '');
    
    // Clean up excessive whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    return sanitized;
  }
}

