# Stagehand Agent QA Mode - Quick Reference

## Overview

Fully autonomous QA mode using Stagehand's agent with OpenAI computer-use-preview model.

**Key Benefit**: No manual loop management - agent handles everything internally.

## Setup

### 1. Environment Variables

Required:
```bash
OPENAI_API_KEY=your-openai-api-key
BROWSERBASE_API_KEY=your-browserbase-key
BROWSERBASE_PROJECT_ID=your-project-id
```

Optional:
```bash
ENABLE_STAGEHAND_AGENT=true  # Enable mode
```

### 2. OpenAI Model Access

Ensure you have access to `computer-use-preview` model:
https://platform.openai.com/docs/models/computer-use-preview

## Usage

### CLI

```bash
# Basic (no metadata)
ENABLE_STAGEHAND_AGENT=true bun run src/main.ts https://example.com/game

# With metadata
ENABLE_STAGEHAND_AGENT=true bun run src/main.ts https://example.com/game --metadata ./game/metadata.json
```

### Lambda

```json
{
  "gameUrl": "https://example.com/game",
  "metadata": {
    "genre": "arcade",
    "inputSchema": { "actions": ["Pause"], "axes": ["MoveVertical"] },
    "testingStrategy": { "instructions": "Start game; Test controls; Score points" }
  },
  "config": {
    "featureFlags": { "enableStagehandAgent": true }
  }
}
```

## How It Works

1. **Initialize**: Browser + Stagehand + OpenAI agent
2. **Navigate**: Load game, wait for ready state
3. **Build Instruction**: Use metadata to create natural language instruction
4. **Agent Execute**: Agent autonomously explores game (up to 25 actions, 4 min timeout)
5. **Final Analysis**: Capture screenshot, run vision analysis
6. **Result**: Return with agent action history and playability score

## Configuration

Located in `src/config/constants.ts`:

```typescript
export const STAGEHAND_AGENT_DEFAULTS = {
  MAX_STEPS: 25,                                  // Max autonomous actions
  MODEL: 'openai/computer-use-preview',          // OpenAI model
  HIGHLIGHT_CURSOR: false,                        // Visual cursor
  SYSTEM_PROMPT: 'You are a QA tester...',       // Agent behavior
};
```

## Metadata-Driven Instructions

### Without Metadata
"Play this browser game and test basic functionality. Try different controls and interactions."

### With Metadata (Pong example)
"Test this arcade game. Expected controls: Pause, RightPaddleVertical. Your objectives: Start the game; Test paddle controls; Score at least one point. Play for about 2 minutes or until you reach a clear completion point."

## Result Structure

```json
{
  "status": "pass",
  "playability_score": 85,
  "issues": [],
  "screenshots": ["/path/to/final_screenshot.png"],
  "timestamp": "2025-01-01T00:00:00Z",
  "metadata": {
    "sessionId": "abc123",
    "gameUrl": "https://example.com/game",
    "duration": 180000,
    "gameType": "CANVAS",
    "consoleErrors": [],
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

## Troubleshooting

### Error: "OPENAI_API_KEY environment variable is required"
→ Set `OPENAI_API_KEY` in `.env` file

### Error: "Unable to access Stagehand instance from page"
→ Ensure BrowserManager is using Stagehand v3 (check `package.json`)

### Agent execution timeout
→ Increase `MAX_TEST_DURATION` or reduce task complexity in metadata.testingStrategy.instructions

### High cost
→ Reduce `MAX_STEPS` in constants or simplify instruction

### Agent gets stuck
→ Check agent action history in result, refine instruction or add more specific goals in metadata

## Comparison to Other Modes

| When to use | Mode |
|-------------|------|
| Quick validation, simple games | Standard QA |
| Complex games, custom loop logic | Adaptive QA |
| **Fully autonomous, hands-off testing** | **Stagehand Agent** |

## References

- Stagehand Agent Docs: https://docs.stagehand.dev/v3/basics/agent
- OpenAI Computer Use: https://platform.openai.com/docs/models/computer-use-preview
- Our Control Flow: `_docs/control-flow.md`
- Our Implementation: `src/main.ts:runStagehandAgentQA()`

