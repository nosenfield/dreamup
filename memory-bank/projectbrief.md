# Project Brief: DreamUp

**Version**: 1.0
**Last Updated**: November 3, 2025

## Project Overview

### What We're Building
An autonomous AI agent that performs automated QA testing of browser-based games. The agent navigates to a game URL, detects the game type (canvas/iframe/DOM), interacts with the game using AI-powered vision and browser automation, captures screenshots, monitors for errors, and produces a structured report with a playability score (0-100) and identified issues.

### Core Problem
Manual QA testing of browser games is time-consuming, inconsistent, and doesn't scale. Game developers and platforms need an automated way to verify that games load correctly, are playable, and don't have critical errors—especially for user-generated content or third-party games that need validation before publishing.

### Target Users
- **Game Developers**: Need fast feedback on game builds during development
- **QA Teams**: Need to test multiple games efficiently
- **Game Platforms**: Need to validate games before publishing to ensure quality

### Success Criteria
- **Accuracy**: 80%+ correct classification (playable vs broken games)
- **Performance**: Complete tests in <4 minutes average
- **Cost**: <$0.05 per game test (vision API costs)
- **Reliability**: No false positives (passing broken games)

---

## MVP Scope

### Must Have
- [ ] Browserbase + Stagehand integration for browser automation
- [ ] Canvas/iframe/DOM game type detection
- [ ] Multi-signal game ready detection (canvas rendering, network idle, no loading text)
- [ ] AI-powered game interaction using GPT-4 Vision
- [ ] Screenshot capture at key stages (initial load, after interaction, final state)
- [ ] Console error monitoring (capture JS errors/warnings)
- [ ] GPT-4 Vision analysis of screenshots for playability assessment
- [ ] Structured JSON report with playability score (0-100, pass threshold: 50+)
- [ ] Automated issue detection with severity levels (critical/major/minor)
- [ ] Lambda deployment ready (Bun runtime, 10-minute timeout, 2048MB memory)

### Explicitly Out of Scope
- **Caching system** (stub implementation for future, flag: enableCaching=false)
- **Real-time progress updates** (stub implementation for future, flag: enableProgressUpdates=false)
- **Error recovery/retry logic** (fail immediately on errors, flag: enableErrorRecovery=false)
- **Screenshot cleanup** (keep all screenshots, flag: enableScreenshotCleanup=false)
- **Multi-game batch testing** (run one game at a time)
- **Performance profiling** (focus on functional correctness first)

---

## Technical Constraints

### Performance Targets
- **Max test duration**: 4 minutes (240 seconds)
- **Game load timeout**: 60 seconds
- **Interaction timeout**: 90 seconds
- **Screenshot timeout**: 10 seconds per capture
- **Vision API cost**: <$0.05 per test (5 screenshots max)

### Platform Requirements
- **Deployment**: AWS Lambda (custom Bun runtime)
- **Memory**: 2048MB (faster cold starts)
- **Timeout**: 10 minutes (safety margin, aim for 4-minute completion)
- **Ephemeral storage**: 512MB /tmp (for screenshots)

### Dependencies
- **Browserbase API**: Managed browser infrastructure, session management
- **OpenAI GPT-4 Vision API**: Screenshot analysis, UI element detection
- **Stagehand**: AI-native browser automation (natural language commands)
- **Vercel AI SDK**: OpenAI integration with structured outputs
- **Zod**: Runtime schema validation for type-safe outputs

---

## Project Timeline

- **MVP Target**: 2-3 weeks (67-94 hours development)
- **Key Milestones**:
  - **Milestone 1 (Foundation)**: Project setup, types, utilities (12-16 hours)
  - **Milestone 2 (Core Features)**: Browser automation + vision analysis (21-29 hours)
  - **Milestone 3 (MVP Complete)**: Full end-to-end flow + testing (34-42 hours)
  - **Milestone 4 (Production Ready)**: Documentation + deployment (9-14 hours)
