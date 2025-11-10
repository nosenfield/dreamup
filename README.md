# DreamUp

Autonomous AI agent for automated QA testing of browser-based games. The agent navigates to a game URL, detects the game type, interacts with the game using AI-powered vision and browser automation, captures screenshots, monitors for errors, and produces a structured report with a playability score (0-100) and identified issues.

**Status**: MVP Complete ✅ | Production Ready | 250+ Tests Passing

## Table of Contents

- [Features](#features)
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

## Features

### Core Capabilities
- **Multi-Strategy Game Detection**: Automatically detects canvas, iframe, or DOM-based games
- **Intelligent Start Detection**: 4-strategy approach (DOM selectors, natural language, vision, state analysis)
- **Adaptive QA Testing**: Iterative action loop with AI-powered state analysis and action recommendations
- **Pixel-Based Coordinates**: All click actions use absolute pixel coordinates (not percentages) for precise interaction
- **Vision-Powered Analysis**: GPT-4 Vision integration for screenshot analysis and element detection
- **Metadata-Driven Testing**: Comprehensive game metadata support for improved accuracy
- **Structured Error Handling**: Categorized error types with detailed diagnostics
- **Enhanced Logging**: Phase-based logging with action details and correlation IDs

### Testing Modes
- **Standard QA Mode**: Traditional fixed-interaction testing with metadata
- **Adaptive QA Mode**: AI-driven iterative testing that adapts based on game state (budget-controlled)
  - **Iteration 1**: Exactly 3 action groups, each with exactly 3 actions (exploratory strategies)
  - **Iteration 2**: Variable groups (1 per successful group), 3-5 actions per group (refined strategies)
  - **Iteration 3+**: Variable groups (1 per successful group), 6-10 actions per group (expanded strategies)

### Recent Enhancements
- ✅ Action Group-based adaptive QA (iterations with confidence-ordered groups)
- ✅ Canvas-specific screenshot capture (removes page noise for canvas games)
- ✅ Enhanced StateAnalyzer prompts with testing strategy prioritization
- ✅ Local log and screenshot saving (organized by timestamp)
- ✅ Prompt preview and validation scripts
- ✅ Comprehensive test coverage (250+ tests)

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

# Adaptive QA Configuration
ADAPTIVE_QA_BUDGET=0.50

# Optional: Feature flags and timeouts
DEBUG=false
ENABLE_CACHING=false
ENABLE_PROGRESS_UPDATES=false
ENABLE_ERROR_RECOVERY=false
ENABLE_SCREENSHOT_CLEANUP=false
REFORMAT_LOGS=false
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

# Validate metadata file
bun run scripts/validate-metadata.ts ./_game-examples/pong/metadata.json

# Preview prompt that will be sent to LLM
bun run scripts/preview-prompt.ts ./_game-examples/pong/metadata.json
```

**CLI Arguments:**
- `<game-url>` (required): The URL of the game to test
- `--metadata <path>` (optional): Path to a metadata.json file containing game information

**Helper Scripts:**
- `scripts/validate-metadata.ts`: Validates metadata.json files against the schema
- `scripts/preview-prompt.ts`: Shows the prompt that will be sent to the LLM for a given metadata file

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
| `ADAPTIVE_QA_BUDGET` | `0.50` | Maximum budget in USD per adaptive QA test (controls LLM call costs) |
| `MAX_TEST_DURATION` | `240000` | Maximum test duration in milliseconds (4 minutes) |
| `GAME_LOAD_TIMEOUT` | `60000` | Game loading timeout in milliseconds (60 seconds) |
| `INTERACTION_TIMEOUT` | `90000` | Interaction timeout in milliseconds (90 seconds) |
| `SCREENSHOT_TIMEOUT` | `10000` | Screenshot capture timeout in milliseconds (10 seconds) |
| `PAGE_NAVIGATION_TIMEOUT` | `30000` | Page navigation timeout in milliseconds (30 seconds) |
| `POST_START_DELAY` | `2000` | Delay after clicking start button in milliseconds (2 seconds) |
| `REFORMAT_LOGS` | `false` | Enable reformatted log output (msg \| data format) |

### Feature Flags

Feature flags control optional behavior:

| Flag | Default | Description |
|------|---------|-------------|
| `DEBUG` | `false` | Enable detailed debug logging |
| `ENABLE_CACHING` | `false` | Enable result caching (future feature) |
| `ENABLE_PROGRESS_UPDATES` | `false` | Enable real-time progress updates (future feature) |
| `ENABLE_ERROR_RECOVERY` | `false` | Enable error recovery with retries (future feature) |
| `ENABLE_SCREENSHOT_CLEANUP` | `false` | Enable automatic screenshot cleanup after test |

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
# Run all tests (250+ tests)
bun test

# Run specific test file
bun test tests/unit/game-interactor.test.ts

# Run with coverage
bun test --coverage

# Run tests for specific module
bun test tests/unit/vision/
bun test tests/integration/
```

**Test Status**: 
- ✅ 250+ tests passing
- ✅ All core functionality tests passing
- ⚠️ 12 VisionAnalyzer test failures (known limitation - module mocking interference, tests pass individually)

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
│   ├── main.ts                    # Entry point (CLI or Lambda handler)
│   ├── core/                      # Core browser automation logic
│   │   ├── browser-manager.ts     # Browserbase session management
│   │   ├── game-detector.ts       # Game type detection (canvas/iframe/DOM)
│   │   ├── game-interactor.ts     # Game interaction orchestration
│   │   ├── screenshot-capturer.ts # Screenshot capture with stage tracking
│   │   ├── error-monitor.ts       # Console error monitoring
│   │   ├── input-schema-parser.ts # Metadata input schema parsing
│   │   ├── adaptive-qa-loop.ts    # Adaptive QA iterative testing loop
│   │   ├── state-analyzer.ts      # LLM-based state analysis and action recommendations
│   │   └── start-detection/       # Start button detection strategies
│   │       ├── start-detector.ts  # Strategy orchestrator
│   │       ├── base-strategy.ts   # Abstract base class
│   │       ├── dom-strategy.ts    # DOM selector strategy
│   │       ├── natural-language-strategy.ts  # Stagehand natural language
│   │       ├── vision-strategy.ts # GPT-4 Vision element detection
│   │       └── state-analysis-strategy.ts    # LLM state analysis
│   ├── vision/                    # GPT-4 Vision integration
│   │   ├── analyzer.ts            # Vision analysis orchestration
│   │   ├── prompts.ts             # Vision analysis prompts
│   │   └── schema.ts              # Vision response schemas
│   ├── utils/                     # Utility functions
│   │   ├── logger.ts              # Enhanced phase-based logging
│   │   ├── file-manager.ts        # File I/O and screenshot management
│   │   ├── timeout.ts             # Timeout utilities
│   │   ├── errors.ts              # Structured error types
│   │   └── log-file-writer.ts     # Local log file writing
│   ├── config/                    # Configuration constants
│   │   ├── constants.ts           # Timeouts and limits
│   │   └── feature-flags.ts       # Feature flag management
│   ├── types/                     # TypeScript type definitions
│   └── schemas/                   # Zod validation schemas
├── tests/                         # Test files (250+ tests)
│   ├── unit/                     # Unit tests
│   ├── integration/               # Integration tests
│   └── fixtures/                  # Test fixtures
├── _game-examples/                # Example game metadata files
│   ├── pong/                      # Pong game example
│   ├── snake/                     # Snake game example
│   └── brick-breaker-idle/        # Brick Breaker example
├── _docs/                         # Documentation
│   ├── architecture.md             # System architecture
│   ├── deployment.md              # Deployment guide
│   └── guides/                    # Process guides
├── scripts/                        # Utility scripts
│   ├── validate-metadata.ts       # Metadata validation script
│   ├── preview-prompt.ts          # Prompt preview script
│   └── deploy-lambda.sh           # Lambda deployment script
├── logs/                          # Local logs (gitignored)
│   └── {timestamp}/               # Timestamped log directories
│       ├── log.txt                # Session log file
│       └── screenshots/           # Screenshots from session
├── output/                        # Screenshots and reports (gitignored)
├── memory-bank/                   # Project context for AI sessions
└── .env.example                   # Environment variables template
```

This project uses:
- **Bun** for runtime and package management
- **TypeScript** with strict mode for type safety
- **Bun's built-in test runner** for testing
- **Strategy Pattern** for start detection (extensible, maintainable)
- **Action Groups** for adaptive QA (iterative, confidence-ordered)
- **Structured Logging** with phase separation and correlation IDs

## Performance

### Typical Performance Characteristics

- **Test Duration**: 2-4 minutes average (depending on game complexity)
- **Vision API Cost**: ~$0.02-0.05 per test (depends on screenshot count and adaptive QA budget)
- **Browserbase Cost**: ~$0.01-0.02 per test (depends on session duration)
- **Adaptive QA Budget**: Configurable via `ADAPTIVE_QA_BUDGET` (default: $0.50 per test)

### Optimization Tips

1. **Use Metadata**: Providing metadata.json significantly improves test accuracy and reduces vision API calls
2. **Comprehensive Instructions**: Include detailed `testingStrategy.instructions` in metadata for better adaptive QA performance
3. **Screenshot Cleanup**: Enable `ENABLE_SCREENSHOT_CLEANUP=true` to reduce storage costs
4. **Timeout Tuning**: Adjust timeouts based on your game's characteristics (faster games = lower timeouts)
5. **Debug Mode**: Keep `DEBUG=false` in production to reduce logging overhead
6. **Adaptive QA Budget**: Tune `ADAPTIVE_QA_BUDGET` based on your cost/quality tradeoff needs

### Cost Optimization

- **Metadata Files**: Use metadata.json to reduce vision API calls (saves ~$0.01-0.02 per test)
- **Comprehensive Instructions**: Detailed `testingStrategy.instructions` help adaptive QA converge faster, reducing iterations
- **Screenshot Cleanup**: Enable cleanup to reduce Lambda storage costs
- **Adaptive QA Budget**: Lower budget = fewer iterations = lower cost (but may reduce test quality)
- **Batch Testing**: Run multiple tests sequentially to reuse browser sessions (future enhancement)

## Documentation

- **[API.md](API.md)**: Complete API reference
- **[_docs/deployment.md](_docs/deployment.md)**: Lambda deployment guide
- **[_docs/architecture.md](_docs/architecture.md)**: System architecture and design patterns
- **[_docs/guides/](_docs/guides/)**: Development guides and workflows
- **[memory-bank/](memory-bank/)**: Project context and progress tracking

## Contributing

This project follows a structured development workflow:
1. Read `memory-bank/activeContext.md` at session start
2. Follow test-first development for new features
3. Update memory bank after completing tasks
4. Maintain code quality standards (TypeScript strict mode, <200 line components)

See `_docs/guides/` for detailed workflows.

---

**Last Updated**: November 9, 2025  
**Version**: 1.0 (MVP Complete)
