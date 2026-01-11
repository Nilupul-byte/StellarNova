/**
 * xExchange API Integration - THE CORRECT WAY
 *
 * Instead of manually encoding Tasks Composer calls (very complex),
 * we use xExchange's GraphQL API to get properly formatted swap transactions.
 *
 * This matches EXACTLY what xExchange UI does:
 * 1. Get swap quote from API
 * 2. API returns pre-encoded transaction data
 * 3. We sign and send it
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
import { toWei } from './config';

// xExchange GraphQL API
const XEXCHANGE_API = 'https://graph.xexchange.com/graphql';

// Tasks Composer contract (where transactions will be sent)
const TASKS_COMPOSER =
  'erd1qqqqqqqqqqqqqpgqsytkvnexypp7argk02l0rasnj57sxa542jpshkl7df';

// Transaction display info
const SWAP_TX_INFO: TransactionsDisplayInfoType = {
  processingMessage: 'Executing swap on xExchange',
  errorMessage: 'Swap failed',
  successMessage: 'Swap executed successfully!'
};

interface SwapQuote {
  data: string; // Pre-encoded transaction data
  value: string; // Transaction value (for EGLD swaps)
  gasLimit: number; // Required gas
  receiver: string; // Contract address
  expectedOutput: string; // Expected output amount
  priceImpact: number; // Price impact %
}

/**
 * Hook for xExchange swaps using API
 */
export const useXExchangeSwaps = () => {
  const { network } = useGetNetworkConfig();
  const { address } = useGetAccount();

  /**
   * Get swap quote from xExchange API
   * This returns the properly encoded transaction data
   */
  const getSwapQuote = async (
    fromToken: string,
    toToken: string,
    amount: string,
    slippageTolerance: number = 5
  ): Promise<SwapQuote> => {
    const query = `
      query GetSwapQuote(
        $tokenInID: String!,
        $tokenOutID: String!,
        $amountIn: String!,
        $tolerance: Float!
      ) {
        getSwapQuote(
          tokenInID: $tokenInID,
          tokenOutID: $tokenOutID,
          amountIn: $amountIn,
          tolerance: $tolerance
        ) {
          data
          value
          gasLimit
          receiver
          expectedOutput
          priceImpact
        }
      }
    `;

    const variables = {
      tokenInID: fromToken,
      tokenOutID: toToken,
      amountIn: amount,
      tolerance: slippageTolerance / 100 // Convert 5% to 0.05
    };

    const response = await fetch(XEXCHANGE_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      throw new Error(`xExchange API error: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL error: ${result.errors[0].message}`);
    }

    return result.data.getSwapQuote;
  };

  /**
   * Execute swap using xExchange API
   *
   * This is the CORRECT way that matches xExchange UI:
   * 1. Get quote from API (returns encoded transaction)
   * 2. Sign and send the transaction
   */
  const executeSwap = async (params: {
    fromToken: string;
    toToken: string;
    amount: number;
    fromDecimals: number;
    slippagePercent?: number;
  }): Promise<string | undefined> => {
    const {
      fromToken,
      toToken,
      amount,
      fromDecimals,
      slippagePercent = 5
    } = params;

    try {
      // Convert amount to wei
      const amountWei = toWei(amount, fromDecimals);

      console.log('🔄 Getting swap quote from xExchange API...', {
        from: fromToken,
        to: toToken,
        amount: amountWei
      });

      // Get quote from xExchange API
      const quote = await getSwapQuote(
        fromToken,
        toToken,
        amountWei,
        slippagePercent
      );

      console.log('✅ Quote received:', {
        expectedOutput: quote.expectedOutput,
        priceImpact: quote.priceImpact,
        gasLimit: quote.gasLimit,
        receiver: quote.receiver
      });

      // Build transaction using data from API
      const swapTransaction = new Transaction({
        value: BigInt(quote.value || 0),
        data: Buffer.from(quote.data), // Pre-encoded by xExchange API!
        receiver: new Address(quote.receiver || TASKS_COMPOSER),
        gasLimit: BigInt(quote.gasLimit),
        gasPrice: BigInt(GAS_PRICE),
        chainID: network.chainId,
        sender: new Address(address),
        version: 2
      });

      console.log('📝 Sending transaction...');

      const sessionId = await signAndSendTransactions({
        transactions: [swapTransaction],
        transactionsDisplayInfo: SWAP_TX_INFO
      });

      return sessionId;
    } catch (error: any) {
      console.error('❌ Swap failed:', error);

      // Provide helpful error messages
      if (error.message?.includes('insufficient liquidity')) {
        throw new Error('Insufficient liquidity for this swap');
      } else if (error.message?.includes('pair not found')) {
        throw new Error(`No trading pair found for ${fromToken}/${toToken}`);
      } else {
        throw error;
      }
    }
  };

  return {
    executeSwap,
    getSwapQuote
  };
};
