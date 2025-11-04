# Stagehand v3 Upgrade Guide

**Created**: November 4, 2025
**Priority**: CRITICAL - Blocks Iteration 1 completion
**Estimated Time**: 15-20 minutes

---

## Problem Statement

**Runtime Error Discovered**:
```
Error: Playwright does not currently support the Bun runtime environment.
Please use Node.js instead.
For more information, see: https://github.com/microsoft/playwright/issues/27139
```

**Root Cause**:
- Stagehand v1.x (`^1.0.0`) internally depends on Playwright
- Playwright refuses to run on Bun runtime
- Our codebase uses Bun as primary runtime (per tech stack decision)

**Solution**:
- Upgrade to Stagehand v3.0.1
- v3 removes Playwright dependency, uses Chrome DevTools Protocol (CDP) directly
- v3 is Bun-compatible and production-ready

---

## Changes Required

### 1. Package Upgrade

**File**: `package.json`

```bash
# Run this command:
bun add @browserbasehq/stagehand@3.0.1
```

**Before**:
```json
{
  "dependencies": {
    "@browserbasehq/stagehand": "^1.0.0"
  }
}
```

**After**:
```json
{
  "dependencies": {
    "@browserbasehq/stagehand": "^3.0.1"
  }
}
```

---

### 2. Update BrowserManager Implementation

**File**: `src/core/browser-manager.ts`

#### Change 1: Page Access Pattern (Line ~127)

**Before (v1)**:
```typescript
// Get page object from Stagehand
this.page = this.stagehand.page;
this.isInitialized = true;
```

**After (v3)**:
```typescript
// Get page object from Stagehand context
// v3 uses context API but also provides convenience getter
this.page = this.stagehand.page; // Convenience getter still works
// OR explicitly: this.page = this.stagehand.context.pages()[0];
this.isInitialized = true;
```

**Note**: Stagehand v3 still provides `stagehand.page` as a convenience getter, so minimal code change needed. If this doesn't work, use `stagehand.context.pages()[0]`.

#### Change 2: Optional Model Configuration

**File**: `src/core/browser-manager.ts` (Line 20-35)

Consider adding optional model parameter for future AI features:

```typescript
export interface BrowserManagerConfig {
  apiKey: string;
  projectId: string;
  logger: Logger;
  initTimeout?: number;
  navigateTimeout?: number;
  model?: string;  // NEW: Optional AI model (e.g., "openai/gpt-4o")
}
```

Then in constructor (Line 113-117):

```typescript
// Create Stagehand instance with Browserbase configuration
this.stagehand = new Stagehand({
  env: 'BROWSERBASE',
  apiKey: this.apiKey,
  projectId: this.projectId,
  // Optional: include model if provided
  ...(config.model ? { model: config.model } : {}),
});
```

**This is optional for Iteration 1** (we don't use AI features yet), but sets us up for Iteration 4.

---

### 3. Update Integration Tests

**File**: `tests/integration/browser-manager.test.ts`

#### Update Mock Structure

The mock structure likely needs minor updates for v3 API:

**Before (v1)**:
```typescript
const mockStagehand = {
  init: mock(() => Promise.resolve()),
  page: mockPage,
};
```

**After (v3)**:
```typescript
const mockStagehand = {
  init: mock(() => Promise.resolve()),
  page: mockPage,  // Convenience getter still works
  context: {
    pages: mock(() => [mockPage]),  // NEW: context API
  },
};
```

Test the mocks after upgrade - they may "just work" if Stagehand v3 maintains the `page` getter.

---

### 4. Verify TypeScript Types

**File**: `src/core/browser-manager.ts` (Line 12)

The type import should remain the same:

```typescript
import type { Page } from '@browserbasehq/stagehand';
```

Verify TypeScript compilation after upgrade:

```bash
bunx tsc --noEmit
```

---

## Implementation Steps

### Step 1: Upgrade Package
```bash
cd /Users/nosenfield/Desktop/GauntletAI/Week-4-DreamUp/dreamup
bun add @browserbasehq/stagehand@3.0.1
```

### Step 2: Verify Current Code

Check if `stagehand.page` getter still works in v3:

- If YES: No code changes needed in `browser-manager.ts`
- If NO: Change to `stagehand.context.pages()[0]`

### Step 3: Update Tests

Run tests to see if mocks need updating:

```bash
bun test tests/integration/browser-manager.test.ts
```

Update mock structure if needed (add `context.pages()` method).

### Step 4: Compile TypeScript

```bash
bunx tsc --noEmit
```

Fix any type errors that appear.

### Step 5: Test with Real Game

```bash
bun run src/main.ts https://funhtml5games.com/2048/index.html
```

**Expected Output**:
- No Playwright error
- Browser initializes successfully
- Game loads in Browserbase
- Screenshot captured and saved
- Clean exit with structured logs

### Step 6: Run All Tests

```bash
bun test
```

Ensure all 104+ tests still pass.

---

## Acceptance Criteria

- [ ] Package upgraded to `@browserbasehq/stagehand@3.0.1`
- [ ] TypeScript compilation passes (`bunx tsc --noEmit`)
- [ ] All integration tests pass (11 tests for BrowserManager)
- [ ] All unit tests pass (104+ tests total)
- [ ] Real game test succeeds without Playwright error
- [ ] Screenshot saved to `output/screenshots/`
- [ ] Structured JSON logs show successful execution

---

## Rollback Plan

If upgrade fails, rollback to v1:

```bash
bun add @browserbasehq/stagehand@^1.0.0
git restore src/core/browser-manager.ts
git restore tests/integration/browser-manager.test.ts
```

Then reconsider alternative solutions (switch to Node.js or wait for better Bun support).

---

## API Differences Summary (v1 → v3)

Based on Stagehand v3 migration guide:

### Initialization
- ✅ **No change**: `env: 'BROWSERBASE'` still works
- ✅ **No change**: `apiKey` and `projectId` still required
- ✅ **No change**: `await stagehand.init()` still works
- ⚠️ **Optional**: Can add `model` parameter for AI features

### Page Access
- ⚠️ **Changed**: `stagehand.page` → `stagehand.context.pages()[0]` (but v3 may keep convenience getter)
- Test both patterns to see which works

### AI Methods (Not used in Iteration 1)
- `act()`, `extract()`, `observe()` moved from `page` to `stagehand` instance
- Not relevant until Iteration 4 (Vision Analysis)

---

## References

- [Stagehand v3 Announcement](https://www.browserbase.com/blog/stagehand-v3)
- [Stagehand v3 Migration Guide](https://docs.stagehand.dev/v3/migrations/v2)
- [Playwright Bun Issue #27139](https://github.com/microsoft/playwright/issues/27139)
- [Stagehand GitHub](https://github.com/browserbase/stagehand)

---

## Notes for Future Iterations

**Iteration 4 (Vision Analysis)** will need updates for AI method changes:

```typescript
// v1 (old)
await page.act({ action: "click button" });
await page.extract({ instruction: "get title", schema });

// v3 (new)
await stagehand.act("click button");
await stagehand.extract("get title", schema);
```

But this is not needed for Iteration 1 - just browser initialization and navigation.
