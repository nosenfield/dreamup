# Memory Bank: DreamUp

**Purpose**: Context preservation for AI development sessions

**Last Updated**: November 8, 2025

---

## Quick Start

### For New Sessions
1. **Read First**: `activeContext.md` - Current work and decisions
2. **Then Read**: `_docs/refactor-plan.md` - Implementation details
3. **Reference**: `systemPatterns.md` - Architecture and design patterns

### For Continuing Sessions
1. Check `activeContext.md` for refactor progress
2. Follow step-by-step plan in `_docs/refactor-plan.md`

---

## File Guide

### activeContext.md ⭐ READ FIRST
**What it contains**: Current session state, active decisions, next steps
**When to read**: Start of every session
**Update frequency**: Every session

### progress.md
**What it contains**: Milestone tracking, test status, time tracking
**When to read**: To understand project completion status
**Update frequency**: Weekly or after major milestones

### productContext.md
**What it contains**: User personas, user flows, feature priorities
**When to read**: When adding features or changing UX
**Update frequency**: Rarely (product vision is stable)

### projectbrief.md
**What it contains**: MVP scope, success criteria, timeline
**When to read**: To understand project goals and constraints
**Update frequency**: Rarely (scope is locked)

### systemPatterns.md
**What it contains**: Architecture, design patterns, key invariants
**When to read**: Before making structural changes
**Update frequency**: When adding new patterns (e.g., Pattern 11)

### techContext.md
**What it contains**: Tech stack, dependencies, deployment
**When to read**: For setup, troubleshooting, or adding dependencies
**Update frequency**: When dependencies change

---

## Current State (Nov 8, 2025)

**Project**: DreamUp - Autonomous game QA agent
**Status**: MVP Complete, Refactor In Progress
**Branch**: `refactor/logging-and-separation`
**Focus**: Improving code maintainability and logging clarity

### Refactor Progress
- [x] Phase 1.1: Enhanced Logger ✅
- [ ] Phase 2: Start Detection Separation (NEXT)
- [ ] Phase 3: Adaptive Loop Extraction
- [ ] Phase 4: Screenshot Timing Fix
- [ ] Phase 5: Error Handling

**See**: `activeContext.md` for detailed progress

---

## Key Concepts

### DreamUp Project
An AI agent that tests browser games automatically:
- Navigates to game URL
- Detects game type (canvas/iframe/DOM)
- Interacts with game using AI
- Captures screenshots
- Analyzes playability with GPT-4 Vision
- Returns structured test report

### Current Focus: Refactor
**Problem**: Logs are flooded, code is hard to iterate on
**Solution**:
- Clear phase separation in logs
- Extract start detection into strategy files
- Extract adaptive loop into dedicated class
- Better error handling

---

## Navigation

### Project Documentation
- `README.md` - User-facing documentation
- `_docs/refactor-plan.md` - **READ THIS** for refactor details
- `_docs/architecture.md` - System architecture
- `_docs/control-flow.md` - QA process flow
- `_docs/testing-guide.md` - Manual testing procedures

### Code Structure
```
src/
├── main.ts              # Entry point
├── core/                # Core modules
│   ├── browser-manager.ts
│   ├── game-interactor.ts  # Being refactored (Phase 2)
│   └── state-analyzer.ts
├── utils/
│   └── logger.ts        # Enhanced (Phase 1.1 ✅)
└── vision/
    └── analyzer.ts
```

---

## Important Notes

### For AI Assistants
- **Always read** `activeContext.md` first
- **Never** introduce breaking changes without user approval
- **Always** run tests after making changes
- **Follow** the refactor plan step-by-step

### For Human Developers
- Memory bank files track AI development context
- Update `activeContext.md` at end of each session
- Refactor plan is in `_docs/refactor-plan.md`
- All tests must pass before committing

---

## File Hierarchy

```
projectbrief.md → productContext.md → activeContext.md
                → systemPatterns.md   ↗
                → techContext.md      ↗

activeContext.md → progress.md
```

## When to Update

- **activeContext.md**: After every significant change
- **progress.md**: After completing tasks/milestones
- **systemPatterns.md**: When new patterns emerge
- **Others**: When information changes (rare)
