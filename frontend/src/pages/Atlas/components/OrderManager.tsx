import { useEffect, useState } from 'react';
import { Card } from 'components/Card';
import { useGetAccount } from 'lib';
import {
  getUserPendingOrders,
  LimitOrder,
  useLimitOrders
} from 'lib/stellarnova/limitOrders';

export const OrderManager = () => {
  const { address } = useGetAccount();
  const { cancelLimitOrder } = useLimitOrders();

  const [orders, setOrders] = useState<LimitOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // Fetch orders
  const fetchOrders = async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const userOrders = await getUserPendingOrders(address);
      setOrders(userOrders);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch orders on mount and when address changes
  useEffect(() => {
    fetchOrders();
  }, [address]);

  // Handle cancel order
  const handleCancelOrder = async (orderId: number) => {
    setCancellingOrderId(orderId);
    setError(null);

    try {
      await cancelLimitOrder(orderId);

      // Wait a bit for blockchain to process
      setTimeout(() => {
        fetchOrders();
        setCancellingOrderId(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel order');
      setCancellingOrderId(null);
    }
  };

  // Format token amount from hex
  const formatAmount = (hexAmount: string, decimals: number): string => {
    try {
      const amount = BigInt('0x' + hexAmount);
      const divisor = BigInt(10 ** decimals);
      const whole = amount / divisor;
      const fraction = amount % divisor;

      if (fraction === 0n) {
        return whole.toString();
      }

      const fractionStr = fraction
        .toString()
        .padStart(decimals, '0')
        .slice(0, 6);
      return `${whole}.${fractionStr}`.replace(/\.?0+$/, '');
    } catch {
      return '0';
    }
  };

  // Format target price (proper BigInt division)
  const formatTargetPrice = (numHex: string, denomHex: string): string => {
    try {
      const num = BigInt('0x' + numHex);
      const denom = BigInt('0x' + denomHex);

      // Avoid Number conversion overflow - do division in BigInt space
      // Multiply numerator by 10^6 for 6 decimal places precision
      const PRECISION = BigInt(1000000);
      const scaled = (num * PRECISION) / denom;
      const price = Number(scaled) / Number(PRECISION);

      // Detect invalid prices (likely from incorrect decimal adjustments)
      // Reasonable price range: 0.000001 to 1,000,000
      if (price < 0.000001 || price > 1000000) {
        return 'Invalid';
      }

      return price.toFixed(6);
    } catch {
      return 'N/A';
    }
  };

  // Get token ticker from identifier
  const getTokenTicker = (identifier: string): string => {
    const parts = identifier.split('-');
    return parts[0];
  };

  // Check if order is expired
  const isExpired = (expiresAt: Date): boolean => {
    try {
      if (!expiresAt || isNaN(expiresAt.getTime())) {
        return false; // Treat invalid dates as not expired
      }
      return new Date() > expiresAt;
    } catch {
      return false;
    }
  };

  // Format time remaining
  const formatTimeRemaining = (expiresAt: Date): string => {
    try {
      // Check if date is valid
      if (!expiresAt || isNaN(expiresAt.getTime())) {
        return 'N/A';
      }

      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) return 'Expired';

      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) return `${days}d ${hours % 24}h`;
      if (hours > 0) return `${hours}h ${minutes % 60}m`;
      return `${minutes}m`;
    } catch {
      return 'N/A';
    }
  };

  if (!address) {
    return (
      <Card
        title='📋 Order Manager'
        description='Manage your pending limit orders'
      >
        <div className='text-center py-8 text-secondary'>
          Please connect your wallet to view orders
        </div>
      </Card>
    );
  }

  return (
    <Card
      title='📋 Order Manager'
      description='Manage your pending limit orders'
    >
      <div className='flex flex-col gap-4'>
        {/* Refresh Button */}
        <div className='flex justify-between items-center'>
          <p className='text-sm text-secondary'>
            {orders.length} pending order{orders.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={fetchOrders}
            disabled={isLoading}
            className='px-4 py-2 rounded-lg bg-secondary bg-opacity-20 hover:bg-opacity-30 text-primary text-sm font-medium transition-all disabled:opacity-50'
          >
            {isLoading ? '🔄 Loading...' : '🔄 Refresh'}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className='bg-red-500 bg-opacity-10 border border-red-500 rounded-lg p-3'>
            <p className='text-red-500 text-sm'>❌ {error}</p>
          </div>
        )}

        {/* Orders List */}
        {isLoading && orders.length === 0 ? (
          <div className='text-center py-8 text-secondary'>
            <div className='animate-spin h-8 w-8 border-4 border-link border-t-transparent rounded-full mx-auto mb-4'></div>
            Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <div className='text-center py-8 text-secondary'>
            No pending orders found
          </div>
        ) : (
          <div className='space-y-4'>
            {orders.map((order) => {
              const expired = isExpired(order.expiresAt);
              const fromTicker = getTokenTicker(order.fromToken);
              const toTicker = getTokenTicker(order.toToken);
              const fromDecimals = fromTicker === 'USDC' ? 6 : 18;
              const targetPrice = formatTargetPrice(
                order.targetPriceNum,
                order.targetPriceDenom
              );
              const isInvalidPrice =
                targetPrice === 'Invalid' || targetPrice === 'N/A';

              return (
                <div
                  key={order.orderId}
                  className={`p-5 rounded-lg border-2 transition-all ${
                    expired
                      ? 'border-yellow-500 bg-yellow-500 bg-opacity-5'
                      : isInvalidPrice
                      ? 'border-red-500 bg-red-500 bg-opacity-5'
                      : 'border-secondary bg-secondary bg-opacity-10 hover:border-link hover:bg-opacity-20'
                  }`}
                >
                  <div className='flex items-start justify-between gap-4'>
                    <div className='flex-1 space-y-3'>
                      {/* Order Header */}
                      <div className='flex items-center gap-2'>
                        <span className='text-sm px-3 py-1 rounded-full bg-link bg-opacity-20 text-link font-semibold'>
                          #{order.orderId}
                        </span>
                        {expired && (
                          <span className='text-xs px-2 py-1 rounded-full bg-yellow-500 bg-opacity-20 text-yellow-500 font-medium'>
                            ⏰ Expired
                          </span>
                        )}
                        {isInvalidPrice && (
                          <span className='text-xs px-2 py-1 rounded-full bg-red-500 bg-opacity-20 text-red-500 font-medium'>
                            ⚠️ Invalid Price
                          </span>
                        )}
                      </div>

                      {/* Token Pair */}
                      <div>
                        <p className='text-xl font-bold text-primary mb-1'>
                          {fromTicker} → {toTicker}
                        </p>
                        <p className='text-sm text-secondary'>
                          Amount:{' '}
                          <span className='font-semibold text-primary'>
                            {formatAmount(order.fromAmount, fromDecimals)}{' '}
                            {fromTicker}
                          </span>
                        </p>
                      </div>

                      {/* Order Details */}
                      <div className='grid grid-cols-2 gap-3 pt-2 border-t border-secondary border-opacity-50'>
                        <div>
                          <p className='text-xs text-secondary mb-1'>
                            Target Price:
                          </p>
                          <p
                            className={`font-semibold ${
                              isInvalidPrice
                                ? 'text-red-500'
                                : 'text-primary text-base'
                            }`}
                          >
                            {targetPrice}{' '}
                            {!isInvalidPrice && <span>{toTicker}</span>}
                          </p>
                        </div>
                        <div>
                          <p className='text-xs text-secondary mb-1'>
                            Expires:
                          </p>
                          <p
                            className={`font-semibold text-base ${
                              expired
                                ? 'text-yellow-500'
                                : 'text-primary'
                            }`}
                          >
                            {formatTimeRemaining(order.expiresAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Cancel Button */}
                    <button
                      onClick={() => handleCancelOrder(order.orderId)}
                      disabled={cancellingOrderId === order.orderId}
                      className='px-4 py-2 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 disabled:bg-secondary disabled:cursor-not-allowed transition-all whitespace-nowrap h-fit'
                    >
                      {cancellingOrderId === order.orderId ? (
                        <span className='flex items-center gap-2'>
                          <svg
                            className='animate-spin h-4 w-4'
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
                          Cancelling...
                        </span>
                      ) : (
                        '🗑️ Cancel'
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};
