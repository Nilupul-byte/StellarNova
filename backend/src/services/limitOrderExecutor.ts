import {
  Address,
  Transaction,
  TransactionComputer,
} from '@multiversx/sdk-core';
import { ApiNetworkProvider } from '@multiversx/sdk-network-providers';
import { UserSigner } from '@multiversx/sdk-wallet';
import { CONTRACT_ADDRESS, NETWORK_CONFIG, GAS_LIMITS } from '../config';
import fs from 'fs';
import path from 'path';

// xExchange GraphQL endpoint
const XEXCHANGE_GRAPHQL = 'https://graph.xexchange.com/graphql';

interface LimitOrder {
  order_id: number;
  user: string;
  from_token: string;
  from_amount: string;
  to_token: string;
  target_price_numerator: string;
  target_price_denominator: string;
  slippage_bp: number;
  created_at: number;
  expires_at: number;
  status: number; // 0=Pending, 1=Executed, 2=Cancelled, 3=Expired
}

interface TokenPairPrice {
  priceUSD: number;
  volumeUSD24h: number;
}

export class LimitOrderExecutor {
  private provider: ApiNetworkProvider;
  private signer: UserSigner | null = null;
  private executorAddress: ReturnType<UserSigner['getAddress']> | null = null;
  private isRunning = false;
  private checkInterval = 30000; // 30 seconds

  // Track recently attempted orders to prevent spam
  private attemptedOrders = new Map<number, number>(); // orderId -> timestamp of last attempt
  private cooldownPeriod = 300000; // 5 minutes cooldown between retry attempts

  // Token decimals map
  private TOKEN_DECIMALS: Record<string, number> = {
    'USDC-c76f1f': 6,
    'WEGLD-bd4d79': 18,
  };

  constructor() {
    this.provider = new ApiNetworkProvider(NETWORK_CONFIG.apiAddress);

    console.log('🔍 Limit Order Executor initialized');
    console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
  }

  /**
   * Get token decimals by identifier
   */
  private getTokenDecimals(tokenIdentifier: string): number {
    return this.TOKEN_DECIMALS[tokenIdentifier] || 18; // Default to 18 if unknown
  }

  /**
   * Initialize executor wallet from PEM file
   */
  async initializeExecutorWallet(pemPath: string): Promise<void> {
    try {
      const pemContent = fs.readFileSync(pemPath, 'utf8');
      this.signer = UserSigner.fromPem(pemContent);
      this.executorAddress = this.signer.getAddress();

      console.log(`✅ Executor wallet loaded:`);
      console.log(`   Address: ${this.executorAddress.bech32()}`);
    } catch (error: any) {
      console.error('❌ Failed to load executor wallet:', error.message);
      throw error;
    }
  }

  /**
   * Start monitoring and executing limit orders
   */
  async start(): Promise<void> {
    if (!this.signer || !this.executorAddress) {
      throw new Error('Executor wallet not initialized. Call initializeExecutorWallet() first.');
    }

    this.isRunning = true;
    console.log('🚀 Limit Order Executor started');
    console.log(`⏰ Checking every ${this.checkInterval / 1000} seconds\n`);

    // Run immediately, then on interval
    await this.checkAndExecuteOrders();
    setInterval(() => this.checkAndExecuteOrders(), this.checkInterval);
  }

  /**
   * Stop the executor
   */
  stop(): void {
    this.isRunning = false;
    console.log('⏸️  Limit Order Executor stopped');
  }

  /**
   * Main loop: Check pending orders and execute if price target met
   */
  private async checkAndExecuteOrders(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log(`[${new Date().toISOString()}] 🔍 Checking pending orders...`);

      // Get all pending orders from contract
      const pendingOrderIds = await this.getPendingOrders();

      if (pendingOrderIds.length === 0) {
        console.log('   No pending orders\n');
        return;
      }

      console.log(`   Found ${pendingOrderIds.length} pending order(s)`);

      // Check each order
      for (const orderId of pendingOrderIds) {
        try {
          await this.checkAndExecuteOrder(orderId);
        } catch (error: any) {
          console.error(`   ❌ Error processing order ${orderId}:`, error.message);
        }
      }

      console.log('');
    } catch (error: any) {
      console.error('❌ Error in main loop:', error.message);
    }
  }

  /**
   * Check a specific order and execute if price target met
   */
  private async checkAndExecuteOrder(orderId: number): Promise<void> {
    // Check if we recently attempted this order (cooldown period)
    const lastAttempt = this.attemptedOrders.get(orderId);
    const now = Date.now();

    if (lastAttempt && (now - lastAttempt) < this.cooldownPeriod) {
      const remainingSeconds = Math.ceil((this.cooldownPeriod - (now - lastAttempt)) / 1000);
      console.log(`   ⏸️  Order ${orderId}: On cooldown (${remainingSeconds}s remaining)`);
      return;
    }

    // Get order details
    const order = await this.getLimitOrder(orderId);

    if (!order) {
      console.log(`   ⚠️  Order ${orderId}: Not found`);
      // Remove from attempted orders if it doesn't exist anymore
      this.attemptedOrders.delete(orderId);
      return;
    }

    // Check if expired
    const nowSeconds = Math.floor(now / 1000);
    if (nowSeconds > order.expires_at) {
      console.log(`   ⏰ Order ${orderId}: Expired (will be cleaned up)`);
      this.attemptedOrders.delete(orderId);
      return;
    }

    // Get current price from xExchange
    const currentPrice = await this.getTokenPairPrice(order.from_token, order.to_token);

    if (!currentPrice) {
      console.log(`   ⚠️  Order ${orderId}: Could not fetch price`);
      return;
    }

    // Calculate target price and current price
    const targetPrice =
      parseFloat(order.target_price_numerator) / parseFloat(order.target_price_denominator);
    const pairPrice = currentPrice; // This is already the ratio

    console.log(`   📊 Order ${orderId}:`);
    console.log(`      ${order.from_token} → ${order.to_token}`);
    console.log(`      Target: ${targetPrice.toFixed(6)}`);
    console.log(`      Current: ${pairPrice.toFixed(6)}`);

    // Check if price condition met (current <= target for buy orders)
    if (pairPrice <= targetPrice) {
      console.log(`   ✅ Price target met! Executing order ${orderId}...`);

      // Mark as attempted BEFORE execution to prevent duplicate attempts
      this.attemptedOrders.set(orderId, now);

      try {
        // Get token decimals
        const fromDecimals = this.getTokenDecimals(order.from_token);
        const toDecimals = this.getTokenDecimals(order.to_token);

        await this.executeOrder(orderId, pairPrice, fromDecimals, toDecimals);

        // If successful, remove from cooldown (order should be marked executed on-chain)
        this.attemptedOrders.delete(orderId);
      } catch (error) {
        // Keep in cooldown map - will retry after cooldown period
        console.log(`   ⚠️  Execution failed, will retry after cooldown period`);
      }
    } else {
      console.log(`   ⏳ Waiting for price...`);
    }
  }

  /**
   * Execute a limit order on-chain
   */
  private async executeOrder(
    orderId: number,
    currentPrice: number,
    fromTokenDecimals: number,
    toTokenDecimals: number
  ): Promise<void> {
    if (!this.signer || !this.executorAddress) {
      throw new Error('Executor wallet not initialized');
    }

    try {
      // Convert price to numerator/denominator with proper decimal adjustment
      // Use same formula as frontend to ensure consistency
      // Adjust PRECISION dynamically to avoid JavaScript precision loss
      const decimalAdjustment = toTokenDecimals - fromTokenDecimals;
      const MAX_SAFE_EXPONENT = 15;
      const PRECISION = Math.min(6, MAX_SAFE_EXPONENT - Math.abs(decimalAdjustment));
      const denominator = BigInt(10) ** BigInt(PRECISION);

      // Calculate numerator using BigInt for large numbers
      const priceScaled = currentPrice * Math.pow(10, PRECISION + decimalAdjustment);
      const numerator = BigInt(Math.floor(priceScaled));

      // Helper: Convert BigInt to hex with even length
      const toEvenHex = (num: bigint | number): string => {
        let hex = num.toString(16);
        if (hex.length % 2 !== 0) hex = '0' + hex; // Ensure even length
        return hex;
      };

      // Get executor nonce
      const account = await this.provider.getAccount(this.executorAddress);

      // Build transaction data - all hex args must have even length!
      const orderIdHex = orderId.toString(16).padStart(16, '0'); // 8 bytes = 16 hex chars
      const numeratorHex = toEvenHex(numerator);
      const denominatorHex = toEvenHex(denominator);

      const data = `executeLimitOrder@${orderIdHex}@${numeratorHex}@${denominatorHex}`;

      console.log(`      📝 Transaction data (decimal-adjusted):`, {
        orderId,
        currentPrice,
        fromDecimals: fromTokenDecimals,
        toDecimals: toTokenDecimals,
        decimalAdjustment,
        PRECISION,
        totalExponent: PRECISION + decimalAdjustment,
        numerator: numerator.toString(),
        denominator: denominator.toString(),
        data
      });

      // Build transaction
      const tx = new Transaction({
        sender: Address.newFromBech32(this.executorAddress.bech32()),
        receiver: Address.newFromBech32(CONTRACT_ADDRESS),
        value: 0n,
        gasLimit: 80_000_000n,
        chainID: '1',
        nonce: BigInt(account.nonce),
        data: Buffer.from(data),
      });

      // Sign transaction
      const txComputer = new TransactionComputer();
      const serializedTx = txComputer.computeBytesForSigning(tx);
      const signature = await this.signer.sign(Buffer.from(serializedTx));
      tx.signature = signature;

      // Send transaction
      const txHash = await this.provider.sendTransaction(tx);

      console.log(`      ✅ Execution TX sent: ${txHash}`);
      console.log(`      Explorer: https://explorer.multiversx.com/transactions/${txHash}`);

      // Wait for execution
      await this.waitForTransaction(txHash);
    } catch (error: any) {
      console.error(`      ❌ Execution failed:`, error.message);
      throw error;
    }
  }

  /**
   * Wait for transaction completion
   */
  private async waitForTransaction(txHash: string): Promise<void> {
    const maxAttempts = 20;
    const delayMs = 3000;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      try {
        const txResult = await this.provider.getTransaction(txHash);

        if (txResult.status.isSuccessful()) {
          console.log(`      ✅ Transaction successful!`);
          return;
        } else if (txResult.status.isFailed()) {
          console.error(`      ❌ Transaction failed`);
          return;
        }
      } catch (error) {
        // Transaction not yet available, continue waiting
      }
    }

    console.log(`      ⏰ Transaction pending (check explorer)`);
  }

  /**
   * Get pending order IDs from contract
   */
  private async getPendingOrders(): Promise<number[]> {
    try {
      const url = `${NETWORK_CONFIG.apiAddress}/query`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scAddress: CONTRACT_ADDRESS,
          funcName: 'getPendingOrders',
          args: [],
        }),
      });

      const data: any = await response.json();

      console.log('   📡 Query response:', JSON.stringify(data, null, 2));

      // Parse the response - returnData contains base64-encoded LimitOrder structs
      // We need to extract just the order_id (first 8 bytes)
      const orderIds: number[] = [];
      if (data.returnData && Array.isArray(data.returnData)) {
        console.log('   📊 Found returnData:', data.returnData);
        for (const base64Value of data.returnData) {
          if (base64Value) {
            const hexValue = Buffer.from(base64Value, 'base64').toString('hex');
            // Extract first 8 bytes (16 hex chars) = order_id field
            const orderIdHex = hexValue.slice(0, 16);
            const orderId = parseInt(orderIdHex, 16);
            console.log(`   🔢 Decoded order ID: ${orderIdHex} -> ${orderId}`);
            orderIds.push(orderId);
          }
        }
      } else if (data.data && data.data.returnData) {
        // Fallback for different response format
        console.log('   📊 Found data.returnData:', data.data.returnData);
        for (const base64Value of data.data.returnData) {
          if (base64Value) {
            const hexValue = Buffer.from(base64Value, 'base64').toString('hex');
            // Extract first 8 bytes (16 hex chars) = order_id field
            const orderIdHex = hexValue.slice(0, 16);
            const orderId = parseInt(orderIdHex, 16);
            console.log(`   🔢 Decoded order ID: ${orderIdHex} -> ${orderId}`);
            orderIds.push(orderId);
          }
        }
      } else {
        console.log('   ⚠️  No returnData found in response');
      }

      return orderIds;
    } catch (error: any) {
      console.error('   ❌ Error fetching pending orders:', error.message);
      return [];
    }
  }

  /**
   * Get limit order details from contract
   */
  private async getLimitOrder(orderId: number): Promise<LimitOrder | null> {
    try {
      const url = `${NETWORK_CONFIG.apiAddress}/query`;

      // Convert order ID to hex - u64 = 8 bytes = 16 hex characters
      const orderIdHex = orderId.toString(16).padStart(16, '0');

      console.log(`   🔍 Querying order ${orderId} (hex: 0x${orderIdHex})`);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scAddress: CONTRACT_ADDRESS,
          funcName: 'getOrder',
          args: [orderIdHex], // Send raw hex string, not base64
        }),
      });

      const data: any = await response.json();

      console.log(`   📡 Order ${orderId} response:`, JSON.stringify(data, null, 2));

      // Check for returnData in correct format
      const returnData = data.returnData || (data.data && data.data.returnData);

      if (!returnData || returnData.length === 0 || data.statusCode === 500) {
        console.log(`   ⚠️  Order ${orderId}: No data returned`);
        return null;
      }

      console.log(`   ✅ Order ${orderId}: Found data, parsing...`);

      // Decode the base64-encoded struct
      const buffer = Buffer.from(returnData[0], 'base64');

      // Parse nested-encoded struct
      // Format: each field is length-prefixed
      let offset = 0;

      // Read a u64 (8 bytes, big-endian)
      const readU64 = (): bigint => {
        const value = buffer.readBigUInt64BE(offset);
        offset += 8;
        return value;
      };

      // Read a length-prefixed buffer (4-byte length + data)
      const readLengthPrefixed = (): Buffer => {
        const length = buffer.readUInt32BE(offset);
        offset += 4;
        const data = buffer.slice(offset, offset + length);
        offset += length;
        return data;
      };

      // Read a BigUint (4-byte length + data)
      const readBigUint = (): string => {
        const length = buffer.readUInt32BE(offset);
        offset += 4;
        if (length === 0) {
          return '0';
        }
        const data = buffer.slice(offset, offset + length);
        offset += length;
        return BigInt('0x' + data.toString('hex')).toString();
      };

      // Parse struct fields
      const parsedOrderId = readU64();

      // ManagedAddress is FIXED 32 bytes (not length-prefixed)
      const userAddress = buffer.slice(offset, offset + 32);
      offset += 32;

      const fromToken = readLengthPrefixed().toString('utf8');
      const fromAmount = readBigUint();
      const toToken = readLengthPrefixed().toString('utf8');
      const targetPriceNum = readBigUint();
      const targetPriceDenom = readBigUint();
      const slippageBp = readU64();
      const expiresAt = readU64();  // expires_at comes BEFORE status and created_at
      const status = buffer.readUInt8(offset); // u8 status (1 byte, no length prefix)
      offset += 1;
      const createdAt = readU64();

      console.log(`   📊 Decoded order ${orderId}:`, {
        fromToken,
        toToken,
        fromAmount,
        targetPriceNum,
        targetPriceDenom,
        targetPrice: `${targetPriceNum}/${targetPriceDenom} = ${parseFloat(targetPriceNum) / parseFloat(targetPriceDenom)}`,
        slippageBp: slippageBp.toString(),
        expiresAt: new Date(Number(expiresAt) * 1000).toISOString(),
      });

      return {
        order_id: orderId,
        user: userAddress.toString('hex'),
        from_token: fromToken,
        from_amount: fromAmount,
        to_token: toToken,
        target_price_numerator: targetPriceNum,
        target_price_denominator: targetPriceDenom,
        slippage_bp: Number(slippageBp),
        created_at: Number(createdAt),
        expires_at: Number(expiresAt),
        status: status,
      };
    } catch (error: any) {
      console.error(`   ❌ Error fetching order ${orderId}:`, error.message);
      console.error('   Stack:', error.stack);
      return null;
    }
  }

  /**
   * Get token pair price from xExchange GraphQL API
   */
  private async getTokenPairPrice(fromToken: string, toToken: string): Promise<number | null> {
    try {
      // Query xExchange GraphQL for ALL pairs (filter client-side)
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

      const response = await fetch(XEXCHANGE_GRAPHQL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data: any = await response.json();

      if (!data.data || !data.data.pairs || data.data.pairs.length === 0) {
        console.error(`No pairs found in xExchange`);
        return null;
      }

      const pairs = data.data.pairs;

      // Find matching pair (either direction)
      const pair = pairs.find(
        (p: any) =>
          (p.firstToken.identifier === fromToken && p.secondToken.identifier === toToken) ||
          (p.firstToken.identifier === toToken && p.secondToken.identifier === fromToken)
      );

      if (!pair) {
        console.error(`No pair found for ${fromToken}/${toToken}`);
        return null;
      }

      // Calculate price from reserves with decimals
      const reserve0 = parseFloat(pair.info.reserves0);
      const reserve1 = parseFloat(pair.info.reserves1);
      const decimals0 = pair.firstToken.decimals;
      const decimals1 = pair.secondToken.decimals;

      if (!reserve0 || !reserve1) {
        console.error(`Invalid reserves for pair`);
        return null;
      }

      // Adjust for decimals
      const adjustedReserve0 = reserve0 / Math.pow(10, decimals0);
      const adjustedReserve1 = reserve1 / Math.pow(10, decimals1);

      // Calculate price based on token order
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

      console.log(`      📊 Price: ${fromToken}/${toToken} = ${price.toFixed(6)}`);

      return price;
    } catch (error: any) {
      console.error('Error fetching price from xExchange:', error.message);
      return null;
    }
  }

  /**
   * Get executor status
   */
  getStatus(): object {
    return {
      running: this.isRunning,
      executorAddress: this.executorAddress?.bech32() || null,
      checkInterval: this.checkInterval,
      cooldownPeriod: this.cooldownPeriod,
      attemptedOrdersCount: this.attemptedOrders.size,
      contractAddress: CONTRACT_ADDRESS,
    };
  }

  /**
   * Clear cooldown for a specific order (useful for testing/debugging)
   */
  clearOrderCooldown(orderId: number): void {
    this.attemptedOrders.delete(orderId);
    console.log(`✅ Cleared cooldown for order ${orderId}`);
  }

  /**
   * Clear all order cooldowns
   */
  clearAllCooldowns(): void {
    this.attemptedOrders.clear();
    console.log(`✅ Cleared all order cooldowns`);
  }
}
