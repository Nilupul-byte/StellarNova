import { ParsedPrompt, TradeCommand } from './schema';

/**
 * Parse user prompt into structured trade command
 *
 * Examples:
 * - "Swap 10 USDC to WEGLD" → { action: 'swap', fromToken: 'USDC-c76f1f', toToken: 'WEGLD-bd4d79', amount: 10 }
 * - "Buy 0.5 WEGLD with USDC" → { action: 'market_buy', baseToken: 'WEGLD-bd4d79', quoteToken: 'USDC-c76f1f', amount: 0.5 }
 * - "Sell 1 WEGLD for USDC" → { action: 'market_sell', baseToken: 'WEGLD-bd4d79', quoteToken: 'USDC-c76f1f', amount: 1 }
 */

const TOKEN_MAP: Record<string, string> = {
  USDC: 'USDC-c76f1f',
  WEGLD: 'WEGLD-bd4d79',
  EGLD: 'EGLD'
};

export function parsePrompt(prompt: string): ParsedPrompt {
  const lowerPrompt = prompt.toLowerCase();

  // Extract tokens
  let fromToken = '';
  let toToken = '';
  let amount = 0;
  let action: 'market_buy' | 'market_sell' | 'swap' = 'swap';

  // Parse amount
  const amountMatch = prompt.match(/(\d+\.?\d*)/);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1]);
  }

  // Detect action and tokens
  if (lowerPrompt.includes('swap') || lowerPrompt.includes('convert')) {
    action = 'swap';

    // Pattern: "swap X USDC to WEGLD"
    const swapMatch = prompt.match(
      /(?:swap|convert)\s+[\d.]+\s+(\w+)\s+(?:to|for|into)\s+(\w+)/i
    );
    if (swapMatch) {
      fromToken = TOKEN_MAP[swapMatch[1].toUpperCase()] || swapMatch[1];
      toToken = TOKEN_MAP[swapMatch[2].toUpperCase()] || swapMatch[2];
    }
  } else if (lowerPrompt.includes('buy')) {
    action = 'market_buy';

    // Pattern: "buy X WEGLD with USDC"
    const buyMatch = prompt.match(
      /buy\s+[\d.]+\s+(\w+)\s+(?:with|using)\s+(\w+)/i
    );
    if (buyMatch) {
      toToken = TOKEN_MAP[buyMatch[1].toUpperCase()] || buyMatch[1];
      fromToken = TOKEN_MAP[buyMatch[2].toUpperCase()] || buyMatch[2];
    }
  } else if (lowerPrompt.includes('sell')) {
    action = 'market_sell';

    // Pattern: "sell X WEGLD for USDC"
    const sellMatch = prompt.match(
      /sell\s+[\d.]+\s+(\w+)\s+(?:for|to)\s+(\w+)/i
    );
    if (sellMatch) {
      fromToken = TOKEN_MAP[sellMatch[1].toUpperCase()] || sellMatch[1];
      toToken = TOKEN_MAP[sellMatch[2].toUpperCase()] || sellMatch[2];
    }
  }

  // Calculate confidence based on how much we parsed
  let confidence = 0;
  if (amount > 0) confidence += 0.4;
  if (fromToken) confidence += 0.3;
  if (toToken) confidence += 0.3;

  const command: TradeCommand = {
    action,
    baseToken: action === 'market_buy' ? toToken : fromToken,
    quoteToken: action === 'market_buy' ? fromToken : toToken,
    amount,
    fromToken,
    toToken
  };

  return {
    command,
    confidence,
    originalPrompt: prompt
  };
}

/**
 * For STEP 4: Integrate with OpenAI/Claude for more sophisticated parsing
 *
 * Example implementation:
 *
 * async function parsePromptWithAI(prompt: string): Promise<ParsedPrompt> {
 *   const response = await openai.chat.completions.create({
 *     model: 'gpt-4',
 *     messages: [{
 *       role: 'system',
 *       content: 'Parse trading prompts into structured JSON...'
 *     }, {
 *       role: 'user',
 *       content: prompt
 *     }]
 *   });
 *
 *   return JSON.parse(response.choices[0].message.content);
 * }
 */
