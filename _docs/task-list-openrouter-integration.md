# OpenRouter Integration Task List

**Purpose**: Integrate OpenRouter for model flexibility in Stagehand Agent QA mode
**Scope**: Stagehand Agent only (VisionAnalyzer and StateAnalyzer remain unchanged)
**Timeline**: 3-4 hours total (updated due to BrowserManager integration requirements)
**Dependencies**: Must be implemented alongside or after Stagehand Agent QA mode (task-list-stagehand-agent.md)

---

## Overview

This task list implements OpenRouter integration for the Stagehand Agent QA mode, enabling model flexibility and experimentation across multiple LLM providers (OpenAI, Anthropic, Google, etc.) through a single API.

**Key Benefits:**
- 🎯 **Model Flexibility**: Test with 400+ models (GPT-4, Claude, Gemini, etc.)
- 🔄 **Easy Switching**: Change models via config without code changes
- 💰 **Cost Transparency**: Per-token pricing across providers
- 🛡️ **Automatic Fallbacks**: Built-in resilience when models fail

---

## Architecture Decisions

### Why OpenRouter?
1. **Unified API**: Single integration for multiple providers
2. **Vercel AI SDK Support**: Official `@openrouter/ai-sdk-provider` package
3. **Stagehand Compatibility**: Uses same "provider/model" format as Stagehand's agent config
4. **Future-Proofing**: Easy to add new models as they're released

### Integration Approach
- **Scope**: Stagehand Agent only (not VisionAnalyzer/StateAnalyzer)
- **Migration**: OpenRouter required when `ENABLE_STAGEHAND_AGENT=true`
- **Configuration**: Model selection via environment variables with sensible defaults
- **Fallback**: If OpenRouter fails, log error and throw (no silent fallback to OpenAI)

### Model Configuration Strategy
```
OPENROUTER_API_KEY=or-xxxxx
STAGEHAND_AGENT_MODEL=anthropic/claude-3.5-sonnet  # Main agent model
STAGEHAND_EXECUTION_MODEL=openai/gpt-4o-mini       # Tool execution model (optional)
```

---

## Task Breakdown

### Task OR.1: Add OpenRouter Dependencies and Configuration (30 min)

**Objective**: Install OpenRouter provider and add configuration types

**Steps:**

**1.1. Install OpenRouter Provider**
```bash
bun add @openrouter/ai-sdk-provider
```

**1.2. Update Environment Variables**

Add to `.env.example`:
```bash
# OpenRouter Configuration (required for Stagehand Agent mode)
# Sign up at https://openrouter.ai/keys
OPENROUTER_API_KEY=or-xxxxx

# Stagehand Agent Model Configuration
# Default: anthropic/claude-3.5-sonnet
# See https://openrouter.ai/docs/models for full model catalog
STAGEHAND_AGENT_MODEL=anthropic/claude-3.5-sonnet

# Optional: Separate model for tool execution (observe/act)
# Default: Uses STAGEHAND_AGENT_MODEL if not set
# STAGEHAND_EXECUTION_MODEL=openai/gpt-4o-mini
```

**1.3. Update Config Types**

In `src/types/config.types.ts`, add OpenRouter-related fields:

```typescript
/**
 * OpenRouter configuration for Stagehand Agent.
 */
export interface OpenRouterConfig {
  /** OpenRouter API key (required for Stagehand Agent) */
  apiKey: string;

  /** Main agent model in provider/model format (e.g., "anthropic/claude-3.5-sonnet") */
  agentModel: string;

  /** Optional execution model for tool calls (defaults to agentModel) */
  executionModel?: string;
}

// Update TestConfig to include OpenRouter settings
export interface TestConfig {
  // ... existing fields ...

  /** OpenRouter configuration (required when enableStagehandAgent is true) */
  openrouter?: OpenRouterConfig;
}
```

**1.4. Add OpenRouter Constants**

In `src/config/constants.ts` (or create if doesn't exist), add defaults:

```typescript
/**
 * Default OpenRouter configuration for Stagehand Agent.
 */
export const OPENROUTER_DEFAULTS = {
  /** Default agent model for autonomous testing */
  AGENT_MODEL: 'anthropic/claude-3.5-sonnet',

  /** Default execution model for tool calls (if not specified, uses AGENT_MODEL) */
  EXECUTION_MODEL: undefined as string | undefined,

  /** OpenRouter API base URL */
  BASE_URL: 'https://openrouter.ai/api/v1',
};
```

**Acceptance Criteria:**
- ✅ `@openrouter/ai-sdk-provider` installed in package.json
- ✅ `.env.example` updated with OpenRouter variables
- ✅ `OpenRouterConfig` interface added to config.types.ts
- ✅ `OPENROUTER_DEFAULTS` added to constants

**Estimated Time**: 30 minutes

---

### Task OR.2: Create OpenRouter Provider Service (45 min)

**Objective**: Create service to initialize and manage OpenRouter provider

**Steps:**

**2.1. Create Provider Service File**

Create `src/services/openrouter-provider.ts`:

```typescript
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
    return this.openrouter(agentModel);
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
```

**2.2. Add AI SDK Model Instance Method**

Add method to get AI SDK model instance (required for AISdkClient):

```typescript
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
  return this.openrouter(agentModel);
}
```

**Acceptance Criteria:**
- ✅ `OpenRouterProvider` class created with initialization logic
- ✅ Environment variable fallback logic implemented
- ✅ Model validation helper added
- ✅ `fromEnvironment()` static method for easy config loading
- ✅ `getAISdkModel()` method returns AI SDK model instance
- ✅ Comprehensive JSDoc documentation

**Estimated Time**: 45 minutes

---

### Task OR.2.5: Update BrowserManager for LLM Client Support (30 min)

**Objective**: Modify BrowserManager to accept optional LLM client configuration for OpenRouter integration

**Prerequisites**:
- Task OR.2 (OpenRouterProvider service)

**Steps:**

**2.5.1. Update BrowserManagerConfig Interface**

In `src/core/browser-manager.ts`, add optional `llmClient` parameter:

```typescript
import { AISdkClient } from '@browserbasehq/stagehand';
import type { LanguageModel } from 'ai';

export interface BrowserManagerConfig {
  /** Browserbase API key */
  apiKey: string;
  
  /** Browserbase project ID */
  projectId: string;
  
  /** Logger instance for structured logging */
  logger: Logger;
  
  /** Optional LLM client for Stagehand (e.g., AISdkClient with OpenRouter model) */
  llmClient?: AISdkClient;
  
  /** Optional timeout for initialization (default: PAGE_NAVIGATION_TIMEOUT) */
  initTimeout?: number;
  
  /** Optional timeout for navigation (default: PAGE_NAVIGATION_TIMEOUT) */
  navigateTimeout?: number;
}
```

**2.5.2. Update BrowserManager Constructor**

Store `llmClient` and pass to Stagehand initialization:

```typescript
export class BrowserManager {
  private readonly apiKey: string;
  private readonly projectId: string;
  private readonly logger: Logger;
  private readonly initTimeout: number;
  private readonly navigateTimeout: number;
  private readonly llmClient?: AISdkClient;  // NEW
  
  // ... existing fields ...

  constructor(config: BrowserManagerConfig) {
    this.apiKey = config.apiKey;
    this.projectId = config.projectId;
    this.logger = config.logger;
    this.llmClient = config.llmClient;  // NEW
    this.initTimeout = config.initTimeout ?? TIMEOUTS.PAGE_NAVIGATION_TIMEOUT;
    this.navigateTimeout = config.navigateTimeout ?? TIMEOUTS.PAGE_NAVIGATION_TIMEOUT;
  }
```

**2.5.3. Update Stagehand Initialization**

Pass `llmClient` to Stagehand constructor if provided:

```typescript
async initialize(): Promise<AnyPage> {
  if (this.isInitialized && this.page) {
    return this.page;
  }

  this.logger.info('Initializing browser session', {
    apiKey: `${this.apiKey.substring(0, 8)}...`,
    projectId: this.projectId,
    hasLlmClient: !!this.llmClient,
  });

  try {
    // Initialize Stagehand with optional LLM client
    const stagehandConfig: any = {
      env: 'BROWSERBASE',
      apiKey: this.apiKey,
      projectId: this.projectId,
    };

    // Add LLM client if provided (for OpenRouter integration)
    if (this.llmClient) {
      stagehandConfig.llmClient = this.llmClient;
      this.logger.info('Using custom LLM client for Stagehand', {});
    }

    this.stagehand = new Stagehand(stagehandConfig);
    
    // ... rest of initialization ...
  }
}
```

**Acceptance Criteria:**
- ✅ `BrowserManagerConfig` includes optional `llmClient` parameter
- ✅ `BrowserManager` stores and uses `llmClient` if provided
- ✅ Stagehand initialized with `llmClient` when available
- ✅ Backwards compatible (works without `llmClient` for non-OpenRouter modes)
- ✅ TypeScript compilation passes

**Estimated Time**: 30 minutes

---

### Task OR.3: Update Stagehand Agent Implementation (60 min)

**Objective**: Integrate OpenRouter into Stagehand Agent QA mode using AISdkClient

**Prerequisites**:
- Task SA.3 from task-list-stagehand-agent.md (runStagehandAgentQA implementation)
- Tasks OR.1, OR.2, and OR.2.5 from this list

**⚠️ CRITICAL**: Stagehand does NOT support passing OpenRouter models directly to `agent()`. 
We must use `AISdkClient` during Stagehand initialization, not per-agent configuration.

**Steps:**

**3.1. Update runStagehandAgentQA Function**

In `src/main.ts`, modify the `runStagehandAgentQA()` function to use OpenRouter via AISdkClient:

```typescript
import { OpenRouterProvider } from './services/openrouter-provider';
import { AISdkClient } from '@browserbasehq/stagehand';

export async function runStagehandAgentQA(
  gameUrl: string,
  metadata?: GameMetadata,
  config?: Partial<TestConfig>
): Promise<GameTestResult> {
  const sessionId = nanoid();
  const startTime = Date.now();
  const logger = new Logger({
    module: 'qa-agent',
    op: 'runStagehandAgentQA',
    correlationId: sessionId,
  });
  let browserManager: BrowserManager | null = null;

  logger.info('Starting Stagehand Agent QA', {
    sessionId,
    gameUrl,
    hasMetadata: !!metadata,
  });

  try {
    // 1. Validate OpenAI API key (still needed for vision analysis)
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required for vision analysis');
    }

    // 2. Initialize OpenRouter provider
    const openRouterProvider = new OpenRouterProvider({
      logger,
      apiKey: config?.openrouter?.apiKey,
      agentModel: config?.openrouter?.agentModel,
      executionModel: config?.openrouter?.executionModel,
    });

    const { agentModel } = openRouterProvider.getModelConfig();

    logger.info('OpenRouter provider initialized', {
      sessionId,
      agentModel,
      hasExecutionModel: !!openRouterProvider.getExecutionModel(),
    });

    // 3. Create AI SDK model instance from OpenRouter
    const model = openRouterProvider.getAISdkModel();

    // 4. Create AISdkClient with OpenRouter model
    const llmClient = new AISdkClient({ model });

    logger.info('AISdkClient created with OpenRouter model', {
      sessionId,
      agentModel,
    });

    // 5. Validate Browserbase credentials
    const browserbaseApiKey = process.env.BROWSERBASE_API_KEY;
    const browserbaseProjectId = process.env.BROWSERBASE_PROJECT_ID;

    if (!browserbaseApiKey || !browserbaseProjectId) {
      throw new Error('Missing required environment variables: BROWSERBASE_API_KEY and/or BROWSERBASE_PROJECT_ID');
    }

    // 6. Initialize browser with LLM client
    const fileManager = new FileManager(sessionId);
    browserManager = new BrowserManager({
      apiKey: browserbaseApiKey,
      projectId: browserbaseProjectId,
      logger,
      llmClient,  // Pass OpenRouter LLM client
    });

    const page = await withTimeout(
      browserManager.initialize(),
      TIMEOUTS.PAGE_NAVIGATION_TIMEOUT,
      'Browser initialization timeout'
    );

    logger.info('Browser initialized with OpenRouter LLM client', { sessionId });

    // 7. Navigate to game
    await withTimeout(
      browserManager.navigate(gameUrl),
      TIMEOUTS.PAGE_NAVIGATION_TIMEOUT,
      'Page navigation timeout'
    );

    logger.info('Navigated to game URL', { sessionId, gameUrl });

    // 8. Detect game type, wait for ready, start error monitoring
    // ... (same as before) ...

    // 9. Get Stagehand instance
    const stagehandInstance = browserManager.getStagehand();
    if (!stagehandInstance) {
      throw new Error(
        'Stagehand instance not available. ' +
        'Ensure BrowserManager.initialize() was called successfully.'
      );
    }

    // 10. Build instruction from metadata
    const instruction = buildStagehandInstruction(metadata);

    logger.info('Agent instruction built', {
      sessionId,
      instruction: instruction.substring(0, 100) + '...',
      hasMetadata: !!metadata,
    });

    // 11. Create agent (no model needed - uses Stagehand's llmClient)
    // NOTE: Stagehand agent() does NOT accept model parameter when using AISdkClient
    // The model is configured at Stagehand initialization via llmClient
    const agent = stagehandInstance.agent({
      cua: true,  // Enable Computer Use Agent mode
      systemPrompt: STAGEHAND_AGENT_DEFAULTS.SYSTEM_PROMPT,
      // NO model parameter - uses llmClient from Stagehand initialization
    });

    logger.info('Stagehand agent created', {
      sessionId,
      agentModel,  // Log which model is being used
      note: 'Model configured via AISdkClient at Stagehand initialization',
    });

    // 12. Execute agent with timeout
    logger.info('Starting agent execution', {
      sessionId,
      maxSteps: STAGEHAND_AGENT_DEFAULTS.MAX_STEPS,
    });

    const agentResult = await withTimeout(
      agent.execute({
        instruction,
        maxSteps: STAGEHAND_AGENT_DEFAULTS.MAX_STEPS,
        highlightCursor: STAGEHAND_AGENT_DEFAULTS.HIGHLIGHT_CURSOR,
      }),
      TIMEOUTS.MAX_TEST_DURATION,
      'Agent execution timeout'
    );

    logger.info('Agent execution completed', {
      sessionId,
      success: agentResult.success,
      completed: agentResult.completed,
      actionCount: agentResult.actions?.length || 0,
      message: agentResult.message,
      usage: agentResult.usage,
    });

    // 13-17. Continue with screenshot capture, vision analysis, result building
    // ... (same as before, but include agentModel in metadata) ...

    // In result metadata, include:
    const result: GameTestResult = {
      // ... existing fields ...
      metadata: {
        // ... existing fields ...
        stagehandAgent: {
          success: agentResult.success,
          completed: agentResult.completed,
          actionCount: actions.length,
          actions,
          message: agentResult.message,
          agentModel,  // Record which model was used
          usage: {
            ...agentResult.usage,
            totalInputTokens,
            totalOutputTokens,
          },
        },
      },
    };

    // ... rest of function ...
  } catch (error) {
    // ... error handling ...
  }
}
```

**3.2. Update CLI Handler**

In CLI handler, ensure OpenRouter config is loaded and validated:

```typescript
// Load OpenRouter config from environment
const openRouterConfig = OpenRouterProvider.fromEnvironment();

if (flags.enableStagehandAgent && !openRouterConfig) {
  console.error('Error: OPENROUTER_API_KEY is required for Stagehand Agent mode');
  console.error('Get your API key at: https://openrouter.ai/keys');
  process.exit(1);
}

// Pass config to runStagehandAgentQA
const result = await runStagehandAgentQA(gameUrl, metadata, {
  openrouter: openRouterConfig,
  // ... other config
});
```

**3.3. Update Lambda Handler**

Similar validation in Lambda handler to ensure OpenRouter API key is present when Stagehand Agent is enabled.

**⚠️ Important Notes:**

1. **Execution Model Limitation**: Stagehand does NOT support separate `executionModel` in `agent()` when using `AISdkClient`. The execution model is the same as the agent model. If you need different models, you would need separate `AISdkClient` instances, but this is not recommended.

2. **Model Configuration**: The model is configured at Stagehand initialization, not per-agent. All agents created from the same Stagehand instance will use the same model.

3. **Backwards Compatibility**: When `llmClient` is not provided, BrowserManager should work as before (Stagehand uses default model configuration).

**Acceptance Criteria:**
- ✅ `runStagehandAgentQA` uses OpenRouterProvider for model config
- ✅ AISdkClient created with OpenRouter model
- ✅ BrowserManager initialized with `llmClient` parameter
- ✅ Agent created without model parameter (uses Stagehand's llmClient)
- ✅ CLI validates OpenRouter API key when Stagehand Agent enabled
- ✅ Agent result metadata includes model information
- ✅ Error messages guide users to get OpenRouter API key
- ✅ Backwards compatible (works without OpenRouter for other modes)

**Estimated Time**: 60 minutes (increased due to BrowserManager changes)

---

### Task OR.4: Documentation and Testing (45 min)

**Objective**: Document OpenRouter integration and add validation tests

**Steps:**

**4.1. Update README.md**

Add section on OpenRouter configuration:

```markdown
### OpenRouter Integration (Stagehand Agent Mode)

The Stagehand Agent QA mode uses [OpenRouter](https://openrouter.ai) for flexible model selection across multiple providers.

#### Setup

1. Get your OpenRouter API key: https://openrouter.ai/keys
2. Add to `.env`:
   ```bash
   OPENROUTER_API_KEY=or-xxxxx
   STAGEHAND_AGENT_MODEL=anthropic/claude-3.5-sonnet
   ```

#### Model Configuration

**STAGEHAND_AGENT_MODEL** (default: `anthropic/claude-3.5-sonnet`)
- Main agent model for autonomous decision-making
- Format: `provider/model-name`
- Examples:
  - `anthropic/claude-3.5-sonnet` (recommended for complex reasoning)
  - `openai/gpt-4o` (cost-effective, fast)
  - `google/gemini-2.0-flash-exp` (experimental, low-cost)
  - See full catalog: https://openrouter.ai/docs/models

**STAGEHAND_EXECUTION_MODEL** (optional, defaults to STAGEHAND_AGENT_MODEL)
- Separate model for tool execution (observe/act actions)
- Use a faster/cheaper model for tool calls
- Example: `openai/gpt-4o-mini`

#### Cost Management

OpenRouter provides transparent per-token pricing. Monitor usage at: https://openrouter.ai/activity

**Typical cost per test run:**
- Anthropic Claude 3.5 Sonnet: ~$0.10-0.30
- OpenAI GPT-4o: ~$0.05-0.15
- Google Gemini 2.0 Flash: ~$0.01-0.05

#### Troubleshooting

**Error: "OpenRouter API key is required"**
- Ensure `OPENROUTER_API_KEY` is set in `.env`
- Verify key is valid at https://openrouter.ai/keys

**Error: Invalid model format**
- Model must be in format: `provider/model-name`
- Check available models: https://openrouter.ai/docs/models
```

**4.2. Update control-flow.md**

Add OpenRouter to Stagehand Agent flow diagram:

```markdown
### Stagehand Agent QA Mode Flow (with OpenRouter)

1. **Initialization**
   - Load OpenRouter config from environment
   - Validate OPENROUTER_API_KEY exists
   - Initialize OpenRouterProvider with agent/execution models

2. **Agent Setup**
   - Get Stagehand instance from BrowserManager
   - Create agent with OpenRouter models:
     - model: STAGEHAND_AGENT_MODEL (e.g., anthropic/claude-3.5-sonnet)
     - executionModel: STAGEHAND_EXECUTION_MODEL (optional)
   - Enable CUA mode for vision-based control

3. **Execution**
   - [Same as before...]
```

**4.3. Create Unit Tests**

Create `src/services/__tests__/openrouter-provider.test.ts`:

```typescript
import { describe, test, expect, beforeEach } from 'bun:test';
import { OpenRouterProvider } from '../openrouter-provider';
import { Logger } from '../../utils/logger';

describe('OpenRouterProvider', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({ module: 'test' });
  });

  test('should throw error if no API key provided', () => {
    delete process.env.OPENROUTER_API_KEY;

    expect(() => {
      new OpenRouterProvider({ logger });
    }).toThrow('OpenRouter API key is required');
  });

  test('should initialize with default models', () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    delete process.env.STAGEHAND_AGENT_MODEL;

    const provider = new OpenRouterProvider({ logger });
    const config = provider.getModelConfig();

    expect(config.agentModel).toBe('anthropic/claude-3.5-sonnet');
    expect(config.executionModel).toBeUndefined();
  });

  test('should use environment variable models', () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.STAGEHAND_AGENT_MODEL = 'openai/gpt-4o';
    process.env.STAGEHAND_EXECUTION_MODEL = 'openai/gpt-4o-mini';

    const provider = new OpenRouterProvider({ logger });
    const config = provider.getModelConfig();

    expect(config.agentModel).toBe('openai/gpt-4o');
    expect(config.executionModel).toBe('openai/gpt-4o-mini');
  });

  test('should validate model format', () => {
    expect(OpenRouterProvider.isValidModelFormat('anthropic/claude-3.5-sonnet')).toBe(true);
    expect(OpenRouterProvider.isValidModelFormat('openai/gpt-4o')).toBe(true);
    expect(OpenRouterProvider.isValidModelFormat('invalid-format')).toBe(false);
    expect(OpenRouterProvider.isValidModelFormat('no/slash/allowed')).toBe(false);
  });

  test('should create config from environment', () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.STAGEHAND_AGENT_MODEL = 'openai/gpt-4o';

    const config = OpenRouterProvider.fromEnvironment();

    expect(config).toBeDefined();
    expect(config?.apiKey).toBe('test-key');
    expect(config?.agentModel).toBe('openai/gpt-4o');
  });

  test('should return undefined from environment if no API key', () => {
    delete process.env.OPENROUTER_API_KEY;

    const config = OpenRouterProvider.fromEnvironment();

    expect(config).toBeUndefined();
  });
});
```

**4.4. Update .env.example**

Ensure `.env.example` has comprehensive OpenRouter documentation (from Task OR.1).

**Acceptance Criteria:**
- ✅ README.md updated with OpenRouter setup guide
- ✅ control-flow.md updated with OpenRouter in flow diagrams
- ✅ Unit tests for OpenRouterProvider pass (`bun test`)
- ✅ .env.example has clear OpenRouter documentation

**Estimated Time**: 45 minutes

---

## Implementation Checklist

### Pre-Implementation
- [ ] Review Stagehand Agent task list (task-list-stagehand-agent.md)
- [ ] Ensure Task SA.3 is complete or in-progress (runStagehandAgentQA exists)
- [ ] Verify OpenRouter account created (https://openrouter.ai)
- [ ] Get OpenRouter API key (https://openrouter.ai/keys)

### Task OR.1: Dependencies and Configuration
- [ ] Run `bun add @openrouter/ai-sdk-provider`
- [ ] Verify package.json includes `@openrouter/ai-sdk-provider`
- [ ] Update `.env.example` with OpenRouter variables
- [ ] Add `OpenRouterConfig` interface to `src/types/config.types.ts`
- [ ] Add `OPENROUTER_DEFAULTS` to `src/config/constants.ts` (create if needed)
- [ ] Update `TestConfig` interface to include `openrouter?: OpenRouterConfig`

### Task OR.2: Provider Service
- [ ] Create `src/services/openrouter-provider.ts`
- [ ] Implement `OpenRouterProvider` class with constructor
- [ ] Implement `getAgentModel()` method
- [ ] Implement `getExecutionModel()` method
- [ ] Implement `getModelConfig()` method
- [ ] Implement `getProvider()` method
- [ ] Implement `getAISdkModel()` method (NEW - for AISdkClient)
- [ ] Implement `getApiKey()` method (NEW)
- [ ] Implement `isValidModelFormat()` static method
- [ ] Implement `fromEnvironment()` static method
- [ ] Add comprehensive JSDoc documentation

### Task OR.2.5: BrowserManager Update
- [ ] Update `BrowserManagerConfig` interface to include `llmClient?: AISdkClient`
- [ ] Update `BrowserManager` constructor to store `llmClient`
- [ ] Update `BrowserManager.initialize()` to pass `llmClient` to Stagehand
- [ ] Verify backwards compatibility (works without `llmClient`)
- [ ] Add TypeScript types for `AISdkClient` import

### Task OR.3: Stagehand Agent Integration
- [ ] Import `OpenRouterProvider` and `AISdkClient` in `src/main.ts`
- [ ] Update `runStagehandAgentQA()` to initialize OpenRouterProvider
- [ ] Create AI SDK model instance using `getAISdkModel()`
- [ ] Create `AISdkClient` with OpenRouter model
- [ ] Pass `llmClient` to BrowserManager constructor
- [ ] Update agent creation (remove model parameter - uses llmClient)
- [ ] Add model information to result metadata
- [ ] Update CLI handler to validate OpenRouter API key
- [ ] Update CLI handler to load OpenRouter config from environment
- [ ] Update Lambda handler (if exists) with same validation
- [ ] Test with different models (Claude, GPT-4, Gemini)

### Task OR.4: Documentation and Testing
- [ ] Update README.md with OpenRouter setup section
- [ ] Update README.md with model configuration guide
- [ ] Update README.md with cost management information
- [ ] Update README.md with troubleshooting section
- [ ] Update `_docs/control-flow.md` with OpenRouter in flow diagrams
- [ ] Create `src/services/__tests__/openrouter-provider.test.ts`
- [ ] Implement unit tests for OpenRouterProvider
- [ ] Run `bun test` and verify all tests pass
- [ ] Verify `.env.example` has comprehensive OpenRouter docs

### Validation and Testing
- [ ] Manual E2E test: Run with `OPENROUTER_API_KEY` and default model
- [ ] Manual E2E test: Run with custom `STAGEHAND_AGENT_MODEL`
- [ ] Manual E2E test: Run with separate `STAGEHAND_EXECUTION_MODEL`
- [ ] Manual E2E test: Verify error when `OPENROUTER_API_KEY` missing
- [ ] Check agent result metadata includes model information
- [ ] Verify cost tracking works (input/output tokens logged)
- [ ] Test with at least 3 different models (e.g., Claude, GPT-4, Gemini)

---

## Integration with Stagehand Agent Task List

This task list is designed to be implemented **after or alongside** the Stagehand Agent QA mode (task-list-stagehand-agent.md).

### Recommended Implementation Order

**Option A: Sequential (Recommended)**
1. Complete SA.1-SA.3 from task-list-stagehand-agent.md (with hardcoded OpenAI model)
2. Complete OR.1-OR.3 from this list (migrate to OpenRouter)
3. Complete SA.4-SA.5 + OR.4 (documentation and testing together)

**Option B: Parallel (Advanced)**
1. Complete SA.1-SA.2 (config, types, instruction builder)
2. Complete OR.1-OR.2-OR.2.5 (OpenRouter provider setup + BrowserManager update)
3. Complete SA.3 + OR.3 together (implement runStagehandAgentQA with OpenRouter from start)
4. Complete SA.4-SA.5 + OR.4 (documentation and testing together)

### Modified Task SA.3 Integration Points

If implementing in parallel, **modify Step 3.2 in task-list-stagehand-agent.md** (Agent Initialization) to use OpenRouter from the start:

**Original (OpenAI hardcoded):**
```typescript
const agent = stagehandInstance.agent({
  cua: true,
  model: 'openai/computer-use-preview',  // Hardcoded
  systemPrompt: STAGEHAND_AGENT_DEFAULTS.SYSTEM_PROMPT,
});
```

**Modified (OpenRouter with AISdkClient):**
```typescript
// Initialize OpenRouter provider
const openRouterProvider = new OpenRouterProvider({
  logger,
  apiKey: config?.openrouter?.apiKey,
  agentModel: config?.openrouter?.agentModel,
});

// Create AI SDK model instance
const model = openRouterProvider.getAISdkModel();

// Create AISdkClient with OpenRouter model
const llmClient = new AISdkClient({ model });

// Initialize BrowserManager with LLM client
const browserManager = new BrowserManager({
  apiKey: browserbaseApiKey,
  projectId: browserbaseProjectId,
  logger,
  llmClient,  // Pass OpenRouter LLM client
});

await browserManager.initialize();

// Get Stagehand instance (already configured with llmClient)
const stagehandInstance = browserManager.getStagehand();

// Create agent (NO model parameter - uses Stagehand's llmClient)
const agent = stagehandInstance.agent({
  cua: true,
  systemPrompt: STAGEHAND_AGENT_DEFAULTS.SYSTEM_PROMPT,
  // Model configured via llmClient at Stagehand initialization
});
```

---

## Testing Strategy

### Unit Tests
- OpenRouterProvider initialization
- Model format validation
- Environment variable loading
- Error handling for missing API key

### Integration Tests
- Stagehand Agent QA with OpenRouter models
- Model switching between providers
- Cost tracking accuracy

### Manual E2E Tests
1. **Claude 3.5 Sonnet** (default): Test full QA flow with Anthropic model
2. **GPT-4o**: Test with OpenAI model for comparison
3. **Gemini 2.0 Flash**: Test with Google model for cost comparison
4. **Custom execution model**: Test with separate execution model for tool calls
5. **Error handling**: Test with invalid/missing API key

---

## Troubleshooting Guide

### Common Issues

**Issue: "OpenRouter API key is required"**
- **Cause**: `OPENROUTER_API_KEY` not set or invalid
- **Fix**: Set in `.env` or verify at https://openrouter.ai/keys

**Issue: "Invalid model format"**
- **Cause**: Model string not in `provider/model` format
- **Fix**: Check format (e.g., `anthropic/claude-3.5-sonnet`, not `claude-3.5-sonnet`)
- **Reference**: https://openrouter.ai/docs/models

**Issue: Agent fails with "model not found"**
- **Cause**: Model ID doesn't exist in OpenRouter catalog
- **Fix**: Verify model ID at https://openrouter.ai/docs/models
- **Note**: Some models require explicit provider approval

**Issue: High costs**
- **Cause**: Using expensive models (e.g., GPT-4o, Claude Opus)
- **Fix**: Switch to cheaper models:
  - Agent: `google/gemini-2.0-flash-exp` (~$0.01/run)
  - Execution: `openai/gpt-4o-mini` (~$0.005/run)

**Issue: Stagehand agent not working**
- **Cause**: Model doesn't support vision or tool calling
- **Fix**: Use vision-capable models (Claude 3.5+, GPT-4o, Gemini 2.0+)
- **Reference**: https://openrouter.ai/docs/models (check "Vision" capability)

**Issue: "Cannot pass model to agent() when using AISdkClient"**
- **Cause**: Attempting to pass `model` parameter to `agent()` when Stagehand was initialized with `llmClient`
- **Fix**: Remove `model` parameter from `agent()` call. Model is configured at Stagehand initialization via `llmClient`
- **Note**: This is expected behavior - model configuration happens at Stagehand level, not per-agent

---

## Cost Estimates

### Model Pricing (approximate, per test run)

| Model | Agent Cost | Execution Cost | Total | Use Case |
|-------|-----------|----------------|-------|----------|
| Anthropic Claude 3.5 Sonnet | $0.20 | $0.10 | $0.30 | Best reasoning, complex games |
| OpenAI GPT-4o | $0.10 | $0.05 | $0.15 | Balanced cost/performance |
| Google Gemini 2.0 Flash | $0.02 | $0.01 | $0.03 | Budget testing, simple games |
| Mixed (Claude + GPT-4o-mini) | $0.20 | $0.02 | $0.22 | Best of both worlds |

**Variables affecting cost:**
- Max steps (default: 25)
- Game complexity (more actions = more tokens)
- Screenshot count (vision tokens)
- Execution model usage frequency

---

## Success Criteria

- ✅ OpenRouter provider package installed and functional
- ✅ `OpenRouterProvider` service created and tested
- ✅ `BrowserManager` updated to accept optional `llmClient` parameter
- ✅ Stagehand Agent uses OpenRouter models via `AISdkClient`
- ✅ Model configuration via environment variables works
- ✅ Error handling for missing API key is clear
- ✅ Unit tests pass with 100% coverage
- ✅ Manual E2E tests with 3+ different models successful
- ✅ Documentation complete (README, control-flow.md, .env.example)
- ✅ Cost tracking records model information in metadata
- ✅ Backwards compatible (works without OpenRouter for other modes)

---

## Future Enhancements (Out of Scope)

1. **Auto-Router Integration**: Use OpenRouter's auto-router to dynamically select best model
2. **Model Fallbacks**: Automatic fallback to cheaper models on failure
3. **Cost Budgets**: Max cost limits per test run
4. **Model Performance Tracking**: Compare test quality across models
5. **VisionAnalyzer Migration**: Optionally use OpenRouter for vision analysis
6. **StateAnalyzer Migration**: Optionally use OpenRouter for state analysis

---

## References

- **OpenRouter Docs**: https://openrouter.ai/docs
- **OpenRouter Models**: https://openrouter.ai/docs/models
- **OpenRouter API Keys**: https://openrouter.ai/keys
- **Vercel AI SDK OpenRouter Provider**: https://ai-sdk.dev/providers/community-providers/openrouter
- **Stagehand Agent Docs**: https://docs.stagehand.dev/v3/references/agent
- **Stagehand Agent Task List**: `_docs/task-list-stagehand-agent.md`
