/**
 * OpenRouter provider service for Stagehand Agent model management.
 *
 * This module provides OpenRouter integration for flexible model selection
 * across multiple LLM providers (OpenAI, Anthropic, Google, etc.) specifically
 * for Stagehand Agent autonomous testing.
 *
 * @module services.openrouter-provider
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { Logger } from '../utils/logger';
import { OPENROUTER_DEFAULTS } from '../config/constants';
import type { OpenRouterConfig } from '../types/config.types';

/**
 * Configuration for OpenRouterProvider.
 */
export interface OpenRouterProviderConfig {
  /** Logger instance for structured logging */
  logger: Logger;

  /** Optional OpenRouter API key (defaults to OPENROUTER_API_KEY env var) */
  apiKey?: string;

  /** Optional agent model override (defaults to STAGEHAND_AGENT_MODEL env var) */
  agentModel?: string;

  /** Optional execution model override (defaults to STAGEHAND_EXECUTION_MODEL env var) */
  executionModel?: string;
}

/**
 * OpenRouter provider for Stagehand Agent model management.
 *
 * Provides initialization and configuration for OpenRouter models used
 * in Stagehand Agent autonomous testing mode.
 *
 * @example
 * ```typescript
 * const logger = new Logger({ module: 'stagehand-agent' });
 * const provider = new OpenRouterProvider({ logger });
 *
 * const { agentModel, executionModel } = provider.getModelConfig();
 * // Use in Stagehand agent initialization
 * ```
 */
export class OpenRouterProvider {
  private readonly openrouter: ReturnType<typeof createOpenRouter>;
  private readonly logger: Logger;
  private readonly config: OpenRouterConfig;

  /**
   * Create a new OpenRouterProvider instance.
   *
   * @param config - Configuration object with logger and optional API key/models
   * @throws {Error} If OpenRouter API key is not provided and not in environment
   */
  constructor(config: OpenRouterProviderConfig) {
    this.logger = config.logger;

    // Get API key from config or environment
    const apiKey = config.apiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OpenRouter API key is required for Stagehand Agent mode. ' +
        'Provide it via config.apiKey or set OPENROUTER_API_KEY environment variable. ' +
        'Get your key at: https://openrouter.ai/keys'
      );
    }

    // Get model configuration from config or environment
    const agentModel =
      config.agentModel ||
      process.env.STAGEHAND_AGENT_MODEL ||
      OPENROUTER_DEFAULTS.AGENT_MODEL;

    const executionModel =
      config.executionModel ||
      process.env.STAGEHAND_EXECUTION_MODEL ||
      OPENROUTER_DEFAULTS.EXECUTION_MODEL;

    // Store configuration
    this.config = {
      apiKey,
      agentModel,
      executionModel,
    };

    // Initialize OpenRouter provider
    this.openrouter = createOpenRouter({
      apiKey,
    });

    this.logger.info('OpenRouterProvider initialized', {
      agentModel: this.config.agentModel,
      executionModel: this.config.executionModel || '(uses agentModel)',
      hasApiKey: !!apiKey,
    });
  }

  /**
   * Get the configured agent model in provider/model format.
   *
   * @returns Agent model string (e.g., "anthropic/claude-3.5-sonnet")
   */
  getAgentModel(): string {
    return this.config.agentModel;
  }

  /**
   * Get the configured execution model in provider/model format.
   * Falls back to agent model if execution model not specified.
   *
   * @returns Execution model string or undefined (will use agent model)
   */
  getExecutionModel(): string | undefined {
    return this.config.executionModel;
  }

  /**
   * Get model configuration for Stagehand agent initialization.
   *
   * @returns Object with agentModel and optional executionModel
   */
  getModelConfig(): { agentModel: string; executionModel?: string } {
    return {
      agentModel: this.config.agentModel,
      executionModel: this.config.executionModel,
    };
  }

  /**
   * Get the OpenRouter provider instance for direct use.
   *
   * @returns OpenRouter provider instance from @openrouter/ai-sdk-provider
   */
  getProvider(): ReturnType<typeof createOpenRouter> {
    return this.openrouter;
  }

  /**
   * Get AI SDK model instance for use with AISdkClient.
   *
   * Creates and returns an AI SDK model instance from OpenRouter provider
   * that can be used with Stagehand's AISdkClient.
   *
   * @returns AI SDK model instance (from @ai-sdk/core)
   *
   * @example
   * ```typescript
   * const provider = new OpenRouterProvider({ logger });
   * const model = provider.getAISdkModel();
   * const llmClient = new AISdkClient({ model });
   * ```
   */
  getAISdkModel(): ReturnType<ReturnType<typeof createOpenRouter>> {
    const { agentModel } = this.getModelConfig();
    // Type assertion needed due to OpenRouter package type definitions
    // Runtime behavior is correct (verified by tests)
    return this.openrouter(agentModel) as ReturnType<ReturnType<typeof createOpenRouter>>;
  }

  /**
   * Get API key (for use in other contexts if needed).
   *
   * @returns OpenRouter API key
   */
  getApiKey(): string {
    return this.config.apiKey;
  }

  /**
   * Validate model format (must be in provider/model format).
   *
   * @param model - Model string to validate
   * @returns true if valid, false otherwise
   */
  static isValidModelFormat(model: string): boolean {
    // Model must be in format: provider/model-name
    // Examples: "anthropic/claude-3.5-sonnet", "openai/gpt-4o", "google/gemini-2.0-flash"
    return /^[a-z0-9-]+\/[a-z0-9.-]+$/i.test(model);
  }

  /**
   * Create OpenRouterConfig from environment variables.
   * Used for loading config from environment at runtime.
   *
   * @returns OpenRouterConfig object or undefined if API key missing
   */
  static fromEnvironment(): OpenRouterConfig | undefined {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return undefined;
    }

    return {
      apiKey,
      agentModel: process.env.STAGEHAND_AGENT_MODEL || OPENROUTER_DEFAULTS.AGENT_MODEL,
      executionModel: process.env.STAGEHAND_EXECUTION_MODEL || OPENROUTER_DEFAULTS.EXECUTION_MODEL,
    };
  }
}

