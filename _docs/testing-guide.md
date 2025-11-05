# Manual Testing Guide for DreamUp QA Agent

**Last Updated**: November 5, 2025  
**Purpose**: Guide for manual testing with real games to validate agent accuracy and performance

---

## Overview

This guide provides procedures for manually testing DreamUp with real browser-based games to:
- Validate accuracy of game type detection
- Verify vision analysis quality
- Test edge cases and error handling
- Measure performance metrics
- Ensure no false positives/negatives

---

## Prerequisites

1. **Environment Setup**:
   - `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` set in `.env`
   - `OPENAI_API_KEY` set for vision analysis (optional but recommended)
   - Bun runtime installed

2. **Test Games**:
   - Access to 10+ real game URLs
   - Mix of canvas, iframe, and DOM games
   - Some intentionally broken games for validation

---

## Test Game List

### Canvas Games (Primary)
1. **Pong** - `https://example.com/pong` (with metadata.json)
   - Expected: Canvas detection, playability score 70-100
   - Metadata: `_game-examples/pong/metadata.json`

2. **Snake** - `https://example.com/snake` (with metadata.json)
   - Expected: Canvas detection, playability score 70-100
   - Metadata: `_game-examples/snake/metadata.json`

3. **2048** - `https://play2048.co/`
   - Expected: Canvas detection, playability score 80-100

4. **Asteroids** - `https://example.com/asteroids`
   - Expected: Canvas detection, playability score 70-100

5. **Pacman** - `https://example.com/pacman`
   - Expected: Canvas detection, playability score 70-100

### Iframe Games
6. **Unity WebGL Game** - `https://example.com/unity-game`
   - Expected: Iframe detection, playability score 60-100

7. **Phaser Game** - `https://example.com/phaser-game`
   - Expected: Iframe detection, playability score 60-100

### DOM Games
8. **2048 (DOM version)** - `https://example.com/2048-dom`
   - Expected: DOM detection, playability score 50-100

9. **Wordle Clone** - `https://example.com/wordle`
   - Expected: DOM detection, playability score 50-100

### Edge Cases
10. **Slow Loading Game** - `https://example.com/slow-game`
    - Expected: Timeout handling, still completes successfully
    - Notes: Game takes 30+ seconds to load

11. **Broken Game** - `https://example.com/broken-game`
    - Expected: Error detection, playability score 0-50, status 'fail'
    - Notes: Game crashes on load or interaction

12. **No UI Game** - `https://example.com/no-ui-game`
    - Expected: Graceful handling, appropriate error message

---

## Testing Procedures

### Basic Test Flow

For each game:

1. **Run CLI test**:
   ```bash
   bun run src/main.ts <game-url>
   ```

2. **Run with metadata** (if available):
   ```bash
   bun run src/main.ts <game-url> --metadata ./_game-examples/pong/metadata.json
   ```

3. **Verify results**:
   - Check `output/screenshots/` for 3 screenshots
   - Check `output/reports/` for JSON report
   - Verify playability score is reasonable
   - Verify game type detection is correct
   - Verify no false positives (broken games marked as 'fail')

### Validation Checklist

For each test:

- [ ] **Game Type Detection**: Correctly identified (canvas/iframe/DOM/UNKNOWN)
- [ ] **Screenshots**: 3 screenshots captured (initial_load, after_interaction, final_state)
- [ ] **Playability Score**: Score between 0-100, matches game state
- [ ] **Status**: Correct status (pass/fail/error)
- [ ] **Issues**: Relevant issues identified (if any)
- [ ] **Console Errors**: Errors captured and included in metadata
- [ ] **Performance**: Test completes in <4 minutes
- [ ] **Vision Analysis**: Accurate analysis (if OPENAI_API_KEY set)
- [ ] **Metadata Integration**: Works correctly with metadata.json (if provided)

### Edge Case Testing

#### Slow Loading Games
- [ ] Test completes successfully despite slow load
- [ ] Appropriate timeout handling
- [ ] Screenshots captured even if game loads slowly

#### Broken Games
- [ ] Correctly identifies broken games as 'fail'
- [ ] Playability score < 50
- [ ] Console errors captured
- [ ] No false positives (doesn't mark broken as 'pass')

#### Games with No UI
- [ ] Graceful handling
- [ ] Appropriate error messages
- [ ] No crashes

#### Games with Splash Screens
- [ ] Waits for splash screen to complete
- [ ] Captures screenshots at appropriate times
- [ ] Start button detection works correctly

---

## Performance Testing

### Metrics to Track

| Metric | Target | Measurement |
|--------|--------|-------------|
| Test Duration | <4 minutes | Average across 10 tests |
| Vision API Cost | <$0.05 per test | Check OpenAI dashboard |
| Screenshot Quality | Clear, readable | Manual inspection |
| False Positive Rate | <1% | Broken games marked as 'fail' |
| False Negative Rate | <20% | Working games marked as 'pass' |

### Performance Test Procedure

1. Run 10 tests with different games
2. Record duration for each test
3. Calculate average duration
4. Verify all tests complete in <4 minutes
5. Check OpenAI API costs (if vision analysis enabled)

---

## Accuracy Validation

### Test Scenarios

1. **Working Games**: Should score 70-100, status 'pass'
2. **Broken Games**: Should score 0-50, status 'fail'
3. **Slow Games**: Should still complete, may have warnings
4. **Games with Console Errors**: Should capture errors, may affect score

### Validation Criteria

- **80%+ Accuracy**: 8 out of 10 games correctly assessed
- **No False Positives**: Broken games never marked as 'pass'
- **Reasonable Scores**: Scores match visual assessment of game state

---

## Troubleshooting

### Common Issues

1. **"Missing required environment variables"**
   - Check `.env` file has `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID`
   - Verify variables are loaded (Bun loads `.env` automatically)

2. **"Game type detection failed"**
   - Expected for some games (may default to UNKNOWN)
   - Test should still complete successfully

3. **"Vision analysis failed"**
   - Check `OPENAI_API_KEY` is set
   - Check API key is valid
   - Test will continue without vision analysis

4. **Screenshots not captured**
   - Check `output/screenshots/` directory exists
   - Check file permissions
   - Review logs for errors

5. **Test takes too long (>4 minutes)**
   - Check game loading time
   - May need to adjust timeout constants
   - Check network connectivity

---

## Recording Results

### Test Results Template

```markdown
## Test Results - [Date]

### Game: [Game Name]
- URL: [game-url]
- Type: [canvas/iframe/DOM/UNKNOWN]
- Status: [pass/fail/error]
- Playability Score: [0-100]
- Duration: [seconds]
- Metadata Used: [yes/no]
- Issues Found: [list]
- Notes: [any observations]

### Overall Statistics
- Total Tests: [number]
- Pass Rate: [percentage]
- Average Duration: [seconds]
- False Positives: [number]
- False Negatives: [number]
```

---

## Continuous Testing

### Recommended Schedule

- **After each iteration**: Test with 1-2 real games
- **Before release**: Test with 10+ games covering all types
- **Weekly**: Test with 5 games to catch regressions

### Test Maintenance

- Update test game list as URLs change
- Add new edge cases as discovered
- Document any new patterns or issues found

---

## Notes

- Manual testing requires real API keys and incurs costs
- Use test fixtures (`tests/fixtures/sample-games.ts`) for automated testing
- This guide complements automated integration tests
- Results should be documented in `_context-summaries/` for future reference

---

**Next Steps**: After completing manual testing, update `memory-bank/progress.md` with results and any issues found.

