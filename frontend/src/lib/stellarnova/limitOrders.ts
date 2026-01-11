/**
 * StellarNova Limit Orders Integration
 *
 * Create limit orders that execute automatically when target price is met
 * JEXchange Architecture - Direct ESDT payment (no vault needed!)
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

// Contract address (mainnet) - JEXchange architecture with ASYNC callbacks (Jan 10, 2026 - v2)
// TX: 91a8e0b9ebae7887c67723d8b82e008fd2f9338c8e0880111003228984acce3a
const STELLARNOVA_CONTRACT =
  'erd1qqqqqqqqqqqqqpgqhcmms89zn6997pvpv9g7ckpcxz4mnjn088zqtvnz29';

// Gas limit for limit order creation
const CREATE_LIMIT_ORDER_GAS = 20_000_000;

// Transaction display info
const LIMIT_ORDER_TX_INFO: TransactionsDisplayInfoType = {
  processingMessage: 'Creating limit order',
  errorMessage: 'Failed to create limit order',
  successMessage: 'Limit order created successfully!'
};

// ============================================================================
// Interface for limit order parameters
// ============================================================================

interface LimitOrderParams {
  fromToken: string; // e.g., "USDC-c76f1f"
  fromAmount: number; // Human-readable amount
  fromDecimals: number; // Token decimals
  toToken: string; // e.g., "WEGLD-bd4d79"
  targetPriceNum: number; // Price numerator (e.g., 50 USDC)
  targetPriceDenom: number; // Price denominator (e.g., 1 WEGLD)
  slippageBp?: number; // Basis points (default 500 = 5%)
  durationSeconds?: number; // Order validity (default 86400 = 24 hours)
}

/**
 * Hook for limit order operations (JEXchange architecture)
 */
export const useLimitOrders = () => {
  const { network } = useGetNetworkConfig();
  const { address } = useGetAccount();

  /**
   * Create a limit order (JEXchange architecture - direct ESDT payment)
   *
   * @param params - Limit order parameters
   * @returns Session ID for tracking transaction
   */
  const createLimitOrder = async (
    params: LimitOrderParams
  ): Promise<string | undefined> => {
    try {
      const {
        fromToken,
        fromAmount,
        fromDecimals,
        toToken,
        targetPriceNum,
        targetPriceDenom,
        slippageBp = 500, // Default 5% slippage
        durationSeconds = 86400 // Default 24 hours
      } = params;

      // Convert amount to wei
      const amountWei = toWei(fromAmount, fromDecimals);

      // Build transaction data - JEXchange pattern
      // Format: ESDTTransfer@<token>@<amount>@createLimitOrder@<toToken>@<priceNum>@<priceDenom>@<slippage>@<duration>

      const fromTokenHex = Buffer.from(fromToken).toString('hex');
      let amountHex = BigInt(amountWei).toString(16);
      if (amountHex.length % 2 !== 0) amountHex = '0' + amountHex; // Ensure even length

      const createLimitOrderHex =
        Buffer.from('createLimitOrder').toString('hex');
      const toTokenHex = Buffer.from(toToken).toString('hex');

      let priceNumHex = targetPriceNum.toString(16);
      if (priceNumHex.length % 2 !== 0) priceNumHex = '0' + priceNumHex;

      let priceDenomHex = targetPriceDenom.toString(16);
      if (priceDenomHex.length % 2 !== 0) priceDenomHex = '0' + priceDenomHex;

      let slippageHex = slippageBp.toString(16);
      if (slippageHex.length % 2 !== 0) slippageHex = '0' + slippageHex;

      let durationHex = durationSeconds.toString(16);
      if (durationHex.length % 2 !== 0) durationHex = '0' + durationHex;

      const data = `ESDTTransfer@${fromTokenHex}@${amountHex}@${createLimitOrderHex}@${toTokenHex}@${priceNumHex}@${priceDenomHex}@${slippageHex}@${durationHex}`;

      console.log('📋 Creating limit order (JEXchange pattern):', {
        fromToken,
        fromAmount,
        toToken,
        targetPrice: `${targetPriceNum}/${targetPriceDenom}`,
        slippageBp,
        durationSeconds,
        contract: STELLARNOVA_CONTRACT,
        data
      });

      // Build transaction
      const transaction = new Transaction({
        value: BigInt(0), // No EGLD (sending ESDT with payment)
        data: Buffer.from(data),
        receiver: Address.newFromBech32(STELLARNOVA_CONTRACT),
        gasLimit: BigInt(CREATE_LIMIT_ORDER_GAS),
        gasPrice: BigInt(GAS_PRICE),
        chainID: network.chainId,
        sender: Address.newFromBech32(address),
        version: 2
      });

      // Sign and send
      const sessionId = await signAndSendTransactions({
        transactions: [transaction],
        transactionsDisplayInfo: LIMIT_ORDER_TX_INFO
      });

      console.log('✅ Limit order transaction submitted:', sessionId);

      return sessionId;
    } catch (error) {
      console.error('❌ Failed to create limit order:', error);
      throw error;
    }
  };

  /**
   * Cancel a limit order
   *
   * @param orderId - ID of the order to cancel
   * @returns Session ID for tracking transaction
   */
  const cancelLimitOrder = async (
    orderId: number
  ): Promise<string | undefined> => {
    try {
      console.log('🗑️ Cancelling limit order:', orderId);

      // Build transaction data: cancelLimitOrder@<orderId>
      let orderIdHex = orderId.toString(16);
      if (orderIdHex.length % 2 !== 0) orderIdHex = '0' + orderIdHex;

      const data = `cancelLimitOrder@${orderIdHex}`;

      // Build transaction
      const transaction = new Transaction({
        value: BigInt(0),
        data: Buffer.from(data),
        receiver: Address.newFromBech32(STELLARNOVA_CONTRACT),
        gasLimit: BigInt(10_000_000), // 10M gas for cancel
        gasPrice: BigInt(GAS_PRICE),
        chainID: network.chainId,
        sender: Address.newFromBech32(address),
        version: 2
      });

      // Sign and send
      const sessionId = await signAndSendTransactions({
        transactions: [transaction],
        transactionsDisplayInfo: {
          processingMessage: 'Cancelling order',
          errorMessage: 'Failed to cancel order',
          successMessage: 'Order cancelled successfully!'
        }
      });

      console.log('✅ Cancel order transaction submitted:', sessionId);

      return sessionId;
    } catch (error) {
      console.error('❌ Failed to cancel order:', error);
      throw error;
    }
  };

  return {
    createLimitOrder,
    cancelLimitOrder,
    // Deprecated - JEXchange uses direct ESDT payment
    depositToVault: async () => {
      throw new Error('Vault not used in JEXchange architecture');
    }
  };
};

/**
 * @deprecated Vault not used in JEXchange architecture
 */
export const getUserVaultBalance = async (
  _userAddress: string,
  _token: string
): Promise<string> => {
  console.warn(
    'getUserVaultBalance is deprecated - JEXchange uses direct ESDT payment'
  );
  return '0';
};

/**
 * @deprecated Use transaction status polling from SDK
 */
export const waitForTransaction = async (
  _txHash: string,
  _maxAttempts: number = 30
): Promise<boolean> => {
  console.warn(
    'waitForTransaction is deprecated - use SDK transaction polling'
  );
  return false;
};

/**
 * Get current price from xExchange API
 *
 * @param fromToken - Token selling (e.g., "USDC-c76f1f")
 * @param toToken - Token buying (e.g., "WEGLD-bd4d79")
 * @returns Current price as { price, priceInverted }
 */
export const getCurrentPriceFromXExchange = async (
  fromToken: string,
  toToken: string
): Promise<{ price: number; priceInverted: number } | null> => {
  try {
    // xExchange GraphQL API - Get all pairs and filter client-side
    const query = `
      query GetPairs {
        pairs(offset: 0, limit: 100) {
          address
          firstToken {
            identifier
            decimals
          }
          secondToken {
            identifier
            decimals
          }
          info {
            reserves0
            reserves1
          }
        }
      }
    `;

    console.log('📡 Fetching price from xExchange for:', {
      fromToken,
      toToken
    });

    const response = await fetch('https://graph.xexchange.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`xExchange API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      throw new Error('GraphQL query failed');
    }

    const pairs = data.data?.pairs || [];

    // Find matching pair
    const pair = pairs.find(
      (p: any) =>
        (p.firstToken.identifier === fromToken &&
          p.secondToken.identifier === toToken) ||
        (p.firstToken.identifier === toToken &&
          p.secondToken.identifier === fromToken)
    );

    if (!pair) {
      console.warn('⚠️ No matching pair found for:', { fromToken, toToken });
      return null;
    }

    // Calculate price from reserves
    const reserve0 = parseFloat(pair.info.reserves0);
    const reserve1 = parseFloat(pair.info.reserves1);
    const decimals0 = pair.firstToken.decimals;
    const decimals1 = pair.secondToken.decimals;

    // Adjust for decimals
    const adjustedReserve0 = reserve0 / Math.pow(10, decimals0);
    const adjustedReserve1 = reserve1 / Math.pow(10, decimals1);

    let price: number;

    if (pair.firstToken.identifier === fromToken) {
      // fromToken is token0, toToken is token1
      // price = how much token1 per 1 token0
      price = adjustedReserve1 / adjustedReserve0;
    } else {
      // fromToken is token1, toToken is token0
      // price = how much token0 per 1 token1
      price = adjustedReserve0 / adjustedReserve1;
    }

    console.log('📊 Current price from xExchange:', {
      pair: `${fromToken}/${toToken}`,
      price,
      reserves: { reserve0: adjustedReserve0, reserve1: adjustedReserve1 }
    });

    return {
      price,
      priceInverted: 1 / price
    };
  } catch (error) {
    console.error('❌ Failed to fetch price from xExchange:', error);
    return null;
  }
};

/**
 * Calculate target price for "2% lower" limit order
 *
 * @param currentPrice - Current market price
 * @param percentLower - Percentage lower (default 2%)
 * @returns Target price parameters { numerator, denominator }
 */
export const calculateTargetPrice = (
  currentPrice: number,
  percentLower: number = 2
): { numerator: number; denominator: number } => {
  // Calculate target price (2% lower)
  const targetPrice = currentPrice * (1 - percentLower / 100);

  // Convert to fraction (numerator/denominator)
  // For simplicity, multiply by 1000 to avoid decimals
  const numerator = Math.floor(targetPrice * 1000);
  const denominator = 1000;

  console.log('🎯 Target price calculation:', {
    currentPrice,
    percentLower,
    targetPrice,
    fraction: `${numerator}/${denominator}`
  });

  return {
    numerator,
    denominator
  };
};

/**
 * Calculate target price with proper decimal adjustment
 *
 * This fixes the decimal mismatch issue between tokens with different decimals
 * (e.g., USDC=6 decimals vs WEGLD=18 decimals)
 *
 * @param targetPrice - Target price (e.g., 6.457 USDC per WEGLD)
 * @param fromDecimals - From token decimals (e.g., 6 for USDC)
 * @param toDecimals - To token decimals (e.g., 18 for WEGLD)
 * @returns Price parameters { numerator, denominator } with proper scaling
 */
export const calculateTargetPriceWithDecimals = (
  targetPrice: number,
  fromDecimals: number,
  toDecimals: number
): { numerator: number; denominator: number } => {
  // JavaScript can only safely handle integers up to 2^53 ≈ 9×10^15
  // We need to ensure numerator stays within this range

  // Calculate decimal adjustment
  const decimalAdjustment = toDecimals - fromDecimals;

  // Choose PRECISION so that (PRECISION + |decimalAdjustment|) <= 15 (safe range)
  // This ensures we don't exceed JavaScript's integer precision
  const MAX_SAFE_EXPONENT = 15;
  const PRECISION = Math.min(
    6,
    MAX_SAFE_EXPONENT - Math.abs(decimalAdjustment)
  );
  const denominator = Math.pow(10, PRECISION);

  // Calculate numerator - stays within safe integer range
  const totalExponent = PRECISION + decimalAdjustment;
  const numerator = Math.floor(targetPrice * Math.pow(10, totalExponent));

  // Verify we're in safe range
  const isSafe =
    numerator <= Number.MAX_SAFE_INTEGER &&
    numerator >= Number.MIN_SAFE_INTEGER;

  console.log('🎯 Target price with decimal adjustment:', {
    targetPrice,
    fromDecimals,
    toDecimals,
    decimalAdjustment,
    precision: PRECISION,
    totalExponent,
    numerator,
    denominator,
    isSafe,
    maxSafeInteger: Number.MAX_SAFE_INTEGER
  });

  if (!isSafe) {
    console.warn(
      '⚠️ Numerator exceeds safe integer range - precision may be lost!'
    );
  }

  return {
    numerator,
    denominator
  };
};

/**
 * Interface for decoded limit order
 */
export interface LimitOrder {
  orderId: number;
  user: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  targetPriceNum: string;
  targetPriceDenom: string;
  slippageBp: number;
  expiresAt: Date;
  status: 'Pending' | 'Executed' | 'Cancelled' | 'Expired';
}

/**
 * Fetch user's pending limit orders from contract
 *
 * @param userAddress - User's wallet address
 * @returns Array of pending orders
 */
export const getUserPendingOrders = async (
  userAddress: string
): Promise<LimitOrder[]> => {
  try {
    console.log('📋 Fetching pending orders for:', userAddress);

    // Query contract via API
    const response = await fetch('https://api.multiversx.com/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        scAddress: STELLARNOVA_CONTRACT,
        funcName: 'getPendingOrders',
        args: []
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (
      data.returnCode !== 'ok' ||
      !data.returnData ||
      data.returnData.length === 0
    ) {
      console.log('No pending orders found');
      return [];
    }

    // Decode orders
    const orders: LimitOrder[] = [];

    for (const encodedOrder of data.returnData) {
      try {
        const buffer = Buffer.from(encodedOrder, 'base64');

        // Parse order struct (same as backend decoder)
        let offset = 0;

        // Order ID (8 bytes)
        const orderId = Number(buffer.readBigUInt64BE(offset));
        offset += 8;

        // User address (32 bytes)
        const userBytes = buffer.subarray(offset, offset + 32);
        const userHex = userBytes.toString('hex');
        const orderUserAddress = Address.newFromHex(userHex);
        const orderUser = orderUserAddress.toString(); // Get bech32 string
        offset += 32;

        // Skip if not user's order
        if (orderUser.toLowerCase() !== userAddress.toLowerCase()) {
          continue;
        }

        // From token (length + string)
        const fromTokenLen = buffer.readUInt32BE(offset);
        offset += 4;
        const fromToken = buffer
          .subarray(offset, offset + fromTokenLen)
          .toString();
        offset += fromTokenLen;

        // From amount (BigUint - length + value)
        const fromAmountLen = buffer.readUInt32BE(offset);
        offset += 4;
        const fromAmount = buffer
          .subarray(offset, offset + fromAmountLen)
          .toString('hex');
        offset += fromAmountLen;

        // To token (length + string)
        const toTokenLen = buffer.readUInt32BE(offset);
        offset += 4;
        const toToken = buffer.subarray(offset, offset + toTokenLen).toString();
        offset += toTokenLen;

        // Target price numerator (BigUint - length + value)
        const priceNumLen = buffer.readUInt32BE(offset);
        offset += 4;
        const targetPriceNum = buffer
          .subarray(offset, offset + priceNumLen)
          .toString('hex');
        offset += priceNumLen;

        // Target price denominator (BigUint - length + value)
        const priceDenomLen = buffer.readUInt32BE(offset);
        offset += 4;
        const targetPriceDenom = buffer
          .subarray(offset, offset + priceDenomLen)
          .toString('hex');
        offset += priceDenomLen;

        // Slippage BP (2 bytes)
        const slippageBp = buffer.readUInt16BE(offset);
        offset += 2;

        // Skip created_at (8 bytes)
        offset += 8;

        // Expires at (8 bytes)
        const expiresAtTimestamp = Number(buffer.readBigUInt64BE(offset));
        const expiresAt = new Date(expiresAtTimestamp * 1000);

        orders.push({
          orderId,
          user: orderUser,
          fromToken,
          toToken,
          fromAmount,
          targetPriceNum,
          targetPriceDenom,
          slippageBp,
          expiresAt,
          status: 'Pending'
        });
      } catch (err) {
        console.error('Failed to decode order:', err);
      }
    }

    console.log(`✅ Found ${orders.length} pending orders for user`);
    return orders;
  } catch (error) {
    console.error('❌ Failed to fetch pending orders:', error);
    return [];
  }
};
