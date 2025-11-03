# Product Context: DreamUp

**Last Updated**: November 3, 2025

## User Personas

### Primary User: Game Developer
- **Role**: Solo indie developer or small studio engineer
- **Goals**: Get fast feedback on game builds, catch breaking bugs before publishing
- **Pain Points**: Manual testing is time-consuming, hard to reproduce edge cases
- **How they use DreamUp**: Run tests after each build, integrate into CI/CD pipeline
- **Success Metric**: Catches 80%+ of critical bugs automatically

### Secondary User: QA Engineer
- **Role**: QA team member at game platform or publisher
- **Goals**: Validate multiple games efficiently, ensure quality before approval
- **Pain Points**: Too many games to test manually, inconsistent test coverage
- **How they use DreamUp**: Batch test submitted games, triage results for manual review
- **Success Metric**: Reduces manual QA time by 60%+

### Tertiary User: Game Platform Owner
- **Role**: Platform operator (e.g., itch.io, Newgrounds, app store)
- **Goals**: Automated quality gate for user-submitted games
- **Pain Points**: Can't manually test every submission, broken games hurt user trust
- **How they use DreamUp**: Automated webhook on game submission, block broken games
- **Success Metric**: Zero broken games published to platform

---

## User Flows

### Flow 1: CLI Testing (Developer)

**Trigger**: Developer builds new game version locally

**Steps**:
1. Developer runs: `bun run qa https://localhost:8080/game`
2. DreamUp agent starts browser automation
3. Agent navigates to game URL
4. Agent detects game type, waits for load
5. Agent interacts with game (clicks, keyboard inputs)
6. Agent captures screenshots and console errors
7. Agent analyzes screenshots with GPT-4 Vision
8. Agent prints report to terminal

**Success Criteria**:
- Test completes in <4 minutes
- Report clearly identifies root cause
- Developer can fix issue without manual debugging

---

### Flow 2: Lambda API Testing (Platform Integration)

**Trigger**: Game submitted to platform via webhook

**Steps**:
1. Platform receives game submission
2. Platform invokes Lambda with game URL
3. Lambda executes DreamUp agent
4. Agent performs automated test
5. Agent returns GameTestResult
6. Platform checks playability_score >= 50
7. **If pass**: Approve game for publishing
8. **If fail**: Reject with reason, notify developer

**Success Criteria**:
- Zero false positives (no broken games approved)
- <5% false negatives (good games rejected)
- Platform can trust automated decision

---

## Feature Priorities

### Must Have (MVP)
1. Automated game load detection
2. AI-powered interaction (no manual selectors)
3. Screenshot capture + vision analysis
4. Console error monitoring
5. Structured JSON report with playability score
6. CLI interface for local testing
7. Lambda deployment ready

### Should Have (Post-MVP)
8. Progress streaming (real-time updates during test)
9. Retry logic (attempt recovery on transient failures)
10. Caching (skip re-testing unchanged games)
11. Screenshot cleanup (delete old screenshots automatically)

---

## Success Metrics

| Metric | Baseline (Manual) | Target (DreamUp) |
|--------|------------------|------------------|
| Time per test | 15-30 min | <4 min |
| False positive rate | N/A | <1% |
| False negative rate | N/A | <20% |
| Critical bug detection | Variable | 80%+ |
| Cost per test | $5-10 (human time) | <$0.05 |
