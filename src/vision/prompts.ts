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
- Screenshot 1: Initial game load (taken immediately after navigation)
- Screenshot 2: After user interaction (taken after keyboard/mouse inputs were sent)
- Screenshot 3: Final game state (taken at the end of the test)

**Evaluation Criteria:**

1. **Game Load Success** (Critical):
   - Check if the game loaded without error screens
   - Verify there's no blank canvas or white screen
   - Confirm the game UI is visible and rendered
   - Examples of failures: "Error loading game", blank page, browser error messages

2. **Control Responsiveness** (Major):
   - Determine if the game responded to user interactions
   - Compare Screenshot 1 vs Screenshot 2: Did visual changes occur?
   - Check for game state changes (character movement, UI updates, animations)
   - Examples of failures: Frozen screen, no response to input, static image

3. **Crash Detection** (Critical):
   - Identify if the game crashed or froze during the test
   - Look for error messages, crash indicators, or frozen states
   - Compare Screenshot 3: Is the game still running or did it stop?
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

Example 1 - Working Game:
{
  "status": "pass",
  "playability_score": 85,
  "issues": [
    {
      "severity": "minor",
      "description": "Minor UI alignment issue in menu",
      "timestamp": "2025-11-04T12:00:00Z"
    }
  ],
  "screenshots": ["/path/to/screenshot1.png", "/path/to/screenshot2.png", "/path/to/screenshot3.png"],
  "timestamp": "2025-11-04T12:00:00Z"
}

Example 2 - Broken Game:
{
  "status": "error",
  "playability_score": 0,
  "issues": [
    {
      "severity": "critical",
      "description": "Game failed to load - blank canvas detected",
      "timestamp": "2025-11-04T12:00:00Z"
    },
    {
      "severity": "critical",
      "description": "No response to user interactions - game appears frozen",
      "timestamp": "2025-11-04T12:00:00Z"
    }
  ],
  "screenshots": ["/path/to/screenshot1.png", "/path/to/screenshot2.png", "/path/to/screenshot3.png"],
  "timestamp": "2025-11-04T12:00:00Z"
}

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
 * This prompt is used with the actionRecommendationSchema to analyze
 * current game state and recommend the next action to take.
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
 *   schema: actionRecommendationSchema,
 * });
 * ```
 */
export const STATE_ANALYSIS_PROMPT = `You are analyzing a game state to recommend the next action to achieve a specific goal.

**Your Task:**
Analyze the current game state (HTML structure and screenshot) and recommend the best action to take next. The goal is provided in the context below.

**Action Types:**
- **click**: Click at specific pixel coordinates { x: number, y: number }
- **keypress**: Press a keyboard key (e.g., "Space", "ArrowUp", "Enter")
- **wait**: Wait for a specified duration in milliseconds (number)
- **complete**: Indicate that the goal has been achieved (no further action needed)

**Coordinate Accuracy (CRITICAL for click actions):**
- **x**: X coordinate in pixels (0-based, left edge of image is 0)
- **y**: Y coordinate in pixels (0-based, top edge of image is 0)
- **IMPORTANT**: Provide coordinates for the CENTER of the clickable element
- **IMPORTANT**: Measure carefully from the top-left corner (0,0) of the screenshot
- **IMPORTANT**: Consider the actual pixel position, not relative positioning
- Example: For a button at 1/4 width and 1/4 height of a 640x480 image: x ≈ 160, y ≈ 120

**Key Names (for keypress actions):**
- Arrow keys: "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"
- Letter keys: "KeyW", "KeyA", "KeyS", "KeyD" (WASD) or "Space", "Enter", "Escape"
- Use standard key names that match browser/Stagehand key codes

**Confidence Scoring:**
- 0.9-1.0: Very confident, clear path to goal
- 0.7-0.89: Confident, likely correct action
- 0.5-0.69: Somewhat confident, reasonable action
- Below 0.5: Uncertain, consider alternatives

**Alternative Actions:**
Provide 1-3 alternative actions if your primary recommendation might fail. This helps recover from failures.

**Output Format (actionRecommendationSchema):**
- **action**: One of 'click', 'keypress', 'wait', or 'complete'
- **target**: 
  - For 'click': { x: number, y: number } coordinates
  - For 'keypress': string key name
  - For 'wait': number duration in milliseconds
  - For 'complete': not used (can be empty string)
- **reasoning**: Clear explanation of why this action helps achieve the goal
- **confidence**: Number between 0 and 1 (certainty of recommendation)
- **alternatives**: Array of 1-3 alternative actions (same structure)

**Examples:**

Example 1 - Finding Start Button:
Goal: "Find and click the start/play button to begin the game"
{
  "action": "click",
  "target": { "x": 320, "y": 240 },
  "reasoning": "There is a clearly visible 'Start Game' button in the center of the screen. Clicking it will begin the game.",
  "confidence": 0.95,
  "alternatives": [
    {
      "action": "click",
      "target": { "x": 300, "y": 250 },
      "reasoning": "Alternative: Click slightly below the main button if there's a secondary start option"
    }
  ]
}

Example 2 - Waiting for Load:
Goal: "Wait for game to finish loading"
{
  "action": "wait",
  "target": 2000,
  "reasoning": "The game is still showing a loading indicator. Wait 2 seconds for it to complete loading.",
  "confidence": 0.90,
  "alternatives": [
    {
      "action": "wait",
      "target": 3000,
      "reasoning": "Alternative: Wait longer if loading is slow"
    }
  ]
}

Example 3 - Keypress Action:
Goal: "Start the game by pressing a key"
{
  "action": "keypress",
  "target": "Space",
  "reasoning": "The game shows 'Press Space to Start' text. Pressing Space will begin the game.",
  "confidence": 0.92,
  "alternatives": [
    {
      "action": "keypress",
      "target": "Enter",
      "reasoning": "Alternative: Try Enter key if Space doesn't work"
    }
  ]
}

Example 4 - Goal Complete:
Goal: "Find and click the start button"
{
  "action": "complete",
  "target": "",
  "reasoning": "The game has already started. The main menu is gone and gameplay has begun. Goal achieved.",
  "confidence": 0.98,
  "alternatives": []
}

**Important:**
- Analyze both the HTML structure (if provided) and the screenshot
- Consider previous actions (if provided) to avoid repeating failed attempts
- Provide clear reasoning for your recommendation
- Include alternatives for robustness
- Ensure coordinates are accurate (center of clickable element)
- Use correct key names for keypress actions
- Return data that strictly matches the actionRecommendationSchema structure`;


