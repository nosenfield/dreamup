# Vision Analysis Call Structure

This document explains the structure of objects sent to and received from vision analysis calls using the Vercel AI SDK and GPT-4 Vision.

## Overview

The vision analyzer uses three main methods:
1. `analyzeScreenshots()` - Analyzes multiple screenshots for playability
2. `findClickableElements()` - Detects clickable UI elements in a screenshot
3. `detectCrash()` - Identifies crash/error states

All methods use the Vercel AI SDK (`generateObject` or `generateText`) with GPT-4 Vision through the OpenAI provider.

---

## Method 1: `analyzeScreenshots()`

### Request Structure (Sent to AI SDK)

```typescript
const result = await generateObject({
  model: this.openai('gpt-4-turbo'),
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '<GAME_ANALYSIS_PROMPT>', // Full prompt string
        },
        {
          type: 'image',
          image: 'data:image/png;base64,<base64-encoded-image-1>',
        },
        {
          type: 'image',
          image: 'data:image/png;base64,<base64-encoded-image-2>',
        },
        {
          type: 'image',
          image: 'data:image/png;base64,<base64-encoded-image-3>',
        },
      ],
    },
  ],
  schema: gameTestResultSchema, // Zod schema
  temperature: 0.3,
});
```

**Key Details:**
- **Model**: `gpt-4-turbo` via OpenAI provider
- **Message Format**: Single user message with multimodal content array
- **Content Array**: 
  - First element: Text prompt (`type: 'text'`)
  - Remaining elements: Base64-encoded images (`type: 'image'`)
- **Image Format**: Data URI format (`data:image/png;base64,<base64-string>`)
- **Schema**: Zod schema for structured output validation
- **Temperature**: 0.3 (lower = more deterministic)

### Response Structure (Received from AI SDK)

```typescript
{
  object: {
    status: 'pass' | 'fail' | 'error',
    playability_score: number, // 0-100
    issues: [
      {
        severity: 'critical' | 'major' | 'minor',
        description: string,
        timestamp: string, // ISO 8601
      },
      // ... more issues
    ],
    screenshots: string[], // Array of file paths (added after API call)
    timestamp: string, // ISO 8601
  },
  usage: {
    promptTokens: number,
    completionTokens: number,
  },
  finishReason: 'stop' | 'length' | 'tool-calls' | 'content-filter' | 'error',
}
```

**What Happens After API Call:**
The code replaces `result.object.screenshots` with actual file paths:
```typescript
const gameTestResult: GameTestResult = {
  ...result.object,
  screenshots: screenshots.map((s) => s.path), // Override with file paths
};
```

---

## Method 2: `findClickableElements()`

### Request Structure

```typescript
const result = await generateObject({
  model: this.openai('gpt-4-turbo'),
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '<FIND_CLICKABLE_ELEMENTS_PROMPT>',
        },
        {
          type: 'image',
          image: 'data:image/png;base64,<base64-encoded-image>',
        },
      ],
    },
  ],
  schema: z.object({
    elements: z.array(clickableElementSchema),
  }),
  temperature: 0.3,
});
```

**Key Details:**
- **Schema Wrapper**: The schema wraps the array in an object because AI SDK requires root schema to be an object, not an array
- **Single Image**: Only one screenshot is analyzed
- **Schema Structure**: `{ elements: ClickableElement[] }`

### Response Structure

```typescript
{
  object: {
    elements: [
      {
        label: string, // e.g., "Start Game Button"
        x: number, // X coordinate (>= 0)
        y: number, // Y coordinate (>= 0)
        confidence: number, // 0-1
      },
      // ... more elements
    ],
  },
  usage: {
    promptTokens: number,
    completionTokens: number,
  },
}
```

**After API Call:**
The code returns `result.object.elements` directly:
```typescript
return result.object.elements; // Array of ClickableElement
```

---

## Method 3: `detectCrash()`

### Request Structure

```typescript
const result = await generateText({
  model: this.openai('gpt-4-turbo'),
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '<DETECT_CRASH_PROMPT>',
        },
        {
          type: 'image',
          image: 'data:image/png;base64,<base64-encoded-image>',
        },
      ],
    },
  ],
  temperature: 0.3,
});
```

**Key Details:**
- **Uses `generateText`**: Not structured output, just text response
- **No Schema**: Returns free-form text (not structured JSON)

### Response Structure

```typescript
{
  text: string, // Free-form text response
  usage: {
    promptTokens: number,
    completionTokens: number,
  },
  finishReason: 'stop' | 'length' | 'content-filter' | 'error',
}
```

**After API Call:**
The code parses the text response to detect crash keywords:
```typescript
const responseText = result.text.toLowerCase();
const crashKeywords = ['crash', 'error', 'failed', 'broken', 'frozen', 'blank'];
const isCrash = crashKeywords.some((keyword) => responseText.includes(keyword));
return isCrash; // boolean
```

---

## Image Encoding Process

Images are converted to base64 data URIs:

```typescript
// 1. Load file from disk
const file = Bun.file(screenshot.path);
const buffer = await file.arrayBuffer();

// 2. Convert to base64
const base64 = Buffer.from(buffer).toString('base64');

// 3. Create data URI
const imageDataUri = `data:image/png;base64,${base64}`;
```

**Format**: `data:image/png;base64,<base64-string>`

---

## Zod Schemas Used

### `gameTestResultSchema`
```typescript
z.object({
  status: z.enum(['pass', 'fail', 'error']),
  playability_score: z.number().min(0).max(100),
  issues: z.array(issueSchema),
  screenshots: z.array(z.string()), // Note: Overridden after API call
  timestamp: z.string(), // ISO 8601
})
```

### `clickableElementSchema`
```typescript
z.object({
  label: z.string(),
  x: z.number().min(0),
  y: z.number().min(0),
  confidence: z.number().min(0).max(1),
})
```

### `issueSchema`
```typescript
z.object({
  severity: z.enum(['critical', 'major', 'minor']),
  description: z.string(),
  timestamp: z.string(), // ISO 8601
})
```

---

## Error Handling

### `analyzeScreenshots()` and `findClickableElements()`
- **Throws Errors**: Will throw if API call fails
- **Validation**: Zod schema validates response structure
- **Type Safety**: Response is type-checked against schema

### `detectCrash()`
- **Returns `false` on Error**: Graceful fallback (assumes no crash)
- **Non-Critical**: Errors are logged but don't stop execution

---

## Common Issues and Debugging

### 1. Schema Validation Errors
If the API returns invalid structure, Zod will throw. Check:
- Are all required fields present?
- Are types correct (numbers vs strings)?
- Are enums valid values?

### 2. Image Encoding Issues
If images fail to encode:
- Check file exists: `await Bun.file(path).exists()`
- Verify file is PNG format
- Check base64 encoding is valid

### 3. Coordinate Accuracy Issues
If coordinates are wrong:
- Check prompt guidance (FIND_CLICKABLE_ELEMENTS_PROMPT)
- Verify image dimensions match coordinate system
- Ensure model understands 0,0 is top-left corner

### 4. Token Usage Tracking
Usage is available in `result.usage`:
```typescript
{
  promptTokens: number,
  completionTokens: number,
}
```

---

## Complete Example Flow

```typescript
// 1. Prepare screenshots
const screenshots = [
  { id: '1', path: '/tmp/screenshot1.png', timestamp: Date.now(), stage: 'initial_load' },
  { id: '2', path: '/tmp/screenshot2.png', timestamp: Date.now(), stage: 'after_interaction' },
  { id: '3', path: '/tmp/screenshot3.png', timestamp: Date.now(), stage: 'final_state' },
];

// 2. Convert to base64
const images = await Promise.all(
  screenshots.map(async (screenshot) => {
    const file = Bun.file(screenshot.path);
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:image/png;base64,${base64}`;
  })
);

// 3. Build content array
const content = [
  { type: 'text', text: GAME_ANALYSIS_PROMPT },
  ...images.map((image) => ({ type: 'image', image })),
];

// 4. Call API
const result = await generateObject({
  model: this.openai('gpt-4-turbo'),
  messages: [{ role: 'user', content }],
  schema: gameTestResultSchema,
  temperature: 0.3,
});

// 5. Process result
const gameTestResult = {
  ...result.object,
  screenshots: screenshots.map((s) => s.path), // Override screenshots
};

// 6. Return
return gameTestResult;
```

---

## References

- **Vercel AI SDK Docs**: https://sdk.vercel.ai/docs
- **generateObject API**: Requires root schema to be an object (not array)
- **Multimodal Messages**: Content array supports `type: 'text'` and `type: 'image'`
- **Image Format**: Data URI (`data:image/png;base64,<base64>`) or URL supported
- **Structured Output**: Zod schemas provide runtime validation

---

## Summary

1. **Request**: Multimodal message array with text prompt + base64 images
2. **API Call**: `generateObject()` with Zod schema for structured output
3. **Response**: Validated object matching schema + usage metadata
4. **Post-Processing**: Override screenshots array with file paths (for `analyzeScreenshots`)


