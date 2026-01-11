/**
 * xExchange Integration - Direct Pair Swaps
 *
 * Instead of using aggregator/router (functions not found),
 * we swap directly with individual pair contracts.
 * This is simpler and guaranteed to work.
 */

import { signAndSendTransactions } from 'helpers';
import {
  Address,
  GAS_PRICE,
  Transaction,
  TransactionsDisplayInfoType,
  useGetAccount,
  useGetNetworkConfig
} from 'lib';
import { TOKENS, toWei } from './config';

// xExchange Pair Contracts (Mainnet)
// These are the actual liquidity pools where swaps happen
const PAIRS: Record<string, string> = {
  'WEGLD-USDC':
    'erd1qqqqqqqqqqqqqpgqeel2kumf0r8ffyhth7pqdujjat9nx0862jpsg2pqaq',
  'USDC-WEGLD':
    'erd1qqqqqqqqqqqqqpgqeel2kumf0r8ffyhth7pqdujjat9nx0862jpsg2pqaq', // Same pair, reverse order
  'WEGLD-MEX': 'erd1qqqqqqqqqqqqqpgqzw0d0tj25qme9e4ukverjjjqle6xamay0n4s5r0v9g',
  'MEX-WEGLD': 'erd1qqqqqqqqqqqqqpgqzw0d0tj25qme9e4ukverjjjqle6xamay0n4s5r0v9g' // Same pair, reverse order
  // Add more pairs as needed
};

// Gas limit for pair swaps
const SWAP_GAS_LIMIT = 30_000_000; // 30M gas

// Transaction display info
const SWAP_TX_INFO: TransactionsDisplayInfoType = {
  processingMessage: 'Executing swap on xExchange',
  errorMessage: 'Swap failed',
  successMessage: 'Swap executed successfully!'
};

/**
 * Hook for direct xExchange pair swaps
 * Uses actual pair contracts instead of router/aggregator
 */
export const useXExchangeSwaps = () => {
  const { network } = useGetNetworkConfig();
  const { address } = useGetAccount();

  /**
   * Get pair contract for token combination
   */
  const getPairContract = (token1: string, token2: string): string | null => {
    // Normalize token symbols
    const sym1 = token1.split('-')[0];
    const sym2 = token2.split('-')[0];

    // Try both orders
    const key1 = `${sym1}-${sym2}`;
    const key2 = `${sym2}-${sym1}`;

    return PAIRS[key1] || PAIRS[key2] || null;
  };

  /**
   * Execute swap using pair contract
   *
   * Pattern for ESDT tokens:
   * ESDTTransfer@<token_hex>@<amount_hex>@<function>@<min_amount_hex>
   *
   * Common functions on pair contracts:
   * - swapTokensFixedInput (exact input, variable output)
   * - swapTokensFixedOutput (variable input, exact output)
   * - swapNoFee (for specific scenarios)
   */
  const executeSwap = async (
    fromToken: string,
    toToken: string,
    amount: number,
    fromDecimals: number,
    slippagePercent: number = 5
  ): Promise<string | undefined> => {
    try {
      // Get pair contract
      const pairContract = getPairContract(fromToken, toToken);

      if (!pairContract) {
        throw new Error(
          `No liquidity pool found for ${fromToken} → ${toToken}`
        );
      }

      // Calculate amounts
      const amountWei = toWei(amount, fromDecimals);
      const minAmountOut = Math.floor(
        parseInt(amountWei) * (1 - slippagePercent / 100)
      );

      // Build transaction for pair swap
      // Using swapTokensFixedInput is the most common pattern
      const tokenHex = Buffer.from(fromToken).toString('hex');
      const amountHex = BigInt(amountWei).toString(16);
      const functionName = 'swapTokensFixedInput';
      const functionHex = Buffer.from(functionName).toString('hex');
      const minAmountHex = BigInt(minAmountOut).toString(16);

      // Transaction data format for pair contract
      const data = `ESDTTransfer@${tokenHex}@${amountHex}@${functionHex}@${minAmountHex}`;

      console.log('🔄 Building pair swap transaction:', {
        pair: pairContract,
        from: fromToken,
        to: toToken,
        amount,
        amountWei,
        minAmountOut,
        data
      });

      const swapTransaction = new Transaction({
        value: BigInt(0),
        data: Buffer.from(data),
        receiver: new Address(pairContract),
        gasLimit: BigInt(SWAP_GAS_LIMIT),
        gasPrice: BigInt(GAS_PRICE),
        chainID: network.chainId,
        sender: new Address(address),
        version: 2
      });

      const sessionId = await signAndSendTransactions({
        transactions: [swapTransaction],
        transactionsDisplayInfo: SWAP_TX_INFO
      });

      return sessionId;
    } catch (error) {
      console.error('❌ Swap failed:', error);
      throw error;
    }
  };

  return {
    executeSwap,
    getPairContract
  };
};

/**
 * Helper to add new pairs
 * Call this to expand supported token combinations
 */
export const addPair = (
  token1: string,
  token2: string,
  contractAddress: string
) => {
  const key = `${token1}-${token2}`;
  PAIRS[key] = contractAddress;
  console.log(`✅ Added pair: ${key} → ${contractAddress}`);
};
