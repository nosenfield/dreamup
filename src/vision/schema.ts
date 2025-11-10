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
 * Schema for validating an array of ActionRecommendation objects.
 * 
 * Represents multiple action recommendations from LLM state analysis.
 * Used when the LLM should return 1-20 actions to try in sequence.
 * 
 * Note: This is wrapped in an object schema for generateObject compatibility.
 */
const actionRecommendationsArraySchema = z.array(actionRecommendationSchema).min(1).max(20);

/**
 * Wrapper schema for generateObject (requires object root, not array).
 * 
 * The AI SDK's generateObject requires the root schema to be an object,
 * so we wrap the array in an object with a 'recommendations' property.
 */
export const actionRecommendationsSchema = z.object({
  recommendations: actionRecommendationsArraySchema,
});

/**
 * TypeScript type inferred from actionRecommendationsSchema.
 * 
 * This type represents the object wrapper with a 'recommendations' property.
 */
type ActionRecommendationsObjectFromSchema = z.infer<typeof actionRecommendationsSchema>;

/**
 * TypeScript type for the array of action recommendations.
 * 
 * This is the actual array type that is extracted from the object wrapper.
 */
export type ActionRecommendationsFromSchema = ActionRecommendationsObjectFromSchema['recommendations'];

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

/**
 * Validate an array of ActionRecommendation objects using the actionRecommendationsSchema.
 * 
 * @param data - The data to validate (unknown type for safety)
 * @returns Validation result with success flag and data or error
 * 
 * Note: The schema wraps the array in an object with a 'recommendations' property
 * for generateObject compatibility, but this function returns just the array.
 */
export function validateActionRecommendations(
  data: unknown
): ValidationResult<ActionRecommendationsFromSchema> {
  const result = actionRecommendationsSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data.recommendations };
  }
  
  return { success: false, error: result.error };
}

/**
 * Schema for validating ActionGroup objects.
 * 
 * Represents a strategy with multiple related actions that share reasoning.
 * Actions in a group share the same logical reasoning/strategy.
 * Success is measured at the group level, not individual action level.
 */
export const actionGroupSchema = z.object({
  /** Shared reasoning/strategy description for all actions in this group */
  reasoning: z.string().min(10).max(500),
  
  /** LLM confidence score (0-1) for this strategy */
  confidence: z.number().min(0).max(1),
  
  /** Array of actions in this group (1-10 depending on iteration) */
  actions: z.array(actionRecommendationSchema),
});

/**
 * TypeScript type inferred from actionGroupSchema.
 * 
 * This type matches the runtime schema validation and can be used
 * interchangeably with the ActionGroup interface from types.
 */
export type ActionGroupFromSchema = z.infer<typeof actionGroupSchema>;

/**
 * Schema for validating ActionGroups array.
 * 
 * Represents multiple strategies to try in an iteration.
 * Groups are ordered by confidence and executed sequentially.
 * 
 * Note: This is wrapped in an object schema for generateObject compatibility.
 */
const actionGroupsArraySchema = z.array(actionGroupSchema);

/**
 * Wrapper schema for generateObject (requires object root, not array).
 * 
 * The AI SDK's generateObject requires the root schema to be an object,
 * so we wrap the array in an object with a 'groups' property.
 */
export const actionGroupsSchema = z.object({
  groups: actionGroupsArraySchema,
});

/**
 * TypeScript type inferred from actionGroupsSchema.
 * 
 * This type represents the object wrapper with a 'groups' property.
 */
type ActionGroupsObjectFromSchema = z.infer<typeof actionGroupsSchema>;

/**
 * TypeScript type for the array of action groups.
 * 
 * This is the actual array type that is extracted from the object wrapper.
 */
export type ActionGroupsFromSchema = ActionGroupsObjectFromSchema['groups'];

/**
 * Validate an ActionGroup object using the actionGroupSchema.
 * 
 * @param data - The data to validate (unknown type for safety)
 * @returns Validation result with success flag and data or error
 */
export function validateActionGroup(
  data: unknown
): ValidationResult<ActionGroupFromSchema> {
  const result = actionGroupSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, error: result.error };
}

/**
 * Validate an array of ActionGroup objects using the actionGroupsSchema.
 * 
 * Validates group count and action count based on iteration number:
 * - Iteration 1: 1-3 groups, 1-2 actions per group
 * - Iteration 2: Variable groups (1 per successful group), 3-5 actions per group
 * - Iteration 3+: Variable groups (1 per successful group), 6-10 actions per group
 * 
 * @param data - The data to validate (unknown type for safety)
 * @param iterationNumber - The iteration number (1, 2, 3+, etc.)
 * @returns Validation result with success flag and data or error
 * 
 * Note: The schema wraps the array in an object with a 'groups' property
 * for generateObject compatibility, but this function returns just the array.
 */
export function validateActionGroups(
  data: unknown,
  iterationNumber: number
): ValidationResult<ActionGroupsFromSchema> {
  const result = actionGroupsSchema.safeParse(data);
  
  if (!result.success) {
    return { success: false, error: result.error };
  }
  
  const groups = result.data.groups;
  
  // Validate group count based on iteration
  if (iterationNumber === 1 && (groups.length < 1 || groups.length > 3)) {
    return {
      success: false,
      error: new z.ZodError([{
        code: 'custom',
        path: ['groups'],
        message: `Iteration 1 must have 1-3 groups, got ${groups.length}`,
      }]),
    };
  }
  
  // Validate action count per group based on iteration
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const actionCount = group.actions.length;
    
    if (iterationNumber === 1 && (actionCount < 1 || actionCount > 2)) {
      return {
        success: false,
        error: new z.ZodError([{
          code: 'custom',
          path: ['groups', i, 'actions'],
          message: `Iteration 1 groups must have 1-2 actions, got ${actionCount}`,
        }]),
      };
    }
    
    if (iterationNumber === 2 && (actionCount < 3 || actionCount > 5)) {
      return {
        success: false,
        error: new z.ZodError([{
          code: 'custom',
          path: ['groups', i, 'actions'],
          message: `Iteration 2 groups must have 3-5 actions, got ${actionCount}`,
        }]),
      };
    }
    
    if (iterationNumber >= 3 && (actionCount < 6 || actionCount > 10)) {
      return {
        success: false,
        error: new z.ZodError([{
          code: 'custom',
          path: ['groups', i, 'actions'],
          message: `Iteration 3+ groups must have 6-10 actions, got ${actionCount}`,
        }]),
      };
    }
  }
  
  return { success: true, data: groups };
}

