#!/usr/bin/env bun

/**
 * Test script for buildStagehandInstruction
 * 
 * Usage:
 *   bun test-instruction.mjs [path-to-metadata.json]
 * 
 * Example:
 *   bun test-instruction.mjs _game-examples/brick-breaker-idle/metadata.json
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildStagehandInstruction } from './src/utils/stagehand-agent.ts';

// Get metadata file path from command line or use default
const metadataPath = process.argv[2] || '_game-examples/brick-breaker-idle/metadata.json';
const resolvedPath = resolve(process.cwd(), metadataPath);

console.log(`📄 Reading metadata from: ${resolvedPath}\n`);

try {
  // Read and parse metadata
  const metadataContent = readFileSync(resolvedPath, 'utf-8');
  const metadata = JSON.parse(metadataContent);

  // Build instruction
  const instruction = buildStagehandInstruction(metadata);

  // Display results
  console.log('='.repeat(80));
  console.log('AGENT INSTRUCTION OUTPUT');
  console.log('='.repeat(80));
  console.log(instruction);
  console.log('\n' + '='.repeat(80));
  
  // Analysis
  console.log('\n📊 ANALYSIS:');
  console.log(`- Total length: ${instruction.length} characters`);
  console.log(`- Total lines: ${instruction.split('\n').length}`);
  console.log(`- Estimated tokens: ~${Math.ceil(instruction.length / 4)} (rough estimate: 4 chars per token)`);
  
  // Check for key sections
  const checks = {
    'Game Goal': instruction.includes('Game Goal:'),
    'Starting Goal': instruction.includes('Starting Goal:'),
    'Available Controls': instruction.includes('Available Controls:'),
    'Canvas-based detection': metadata.specialInstructions?.canvasBased && instruction.includes('canvas-based'),
    'Interaction method': instruction.includes('IMPORTANT: This is a canvas-based game') || instruction.includes('DOM elements for interaction'),
    'Click targets': metadata.specialInstructions?.clickTargets && instruction.includes('Click Targets'),
    'Click bounds': metadata.specialInstructions?.clickTargets?.[0]?.bounds && instruction.includes('bounds'),
    'Expected behavior': metadata.specialInstructions?.expectedBehavior && instruction.includes('Expected Behavior'),
    'Avoid clicking': metadata.specialInstructions?.avoidClicking && instruction.includes('Areas to Avoid Clicking'),
    'Success indicators': metadata.successIndicators && instruction.includes('Success Indicators'),
    'Validation checks': metadata.testingStrategy?.validationChecks && instruction.includes('Validation Checks'),
    'Notes': metadata.notes && instruction.includes('Important Notes'),
    'Time-based completion': instruction.includes('Play for about 2 minutes'),
  };

  console.log('\n✅ KEY SECTIONS:');
  Object.entries(checks).forEach(([key, value]) => {
    console.log(`  ${value ? '✓' : '✗'} ${key}`);
  });

  // Count items in each section
  console.log('\n📈 SECTION COUNTS:');
  if (metadata.description) {
    console.log(`  - Game description: ${metadata.description.length} characters`);
  }
  if (metadata.testingStrategy?.instructions) {
    const goals = metadata.testingStrategy.instructions.split(';').filter(g => g.trim().length > 0);
    console.log(`  - Starting goals: ${goals.length}`);
  }
  if (metadata.inputSchema?.actions) {
    const actionCount = Array.isArray(metadata.inputSchema.actions) ? metadata.inputSchema.actions.length : 0;
    console.log(`  - Available actions: ${actionCount}`);
  }
  if (metadata.inputSchema?.axes) {
    const axisCount = Array.isArray(metadata.inputSchema.axes) ? metadata.inputSchema.axes.length : 0;
    console.log(`  - Available axes: ${axisCount}`);
  }
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

  // Show section breakdown
  console.log('\n📋 SECTION BREAKDOWN:');
  const sections = instruction.split('\n\n').filter(s => s.trim().length > 0);
  sections.forEach((section, index) => {
    const firstLine = section.split('\n')[0];
    const preview = firstLine.length > 60 ? firstLine.substring(0, 60) + '...' : firstLine;
    console.log(`  ${index + 1}. ${preview} (${section.length} chars)`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('✅ Agent instruction generated successfully!');
  console.log('='.repeat(80));
  console.log(`\n💡 This instruction will be passed to agent.execute() when running Stagehand Agent QA mode.`);
  console.log(`   The instruction contains ALL game-specific context needed for testing.`);

} catch (error) {
  console.error('❌ Error:', error.message);
  if (error.code === 'ENOENT') {
    console.error(`\nFile not found: ${resolvedPath}`);
    console.error('Usage: bun test-instruction.mjs [path-to-metadata.json]');
  } else if (error instanceof SyntaxError) {
    console.error(`\nInvalid JSON in file: ${resolvedPath}`);
  }
  process.exit(1);
}

