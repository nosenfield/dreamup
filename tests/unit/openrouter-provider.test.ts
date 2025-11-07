/**
 * Unit tests for OpenRouterProvider service.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { OpenRouterProvider, type OpenRouterProviderConfig } from '../../src/services/openrouter-provider';
import { Logger } from '../../src/utils/logger';
import { OPENROUTER_DEFAULTS } from '../../src/config/constants';

describe('OpenRouterProvider', () => {
  let logger: Logger;
  const originalEnv = process.env;

  beforeEach(() => {
    logger = new Logger({ module: 'test' });
    // Reset process.env before each test
    process.env = { ...originalEnv };
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.STAGEHAND_AGENT_MODEL;
    delete process.env.STAGEHAND_EXECUTION_MODEL;
  });

  afterEach(() => {
    // Restore original process.env after each test
    process.env = originalEnv;
  });

  describe('Constructor', () => {
    it('should throw error when API key is missing', () => {
      expect(() => {
        new OpenRouterProvider({ logger });
      }).toThrow('OpenRouter API key is required');
    });

    it('should use API key from config', () => {
      const provider = new OpenRouterProvider({
        logger,
        apiKey: 'test-api-key',
      });

      expect(provider.getApiKey()).toBe('test-api-key');
    });

    it('should fall back to OPENROUTER_API_KEY env var', () => {
      process.env.OPENROUTER_API_KEY = 'env-api-key';

      const provider = new OpenRouterProvider({ logger });

      expect(provider.getApiKey()).toBe('env-api-key');
    });

    it('should prioritize config API key over env var', () => {
      process.env.OPENROUTER_API_KEY = 'env-api-key';

      const provider = new OpenRouterProvider({
        logger,
        apiKey: 'config-api-key',
      });

      expect(provider.getApiKey()).toBe('config-api-key');
    });

    it('should use default agent model when not provided', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';

      const provider = new OpenRouterProvider({ logger });

      expect(provider.getAgentModel()).toBe(OPENROUTER_DEFAULTS.AGENT_MODEL);
    });

    it('should use STAGEHAND_AGENT_MODEL env var when provided', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      process.env.STAGEHAND_AGENT_MODEL = 'openai/gpt-4o';

      const provider = new OpenRouterProvider({ logger });

      expect(provider.getAgentModel()).toBe('openai/gpt-4o');
    });

    it('should use config.agentModel when provided', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';

      const provider = new OpenRouterProvider({
        logger,
        apiKey: 'test-key',
        agentModel: 'anthropic/claude-3-opus',
      });

      expect(provider.getAgentModel()).toBe('anthropic/claude-3-opus');
    });

    it('should prioritize config.agentModel over env var', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      process.env.STAGEHAND_AGENT_MODEL = 'openai/gpt-4o';

      const provider = new OpenRouterProvider({
        logger,
        apiKey: 'test-key',
        agentModel: 'google/gemini-2.0-flash',
      });

      expect(provider.getAgentModel()).toBe('google/gemini-2.0-flash');
    });

    it('should handle executionModel as undefined when not provided', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';

      const provider = new OpenRouterProvider({ logger });

      expect(provider.getExecutionModel()).toBeUndefined();
    });

    it('should use STAGEHAND_EXECUTION_MODEL env var when provided', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      process.env.STAGEHAND_EXECUTION_MODEL = 'openai/gpt-4o-mini';

      const provider = new OpenRouterProvider({ logger });

      expect(provider.getExecutionModel()).toBe('openai/gpt-4o-mini');
    });

    it('should use config.executionModel when provided', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';

      const provider = new OpenRouterProvider({
        logger,
        apiKey: 'test-key',
        executionModel: 'openai/gpt-4o-mini',
      });

      expect(provider.getExecutionModel()).toBe('openai/gpt-4o-mini');
    });

    it('should prioritize config.executionModel over env var', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      process.env.STAGEHAND_EXECUTION_MODEL = 'openai/gpt-4o-mini';

      const provider = new OpenRouterProvider({
        logger,
        apiKey: 'test-key',
        executionModel: 'anthropic/claude-3-haiku',
      });

      expect(provider.getExecutionModel()).toBe('anthropic/claude-3-haiku');
    });
  });

  describe('getAgentModel()', () => {
    it('should return configured agent model', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';

      const provider = new OpenRouterProvider({
        logger,
        apiKey: 'test-key',
        agentModel: 'anthropic/claude-3.5-sonnet',
      });

      expect(provider.getAgentModel()).toBe('anthropic/claude-3.5-sonnet');
    });
  });

  describe('getExecutionModel()', () => {
    it('should return undefined when execution model not set', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';

      const provider = new OpenRouterProvider({ logger });

      expect(provider.getExecutionModel()).toBeUndefined();
    });

    it('should return execution model when set', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';

      const provider = new OpenRouterProvider({
        logger,
        apiKey: 'test-key',
        executionModel: 'openai/gpt-4o-mini',
      });

      expect(provider.getExecutionModel()).toBe('openai/gpt-4o-mini');
    });
  });

  describe('getModelConfig()', () => {
    it('should return object with agentModel and optional executionModel', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';

      const provider = new OpenRouterProvider({
        logger,
        apiKey: 'test-key',
        agentModel: 'anthropic/claude-3.5-sonnet',
        executionModel: 'openai/gpt-4o-mini',
      });

      const config = provider.getModelConfig();

      expect(config).toEqual({
        agentModel: 'anthropic/claude-3.5-sonnet',
        executionModel: 'openai/gpt-4o-mini',
      });
    });

    it('should return object without executionModel when not set', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';

      const provider = new OpenRouterProvider({
        logger,
        apiKey: 'test-key',
        agentModel: 'anthropic/claude-3.5-sonnet',
      });

      const config = provider.getModelConfig();

      expect(config).toEqual({
        agentModel: 'anthropic/claude-3.5-sonnet',
        executionModel: undefined,
      });
    });
  });

  describe('getProvider()', () => {
    it('should return OpenRouter provider instance', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';

      const provider = new OpenRouterProvider({ logger });
      const openRouterProvider = provider.getProvider();

      expect(openRouterProvider).toBeDefined();
      expect(typeof openRouterProvider).toBe('function');
    });
  });

  describe('getAISdkModel()', () => {
    it('should return AI SDK model instance', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';

      const provider = new OpenRouterProvider({
        logger,
        apiKey: 'test-key',
        agentModel: 'anthropic/claude-3.5-sonnet',
      });

      const model = provider.getAISdkModel();

      expect(model).toBeDefined();
      // AI SDK models are objects with specific structure
      expect(typeof model).toBe('object');
    });
  });

  describe('getApiKey()', () => {
    it('should return API key', () => {
      const provider = new OpenRouterProvider({
        logger,
        apiKey: 'test-api-key',
      });

      expect(provider.getApiKey()).toBe('test-api-key');
    });
  });

  describe('isValidModelFormat()', () => {
    it('should validate correct provider/model format', () => {
      expect(OpenRouterProvider.isValidModelFormat('anthropic/claude-3.5-sonnet')).toBe(true);
      expect(OpenRouterProvider.isValidModelFormat('openai/gpt-4o')).toBe(true);
      expect(OpenRouterProvider.isValidModelFormat('google/gemini-2.0-flash')).toBe(true);
      expect(OpenRouterProvider.isValidModelFormat('meta-llama/llama-3.1-70b')).toBe(true);
    });

    it('should reject invalid format', () => {
      expect(OpenRouterProvider.isValidModelFormat('claude-3.5-sonnet')).toBe(false);
      expect(OpenRouterProvider.isValidModelFormat('anthropic')).toBe(false);
      expect(OpenRouterProvider.isValidModelFormat('anthropic/')).toBe(false);
      expect(OpenRouterProvider.isValidModelFormat('/claude-3.5-sonnet')).toBe(false);
      expect(OpenRouterProvider.isValidModelFormat('anthropic/claude-3.5-sonnet/extra')).toBe(false);
      expect(OpenRouterProvider.isValidModelFormat('')).toBe(false);
    });

    it('should handle case-insensitive validation', () => {
      expect(OpenRouterProvider.isValidModelFormat('ANTHROPIC/CLAUDE-3.5-SONNET')).toBe(true);
      expect(OpenRouterProvider.isValidModelFormat('OpenAI/GPT-4O')).toBe(true);
    });
  });

  describe('fromEnvironment()', () => {
    it('should return config when API key present', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      process.env.STAGEHAND_AGENT_MODEL = 'openai/gpt-4o';
      process.env.STAGEHAND_EXECUTION_MODEL = 'openai/gpt-4o-mini';

      const config = OpenRouterProvider.fromEnvironment();

      expect(config).toBeDefined();
      expect(config?.apiKey).toBe('test-key');
      expect(config?.agentModel).toBe('openai/gpt-4o');
      expect(config?.executionModel).toBe('openai/gpt-4o-mini');
    });

    it('should return undefined when API key missing', () => {
      delete process.env.OPENROUTER_API_KEY;

      const config = OpenRouterProvider.fromEnvironment();

      expect(config).toBeUndefined();
    });

    it('should use default agent model when STAGEHAND_AGENT_MODEL not set', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';

      const config = OpenRouterProvider.fromEnvironment();

      expect(config).toBeDefined();
      expect(config?.agentModel).toBe(OPENROUTER_DEFAULTS.AGENT_MODEL);
    });

    it('should use default execution model (undefined) when STAGEHAND_EXECUTION_MODEL not set', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';

      const config = OpenRouterProvider.fromEnvironment();

      expect(config).toBeDefined();
      expect(config?.executionModel).toBeUndefined();
    });
  });
});

