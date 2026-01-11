/**
 * DeepSeek AI Integration for Intent Parsing
 *
 * Converts natural language prompts into structured trade commands
 * with strict validation and safety checks.
 */

import { TradeCommand, ParsedPrompt } from './schema';

// Supported tokens whitelist
const SUPPORTED_TOKENS = {
  'USDC': 'USDC-c76f1f',
  'WEGLD': 'WEGLD-bd4d79',
  'EGLD': 'EGLD',
} as const;

// Safety bounds
const AMOUNT_BOUNDS = {
  min: 0.001,
  max: 10000,
};

const CONFIDENCE_THRESHOLD = 0.7;

interface DeepSeekResponse {
  action: 'buy' | 'sell' | 'swap';
  fromToken: string;
  toToken: string;
  amount: string;
  confidence: number;
}

export class DeepSeekAI {
  private apiKey: string;
  private apiUrl: string = 'https://api.deepseek.com/v1/chat/completions';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('DeepSeek API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * System prompt for deterministic intent parsing
   */
  private getSystemPrompt(): string {
    return `You are a trading intent parser for a DeFi platform on MultiversX blockchain.

Your task: Parse user trading prompts into structured JSON with HIGH accuracy and determinism.

SUPPORTED TOKENS (use exact identifiers):
- USDC: "USDC-c76f1f"
- WEGLD: "WEGLD-bd4d79"
- EGLD: "EGLD"

SUPPORTED ACTIONS:
- "buy": User wants to acquire a token (swap from USDC/WEGLD/EGLD to target token)
- "sell": User wants to sell a token (swap token to USDC/WEGLD/EGLD)
- "swap": Generic swap between any two tokens

AMOUNT RULES:
- Must be positive number
- Must be within reasonable bounds (0.001 - 10000)
- Return as string to preserve precision

PARSING RULES:
1. "Buy X EGLD" → swap USDC to EGLD (fromToken=USDC, toToken=EGLD, amount=X)
2. "Sell X USDC" → swap USDC to WEGLD (fromToken=USDC, toToken=WEGLD, amount=X)
3. "Swap X USDC to WEGLD" → direct swap (fromToken=USDC, toToken=WEGLD, amount=X)
4. If user says "Buy EGLD" without amount, reject (confidence=0)
5. If token not supported, reject (confidence=0)
6. If ambiguous, set confidence < 0.7

OUTPUT FORMAT (JSON only, no explanation):
{
  "action": "buy" | "sell" | "swap",
  "fromToken": "USDC-c76f1f" | "WEGLD-bd4d79" | "EGLD",
  "toToken": "USDC-c76f1f" | "WEGLD-bd4d79" | "EGLD",
  "amount": "decimal as string",
  "confidence": 0.0 to 1.0
}

EXAMPLES:
Input: "Buy 0.01 EGLD"
Output: {"action":"buy","fromToken":"USDC-c76f1f","toToken":"EGLD","amount":"0.01","confidence":0.95}

Input: "Swap 10 USDC to WEGLD"
Output: {"action":"swap","fromToken":"USDC-c76f1f","toToken":"WEGLD-bd4d79","amount":"10","confidence":0.98}

Input: "Sell 5 USDC"
Output: {"action":"sell","fromToken":"USDC-c76f1f","toToken":"WEGLD-bd4d79","amount":"5","confidence":0.90}

Be strict. Only return valid JSON. No markdown, no code blocks, just JSON.`;
  }

  /**
   * Parse trading prompt using DeepSeek API
   */
  async parsePrompt(prompt: string): Promise<ParsedPrompt> {
    try {
      // Input validation
      if (!prompt || prompt.trim().length === 0) {
        throw new Error('Prompt cannot be empty');
      }

      if (prompt.length > 500) {
        throw new Error('Prompt too long (max 500 characters)');
      }

      // Call DeepSeek API
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt(),
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1, // Low temperature for deterministic output
          max_tokens: 200,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`DeepSeek API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content;

      if (!aiResponse) {
        throw new Error('No response from DeepSeek API');
      }

      // Parse JSON response
      const parsed = this.parseAIResponse(aiResponse);

      // Validate and convert to TradeCommand
      const validated = this.validateAndConvert(parsed, prompt);

      return validated;
    } catch (error) {
      console.error('DeepSeek parsing error:', error);
      throw error;
    }
  }

  /**
   * Parse AI response (handle potential markdown wrapping)
   */
  private parseAIResponse(response: string): DeepSeekResponse {
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }

    try {
      return JSON.parse(jsonStr);
    } catch (error) {
      throw new Error(`Failed to parse AI response as JSON: ${response}`);
    }
  }

  /**
   * Validate AI response and convert to ParsedPrompt
   */
  private validateAndConvert(response: DeepSeekResponse, originalPrompt: string): ParsedPrompt {
    const errors: string[] = [];

    // Validate action
    if (!['buy', 'sell', 'swap'].includes(response.action)) {
      errors.push(`Invalid action: ${response.action}`);
    }

    // Validate tokens
    const validTokens = Object.values(SUPPORTED_TOKENS);
    if (!validTokens.includes(response.fromToken as any)) {
      errors.push(`Unsupported fromToken: ${response.fromToken}`);
    }
    if (!validTokens.includes(response.toToken as any)) {
      errors.push(`Unsupported toToken: ${response.toToken}`);
    }

    // Validate amount
    const amount = parseFloat(response.amount);
    if (isNaN(amount) || amount <= 0) {
      errors.push(`Invalid amount: ${response.amount}`);
    }
    if (amount < AMOUNT_BOUNDS.min || amount > AMOUNT_BOUNDS.max) {
      errors.push(`Amount out of bounds (${AMOUNT_BOUNDS.min} - ${AMOUNT_BOUNDS.max}): ${amount}`);
    }

    // Validate confidence
    if (response.confidence < CONFIDENCE_THRESHOLD) {
      errors.push(`Confidence too low: ${response.confidence} (threshold: ${CONFIDENCE_THRESHOLD})`);
    }

    // If validation errors, throw
    if (errors.length > 0) {
      throw new Error(`Validation failed:\n${errors.join('\n')}`);
    }

    // Convert to TradeCommand
    const command: TradeCommand = {
      action: response.action,
      baseToken: response.action === 'buy' ? response.toToken : response.fromToken,
      quoteToken: response.action === 'buy' ? response.fromToken : response.toToken,
      amount,
      fromToken: response.fromToken,
      toToken: response.toToken,
    };

    return {
      command,
      confidence: response.confidence,
      originalPrompt,
    };
  }

  /**
   * Test connection to DeepSeek API
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.parsePrompt('Buy 0.01 EGLD');
      return result.confidence > 0;
    } catch (error) {
      console.error('DeepSeek connection test failed:', error);
      return false;
    }
  }
}

/**
 * Create DeepSeek client with API key from environment
 */
export function createDeepSeekClient(apiKey?: string): DeepSeekAI {
  const key = apiKey || process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || '';

  if (!key) {
    throw new Error('DeepSeek API key not found. Set NEXT_PUBLIC_DEEPSEEK_API_KEY environment variable.');
  }

  return new DeepSeekAI(key);
}

/**
 * Utility: Get token identifier from symbol
 */
export function getTokenIdentifier(symbol: string): string | null {
  const upper = symbol.toUpperCase();
  return SUPPORTED_TOKENS[upper as keyof typeof SUPPORTED_TOKENS] || null;
}

/**
 * Utility: Validate if token is supported
 */
export function isSupportedToken(identifier: string): boolean {
  return Object.values(SUPPORTED_TOKENS).includes(identifier as any);
}
