/**
 * Unified AI Parser with Fallback Strategy
 *
 * Primary: DeepSeek AI (high accuracy)
 * Fallback: Regex parser (MVP backup)
 */

import { createDeepSeekClient } from './deepseek';
import { parsePrompt as regexParse } from './parsePrompt';
import { ParsedPrompt } from './schema';

export interface ParserOptions {
  useAI?: boolean;
  fallbackToRegex?: boolean;
  apiKey?: string;
}

/**
 * Parse trading prompt with AI + fallback strategy
 */
export async function parseTradePrompt(
  prompt: string,
  options: ParserOptions = {}
): Promise<ParsedPrompt> {
  const { useAI = true, fallbackToRegex = true, apiKey } = options;

  let result: ParsedPrompt | null = null;
  let aiError: Error | null = null;

  // Try DeepSeek AI first
  if (useAI) {
    try {
      const deepseek = createDeepSeekClient(apiKey);
      result = await deepseek.parsePrompt(prompt);
      console.log('✅ DeepSeek AI parsed successfully:', result);
      return result;
    } catch (error) {
      aiError = error as Error;
      console.warn('⚠️ DeepSeek AI failed:', aiError.message);
    }
  }

  // Fallback to regex parser
  if (fallbackToRegex) {
    console.log('🔄 Falling back to regex parser...');
    result = regexParse(prompt);

    // Check if regex parser had good confidence
    if (result.confidence < 0.7) {
      throw new Error(
        `Unable to parse prompt with confidence. AI Error: ${
          aiError?.message || 'N/A'
        }. Regex confidence: ${result.confidence}`
      );
    }

    console.log('✅ Regex parser succeeded:', result);
    return result;
  }

  // Both failed
  throw new Error(
    `Failed to parse prompt. ${
      aiError ? `AI Error: ${aiError.message}` : 'AI disabled'
    }`
  );
}

/**
 * Validate parsed result before execution
 */
export function validateParsedPrompt(parsed: ParsedPrompt): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check confidence threshold
  if (parsed.confidence < 0.7) {
    errors.push(`Confidence too low: ${parsed.confidence.toFixed(2)}`);
  }

  // Check amount
  if (!parsed.command.amount || parsed.command.amount <= 0) {
    errors.push('Invalid amount');
  }

  // Check tokens
  if (!parsed.command.fromToken || !parsed.command.toToken) {
    errors.push('Missing token information');
  }

  // Check same token
  if (parsed.command.fromToken === parsed.command.toToken) {
    errors.push('Cannot swap same token');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Format parsed result for user confirmation
 */
export function formatTradeDescription(parsed: ParsedPrompt): string {
  const { command } = parsed;
  const { action, amount, fromToken, toToken } = command;

  // Simplify token display (remove identifier suffix)
  const fromSymbol = fromToken?.split('-')[0] || fromToken;
  const toSymbol = toToken?.split('-')[0] || toToken;

  switch (action) {
    case 'market_buy':
      return `Buy ${amount} ${toSymbol} with ${fromSymbol}`;
    case 'market_sell':
      return `Sell ${amount} ${fromSymbol} for ${toSymbol}`;
    case 'swap':
      return `Swap ${amount} ${fromSymbol} → ${toSymbol}`;
    default:
      return `Trade ${amount} ${fromSymbol} to ${toSymbol}`;
  }
}

// Re-export types and utilities
export {
  createDeepSeekClient,
  getTokenIdentifier,
  isSupportedToken
} from './deepseek';
export { parsePrompt as regexParsePrompt } from './parsePrompt';
export type { TradeCommand, ParsedPrompt } from './schema';
