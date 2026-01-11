# StellarNova Backend

> Node.js + Express backend for limit order execution and AI integration

**Primary Role:** Autonomous limit order executor that monitors and executes user orders.

---

## Architecture Overview

The backend serves **one critical purpose**:

**Monitor and execute limit orders automatically when price conditions are met.**

```
┌─────────────────────────────────────────────────┐
│  Backend Services                                │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │  Limit Order Executor                     │  │
│  │  - Polls contract every 30 seconds        │  │
│  │  - Fetches prices from xExchange          │  │
│  │  - Executes orders when target met        │  │
│  │  - Signs transactions with executor wallet│  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │  Express API (Minimal)                    │  │
│  │  - Health check endpoint                  │  │
│  │  - Executor status endpoint               │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**What the backend does NOT do:**
- ❌ Sign user transactions (user's wallet does this)
- ❌ Hold user funds (contract does this)
- ❌ Parse AI prompts for market swaps (frontend does this)

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Node.js** 18+ | Runtime |
| **Express** | HTTP server |
| **TypeScript** | Type safety |
| **MultiversX SDK** | Blockchain integration |
| **Axios** | HTTP requests |

---

## Project Structure

```
backend/
├── src/
│   ├── index.ts                  # Express server setup
│   ├── config.ts                 # Gas limits, contract addresses
│   ├── services/
│   │   └── limitOrderExecutor.ts # 🎯 Core executor service
│   ├── routes/                   # API endpoints (minimal)
│   └── types/                    # TypeScript types
├── executor-wallet.pem           # 🔐 Executor wallet (gitignored)
├── package.json
├── tsconfig.json
└── README.md
```

---

## Limit Order Executor

**File:** `src/services/limitOrderExecutor.ts`

### How It Works

```typescript
class LimitOrderExecutor {
  // 1. Initialize with executor wallet
  async initializeExecutorWallet(pemPath: string)

  // 2. Start monitoring loop
  async start() {
    setInterval(async () => {
      await this.checkAndExecuteOrders();
    }, 30000); // Every 30 seconds
  }

  // 3. Check each pending order
  private async checkAndExecuteOrders() {
    const orderIds = await this.getPendingOrders();

    for (const orderId of orderIds) {
      const order = await this.getLimitOrder(orderId);
      const currentPrice = await this.getTokenPairPrice(
        order.from_token,
        order.to_token
      );

      if (currentPrice <= order.target_price) {
        await this.executeOrder(orderId, currentPrice);
      }
    }
  }

  // 4. Execute order on-chain
  private async executeOrder(orderId, currentPrice) {
    // Build transaction
    const tx = new Transaction({
      sender: executorAddress,
      receiver: contractAddress,
      data: `executeLimitOrder@${orderIdHex}@${priceNum}@${priceDenom}`,
      gasLimit: 80_000_000
    });

    // Sign with executor wallet
    const signature = await this.signer.sign(tx);

    // Send to blockchain
    await this.provider.sendTransaction(tx);
  }
}
```

### Key Features

#### 1. Polling Loop
- Checks contract every 30 seconds
- Configurable via `LIMIT_ORDER_CHECK_INTERVAL` env var
- Lightweight - only queries when needed

#### 2. Price Fetching
```typescript
private async getTokenPairPrice(
  fromToken: string,
  toToken: string
): Promise<number> {
  // Query xExchange GraphQL API
  const response = await fetch(XEXCHANGE_GRAPHQL, {
    method: 'POST',
    body: JSON.stringify({
      query: `
        query {
          pairs { reserves0, reserves1, ... }
        }
      `
    })
  });

  // Calculate price from reserves
  const price = reserve1 / reserve0;
  return price;
}
```

#### 3. Decimal Handling
**Critical:** USDC has 6 decimals, WEGLD has 18 decimals.

```typescript
// Calculate price with proper decimal adjustment
const decimalAdjustment = toTokenDecimals - fromTokenDecimals;
const MAX_SAFE_EXPONENT = 15;
const PRECISION = Math.min(6, MAX_SAFE_EXPONENT - Math.abs(decimalAdjustment));

const denominator = BigInt(10) ** BigInt(PRECISION);
const numerator = BigInt(Math.floor(
  currentPrice * Math.pow(10, PRECISION + decimalAdjustment)
));

// For USDC → WEGLD:
// - Decimal adjustment: 18 - 6 = 12
// - PRECISION: min(6, 15 - 12) = 3
// - Total exponent: 3 + 12 = 15 (safe range)
```

#### 4. Cooldown System
Prevents spam execution attempts:

```typescript
private attemptedOrders = new Map<number, number>(); // orderId → timestamp
private cooldownPeriod = 300000; // 5 minutes

// Before executing
if (lastAttempt && (now - lastAttempt) < cooldownPeriod) {
  console.log('Order on cooldown');
  return;
}

// Mark as attempted
this.attemptedOrders.set(orderId, now);
```

---

## Configuration

**File:** `src/config.ts`

```typescript
export const GAS_LIMITS = {
  createLimitOrder: 20_000_000,
  cancelLimitOrder: 10_000_000,
  executeLimitOrder: 80_000_000  // High for cross-shard swaps
};

export const CONTRACT_ADDRESS =
  'erd1qqqqqqqqqqqqqpgqhcmms89zn6997pvpv9g7ckpcxz4mnjn088zqtvnz29';

export const XEXCHANGE_ROUTER =
  'erd1qqqqqqqqqqqqqpgqljca4340tg36dckpljdz9yme2ufrtsyc2jpsmcq8x8';
```

---

## Environment Variables

**File:** `.env`

```bash
# Enable/disable executor
ENABLE_LIMIT_ORDER_EXECUTOR=true

# Path to executor wallet PEM
EXECUTOR_WALLET_PEM_PATH=./executor-wallet.pem

# Polling interval (seconds)
LIMIT_ORDER_CHECK_INTERVAL=30

# Server port
PORT=3001
```

---

## Executor Wallet

### Purpose
The executor wallet:
- Signs `executeLimitOrder` transactions
- Pays gas fees for executions
- Has NO access to user funds

### Setup

1. **Generate wallet:**
   ```bash
   mxpy wallet new --pem executor-wallet.pem
   ```

2. **Fund wallet:**
   - Send 0.1-1 EGLD for gas fees
   - Monitor balance, refill as needed

3. **Security:**
   - Keep PEM file secure (gitignored)
   - Use separate wallet from deployer
   - Limit EGLD balance (only for gas)

### Gas Usage
- Each execution: ~0.0006 EGLD
- 1000 executions: ~0.6 EGLD
- Recommended balance: 1 EGLD

---

## API Endpoints

### Health Check
```bash
GET /health

Response:
{
  "status": "ok",
  "timestamp": "2026-01-11T12:00:00Z"
}
```

### Executor Status
```bash
GET /executor/status

Response:
{
  "running": true,
  "executorAddress": "erd1x4ks...",
  "checkInterval": 30000,
  "cooldownPeriod": 300000,
  "attemptedOrdersCount": 5,
  "contractAddress": "erd1qqqq..."
}
```

### Clear Cooldown (Debug)
```bash
POST /executor/clear-cooldown/:orderId

Response:
{
  "message": "Cooldown cleared for order 123"
}
```

---

## Running the Backend

### Development

```bash
# 1. Install dependencies
npm install

# 2. Create executor wallet
mxpy wallet new --pem executor-wallet.pem

# 3. Fund wallet
# Send EGLD to executor address

# 4. Configure environment
cp .env.example .env
# Edit .env with your settings

# 5. Start development server
npm run dev
```

### Production

```bash
# 1. Build
npm run build

# 2. Start
npm start

# 3. Monitor logs
tail -f logs/executor.log
```

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

CMD ["npm", "start"]
```

```bash
# Build & run
docker build -t stellarnova-backend .
docker run -d \
  --name stellarnova-executor \
  -v ./executor-wallet.pem:/app/executor-wallet.pem \
  -p 3001:3001 \
  stellarnova-backend
```

---

## Monitoring & Logging

### Console Logs

```
[2026-01-11T12:00:00Z] 🚀 Limit Order Executor started
[2026-01-11T12:00:00Z] ⏰ Checking every 30 seconds

[2026-01-11T12:00:30Z] 🔍 Checking pending orders...
   Found 3 pending order(s)

   📊 Order 20:
      USDC-c76f1f → WEGLD-bd4d79
      Target: 0.155000
      Current: 0.155152
   ✅ Price target met! Executing order 20...
      📝 Transaction data (decimal-adjusted): {
        orderId: 20,
        currentPrice: 0.155152,
        PRECISION: 3,
        totalExponent: 15,
        numerator: '155152323531609',
        denominator: '1000'
      }
      ✅ Execution TX sent: d2e49c5...
      Explorer: https://explorer.multiversx.com/transactions/d2e49c5...
```

### Error Handling

```typescript
try {
  await this.executeOrder(orderId, currentPrice);
} catch (error: any) {
  if (error.message.includes('Swap output below minimum')) {
    console.error('❌ Slippage too high, order failed');
  } else if (error.message.includes('Not enough gas')) {
    console.error('❌ Gas limit too low');
  } else {
    console.error('❌ Execution failed:', error.message);
  }

  // Keep in cooldown, will retry after cooldown period
}
```

---

## Troubleshooting

### Orders Not Executing

**Check 1: Backend Running?**
```bash
curl http://localhost:3001/health
```

**Check 2: Executor Wallet Funded?**
```bash
curl https://api.multiversx.com/accounts/erd1x4ks...
# Check balance > 0.1 EGLD
```

**Check 3: Orders Actually Pending?**
```typescript
// Query contract
const orders = await contract.query('getPendingOrders');
console.log(orders);
```

**Check 4: Price Target Reachable?**
```typescript
// Check current price
const price = await getTokenPairPrice('USDC-c76f1f', 'WEGLD-bd4d79');
console.log('Current:', price);

// Compare with order target
const order = await contract.query('getOrder', [orderId]);
console.log('Target:', order.target_price_numerator / order.target_price_denominator);
```

### Execution Fails

**Issue:** "Swap output below minimum"

**Cause:** Price moved between check and execution, or decimal mismatch

**Fix:**
- Increase slippage tolerance when creating order
- Check decimal adjustment calculation
- Verify PRECISION calculation is correct

**Issue:** "Not enough gas"

**Cause:** Gas limit too low for cross-shard swap

**Fix:**
- Increase gas limit in `config.ts`
- Current: 80M (sufficient for most swaps)

---

## Performance Optimization

### 1. Efficient Polling
```typescript
// Only query orders that haven't been attempted recently
const activeOrders = allOrders.filter(id => {
  const lastAttempt = this.attemptedOrders.get(id);
  return !lastAttempt || (now - lastAttempt) > this.cooldownPeriod;
});
```

### 2. Parallel Price Fetching
```typescript
// Fetch all prices concurrently
const pricePromises = orders.map(order =>
  this.getTokenPairPrice(order.from_token, order.to_token)
);
const prices = await Promise.all(pricePromises);
```

### 3. Connection Pooling
```typescript
// Reuse HTTP connections
const provider = new ApiNetworkProvider(NETWORK_CONFIG.apiAddress, {
  timeout: 10000,
  keepAlive: true
});
```

---

## Scaling Considerations

### Single Instance (Current)
- Handles 100s of orders
- Polls every 30 seconds
- Suitable for MVP

### Multiple Instances (Future)
- Use distributed lock (Redis)
- Prevent duplicate executions
- Load balance across instances

```typescript
// Pseudo-code for distributed lock
const lock = await redis.lock(`order:${orderId}`, 60);
if (lock) {
  await executeOrder(orderId);
  await lock.unlock();
}
```

---

## Future Enhancements

### 1. WebSocket Price Feed
Replace polling with real-time price updates:

```typescript
const ws = new WebSocket('wss://xexchange.com/prices');
ws.on('message', (data) => {
  const { pair, price } = JSON.parse(data);
  this.checkOrdersForPair(pair, price);
});
```

### 2. Advanced Order Types
- **Stop-loss:** Execute when price goes above/below
- **Trailing stop:** Dynamic target based on peak price
- **DCA:** Recurring buys at intervals

### 3. Multi-DEX Support
- Check prices across multiple DEXes
- Execute on best price source
- Aggregation for better fills

---

## Security Considerations

### Executor Wallet Security
- ✅ Separate from deployer wallet
- ✅ Limited balance (only for gas)
- ✅ PEM file gitignored
- ⚠️ Rotate periodically (every 3-6 months)

### Transaction Security
- ✅ Only executes orders that meet price conditions
- ✅ Cannot withdraw user funds
- ✅ Slippage protection built into contract
- ✅ Event emissions for audit trail

### API Security (Future)
- [ ] Rate limiting
- [ ] Authentication for admin endpoints
- [ ] HTTPS only
- [ ] CORS configuration

---

## Resources

- **MultiversX SDK:** https://docs.multiversx.com/sdk-and-tools/sdk-js
- **xExchange API:** https://graph.xexchange.com/graphql
- **Limit Order Guide:** `../dolist/limitorder.md`

---

**For detailed architecture, see [ARCHITECTURE.md](../ARCHITECTURE.md)**

**For operational info, see [LIMIT_ORDER_EXECUTOR.md](LIMIT_ORDER_EXECUTOR.md)**
