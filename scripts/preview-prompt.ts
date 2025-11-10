#!/usr/bin/env bun

/**
 * Prompt Preview Script for Adaptive Agent
 *
 * This script previews the exact prompt that will be sent to StateAnalyzer,
 * showing what context is included, how the prompt is structured, and
 * what metadata fields are being used.
 *
 * Usage:
 *   bun scripts/preview-prompt.ts [path-to-metadata.json] [iteration-number]
 *
 * Examples:
 *   bun scripts/preview-prompt.ts _game-examples/brick-breaker-idle/metadata-cursor.json 1
 *   bun scripts/preview-prompt.ts _game-examples/pong/metadata.json 2
 */

import { STATE_ANALYSIS_PROMPT } from '../src/vision/prompts';
import type { GameMetadata, GameState, SuccessfulActionGroup } from '../src/types';

// Simple token estimation (rough approximation: 1 token ≈ 4 characters)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Format prompt sections for display
function formatSection(title: string, content: string, indent: number = 0): string {
  const indentStr = ' '.repeat(indent);
  return `${indentStr}${'='.repeat(60)}\n${indentStr}${title}\n${indentStr}${'='.repeat(60)}\n${content}\n`;
}

// Build a sample prompt similar to StateAnalyzer.buildStateAnalysisPrompt()
function buildSamplePrompt(
  metadata: GameMetadata | undefined,
  iterationNumber: number,
  goal: string = 'Play the game',
  successfulGroups?: SuccessfulActionGroup[]
): string {
  let prompt = STATE_ANALYSIS_PROMPT;

  // Add iteration-specific instructions
  if (iterationNumber === 1) {
    prompt += `\n\n**ITERATION 1 INSTRUCTIONS (CRITICAL - MUST FOLLOW):**`;
    prompt += `\n- **MUST return EXACTLY 1-3 Action Groups (no more, no less)**`;
    prompt += `\n- Each group should have exactly 1 action`;
    prompt += `\n- Each group represents a different strategy to try`;
    prompt += `\n- Order groups by your confidence in the strategy (highest confidence first)`;
    prompt += `\n- **IMPORTANT**: If you have more than 3 strategies, choose only the top 3 most confident ones`;
  } else if (iterationNumber === 2) {
    prompt += `\n\n**ITERATION 2 INSTRUCTIONS:**`;
    prompt += `\n- For each successful Action Group provided, return 1 Action Group`;
    prompt += `\n- Each group should have 1-5 actions that build on the successful strategy`;
    prompt += `\n- Actions should be related and follow the same reasoning as the successful group`;
    prompt += `\n- Order groups by your confidence in the strategy (highest confidence first)`;
  } else {
    prompt += `\n\n**ITERATION ${iterationNumber} INSTRUCTIONS:**`;
    prompt += `\n- For each successful Action Group provided, return 1 Action Group`;
    prompt += `\n- Each group should have 1-10 actions that expand the successful strategy`;
    prompt += `\n- Actions should be related and follow the same reasoning as the successful group`;
    prompt += `\n- Order groups by your confidence in the strategy (highest confidence first)`;
  }

  // Add successful Action Groups context for iterations 2+
  if (successfulGroups && successfulGroups.length > 0) {
    prompt += `\n\n**✅ Successful Action Groups from Previous Iteration (Build on these strategies):**`;

    successfulGroups.forEach((group, index) => {
      prompt += `\n\n**Successful Group ${index + 1}:**`;
      prompt += `\n- Strategy/Reasoning: ${group.reasoning}`;
      prompt += `\n- Confidence: ${group.confidence}`;
      prompt += `\n- Actions executed: ${group.actions.length}`;
      prompt += `\n- Actions:`;
      group.actions.forEach((action, actionIndex) => {
        const targetStr = typeof action.target === 'object'
          ? `(${action.target.x}, ${action.target.y})`
          : JSON.stringify(action.target);
        prompt += `\n  ${actionIndex + 1}. ${action.action} on ${targetStr} - ${action.reasoning}`;
        prompt += `\n     ✅ Executed: ${action.success}, State Progressed: ${action.stateProgressed}`;
      });
      prompt += `\n- Before Screenshot: ${group.beforeScreenshot}`;
      prompt += `\n- After Screenshot: ${group.afterScreenshot}`;
      prompt += `\n\n**Your Task:** Generate 1 Action Group with 1-${iterationNumber === 2 ? '5' : '10'} related actions that build on this successful strategy.`;
    });
  }

  // Add goal context
  prompt += `\n\n**Current Goal:** ${goal}`;

  // PRIORITY 1: Add game-specific context from testingStrategy.instructions (MOST IMPORTANT)
  if (metadata?.testingStrategy?.instructions) {
    prompt += `\n\n**🎮 Game Context (IMPORTANT - Follow these instructions carefully):**\n${metadata.testingStrategy.instructions}`;
  }

  // Add previous actions context (sample for preview)
  const samplePreviousActions = [
    {
      action: 'click' as const,
      target: { x: 0.5, y: 0.5 },
      reasoning: 'Click center of canvas',
      success: true,
      stateProgressed: true,
    },
  ];

  if (samplePreviousActions.length > 0) {
    prompt += `\n\n**✅ Successful Actions (Build on these patterns):**`;
    prompt += `\n\n**Successful Click Patterns:**`;
    samplePreviousActions.forEach((action, index) => {
      const target = action.target as { x: number; y: number };
      prompt += `\n${index + 1}. Click at (${target.x}, ${target.y}) - ${action.reasoning}`;
      prompt += `\n   ✅ This action successfully changed game state.`;
    });
  }

  // PRIORITY 2: Add supplementary metadata context
  if (metadata) {
    // Only add expectedControls if instructions not available (to avoid duplication)
    if (metadata.expectedControls && !metadata.testingStrategy?.instructions) {
      prompt += `\n\n**Expected Controls:** ${metadata.expectedControls}`;
    }
    if (metadata.genre) {
      prompt += `\n**Game Genre:** ${metadata.genre}`;
    }
  }

  // Add HTML context (sample for preview)
  const sampleHTML = '<html><body><canvas id="game-canvas"></canvas></body></html>';
  if (sampleHTML) {
    const htmlPreview = sampleHTML.substring(0, 2000);
    prompt += `\n\n**HTML Structure (first 2000 chars):**\n${htmlPreview}`;
    if (sampleHTML.length > 2000) {
      prompt += `\n[... HTML truncated, total length: ${sampleHTML.length} chars]`;
    }
  }

  return prompt;
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const metadataPath = args[0] || '_game-examples/brick-breaker-idle/metadata-cursor.json';
  const iterationNumber = parseInt(args[1] || '1', 10);

  console.log('📋 Prompt Preview Script for Adaptive Agent\n');
  console.log(`📄 Metadata file: ${metadataPath}`);
  console.log(`🔄 Iteration: ${iterationNumber}\n`);

  try {
    // Read metadata file
    const file = Bun.file(metadataPath);
    if (!(await file.exists())) {
      throw new Error(`File not found: ${metadataPath}`);
    }

    const metadata = (await file.json()) as GameMetadata;
    console.log('✅ Metadata loaded successfully\n');

    // Display metadata summary
    console.log(formatSection('METADATA SUMMARY', '', 0));
    console.log(`Game: ${metadata.description || 'N/A'}`);
    console.log(`Genre: ${metadata.genre || 'N/A'}`);
    console.log(`Input Schema Type: ${metadata.inputSchema?.type || 'N/A'}`);
    console.log(`Has Testing Strategy Instructions: ${!!metadata.testingStrategy?.instructions}`);
    console.log(`Has Expected Controls: ${!!metadata.expectedControls}`);
    console.log('');

    // Build sample prompt
    const goal = 'Play the game';
    const prompt = buildSamplePrompt(metadata, iterationNumber, goal);

    // Display prompt sections
    console.log(formatSection('FULL PROMPT', prompt, 0));

    // Token estimation
    const basePromptTokens = estimateTokens(STATE_ANALYSIS_PROMPT);
    const iterationInstructionsTokens = estimateTokens(
      prompt.substring(STATE_ANALYSIS_PROMPT.length)
    );
    const totalTokens = basePromptTokens + iterationInstructionsTokens;

    console.log(formatSection('TOKEN ESTIMATION', '', 0));
    console.log(`Base Prompt (STATE_ANALYSIS_PROMPT): ~${basePromptTokens} tokens`);
    console.log(`Iteration Instructions + Context: ~${iterationInstructionsTokens} tokens`);
    console.log(`Total Estimated Tokens: ~${totalTokens} tokens`);
    console.log(`Estimated Cost (GPT-4 Vision): ~$${((totalTokens / 1000) * 0.01).toFixed(4)} per request`);
    console.log('');

    // Display metadata fields being used
    console.log(formatSection('METADATA FIELDS USED', '', 0));
    if (metadata.testingStrategy?.instructions) {
      console.log('✅ testingStrategy.instructions (PRIORITY 1 - Game Context)');
      console.log(`   Length: ${metadata.testingStrategy.instructions.length} chars`);
      console.log(`   Preview: ${metadata.testingStrategy.instructions.substring(0, 100)}...`);
    } else {
      console.log('❌ testingStrategy.instructions (not found)');
    }
    console.log('');

    if (metadata.expectedControls && !metadata.testingStrategy?.instructions) {
      console.log('✅ expectedControls (PRIORITY 2 - Fallback)');
      console.log(`   Length: ${metadata.expectedControls.length} chars`);
      console.log(`   Preview: ${metadata.expectedControls.substring(0, 100)}...`);
    } else if (metadata.expectedControls) {
      console.log('⚠️  expectedControls (skipped - instructions present)');
    } else {
      console.log('❌ expectedControls (not found)');
    }
    console.log('');

    if (metadata.genre) {
      console.log('✅ genre');
      console.log(`   Value: ${metadata.genre}`);
    } else {
      console.log('❌ genre (not found)');
    }
    console.log('');

    // Display prompt structure
    console.log(formatSection('PROMPT STRUCTURE', '', 0));
    console.log('1. Base Prompt (STATE_ANALYSIS_PROMPT)');
    console.log('2. Iteration-Specific Instructions');
    if (iterationNumber > 1) {
      console.log('3. Successful Action Groups Context');
    }
    console.log('4. Current Goal');
    console.log('5. Game Context (from testingStrategy.instructions)');
    console.log('6. Previous Actions Context (successful/failed patterns)');
    if (metadata.expectedControls && !metadata.testingStrategy?.instructions) {
      console.log('7. Expected Controls (fallback)');
    }
    if (metadata.genre) {
      console.log('8. Game Genre');
    }
    console.log('9. HTML Structure (first 2000 chars)');
    console.log('');

    console.log('✅ Prompt preview complete!\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run main function
main();

