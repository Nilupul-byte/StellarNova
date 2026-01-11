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
    currentPrice?: number;
    tokenPair?: string;
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

  const formatRecommendation = (text: string) => {
    // Split by common markers and format for better readability
    const sections = text.split(/\*\*([^*]+)\*\*/g);
    return sections.map((section, index) => {
      // Bold sections (odd indices after split)
      if (index % 2 === 1) {
        return (
          <strong key={index} className='font-semibold text-primary'>
            {section}
          </strong>
        );
      }
      // Regular text
      return <span key={index}>{section}</span>;
    });
  };

  return (
    <div className='bg-secondary bg-opacity-20 rounded-lg p-6 border border-secondary space-y-6'>
      <h3 className='text-xl font-semibold text-primary mb-0'>
        🔍 AI Market Insights
      </h3>

      {/* Current Price - Prominent Display */}
      {analysis.currentPrice && analysis.tokenPair && (
        <div className='bg-link bg-opacity-5 rounded-lg p-4 border border-link border-opacity-30'>
          <div className='flex items-baseline justify-between'>
            <div className='flex flex-col gap-1'>
              <span className='text-sm text-secondary font-medium'>
                Current Price
              </span>
              <div className='flex items-baseline gap-3'>
                <span className='text-3xl font-bold text-primary'>
                  ${analysis.currentPrice.toFixed(6)}
                </span>
                <span className='text-lg text-secondary'>
                  {analysis.tokenPair}
                </span>
              </div>
            </div>
            <div className='text-right'>
              <span
                className={`text-2xl font-semibold ${getTrendColor(
                  analysis.trend
                )}`}
              >
                {analysis.priceChange24h > 0
                  ? '↗'
                  : analysis.priceChange24h < 0
                  ? '↘'
                  : '→'}{' '}
                {Math.abs(analysis.priceChange24h).toFixed(2)}%
              </span>
              <div className='text-sm text-secondary mt-1'>24h Change</div>
            </div>
          </div>
        </div>
      )}

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        {/* Trend */}
        <div className='flex flex-col gap-1'>
          <span className='text-sm text-secondary font-medium'>
            Market Trend
          </span>
          <span
            className={`text-lg font-semibold capitalize ${getTrendColor(
              analysis.trend
            )}`}
          >
            {analysis.trend}
          </span>
        </div>

        {/* Volatility */}
        <div className='flex flex-col gap-1'>
          <span className='text-sm text-secondary font-medium'>Volatility</span>
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
          <span className='text-sm text-secondary font-medium'>
            Liquidity on xExchange
          </span>
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
          <span className='text-sm text-secondary font-medium'>24h Volume</span>
          <span className='text-lg font-semibold text-primary'>
            {formatUSD(analysis.volume24h)}
          </span>
        </div>
      </div>

      {/* AI Recommendation */}
      <div className='bg-link bg-opacity-10 rounded-lg p-5 border border-link'>
        <div className='flex items-start gap-3'>
          <span className='text-2xl flex-shrink-0'>💡</span>
          <div className='flex flex-col gap-2 flex-1'>
            <span className='text-sm font-semibold text-primary uppercase tracking-wide'>
              AI Recommendation
            </span>
            <div className='text-base text-primary leading-relaxed'>
              {formatRecommendation(analysis.recommendation)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
