# StellarNova Architecture

> Comprehensive system design documentation

**Last Updated:** January 11, 2026

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Market Swaps Architecture](#market-swaps-architecture-dashboard)
3. [Atlas AI Limit Orders Architecture](#atlas-ai-limit-orders-architecture)
4. [Backend Executor Service](#backend-executor-service)
5. [Smart Contract Design](#smart-contract-design)
6. [Data Flow & Interactions](#data-flow--interactions)
7. [Security Architecture](#security-architecture)
8. [Performance & Scaling](#performance--scaling)
9. [Deployment Architecture](#deployment-architecture)

---

## System Overview

StellarNova is a **non-custodial DEX interface** combining instant market swaps with AI-powered limit orders on MultiversX blockchain.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          StellarNova                             │
│                                                                  │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐ │
│  │   Frontend   │      │   Backend    │      │   Contract   │ │
│  │   (React)    │◄────►│  (Node.js)   │◄────►│    (Rust)    │ │
│  └──────────────┘      └──────────────┘      └──────────────┘ │
│         │                      │                      │         │
│         │                      │                      │         │
│         ▼                      ▼                      ▼         │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐ │
│  │  User Wallet │      │  DeepSeek AI │      │  xExchange   │ │
│  │   (Signs)    │      │  (Analysis)  │      │   Router     │ │
│  └──────────────┘      └──────────────┘      └──────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| **Frontend** | UI, wallet integration, transaction building | React, Vite, TypeScript |
| **Backend** | Limit order execution monitoring | Node.js, Express |
| **Contract** | Limit order storage, swap execution | Rust, MultiversX SDK |
| **User Wallet** | Transaction signing, key management | DeFi Wallet, xPortal, Passkey |
| **xExchange** | DEX liquidity, token swaps | xExchange Router Contract |
| **DeepSeek AI** | Trade analysis, recommendations | DeepSeek API |

---

## Market Swaps Architecture (Dashboard)

**Location:** `/frontend/src/pages/Dashboard/widgets/StellarNovaTrader/`

### Overview

Market swaps are **direct** transactions between user wallet and xExchange router with **no intermediary contracts**.

```
┌──────────────────────────────────────────────────────────────────┐
│                      Market Swap Flow                             │
│                                                                   │
│  User Input                                                       │
│     │                                                            │
│     ▼                                                             │
│  ┌──────────────┐                                               │
│  │  Select      │  User chooses:                                 │
│  │  Tokens &    │  - FROM token (USDC/WEGLD)                    │
│  │  Amount      │  - Amount to swap                              │
│  └──────────────┘  - TO token (WEGLD/USDC)                       │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────┐                                               │
│  │  Fetch Price │  Query xExchange GraphQL:                      │
│  │  from        │  - Get pair reserves                           │
│  │  xExchange   │  - Calculate output amount                     │
│  └──────────────┘  - Calculate price impact                      │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────┐                                               │
│  │  Build TX    │  Create transaction:                           │
│  │  for User    │  - Receiver: xExchange router                  │
│  │              │  - Data: swapTokensFixedInput                  │
│  │              │  - Payment: FROM token amount                  │
│  └──────────────┘  - Gas: 30M (sufficient for most swaps)        │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────┐                                               │
│  │  User Signs  │  User's wallet:                                │
│  │  TX in       │  - Reviews transaction                         │
│  │  Wallet      │  - Signs with private key                      │
│  └──────────────┘  - Broadcasts to blockchain                    │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────┐                                               │
│  │  xExchange   │  Router contract:                              │
│  │  Executes    │  - Validates slippage                          │
│  │  Swap        │  - Executes swap in liquidity pool             │
│  └──────────────┘  - Sends output tokens to user                 │
│         │                                                         │
│         ▼                                                         │
│  ✅ Tokens in User Wallet                                        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Key Implementation

#### 1. Price Fetching

**File:** `frontend/src/lib/stellarnova/xexchange.ts`

```typescript
export async function getSwapQuote(
  fromToken: string,
  toToken: string,
  amount: number
): Promise<SwapQuote> {
  // Query xExchange GraphQL API
  const query = `
    query GetPair {
      pairs(filter: {
        firstToken: "${fromToken}",
        secondToken: "${toToken}"
      }) {
        reserves0
        reserves1
        info { reserves0, reserves1 }
      }
    }
  `;

  const response = await fetch('https://graph.xexchange.com/graphql', {
    method: 'POST',
    body: JSON.stringify({ query })
  });

  const { reserves0, reserves1 } = response.data.pairs[0].info;

  // Calculate output using constant product formula
  // x * y = k
  const reserveIn = parseFloat(reserves0);
  const reserveOut = parseFloat(reserves1);

  const amountInWithFee = amount * 997; // 0.3% fee
  const numerator = amountInWithFee * reserveOut;
  const denominator = (reserveIn * 1000) + amountInWithFee;
  const amountOut = numerator / denominator;

  return {
    estimatedOutput: amountOut,
    priceImpact: calculatePriceImpact(amount, amountOut, reserveIn, reserveOut),
    route: [fromToken, toToken]
  };
}
```

#### 2. Transaction Building

```typescript
export async function executeSwap(params: {
  fromToken: string;
  toToken: string;
  fromAmount: number;
  minAmountOut: number;
  userAddress: string;
}): Promise<string> {
  const { fromToken, toToken, fromAmount, minAmountOut, userAddress } = params;

  // Build transaction data
  const functionName = 'swapTokensFixedInput';
  const args = [
    toToken,                    // Output token
    minAmountOut.toString(16)   // Minimum acceptable output
  ];

  const data = `${functionName}@${args.join('@')}`;

  // Create transaction
  const tx = new Transaction({
    sender: Address.newFromBech32(userAddress),
    receiver: Address.newFromBech32(XEXCHANGE_ROUTER), // Direct to xExchange
    value: 0,
    gasLimit: 30_000_000,
    chainID: 'D', // Devnet
    data: Buffer.from(data)
  });

  // Add ESDT payment (the tokens being swapped)
  tx.addPayment({
    tokenIdentifier: fromToken,
    amount: fromAmount
  });

  // Send to user's wallet for signing
  const sessionId = await sendTransaction(tx);
  return sessionId;
}
```

### Advantages

✅ **No intermediate contract** - Direct xExchange integration
✅ **No token deposits** - Tokens never leave user's wallet until swap
✅ **Instant execution** - One transaction, immediate results
✅ **Lower gas costs** - No extra contract calls
✅ **Atomic operation** - Swap succeeds or fails completely

### Security

- ✅ User maintains full custody until swap executes
- ✅ Slippage protection (user defines max)
- ✅ User reviews and signs every transaction
- ✅ Direct blockchain execution (no backend involvement)

---

## Atlas AI Limit Orders Architecture

**Location:** `/frontend/src/pages/Atlas/components/`

### Overview

Limit orders involve a **complex multi-party flow** with smart contract storage and backend execution.

```
┌────────────────────────────────────────────────────────────────────┐
│                    Limit Order Flow                                 │
│                                                                     │
│  Phase 1: Order Creation (User-initiated)                          │
│  ═══════════════════════════════════════════════════════           │
│                                                                     │
│  ┌──────────────┐                                                 │
│  │  User Input  │  User defines:                                   │
│  │  in Atlas UI │  - FROM token & amount                           │
│  │              │  - TO token                                      │
│  └──────────────┘  - Target price                                  │
│         │          - Slippage tolerance (15%)                      │
│         │          - Duration (1 hour default)                     │
│         ▼                                                           │
│  ┌──────────────┐                                                 │
│  │  AI Analysis │  DeepSeek provides:                              │
│  │  (Optional)  │  - Trade confidence                              │
│  │              │  - Risk assessment                               │
│  └──────────────┘  - Recommendations                               │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────┐                                                 │
│  │  Calculate   │  Frontend calculates:                            │
│  │  Target      │  numerator = price * 10^(PRECISION + decimalAdj) │
│  │  Price       │  denominator = 10^PRECISION                      │
│  └──────────────┘  PRECISION = min(6, 15 - |decimalAdj|)           │
│         │           For USDC→WEGLD: PRECISION=3                    │
│         ▼                                                           │
│  ┌──────────────┐                                                 │
│  │  Build TX    │  Create transaction:                             │
│  │  with ESDT   │  - Receiver: StellarNova contract                │
│  │  Payment     │  - Function: createLimitOrder                    │
│  │              │  - Payment: FROM token amount (sent WITH tx)     │
│  └──────────────┘  - Gas: 20M                                      │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────┐                                                 │
│  │  User Signs  │  User's wallet signs transaction                 │
│  │  TX          │  (Tokens locked in contract until execution)     │
│  └──────────────┘                                                  │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────┐                                                 │
│  │  Contract    │  Contract stores:                                │
│  │  Stores      │  - Order ID (auto-increment)                     │
│  │  Order       │  - User address                                  │
│  │              │  - FROM/TO tokens                                │
│  │              │  - Target price (numerator/denominator)          │
│  │              │  - Slippage                                      │
│  │              │  - Expiration timestamp                          │
│  └──────────────┘  - Status: PENDING                               │
│                                                                     │
│  Phase 2: Order Monitoring (Backend-automated)                     │
│  ═══════════════════════════════════════════════════               │
│                                                                     │
│  ┌──────────────┐                                                 │
│  │  Backend     │  Every 30 seconds:                               │
│  │  Polls       │  1. Query contract: getPendingOrders()           │
│  │  Contract    │  2. For each order: getOrder(orderID)            │
│  └──────────────┘  3. Parse order details                          │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────┐                                                 │
│  │  Fetch       │  Query xExchange GraphQL:                        │
│  │  Current     │  - Get pair reserves                             │
│  │  Price       │  - Calculate current price                       │
│  └──────────────┘  - Compare with target                           │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────┐                                                 │
│  │  Price       │  If currentPrice <= targetPrice:                 │
│  │  Check       │  ✅ Execute order                                │
│  │              │  Else:                                           │
│  └──────────────┘  ⏳ Wait and check again                         │
│         │                                                           │
│         ▼ (if price met)                                           │
│  ┌──────────────┐                                                 │
│  │  Backend     │  Backend builds TX:                              │
│  │  Builds      │  - Function: executeLimitOrder                   │
│  │  Execution   │  - Args: orderID, currentPriceNum, priceDenom    │
│  │  TX          │  - Gas: 80M (for cross-shard swap)               │
│  └──────────────┘                                                  │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────┐                                                 │
│  │  Backend     │  Backend's executor wallet:                      │
│  │  Signs &     │  - Signs transaction (pays gas)                  │
│  │  Sends TX    │  - Sends to blockchain                           │
│  └──────────────┘                                                  │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────┐                                                 │
│  │  Contract    │  Contract validates:                             │
│  │  Executes    │  1. Order exists & is PENDING                    │
│  │  Order       │  2. Order not expired                            │
│  │              │  3. Calculate min_output from target price       │
│  └──────────────┘  4. Execute swap via xExchange                   │
│         │          5. Validate output >= min_output                │
│         │          6. Send output tokens to user                   │
│         │          7. Mark order as EXECUTED                       │
│         ▼                                                           │
│  ✅ Tokens Delivered to User Wallet                                │
│                                                                     │
│  Phase 3: Order Management (User-optional)                         │
│  ═══════════════════════════════════════════════════               │
│                                                                     │
│  ┌──────────────┐                                                 │
│  │  User Views  │  Frontend queries:                               │
│  │  Orders      │  - getUserPendingOrders(userAddress)             │
│  │              │  - Displays order list                           │
│  └──────────────┘                                                  │
│         │                                                           │
│         ▼ (if user wants to cancel)                                │
│  ┌──────────────┐                                                 │
│  │  User        │  User clicks "Cancel Order":                     │
│  │  Cancels     │  - Build TX: cancelLimitOrder(orderID)           │
│  │  Order       │  - User signs                                    │
│  │              │  - Contract returns locked tokens                │
│  └──────────────┘  - Order marked as CANCELLED                     │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### Key Implementation

#### 1. Order Creation (Frontend)

**File:** `frontend/src/lib/stellarnova/limitOrders.ts`

```typescript
export const useLimitOrders = () => {
  const { sendTransaction } = useTransactions();

  const createLimitOrder = async (params: {
    fromToken: string;
    fromAmount: number;
    fromDecimals: number;
    toToken: string;
    targetPriceNum: number;
    targetPriceDenom: number;
    slippageBp: number;
    durationSeconds: number;
  }) => {
    // Build transaction data
    const data = `createLimitOrder@${toTokenHex}@${targetPriceNumHex}@${targetPriceDenomHex}@${slippageBpHex}@${durationHex}`;

    // Create transaction WITH ESDT payment
    const tx = new Transaction({
      sender: Address.newFromBech32(userAddress),
      receiver: Address.newFromBech32(STELLARNOVA_CONTRACT),
      value: 0,
      gasLimit: 20_000_000,
      data: Buffer.from(data)
    });

    // Critical: Tokens sent WITH transaction
    tx.addPayment({
      tokenIdentifier: params.fromToken,
      amount: params.fromAmount
    });

    const sessionId = await sendTransaction(tx);
    return sessionId;
  };

  return { createLimitOrder };
};
```

#### 2. Decimal-Adjusted Price Calculation

**Critical for USDC (6 decimals) ↔ WEGLD (18 decimals) swaps:**

```typescript
export const calculateTargetPriceWithDecimals = (
  targetPrice: number,
  fromDecimals: number,
  toDecimals: number
): { numerator: number; denominator: number } => {
  // Calculate decimal adjustment
  const decimalAdjustment = toDecimals - fromDecimals;
  // For USDC→WEGLD: 18 - 6 = 12

  // Dynamically adjust PRECISION to avoid JavaScript overflow
  const MAX_SAFE_EXPONENT = 15; // JavaScript safe integer range: 2^53 ≈ 9×10^15
  const PRECISION = Math.min(6, MAX_SAFE_EXPONENT - Math.abs(decimalAdjustment));
  // For USDC→WEGLD: min(6, 15 - 12) = 3

  const denominator = Math.pow(10, PRECISION);
  // = 1000

  const totalExponent = PRECISION + decimalAdjustment;
  // = 3 + 12 = 15 (safe!)

  const numerator = Math.floor(targetPrice * Math.pow(10, totalExponent));
  // Example: 0.155 * 10^15 = 155,000,000,000,000

  return { numerator, denominator };
};

// Usage:
const price = 0.155; // 0.155 USDC per WEGLD
const { numerator, denominator } = calculateTargetPriceWithDecimals(price, 6, 18);
// Returns: { numerator: 155152, denominator: 1000 }
// Contract will calculate: output = input * 155152 / 1000
```

**Why this matters:**
- Without decimal adjustment, contract would compare mismatched scales
- Example: 10,000 USDC units * 155 / 1000 = 1,550 (wrong scale!)
- With adjustment: 10,000 * 155,152 / 1,000 = 1,551,520,000,000,000 WEGLD units ✓

#### 3. Backend Monitoring

**File:** `backend/src/services/limitOrderExecutor.ts`

```typescript
class LimitOrderExecutor {
  private checkInterval = 30000; // 30 seconds

  async start() {
    setInterval(() => {
      this.checkAndExecuteOrders();
    }, this.checkInterval);
  }

  private async checkAndExecuteOrders() {
    // 1. Get pending order IDs
    const orderIds = await this.getPendingOrders();

    for (const orderId of orderIds) {
      // 2. Get order details
      const order = await this.getLimitOrder(orderId);

      // 3. Get current price
      const currentPrice = await this.getTokenPairPrice(
        order.from_token,
        order.to_token
      );

      // 4. Check if target met
      const targetPrice = parseFloat(order.target_price_numerator) /
                         parseFloat(order.target_price_denominator);

      if (currentPrice <= targetPrice) {
        // 5. Execute!
        await this.executeOrder(orderId, currentPrice, ...);
      }
    }
  }

  private async executeOrder(orderId: number, currentPrice: number, ...) {
    // Build execution transaction
    const tx = new Transaction({
      sender: executorAddress, // Backend's wallet
      receiver: contractAddress,
      data: `executeLimitOrder@${orderIdHex}@${priceNumHex}@${priceDenomHex}`,
      gasLimit: 80_000_000 // High for cross-shard swaps
    });

    // Sign with executor wallet
    const signature = await this.signer.sign(tx);
    tx.signature = signature;

    // Send to blockchain
    await this.provider.sendTransaction(tx);
  }
}
```

### Advantages

✅ **Automated execution** - No user monitoring required
✅ **Price target precision** - Decimal-adjusted calculations
✅ **AI-powered insights** - Trade analysis before order creation
✅ **Order management** - View and cancel via UI
✅ **Event emissions** - Full audit trail on-chain

### Security

- ✅ Tokens locked in contract (not in backend wallet)
- ✅ Backend can only execute orders that meet price conditions
- ✅ Backend cannot withdraw user funds
- ✅ User can cancel anytime and retrieve tokens
- ✅ Orders expire automatically if not executed
- ✅ Slippage protection enforced by contract

---

## Backend Executor Service

**Location:** `/backend/src/services/limitOrderExecutor.ts`

### Responsibilities

1. **Monitor** pending orders every 30 seconds
2. **Fetch** current prices from xExchange
3. **Execute** orders when price targets are met
4. **Pay** gas fees for executions
5. **Log** all operations for debugging

### Architecture

```
┌──────────────────────────────────────────────────┐
│  Backend Executor Service                         │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Main Loop (every 30s)                      │ │
│  │                                              │ │
│  │  1. Query contract: getPendingOrders()      │ │
│  │  2. For each order:                         │ │
│  │     a. Fetch order details                  │ │
│  │     b. Get current price from xExchange     │ │
│  │     c. Compare with target                  │ │
│  │     d. Execute if condition met             │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Cooldown System                            │ │
│  │                                              │ │
│  │  - Track attempted orders                   │ │
│  │  - 5-minute cooldown between retries        │ │
│  │  - Prevents spam execution attempts         │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Executor Wallet                            │ │
│  │                                              │ │
│  │  - Signs execution transactions             │ │
│  │  - Pays gas fees (~0.0006 EGLD per exec)    │ │
│  │  - Cannot access user funds                 │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Configuration

```typescript
// config.ts
export const GAS_LIMITS = {
  createLimitOrder: 20_000_000,   // User pays this
  cancelLimitOrder: 10_000_000,   // User pays this
  executeLimitOrder: 80_000_000   // Backend pays this (high for cross-shard)
};

// High gas needed because:
// 1. Async call to xExchange (30M)
// 2. Cross-shard callback (10M)
// 3. Contract logic (5M)
// 4. Buffer (35M)
// Total: 80M
```

### Monitoring & Alerts

```typescript
// Future: Add monitoring
interface ExecutorMetrics {
  ordersExecuted: number;
  failedExecutions: number;
  avgExecutionTime: number;
  executorBalance: number; // Alert if < 0.1 EGLD
  lastSuccessfulExecution: Date;
}
```

---

## Smart Contract Design

**Location:** `/contracts/stellarnova-sc/src/`

### Contract Structure

```
stellarnova-sc/src/
├── lib.rs              # Main contract module
├── limit_orders.rs     # Limit order logic
├── swap_executor.rs    # xExchange integration
└── types.rs            # Data structures
```

### Key Data Structures

```rust
// Limit Order Storage
#[derive(TypeAbi, TopEncode, TopDecode, NestedEncode, NestedDecode)]
pub struct LimitOrder<M: ManagedTypeApi> {
    pub order_id: u64,
    pub user: ManagedAddress<M>,
    pub from_token: TokenIdentifier<M>,
    pub from_amount: BigUint<M>,
    pub to_token: TokenIdentifier<M>,
    pub target_price_numerator: BigUint<M>,
    pub target_price_denominator: BigUint<M>,
    pub slippage_bp: u64,         // Basis points (1500 = 15%)
    pub expires_at: u64,           // Unix timestamp
    pub status: OrderStatus,
    pub created_at: u64
}

pub enum OrderStatus {
    Pending = 0,
    Executed = 1,
    Cancelled = 2,
    Expired = 3
}
```

### Contract Endpoints

```rust
// User-callable
#[payable("*")]
#[endpoint(createLimitOrder)]
fn create_limit_order(
    &self,
    to_token: TokenIdentifier,
    target_price_num: BigUint,
    target_price_denom: BigUint,
    slippage_bp: u64,
    duration_seconds: u64
);

#[endpoint(cancelLimitOrder)]
fn cancel_limit_order(&self, order_id: u64);

// Backend-callable
#[endpoint(executeLimitOrder)]
fn execute_limit_order(
    &self,
    order_id: u64,
    current_price_num: BigUint,
    current_price_denom: BigUint
);

// View functions
#[view(getPendingOrders)]
fn get_pending_orders(&self) -> MultiValueEncoded<LimitOrder<Self::Api>>;

#[view(getOrder)]
fn get_order(&self, order_id: u64) -> OptionalValue<LimitOrder<Self::Api>>;
```

### Execution Logic

```rust
#[endpoint(executeLimitOrder)]
fn execute_limit_order(
    &self,
    order_id: u64,
    current_price_num: BigUint,
    current_price_denom: BigUint
) {
    // 1. Load order
    let order = self.orders(order_id).get();
    require!(order.status == OrderStatus::Pending, "Order not pending");
    require!(self.blockchain().get_block_timestamp() < order.expires_at, "Order expired");

    // 2. Calculate minimum acceptable output
    let expected_output = &order.from_amount * &order.target_price_numerator / &order.target_price_denominator;
    let slippage_factor = 10000u64 - order.slippage_bp;
    let min_amount_out = &expected_output * slippage_factor / 10000u64;

    // 3. Execute swap via xExchange
    let output_amount = self.execute_swap_on_xexchange(
        order.from_token.clone(),
        order.from_amount.clone(),
        order.to_token.clone(),
        min_amount_out.clone()
    );

    // 4. Validate output
    require!(output_amount >= min_amount_out, "Swap output below minimum");

    // 5. Send tokens to user
    self.send().direct_esdt(
        &order.user,
        &order.to_token,
        0,
        &output_amount
    );

    // 6. Update order status
    self.orders(order_id).update(|o| {
        o.status = OrderStatus::Executed;
    });

    // 7. Emit event
    self.order_executed_event(order_id, output_amount);
}
```

### Security Features

```rust
// Owner-only functions
#[only_owner]
#[endpoint(pause)]
fn pause(&self);

#[only_owner]
#[endpoint(setMaxSlippage)]
fn set_max_slippage(&self, max_bp: u64);

// Validation
fn validate_order(&self, order: &LimitOrder<Self::Api>) {
    require!(order.from_amount > 0, "Amount must be positive");
    require!(order.slippage_bp <= self.max_slippage().get(), "Slippage too high");
    require!(order.expires_at > self.blockchain().get_block_timestamp(), "Invalid expiration");
}
```

---

## Data Flow & Interactions

### Complete System Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        StellarNova System Flow                              │
│                                                                             │
│  ┌──────────┐          ┌──────────┐          ┌──────────┐                 │
│  │  User    │          │ Frontend │          │ Backend  │                 │
│  │  Wallet  │          │ (React)  │          │ (Node)   │                 │
│  └────┬─────┘          └────┬─────┘          └────┬─────┘                 │
│       │                     │                      │                        │
│       │◄────Connect─────────┤                      │                        │
│       │                     │                      │                        │
│       │    ┌────────────────┴──────────────────┐  │                        │
│       │    │  Market Swap Flow                 │  │                        │
│       │    └───────────────────────────────────┘  │                        │
│       │                     │                      │                        │
│       │                     ├──Query Price──────────────►xExchange GraphQL │
│       │                     │◄─────Price────────────────┤                  │
│       │                     │                      │     │                  │
│       │◄───Sign TX──────────┤                      │     │                  │
│       ├────Signed TX───────►│                      │     │                  │
│       │                     ├──────────────────────┼─────┴──────►xExchange │
│       │◄────Tokens──────────┴──────────────────────┴────────────┤  Router  │
│       │                                                           │          │
│       │    ┌────────────────┬──────────────────┐                │          │
│       │    │  Limit Order Flow                 │                │          │
│       │    └───────────────────────────────────┘                │          │
│       │                     │                      │             │          │
│       │                     ├──AI Analysis───────────────►DeepSeek API     │
│       │                     │◄──Insights───────────────┤                   │
│       │                     │                      │                        │
│       │◄───Sign TX──────────┤                      │                        │
│       ├────Signed TX───────►├────────────────────────────►Contract         │
│       │                     │                      │      (stores order)    │
│       │                     │                      │            │           │
│       │                     │                      │◄───Poll────┤           │
│       │                     │                      ├────Orders──►│           │
│       │                     │                      │◄──Details───┤           │
│       │                     │                      │            │           │
│       │                     │                      ├─Get Price──────►xExchange│
│       │                     │                      │◄───Price────────┤      │
│       │                     │                      │                 │      │
│       │                     │                      ├──Execute TX────►│      │
│       │                     │                      │                 ├──────┤
│       │                     │                      │                 │xExchange│
│       │◄────────────────────┴──────────────────────┴─────Tokens─────┤      │
│       │                                                              │      │
└───────┴──────────────────────────────────────────────────────────────┴──────┘
```

---

## Security Architecture

### Multi-Layer Security Model

```
┌──────────────────────────────────────────────────┐
│  Security Layers                                  │
│                                                   │
│  Layer 1: User Wallet Security                   │
│  ════════════════════════════                    │
│  - Private keys never leave user's device        │
│  - User signs all transactions                   │
│  - Hardware wallet support (Ledger, etc.)        │
│                                                   │
│  Layer 2: Smart Contract Security                │
│  ═══════════════════════════════════             │
│  - Order ownership validation                    │
│  - Slippage protection                           │
│  - Expiration enforcement                        │
│  - Re-entrancy protection (MultiversX native)    │
│  - Integer overflow protection (Rust safe math)  │
│                                                   │
│  Layer 3: Backend Security                       │
│  ════════════════════════                        │
│  - Executor wallet isolated (only for gas)       │
│  - Cannot withdraw user funds                    │
│  - Rate limiting on execution                    │
│  - Cooldown between retry attempts               │
│                                                   │
│  Layer 4: API Security (Future)                  │
│  ══════════════════════════════                  │
│  - API key authentication                        │
│  - Rate limiting per user/IP                     │
│  - HTTPS only                                    │
│  - CORS configuration                            │
│                                                   │
│  Layer 5: AI Safety                              │
│  ═══════════════════                             │
│  - Prompt injection protection                   │
│  - Hard limits on trade sizes                    │
│  - User confirmation required                    │
│  - Disclaimers prominently displayed             │
└──────────────────────────────────────────────────┘
```

### Threat Model & Mitigation

| Threat | Impact | Mitigation |
|--------|--------|------------|
| **User wallet compromised** | HIGH | Non-custodial design, user responsible for key security |
| **Smart contract bug** | HIGH | Thorough testing, future audit planned |
| **Backend executor compromised** | LOW | Executor can only execute valid orders, cannot withdraw |
| **Price manipulation** | MEDIUM | Use xExchange as source of truth, slippage protection |
| **MEV/frontrunning** | MEDIUM | Orders execute at user-defined price, not market price |
| **Reentrancy attack** | LOW | MultiversX native protection |
| **Integer overflow** | LOW | Rust type system prevents overflow |
| **DoS on backend** | MEDIUM | Rate limiting, cooldown system |
| **AI prompt injection** | LOW | Input sanitization, confirmation required |

---

## Performance & Scaling

### Current Capacity

| Metric | Current | Future Target |
|--------|---------|---------------|
| **Orders per user** | Unlimited | Unlimited |
| **Concurrent orders** | 100s | 1000s |
| **Execution latency** | 30-60s | <10s (WebSocket) |
| **Backend instances** | 1 | Multiple (load balanced) |
| **Contract throughput** | ~1500 TPS (MultiversX) | Same |

### Optimization Strategies

#### 1. Frontend Optimizations
- Code splitting by route
- Lazy loading heavy components
- Memoization of expensive calculations
- Debounced price updates

#### 2. Backend Optimizations
- Parallel price fetching
- Connection pooling
- Efficient order filtering (cooldown check before query)
- Batch processing (future)

#### 3. Contract Optimizations
- Gas-efficient storage patterns
- Minimal on-chain computations
- Event-based indexing (future)

#### 4. Scaling Strategies (Future)
- Multiple backend instances with distributed locks
- WebSocket price feeds (replace polling)
- Caching layer (Redis)
- Load balancer for backend

---

## Deployment Architecture

### Development Environment

```
Developer Machine
├── Frontend: npm run start-devnet (localhost:3000)
├── Backend: npm run dev (localhost:3001)
└── Contract: Deployed on Devnet
```

### Production Environment

```
┌──────────────────────────────────────────────────┐
│  Production Deployment                            │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │  Frontend (Static Site)                    │  │
│  │  - Hosted on: Vercel/Netlify/S3           │  │
│  │  - CDN: CloudFlare                         │  │
│  │  - HTTPS: Required                         │  │
│  │  - Domain: stellarnova.io                  │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │  Backend (Node.js Service)                 │  │
│  │  - Hosted on: AWS EC2/DigitalOcean/Heroku │  │
│  │  - Process manager: PM2                    │  │
│  │  - Monitoring: CloudWatch/Datadog          │  │
│  │  - Logs: Centralized logging               │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │  Smart Contract                            │  │
│  │  - Network: MultiversX Mainnet            │  │
│  │  - Address: erd1qqqq...                    │  │
│  │  - Upgrade: Owner-controlled               │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │  External Services                         │  │
│  │  - xExchange: Price feeds, swaps          │  │
│  │  - DeepSeek: AI analysis                   │  │
│  │  - MultiversX API: Blockchain queries     │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

---

## Technology Decisions & Trade-offs

### Why React + Vite?
✅ Fast development experience
✅ Hot module replacement
✅ Smaller bundle sizes than Webpack
✅ Modern, well-supported

### Why MultiversX SDK 5.x?
✅ Official SDK with full feature support
✅ Wallet integration built-in
✅ Transaction signing abstraction
✅ Type-safe TypeScript bindings

### Why DeepSeek over OpenAI?
✅ 10x cheaper ($0.14 vs $1.50 per 1M tokens)
✅ Fast enough for real-time analysis
✅ Good reasoning capabilities
✅ Crypto-aware training data

### Why Node.js Backend?
✅ JavaScript ecosystem familiarity
✅ Fast development
✅ Good MultiversX SDK support
✅ Easy deployment

### Why Direct xExchange Integration?
✅ No intermediate contracts = lower gas
✅ Atomic swaps (no partial execution)
✅ Leverages existing liquidity
✅ Simpler user experience

---

## Future Architecture Evolution

### Phase 2: Enhanced Trading
- Natural language prompt parser
- DCA scheduler service
- Advanced order types (stop-loss, trailing stop)

### Phase 3: Social Integration
- Twitter bot service
- Telegram/Discord webhooks
- Social trading feed

### Phase 4: Multi-Chain
- Chain abstraction layer
- Cross-chain bridges
- Unified liquidity

---

**This architecture is designed for:**
- ✅ Security first (non-custodial, user-signed)
- ✅ Scalability (can handle 1000s of orders)
- ✅ Maintainability (clear separation of concerns)
- ✅ User experience (fast, intuitive, AI-powered)

---

**For component-specific details, see:**
- [Frontend README](frontend/README.md)
- [Backend README](backend/README.md)
- [AI README](ai/README.md)
- [Contract README](contracts/stellarnova-sc/README.md)
