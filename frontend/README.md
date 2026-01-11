# StellarNova Frontend

> React + Vite frontend for StellarNova DEX interface

Built on the MultiversX template-dapp framework with custom trading components.

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.2 | UI framework |
| **Vite** | 4.4 | Build tool & dev server |
| **TypeScript** | 5.2 | Type safety |
| **Tailwind CSS** | 4.0 | Styling |
| **MultiversX SDK** | 5.x | Blockchain integration |
| **MultiversX SDK UI** | 0.x | Pre-built UI components |
| **Motion** | 12.x | Animations |

---

## Project Structure

```
frontend/src/
├── components/          # Reusable UI components
│   ├── Card/           # Card wrapper with title
│   ├── Layout/         # App layout (header, footer, sidebar)
│   └── ...
├── pages/              # Page components
│   ├── Dashboard/      # Main trading dashboard
│   │   ├── components/
│   │   └── widgets/
│   │       └── StellarNovaTrader/  # 🟢 Market swap widget
│   ├── Atlas/          # AI-powered limit orders
│   │   └── components/
│   │       ├── AtlasTrader.tsx     # 🔵 AI trade advisor
│   │       ├── LimitOrderTester.tsx # 🔵 Limit order creation
│   │       └── OrderManager.tsx     # 🔵 Order management
│   ├── Home/           # Landing page
│   └── ...
├── lib/                # Core libraries
│   ├── stellarnova/    # StellarNova integrations
│   │   ├── xexchange.ts        # Direct xExchange router swaps
│   │   ├── limitOrders.ts      # Limit order contract interface
│   │   └── index.ts
│   └── ai/             # AI integration
│       └── schema.ts   # Trade parsing types
├── services/           # Business logic
│   └── ai/
│       └── atlasAnalysis.ts  # DeepSeek AI integration
├── config/             # Environment configs
│   ├── config.devnet.ts
│   ├── config.testnet.ts
│   └── config.mainnet.ts
└── hooks/              # Custom React hooks
```

---

## Wallet Connection

### Supported Wallets
- **MultiversX DeFi Wallet** (browser extension)
- **xPortal** (mobile wallet via QR code)
- **Web Wallet** (MultiversX web wallet)
- **Passkey** (WebAuthn-based authentication)

### Implementation
Uses `@multiversx/sdk-dapp` for wallet connection:

```typescript
import { useGetAccount } from 'lib';

const { address, balance } = useGetAccount();
```

**Connection Flow:**
1. User clicks "Connect Wallet"
2. SDK presents wallet options
3. User authenticates with chosen wallet
4. `address` and `balance` become available app-wide
5. All transactions require user signature via connected wallet

---

## Market Swaps (Dashboard)

**Location:** `src/pages/Dashboard/widgets/StellarNovaTrader/`

### How It Works

1. **User Input:**
   - Select FROM token (USDC/WEGLD)
   - Enter amount
   - Select TO token

2. **Price Quote:**
   ```typescript
   import { getSwapQuote } from 'lib/stellarnova/xexchange';

   const quote = await getSwapQuote(fromToken, toToken, amount);
   // Returns: { estimatedOutput, priceImpact, route }
   ```

3. **Transaction Building:**
   ```typescript
   import { executeSwap } from 'lib/stellarnova/xexchange';

   const txHash = await executeSwap({
     fromToken,
     toToken,
     fromAmount,
     minAmountOut: quote.estimatedOutput * 0.95, // 5% slippage
     userAddress
   });
   ```

4. **User Signs:**
   - Transaction sent to user's wallet
   - User reviews and approves
   - Transaction submitted to blockchain

5. **Direct Execution:**
   - No intermediary contract
   - Swap executes directly via xExchange router
   - Tokens appear in user's wallet immediately

### Key Files

| File | Purpose |
|------|---------|
| `lib/stellarnova/xexchange.ts` | xExchange router integration |
| `widgets/StellarNovaTrader/StellarNovaTrader.tsx` | Main swap UI |
| `widgets/StellarNovaTrader/components/SwapInterface.tsx` | Token input component |

---

## Limit Orders (Atlas)

**Location:** `src/pages/Atlas/components/`

### How It Works

1. **Order Creation:**
   ```typescript
   import { useLimitOrders } from 'lib/stellarnova/limitOrders';

   const { createLimitOrder } = useLimitOrders();

   await createLimitOrder({
     fromToken: 'USDC-c76f1f',
     fromAmount: 10_000_000, // 10 USDC (6 decimals)
     fromDecimals: 6,
     toToken: 'WEGLD-bd4d79',
     targetPriceNum: 155152,
     targetPriceDenom: 1000,
     slippageBp: 1500, // 15%
     durationSeconds: 3600 // 1 hour
   });
   ```

2. **ESDT Payment Pattern:**
   - User sends tokens WITH the transaction
   - Tokens locked in contract until:
     - Order executes (backend swaps tokens)
     - User cancels (tokens returned)
     - Order expires (tokens returned)

3. **Backend Monitoring:**
   - Backend queries contract every 30 seconds
   - Fetches current price from xExchange
   - Executes order if price target met

4. **Order Management:**
   ```typescript
   // Fetch user's pending orders
   const orders = await getUserPendingOrders(userAddress);

   // Cancel an order
   await cancelLimitOrder(orderId);
   ```

### Key Files

| File | Purpose |
|------|---------|
| `lib/stellarnova/limitOrders.ts` | Contract integration |
| `components/LimitOrderTester.tsx` | Order creation UI |
| `components/OrderManager.tsx` | View/cancel orders |
| `components/AtlasTrader.tsx` | AI analysis UI |
| `services/ai/atlasAnalysis.ts` | DeepSeek integration |

---

## AI Integration (DeepSeek)

**Location:** `src/services/ai/atlasAnalysis.ts`

### Purpose
Provides AI-powered trade analysis and insights.

### Implementation

```typescript
import { analyzeTradeWithAI } from 'services/ai/atlasAnalysis';

const analysis = await analyzeTradeWithAI({
  action: 'buy',
  fromToken: 'USDC',
  toToken: 'WEGLD',
  amount: 10,
  currentPrice: 6.5
});

// Returns:
// {
//   confidence: 'high',
//   reasoning: '...',
//   risks: ['...'],
//   recommendation: '...'
// }
```

### Features
- **Trade Confidence** - Analyzes market conditions
- **Risk Assessment** - Identifies potential issues
- **Timing Suggestions** - Optimal entry/exit points
- **Natural Language** - Easy-to-understand insights

**Note:** AI analysis is informational only, not financial advice.

---

## Transaction Flow

### Market Swaps
```
User Input → Get Quote → Build TX → User Signs → xExchange Router → Done
(Frontend)   (Frontend)  (Frontend)  (Wallet)    (Blockchain)
```

### Limit Orders
```
User Input → Calculate Price → Build TX with ESDT → User Signs → Contract Stores
(Frontend)   (Frontend)        (Frontend)           (Wallet)    (Blockchain)
                                                                      ↓
Backend Monitors → Price Met? → Execute Swap → Tokens to User
(Backend)          (Backend)    (Backend)       (Blockchain)
```

---

## Configuration

### Environment-Specific Configs

**Devnet:**
```typescript
// config/config.devnet.ts
export const config = {
  network: 'devnet',
  xExchangeRouter: 'erd1qqqqqqqqqqqqqpgq...',
  stellarnovaContract: 'erd1qqqqqqqqqqqqqpgq...'
};
```

**Mainnet:**
```typescript
// config/config.mainnet.ts
export const config = {
  network: 'mainnet',
  xExchangeRouter: 'erd1qqqqqqqqqqqqqpgq...',
  stellarnovaContract: 'erd1qqqqqqqqqqqqqpgq...'
};
```

### Build Scripts

```bash
# Development
npm run start-devnet    # Copy devnet config & start dev server
npm run start-mainnet   # Copy mainnet config & start dev server

# Production
npm run build-devnet    # Build for devnet
npm run build-mainnet   # Build for mainnet
```

---

## State Management

Uses React Context + SDK hooks:

```typescript
// Global wallet state
import { useGetAccount } from 'lib';
const { address, balance } = useGetAccount();

// Transaction tracking
import { useGetPendingTransactions } from 'lib';
const { pendingTransactions } = useGetPendingTransactions();

// Network config
import { useGetNetworkConfig } from 'lib';
const { network, chainId } = useGetNetworkConfig();
```

---

## Styling

### Tailwind CSS 4

Uses utility-first CSS with custom config:

```typescript
// Component styling
const styles = {
  container: 'flex flex-col items-center min-h-screen bg-transparent',
  card: 'bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6',
  button: 'bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded'
} satisfies Record<string, string>;
```

### Dark Mode
Supported via Tailwind's `dark:` variant.

---

## Performance Optimizations

1. **Code Splitting**
   - Route-based splitting
   - Lazy loading for heavy components

2. **Memoization**
   ```typescript
   const memoizedQuote = useMemo(
     () => calculateQuote(amount, price),
     [amount, price]
   );
   ```

3. **Debouncing**
   - Price updates debounced to avoid excessive API calls
   - Input validation debounced for UX

---

## Testing

```bash
# Run tests
npm run test

# E2E tests (Playwright)
npm run run-playwright-test
```

---

## Common Tasks

### Adding a New Token

1. Update token list:
   ```typescript
   // lib/stellarnova/tokens.ts
   export const TOKENS = {
     'USDC': 'USDC-c76f1f',
     'WEGLD': 'WEGLD-bd4d79',
     'NEWTOKEN': 'NEWTOKEN-abc123' // Add here
   };
   ```

2. Update token decimals:
   ```typescript
   // lib/stellarnova/limitOrders.ts
   const TOKEN_DECIMALS = {
     'USDC-c76f1f': 6,
     'WEGLD-bd4d79': 18,
     'NEWTOKEN-abc123': 18 // Add here
   };
   ```

### Adding a New Page

1. Create page component:
   ```typescript
   // pages/NewPage/NewPage.tsx
   export const NewPage = () => {
     return <div>New Page</div>;
   };
   ```

2. Export from index:
   ```typescript
   // pages/NewPage/index.ts
   export { NewPage } from './NewPage';
   ```

3. Add route:
   ```typescript
   // routes/routes.ts
   import { NewPage } from 'pages';

   export const routes = [
     // ... existing routes
     { path: '/new', component: NewPage }
   ];
   ```

---

## Troubleshooting

### Wallet Won't Connect
- Check browser extension is installed
- Verify network selection matches app config
- Clear browser cache and retry

### Transaction Fails
- Check wallet has sufficient EGLD for gas
- Verify slippage tolerance isn't too low
- Check token balances are sufficient

### Limit Order Won't Execute
- Verify backend executor is running
- Check order hasn't expired
- Confirm price target is reachable

---

## Development Workflow

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run start-devnet

# 3. Open browser
# http://localhost:3000

# 4. Connect wallet
# Use MultiversX DeFi Wallet on devnet

# 5. Test features
# - Try market swap
# - Create limit order
# - Check order status
```

---

## Production Deployment

```bash
# 1. Build for mainnet
npm run build-mainnet

# 2. Deploy build/ folder
# - Vercel: vercel deploy
# - Netlify: netlify deploy
# - AWS S3: aws s3 sync build/ s3://bucket

# 3. Configure DNS
# Point domain to deployment

# 4. Enable HTTPS
# All deployments must use HTTPS
```

---

## Resources

- **MultiversX SDK:** https://docs.multiversx.com/sdk-and-tools/sdk-js
- **xExchange Docs:** https://docs.xexchange.com
- **Vite Docs:** https://vitejs.dev
- **Tailwind CSS:** https://tailwindcss.com

---

**For architecture details, see [ARCHITECTURE.md](../ARCHITECTURE.md)**
