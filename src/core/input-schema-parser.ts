/**
 * Input Schema Parser for extracting structured actions and axes from GameMetadata.
 * 
 * This module provides parsing functionality for both JavaScript GameBuilder API
 * calls and semantic natural language descriptions of game controls.
 * 
 * @module core.input-schema-parser
 */

import { Logger } from '../utils/logger';
import type { GameMetadata, InputAction, InputAxis, InputSchema } from '../types';

/**
 * Configuration for InputSchemaParser.
 */
export interface InputSchemaParserConfig {
  /** Logger instance for structured logging */
  logger: Logger;
}

/**
 * Parsed result containing actions and axes extracted from metadata.
 */
export interface ParsedInputSchema {
  /** Array of parsed actions */
  actions: InputAction[];
  
  /** Array of parsed axes */
  axes: InputAxis[];
}

/**
 * Input Schema Parser class.
 * 
 * Extracts structured actions and axes from GameMetadata, handling both
 * JavaScript GameBuilder API calls and semantic natural language descriptions.
 */
export class InputSchemaParser {
  private readonly logger: Logger;

  constructor(config: InputSchemaParserConfig) {
    this.logger = config.logger;
  }

  /**
   * Parse GameMetadata and extract actions and axes.
   * 
   * This is the main entry point for parsing metadata. It handles:
   * - Structured arrays (returns as-is)
   * - String arrays (converts to structured format)
   * - Content-only schemas (parses from JavaScript/semantic content)
   * 
   * @param metadata - GameMetadata to parse
   * @returns Parsed actions and axes
   */
  parse(metadata: GameMetadata): ParsedInputSchema {
    if (!metadata.inputSchema) {
      this.logger.warn('No inputSchema found in metadata', {
        op: 'parse',
      });
      return { actions: [], axes: [] };
    }

    const schema = metadata.inputSchema;
    let actions: InputAction[] = [];
    let axes: InputAxis[] = [];

    // Check if structured arrays already exist
    if (schema.actions && Array.isArray(schema.actions) && schema.actions.length > 0) {
      if (typeof schema.actions[0] === 'string') {
        // Old format: string[]
        actions = (schema.actions as string[]).map(name => ({
          name,
          keys: [],
        }));
      } else {
        // New format: InputAction[]
        actions = schema.actions as InputAction[];
      }
    }

    if (schema.axes && Array.isArray(schema.axes) && schema.axes.length > 0) {
      if (typeof schema.axes[0] === 'string') {
        // Old format: string[]
        axes = (schema.axes as string[]).map(name => ({
          name,
          keys: [],
        }));
      } else {
        // New format: InputAxis[]
        axes = schema.axes as InputAxis[];
      }
    }

    // If no structured arrays exist, try parsing from content
    if (actions.length === 0 && axes.length === 0 && schema.content) {
      if (schema.type === 'javascript') {
        const parsed = this.parseJavaScript(schema.content);
        actions = parsed.actions;
        axes = parsed.axes;
      } else if (schema.type === 'semantic') {
        const parsed = this.parseSemantic(schema.content);
        actions = parsed.actions;
        axes = parsed.axes;
      }
    }

    return { actions, axes };
  }

  /**
   * Parse JavaScript GameBuilder API calls from content string.
   * 
   * Supports patterns:
   * - `gameBuilder.createAction(name).bindKey(key)`
   * - `gameBuilder.createAction(name).bindKeys(...keys)`
   * - `gameBuilder.createAxis(name).bindKeys(...keys)`
   * - `gameBuilder.createAxis2D(name).bindWASD().bindArrowKeys()`
   * 
   * @param content - JavaScript content string
   * @returns Parsed actions and axes
   */
  parseJavaScript(content: string): ParsedInputSchema {
    const actions: InputAction[] = [];
    const axes: InputAxis[] = [];

    if (!content || content.trim().length === 0) {
      return { actions, axes };
    }

    try {
      // Parse createAction patterns
      const actionPattern = /gameBuilder\.createAction\(['"]([^'"]+)['"]\)\.bindKey\(['"]([^'"]+)['"]\)/g;
      let match;
      while ((match = actionPattern.exec(content)) !== null) {
        const [, name, key] = match;
        actions.push({
          name,
          keys: [key],
        });
      }

      // Parse createAction with bindKeys (multiple keys)
      const actionKeysPattern = /gameBuilder\.createAction\(['"]([^'"]+)['"]\)\.bindKeys\(([^)]+)\)/g;
      while ((match = actionKeysPattern.exec(content)) !== null) {
        const [, name, keysStr] = match;
        const keys = this.extractKeysFromString(keysStr);
        actions.push({
          name,
          keys,
        });
      }

      // Parse createAxis patterns
      const axisPattern = /gameBuilder\.createAxis\(['"]([^'"]+)['"]\)\.bindKeys\(([^)]+)\)/g;
      while ((match = axisPattern.exec(content)) !== null) {
        const [, name, keysStr] = match;
        const keys = this.extractKeysFromString(keysStr);
        axes.push({
          name,
          keys,
        });
      }

      // Parse createAxis2D patterns with chained method calls
      const axis2DPattern = /gameBuilder\.createAxis2D\(['"]([^'"]+)['"]\)([^;]*)/g;
      while ((match = axis2DPattern.exec(content)) !== null) {
        const [, name, chainedCalls] = match;
        const keys: string[] = [];

        // Check for bindWASD() in the chained calls
        if (chainedCalls.includes('.bindWASD()')) {
          keys.push('w', 'a', 's', 'd');
        }

        // Check for bindArrowKeys() in the chained calls
        if (chainedCalls.includes('.bindArrowKeys()')) {
          keys.push('ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight');
        }

        axes.push({
          name,
          keys: keys.length > 0 ? keys : [],
          is2D: true,
        });
      }
    } catch (error) {
      this.logger.warn('Failed to parse JavaScript content', {
        op: 'parseJavaScript',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return { actions, axes };
  }

  /**
   * Extract key names from a string like "'ArrowDown', 'ArrowUp'" or '"Space", "Enter"'.
   * 
   * @param keysStr - String containing quoted key names
   * @returns Array of key names
   */
  private extractKeysFromString(keysStr: string): string[] {
    // Match quoted strings (single or double quotes)
    const keyPattern = /['"]([^'"]+)['"]/g;
    const keys: string[] = [];
    let match;
    
    while ((match = keyPattern.exec(keysStr)) !== null) {
      keys.push(match[1]);
    }
    
    return keys;
  }

  /**
   * Parse semantic natural language descriptions to extract controls.
   * 
   * Uses pattern matching to extract common control descriptions:
   * - "arrow keys" → ArrowUp, ArrowDown, ArrowLeft, ArrowRight
   * - "WASD" → w, a, s, d
   * - "spacebar" → Space
   * - "Escape" → Escape
   * 
   * @param content - Semantic content string
   * @returns Parsed actions and axes (best effort)
   */
  parseSemantic(content: string): ParsedInputSchema {
    const actions: InputAction[] = [];
    const axes: InputAxis[] = [];

    if (!content || content.trim().length === 0) {
      return { actions, axes };
    }

    const lowerContent = content.toLowerCase();

    // Extract arrow keys
    if (lowerContent.includes('arrow') || lowerContent.includes('arrow keys')) {
      axes.push({
        name: 'Move',
        keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
      });
    }

    // Extract WASD
    if (lowerContent.includes('wasd') || lowerContent.includes('w/a/s/d')) {
      const existingMoveAxis = axes.find(axis => axis.name === 'Move');
      if (existingMoveAxis) {
        existingMoveAxis.keys.push('w', 'a', 's', 'd');
        // Remove duplicates
        existingMoveAxis.keys = [...new Set(existingMoveAxis.keys)];
      } else {
        axes.push({
          name: 'Move',
          keys: ['w', 'a', 's', 'd'],
        });
      }
    }

    // Extract spacebar for jump
    if (lowerContent.includes('spacebar') || lowerContent.includes('space')) {
      if (lowerContent.includes('jump')) {
        actions.push({
          name: 'Jump',
          keys: ['Space'],
        });
      }
    }

    // Extract Escape for pause
    if (lowerContent.includes('escape')) {
      if (lowerContent.includes('pause')) {
        actions.push({
          name: 'Pause',
          keys: ['Escape'],
        });
      }
    }

    // Extract Enter for start/confirm
    if (lowerContent.includes('enter')) {
      if (lowerContent.includes('start') || lowerContent.includes('confirm')) {
        actions.push({
          name: 'Start',
          keys: ['Enter'],
        });
      }
    }

    return { actions, axes };
  }

  /**
   * Infer flattened list of all unique keys from actions and axes.
   * 
   * This is useful for generating a list of keys to test during gameplay.
   * 
   * @param actions - Array of actions
   * @param axes - Array of axes
   * @returns Array of unique key names
   */
  inferKeybindings(actions: InputAction[], axes: InputAxis[]): string[] {
    const keys = new Set<string>();

    for (const action of actions) {
      for (const key of action.keys) {
        keys.add(key);
      }
    }

    for (const axis of axes) {
      for (const key of axis.keys) {
        keys.add(key);
      }
    }

    return Array.from(keys);
  }
}

