// MAINNET - JEXchange architecture with ASYNC callbacks (Jan 10, 2026 - v2)
// Deployed to Shard 0 - Works cross-shard with async callbacks!
// TX: 91a8e0b9ebae7887c67723d8b82e008fd2f9338c8e0880111003228984acce3a
export const CONTRACT_ADDRESS = "erd1qqqqqqqqqqqqqpgqhcmms89zn6997pvpv9g7ckpcxz4mnjn088zqtvnz29";

export const NETWORK_CONFIG = {
  id: "mainnet",
  name: "Mainnet",
  apiAddress: "https://api.multiversx.com",
  explorerAddress: "https://explorer.multiversx.com",
  gatewayAddress: "https://gateway.multiversx.com",
};

export const GAS_LIMITS = {
  createLimitOrder: 20000000,
  cancelLimitOrder: 10000000,
  executeLimitOrder: 80000000,
};

export const PORT = process.env.PORT || 3001;

// Limit Order Executor Configuration
export const LIMIT_ORDER_CONFIG = {
  enabled: process.env.ENABLE_LIMIT_ORDER_EXECUTOR === 'true',
  checkIntervalSeconds: parseInt(process.env.LIMIT_ORDER_CHECK_INTERVAL || '30'),
  executorPemPath: process.env.EXECUTOR_WALLET_PEM_PATH || './executor-wallet.pem',
};
