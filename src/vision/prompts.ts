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

