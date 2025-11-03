# Technical Context: DreamUp

**Last Updated**: November 3, 2025

## Tech Stack

### Runtime & Language
- **Runtime**: Bun (latest stable)
- **Language**: TypeScript 5.3+
- **Target**: ES2022
- **Why**: Bun provides native TypeScript support, fast startup times, and efficient file I/O for screenshot handling

### Browser Automation
- **Browserbase**: ^1.0.0 - Managed browser infrastructure (no need to bundle Chromium)
- **Stagehand**: ^1.0.0 - AI-native browser automation with natural language commands
- **Why**: Works seamlessly in Lambda, provides AI-powered element detection, eliminates brittle CSS selectors

### AI/LLM Framework
- **Vercel AI SDK**: ^3.4.0 - OpenAI integration with streaming and structured outputs
- **@ai-sdk/openai**: ^0.0.66 - OpenAI provider for AI SDK
- **Zod**: ^3.22.4 - Runtime schema validation for type-safe outputs
- **Why**: Simplifies GPT-4 Vision integration, ensures type-safe structured responses

### Utilities
- **dotenv**: ^16.4.5 - Environment variable management
- **p-timeout**: ^6.1.2 - Robust timeout handling for async operations
- **nanoid**: ^5.0.7 - Generate unique test session IDs
- **Why**: Essential for Lambda environment configuration and timeout constraints

### Infrastructure
- **Deployment**: AWS Lambda (custom Bun runtime layer)
- **Memory**: 2048MB (faster CPU and cold starts)
- **Timeout**: 10 minutes (safety margin, target 4-minute completion)
- **Storage**: 512MB /tmp ephemeral storage for screenshots
- **External Services**: Browserbase API, OpenAI GPT-4 Vision API

### Testing
- **Unit Tests**: Bun's built-in test runner
- **Integration Tests**: Bun test with real Browserbase/OpenAI calls
- **Coverage Target**: 70%+
- **Test Fixtures**: Sample game URLs for validation

---

## Development Setup

### Prerequisites
```bash
- Bun (latest stable) - https://bun.sh
- Browserbase account with API key
- OpenAI account with GPT-4 Vision API access
- AWS account (for Lambda deployment)
```

### Installation
```bash
# Clone repository
git clone [repo-url]
cd dreamup

# Install dependencies with Bun
bun install

# Set up environment variables
cp .env.example .env
# Edit .env with your values:
#   BROWSERBASE_API_KEY=bb_live_xxxxx
#   BROWSERBASE_PROJECT_ID=xxxxx
#   OPENAI_API_KEY=sk-xxxxx

# Create output directories
mkdir -p output/screenshots output/reports

# Run test suite
bun test

# Test CLI with sample game
bun run src/main.ts https://example.com/game
```

### Environment Variables
```bash
# Required - Browserbase
BROWSERBASE_API_KEY=bb_live_xxxxx
BROWSERBASE_PROJECT_ID=xxxxx

# Required - OpenAI
OPENAI_API_KEY=sk-xxxxx

# Optional - Feature Flags (all default to false)
DEBUG=false
ENABLE_CACHING=false
ENABLE_PROGRESS_UPDATES=false
ENABLE_ERROR_RECOVERY=false
ENABLE_SCREENSHOT_CLEANUP=false

# Optional - Timeout Overrides (milliseconds)
MAX_TEST_DURATION=240000      # 4 minutes (default)
GAME_LOAD_TIMEOUT=60000       # 60 seconds (default)
INTERACTION_TIMEOUT=90000     # 90 seconds (default)
```

---

## Dependencies

### Core Dependencies
- `@browserbasehq/sdk@^1.0.0` - Browserbase session management
- `@browserbasehq/stagehand@^1.0.0` - AI-powered browser automation
- `ai@^3.4.0` - Vercel AI SDK for LLM integration
- `@ai-sdk/openai@^0.0.66` - OpenAI provider for AI SDK
- `zod@^3.22.4` - Schema validation and type inference
- `dotenv@^16.4.5` - Environment variable loader
- `p-timeout@^6.1.2` - Promise timeout utility
- `nanoid@^5.0.7` - Unique ID generation

### Development Dependencies
- `@types/bun@latest` - Bun type definitions
- `@types/node@^20.11.0` - Node.js type definitions
- `typescript@^5.3.3` - TypeScript compiler

### Why We Chose These

**Bun over Node.js**: 3x faster startup, native TypeScript support, simpler deployment to Lambda

**Browserbase over Puppeteer/Playwright**: Managed infrastructure eliminates need to bundle Chromium (250MB+ savings in Lambda package), handles browser lifecycle, includes debugging tools

**Stagehand over raw Playwright**: AI-native element detection using natural language ("click the start button") instead of brittle CSS selectors, adapts to UI changes automatically

**GPT-4 Vision**: Only model with sufficient accuracy for canvas game analysis, multimodal support for images + text prompts, structured output support via function calling

**Vercel AI SDK over raw OpenAI**: Abstracts provider-specific APIs, built-in support for streaming and structured outputs, easier to swap providers if needed

**Zod**: Runtime validation ensures API responses match expected schema, TypeScript types inferred automatically, excellent error messages for debugging

---

## Technical Constraints

### Performance Requirements
- **Max test duration**: 4 minutes (240 seconds) - Lambda timeout constraint
- **Game load timeout**: 60 seconds - Heavy games with large assets
- **Interaction timeout**: 90 seconds - Simulate gameplay
- **Screenshot timeout**: 10 seconds - Per capture operation
- **Vision API latency**: 3-5 seconds per screenshot analysis

### Platform Constraints
- **Lambda /tmp storage**: 512MB (screenshots + reports)
- **Lambda memory**: 2048MB (optimal for cold start speed)
- **Lambda timeout**: 10 minutes (hard limit, target 4-minute completion)
- **Browserbase session limits**: Check account plan limits
- **OpenAI rate limits**: 10,000 requests/min (Tier 4)

### Security Requirements
- **API Keys**: Stored in environment variables, never logged
- **Screenshots**: May contain user data, handle per privacy policy
- **Input validation**: Validate game URLs to prevent SSRF attacks
- **Lambda IAM**: Least privilege permissions (no S3/DynamoDB access needed for MVP)

---

## Build & Deployment

### Build Process
```bash
# Bun doesn't require build step for Lambda
# Bundle with dependencies
bun build src/main.ts --target=bun --outdir=dist

# Create deployment package
./scripts/package-lambda.sh
```

### Lambda Deployment
```bash
# Using AWS CLI (manual deployment)
aws lambda update-function-code \
  --function-name dreamup-qa-agent \
  --zip-file fileb://lambda-package.zip

# Or using Infrastructure as Code (recommended)
# - Serverless Framework: serverless deploy
# - AWS CDK: cdk deploy
# - Terraform: terraform apply
```

### Lambda Configuration Template
```yaml
# Example serverless.yml
service: dreamup-qa-agent

provider:
  name: aws
  runtime: provided.al2  # Custom Bun runtime
  memorySize: 2048
  timeout: 600  # 10 minutes
  environment:
    BROWSERBASE_API_KEY: ${ssm:/dreamup/browserbase-api-key}
    BROWSERBASE_PROJECT_ID: ${ssm:/dreamup/browserbase-project-id}
    OPENAI_API_KEY: ${ssm:/dreamup/openai-api-key}
    NODE_ENV: production

functions:
  qaAgent:
    handler: src/main.handler
    layers:
      - arn:aws:lambda:us-east-1:xxxx:layer:bun-runtime:1
```

### Environments
- **Local Development**: Run with Bun CLI (`bun run src/main.ts <game-url>`)
- **Lambda Staging**: Separate function for pre-production testing
- **Lambda Production**: Production function with monitoring and alarms

---

## Directory Structure

```
dreamup/
├── src/
│   ├── main.ts                    # Entry point (CLI + Lambda handler)
│   ├── core/                      # Core automation modules
│   │   ├── browser-manager.ts     # Browserbase + Stagehand init
│   │   ├── game-detector.ts       # Canvas/iframe/DOM detection
│   │   ├── game-interactor.ts     # AI-powered interaction
│   │   ├── error-monitor.ts       # Console error capture
│   │   └── screenshot-capturer.ts # Screenshot orchestration
│   ├── vision/                    # GPT-4 Vision integration
│   │   ├── analyzer.ts            # Vision API calls
│   │   ├── prompts.ts             # Prompt templates
│   │   └── schema.ts              # Zod schemas
│   ├── utils/                     # Utilities
│   │   ├── logger.ts              # Structured logging
│   │   ├── timeout.ts             # Timeout helpers
│   │   └── file-manager.ts        # Screenshot file I/O
│   ├── config/                    # Configuration
│   │   ├── constants.ts           # Timeouts, thresholds, paths
│   │   └── feature-flags.ts       # Future feature toggles
│   └── types/                     # TypeScript types
│       ├── game-test.types.ts     # Core interfaces
│       └── config.types.ts        # Config interfaces
├── tests/
│   ├── fixtures/                  # Test game URLs
│   ├── unit/                      # Unit tests
│   └── integration/               # Integration tests
├── output/                        # Local dev output (gitignored)
│   ├── screenshots/
│   └── reports/
├── memory-bank/                   # AI agent memory
├── _docs/                         # Project documentation
├── .cursor/                       # Cursor IDE config
├── scripts/                       # Automation scripts
├── .env.example                   # Env template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Troubleshooting

### Common Issues

#### Issue 1: Browserbase session fails to initialize
**Symptoms**: Error "Failed to connect to Browserbase"
**Solution**:
- Verify `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` are correct
- Check Browserbase account has available sessions
- Ensure Lambda has internet access (VPC configuration if applicable)

#### Issue 2: Vision API timeout
**Symptoms**: Error "Vision analysis exceeded timeout"
**Solution**:
- Check OpenAI API key is valid
- Verify OpenAI account has GPT-4 Vision access enabled
- Reduce screenshot resolution if payloads are too large
- Check for rate limiting (429 errors)

#### Issue 3: Lambda timeout before test completes
**Symptoms**: Lambda terminates before returning result
**Solution**:
- Check game isn't taking too long to load (increase `GAME_LOAD_TIMEOUT`)
- Reduce number of screenshots captured
- Optimize vision prompts to reduce token usage
- Consider increasing Lambda timeout to 15 minutes

#### Issue 4: Screenshot not saving to /tmp
**Symptoms**: Error "Failed to save screenshot"
**Solution**:
- Check /tmp directory exists and is writable
- Verify ephemeral storage hasn't hit 512MB limit
- Ensure proper cleanup of old screenshots between invocations

#### Issue 5: Canvas game not detected
**Symptoms**: GameType returns UNKNOWN
**Solution**:
- Game may be in iframe (check `detectIframe()`)
- Canvas may be created dynamically after page load (increase wait time)
- Use vision fallback to analyze page structure
