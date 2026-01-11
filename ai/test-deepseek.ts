/**
 * Test script for DeepSeek AI integration
 *
 * Run with: npx ts-node ai/test-deepseek.ts
 */

import { parseTradePrompt, formatTradeDescription, validateParsedPrompt } from './index';

const TEST_PROMPTS = [
  'Buy 0.01 EGLD',
  'Swap 10 USDC to WEGLD',
  'Sell 5 USDC',
  'Convert 2 WEGLD to USDC',
  'Buy 0.5 WEGLD with USDC',
];

async function runTests() {
  console.log('🧪 Testing DeepSeek AI Integration\n');
  console.log('='.repeat(60));

  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    console.error('❌ DEEPSEEK_API_KEY environment variable is required');
    console.error('   Set it with: export DEEPSEEK_API_KEY=your_key_here');
    process.exit(1);
  }

  for (const prompt of TEST_PROMPTS) {
    console.log(`\n📝 Prompt: "${prompt}"`);
    console.log('-'.repeat(60));

    try {
      // Parse with AI
      const result = await parseTradePrompt(prompt, {
        useAI: true,
        fallbackToRegex: true,
        apiKey,
      });

      // Validate
      const validation = validateParsedPrompt(result);

      // Display results
      console.log(`✅ Parsed successfully!`);
      console.log(`   Action: ${result.command.action}`);
      console.log(`   From: ${result.command.fromToken}`);
      console.log(`   To: ${result.command.toToken}`);
      console.log(`   Amount: ${result.command.amount}`);
      console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`   Description: ${formatTradeDescription(result)}`);
      console.log(`   Valid: ${validation.valid ? '✅ Yes' : '❌ No'}`);

      if (!validation.valid) {
        console.log(`   Errors: ${validation.errors.join(', ')}`);
      }
    } catch (error: any) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Tests complete!');
}

// Run tests
runTests().catch(console.error);
