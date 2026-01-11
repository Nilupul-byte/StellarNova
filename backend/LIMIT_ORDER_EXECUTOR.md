# Limit Order Executor - Setup Guide

This backend service automatically monitors and executes limit orders when price targets are met.

## Overview

The Limit Order Executor:
- 🔍 Monitors pending limit orders from the smart contract
- 📊 Checks xExchange prices every 30 seconds (configurable)
- ⚡ Automatically executes orders when price targets are hit
- 🔐 Signs execution transactions with a dedicated executor wallet

---

## Setup Steps

### 1. Create/Configure Executor Wallet

The executor needs a wallet to sign transactions when executing limit orders.

**Option A: Use the deployer wallet (recommended for testing)**
```bash
# Copy the deployer wallet to backend directory
cp ../contracts/stellarnova-sc/stellarnova-deployer.pem ./executor-wallet.pem
```

**Option B: Create a new dedicated executor wallet**
```bash
# Create new wallet
mxpy wallet new --format pem --outfile executor-wallet.pem

# Fund it with EGLD for gas fees (~0.1 EGLD recommended)
# Send EGLD to the wallet address shown in the output
```

### 2. Set Executor Address in Smart Contract

The contract needs to authorize your executor wallet to execute orders.

```bash
# Get your executor wallet address
mxpy wallet convert --infile executor-wallet.pem --in-format pem --out-format address-bech32

# Set it as the authorized executor (run from contracts directory)
cd ../contracts/stellarnova-sc
source mainnet.config.sh

mxpy contract call erd1qqqqqqqqqqqqqpgqv6xna5k6q6axnvce2n0g65n78vvuyx0088zq8scpu0 \
  --pem stellarnova-deployer.pem \
  --proxy $PROXY \
  --chain $CHAIN_ID \
  --gas-limit 5000000 \
  --function setLimitOrderExecutor \
  --arguments addr:<YOUR_EXECUTOR_ADDRESS> \
  --send
```

### 3. Configure Backend

Edit `.env` file:

```bash
# Enable the executor
ENABLE_LIMIT_ORDER_EXECUTOR=true

# Set wallet path (default: ./executor-wallet.pem)
EXECUTOR_WALLET_PEM_PATH=./executor-wallet.pem

# Set check interval in seconds (default: 30)
LIMIT_ORDER_CHECK_INTERVAL=30
```

### 4. Start Backend Service

```bash
# Install dependencies (if not already done)
npm install

# Build TypeScript
npm run build

# Start service
npm start

# Or run in development mode
npm run dev
```

---

## Monitoring

### Check Executor Status

```bash
curl http://localhost:3001/api/limit-orders/executor/status
```

Response:
```json
{
  "running": true,
  "executorAddress": "erd1...",
  "checkInterval": 30000,
  "contractAddress": "erd1qqqqqqqqqqqqqpgqv6xna5k6q6axnvce2n0g65n78vvuyx0088zq8scpu0"
}
```

### View Logs

The executor logs:
- ✅ When it starts successfully
- 🔍 Every time it checks for orders
- 📊 Price checks for each order
- ⚡ When it executes orders
- ❌ Any errors encountered

Example output:
```
🚀 Limit Order Executor started
⏰ Checking every 30 seconds

[2026-01-04T20:00:00.000Z] 🔍 Checking pending orders...
   Found 2 pending order(s)
   📊 Order 1:
      USDC-c76f1f → WEGLD-bd4d79
      Target: 0.020000
      Current: 0.020500
      ⏳ Waiting for price...
   📊 Order 2:
      WEGLD-bd4d79 → USDC-c76f1f
      Target: 50.000000
      Current: 48.780488
      ✅ Price target met! Executing order 2...
      ✅ Execution TX sent: abc123...
      Explorer: https://explorer.multiversx.com/transactions/abc123...
      ✅ Transaction successful!
```

---

## Gas Costs

Each order execution costs approximately:
- **Gas Limit:** 50,000,000
- **Cost:** ~0.05 EGLD per execution

**Recommendations:**
- Keep at least **0.5 EGLD** in executor wallet for 10 executions
- Monitor balance regularly
- Set up alerts when balance is low

---

## Production Deployment

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start backend with PM2
pm2 start dist/index.js --name stellarnova-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Using Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npm run build

CMD ["node", "dist/index.js"]
```

```bash
# Build and run
docker build -t stellarnova-backend .
docker run -d \
  -p 3001:3001 \
  -v $(pwd)/executor-wallet.pem:/app/executor-wallet.pem \
  -e ENABLE_LIMIT_ORDER_EXECUTOR=true \
  stellarnova-backend
```

### Environment Variables for Production

```bash
# Production .env
NODE_ENV=production
PORT=3001

# Limit Order Executor
ENABLE_LIMIT_ORDER_EXECUTOR=true
EXECUTOR_WALLET_PEM_PATH=/secure/path/to/executor-wallet.pem
LIMIT_ORDER_CHECK_INTERVAL=30

# Monitoring
LOG_LEVEL=info
SENTRY_DSN=<your-sentry-dsn>
```

---

## Troubleshooting

### Executor won't start

**Error: "Executor wallet not initialized"**
- Ensure `EXECUTOR_WALLET_PEM_PATH` points to a valid PEM file
- Check file permissions (must be readable)

**Error: "Transaction failed: only executor can execute orders"**
- Run `setLimitOrderExecutor` on the contract
- Verify executor address matches wallet address

### Orders not executing

**"No pending orders"**
- Check if there are actually pending orders in the contract
- Query contract: `mxpy contract query <CONTRACT> --function getPendingOrders`

**"Could not fetch price"**
- Verify xExchange GraphQL is accessible
- Check token identifiers are correct
- Ensure trading pair exists on xExchange

**"Price target not met"**
- Current price hasn't reached target yet
- Order will execute automatically when price condition is satisfied

### Gas issues

**"Insufficient funds"**
- Executor wallet needs EGLD for gas
- Send more EGLD to executor address

**"Transaction failed"**
- Check explorer link in logs for specific error
- May be due to slippage, expired order, or contract paused

---

## Security Best Practices

1. **Secure the PEM file**
   ```bash
   chmod 600 executor-wallet.pem
   chown <service-user>:<service-group> executor-wallet.pem
   ```

2. **Use a dedicated wallet**
   - Don't use wallets with large balances
   - Only keep enough EGLD for gas fees

3. **Monitor wallet balance**
   - Set up alerts when balance < 0.1 EGLD
   - Regularly top up to avoid service interruption

4. **Rotate keys periodically**
   - Generate new executor wallet every 3-6 months
   - Update contract with new executor address

5. **Use environment-specific configurations**
   - Dev/staging/prod separate executor wallets
   - Different check intervals per environment

---

## API Endpoints

### GET /health
Health check

**Response:**
```json
{
  "status": "ok",
  "service": "stellarnova-backend"
}
```

### GET /api/limit-orders/executor/status
Get executor status

**Response:**
```json
{
  "running": true,
  "executorAddress": "erd1...",
  "checkInterval": 30000,
  "contractAddress": "erd1qqq..."
}
```

---

## Development

### Testing Locally

1. Use devnet contract for testing
2. Set shorter check interval (e.g., 10 seconds)
3. Create test orders with near-current prices
4. Monitor logs to see execution

### Debugging

Enable verbose logging:
```typescript
// In limitOrderExecutor.ts, add more console.logs
console.log('Full order details:', JSON.stringify(order, null, 2));
console.log('Price calculation:', { targetPrice, currentPrice, condition });
```

---

## Support

**Contract:** `erd1qqqqqqqqqqqqqpgqv6xna5k6q6axnvce2n0g65n78vvuyx0088zq8scpu0`

**Documentation:**
- [Contract Interface](/contracts/stellarnova-sc/LIMIT_ORDERS_DEPLOYED.md)
- [Frontend Integration](#) (TODO)

**Issues:**
- Check logs first
- Verify contract query works: `getPendingOrders`
- Test executor wallet has funds
- Ensure correct executor is set in contract

---

**Built for StellarNova - AI-Powered Trading on MultiversX**
