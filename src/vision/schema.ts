/**
 * Zod schemas for runtime validation of game test data.
 * 
 * These schemas provide runtime type safety for data coming from external
 * sources (like GPT-4 Vision API responses) and ensure data integrity
 * before it's used in the application.
 * 
 * @module vision.schema
 */

import { z } from 'zod';

/**
 * Schema for validating Issue objects.
 * 
 * Represents an issue identified during game testing with severity,
 * description, and timestamp.
 */
export const issueSchema = z.object({
  /** Severity level of the issue */
  severity: z.enum(['critical', 'major', 'minor']),
  
  /** Human-readable description of the issue */
  description: z.string(),
  
  /** ISO 8601 timestamp of when the issue was detected */
  timestamp: z.string(),
});

/**
 * Schema for validating ClickableElement objects.
 * 
 * Represents a clickable element detected in a game screenshot
 * (e.g., a start button, play button, etc.).
 */
export const clickableElementSchema = z.object({
  /** Label or description of the element (e.g., "Start Game", "Play Button") */
  label: z.string(),
  
  /** X coordinate in pixels (0-based, top-left origin) */
  x: z.number().min(0),
  
  /** Y coordinate in pixels (0-based, top-left origin) */
  y: z.number().min(0),
  
  /** Confidence score from 0-1 indicating detection certainty */
  confidence: z.number().min(0).max(1),
});

/**
 * Schema for validating GameTestResult objects.
 * 
 * Represents the complete result of a game test execution, including
 * status, playability score, issues, and screenshots.
 * 
 * Note: metadata is optional and added programmatically after vision
 * analysis, so it's not included in this schema.
 */
export const gameTestResultSchema = z.object({
  /** Test status: 'pass' (playability_score >= 50), 'fail' (< 50), or 'error' (execution failed) */
  status: z.enum(['pass', 'fail', 'error']),
  
  /** Playability score from 0-100. Higher scores indicate better playability */
  playability_score: z.number().min(0).max(100),
  
  /** Array of issues identified during the test */
  issues: z.array(issueSchema),
  
  /** Array of screenshot file paths captured during the test */
  screenshots: z.array(z.string()),
  
  /** ISO 8601 timestamp of when the test completed */
  timestamp: z.string(),
});

/**
 * TypeScript type inferred from issueSchema.
 * 
 * This type matches the runtime schema validation and can be used
 * interchangeably with the Issue interface from types.
 */
export type IssueFromSchema = z.infer<typeof issueSchema>;

/**
 * TypeScript type inferred from clickableElementSchema.
 * 
 * This type matches the runtime schema validation and can be used
 * interchangeably with the ClickableElement interface from types.
 */
export type ClickableElementFromSchema = z.infer<typeof clickableElementSchema>;

/**
 * TypeScript type inferred from gameTestResultSchema.
 * 
 * This type matches the runtime schema validation and can be used
 * interchangeably with the GameTestResult interface from types.
 */
export type GameTestResultFromSchema = z.infer<typeof gameTestResultSchema>;

/**
 * Validation result type for helper functions.
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.ZodError };

/**
 * Validate an Issue object using the issueSchema.
 * 
 * @param data - The data to validate (unknown type for safety)
 * @returns Validation result with success flag and data or error
 */
export function validateIssue(data: unknown): ValidationResult<IssueFromSchema> {
  const result = issueSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, error: result.error };
}

/**
 * Validate a ClickableElement object using the clickableElementSchema.
 * 
 * @param data - The data to validate (unknown type for safety)
 * @returns Validation result with success flag and data or error
 */
export function validateClickableElement(
  data: unknown
): ValidationResult<ClickableElementFromSchema> {
  const result = clickableElementSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, error: result.error };
}

/**
 * Validate a GameTestResult object using the gameTestResultSchema.
 * 
 * @param data - The data to validate (unknown type for safety)
 * @returns Validation result with success flag and data or error
 */
export function validateGameTestResult(
  data: unknown
): ValidationResult<GameTestResultFromSchema> {
  const result = gameTestResultSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, error: result.error };
}

/**
 * Schema for validating ActionRecommendation objects.
 * 
 * Represents an action recommendation from LLM state analysis
 * with reasoning, confidence, and alternative actions.
 */
export const alternativeActionSchema = z.object({
  /** Type of alternative action */
  action: z.enum(['click', 'keypress', 'wait']),
  
  /** Target of the alternative action (coordinates, key name, or duration) */
  target: z.union([
    z.string(),
    z.object({ x: z.number(), y: z.number() }),
    z.number(),
  ]),
  
  /** Reasoning for this alternative */
  reasoning: z.string(),
});

export const actionRecommendationSchema = z.object({
  /** Type of action to perform */
  action: z.enum(['click', 'keypress', 'wait', 'complete']),
  
  /** 
   * Target of the action:
   * - For 'click': { x: number, y: number } coordinates
   * - For 'keypress': string key name
   * - For 'wait': number duration in milliseconds
   * - For 'complete': not used
   */
  target: z.union([
    z.string(),
    z.object({ x: z.number(), y: z.number() }),
    z.number(),
  ]),
  
  /** Human-readable reasoning for this recommendation */
  reasoning: z.string(),
  
  /** Confidence score from 0-1 indicating recommendation certainty */
  confidence: z.number().min(0).max(1),
  
  /** Array of alternative actions if primary recommendation fails */
  alternatives: z.array(alternativeActionSchema),
});

/**
 * TypeScript type inferred from alternativeActionSchema.
 */
export type AlternativeActionFromSchema = z.infer<typeof alternativeActionSchema>;

/**
 * TypeScript type inferred from actionRecommendationSchema.
 * 
 * This type matches the runtime schema validation and can be used
 * interchangeably with the ActionRecommendation interface from types.
 */
export type ActionRecommendationFromSchema = z.infer<typeof actionRecommendationSchema>;

/**
 * Validate an ActionRecommendation object using the actionRecommendationSchema.
 * 
 * @param data - The data to validate (unknown type for safety)
 * @returns Validation result with success flag and data or error
 */
export function validateActionRecommendation(
  data: unknown
): ValidationResult<ActionRecommendationFromSchema> {
  const result = actionRecommendationSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, error: result.error };
}

