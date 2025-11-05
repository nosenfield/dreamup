/**
 * Zod schemas for runtime validation of game metadata.
 * 
 * These schemas provide runtime type safety for metadata coming from external
 * sources (like JSON files) and ensure data integrity before it's used in
 * the application.
 * 
 * @module metadata.schema
 */

import { z } from 'zod';

/**
 * Schema for validating InputAction objects.
 * 
 * Represents a discrete button event with key bindings.
 */
export const inputActionSchema = z.object({
  /** Name of the action (e.g., "Pause", "Jump", "Shoot") */
  name: z.string(),
  
  /** Array of key names that trigger this action */
  keys: z.array(z.string()),
  
  /** Optional human-readable description */
  description: z.string().optional(),
});

/**
 * Schema for validating InputAxis objects.
 * 
 * Represents a continuous input axis with key bindings.
 */
export const inputAxisSchema = z.object({
  /** Name of the axis (e.g., "MoveHorizontal", "MoveVertical") */
  name: z.string(),
  
  /** Array of key names that control this axis */
  keys: z.array(z.string()),
  
  /** Optional human-readable description */
  description: z.string().optional(),
  
  /** Optional flag indicating this is a 2D axis */
  is2D: z.boolean().optional(),
});

/**
 * Schema for validating InputSchema objects.
 * 
 * Supports both old format (string arrays) and new format (structured arrays)
 * for backwards compatibility.
 */
export const inputSchemaSchema = z.object({
  /** Type of input schema */
  type: z.enum(['javascript', 'semantic']),
  
  /** Content of the input schema */
  content: z.string(),
  
  /** 
   * Optional actions. Can be string[] (old format) or InputAction[] (new format).
   * We validate as either format for backwards compatibility.
   */
  actions: z.union([
    z.array(z.string()), // Old format
    z.array(inputActionSchema), // New format
  ]).optional(),
  
  /** 
   * Optional axes. Can be string[] (old format) or InputAxis[] (new format).
   * We validate as either format for backwards compatibility.
   */
  axes: z.union([
    z.array(z.string()), // Old format
    z.array(inputAxisSchema), // New format
  ]).optional(),
});

/**
 * Schema for validating LoadingIndicator objects.
 * 
 * Provides hints for game ready detection.
 */
export const loadingIndicatorSchema = z.object({
  /** Type of indicator */
  type: z.enum(['element', 'text', 'network']),
  
  /** Pattern to match */
  pattern: z.string(),
  
  /** Human-readable description */
  description: z.string(),
  
  /** Optional CSS selector */
  selector: z.string().optional(),
});

/**
 * Schema for validating SuccessIndicator objects.
 * 
 * Provides hints for game validation.
 */
export const successIndicatorSchema = z.object({
  /** Type of indicator */
  type: z.enum(['score_change', 'animation', 'element_visible', 'interaction_response']),
  
  /** Human-readable description */
  description: z.string(),
  
  /** Optional CSS selector */
  selector: z.string().optional(),
});

/**
 * Schema for validating TestingStrategy objects.
 * 
 * Provides timing and priority hints for testing.
 */
export const testingStrategySchema = z.object({
  /** Milliseconds to wait before interaction */
  waitBeforeInteraction: z.number().int().min(0),
  
  /** Total duration of interaction in milliseconds */
  interactionDuration: z.number().int().min(0),
  
  /** Optional array of critical action names */
  criticalActions: z.array(z.string()).optional(),
  
  /** Optional array of critical axis names */
  criticalAxes: z.array(z.string()).optional(),
  
  /** Optional testing instructions */
  instructions: z.string().optional(),
});

/**
 * Schema for validating GameMetadata objects.
 * 
 * Comprehensive game metadata for enhanced testing.
 */
export const gameMetadataSchema = z.object({
  /** Required input schema */
  inputSchema: inputSchemaSchema,
  
  /** Optional schema version */
  metadataVersion: z.string().optional(),
  
  /** Optional game genre */
  genre: z.string().optional(),
  
  /** Optional game description */
  description: z.string().optional(),
  
  /** Optional expected controls description */
  expectedControls: z.string().optional(),
  
  /** Optional array of loading indicators */
  loadingIndicators: z.array(loadingIndicatorSchema).optional(),
  
  /** Optional array of success indicators */
  successIndicators: z.array(successIndicatorSchema).optional(),
  
  /** Optional testing strategy */
  testingStrategy: testingStrategySchema.optional(),
});

/**
 * TypeScript type inferred from inputActionSchema.
 */
export type InputActionFromSchema = z.infer<typeof inputActionSchema>;

/**
 * TypeScript type inferred from inputAxisSchema.
 */
export type InputAxisFromSchema = z.infer<typeof inputAxisSchema>;

/**
 * TypeScript type inferred from inputSchemaSchema.
 */
export type InputSchemaFromSchema = z.infer<typeof inputSchemaSchema>;

/**
 * TypeScript type inferred from loadingIndicatorSchema.
 */
export type LoadingIndicatorFromSchema = z.infer<typeof loadingIndicatorSchema>;

/**
 * TypeScript type inferred from successIndicatorSchema.
 */
export type SuccessIndicatorFromSchema = z.infer<typeof successIndicatorSchema>;

/**
 * TypeScript type inferred from testingStrategySchema.
 */
export type TestingStrategyFromSchema = z.infer<typeof testingStrategySchema>;

/**
 * TypeScript type inferred from gameMetadataSchema.
 */
export type GameMetadataFromSchema = z.infer<typeof gameMetadataSchema>;

/**
 * Validation result type for helper functions.
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.ZodError };

/**
 * Validate an InputAction object using the inputActionSchema.
 * 
 * @param data - The data to validate (unknown type for safety)
 * @returns Validation result with success flag and data or error
 */
export function validateInputAction(data: unknown): ValidationResult<InputActionFromSchema> {
  const result = inputActionSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, error: result.error };
}

/**
 * Validate an InputAxis object using the inputAxisSchema.
 * 
 * @param data - The data to validate (unknown type for safety)
 * @returns Validation result with success flag and data or error
 */
export function validateInputAxis(data: unknown): ValidationResult<InputAxisFromSchema> {
  const result = inputAxisSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, error: result.error };
}

/**
 * Validate an InputSchema object using the inputSchemaSchema.
 * 
 * @param data - The data to validate (unknown type for safety)
 * @returns Validation result with success flag and data or error
 */
export function validateInputSchema(data: unknown): ValidationResult<InputSchemaFromSchema> {
  const result = inputSchemaSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, error: result.error };
}

/**
 * Validate a LoadingIndicator object using the loadingIndicatorSchema.
 * 
 * @param data - The data to validate (unknown type for safety)
 * @returns Validation result with success flag and data or error
 */
export function validateLoadingIndicator(
  data: unknown
): ValidationResult<LoadingIndicatorFromSchema> {
  const result = loadingIndicatorSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, error: result.error };
}

/**
 * Validate a SuccessIndicator object using the successIndicatorSchema.
 * 
 * @param data - The data to validate (unknown type for safety)
 * @returns Validation result with success flag and data or error
 */
export function validateSuccessIndicator(
  data: unknown
): ValidationResult<SuccessIndicatorFromSchema> {
  const result = successIndicatorSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, error: result.error };
}

/**
 * Validate a TestingStrategy object using the testingStrategySchema.
 * 
 * @param data - The data to validate (unknown type for safety)
 * @returns Validation result with success flag and data or error
 */
export function validateTestingStrategy(
  data: unknown
): ValidationResult<TestingStrategyFromSchema> {
  const result = testingStrategySchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, error: result.error };
}

/**
 * Validate a GameMetadata object using the gameMetadataSchema.
 * 
 * @param data - The data to validate (unknown type for safety)
 * @returns Validation result with success flag and data or error
 */
export function validateGameMetadata(
  data: unknown
): ValidationResult<GameMetadataFromSchema> {
  const result = gameMetadataSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, error: result.error };
}

