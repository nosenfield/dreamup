# DreamUp

Autonomous AI agent for automated QA testing of browser-based games. The agent navigates to a game URL, detects the game type, interacts with the game using AI-powered vision and browser automation, captures screenshots, monitors for errors, and produces a structured report with a playability score (0-100) and identified issues.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Usage](#usage)
  - [CLI Usage](#cli-usage)
  - [Lambda Usage](#lambda-usage)
- [Game Metadata](#game-metadata)
  - [Metadata Structure](#metadata-structure)
  - [Input Schema Examples](#input-schema-examples)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Feature Flags](#feature-flags)
  - [Timeouts](#timeouts)
- [Output Format](#output-format)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Project Structure](#project-structure)
- [Performance](#performance)

## Prerequisites

- [Bun](https://bun.sh) (latest stable) - Fast all-in-one JavaScript runtime
- [Browserbase](https://browserbase.com) account with API key
- [OpenAI](https://openai.com) account with GPT-4 Vision API access
- AWS account (for Lambda deployment - optional for local development)

## Installation

1. Clone the repository:
```bash
git clone [repo-url]
cd dreamup
```

2. Install dependencies:
```bash
bun install
```

## Environment Setup

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your API keys:
```bash
# Required API Keys
BROWSERBASE_API_KEY=bb_live_your_actual_key_here
BROWSERBASE_PROJECT_ID=your_project_id_here
OPENAI_API_KEY=sk-your_actual_key_here

# Optional: Feature flags and timeouts
DEBUG=false
ENABLE_CACHING=false
ENABLE_PROGRESS_UPDATES=false
ENABLE_ERROR_RECOVERY=false
ENABLE_SCREENSHOT_CLEANUP=false
MAX_TEST_DURATION=240000
GAME_LOAD_TIMEOUT=60000
INTERACTION_TIMEOUT=90000
```

3. **Get your API keys:**
   - **Browserbase**: Sign up at [browserbase.com](https://browserbase.com) and get your API key from the dashboard
   - **OpenAI**: Sign up at [platform.openai.com](https://platform.openai.com) and create an API key with GPT-4 Vision access

**Note**: Bun automatically loads environment variables from `.env` files, so no additional setup is needed.

## Usage

### CLI Usage

Run QA tests from the command line:

```bash
# Basic usage (test a game without metadata)
bun run qa https://example.com/game

# With metadata file (recommended for better testing)
bun run qa https://example.com/game --metadata ./_game-examples/pong/metadata.json
```

**CLI Arguments:**
- `<game-url>` (required): The URL of the game to test
- `--metadata <path>` (optional): Path to a metadata.json file containing game information

**Example Output:**
```json
{
  "status": "pass",
  "playability_score": 85,
  "screenshots": [
    {
      "id": "abc123",
      "path": "/tmp/game-qa-output/screenshots/abc123-initial_load.png",
      "timestamp": 1699123456789,
      "stage": "initial_load"
    }
  ],
  "issues": [],
  "metadata": {
    "sessionId": "xyz789",
    "gameUrl": "https://example.com/game",
    "duration": 45000,
    "gameType": "canvas"
  }
}
```

**Exit Codes:**
- `0`: Test passed successfully
- `1`: Test failed or error occurred

### Lambda Usage

Deploy as an AWS Lambda function for serverless game testing. See [Deployment Guide](_docs/deployment.md) for detailed instructions.

**Lambda Event Structure:**
```json
{
  "gameUrl": "https://example.com/game",
  "metadata": {
    "metadataVersion": "1.0.0",
    "genre": "arcade",
    "inputSchema": {
      "type": "javascript",
      "content": "gameBuilder.createAction('Jump').bindKey('Space')"
    }
  }
}
```

**Lambda Response:**
```json
{
  "statusCode": 200,
  "body": "{\"status\":\"pass\",\"playability_score\":85,...}",
  "headers": {
    "Content-Type": "application/json"
  }
}
```

**Response Status Codes:**
- `200`: Test completed successfully (may be pass or fail)
- `400`: Invalid request (missing gameUrl or invalid URL format)
- `500`: Test failed or internal error occurred

## Game Metadata

Game metadata provides structured information about a game's controls, loading indicators, and testing strategy. This enables more targeted and effective testing.

### Metadata Structure

A complete metadata file includes:

```json
{
  "metadataVersion": "1.0.0",
  "genre": "arcade",
  "description": "Brief description of the game",
  "expectedControls": "Human-readable description of controls",
  "inputSchema": {
    "type": "javascript",
    "content": "GameBuilder API calls or semantic description",
    "actions": [
      {
        "name": "Jump",
        "keys": ["Space"],
        "description": "Jump action"
      }
    ],
    "axes": [
      {
        "name": "MoveHorizontal",
        "keys": ["a", "d"],
        "description": "Horizontal movement"
      }
    ]
  },
  "loadingIndicators": [
    {
      "type": "element",
      "pattern": "#start-btn",
      "description": "Start button appears when ready"
    }
  ],
  "successIndicators": [
    {
      "type": "score_change",
      "description": "Score increments during gameplay"
    }
  ],
  "testingStrategy": {
    "waitBeforeInteraction": 2000,
    "interactionDuration": 30000,
    "criticalActions": ["Jump"],
    "criticalAxes": ["MoveHorizontal"],
    "instructions": "Testing instructions"
  }
}
```

### Input Schema Examples

**JavaScript Schema (GameBuilder API):**
```json
{
  "type": "javascript",
  "content": "gameBuilder.createAction('Pause').bindKey('Escape')\ngameBuilder.createAxis('RightPaddleVertical').bindKeys('ArrowDown', 'ArrowUp')",
  "actions": [
    {
      "name": "Pause",
      "keys": ["Escape"],
      "description": "Pause the game"
    }
  ],
  "axes": [
    {
      "name": "RightPaddleVertical",
      "keys": ["ArrowDown", "ArrowUp"],
      "description": "Control right paddle movement"
    }
  ]
}
```

**Semantic Schema (Natural Language):**
```json
{
  "type": "semantic",
  "content": "Use arrow keys to move the snake. Press Space to pause.",
  "actions": [
    {
      "name": "Pause",
      "keys": ["Space"],
      "description": "Pause the game"
    }
  ],
  "axes": [
    {
      "name": "Move",
      "keys": ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"],
      "description": "Move snake in 4 directions",
      "is2D": true
    }
  ]
}
```

**See `_game-examples/pong/metadata.json` and `_game-examples/snake/metadata.json` for complete examples.**

## Configuration

### Environment Variables

All configuration can be overridden via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `BROWSERBASE_API_KEY` | *required* | Browserbase API key |
| `BROWSERBASE_PROJECT_ID` | *required* | Browserbase project ID |
| `OPENAI_API_KEY` | *required* | OpenAI API key with GPT-4 Vision access |
| `MAX_TEST_DURATION` | `240000` | Maximum test duration in milliseconds (4 minutes) |
| `GAME_LOAD_TIMEOUT` | `60000` | Game loading timeout in milliseconds (60 seconds) |
| `INTERACTION_TIMEOUT` | `90000` | Interaction timeout in milliseconds (90 seconds) |
| `SCREENSHOT_TIMEOUT` | `10000` | Screenshot capture timeout in milliseconds (10 seconds) |
| `PAGE_NAVIGATION_TIMEOUT` | `30000` | Page navigation timeout in milliseconds (30 seconds) |
| `POST_START_DELAY` | `2000` | Delay after clicking start button in milliseconds (2 seconds) |

### Feature Flags

Feature flags control optional behavior:

| Flag | Default | Description |
|------|---------|-------------|
| `DEBUG` | `false` | Enable detailed debug logging |
| `ENABLE_CACHING` | `false` | Enable result caching (future feature) |
| `ENABLE_PROGRESS_UPDATES` | `false` | Enable real-time progress updates (future feature) |
| `ENABLE_ERROR_RECOVERY` | `false` | Enable error recovery with retries (future feature) |
| `ENABLE_SCREENSHOT_CLEANUP` | `false` | Enable automatic screenshot cleanup after test |
| `ENABLE_STAGEHAND_AGENT` | `false` | Enable Stagehand Agent QA mode (autonomous, takes precedence over Adaptive QA) |
| `ENABLE_ADAPTIVE_QA` | `false` | Enable Adaptive QA mode (iterative action loop) |

### QA Modes

DreamUp supports three QA testing modes with different capabilities:

#### Standard QA Mode (Default)

Single interaction cycle with fixed inputs. Best for quick validation of simple games.

**Characteristics:**
- Single interaction cycle
- Fixed input sequence
- Duration: 2-4 minutes
- Cost: $0.02-0.05 (vision API only)
- Use when: Quick validation, simple games

#### Adaptive QA Mode

Iterative action loop with state analysis at each step. Best for complex games requiring multi-step navigation.

**Enable:**
```bash
ENABLE_ADAPTIVE_QA=true
```

**Characteristics:**
- Manual loop management
- State analysis each step (HTML + screenshot)
- Action decisions via StateAnalyzer + GPT-4V
- Duration: 2-4 minutes
- Cost: $0.10-0.50 (multiple vision calls)
- Use when: Complex games, custom loop logic

**See `_docs/control-flow.md` for detailed flow.**

#### Stagehand Agent QA Mode (Autonomous)

**Fully autonomous mode using Stagehand's agent with OpenAI computer-use-preview model.**

The agent handles the observe-act loop internally without manual state management. Simply provide a high-level instruction and the agent explores the game autonomously.

**Enable:**
```bash
ENABLE_STAGEHAND_AGENT=true
```

**Requirements:**
- `OPENAI_API_KEY` environment variable
- OpenAI computer-use-preview model access

**How it works:**
1. Agent receives metadata-driven instruction (e.g., "Test this arcade game. Expected controls: Pause, Movement. Play for 2 minutes.")
2. Agent autonomously navigates game using computer vision
3. Agent takes up to 25 actions (configurable in constants)
4. Final screenshot captured for playability analysis
5. Result includes agent action history and reasoning

**Configuration:**
- Max steps: 25 (hardcoded in `STAGEHAND_AGENT_DEFAULTS.MAX_STEPS`)
- Timeout: 4 minutes (uses `MAX_TEST_DURATION`)
- Model: `openai/computer-use-preview`

**Cost**: TBD (depends on action count and token usage)

**Use when:**
- You want fully autonomous testing without manual loop management
- Game requires complex multi-step interactions
- You have OpenAI API access with computer-use-preview

**Example:**
```bash
ENABLE_STAGEHAND_AGENT=true bun run src/main.ts https://example.com/game --metadata ./game/metadata.json
```

**Result includes:**
```json
{
  "metadata": {
    "stagehandAgent": {
      "success": true,
      "completed": true,
      "actionCount": 12,
      "actions": [
        {
          "type": "click",
          "reasoning": "Clicking start button to begin game",
          "completed": false,
          "url": "https://example.com/game",
          "timestamp": "2025-01-01T00:00:00Z"
        }
      ],
      "message": "Successfully tested game functionality",
      "usage": {
        "input_tokens": 5000,
        "output_tokens": 1500,
        "inference_time_ms": 8000
      }
    }
  }
}
```

**Mode Precedence:**
1. Stagehand Agent (if `ENABLE_STAGEHAND_AGENT=true`)
2. Adaptive QA (if `ENABLE_ADAPTIVE_QA=true`)
3. Standard QA (default)

#### OpenRouter Integration (Stagehand Agent Mode)

The Stagehand Agent QA mode uses [OpenRouter](https://openrouter.ai) for flexible model selection across multiple providers.

**Setup:**

1. Get your OpenRouter API key: https://openrouter.ai/keys
2. Add to `.env`:
   ```bash
   OPENROUTER_API_KEY=or-xxxxx
   STAGEHAND_AGENT_MODEL=openai/computer-use-preview
   ```

**Model Configuration:**

**STAGEHAND_AGENT_MODEL** (default: `openai/computer-use-preview`)
- Main agent model for autonomous decision-making
- **Must be a supported CUA (Computer Use Agent) model**
- Format: `provider/model-name`
- **Working Models:**
  - ✅ `openai/computer-use-preview` (recommended - tested and working)
  - ✅ `openai/computer-use-preview-2025-03-11` (OpenAI CUA model)
- **Known Issues:**
  - ⚠️ `anthropic/claude-3-7-sonnet-latest` - Authentication error with OpenRouter
  - ⚠️ `anthropic/claude-sonnet-4-5-20250929` - Authentication error with OpenRouter
  - ⚠️ `google/gemini-2.5-computer-use-preview-10-2025` - Permission denied (403) from Google API
- See full catalog: https://openrouter.ai/docs/models
- See supported CUA models: https://docs.stagehand.dev/v3/basics/agent

**STAGEHAND_EXECUTION_MODEL** (optional, defaults to STAGEHAND_AGENT_MODEL)
- Separate model for tool execution (observe/act actions)
- Use a faster/cheaper model for tool calls
- Example: `openai/gpt-4o-mini`
- **Note**: Currently, Stagehand does not support separate execution models when using `AISdkClient`. This field is reserved for future use.

**Cost Management:**

OpenRouter provides transparent per-token pricing. Monitor usage at: https://openrouter.ai/activity

**Typical cost per test run:**
- OpenAI Computer Use Preview: ~$0.05-0.15 (recommended)
- Anthropic Claude 3.7 Sonnet: ~$0.10-0.30 (⚠️ authentication issues)
- Google Gemini 2.5 Computer Use: ~$0.01-0.05 (⚠️ permission issues)

**Troubleshooting:**

**Error: "OpenRouter API key is required"**
- Ensure `OPENROUTER_API_KEY` is set in `.env`
- Verify key is valid at https://openrouter.ai/keys

**Error: Invalid model format**
- Model must be in format: `provider/model-name`
- Check available models: https://openrouter.ai/docs/models

**Error: Agent fails with "model not found"**
- Model ID doesn't exist in OpenRouter catalog
- Verify model ID at https://openrouter.ai/docs/models
- Some models require explicit provider approval

**Error: "Could not resolve authentication method" (Anthropic models)**
- Anthropic models currently fail with authentication errors when using OpenRouter
- **Solution**: Use OpenAI models instead (e.g., `openai/computer-use-preview`)
- This is a known limitation with Anthropic models through OpenRouter

**Error: "Method doesn't allow unregistered callers" (Google models)**
- Google models may require additional API setup or approval
- **Solution**: Use OpenAI models instead (e.g., `openai/computer-use-preview`)
- Check Google Cloud Console for API access requirements

### Timeouts

Default timeout values (all in milliseconds):

- **Test Duration**: 240 seconds (4 minutes) - Maximum time for entire test
- **Game Load**: 60 seconds - Time to wait for game to load
- **Interaction**: 90 seconds - Time for keyboard/mouse interactions
- **Screenshot**: 10 seconds - Time to capture a screenshot
- **Navigation**: 30 seconds - Time for page navigation
- **Post-Start Delay**: 2 seconds - Delay after clicking start button

These can be customized via environment variables (see above).

## Output Format

The QA test returns a `GameTestResult` object with the following structure:

```typescript
{
  status: 'pass' | 'fail' | 'error',
  playability_score: number,  // 0-100
  screenshots: Array<{
    id: string,
    path: string,
    timestamp: number,
    stage: 'initial_load' | 'after_interaction' | 'final_state'
  }>,
  issues: Array<{
    severity: 'critical' | 'warning' | 'info',
    category: string,
    message: string,
    screenshot?: string
  }>,
  metadata: {
    sessionId: string,
    gameUrl: string,
    duration: number,
    gameType: 'canvas' | 'iframe' | 'dom' | 'unknown',
    consoleErrors: Array<{
      message: string,
      timestamp: number,
      level: 'error' | 'warning'
    }>
  }
}
```

## Troubleshooting

### Browserbase Connection Issues

**Error**: `Missing required environment variables: BROWSERBASE_API_KEY and/or BROWSERBASE_PROJECT_ID`

**Solution**: 
- Verify `.env` file exists and contains both `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID`
- Check that API keys are correct (no extra spaces or quotes)
- Ensure Bun is loading `.env` file (it should by default)

**Error**: `Failed to initialize browser`

**Solution**:
- Verify Browserbase API key is valid and has sufficient credits
- Check network connectivity
- Verify Browserbase project ID matches your account

### OpenAI API Errors

**Error**: `Failed to analyze screenshots` or vision analysis fails

**Solution**:
- Verify `OPENAI_API_KEY` is set correctly
- Check that API key has GPT-4 Vision access
- Ensure sufficient OpenAI credits/balance
- Test with `DEBUG=true` to see detailed error messages

### Timeout Issues

**Error**: `Operation timed out after X milliseconds`

**Solution**:
- Increase timeout values in `.env` file (see [Configuration](#configuration))
- Check if game URL is accessible and loads correctly
- For slow-loading games, increase `GAME_LOAD_TIMEOUT`
- For complex interactions, increase `INTERACTION_TIMEOUT`

### Game Detection Issues

**Issue**: Game type detected as `UNKNOWN`

**Solution**:
- This is normal for some games (especially DOM-based games)
- Test will still proceed, but may take longer to detect ready state
- Consider providing metadata.json with loading indicators for better detection

### Screenshot Capture Issues

**Error**: `Failed to capture screenshot`

**Solution**:
- Check disk space availability (`/tmp` directory in Lambda)
- Increase `SCREENSHOT_TIMEOUT` if game is slow to render
- Verify Browserbase session is still active

### Metadata Validation Errors

**Error**: `Metadata validation failed`

**Solution**:
- Verify metadata.json file is valid JSON
- Check that metadata matches schema (see [Game Metadata](#game-metadata))
- Use provided examples (`_game-examples/pong/metadata.json`) as reference
- Run with `DEBUG=true` to see detailed validation errors

### General Debugging

Enable detailed logging:
```bash
DEBUG=true bun run qa https://example.com/game
```

This will output structured JSON logs with detailed information about each step of the test execution.

## Development

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/unit/game-interactor.test.ts

# Run with coverage
bun test --coverage
```

### Building for Production

```bash
# Build TypeScript
bun run build

# Output will be in dist/ directory
```

### Development Mode

```bash
# Run with watch mode (auto-reload on changes)
bun run dev
```

### Project Structure

```
dreamup/
├── src/
│   ├── main.ts              # Entry point (CLI or Lambda handler)
│   ├── core/                # Core browser automation logic
│   │   ├── browser-manager.ts
│   │   ├── game-detector.ts
│   │   ├── game-interactor.ts
│   │   ├── screenshot-capturer.ts
│   │   ├── error-monitor.ts
│   │   └── input-schema-parser.ts
│   ├── vision/              # GPT-4 Vision integration
│   │   ├── analyzer.ts
│   │   ├── prompts.ts
│   │   └── schema.ts
│   ├── utils/               # Utility functions
│   │   ├── logger.ts
│   │   ├── file-manager.ts
│   │   └── timeout.ts
│   ├── config/              # Configuration constants
│   │   ├── constants.ts
│   │   └── feature-flags.ts
│   ├── types/               # TypeScript type definitions
│   └── schemas/             # Zod validation schemas
├── tests/                   # Test files
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   └── fixtures/          # Test fixtures
├── _game-examples/         # Example game metadata files
├── _docs/                  # Documentation
├── scripts/                # Deployment scripts
├── output/                 # Screenshots and reports (gitignored)
└── .env.example            # Environment variables template
```

This project uses:
- **Bun** for runtime and package management
- **TypeScript** with strict mode for type safety
- **Bun's built-in test runner** for testing

## Performance

### Typical Performance Characteristics

- **Test Duration**: 2-4 minutes average (depending on game complexity)
- **Vision API Cost**: ~$0.02-0.05 per test (depends on screenshot count)
- **Browserbase Cost**: ~$0.01-0.02 per test (depends on session duration)

### Optimization Tips

1. **Use Metadata**: Providing metadata.json significantly improves test accuracy and reduces vision API calls
2. **Screenshot Cleanup**: Enable `ENABLE_SCREENSHOT_CLEANUP=true` to reduce storage costs
3. **Timeout Tuning**: Adjust timeouts based on your game's characteristics (faster games = lower timeouts)
4. **Debug Mode**: Keep `DEBUG=false` in production to reduce logging overhead

### Cost Optimization

- **Metadata Files**: Use metadata.json to reduce vision API calls (saves ~$0.01-0.02 per test)
- **Screenshot Cleanup**: Enable cleanup to reduce Lambda storage costs
- **Batch Testing**: Run multiple tests sequentially to reuse browser sessions (future enhancement)

---

For detailed API documentation, see [API.md](API.md).  
For deployment instructions, see [_docs/deployment.md](_docs/deployment.md).
