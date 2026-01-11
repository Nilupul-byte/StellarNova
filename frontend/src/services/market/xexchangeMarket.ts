/**
 * xExchange Market Data Service
 *
 * Fetches real-time market data from xExchange GraphQL API
 * for AI-powered trade analysis in Atlas mode
 */

const XEXCHANGE_GRAPHQL_API = 'https://graph.xexchange.com/graphql';

interface PairData {
  address: string;
  firstToken: {
    identifier: string;
    name: string;
    decimals: number;
  };
  secondToken: {
    identifier: string;
    name: string;
    decimals: number;
  };
  lockedValueUSD: string;
  volumeUSD24h: string;
  info: {
    reserves0: string;
    reserves1: string;
  };
  state: string;
}

/**
 * Fetch pair data from xExchange GraphQL API
 */
export async function fetchPairData(
  token1Identifier: string,
  token2Identifier: string
): Promise<PairData | null> {
  const query = `
    query GetPair {
      pairs(offset: 0, limit: 100) {
        address
        firstToken {
          identifier
          name
          decimals
        }
        secondToken {
          identifier
          name
          decimals
        }
        lockedValueUSD
        volumeUSD24h
        info {
          reserves0
          reserves1
        }
        state
      }
    }
  `;

  try {
    console.log('📡 [xExchange API] Fetching pairs for:', {
      token1Identifier,
      token2Identifier
    });

    const response = await fetch(XEXCHANGE_GRAPHQL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    const result = await response.json();

    if (result.errors) {
      console.error('❌ [xExchange API] GraphQL errors:', result.errors);
      return null;
    }

    const pairs: PairData[] = result.data.pairs;
    console.log(`📊 [xExchange API] Found ${pairs.length} pairs total`);

    // Find the matching pair
    const pair = pairs.find(
      (p) =>
        (p.firstToken.identifier === token1Identifier &&
          p.secondToken.identifier === token2Identifier) ||
        (p.firstToken.identifier === token2Identifier &&
          p.secondToken.identifier === token1Identifier)
    );

    if (pair) {
      console.log('✅ [xExchange API] Matching pair found:', pair.address);
    } else {
      console.warn(
        '⚠️ [xExchange API] No matching pair found. Available pairs with WEGLD:'
      );
      pairs
        .filter(
          (p) =>
            p.firstToken.identifier.includes('WEGLD') ||
            p.secondToken.identifier.includes('WEGLD')
        )
        .slice(0, 5)
        .forEach((p) => {
          console.log(
            `  - ${p.firstToken.identifier} / ${p.secondToken.identifier}`
          );
        });
    }

    return pair || null;
  } catch (error) {
    console.error('❌ [xExchange API] Error fetching pair data:', error);
    return null;
  }
}

/**
 * Calculate trend based on 24h price change
 */
export function calculateTrend(
  priceChange24h: number
): 'bullish' | 'bearish' | 'ranging' {
  if (priceChange24h > 3) return 'bullish';
  if (priceChange24h < -3) return 'bearish';
  return 'ranging';
}

/**
 * Calculate volatility based on price movement
 */
export function calculateVolatility(
  priceChange24h: number
): 'low' | 'medium' | 'high' {
  const absChange = Math.abs(priceChange24h);
  if (absChange < 2) return 'low';
  if (absChange < 5) return 'medium';
  return 'high';
}

/**
 * Get liquidity depth rating
 */
export function getLiquidityDepth(
  liquidityUSD: number
): 'low' | 'medium' | 'high' {
  if (liquidityUSD > 1_000_000) return 'high';
  if (liquidityUSD > 100_000) return 'medium';
  return 'low';
}

/**
 * Get comprehensive market analysis for a trading pair
 */
export async function getMarketAnalysis(
  fromToken: string,
  toToken: string
): Promise<{
  trend: 'bullish' | 'bearish' | 'ranging';
  volatility: 'low' | 'medium' | 'high';
  liquidity: {
    depth: 'low' | 'medium' | 'high';
    usdValue: number;
  };
  priceChange24h: number;
  volume24h: number;
  hasData: boolean;
} | null> {
  console.log('🔍 [Market Analysis] Fetching data for:', {
    fromToken,
    toToken
  });
  const pairData = await fetchPairData(fromToken, toToken);

  if (!pairData) {
    console.error('❌ [Market Analysis] No pair data found for:', {
      fromToken,
      toToken
    });
    return null;
  }

  console.log('✅ [Market Analysis] Pair data found:', pairData);

  const liquidityUSD = parseFloat(pairData.lockedValueUSD);
  const volume24h = parseFloat(pairData.volumeUSD24h);

  // Calculate approximate price change (simplified - would need historical data for accuracy)
  // For now, we'll estimate based on volume/liquidity ratio
  const volumeToLiquidityRatio = (volume24h / liquidityUSD) * 100;
  const estimatedPriceChange = volumeToLiquidityRatio / 10; // Rough estimate

  return {
    trend: calculateTrend(estimatedPriceChange),
    volatility: calculateVolatility(estimatedPriceChange),
    liquidity: {
      depth: getLiquidityDepth(liquidityUSD),
      usdValue: liquidityUSD
    },
    priceChange24h: estimatedPriceChange,
    volume24h: volume24h,
    hasData: true
  };
}
