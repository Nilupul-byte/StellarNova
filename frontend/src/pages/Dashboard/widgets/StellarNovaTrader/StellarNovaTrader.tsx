/**
 * StellarNova AI Trading Widget
 *
 * Main trading interface that integrates:
 * - AI prompt parsing
 * - Trade confirmation
 * - Transaction execution via sdk-dapp
 * - Wallet connection from template (100% preserved)
 */

import { useState } from 'react';
import { OutputContainer } from 'components/OutputContainer';
import { MvxDataWithExplorerLink, useGetPendingTransactions } from 'lib';
import {
  formatTradeDescription,
  parseTradePrompt,
  validateParsedPrompt
} from 'lib/ai';
import type { ParsedPrompt } from 'lib/ai/schema';
import { getTokenByTicker, TOKENS } from 'lib/stellarnova';
import { useXExchangeSwaps } from 'lib/stellarnova/xexchange'; // ✅ FIXED: Use corrected version with Router
import { PromptInput, TradeConfirmation } from './components';

export const StellarNovaTrader = () => {
  // State
  const [prompt, setPrompt] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedPrompt | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Hooks (using direct xExchange - no vault needed!)
  const { executeSwap } = useXExchangeSwaps();
  const transactions = useGetPendingTransactions();
  const hasPendingTransactions = transactions.length > 0;

  // Reset state
  const resetState = () => {
    setParsed(null);
    setShowConfirmation(false);
    setExecuting(false);
    setError(null);
  };

  // Step 1: Parse prompt with AI
  const handleExecute = async () => {
    try {
      setParsing(true);
      setError(null);

      // Parse prompt using AI + regex fallback
      const result = await parseTradePrompt(prompt, {
        useAI: false, // Set to true when AI API key is configured
        fallbackToRegex: true
      });

      // Validate parsed result
      const validation = validateParsedPrompt(result);
      if (!validation.valid) {
        throw new Error(`Invalid trade: ${validation.errors.join(', ')}`);
      }

      setParsed(result);
      setShowConfirmation(true);
    } catch (err: any) {
      setError(err.message || 'Failed to parse trading prompt');
      console.error('Parse error:', err);
    } finally {
      setParsing(false);
    }
  };

  // Step 2: Execute trade after confirmation (DIRECT xExchange - no vault!)
  const handleConfirm = async () => {
    if (!parsed) return;

    try {
      setExecuting(true);
      setError(null);

      const { fromToken, toToken, amount } = parsed.command;

      // Get token details
      const fromTokenInfo = getTokenByTicker(
        fromToken?.split('-')[0] || fromToken || ''
      );
      const toTokenInfo = getTokenByTicker(
        toToken?.split('-')[0] || toToken || ''
      );

      if (!fromTokenInfo || !toTokenInfo) {
        throw new Error('Unsupported token pair');
      }

      // Execute swap DIRECTLY on xExchange Pair contract (no vault!)
      // User's wallet → Pair Contract → User's wallet (100% non-custodial!)
      const txSessionId = await executeSwap({
        fromToken: fromTokenInfo.identifier,
        toToken: toTokenInfo.identifier,
        amount: amount,
        fromDecimals: fromTokenInfo.decimals,
        slippagePercent: 5
      });

      if (txSessionId) {
        setSessionId(txSessionId);
        setShowConfirmation(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to execute trade');
      console.error('Execution error:', err);
    } finally {
      setExecuting(false);
    }
  };

  // Handle cancellation
  const handleCancel = () => {
    resetState();
  };

  // Handle new trade
  const handleNewTrade = () => {
    setPrompt('');
    setSessionId(null);
    resetState();
  };

  return (
    <div className='flex flex-col gap-6'>
      {/* Header */}
      <div className='bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/30 rounded-lg p-6'>
        <h2 className='text-2xl font-bold text-primary mb-2'>
          🌌 StellarNova AI Trader
        </h2>
        <p className='text-gray-400'>
          Trade on MultiversX xExchange using natural language. Fully
          non-custodial - your funds never leave your wallet!
        </p>
      </div>

      {/* xExchange Info */}
      <div className='bg-secondary/50 border border-gray-700 rounded-lg p-4'>
        <h3 className='font-semibold text-accent mb-2'>
          Trading via xExchange Pairs (Mainnet)
        </h3>
        <MvxDataWithExplorerLink
          data='erd1qqqqqqqqqqqqqpgqeel94l7at299f082d08qlqfw5qjcvxvg2jpsg2pqaq'
          withTooltip={true}
        />
        <p className='text-sm text-gray-400 mt-2'>
          Direct pair swaps | 100% Non-custodial | 5% max slippage
        </p>
      </div>

      {/* Supported Tokens */}
      <div className='bg-secondary/50 border border-gray-700 rounded-lg p-4'>
        <h3 className='font-semibold text-accent mb-2'>Supported Tokens</h3>
        <div className='flex gap-3'>
          {Object.values(TOKENS).map((token) => (
            <div
              key={token.identifier}
              className='px-3 py-1 bg-primary/10 border border-primary/30 rounded-full text-sm text-primary'
            >
              {token.ticker}
            </div>
          ))}
        </div>
      </div>

      {/* Prompt Input */}
      {!sessionId && (
        <PromptInput
          prompt={prompt}
          onChange={setPrompt}
          onExecute={handleExecute}
          loading={parsing || executing}
          disabled={hasPendingTransactions}
        />
      )}

      {/* Error Display */}
      {error && (
        <div className='bg-red-500/10 border border-red-500/30 rounded-lg p-4'>
          <p className='text-red-500'>
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {/* Trade Confirmation Modal */}
      {showConfirmation && (
        <TradeConfirmation
          parsed={parsed}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          loading={executing}
        />
      )}

      {/* Transaction Output (using template's OutputContainer) */}
      {sessionId && (
        <OutputContainer>
          <div className='flex flex-col gap-4'>
            <div className='bg-green-500/10 border border-green-500/30 rounded-lg p-4'>
              <p className='text-green-500 font-semibold mb-2'>
                ✅ Trade Executed Successfully!
              </p>
              <p className='text-sm text-gray-300'>
                {parsed && formatTradeDescription(parsed)}
              </p>
            </div>

            {transactions.map((tx) => (
              <div
                key={tx.hash}
                className='bg-secondary/50 border border-gray-700 rounded-lg p-4'
              >
                <p className='text-xs text-gray-400 mb-1'>Transaction Hash:</p>
                <MvxDataWithExplorerLink
                  data={tx.hash || ''}
                  withTooltip={true}
                />
                <p className='text-xs text-gray-400 mt-2'>
                  Status: <span className='text-primary'>{tx.status}</span>
                </p>
              </div>
            ))}

            <button
              onClick={handleNewTrade}
              className='px-6 py-3 bg-gradient-to-r from-primary to-accent text-secondary font-semibold rounded-lg hover:opacity-90 transition'
            >
              Execute Another Trade
            </button>
          </div>
        </OutputContainer>
      )}

      {/* Help Section */}
      <div className='bg-accent/10 border border-accent/30 rounded-lg p-4'>
        <h3 className='font-semibold text-accent mb-2'>📝 How It Works:</h3>
        <ul className='text-sm text-gray-300 space-y-1'>
          <li>• 🎯 Type what you want to trade in plain English</li>
          <li>• 🤖 AI parses your intent into a trade</li>
          <li>
            • 🔒 You sign the transaction - your funds stay in YOUR wallet
          </li>
          <li>• ⚡ Trade executes directly on xExchange</li>
          <li>• ✅ 100% non-custodial - we never touch your tokens!</li>
        </ul>
      </div>
    </div>
  );
};
