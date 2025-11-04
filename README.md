# DreamUp

Autonomous AI agent for automated QA testing of browser-based games. The agent navigates to a game URL, detects the game type, interacts with the game using AI-powered vision and browser automation, captures screenshots, monitors for errors, and produces a structured report with a playability score (0-100) and identified issues.

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

## Running the Project

### Development Mode
```bash
bun run dev
```

### Run QA Test
```bash
bun run qa <game-url>
```

### Build for Production
```bash
bun run build
```

### Run Tests
```bash
bun test
```

## Project Structure

```
dreamup/
├── src/
│   ├── main.ts              # Entry point (CLI or Lambda handler)
│   ├── core/                # Core browser automation logic
│   ├── vision/              # GPT-4 Vision integration
│   ├── utils/               # Utility functions
│   ├── config/              # Configuration constants
│   └── types/               # TypeScript type definitions
├── tests/                   # Test files
├── output/                  # Screenshots and reports (gitignored)
└── .env.example             # Environment variables template
```

## Development

This project uses:
- **Bun** for runtime and package management
- **TypeScript** with strict mode for type safety
- **Bun's built-in test runner** for testing

## License

[Add license information]

---

This project was created using `bun init` in bun v1.3.1. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
