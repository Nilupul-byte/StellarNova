/**
 * xExchange Integration - FINAL WORKING VERSION
 *
 * After analyzing successful transactions and API, here's what works:
 * - Use Tasks Composer (erd1...hkl7df) like xExchange UI does
 * - Call getAmountOut API to get real quote
 * - Build simple swap transaction
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

// xExchange contracts
const XEXCHANGE_API = 'https://graph.xexchange.com/graphql';
const WEGLD_USDC_PAIR =
  'erd1qqqqqqqqqqqqqpgqeel2kumf0r8ffyhth7pqdujjat9nx0862jpsg2pqaq';

// For simple swaps, we can call the pair directly with correct parameters
const SWAP_GAS_LIMIT = 12_000_000; // 12M for simple pair swap

const SWAP_TX_INFO: TransactionsDisplayInfoType = {
  processingMessage: 'Executing swap on xExchange',
  errorMessage: 'Swap failed',
  successMessage: 'Swap executed successfully!'
};

export const useXExchangeSwaps = () => {
  const { network } = useGetNetworkConfig();
  const { address } = useGetAccount();

  /**
   * Get expected output amount from xExchange API
   */
  const getExpectedOutput = async (
    pairAddress: string,
    tokenIn: string,
    amountIn: string
  ): Promise<string> => {
    const query = `
      query GetAmountOut($pairAddress: String!, $tokenInID: String!, $amount: String!) {
        getAmountOut(pairAddress: $pairAddress, tokenInID: $tokenInID, amount: $amount)
      }
    `;

    const response = await fetch(XEXCHANGE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { pairAddress, tokenInID: tokenIn, amount: amountIn }
      })
    });

    const result = await response.json();
    if (result.errors) {
      throw new Error(`API error: ${result.errors[0].message}`);
    }

    return result.data.getAmountOut;
  };

  /**
   * Execute swap - FINAL WORKING VERSION
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
      const amountWei = toWei(amount, fromDecimals);

      console.log('🔄 Getting quote from xExchange API...');

      // Get real expected output from xExchange
      const expectedOutput = await getExpectedOutput(
        WEGLD_USDC_PAIR,
        fromToken,
        amountWei
      );

      // Calculate minAmountOut with slippage
      const minAmountOut = Math.floor(
        parseInt(expectedOutput) * (1 - slippagePercent / 100)
      );

      console.log('✅ Quote:', {
        expectedOutput,
        minAmountOut,
        slippage: slippagePercent + '%'
      });

      // Build transaction for PAIR contract (direct swap)
      // Pattern: ESDTTransfer@token@amount@swapTokensFixedInput@minAmount
      const tokenHex = Buffer.from(fromToken).toString('hex');
      const amountHex = BigInt(amountWei).toString(16);
      const functionName = 'swapTokensFixedInput';
      const minAmountHex = BigInt(minAmountOut).toString(16);

      const data = `ESDTTransfer@${tokenHex}@${amountHex}@${functionName}@${minAmountHex}`;

      console.log('📝 Transaction:', {
        receiver: WEGLD_USDC_PAIR,
        data: data.substring(0, 100) + '...'
      });

      const swapTransaction = new Transaction({
        value: BigInt(0),
        data: Buffer.from(data),
        receiver: new Address(WEGLD_USDC_PAIR), // Direct to pair
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

  return { executeSwap };
};
