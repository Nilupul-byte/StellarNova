import { useState } from 'react';
import { Card } from 'components/Card';
import { OutputContainer } from 'components/OutputContainer';
import {
  MvxDataWithExplorerLink,
  useGetAccount,
  useGetPendingTransactions
} from 'lib';
import { parseTradePrompt, validateParsedPrompt } from 'lib/ai';
import type { ParsedPrompt } from 'lib/ai/schema';
import { getTokenByTicker } from 'lib/stellarnova';
import { toWei } from 'lib/stellarnova';
import {
  calculateTargetPrice,
  getCurrentPriceFromXExchange,
  getUserVaultBalance,
  useLimitOrders,
  waitForTransaction
} from 'lib/stellarnova/limitOrders';
import { useXExchangeSwaps } from 'lib/stellarnova/xexchange';
import { analyzeTradeWithAI } from 'services/ai/atlasAnalysis';
import { getMarketAnalysis } from 'services/market/xexchangeMarket';
import { ExecutionOptions } from './ExecutionOptions';
import { MarketInsights } from './MarketInsights';
import { PromptInput } from './PromptInput';

export const AtlasTrader = () => {
  const [prompt, setPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [tradeIntent, setTradeIntent] = useState<ParsedPrompt | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [executionType, setExecutionType] = useState<'market' | 'limit' | null>(
    null
  );
  const [progressMessage, setProgressMessage] = useState<string>('');

  // Hooks for swap execution and limit orders
  const { executeSwap } = useXExchangeSwaps();
  const { depositToVault, createLimitOrder } = useLimitOrders();
  const transactions = useGetPendingTransactions();
  const { address } = useGetAccount();

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      // Step 1: Parse the user's trading intent
      const tradeIntent = await parseTradePrompt(prompt, { useAI: true });

      // Validate the parsed result
      const validation = validateParsedPrompt(tradeIntent);
      if (!validation.valid) {
        throw new Error(
          `Could not understand trade intent: ${validation.errors.join(
            ', '
          )}. Please be more specific (e.g., "Buy 0.5 WEGLD with USDC")`
        );
      }

      // Step 2: Fetch real market data from xExchange
      const marketData = await getMarketAnalysis(
        tradeIntent.command.fromToken!,
        tradeIntent.command.toToken!
      );

      if (!marketData || !marketData.hasData) {
        throw new Error(
          'Could not fetch market data for this trading pair. Please try again.'
        );
      }

      // Step 3: Get AI analysis and recommendations
      const aiAnalysis = await analyzeTradeWithAI(prompt, marketData);

      setAnalysis(aiAnalysis);
      setTradeIntent(tradeIntent); // Store for later execution
    } catch (error: any) {
      console.error('Analysis failed:', error);

      // Provide helpful error messages
      let errorMessage = error.message || 'Analysis failed. Please try again.';

      if (errorMessage.includes('API key')) {
        errorMessage =
          '⚙️ Missing API Key: Create a .env file in the frontend folder with VITE_DEEPSEEK_API_KEY=your_key';
      } else if (errorMessage.includes('market data')) {
        errorMessage += ' Check browser console for details.';
      }

      setError(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExecuteOption = async (optionId: number) => {
    console.log('Executing option:', optionId);

    if (!tradeIntent) {
      setError('No trade intent found. Please analyze a trade first.');
      return;
    }

    // Option 1: Market Buy Now - Execute immediately
    if (optionId === 1) {
      try {
        setIsExecuting(true);
        setError(null);

        const { fromToken, toToken, amount } = tradeIntent.command;

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

        console.log('🚀 Executing market buy:', {
          from: fromTokenInfo.ticker,
          to: toTokenInfo.ticker,
          amount
        });

        // Execute swap on xExchange
        const txSessionId = await executeSwap({
          fromToken: fromTokenInfo.identifier,
          toToken: toTokenInfo.identifier,
          amount: amount,
          fromDecimals: fromTokenInfo.decimals,
          slippagePercent: 5
        });

        if (txSessionId) {
          console.log('✅ Swap executed! Session ID:', txSessionId);
          setSessionId(txSessionId);
          setExecutionType('market');
          setAnalysis(null); // Hide analysis, show success
        }
      } catch (err: any) {
        console.error('❌ Swap execution failed:', err);
        setError(err.message || 'Failed to execute swap. Please try again.');
      } finally {
        setIsExecuting(false);
      }
    }

    // Option 2: Limit Order (Place limit buy 2% lower)
    if (optionId === 2) {
      try {
        setIsExecuting(true);
        setError(null);

        const { fromToken, toToken, amount } = tradeIntent.command;

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

        console.log('📋 Creating limit order:', {
          from: fromTokenInfo.ticker,
          to: toTokenInfo.ticker,
          amount
        });

        // Step 1: Check vault balance
        const vaultBalance = await getUserVaultBalance(
          address,
          fromTokenInfo.identifier
        );
        const amountWei = toWei(amount, fromTokenInfo.decimals);
        const vaultBalanceBigInt = BigInt(vaultBalance);
        const amountWeiBigInt = BigInt(amountWei);

        console.log('💰 Vault balance check:', {
          vaultBalance,
          amountNeeded: amountWei,
          hasSufficient: vaultBalanceBigInt >= amountWeiBigInt
        });

        // Step 2: If insufficient balance, deposit first
        if (vaultBalanceBigInt < amountWeiBigInt) {
          console.log('⚠️ Insufficient vault balance. Requesting deposit...');

          setProgressMessage(
            'Step 1/2: Please sign the deposit transaction in your wallet...'
          );

          // Deposit the exact amount needed
          const depositSessionId = await depositToVault(
            fromTokenInfo.identifier,
            amount,
            fromTokenInfo.decimals
          );

          if (!depositSessionId) {
            throw new Error('Deposit transaction failed');
          }

          console.log(
            '✅ Deposit transaction signed. Session ID:',
            depositSessionId
          );

          setProgressMessage(
            'Step 1/2: Waiting for deposit to confirm on blockchain...'
          );

          // Wait for transaction to appear in pending transactions
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Get the transaction hash from pending transactions
          const pendingTx = transactions.find(
            (tx) => (tx as any).sessionId === depositSessionId
          );
          const txHash = pendingTx?.hash;

          if (!txHash) {
            console.warn('⚠️ Could not find transaction hash from sessionId');
            console.log('Available transactions:', transactions);

            // Fallback: Wait fixed time for deposit to process
            // MultiversX transactions typically confirm in ~6 seconds
            console.log('📡 Waiting 15 seconds for deposit to confirm...');
            await new Promise((resolve) => setTimeout(resolve, 15000));

            console.log('✅ Assuming deposit confirmed after 15 seconds');
          } else {
            console.log('📡 Monitoring deposit transaction:', txHash);

            // Wait for transaction confirmation
            const confirmed = await waitForTransaction(txHash);

            if (!confirmed) {
              throw new Error(
                'Deposit transaction failed or timed out. Please try again.'
              );
            }

            console.log('✅ Deposit confirmed on blockchain!');
          }

          setProgressMessage('Step 2/2: Creating limit order...');
        }

        // Step 3: Get current price from xExchange
        const priceData = await getCurrentPriceFromXExchange(
          fromTokenInfo.identifier,
          toTokenInfo.identifier
        );

        if (!priceData) {
          throw new Error(
            'Could not fetch current price from xExchange. Please try again.'
          );
        }

        // Calculate target price (2% lower)
        const { numerator, denominator } = calculateTargetPrice(
          priceData.price,
          2
        );

        console.log('🎯 Limit order details:', {
          currentPrice: priceData.price,
          targetPrice: numerator / denominator,
          percentLower: '2%'
        });

        // Step 4: Create limit order
        const txSessionId = await createLimitOrder({
          fromToken: fromTokenInfo.identifier,
          fromAmount: amount,
          fromDecimals: fromTokenInfo.decimals,
          toToken: toTokenInfo.identifier,
          targetPriceNum: numerator,
          targetPriceDenom: denominator,
          slippageBp: 500, // 5% slippage
          durationSeconds: 86400 // 24 hours
        });

        if (txSessionId) {
          console.log('✅ Limit order created! Session ID:', txSessionId);
          setSessionId(txSessionId);
          setExecutionType('limit');
          setAnalysis(null); // Hide analysis, show success
        }
      } catch (err: any) {
        console.error('❌ Limit order creation failed:', err);
        setError(
          err.message || 'Failed to create limit order. Please try again.'
        );
      } finally {
        setIsExecuting(false);
        setProgressMessage('');
      }
    }

    // Option 3: Split order (TODO)
    if (optionId === 3) {
      alert(
        '📊 This feature will be available soon! It will split your order into 2 parts (50% now, 50% later).'
      );
    }
  };

  const handleReset = () => {
    setPrompt('');
    setAnalysis(null);
    setTradeIntent(null);
  };

  const handleNewTrade = () => {
    setPrompt('');
    setSessionId(null);
    setExecutionType(null);
    setAnalysis(null);
    setTradeIntent(null);
    setError(null);
    setProgressMessage('');
  };

  return (
    <Card
      title='🧭 Atlas AI Trade Advisor'
      description='Get AI-powered market insights before executing your trade. Analyze trends, volatility, and liquidity to make informed decisions.'
      reference='https://github.com/multiversx/mx-sdk-dapp'
    >
      <div className='flex flex-col gap-6'>
        {/* Error Message */}
        {error && (
          <div className='bg-red-500 bg-opacity-10 border border-red-500 rounded-lg p-4'>
            <p className='text-red-500 font-medium'>❌ {error}</p>
          </div>
        )}

        {/* Progress Message */}
        {progressMessage && (
          <div className='bg-blue-500 bg-opacity-10 border border-blue-500 rounded-lg p-4'>
            <div className='flex items-center gap-3'>
              <svg
                className='animate-spin h-5 w-5 text-blue-500'
                viewBox='0 0 24 24'
              >
                <circle
                  className='opacity-25'
                  cx='12'
                  cy='12'
                  r='10'
                  stroke='currentColor'
                  strokeWidth='4'
                  fill='none'
                />
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                />
              </svg>
              <p className='text-blue-500 font-medium'>{progressMessage}</p>
            </div>
          </div>
        )}

        {/* Prompt Input */}
        {!analysis && !sessionId && (
          <PromptInput
            value={prompt}
            onChange={setPrompt}
            onAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing}
          />
        )}

        {/* Market Insights */}
        {analysis && !sessionId && <MarketInsights analysis={analysis} />}

        {/* Execution Options */}
        {analysis && !sessionId && (
          <ExecutionOptions
            options={analysis.options}
            onExecute={handleExecuteOption}
            onReset={handleReset}
            isExecuting={isExecuting}
          />
        )}

        {/* Transaction Success */}
        {sessionId && (
          <OutputContainer>
            <div className='flex flex-col gap-4'>
              <div className='bg-green-500 bg-opacity-10 border border-green-500 rounded-lg p-6'>
                <p className='text-green-500 font-semibold text-lg mb-2'>
                  {executionType === 'limit'
                    ? '✅ Limit Order Created Successfully!'
                    : '✅ Trade Executed Successfully!'}
                </p>
                <p className='text-sm text-primary'>
                  {executionType === 'limit'
                    ? 'Your limit order has been created and will execute automatically when the target price is reached (2% lower). The backend executor monitors prices every 30 seconds.'
                    : 'Your swap has been submitted to xExchange. Sign the transaction in your wallet to complete.'}
                </p>
              </div>

              {transactions.map((tx) => (
                <div
                  key={tx.hash}
                  className='bg-secondary bg-opacity-20 border border-secondary rounded-lg p-4'
                >
                  <p className='text-xs text-secondary mb-2'>
                    Transaction Hash:
                  </p>
                  <MvxDataWithExplorerLink
                    data={tx.hash || ''}
                    withTooltip={true}
                  />
                  <p className='text-xs text-secondary mt-3'>
                    Status:{' '}
                    <span className='text-link font-semibold'>{tx.status}</span>
                  </p>
                </div>
              ))}

              <button
                onClick={handleNewTrade}
                className='w-full py-3 px-6 rounded-lg bg-link text-white font-medium hover:bg-opacity-90 transition-all'
              >
                🧭 Analyze Another Trade
              </button>
            </div>
          </OutputContainer>
        )}
      </div>
    </Card>
  );
};
