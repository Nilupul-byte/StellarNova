# StellarNova AI Module

> AI-powered trade analysis and natural language processing for intelligent trading

**Current Status:** DeepSeek integration for trade analysis (Atlas AI)

**Future:** Full natural language trading via prompts

---

## Overview

The AI module provides intelligent insights and automation for trading on MultiversX:

1. **Trade Analysis** (✅ Current) - AI-powered risk assessment and recommendations
2. **Natural Language Trading** (🔄 Planned) - Execute trades via plain English
3. **Strategy Automation** (🚀 Future) - DCA, portfolio rebalancing, sentiment analysis

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  AI Module                                       │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │  DeepSeek API Integration                 │  │
│  │  - Trade analysis                         │  │
│  │  - Risk assessment                        │  │
│  │  - Market insights                        │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │  Future: Prompt Parser                    │  │
│  │  - Intent extraction                      │  │
│  │  - Parameter parsing                      │  │
│  │  - Command generation                     │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## Current Implementation: Atlas AI Trade Advisor

**File:** `/frontend/src/services/ai/atlasAnalysis.ts`

### Purpose

Provides AI-powered insights when creating limit orders:
- **Confidence Level** - How strong is this trade?
- **Risk Assessment** - What could go wrong?
- **Market Analysis** - Current conditions and trends
- **Recommendation** - Should you proceed?

### DeepSeek Integration

```typescript
import axios from 'axios';

const DEEPSEEK_API = 'https://api.deepseek.com/v1/chat/completions';
const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;

export async function analyzeTradeWithAI(params: {
  action: 'buy' | 'sell';
  fromToken: string;
  toToken: string;
  amount: number;
  currentPrice: number;
}): Promise<TradeAnalysis> {

  const prompt = `
    Analyze this cryptocurrency trade:

    Action: ${params.action} ${params.toToken}
    Pair: ${params.fromToken}/${params.toToken}
    Amount: ${params.amount} ${params.fromToken}
    Current Price: ${params.currentPrice}

    Provide analysis in this format:
    1. Confidence: [high/medium/low]
    2. Reasoning: [brief explanation]
    3. Risks: [bullet points]
    4. Recommendation: [proceed/caution/avoid]
  `;

  const response = await axios.post(
    DEEPSEEK_API,
    {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are a cryptocurrency trading advisor...'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    },
    {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return parseAIResponse(response.data.choices[0].message.content);
}
```

### Response Format

```typescript
interface TradeAnalysis {
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  risks: string[];
  recommendation: 'proceed' | 'caution' | 'avoid';
  marketCondition?: 'bullish' | 'bearish' | 'neutral';
}
```

### Example Output

```json
{
  "confidence": "medium",
  "reasoning": "WEGLD has shown stable performance over the past week with moderate volume. The current price of 0.155 USDC per WEGLD is within normal range.",
  "risks": [
    "Market volatility could cause rapid price changes",
    "Low liquidity may result in higher slippage",
    "General crypto market sentiment affects price"
  ],
  "recommendation": "caution",
  "marketCondition": "neutral"
}
```

---

## AI Prompt System (Future)

**Status:** Planned for Phase 2

### Vision

Enable trading via natural language:

```
User: "Buy 10 USDC worth of WEGLD when price drops 5%"

AI: ✓ Understood:
    - Action: Create limit order
    - Amount: 10 USDC
    - Target: 5% below current price (0.147 USDC per WEGLD)
    - Duration: Default (1 hour)

    Proceed? [Yes] [No] [Modify]
```

### Architecture

```typescript
// 1. Intent Classification
function classifyIntent(prompt: string): Intent {
  // Categories:
  // - market_swap: "Swap 10 USDC to WEGLD"
  // - limit_order: "Buy when price drops 5%"
  // - dca: "Buy 1 USDC every day for 30 days"
  // - query: "What's the price of WEGLD?"
}

// 2. Parameter Extraction
function extractParameters(prompt: string, intent: Intent): Parameters {
  // Extract:
  // - Tokens (USDC, WEGLD)
  // - Amounts (10, 0.5, "all")
  // - Conditions (when, if, below, above)
  // - Timing (now, tomorrow, daily)
}

// 3. Validation & Confirmation
function validateAndConfirm(params: Parameters): ValidationResult {
  // Check:
  // - Token exists
  // - Amount is valid
  // - User has balance
  // - Conditions are achievable
}

// 4. Execution
function executeCommand(params: Parameters): Transaction {
  // Route to appropriate handler:
  // - Market swap → xExchange direct
  // - Limit order → Atlas contract
  // - DCA → Recurring order system
}
```

### Example Prompts

**Simple Market Swap:**
```
"Swap 10 USDC to WEGLD"
→ Instant market swap via xExchange
```

**Limit Order with Target:**
```
"Buy 0.5 WEGLD when price drops to 6.2 USDC"
→ Create limit order with target 6.2
```

**Conditional Order:**
```
"Sell all my WEGLD if price goes above 7 USDC"
→ Create stop-limit order
```

**DCA Strategy:**
```
"Buy 1 USDC worth of WEGLD every day for 30 days"
→ Create recurring order schedule
```

**Portfolio Rebalancing:**
```
"Keep my portfolio at 50% WEGLD, 50% USDC"
→ Create rebalancing strategy
```

---

## AI Models & Selection

### Current: DeepSeek

**Why DeepSeek?**
- ✅ Cost-effective ($0.14 per 1M tokens)
- ✅ Fast response times
- ✅ Good reasoning capabilities
- ✅ Crypto-aware training data

**Use Cases:**
- Trade analysis and recommendations
- Risk assessment
- Market condition evaluation

### Future: Multi-Model Approach

**OpenAI GPT-4** - Complex strategy planning
- DCA schedules
- Portfolio optimization
- Multi-step strategies

**Claude 3** - Long-form analysis
- Market research
- Technical analysis
- Sentiment analysis

**Local Model (Llama 3)** - Privacy-sensitive operations
- User preference learning
- Trade history analysis
- No data leaves server

---

## AI Safety & Risk Management

### 1. Analysis Disclaimers

Always show:
```
⚠️ AI Analysis is Informational Only

This is NOT financial advice. AI analysis is based on:
- Current market data
- Historical patterns
- General crypto knowledge

Always:
- Do your own research (DYOR)
- Start with small amounts
- Never risk more than you can afford to lose
```

### 2. Execution Safeguards

**Hard Limits:**
```typescript
const AI_SAFEGUARDS = {
  maxSingleTrade: 1000, // Max $1000 per trade
  maxDailyVolume: 5000, // Max $5000 per day
  requireConfirmation: true, // Always ask user to confirm
  disableInVolatileConditions: true // Pause if volatility > 20%
};
```

**User Confirmation Required:**
- All trades > $100
- Any sell that would reduce position > 50%
- Trades during high volatility
- New token pairs

### 3. Prompt Injection Protection

```typescript
function sanitizePrompt(userInput: string): string {
  // Remove system-level instructions
  const dangerous = [
    'ignore previous instructions',
    'system:',
    'admin:',
    'forget your role'
  ];

  let sanitized = userInput;
  for (const pattern of dangerous) {
    sanitized = sanitized.replace(
      new RegExp(pattern, 'gi'),
      '[FILTERED]'
    );
  }

  return sanitized;
}
```

### 4. Rate Limiting

```typescript
const AI_RATE_LIMITS = {
  perUser: {
    requests: 20,
    window: '1h'
  },
  perIP: {
    requests: 100,
    window: '1h'
  }
};
```

---

## Prompt Engineering

### System Prompt Template

```typescript
const SYSTEM_PROMPT = `
You are a cryptocurrency trading advisor for StellarNova, a non-custodial DEX interface on MultiversX.

Your role:
- Analyze trades objectively
- Identify risks clearly
- Provide balanced recommendations
- NEVER guarantee profits
- ALWAYS emphasize risks

Rules:
1. All analysis is informational only, NOT financial advice
2. Focus on risk management
3. Encourage starting small
4. Warn about volatility
5. Be concise and clear

Available actions:
- Market swaps (instant execution)
- Limit orders (execute when price target met)
- View portfolio
- Check prices

Supported tokens:
- WEGLD (MultiversX wrapped EGLD)
- USDC (USD Coin)

Current market data is provided with each request.
`;
```

### User Prompt Examples

**Good Prompt (Specific):**
```
"I want to buy WEGLD. Current price is $6.50.
I have 100 USDC. Should I buy now or wait?"

→ AI can provide specific analysis with concrete numbers
```

**Bad Prompt (Vague):**
```
"What should I buy?"

→ Too vague, AI needs more context
```

---

## Future AI Features

### Phase 2: Natural Language Trading

**Target:** Q1 2026

**Features:**
- [ ] Intent classification (buy/sell/swap/query)
- [ ] Parameter extraction (amounts, tokens, conditions)
- [ ] Confirmation dialogs
- [ ] Transaction generation from prompts

**Example:**
```
User: "Buy 10 USDC of WEGLD when it drops 5%"

AI: I understand you want to:
    • Create a limit order
    • Spend: 10 USDC
    • Target: 5% below current price (6.18 USDC per WEGLD)
    • Duration: 1 hour (default)

    Estimated output: 1.62 WEGLD
    Slippage tolerance: 15%

    [Confirm] [Modify] [Cancel]
```

### Phase 3: Advanced Strategies

**Target:** Q2 2026

**DCA (Dollar-Cost Averaging):**
```typescript
interface DCAStrategy {
  token: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  duration: number; // days
  startDate: Date;
}

// Example
const strategy: DCAStrategy = {
  token: 'WEGLD',
  amount: 10, // USDC
  frequency: 'daily',
  duration: 30,
  startDate: new Date()
};

// AI generates 30 limit orders with spread prices
```

**Portfolio Rebalancing:**
```typescript
interface RebalanceStrategy {
  targetAllocation: {
    'WEGLD': 0.5,  // 50%
    'USDC': 0.5    // 50%
  };
  rebalanceThreshold: 0.05; // 5% drift
  frequency: 'weekly';
}

// AI monitors portfolio, creates rebalancing orders when drift > 5%
```

**Sentiment-Based Trading:**
```
AI monitors:
- MultiversX Twitter sentiment
- xExchange volume changes
- WEGLD holder distribution changes

Suggests trades based on:
- Positive sentiment → Consider buying
- Negative sentiment → Consider taking profits
- Neutral → Hold or DCA
```

### Phase 4: Social & Twitter Integration

**Target:** Q3 2026

**Tweet-to-Trade:**
```
User tweets: "@StellarNovaBot buy 10 USDC of WEGLD"

Bot replies:
✓ Order created! 🎯
  Type: Limit Order
  Target: 6.45 USDC per WEGLD (current price)
  Status: Pending execution

  View order: https://stellarnova.io/orders/123
```

**Price Alerts:**
```
User: "Alert me when WEGLD drops below $6"

Bot: ✓ Alert set! I'll notify you when WEGLD <= $6

[Later...]
Bot DM: 🔔 WEGLD Price Alert
        Current: $5.95
        Target: $6.00

        Want to buy? Reply "buy [amount]"
```

**Token Launch via AI:**
```
User: "Launch my token 'MYNFT' with 1M supply"

AI: I can help you launch a token! Here's what I need:

    Token Details:
    • Name: MYNFT
    • Ticker: [suggest MYNFT]
    • Supply: 1,000,000
    • Decimals: [suggest 18]
    • Can Mint: [yes/no]
    • Can Burn: [yes/no]
    • Can Pause: [yes/no]

    Estimated cost: 0.05 EGLD

    Continue? [Yes] [Modify] [Cancel]
```

---

## AI Performance Metrics

### Tracking Success

```typescript
interface AIMetrics {
  // Analysis accuracy
  correctPredictions: number;
  totalPredictions: number;
  accuracyRate: number; // %

  // User satisfaction
  thumbsUp: number;
  thumbsDown: number;
  satisfactionScore: number; // %

  // Response times
  avgResponseTime: number; // ms
  p95ResponseTime: number; // ms

  // Cost tracking
  tokensUsed: number;
  costPerRequest: number; // USD
  monthlyAICost: number; // USD
}
```

### Continuous Improvement

1. **Collect Feedback:**
   - Thumbs up/down after each AI response
   - Optional comment for detailed feedback

2. **A/B Testing:**
   - Test different prompt templates
   - Compare AI models
   - Optimize for accuracy vs. cost

3. **Fine-Tuning:**
   - Train on successful trade patterns
   - Learn from user corrections
   - Improve parameter extraction

---

## Configuration

### Environment Variables

```bash
# DeepSeek API
VITE_DEEPSEEK_API_KEY=sk-...

# Rate limiting
AI_MAX_REQUESTS_PER_HOUR=20

# Feature flags
ENABLE_AI_ANALYSIS=true
ENABLE_NATURAL_LANGUAGE_TRADING=false # Phase 2
ENABLE_DCA_STRATEGIES=false # Phase 3
```

### Model Configuration

```typescript
const AI_CONFIG = {
  model: 'deepseek-chat',
  temperature: 0.7, // Balance creativity vs. consistency
  maxTokens: 500,   // Limit response length
  topP: 0.9,
  frequencyPenalty: 0.1,
  presencePenalty: 0.1
};
```

---

## Testing AI Features

### Unit Tests

```typescript
describe('AI Trade Analysis', () => {
  it('should analyze bullish trade correctly', async () => {
    const analysis = await analyzeTradeWithAI({
      action: 'buy',
      fromToken: 'USDC',
      toToken: 'WEGLD',
      amount: 10,
      currentPrice: 6.5
    });

    expect(analysis.confidence).toBe('medium' || 'high');
    expect(analysis.risks).toBeArrayOfStrings();
    expect(analysis.recommendation).toBeDefined();
  });
});
```

### Integration Tests

```typescript
describe('Natural Language Parser', () => {
  it('should parse simple swap command', () => {
    const result = parsePrompt('Swap 10 USDC to WEGLD');

    expect(result.intent).toBe('market_swap');
    expect(result.fromToken).toBe('USDC');
    expect(result.toToken).toBe('WEGLD');
    expect(result.amount).toBe(10);
  });
});
```

---

## Resources

- **DeepSeek API:** https://platform.deepseek.com/api-docs
- **OpenAI Docs:** https://platform.openai.com/docs
- **Prompt Engineering Guide:** https://www.promptingguide.ai
- **AI Safety Best Practices:** https://www.anthropic.com/index/claude-2-1

---

**For system architecture, see [ARCHITECTURE.md](../ARCHITECTURE.md)**

**For frontend integration, see [frontend/README.md](../frontend/README.md)**
