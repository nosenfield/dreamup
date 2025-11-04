/**
 * DreamUp - Autonomous Game QA Agent
 * Entry point for CLI and Lambda handler
 */

// Verify environment loading (Bun loads .env automatically)
const config = {
  browserbaseApiKey: process.env.BROWSERBASE_API_KEY,
  browserbaseProjectId: process.env.BROWSERBASE_PROJECT_ID,
  openaiApiKey: process.env.OPENAI_API_KEY,
  debug: process.env.DEBUG === 'true',
};

console.log('✓ DreamUp initialized');
console.log('✓ Environment loaded:', {
  hasBrowserbaseKey: !!config.browserbaseApiKey,
  hasOpenAIKey: !!config.openaiApiKey,
  debug: config.debug,
});

// CLI entry point
if (import.meta.main) {
  console.log('\n🎮 DreamUp Game QA Agent');
  console.log('Usage: bun run qa <game-url>');
  console.log('\nSetup status:');
  console.log('  Browserbase:', config.browserbaseApiKey ? '✓ Configured' : '✗ Missing API key');
  console.log('  OpenAI:', config.openaiApiKey ? '✓ Configured' : '✗ Missing API key');
  console.log('\nNext: Add your API keys to .env file');
}

export default config;
