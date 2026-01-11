/**
 * Atlas AI Analysis Service
 *
 * Uses DeepSeek AI to provide intelligent trading recommendations
 * based on market data from xExchange
 */

interface MarketData {
  trend: 'bullish' | 'bearish' | 'ranging';
  volatility: 'low' | 'medium' | 'high';
  liquidity: {
    depth: 'low' | 'medium' | 'high';
    usdValue: number;
  };
  priceChange24h: number;
  volume24h: number;
}

interface ExecutionOption {
  id: number;
  action: string;
  risk: 'low' | 'medium' | 'high';
  description: string;
}

interface AnalysisResult {
  trend: string;
  volatility: string;
  liquidity: { depth: string; usdValue: number };
  priceChange24h: number;
  volume24h: number;
  recommendation: string;
  options: ExecutionOption[];
}

/**
 * Call DeepSeek API for trade analysis
 */
export async function analyzeTradeWithAI(
  prompt: string,
  marketData: MarketData
): Promise<AnalysisResult> {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error('DeepSeek API key not configured');
  }

  const systemPrompt = `You are Atlas, an AI trading advisor for StellarNova on MultiversX blockchain.

Your role:
- Analyze market conditions (trend, volatility, liquidity)
- Provide clear, actionable trading recommendations
- Suggest 3 execution strategies (market buy, delayed buy, split order)
- Assess risk for each strategy

Market Data:
- Trend: ${marketData.trend} (${marketData.priceChange24h.toFixed(2)}% change)
- Volatility: ${marketData.volatility}
- Liquidity: ${
    marketData.liquidity.depth
  } ($${marketData.liquidity.usdValue.toLocaleString()})
- 24h Volume: $${marketData.volume24h.toLocaleString()}

Provide:
1. Brief market assessment (2 sentences)
2. Recommendation (execute now / wait / split order)
3. Risk warning if applicable

Keep your response concise and actionable.`;

  try {
    const response = await fetch(
      'https://api.deepseek.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `User wants to: ${prompt}` }
          ],
          temperature: 0.7,
          max_tokens: 300
        })
      }
    );

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Generate execution options based on market conditions
    const options = generateExecutionOptions(marketData);

    return {
      trend: marketData.trend,
      volatility: marketData.volatility,
      liquidity: marketData.liquidity,
      priceChange24h: marketData.priceChange24h,
      volume24h: marketData.volume24h,
      recommendation: aiResponse,
      options
    };
  } catch (error) {
    console.error('AI analysis error:', error);

    // Fallback to rule-based analysis
    return generateFallbackAnalysis(marketData);
  }
}

/**
 * Generate execution options based on market conditions
 */
function generateExecutionOptions(marketData: MarketData): ExecutionOption[] {
  const { trend, volatility, liquidity } = marketData;

  const options: ExecutionOption[] = [
    {
      id: 1,
      action: 'Market buy now',
      risk: volatility === 'high' ? 'medium' : 'low',
      description: 'Execute immediately at current market price'
    }
  ];

  // Option 2: Wait and re-analyze (good for volatile markets)
  if (volatility === 'medium' || volatility === 'high') {
    options.push({
      id: 2,
      action: 'Wait 5 minutes, re-analyze',
      risk: 'medium',
      description: 'Monitor price movement and buy if conditions improve'
    });
  } else {
    options.push({
      id: 2,
      action: 'Place limit buy 2% lower',
      risk: 'low',
      description: 'Wait for a better entry price (requires manual monitoring)'
    });
  }

  // Option 3: Split order (always a good option for larger trades)
  options.push({
    id: 3,
    action: 'Split order: 50% now, 50% in 5 min',
    risk: 'low',
    description: 'Average your entry price to reduce timing risk'
  });

  return options;
}

/**
 * Fallback analysis if AI fails
 */
function generateFallbackAnalysis(marketData: MarketData): AnalysisResult {
  const { trend, volatility, liquidity } = marketData;

  let recommendation = '';

  if (trend === 'bullish' && volatility === 'low') {
    recommendation =
      'Market conditions are favorable. Price is trending upward with stable volatility. Good time to execute.';
  } else if (trend === 'bearish') {
    recommendation =
      'Market is trending down. Consider waiting for stabilization or execute with caution.';
  } else if (volatility === 'high') {
    recommendation =
      'High volatility detected. Consider splitting your order to average entry price.';
  } else {
    recommendation =
      'Market conditions are stable. Execute when ready or wait for better entry.';
  }

  if (liquidity.depth === 'low') {
    recommendation += ' ⚠️ Warning: Low liquidity may cause higher slippage.';
  }

  return {
    trend: marketData.trend,
    volatility: marketData.volatility,
    liquidity: marketData.liquidity,
    priceChange24h: marketData.priceChange24h,
    volume24h: marketData.volume24h,
    recommendation,
    options: generateExecutionOptions(marketData)
  };
}
