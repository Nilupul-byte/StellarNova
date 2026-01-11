/**
 * StellarNova Smart Contract Transactions
 *
 * Following mx-template-dapp pattern for transaction creation
 * Uses sdk-dapp's signAndSendTransactions helper
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
import { GAS_LIMITS, STELLARNOVA_CONTRACT_ADDRESS, toWei } from './config';

// Transaction Display Info
const DEPOSIT_TX_INFO: TransactionsDisplayInfoType = {
  processingMessage: 'Processing deposit to vault',
  errorMessage: 'Deposit failed',
  successMessage: 'Deposited successfully!'
};

const WITHDRAW_TX_INFO: TransactionsDisplayInfoType = {
  processingMessage: 'Processing withdrawal from vault',
  errorMessage: 'Withdrawal failed',
  successMessage: 'Withdrawn successfully!'
};

const TRADE_TX_INFO: TransactionsDisplayInfoType = {
  processingMessage: 'Executing AI-powered trade',
  errorMessage: 'Trade execution failed',
  successMessage: 'Trade executed successfully!'
};

/**
 * Hook for StellarNova contract transactions
 * Follows exact pattern from useSendPingPongTransaction
 */
export const useStellarNovaTransactions = () => {
  const { network } = useGetNetworkConfig();
  const { address } = useGetAccount();

  /**
   * Deposit tokens into vault
   * @param tokenIdentifier - Token identifier (e.g., "USDC-c76f1f")
   * @param amount - Amount in human-readable format
   * @param decimals - Token decimals
   */
  const sendDepositTransaction = async (
    tokenIdentifier: string,
    amount: number,
    decimals: number
  ): Promise<string | undefined> => {
    const amountWei = toWei(amount, decimals);

    // Build transaction data: ESDTTransfer@<token_hex>@<amount_hex>@<function_hex>@<args_hex>
    const tokenHex = Buffer.from(tokenIdentifier).toString('hex');
    const amountHex = BigInt(amountWei).toString(16).padStart(2, '0');
    const functionHex = Buffer.from('deposit').toString('hex');

    const data = `ESDTTransfer@${tokenHex}@${amountHex}@${functionHex}`;

    const depositTransaction = new Transaction({
      value: BigInt(0), // ESDT transfers have value=0
      data: Buffer.from(data),
      receiver: new Address(STELLARNOVA_CONTRACT_ADDRESS),
      gasLimit: BigInt(GAS_LIMITS.deposit),
      gasPrice: BigInt(GAS_PRICE),
      chainID: network.chainId,
      sender: new Address(address),
      version: 2
    });

    const sessionId = await signAndSendTransactions({
      transactions: [depositTransaction],
      transactionsDisplayInfo: DEPOSIT_TX_INFO
    });

    return sessionId;
  };

  /**
   * Withdraw tokens from vault
   * @param tokenIdentifier - Token identifier (e.g., "USDC-c76f1f")
   * @param amount - Amount in human-readable format
   * @param decimals - Token decimals
   */
  const sendWithdrawTransaction = async (
    tokenIdentifier: string,
    amount: number,
    decimals: number
  ): Promise<string | undefined> => {
    const amountWei = toWei(amount, decimals);

    // Build transaction data: withdraw@<token_hex>@<amount_hex>
    const tokenHex = Buffer.from(tokenIdentifier).toString('hex');
    const amountHex = BigInt(amountWei).toString(16).padStart(2, '0');

    const data = `withdraw@${tokenHex}@${amountHex}`;

    const withdrawTransaction = new Transaction({
      value: BigInt(0),
      data: Buffer.from(data),
      receiver: new Address(STELLARNOVA_CONTRACT_ADDRESS),
      gasLimit: BigInt(GAS_LIMITS.withdraw),
      gasPrice: BigInt(GAS_PRICE),
      chainID: network.chainId,
      sender: new Address(address),
      version: 2
    });

    const sessionId = await signAndSendTransactions({
      transactions: [withdrawTransaction],
      transactionsDisplayInfo: WITHDRAW_TX_INFO
    });

    return sessionId;
  };

  /**
   * Execute trade (swap tokens via xExchange)
   * @param fromToken - Source token identifier
   * @param toToken - Destination token identifier
   * @param amount - Amount in human-readable format
   * @param fromDecimals - Source token decimals
   * @param minAmountOut - Minimum output amount (for slippage protection)
   */
  const sendTradeTransaction = async (
    fromToken: string,
    toToken: string,
    amount: number,
    fromDecimals: number,
    minAmountOut: string = '1' // Default minimum output (adjust based on actual price)
  ): Promise<string | undefined> => {
    const amountWei = toWei(amount, fromDecimals);

    // Build transaction data: executeTrade@<user_address_hex>@<from_token_hex>@<to_token_hex>@<amount_hex>@<min_amount_hex>
    // Contract signature: fn execute_trade(user, from_token, to_token, from_amount, min_amount_out)
    const userAddr = new Address(address);
    const userAddressHex = userAddr.toHex(); // Get address as hex (without erd1 prefix)
    const fromTokenHex = Buffer.from(fromToken).toString('hex');
    const toTokenHex = Buffer.from(toToken).toString('hex');
    const amountHex = BigInt(amountWei).toString(16).padStart(2, '0');
    const minAmountHex = BigInt(minAmountOut).toString(16).padStart(2, '0');

    const data = `executeTrade@${userAddressHex}@${fromTokenHex}@${toTokenHex}@${amountHex}@${minAmountHex}`;

    const tradeTransaction = new Transaction({
      value: BigInt(0),
      data: Buffer.from(data),
      receiver: new Address(STELLARNOVA_CONTRACT_ADDRESS),
      gasLimit: BigInt(GAS_LIMITS.executeTrade),
      gasPrice: BigInt(GAS_PRICE),
      chainID: network.chainId,
      sender: new Address(address),
      version: 2
    });

    const sessionId = await signAndSendTransactions({
      transactions: [tradeTransaction],
      transactionsDisplayInfo: TRADE_TX_INFO
    });

    return sessionId;
  };

  return {
    sendDepositTransaction,
    sendWithdrawTransaction,
    sendTradeTransaction
  };
};
