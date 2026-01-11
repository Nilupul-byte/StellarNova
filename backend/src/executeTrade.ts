import { XExchangeService, SwapParams } from './services/xexchange-integration';
import { UserSigner } from '@multiversx/sdk-wallet';
import { ApiNetworkProvider } from '@multiversx/sdk-network-providers';
import { Address, TransactionComputer } from '@multiversx/sdk-core';
import { readFileSync } from 'fs';

export class TradeExecutor {
  private xexchange: XExchangeService;
  private provider: ApiNetworkProvider;
  private signer: UserSigner | null = null;
  private initialized: boolean = false;

  constructor() {
    this.xexchange = new XExchangeService('https://api.multiversx.com');
    this.provider = new ApiNetworkProvider('https://gateway.multiversx.com');
    console.log('✅ TradeExecutor initialized with xExchange integration');
  }

  async initializeWallet(pemPath: string) {
    try {
      const pemContent = readFileSync(pemPath, 'utf-8');
      this.signer = UserSigner.fromPem(pemContent);
      this.initialized = true;
      console.log('✅ Backend wallet initialized:', this.signer.getAddress().bech32());
    } catch (error) {
      console.error('❌ Failed to load PEM file:', error);
      throw error;
    }
  }

  async executeTrade(
    userAddress: string,
    fromToken: string,
    toToken: string,
    fromAmount: string,
    minAmountOut: string
  ): Promise<{ txHash: string; status: string }> {
    if (!this.initialized || !this.signer) {
      throw new Error('Backend wallet not initialized');
    }

    console.log(`🔄 Executing swap: ${fromAmount} ${fromToken} → ${toToken}`);

    try {
      // Step 1: Get pair address
      const pairAddress = this.xexchange.getPairAddress(fromToken, toToken);
      if (!pairAddress) {
        throw new Error(`No liquidity pool found for ${fromToken} → ${toToken}`);
      }

      console.log('📊 Using pair:', pairAddress);

      // Step 2: Build transaction
      const swapParams: SwapParams = {
        fromToken,
        toToken,
        amount: fromAmount,
        minAmountOut,
        userAddress
      };

      const transaction = await this.xexchange.buildDirectSwapTransaction(
        swapParams,
        this.signer.getAddress().bech32()
      );

      // Step 3: Get account nonce
      const signerAddress = this.signer.getAddress();
      const account = await this.provider.getAccount(signerAddress);
      transaction.nonce = BigInt(account.nonce);

      // Step 4: Sign transaction
      const txComputer = new TransactionComputer();
      const serializedTx = txComputer.computeBytesForSigning(transaction);
      const signature = await this.signer.sign(Buffer.from(serializedTx));
      transaction.signature = signature;

      // Step 5: Send to network
      const txHash = await this.provider.sendTransaction(transaction);
      console.log('✅ Transaction sent:', txHash);

      return {
        txHash: txHash.toString(),
        status: 'pending'
      };
    } catch (error: any) {
      console.error('❌ Trade execution failed:', error);
      throw error;
    }
  }

  async getUserBalance(userAddress: string, tokenIdentifier: string): Promise<string> {
    try {
      // For both EGLD and ESDT tokens - use API directly
      if (tokenIdentifier === 'EGLD') {
        const url = `https://api.multiversx.com/accounts/${userAddress}`;
        const response = await fetch(url);
        const data: any = await response.json();
        return data.balance || '0';
      }

      // For ESDT tokens
      const url = `https://api.multiversx.com/accounts/${userAddress}/tokens/${tokenIdentifier}`;
      const response = await fetch(url);
      const data: any = await response.json();

      return data.balance || '0';
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      return '0';
    }
  }

  async isPaused(): Promise<boolean> {
    // Query your StellarNova contract to check if it's paused
    // For now, return false
    return false;
  }

  async getTransactionStatus(txHash: string): Promise<{ status: string; data?: any }> {
    try {
      const transaction = await this.provider.getTransaction(txHash);

      return {
        status: transaction.status.toString(),
        data: {
          hash: txHash,
          status: transaction.status.toString(),
          timestamp: transaction.timestamp,
        },
      };
    } catch (error) {
      console.error('Failed to fetch transaction:', error);
      throw error;
    }
  }
}
