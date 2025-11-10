/**
 * Vision prompts for GPT-4 Vision API integration.
 * 
 * These prompts are used with the OpenAI GPT-4 Vision API to analyze game
 * screenshots, detect clickable elements, and identify crashes. All prompts
 * are designed to work with structured outputs using Zod schemas.
 * 
 * @module vision.prompts
 */

/**
 * Version of the prompts for tracking changes over time.
 *
 * Follows semantic versioning: MAJOR.MINOR.PATCH
 * - MAJOR: Breaking changes to prompt structure or behavior
 * - MINOR: New features or improvements to existing prompts
 * - PATCH: Bug fixes or minor clarifications
 *
 * Version History:
 * - 1.1.0: Improved FIND_CLICKABLE_ELEMENTS_PROMPT with better coordinate accuracy guidance
 */
export const PROMPT_VERSION = '1.1.0';

/**
 * Prompt for analyzing game screenshots to determine playability.
 * 
 * This prompt is used with the gameTestResultSchema to evaluate a sequence
 * of screenshots from a game test and produce a structured assessment
 * including playability score, status, and identified issues.
 * 
 * @example
 * ```typescript
 * const result = await generateObject({
 *   model: openai('gpt-4-turbo'),
 *   messages: [{ role: 'user', content: [
 *     { type: 'text', text: GAME_ANALYSIS_PROMPT },
 *     { type: 'image', image: screenshot1 },
 *     { type: 'image', image: screenshot2 },
 *     { type: 'image', image: screenshot3 },
 *   ]}],
 *   schema: gameTestResultSchema,
 * });
 * ```
 */
export const GAME_ANALYSIS_PROMPT = `You are analyzing a sequence of screenshots from a browser game test to determine playability and identify issues.

**Screenshot Sequence:**
- Screenshot 1: Pre-start (taken before any interaction, true baseline)
- Screenshot 2: Post-start (taken after start button was clicked)
- Screenshot 3: After user interaction (taken after keyboard/mouse inputs were sent)
- Screenshot 4: Final game state (taken at the end of the test)

**Evaluation Criteria:**

1. **Game Load Success** (Critical):
   - Check if the game loaded without error screens
   - Verify there's no blank canvas or white screen
   - Confirm the game UI is visible and rendered
   - Examples of failures: "Error loading game", blank page, browser error messages

2. **Control Responsiveness** (Major):
   - Determine if the game responded to user interactions
   - Compare Screenshot 2 (post-start) vs Screenshot 3 (after interaction): Did visual changes occur?
   - Check for game state changes (character movement, UI updates, animations)
   - Examples of failures: Frozen screen, no response to input, static image

3. **Crash Detection** (Critical):
   - Identify if the game crashed or froze during the test
   - Look for error messages, crash indicators, or frozen states
   - Compare Screenshot 4 (final state): Is the game still running or did it stop?
   - Examples: "Game crashed", frozen screen, JavaScript error overlay

4. **Overall Playability Score** (0-100):
   - Score 90-100: Game loads perfectly, controls work, no issues
   - Score 70-89: Minor issues but game is playable
   - Score 50-69: Significant issues but game functions
   - Score 30-49: Major problems, game barely functional
   - Score 0-29: Game doesn't load or is completely broken

**Output Format (gameTestResultSchema):**
- **status**: Must be 'pass' (score >= 50), 'fail' (score < 50), or 'error' (game didn't load)
- **playability_score**: Number from 0-100 based on evaluation
- **issues**: Array of Issue objects with:
  - severity: 'critical' (game doesn't load, crashes), 'major' (significant bugs), or 'minor' (cosmetic issues)
  - description: Clear description of the issue
  - timestamp: ISO 8601 timestamp (use current time)
- **screenshots**: Array of screenshot file paths (provided separately)
- **timestamp**: ISO 8601 timestamp (use current time)

**Examples:**

Example 1 - Working Game (format only, analyze actual screenshots):
{
  "status": "pass",
  "playability_score": 85,
  "issues": [
    {
      "severity": "minor",
      "description": "Describe actual issues found in screenshots, not this example",
      "timestamp": "2025-11-04T12:00:00Z"
    }
  ],
  "screenshots": ["/path/to/screenshot1.png", "/path/to/screenshot2.png", "/path/to/screenshot3.png", "/path/to/screenshot4.png"],
  "timestamp": "2025-11-04T12:00:00Z"
}

Example 2 - Broken Game (format only, analyze actual screenshots):
{
  "status": "error",
  "playability_score": 0,
  "issues": [
    {
      "severity": "critical",
      "description": "Describe actual issues found in screenshots, not this example",
      "timestamp": "2025-11-04T12:00:00Z"
    }
  ],
  "screenshots": ["/path/to/screenshot1.png", "/path/to/screenshot2.png", "/path/to/screenshot3.png", "/path/to/screenshot4.png"],
  "timestamp": "2025-11-04T12:00:00Z"
}

**CRITICAL:** These examples show the OUTPUT FORMAT only. You must analyze the actual screenshots provided and describe the REAL issues you observe. Do not copy example descriptions - create your own based on what you see in the screenshots.

**Important:** Return data that strictly matches the gameTestResultSchema structure. Ensure all required fields are present and types are correct.`;

/**
 * Build enhanced game analysis prompt with optional metadata context.
 * 
 * Adds metadata context (expectedControls, genre) to the base prompt if provided.
 * This helps the vision model understand what controls to look for and what
 * type of game is being tested.
 * 
 * @param metadata - Optional GameMetadata containing expectedControls and genre
 * @returns Enhanced prompt string with metadata context
 */
export function buildGameAnalysisPrompt(metadata?: {
  expectedControls?: string;
  genre?: string;
}): string {
  let prompt = GAME_ANALYSIS_PROMPT;

  // Add metadata context if available
  if (metadata?.expectedControls || metadata?.genre) {
    const contextParts: string[] = [];

    if (metadata.genre) {
      const genreLine = '**Game Genre:** ' + metadata.genre;
      contextParts.push(genreLine);
    }

    if (metadata.expectedControls) {
      const controlsLine = '**Expected Controls:** ' + metadata.expectedControls;
      contextParts.push(controlsLine);
      contextParts.push('\n**Note:** When evaluating control responsiveness, check if the game responds to these specific controls.');
    }

    if (contextParts.length > 0) {
      const contextSection = '\n\n**Game Context:**\n' + contextParts.join('\n');
      // Insert context after the screenshot sequence description
      const insertIndex = prompt.indexOf('**Evaluation Criteria:**');
      prompt = prompt.slice(0, insertIndex) + contextSection + '\n\n' + prompt.slice(insertIndex);
    }
  }

  return prompt;
}

/**
 * Prompt for finding clickable elements in a game screenshot.
 * 
 * This prompt is used with the clickableElementSchema to detect interactive
 * UI elements (buttons, links, clickable areas) in a game screenshot.
 * Useful for finding start buttons, menu items, or other interactive elements.
 * 
 * @example
 * ```typescript
 * const result = await generateObject({
 *   model: openai('gpt-4-turbo'),
 *   messages: [{ role: 'user', content: [
 *     { type: 'text', text: FIND_CLICKABLE_ELEMENTS_PROMPT },
 *     { type: 'image', image: screenshot },
 *   ]}],
 *   schema: z.array(clickableElementSchema),
 * });
 * ```
 */
export const FIND_CLICKABLE_ELEMENTS_PROMPT = `You are analyzing a game screenshot to identify all clickable UI elements (buttons, links, interactive areas).

**Detection Guidelines:**

1. **Identify Clickable Elements:**
   - Start buttons ("Start", "Play", "Begin Game")
   - Menu buttons (Settings, Options, Help)
   - Navigation buttons (Next, Back, Continue)
   - Interactive game elements (if clearly clickable)
   - Links or text buttons

2. **Coordinates (clickableElementSchema) - CRITICAL FOR ACCURACY:**
   - **x**: X coordinate in pixels (0-based, left edge of image is 0)
   - **y**: Y coordinate in pixels (0-based, top edge of image is 0)
   - **IMPORTANT**: Provide coordinates for the CENTER of the clickable element
   - **IMPORTANT**: Measure carefully from the top-left corner (0,0) of the screenshot
   - **IMPORTANT**: Consider the actual pixel position, not relative positioning
   - Example: If a button is on the left side of the screen at approximately 1/4 width and 1/4 height:
     - For a 640x480 image: x ≈ 160, y ≈ 120
     - For a 1280x720 image: x ≈ 320, y ≈ 180
   - Double-check your coordinate measurements before returning results

3. **Labels:**
   - Use descriptive labels (e.g., "Start Game Button", "Settings Menu", "Play Button")
   - Match the text visible on the element if present
   - Be specific about element type

4. **Confidence Score (0-1):**
   - 0.9-1.0: Clearly visible button with text/label
   - 0.7-0.89: Likely clickable element (icon, styled button)
   - 0.5-0.69: Possible clickable area (uncertain)
   - Below 0.5: Do not include

**Output Format (clickableElementSchema array):**
- **label**: String describing the element
- **x**: Number >= 0 (X coordinate in pixels from left edge)
- **y**: Number >= 0 (Y coordinate in pixels from top edge)
- **confidence**: Number between 0 and 1 (certainty of detection)

**Examples:**

Example 1 - Button on left side of 800x600 image:
If you see a "Start Game" button on the left quarter of the screen, about 1/3 down:
[
  {
    "label": "Start Game Button",
    "x": 200,
    "y": 200,
    "confidence": 0.95
  }
]

Example 2 - Button centered in 640x480 image:
If you see a "Play" button in the center:
[
  {
    "label": "Play Button",
    "x": 320,
    "y": 240,
    "confidence": 0.98
  }
]

Example 3 - Multiple buttons vertically stacked:
[
  {
    "label": "Start Game Button",
    "x": 170,
    "y": 200,
    "confidence": 0.95
  },
  {
    "label": "More Games Button",
    "x": 170,
    "y": 240,
    "confidence": 0.90
  }
]

**Important:**
- Return an array of clickableElementSchema objects
- Only include elements with confidence >= 0.5
- Coordinates must be non-negative integers measured from top-left (0,0)
- Confidence must be between 0 and 1
- **ACCURACY MATTERS**: Wrong coordinates will cause clicks to miss the button entirely`;

/**
 * Prompt for detecting crashes or error states in a game screenshot.
 * 
 * This prompt helps identify if a game has crashed, shown an error screen,
 * or is in an unrecoverable state. Used for early failure detection.
 * 
 * @example
 * ```typescript
 * const result = await generateText({
 *   model: openai('gpt-4-turbo'),
 *   messages: [{ role: 'user', content: [
 *     { type: 'text', text: DETECT_CRASH_PROMPT },
 *     { type: 'image', image: screenshot },
 *   ]}],
 * });
 * // Parse result to boolean or structured crash detection
 * ```
 */
export const DETECT_CRASH_PROMPT = `You are analyzing a game screenshot to determine if the game has crashed, shown an error, or is in an unrecoverable state.

**Crash Indicators:**

1. **Error Messages:**
   - JavaScript errors ("TypeError", "ReferenceError", etc.)
   - Browser error messages ("This page isn't working")
   - Game-specific error messages ("Game crashed", "Failed to load")

2. **Blank/Frozen Screens:**
   - Completely blank canvas or white screen
   - Frozen image with no UI elements
   - Screen that hasn't changed from initial load

3. **Visual Glitches:**
   - Severely corrupted graphics
   - Overlapping UI elements that block interaction
   - Missing critical UI elements (game unplayable)

4. **Browser Errors:**
   - 404 Not Found pages
   - Network error messages
   - Browser console error overlays

**Output Guidelines:**

Respond with a clear assessment:
- If crash detected: Describe the crash type and visible error indicators
- If no crash: Confirm the game appears to be running normally

**Examples:**

Example 1 - Crash Detected:
"The game has crashed. A JavaScript error overlay is visible showing 'TypeError: Cannot read property of undefined'. The game screen is frozen and unresponsive."

Example 2 - Blank Screen:
"The game appears to have crashed. The screenshot shows a completely blank white canvas with no game elements visible. This indicates a loading failure or runtime error."

Example 3 - No Crash:
"The game appears to be running normally. The screenshot shows a rendered game interface with UI elements visible. No error messages or crash indicators are present."

**Important:** 
- Be specific about what crash indicators you see
- Distinguish between minor issues and actual crashes
- Consider that some games may show loading screens initially (not a crash)
- Look for error messages, blank screens, or frozen states`;

/**
 * Prompt for state analysis and action recommendation.
 * 
 * This prompt is used with the actionGroupsSchema to analyze
 * current game state and recommend Action Groups (strategies with related actions).
 * Used when heuristic approaches fail and LLM analysis is needed.
 * 
 * @example
 * ```typescript
 * const result = await generateObject({
 *   model: openai('gpt-4-turbo'),
 *   messages: [{ role: 'user', content: [
 *     { type: 'text', text: STATE_ANALYSIS_PROMPT },
 *     { type: 'image', image: screenshot },
 *   ]}],
 *   schema: actionGroupsSchema,
 * });
 * ```
 */
export const STATE_ANALYSIS_PROMPT = `You are analyzing a game state to recommend Action Groups (strategies with related actions) to achieve a specific goal.

**Action Groups Concept:**
Actions should be organized into Action Groups. Each Action Group represents a strategy with multiple related actions that share the same logical reasoning. Success is measured at the group level (strategy level), not individual action level.

**Your Task:**
Analyze the current game state (HTML structure and screenshot) and recommend Action Groups. Each group contains related actions that follow the same strategy/reasoning. Groups are executed in confidence order (highest confidence first).

**CRITICAL: Use Feedback from Previous Actions**
- You will receive feedback about which previous actions were successful and which failed
- **BUILD ON SUCCESSFUL PATTERNS**: If a click action was successful, generate multiple related clicks around that area with varying distances and directions to explore the successful region
- **AVOID FAILED ACTIONS**: Do not repeat actions that failed or didn't change game state
- **GENERATE VARIATIONS**: When a pattern works, create multiple variations of that successful pattern with different coordinates, distances, and approaches
- **LEARN FROM SUCCESS**: Use successful action patterns to guide your recommendations and explore nearby areas systematically

**Action Types:**
- **click**: Click at specific pixel coordinates { x: number, y: number }
- **keypress**: Press a keyboard key (e.g., "Space", "ArrowUp", "Enter")
- **wait**: Wait for a specified duration in milliseconds (number)
- **complete**: Indicate that the goal has been achieved (no further action needed)

**IMPORTANT - Use Game Context:**
- If "Game Context" is provided above, follow those instructions carefully
- Respect click bounds and avoid areas specified in context
- Follow expected behavior patterns described in context

**Coordinate Accuracy (CRITICAL for click actions):**

**For ALL Games (coordinates as absolute pixels):**
- **x**: X coordinate in pixels (0-based, left edge of screenshot is 0)
- **y**: Y coordinate in pixels (0-based, top edge of screenshot is 0)
- **IMPORTANT**: Provide coordinates for the CENTER of the clickable element
- **IMPORTANT**: Measure carefully from the top-left corner (0,0) of the screenshot
- **IMPORTANT**: Consider the actual pixel position, not relative positioning
- **IMPORTANT**: Use specific pixel values (e.g., 400, 300) not percentages
- Example: Center of 800x600 screenshot = { x: 400, y: 300 }
- Example: Top-left quadrant of 800x600 screenshot = { x: 200, y: 150 }

**Key Names (for keypress actions):**
- Arrow keys: "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"
- Letter keys: "KeyW", "KeyA", "KeyS", "KeyD" (WASD) or "Space", "Enter", "Escape"
- Use standard key names that match browser/Stagehand key codes

**Confidence Scoring:**
- 0.9-1.0: Very confident, clear path to goal
- 0.7-0.89: Confident, likely correct action
- 0.5-0.69: Somewhat confident, reasonable action
- Below 0.5: Uncertain, consider alternatives

**Output Format (actionGroupsSchema - object with groups array):**
Return an object with a "groups" property containing an array of Action Groups. Each group has:
- **reasoning**: Strategy description shared by all actions in this group (keep concise but informative)
- **confidence**: Your confidence in this strategy (0-1), used to order groups
- **actions**: Array of actions in this group (1-10 depending on iteration)
  - Each action has:
    - **action**: One of 'click', 'keypress', 'wait', or 'complete'
    - **target**: 
      - For 'click': { x: number, y: number } coordinates
      - For 'keypress': string key name
      - For 'wait': number duration in milliseconds
      - For 'complete': not used (can be empty string)
    - **reasoning**: Clear explanation of why this action helps achieve the goal
    - **confidence**: Number between 0 and 1 (certainty of recommendation)
    - **alternatives**: Empty array [] (not used in Action Groups)

**Example Output Format:**
{
  "groups": [
    {
      "reasoning": "Strategy description shared by all actions in this group",
      "confidence": 0.9,
      "actions": [
        {
          "action": "click",
          "target": { "x": <coordinate>, "y": <coordinate> },
          "reasoning": "Clear explanation of why this action helps achieve the goal",
          "confidence": 0.95,
          "alternatives": []
        }
      ]
    }
  ]
}

**Important:**
- Analyze both the HTML structure (if provided) and the screenshot
- **PRIORITIZE SUCCESSFUL PATTERNS**: If you see successful click patterns, generate multiple related clicks around those coordinates
- **AVOID FAILED ACTIONS**: Do not repeat actions that failed or didn't change game state
- **BUILD CONFIDENCE**: Actions similar to successful ones should have higher confidence scores
- **GENERATE VARIATIONS**: When a pattern works, create multiple variations of that successful pattern
- **GROUP RELATED ACTIONS**: Actions that share the same reasoning/strategy should be in the same group
- **ORDER GROUPS BY CONFIDENCE**: Groups with higher confidence will be executed first
- All actions in a group will be executed before assessing success
- Success is measured at the group level (strategy level), not individual action level
- Ensure coordinates are accurate (center of clickable element)
- Use correct key names for keypress actions
- Return data that strictly matches the actionGroupsSchema structure (object with "groups" array)`;


