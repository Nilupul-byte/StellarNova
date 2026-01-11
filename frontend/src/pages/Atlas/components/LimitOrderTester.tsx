import { useState } from 'react';
import { Card } from 'components/Card';
import {
  MvxDataWithExplorerLink,
  useGetAccount,
  useGetPendingTransactions
} from 'lib';
import { getTokenByTicker } from 'lib/stellarnova';
import {
  calculateTargetPriceWithDecimals,
  getCurrentPriceFromXExchange,
  useLimitOrders
} from 'lib/stellarnova/limitOrders';

export const LimitOrderTester = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [mode, setMode] = useState<'instant' | 'waiting' | 'custom' | null>(null);
  const [customPrice, setCustomPrice] = useState<string>('');
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [testAmount, setTestAmount] = useState<string>('0.01'); // Default 0.01 (small test amount)
  const [tradeDirection, setTradeDirection] = useState<'buy' | 'sell'>('buy'); // buy WEGLD or sell WEGLD

  const { createLimitOrder } = useLimitOrders();
  const transactions = useGetPendingTransactions();

  // Token pair based on direction
  const fromToken =
    tradeDirection === 'buy'
      ? getTokenByTicker('USDC')
      : getTokenByTicker('WEGLD');
  const toToken =
    tradeDirection === 'buy'
      ? getTokenByTicker('WEGLD')
      : getTokenByTicker('USDC');

  const handleFetchPrice = async () => {
    if (!fromToken || !toToken) {
      setError('Invalid token pair');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const priceData = await getCurrentPriceFromXExchange(
        fromToken.identifier,
        toToken.identifier
      );

      if (!priceData) {
        throw new Error('Could not fetch price from xExchange');
      }

      setCurrentPrice(priceData.price);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch price');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!currentPrice || !mode || !fromToken || !toToken) {
      setError('Please fetch price and select mode first');
      return;
    }

    const amount = parseFloat(testAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Invalid amount');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Calculate target price based on mode
      let targetPrice: number;
      if (mode === 'instant') {
        // 0.01% ABOVE current price (executes immediately)
        targetPrice = currentPrice * 1.0001;
      } else if (mode === 'waiting') {
        // 0.01% BELOW current price (waits for price drop)
        targetPrice = currentPrice * 0.9999;
      } else if (mode === 'custom') {
        // Custom price entered by user
        const customPriceNum = parseFloat(customPrice);
        if (isNaN(customPriceNum) || customPriceNum <= 0) {
          setError('Invalid custom price');
          setIsLoading(false);
          return;
        }
        targetPrice = customPriceNum;
      } else {
        setError('Invalid mode selected');
        setIsLoading(false);
        return;
      }

      console.log('🎯 Target price:', {
        current: currentPrice,
        target: targetPrice,
        mode,
        percentDiff:
          (((targetPrice - currentPrice) / currentPrice) * 100).toFixed(4) + '%'
      });

      // JEXchange architecture: Direct ESDT payment with order creation
      setProgressMessage('Please sign the transaction in your wallet...');

      // Calculate price with proper decimal adjustment
      const { numerator, denominator } = calculateTargetPriceWithDecimals(
        targetPrice,
        fromToken.decimals,
        toToken.decimals
      );

      console.log('📊 Price as fraction (decimal-adjusted):', {
        numerator,
        denominator,
        price: numerator / denominator,
        fromDecimals: fromToken.decimals,
        toDecimals: toToken.decimals
      });

      // Create limit order with direct ESDT payment
      const txSessionId = await createLimitOrder({
        fromToken: fromToken.identifier,
        fromAmount: amount,
        fromDecimals: fromToken.decimals,
        toToken: toToken.identifier,
        targetPriceNum: numerator,
        targetPriceDenom: denominator,
        slippageBp: 1500, // 15% slippage (for reliable demo execution)
        durationSeconds: 3600 // 1 hour
      });

      if (txSessionId) {
        console.log('✅ Limit order created! Session ID:', txSessionId);
        setSessionId(txSessionId);
        setProgressMessage('');
      }
    } catch (err: any) {
      console.error('❌ Failed to create order:', err);
      setError(err.message || 'Failed to create order');
      setProgressMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setCurrentPrice(null);
    setMode(null);
    setCustomPrice('');
    setSessionId(null);
    setError(null);
    setProgressMessage('');
  };

  const handleDirectionChange = (direction: 'buy' | 'sell') => {
    setTradeDirection(direction);
    setCurrentPrice(null);
    setMode(null);
    setSessionId(null);
    setError(null);
    setProgressMessage('');
  };

  if (!fromToken || !toToken) {
    return (
      <Card
        title='⚡ Limit Orders'
        description='Non-custodial on-chain swaps'
      >
        <div className='text-red-500'>
          ❌ Invalid token configuration. Please check token setup.
        </div>
      </Card>
    );
  }

  return (
    <Card
      title='⚡ Limit Orders'
      description='Non-custodial on-chain swaps'
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

        {/* Success Message */}
        {sessionId && (
          <div className='flex flex-col gap-4'>
            <div className='bg-green-500 bg-opacity-10 border border-green-500 rounded-lg p-6'>
              <p className='text-green-500 font-semibold text-lg mb-2'>
                ✅ Limit Order Created Successfully!
              </p>
              <p className='text-sm text-primary mb-2'>
                {mode === 'instant'
                  ? '⏰ This order will execute within 30 seconds (async swap on xExchange)!'
                  : '⏳ This order will wait until price drops by 0.01%'}
              </p>
              <p className='text-xs text-secondary'>
                💡 Tokens sent with order creation (no vault deposit needed)
              </p>
              <p className='text-xs text-secondary'>
                Check backend logs:{' '}
                <code className='bg-black bg-opacity-20 px-2 py-1 rounded'>
                  cd ~/Nova/stellarnova/backend && npm start
                </code>
              </p>
            </div>

            {transactions.map((tx) => (
              <div
                key={tx.hash}
                className='bg-secondary bg-opacity-20 border border-secondary rounded-lg p-4'
              >
                <p className='text-xs text-secondary mb-2'>Transaction Hash:</p>
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
              onClick={handleReset}
              className='w-full py-3 px-6 rounded-lg bg-link text-white font-medium hover:bg-opacity-90 transition-all'
            >
              🧪 Create Another Test Order
            </button>
          </div>
        )}

        {/* Main Interface */}
        {!sessionId && (
          <>
            {/* Direction Selector */}
            <div className='grid grid-cols-2 gap-4'>
              <button
                onClick={() => handleDirectionChange('buy')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  tradeDirection === 'buy'
                    ? 'border-green-500 bg-green-500 bg-opacity-10'
                    : 'border-secondary hover:border-link'
                }`}
              >
                <div className='text-center'>
                  <div className='text-2xl mb-1'>📈</div>
                  <p className='font-semibold text-primary'>Buy WEGLD</p>
                  <p className='text-xs text-secondary mt-1'>USDC → WEGLD</p>
                </div>
              </button>
              <button
                onClick={() => handleDirectionChange('sell')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  tradeDirection === 'sell'
                    ? 'border-red-500 bg-red-500 bg-opacity-10'
                    : 'border-secondary hover:border-link'
                }`}
              >
                <div className='text-center'>
                  <div className='text-2xl mb-1'>📉</div>
                  <p className='font-semibold text-primary'>Sell WEGLD</p>
                  <p className='text-xs text-secondary mt-1'>WEGLD → USDC</p>
                </div>
              </button>
            </div>

            {/* Token Pair Info */}
            <div className='bg-secondary bg-opacity-20 border border-secondary rounded-lg p-4'>
              <p className='text-sm text-secondary mb-2'>Selected Pair:</p>
              <p className='text-lg font-semibold text-primary'>
                {fromToken.ticker} → {toToken.ticker}
              </p>
              <p className='text-xs text-secondary mt-1'>
                {fromToken.identifier} / {toToken.identifier}
              </p>
            </div>

            {/* Amount Input */}
            <div>
              <label className='block text-sm font-medium text-primary mb-2'>
                Amount ({fromToken.ticker})
              </label>
              <input
                type='number'
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value)}
                step='0.01'
                min='0.01'
                className='w-full px-4 py-3 bg-secondary bg-opacity-20 border border-secondary rounded-lg text-primary focus:border-link focus:outline-none'
                placeholder='Enter amount (e.g., 0.01)'
              />
              <p className='text-xs text-secondary mt-1'>
                {tradeDirection === 'buy'
                  ? `Small test amounts work now! (e.g., 0.01-0.1 ${fromToken.ticker})`
                  : `Small test amounts work now! (e.g., 0.001-0.01 ${fromToken.ticker})`}
              </p>
            </div>

            {/* Step 1: Fetch Price */}
            {!currentPrice && (
              <button
                onClick={handleFetchPrice}
                disabled={isLoading}
                className='w-full py-3 px-6 rounded-lg bg-link text-white font-medium hover:bg-opacity-90 disabled:bg-secondary disabled:cursor-not-allowed transition-all'
              >
                {isLoading ? 'Fetching...' : '📊 Step 1: Fetch Current Price'}
              </button>
            )}

            {/* Step 2: Select Mode */}
            {currentPrice && !mode && (
              <div className='flex flex-col gap-4'>
                <div className='bg-blue-500 bg-opacity-10 border border-blue-500 rounded-lg p-4'>
                  <p className='text-sm text-secondary mb-1'>Current Price:</p>
                  <p className='text-2xl font-bold text-primary'>
                    {currentPrice.toFixed(6)} {toToken.ticker}
                  </p>
                  <p className='text-xs text-secondary mt-1'>
                    per 1 {fromToken.ticker}
                  </p>
                </div>

                <div className='border-t border-secondary pt-4'>
                  <h3 className='text-lg font-semibold text-primary mb-4'>
                    📍 Step 2: Select Order Type
                  </h3>

                  <div className='grid grid-cols-1 gap-4'>
                    {/* Mode 1: Instant */}
                    <button
                      onClick={() => setMode('instant')}
                      className='text-left p-4 rounded-lg border-2 border-green-500 hover:bg-green-500 hover:bg-opacity-10 transition-all'
                    >
                      <div className='flex items-start justify-between gap-4'>
                        <div className='flex-1'>
                          <div className='flex items-center gap-2 mb-2'>
                            <span className='font-semibold text-primary'>
                              ⚡ INSTANT EXECUTION
                            </span>
                            <span className='text-xs px-2 py-1 rounded-full border border-green-500 text-green-500'>
                              0.01% ABOVE
                            </span>
                          </div>
                          <p className='text-sm text-secondary'>
                            Target:{' '}
                            <span className='font-mono text-primary'>
                              {(currentPrice * 1.0001).toFixed(6)}
                            </span>{' '}
                            {toToken.ticker}
                          </p>
                          <p className='text-xs text-secondary mt-1'>
                            Executes immediately (within 30 seconds)
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Mode 2: Waiting */}
                    <button
                      onClick={() => setMode('waiting')}
                      className='text-left p-4 rounded-lg border-2 border-yellow-500 hover:bg-yellow-500 hover:bg-opacity-10 transition-all'
                    >
                      <div className='flex items-start justify-between gap-4'>
                        <div className='flex-1'>
                          <div className='flex items-center gap-2 mb-2'>
                            <span className='font-semibold text-primary'>
                              ⏳ DELAYED EXECUTION
                            </span>
                            <span className='text-xs px-2 py-1 rounded-full border border-yellow-500 text-yellow-500'>
                              0.01% BELOW
                            </span>
                          </div>
                          <p className='text-sm text-secondary'>
                            Target:{' '}
                            <span className='font-mono text-primary'>
                              {(currentPrice * 0.9999).toFixed(6)}
                            </span>{' '}
                            {toToken.ticker}
                          </p>
                          <p className='text-xs text-secondary mt-1'>
                            Waits for price to drop by 0.01%
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Mode 3: Custom Price */}
                    <div className='p-4 rounded-lg border-2 border-link'>
                      <div className='mb-3'>
                        <div className='flex items-center gap-2 mb-2'>
                          <span className='font-semibold text-primary'>
                            🎯 CUSTOM PRICE
                          </span>
                          <span className='text-xs px-2 py-1 rounded-full border border-link text-link'>
                            YOUR PRICE
                          </span>
                        </div>
                        <p className='text-xs text-secondary'>
                          Set your own target price for execution
                        </p>
                      </div>
                      <input
                        type='number'
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                        onFocus={() => setMode('custom')}
                        step='0.000001'
                        placeholder={`e.g., ${currentPrice.toFixed(6)}`}
                        className='w-full px-4 py-2 bg-secondary bg-opacity-20 border border-secondary rounded-lg text-primary focus:border-link focus:outline-none mb-2'
                      />
                      <p className='text-xs text-secondary'>
                        Current: {currentPrice.toFixed(6)} {toToken.ticker}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Create Order */}
            {currentPrice &&
              ((mode === 'instant' || mode === 'waiting') ||
                (mode === 'custom' &&
                  customPrice &&
                  parseFloat(customPrice) > 0)) && (
              <div className='flex flex-col gap-4'>
                <div className='bg-secondary bg-opacity-20 border border-secondary rounded-lg p-4'>
                  <div className='grid grid-cols-2 gap-4'>
                    <div>
                      <p className='text-xs text-secondary mb-1'>
                        Current Price:
                      </p>
                      <p className='text-lg font-semibold text-primary'>
                        {currentPrice.toFixed(6)}
                      </p>
                    </div>
                    <div>
                      <p className='text-xs text-secondary mb-1'>
                        Target Price:
                      </p>
                      <p className='text-lg font-semibold text-primary'>
                        {mode === 'instant'
                          ? (currentPrice * 1.0001).toFixed(6)
                          : mode === 'waiting'
                          ? (currentPrice * 0.9999).toFixed(6)
                          : parseFloat(customPrice || '0').toFixed(6)}
                      </p>
                    </div>
                  </div>
                  <div className='mt-3 pt-3 border-t border-secondary'>
                    <p className='text-xs text-secondary mb-1'>Mode:</p>
                    <p className='text-sm font-medium text-primary'>
                      {mode === 'instant'
                        ? '⚡ INSTANT (0.01% ABOVE)'
                        : mode === 'waiting'
                        ? '⏳ DELAYED (0.01% BELOW)'
                        : `🎯 CUSTOM (${customPrice ? parseFloat(customPrice).toFixed(6) : '0.000000'})`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleCreateOrder}
                  disabled={isLoading}
                  className='w-full py-3 px-6 rounded-lg bg-link text-white font-medium hover:bg-opacity-90 disabled:bg-secondary disabled:cursor-not-allowed transition-all'
                >
                  {isLoading ? (
                    <span className='flex items-center justify-center gap-2'>
                      <svg className='animate-spin h-5 w-5' viewBox='0 0 24 24'>
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
                      Creating...
                    </span>
                  ) : (
                    `🚀 Step 3: Create Limit Order (${testAmount} ${fromToken.ticker})`
                  )}
                </button>

                <button
                  onClick={handleReset}
                  disabled={isLoading}
                  className='w-full px-6 py-2 rounded-lg border border-secondary text-primary hover:border-link transition-all'
                >
                  Reset
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
};
