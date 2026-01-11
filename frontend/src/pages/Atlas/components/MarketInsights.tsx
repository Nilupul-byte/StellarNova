interface MarketInsightsProps {
  analysis: {
    trend: 'bullish' | 'bearish' | 'ranging';
    volatility: 'low' | 'medium' | 'high';
    liquidity: {
      depth: 'low' | 'medium' | 'high';
      usdValue: number;
    };
    priceChange24h: number;
    volume24h: number;
    recommendation: string;
  };
}

export const MarketInsights = ({ analysis }: MarketInsightsProps) => {
  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'bullish':
        return 'text-green-500';
      case 'bearish':
        return 'text-red-500';
      default:
        return 'text-yellow-500';
    }
  };

  const getVolatilityColor = (volatility: string) => {
    switch (volatility) {
      case 'low':
        return 'text-green-500';
      case 'medium':
        return 'text-yellow-500';
      default:
        return 'text-red-500';
    }
  };

  const getLiquidityColor = (depth: string) => {
    switch (depth) {
      case 'high':
        return 'text-green-500';
      case 'medium':
        return 'text-yellow-500';
      default:
        return 'text-red-500';
    }
  };

  const formatUSD = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className='bg-secondary bg-opacity-20 rounded-lg p-6 border border-secondary'>
      <h3 className='text-xl font-semibold text-primary mb-4'>
        🔍 AI Market Insights
      </h3>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>
        {/* Trend */}
        <div className='flex flex-col gap-1'>
          <span className='text-sm text-secondary'>Market Trend</span>
          <span
            className={`text-lg font-semibold capitalize ${getTrendColor(
              analysis.trend
            )}`}
          >
            {analysis.trend}{' '}
            {analysis.priceChange24h > 0
              ? '↗'
              : analysis.priceChange24h < 0
              ? '↘'
              : '→'}{' '}
            {Math.abs(analysis.priceChange24h).toFixed(2)}%
          </span>
        </div>

        {/* Volatility */}
        <div className='flex flex-col gap-1'>
          <span className='text-sm text-secondary'>Volatility</span>
          <span
            className={`text-lg font-semibold capitalize ${getVolatilityColor(
              analysis.volatility
            )}`}
          >
            {analysis.volatility}
          </span>
        </div>

        {/* Liquidity */}
        <div className='flex flex-col gap-1'>
          <span className='text-sm text-secondary'>Liquidity on xExchange</span>
          <span
            className={`text-lg font-semibold capitalize ${getLiquidityColor(
              analysis.liquidity.depth
            )}`}
          >
            {analysis.liquidity.depth} ({formatUSD(analysis.liquidity.usdValue)}
            )
          </span>
        </div>

        {/* 24h Volume */}
        <div className='flex flex-col gap-1'>
          <span className='text-sm text-secondary'>24h Volume</span>
          <span className='text-lg font-semibold text-primary'>
            {formatUSD(analysis.volume24h)}
          </span>
        </div>
      </div>

      {/* AI Recommendation */}
      <div className='bg-link bg-opacity-10 rounded-lg p-4 border border-link'>
        <div className='flex items-start gap-2'>
          <span className='text-2xl'>💡</span>
          <div className='flex flex-col gap-1'>
            <span className='text-sm font-semibold text-primary'>
              AI Recommendation
            </span>
            <span className='text-base text-primary'>
              {analysis.recommendation}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
