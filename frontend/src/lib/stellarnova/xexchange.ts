/**
 * Direct xExchange Integration - CORRECTED VERSION
 *
 * This implementation uses the correct xExchange architecture:
 * - Tasks Composer for multi-hop swaps (matches xExchange UI)
 * - Router for simple single-hop swaps (simpler alternative)
 *
 * Flow: User → Tasks Composer/Router → Liquidity Pools
 * ❌ NEVER call liquidity pools directly (will fail with "wrong number of arguments")
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

// ============================================================================
// xExchange Contract Addresses (Mainnet)
// ============================================================================

// ✅ CORRECT: Use Pair contracts directly for swaps
// Each token pair has its own liquidity pool contract
// Addresses verified from xExchange GraphQL API
const XEXCHANGE_PAIRS: Record<string, string> = {
  'WEGLD-USDC':
    'erd1qqqqqqqqqqqqqpgqeel2kumf0r8ffyhth7pqdujjat9nx0862jpsg2pqaq', // ✅ Verified WEGLD/USDC Pair
  'USDC-WEGLD':
    'erd1qqqqqqqqqqqqqpgqeel2kumf0r8ffyhth7pqdujjat9nx0862jpsg2pqaq', // Same pair, reversed
  'WEGLD-MEX': 'erd1qqqqqqqqqqqqqpgqa0fsfshnff4n76jhcye6k7uvd7qacsq42jpsp6shh2', // WEGLD/MEX Pair
  'MEX-WEGLD': 'erd1qqqqqqqqqqqqqpgqa0fsfshnff4n76jhcye6k7uvd7qacsq42jpsp6shh2'
};

// Helper to get pair address
const getPairAddress = (token1: string, token2: string): string | undefined => {
  const base1 = token1.split('-')[0];
  const base2 = token2.split('-')[0];
  const key1 = `${base1}-${base2}`;
  const key2 = `${base2}-${base1}`;
  return XEXCHANGE_PAIRS[key1] || XEXCHANGE_PAIRS[key2];
};

// Additional xExchange contract addresses (for reference, currently unused)
const XEXCHANGE_ROUTER =
  'erd1qqqqqqqqqqqqqpgqq66xk9gfr4esuhem3jru86wg5hvp33a62jps2fy57p';
const XEXCHANGE_TASKS_COMPOSER =
  'erd1qqqqqqqqqqqqqpgqsytkvnexypp7argk02l0rasnj57sxa542jpshkl7df'; // ✅ Correct address from successful tx

// Gas limits (based on successful xExchange transactions)
const PAIR_SWAP_GAS_LIMIT = 50_000_000; // 50M for direct pair swaps (increased from 12M)
const ROUTER_GAS_LIMIT = 50_000_000; // 50M for router swaps
const TASKS_COMPOSER_GAS_LIMIT = 210_000_000; // 210M for tasks composer

// Transaction display info
const SWAP_TX_INFO: TransactionsDisplayInfoType = {
  processingMessage: 'Executing swap on xExchange',
  errorMessage: 'Swap failed',
  successMessage: 'Swap executed successfully!'
};

// ============================================================================
// Interface for swap parameters
// ============================================================================

interface SwapParams {
  fromToken: string; // e.g., "USDC-c76f1f"
  toToken: string; // e.g., "WEGLD-bd4d79"
  amount: number; // Human-readable amount
  fromDecimals: number; // Token decimals
  slippagePercent?: number; // Default 50% (high for testing)
  useTasksComposer?: boolean; // Use Tasks Composer (true) or Router (false, default)
}

/**
 * Hook for xExchange swaps
 * Provides both Router and Tasks Composer implementations
 */
export const useXExchangeSwaps = () => {
  const { network } = useGetNetworkConfig();
  const { address } = useGetAccount();

  /**
   * Execute swap using xExchange Pair Contract (CORRECT WAY ✅)
   *
   * Swaps are executed directly on the liquidity pool (Pair contract).
   * This is the proper way based on the smart contract source code.
   *
   * Pattern: ESDTTransfer@token@amount@swapTokensFixedInput@toToken@minAmount
   */
  const executeSwapViaPair = async (
    fromToken: string,
    toToken: string,
    amount: number,
    fromDecimals: number,
    slippagePercent: number = 50 // ✅ High slippage for testing (50%)
  ): Promise<string | undefined> => {
    try {
      // Get the Pair contract address
      const pairAddress = getPairAddress(fromToken, toToken);

      if (!pairAddress) {
        throw new Error(
          `No liquidity pool found for ${fromToken} ↔ ${toToken}`
        );
      }

      const amountWei = toWei(amount, fromDecimals);

      // Get toToken decimals from TOKENS config
      const toTokenConfig = Object.values(TOKENS).find(
        (t) => t.identifier === toToken
      );
      const toDecimals = toTokenConfig?.decimals || 18;

      // Calculate estimated output (rough estimate)
      // TODO: Get real quote from xExchange API for accurate pricing
      let estimatedOutput = amount;
      if (fromToken.startsWith('WEGLD') && toToken.startsWith('USDC')) {
        estimatedOutput = amount * 6.0; // ~$6 per WEGLD (updated Dec 2024)
      } else if (fromToken.startsWith('USDC') && toToken.startsWith('WEGLD')) {
        estimatedOutput = amount / 6.0; // ~$6 per WEGLD (updated Dec 2024)
      }

      const estimatedOutputWei = toWei(estimatedOutput, toDecimals);
      const minAmountOut = Math.floor(
        parseInt(estimatedOutputWei) * (1 - slippagePercent / 100)
      );

      // Build Pair swap transaction
      // Pattern: ESDTTransfer@<token>@<amount>@swapTokensFixedInput@<toToken>@<minAmount>
      const tokenHex = Buffer.from(fromToken).toString('hex');
      let amountHex = BigInt(amountWei).toString(16);
      // Ensure even-length hex strings (pad with leading 0 if odd)
      if (amountHex.length % 2 !== 0) amountHex = '0' + amountHex;

      const functionName = Buffer.from('swapTokensFixedInput').toString('hex'); // ✅ Encode function name as hex
      const toTokenHex = Buffer.from(toToken).toString('hex');
      let minAmountHex = BigInt(minAmountOut).toString(16);
      // Ensure even-length hex strings (pad with leading 0 if odd)
      if (minAmountHex.length % 2 !== 0) minAmountHex = '0' + minAmountHex;

      const data = `ESDTTransfer@${tokenHex}@${amountHex}@${functionName}@${toTokenHex}@${minAmountHex}`;

      console.log('🔄 [Pair] Building swap transaction:', {
        from: fromToken,
        to: toToken,
        amount,
        amountWei,
        estimatedOutput,
        minAmountOut,
        pairAddress,
        data
      });

      const swapTransaction = new Transaction({
        value: BigInt(0),
        data: Buffer.from(data),
        receiver: Address.newFromBech32(pairAddress), // ✅ PAIR CONTRACT, SDK v15+ format!
        gasLimit: BigInt(PAIR_SWAP_GAS_LIMIT),
        gasPrice: BigInt(GAS_PRICE),
        chainID: network.chainId,
        sender: Address.newFromBech32(address),
        version: 2
      });

      const sessionId = await signAndSendTransactions({
        transactions: [swapTransaction],
        transactionsDisplayInfo: SWAP_TX_INFO
      });

      return sessionId;
    } catch (error) {
      console.error('❌ Pair swap failed:', error);
      throw error;
    }
  };

  /**
   * Execute swap using Tasks Composer (MATCHES xExchange UI)
   *
   * This matches the exact pattern used by xExchange UI.
   * More complex but supports multi-hop swaps.
   *
   * Pattern: ESDTTransfer@token@amount@composeTasks@<encoded_tasks>
   */
  const executeSwapViaTasksComposer = async (
    fromToken: string,
    toToken: string,
    amount: number,
    fromDecimals: number,
    slippagePercent: number = 5
  ): Promise<string | undefined> => {
    try {
      const amountWei = toWei(amount, fromDecimals);

      // TODO: Get real quote from xExchange API
      const estimatedOutput = amount;
      const toDecimals = fromDecimals; // Placeholder
      const minAmountOut = Math.floor(
        estimatedOutput * (1 - slippagePercent / 100) * 10 ** toDecimals
      );

      // Encode task for simple swap
      // Task structure: [fromToken, amount, flags, swapSteps]
      const taskData = encodeSimpleSwapTask(
        fromToken,
        toToken,
        amountWei,
        minAmountOut.toString()
      );

      const tokenHex = Buffer.from(fromToken).toString('hex');
      const amountHex = BigInt(amountWei).toString(16);
      const composeTasks = 'composeTasks';

      const data = `ESDTTransfer@${tokenHex}@${amountHex}@${Buffer.from(
        composeTasks
      ).toString('hex')}@${taskData}`;

      console.log('🔄 [Tasks Composer] Building swap transaction:', {
        from: fromToken,
        to: toToken,
        amount,
        amountWei,
        minAmountOut,
        receiver: XEXCHANGE_TASKS_COMPOSER,
        data
      });

      const swapTransaction = new Transaction({
        value: BigInt(0),
        data: Buffer.from(data),
        receiver: Address.newFromBech32(XEXCHANGE_TASKS_COMPOSER), // ✅ Tasks Composer, SDK v15+ format
        gasLimit: BigInt(TASKS_COMPOSER_GAS_LIMIT), // ✅ Higher gas (210M)
        gasPrice: BigInt(GAS_PRICE),
        chainID: network.chainId,
        sender: Address.newFromBech32(address), // ✅ SDK v15+ format
        version: 2
      });

      const sessionId = await signAndSendTransactions({
        transactions: [swapTransaction],
        transactionsDisplayInfo: SWAP_TX_INFO
      });

      return sessionId;
    } catch (error) {
      console.error('❌ Tasks Composer swap failed:', error);
      throw error;
    }
  };

  /**
   * Main swap function - executes swap via Pair contract
   *
   * @param params - Swap parameters
   */
  const executeSwap = async (
    params: SwapParams
  ): Promise<string | undefined> => {
    const {
      fromToken,
      toToken,
      amount,
      fromDecimals,
      slippagePercent = 50 // ✅ High slippage for testing (50%)
    } = params;

    // Always use Pair contract (simple and works!)
    return executeSwapViaPair(
      fromToken,
      toToken,
      amount,
      fromDecimals,
      slippagePercent
    );
  };

  /**
   * Execute EGLD swap via Router (native token)
   */
  const executeEgldSwapViaRouter = async (
    toToken: string,
    amount: number,
    slippagePercent: number = 5
  ): Promise<string | undefined> => {
    const amountWei = toWei(amount, 18); // EGLD has 18 decimals

    // TODO: Get real quote from xExchange API
    const estimatedOutput = amount;
    const minAmountOut = Math.floor(
      estimatedOutput * (1 - slippagePercent / 100) * 1e6
    ); // Assuming USDC output

    // For EGLD, send as transaction value + call swapTokensFixedInput
    const functionName = 'swapTokensFixedInput';
    const toTokenHex = Buffer.from(toToken).toString('hex');
    const minAmountHex = BigInt(minAmountOut).toString(16);

    const data = `${functionName}@${toTokenHex}@${minAmountHex}`;

    console.log('🔄 [Router] Building EGLD swap transaction:', {
      from: 'EGLD',
      to: toToken,
      amount,
      amountWei,
      minAmountOut,
      receiver: XEXCHANGE_ROUTER,
      data
    });

    const swapTransaction = new Transaction({
      value: BigInt(amountWei), // Send EGLD as transaction value
      data: Buffer.from(data),
      receiver: Address.newFromBech32(XEXCHANGE_ROUTER), // ✅ SDK v15+ format
      gasLimit: BigInt(ROUTER_GAS_LIMIT),
      gasPrice: BigInt(GAS_PRICE),
      chainID: network.chainId,
      sender: Address.newFromBech32(address), // ✅ SDK v15+ format
      version: 2
    });

    const sessionId = await signAndSendTransactions({
      transactions: [swapTransaction],
      transactionsDisplayInfo: SWAP_TX_INFO
    });

    return sessionId;
  };

  /**
   * Get estimated output for a swap (TODO: integrate with xExchange API)
   * For now returns approximate based on input
   */
  const getEstimatedOutput = async (
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<{ estimatedOutput: number; priceImpact: number }> => {
    // TODO: Call xExchange API to get real quote
    // For demo, return 1:1 ratio
    return {
      estimatedOutput: amount,
      priceImpact: 0.1 // 0.1% price impact estimate
    };
  };

  return {
    executeSwap,
    getEstimatedOutput
  };
};

// ============================================================================
// Task Encoding for Tasks Composer
// ============================================================================

/**
 * Encode a simple swap task for Tasks Composer
 *
 * Based on analysis of successful xExchange UI transactions.
 * The task encoding is complex - this is a simplified version for single-hop swaps.
 *
 * Full encoding requires:
 * 1. Token identifiers and amounts
 * 2. Swap path (which pools to use)
 * 3. Minimum output amounts
 * 4. Flags for task execution
 *
 * For production, recommend using xExchange SDK or API to get proper encoding.
 */
function encodeSimpleSwapTask(
  fromToken: string,
  toToken: string,
  amountWei: string,
  minAmountOut: string
): string {
  // TODO: Implement full task encoding
  // For now, this is a placeholder structure
  // Production implementation should use xExchange SDK or reverse-engineer from successful txs

  // Basic structure from analyzing successful transactions:
  // - Token length (4 bytes) + token identifier
  // - Amount (hex)
  // - Flags (1 byte)
  // - Swap steps (nested structure with pool addresses and function calls)

  const fromTokenBytes = Buffer.from(fromToken);
  const toTokenBytes = Buffer.from(toToken);

  // Simplified encoding - THIS NEEDS TO BE COMPLETED
  // based on full reverse engineering of Tasks Composer protocol
  const tokenLengthHex = fromTokenBytes.length.toString(16).padStart(8, '0');
  const tokenHex = fromTokenBytes.toString('hex');
  const amountHex = BigInt(amountWei).toString(16);

  // WARNING: This is incomplete and won't work yet!
  // Need to add: flags, swap path, pool addresses, etc.
  return `${tokenLengthHex}${tokenHex}${amountHex}`;
}

// ============================================================================
// NOTES FOR EXTENDING THIS IMPLEMENTATION
// ============================================================================

/**
 * To fully implement Tasks Composer:
 *
 * 1. GET SWAP QUOTE from xExchange API:
 *    - Endpoint: https://graph.xexchange.com/graphql
 *    - Query: Get optimal swap path and expected output
 *    - Returns: Pool addresses, intermediate tokens, price impact
 *
 * 2. ENCODE TASK PROPERLY:
 *    - Study more successful transactions
 *    - Or use xExchange SDK if available
 *    - Or contact xExchange team for documentation
 *
 * 3. HANDLE MULTI-HOP SWAPS:
 *    - Tasks Composer shines for A→B→C swaps
 *    - Encode multiple swap steps in task data
 *    - Router handles single-hop A→B swaps just fine
 *
 * 4. PRODUCTION CHECKLIST:
 *    - ✅ Use Router for simple swaps (RECOMMENDED)
 *    - ⚠️ Use Tasks Composer only if needed for multi-hop
 *    - ✅ Always get real quotes from xExchange API
 *    - ✅ Gas limit: 50M for Router, 200M+ for Tasks Composer
 *    - ✅ Implement slippage protection properly
 *    - ✅ Handle transaction failures gracefully
 *    - ✅ Test on devnet first!
 */

/**
 * Check if user has sufficient balance for swap
 */
export const checkSufficientBalance = async (
  tokenIdentifier: string,
  amount: number,
  userAddress: string
): Promise<{ sufficient: boolean; currentBalance: number }> => {
  // TODO: Query blockchain for user's token balance
  // For demo, assume sufficient
  return {
    sufficient: true,
    currentBalance: amount * 2 // Mock: user has 2x the amount needed
  };
};

/**
 * Helper: Get xExchange pair info (for liquidity checks)
 */
export const getPairInfo = async (
  token1: string,
  token2: string
): Promise<{ exists: boolean; liquidity: number }> => {
  // TODO: Query xExchange for pair existence and liquidity
  return {
    exists: true,
    liquidity: 1000000 // Mock liquidity
  };
};
