#!/usr/bin/env bun

/**
 * Validate metadata files against the schema.
 *
 * Usage:
 *   bun scripts/validate-metadata.ts [path-to-metadata.json]
 *
 * Example:
 *   bun scripts/validate-metadata.ts _game-examples/pong/metadata.json
 */

import { validateGameMetadata } from '../src/schemas/metadata.schema';

async function main() {
  const args = process.argv.slice(2);
  const metadataPath = args[0];

  if (!metadataPath) {
    console.error('❌ Error: Please provide a metadata file path');
    console.error('Usage: bun scripts/validate-metadata.ts [path-to-metadata.json]');
    process.exit(1);
  }

  console.log(`📄 Validating metadata file: ${metadataPath}\n`);

  try {
    const file = Bun.file(metadataPath);
    if (!(await file.exists())) {
      throw new Error(`File not found: ${metadataPath}`);
    }

    const metadata = await file.json();
    const result = validateGameMetadata(metadata);

    if (result.success) {
      console.log('✅ Metadata is valid!\n');
      console.log('Metadata Summary:');
      console.log(`- Version: ${result.data.metadataVersion || 'N/A'}`);
      console.log(`- Genre: ${result.data.genre || 'N/A'}`);
      console.log(`- Description: ${result.data.description?.substring(0, 60) || 'N/A'}...`);
      console.log(`- Input Schema Type: ${result.data.inputSchema.type}`);
      console.log(`- Has Testing Strategy: ${!!result.data.testingStrategy}`);
      console.log(`- Has Instructions: ${!!result.data.testingStrategy?.instructions}`);
      if (result.data.testingStrategy?.instructions) {
        console.log(`- Instructions Length: ${result.data.testingStrategy.instructions.length} chars`);
      }
      process.exit(0);
    } else {
      console.error('❌ Metadata validation failed!\n');
      console.error('Errors:');
      result.error.errors.forEach((err, index) => {
        console.error(`  ${index + 1}. ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();

