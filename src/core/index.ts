/**
 * Core module exports.
 * 
 * This module exports all core browser automation components.
 */

export { BrowserManager } from './browser-manager';
export type { BrowserManagerConfig } from './browser-manager';

export { GameInteractor } from './game-interactor';
export type { GameInteractorConfig } from './game-interactor';

export { ScreenshotCapturer } from './screenshot-capturer';
export type { ScreenshotCapturerConfig } from './screenshot-capturer';

export { GameDetector, GameType } from './game-detector';
export type { GameDetectorConfig } from './game-detector';

export { ErrorMonitor } from './error-monitor';
export type { ErrorMonitorConfig } from './error-monitor';

export { InputSchemaParser } from './input-schema-parser';
export type { InputSchemaParserConfig, ParsedInputSchema } from './input-schema-parser';

export { StateAnalyzer } from './state-analyzer';
export type { StateAnalyzerConfig } from './state-analyzer';

export * from './start-detection';

