/**
 * Configuration module for DreamUp game testing agent.
 * 
 * This module exports all configuration constants, feature flags,
 * and utility functions used throughout the application.
 * 
 * @module config
 */

// Export all constants
export { TIMEOUTS, THRESHOLDS, PATHS, ADAPTIVE_DEFAULTS, ADAPTIVE_COSTS } from './constants';

// Export all feature flag functions and constants
export { DEFAULT_FLAGS, getFeatureFlags } from './feature-flags';

