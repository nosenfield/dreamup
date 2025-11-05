/**
 * Vision module exports.
 * 
 * This module exports all vision analysis components.
 */

export { VisionAnalyzer } from './analyzer';
export type { VisionAnalyzerConfig } from './analyzer';

export {
  GAME_ANALYSIS_PROMPT,
  FIND_CLICKABLE_ELEMENTS_PROMPT,
  DETECT_CRASH_PROMPT,
  STATE_ANALYSIS_PROMPT,
  PROMPT_VERSION,
} from './prompts';

export {
  gameTestResultSchema,
  clickableElementSchema,
  issueSchema,
  actionRecommendationSchema,
  alternativeActionSchema,
  validateGameTestResult,
  validateClickableElement,
  validateIssue,
  validateActionRecommendation,
} from './schema';
export type {
  GameTestResultFromSchema,
  ClickableElementFromSchema,
  IssueFromSchema,
  ActionRecommendationFromSchema,
  AlternativeActionFromSchema,
} from './schema';

