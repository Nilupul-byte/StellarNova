/**
 * StellarNova Smart Contract Configuration
 *
 * Contract deployed on MultiversX Mainnet
 * Address: erd1qqqqqqqqqqqqqpgqhcmms89zn6997pvpv9g7ckpcxz4mnjn088zqtvnz29
 * Deployed: Jan 10, 2026 - v2 - JEXchange architecture with ASYNC callbacks (works cross-shard!)
 * TX: 91a8e0b9ebae7887c67723d8b82e008fd2f9338c8e0880111003228984acce3a
 */

// Contract Address (Mainnet)
export const STELLARNOVA_CONTRACT_ADDRESS =
  'erd1qqqqqqqqqqqqqpgqhcmms89zn6997pvpv9g7ckpcxz4mnjn088zqtvnz29';

// Supported Tokens (Mainnet)
export const TOKENS = {
  USDC: {
    identifier: 'USDC-c76f1f',
    name: 'USD Coin',
    decimals: 6,
    ticker: 'USDC'
  },
  WEGLD: {
    identifier: 'WEGLD-bd4d79',
    name: 'Wrapped EGLD',
    decimals: 18,
    ticker: 'WEGLD'
  },
  EGLD: {
    identifier: 'EGLD',
    name: 'EGLD',
    decimals: 18,
    ticker: 'EGLD'
  }
};

// Gas Limits for Contract Calls
export const GAS_LIMITS = {
  createLimitOrder: 20_000_000, // 20M gas for creating limit order
  cancelLimitOrder: 10_000_000, // 10M gas for cancelling order
  executeLimitOrder: 50_000_000, // 50M gas for executing order (includes swap)
  // Legacy (not used in JEXchange architecture)
  deposit: 10_000_000,
  withdraw: 10_000_000,
  executeTrade: 50_000_000
};

// Slippage Settings
export const MAX_SLIPPAGE_PERCENT = 5; // 5% max slippage

// Helper: Get token by identifier
export function getTokenByIdentifier(identifier: string) {
  return Object.values(TOKENS).find((t) => t.identifier === identifier);
}

// Helper: Get token by ticker
export function getTokenByTicker(ticker: string) {
  return Object.values(TOKENS).find(
    (t) => t.ticker.toUpperCase() === ticker.toUpperCase()
  );
}

// Helper: Format amount with decimals
export function toWei(amount: number, decimals: number): string {
  return (amount * 10 ** decimals).toString();
}

// Helper: Parse amount from wei
export function fromWei(amount: string, decimals: number): number {
  return parseInt(amount) / 10 ** decimals;
}
