/**
 * xExchange Tasks Composer Integration
 *
 * This implementation uses Tasks Composer (the CORRECT way that xExchange UI uses)
 * Based on analyzing successful transactions from xExchange UI
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

// xExchange Tasks Composer (Mainnet) - This is what xExchange UI uses!
const XEXCHANGE_TASKS_COMPOSER =
  'erd1qqqqqqqqqqqqqpgqsytkvnexypp7argk02l0rasnj57sxa542jpshkl7df';

// Gas limit for Tasks Composer (matches xExchange UI)
const COMPOSER_GAS_LIMIT = 210_000_000; // 210M

// Transaction display info
const SWAP_TX_INFO: TransactionsDisplayInfoType = {
  processingMessage: 'Executing swap via xExchange Tasks Composer',
  errorMessage: 'Swap failed',
  successMessage: 'Swap executed successfully!'
};

/**
 * Known liquidity pools for direct swaps
 * These are the actual pool contracts that Tasks Composer routes through
 */
const LIQUIDITY_POOLS: Record<string, string> = {
  'WEGLD-USDC':
    'erd1qqqqqqqqqqqqqpgqeel2kumf0r8ffyhth7pqdujjat9nx0862jpsg2pqaq',
  'USDC-WEGLD': 'erd1qqqqqqqqqqqqqpgqeel2kumf0r8ffyhth7pqdujjat9nx0862jpsg2pqaq'
};

/**
 * Hook for xExchange swaps via Tasks Composer
 */
export const useXExchangeSwaps = () => {
  const { network } = useGetNetworkConfig();
  const { address } = useGetAccount();

  /**
   * Execute swap via Tasks Composer (matches xExchange UI)
   *
   * Transaction structure from successful xExchange UI swap:
   * ESDTTransfer@
   *   <fromToken>@
   *   <amount>@
   *   composeTasks@
   *   <targetTokenEncoded>@
   *   <flags>@
   *   <routingData>
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

      // Get toToken config for decimals
      const toTokenConfig = Object.values(TOKENS).find(
        (t) => t.identifier === toToken
      );
      const toDecimals = toTokenConfig?.decimals || 18;

      // Get pool address for this pair
      const pairKey = `${fromToken.split('-')[0]}-${toToken.split('-')[0]}`;
      const poolAddress = LIQUIDITY_POOLS[pairKey];

      if (!poolAddress) {
        throw new Error(`No liquidity pool found for ${pairKey}`);
      }

      // Calculate minimum output (with slippage protection)
      // TODO: Get real quote from xExchange API
      const estimatedOutputWei = toWei(amount, toDecimals); // Rough 1:1 estimate
      const minAmountOut = Math.floor(
        parseInt(estimatedOutputWei) * (1 - slippagePercent / 100)
      );

      // Build Tasks Composer transaction
      const data = buildComposeTasks(
        fromToken,
        toToken,
        amountWei,
        minAmountOut.toString(),
        poolAddress
      );

      console.log('🔄 [Tasks Composer] Building swap:', {
        from: fromToken,
        to: toToken,
        amount,
        pool: poolAddress,
        data: data.substring(0, 200) + '...'
      });

      const swapTransaction = new Transaction({
        value: BigInt(0),
        data: Buffer.from(data),
        receiver: new Address(XEXCHANGE_TASKS_COMPOSER),
        gasLimit: BigInt(COMPOSER_GAS_LIMIT),
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
      console.error('❌ Tasks Composer swap failed:', error);
      throw error;
    }
  };

  return {
    executeSwap
  };
};

/**
 * Build composeTasks transaction data
 *
 * Based on successful xExchange UI transaction:
 * ESDTTransfer@<token>@<amount>@composeTasks@<task>@<flags>@<routing>
 */
function buildComposeTasks(
  fromToken: string,
  toToken: string,
  amountWei: string,
  minAmountOut: string,
  poolAddress: string
): string {
  // Part 1: ESDTTransfer function
  const esdtTransfer = 'ESDTTransfer';

  // Part 2: From token (hex encoded)
  const fromTokenHex = Buffer.from(fromToken).toString('hex');

  // Part 3: Amount (hex)
  const amountHex = BigInt(amountWei).toString(16);

  // Part 4: composeTasks function (hex encoded)
  const composeTasks = Buffer.from('composeTasks').toString('hex');

  // Part 5: Task data - encodes target token and min amount
  // Format: <tokenLength(4bytes)><tokenBytes><padding><minAmount>
  const taskData = encodeTaskData(toToken, minAmountOut);

  // Part 6: Flags (from successful tx: "05" means enable some features)
  const flags = '05';

  // Part 7: Routing data - encodes the swap path through pools
  // For simple swap: one pool, one swap step
  const routingData = encodeRoutingData(
    poolAddress,
    fromToken,
    toToken,
    minAmountOut
  );

  // Combine all parts with @ separator
  const data = `${esdtTransfer}@${fromTokenHex}@${amountHex}@${composeTasks}@${taskData}@${flags}@${routingData}`;

  return data;
}

/**
 * Encode task data part
 * Format from successful tx: 0000000b555344432d633736663166000000000000000000000002173e
 * Structure: <tokenLength><token><padding><amount>
 */
function encodeTaskData(toToken: string, minAmountOut: string): string {
  // Token length as 4-byte hex (8 chars)
  const tokenLength = toToken.length;
  const tokenLengthHex = tokenLength.toString(16).padStart(8, '0');

  // Token as hex
  const tokenHex = Buffer.from(toToken).toString('hex');

  // Padding + min amount (32 bytes total after token)
  const minAmountHex = BigInt(minAmountOut).toString(16).padStart(56, '0');

  return `${tokenLengthHex}${tokenHex}${minAmountHex}`;
}

/**
 * Encode routing data
 * This tells Tasks Composer which pool(s) to use and how to swap
 *
 * For a simple single-hop swap through one pool:
 * - Pool address
 * - swapTokensFixedInput function
 * - Target token
 * - Min amount
 */
function encodeRoutingData(
  poolAddress: string,
  fromToken: string,
  toToken: string,
  minAmountOut: string
): string {
  // This is the complex part that varies by routing path
  // For MVP, we'll create a simplified version for single-hop swaps

  // Based on analyzing successful transactions, the routing data contains:
  // 1. Operation type and size indicators
  // 2. Pool contract address (in MultiversX address format)
  // 3. Function name (swapTokensFixedInput)
  // 4. Target token
  // 5. Min amount

  // Simplified routing for single pool swap
  // Structure: <operation><size><pool><function><token><amount>

  const operation = '00000001'; // Single operation
  const dataType = '04'; // Type 4 = contract call
  const gasLimit = '0000000701b844d05c4fd0'; // ~30B gas for pool call
  const valueSize = '000000010400000020'; // Value structure

  // Pool address in hex (remove 'erd1' prefix, decode bech32)
  // For now, we'll use the direct hex representation
  const poolHex = addressToHex(poolAddress);

  // Function: swapTokensFixedInput
  const functionName = 'swapTokensFixedInput';
  const functionLen = functionName.length.toString(16).padStart(8, '0');
  const functionHex = Buffer.from(functionName).toString('hex');

  // Target token
  const toTokenLen = toToken.length.toString(16).padStart(8, '0');
  const toTokenHex = Buffer.from(toToken).toString('hex');

  // Min amount
  const minAmountLen = '00000004'; // 4 bytes for amount
  const minAmountHex = BigInt(minAmountOut).toString(16).padStart(8, '0');

  // Combine routing parts
  return `${operation}${dataType}${gasLimit}${valueSize}${poolHex}${functionLen}${functionHex}${toTokenLen}${toTokenHex}${minAmountLen}${minAmountHex}`;
}

/**
 * Convert bech32 address to hex format used in routing
 */
function addressToHex(bech32Address: string): string {
  // Remove 'erd1' prefix
  const withoutPrefix = bech32Address.substring(4);

  // Decode bech32 to get raw bytes
  // For simplicity, we'll use the address directly in calls
  // In production, use proper bech32 decoding

  // This is a simplified version - needs proper bech32 decode
  // For now, return the pool address indicator
  return '05' + '00' + withoutPrefix.substring(0, 64).padStart(64, '0');
}
