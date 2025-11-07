#!/usr/bin/env bun

/**
 * Test script for buildStagehandSystemPrompt
 * 
 * Usage:
 *   bun test-system-prompt.mjs [path-to-metadata.json]
 * 
 * Example:
 *   bun test-system-prompt.mjs _game-examples/brick-breaker-idle/metadata.json
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildStagehandSystemPrompt } from './src/utils/stagehand-agent.ts';

// Get metadata file path from command line or use default
const metadataPath = process.argv[2] || '_game-examples/brick-breaker-idle/metadata.json';
const resolvedPath = resolve(process.cwd(), metadataPath);

console.log(`📄 Reading metadata from: ${resolvedPath}\n`);

try {
  // Read and parse metadata
  const metadataContent = readFileSync(resolvedPath, 'utf-8');
  const metadata = JSON.parse(metadataContent);

  // Build system prompt
  const systemPrompt = buildStagehandSystemPrompt(metadata);

  // Display results
  console.log('='.repeat(80));
  console.log('SYSTEM PROMPT OUTPUT');
  console.log('='.repeat(80));
  console.log(systemPrompt);
  console.log('\n' + '='.repeat(80));
  
  // Analysis
  console.log('\n📊 ANALYSIS:');
  console.log(`- Total length: ${systemPrompt.length} characters`);
  console.log(`- Total lines: ${systemPrompt.split('\n').length}`);
  
  // Check for key sections
  const checks = {
    'Base prompt': systemPrompt.includes('QA tester'),
    'Game description': metadata.description && systemPrompt.includes(metadata.description.substring(0, 30)),
    'Expected controls': metadata.expectedControls && systemPrompt.includes(metadata.expectedControls.substring(0, 30)),
    'Canvas-based detection': metadata.specialInstructions?.canvasBased && systemPrompt.includes('canvas-based'),
    'Click targets': metadata.specialInstructions?.clickTargets && systemPrompt.includes('Click Targets'),
    'Click bounds': metadata.specialInstructions?.clickTargets?.[0]?.bounds && systemPrompt.includes('bounds'),
    'Expected behavior': metadata.specialInstructions?.expectedBehavior && systemPrompt.includes('Expected Behavior'),
    'Avoid clicking': metadata.specialInstructions?.avoidClicking && systemPrompt.includes('Areas to Avoid'),
    'Success indicators': metadata.successIndicators && systemPrompt.includes('Success Indicators'),
    'Validation checks': metadata.testingStrategy?.validationChecks && systemPrompt.includes('Validation Checks'),
    'Notes': metadata.notes && systemPrompt.includes('Important Notes'),
  };

  console.log('\n✅ KEY SECTIONS:');
  Object.entries(checks).forEach(([key, value]) => {
    console.log(`  ${value ? '✓' : '✗'} ${key}`);
  });

  // Count items in each section
  console.log('\n📈 SECTION COUNTS:');
  if (metadata.specialInstructions?.clickTargets) {
    console.log(`  - Click targets: ${metadata.specialInstructions.clickTargets.length}`);
  }
  if (metadata.specialInstructions?.avoidClicking) {
    console.log(`  - Avoid clicking areas: ${metadata.specialInstructions.avoidClicking.length}`);
  }
  if (metadata.successIndicators) {
    console.log(`  - Success indicators: ${metadata.successIndicators.length}`);
  }
  if (metadata.testingStrategy?.validationChecks) {
    console.log(`  - Validation checks: ${metadata.testingStrategy.validationChecks.length}`);
  }
  if (metadata.notes) {
    console.log(`  - Notes: ${metadata.notes.length}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ System prompt generated successfully!');
  console.log('='.repeat(80));

} catch (error) {
  console.error('❌ Error:', error.message);
  if (error.code === 'ENOENT') {
    console.error(`\nFile not found: ${resolvedPath}`);
    console.error('Usage: bun test-system-prompt.mjs [path-to-metadata.json]');
  } else if (error instanceof SyntaxError) {
    console.error(`\nInvalid JSON in file: ${resolvedPath}`);
  }
  process.exit(1);
}

