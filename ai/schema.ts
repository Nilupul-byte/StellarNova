export interface TradeCommand {
  action: 'market_buy' | 'market_sell' | 'swap';
  baseToken: string;
  quoteToken: string;
  amount: number;
  fromToken?: string;
  toToken?: string;
}

export interface ParsedPrompt {
  command: TradeCommand;
  confidence: number;
  originalPrompt: string;
}
