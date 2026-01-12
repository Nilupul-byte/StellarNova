# StellarNova Smart Contract

AI-powered trading agent on MultiversX. Execute trades using natural language without repeated wallet signatures.

**All swaps execute through official xExchange routers for best liquidity and execution.**

## 🚀 Deployed Contract (Mainnet)

**Contract Address**: `erd1qqqqqqqqqqqqqpgqhcmms89zn6997pvpv9g7ckpcxz4mnjn088zqtvnz29`

🎉 **Live on Mainnet with 150+ Transactions!**

- [View on Explorer](https://explorer.multiversx.com/accounts/erd1qqqqqqqqqqqqqpgqhcmms89zn6997pvpv9g7ckpcxz4mnjn088zqtvnz29)
- Architecture: Direct on-chain execution with ESDT payment (fully non-custodial, no vault needed)
- **Swap Execution**: All trades route through **xExchange routers** for optimal liquidity
- Supports: Limit orders with automatic execution when target price is met

## Architecture

**Direct ESDT Payment Model with xExchange Integration**
- Users send tokens directly with their limit order transaction
- Tokens are locked in the contract until execution, cancellation, or expiration
- Backend monitors prices from xExchange and executes orders when conditions are met
- **All swaps execute through xExchange routers** - leveraging the deepest liquidity on MultiversX
- Fully non-custodial: users maintain complete control of their funds
- No deposit/withdraw needed - seamless on-chain execution via xExchange

## Core Endpoints

### User Endpoints

#### `createLimitOrder`
Create a limit order with direct ESDT payment.

**Payment**: Send tokens with transaction (ESDT transfer pattern)
**Access**: Anyone
**Example**:
```bash
# Create limit order: Buy WEGLD with 10 USDC at target price
mxpy contract call <CONTRACT_ADDRESS> \
  --function ESDTTransfer \
  --arguments str:USDC-c76f1f 0x989680 \
              str:createLimitOrder \
              str:WEGLD-bd4d79 \
              0x025E70 0x03E8 0x05DC 0x015180 \
  --pem wallet.pem \
  --gas-limit 20000000 \
  --chain mainnet
```

**Transaction Format**:
```
ESDTTransfer@<fromToken>@<amount>@createLimitOrder@<toToken>@<priceNum>@<priceDenom>@<slippageBp>@<duration>
```

#### `executeLimitOrder(orderId, priceNum, priceDenom)`
Execute a limit order (called by backend when price target is met).

**Parameters**:
- `orderId`: Order ID to execute
- `priceNum`: Current price numerator
- `priceDenom`: Current price denominator

**Access**: Anyone (typically backend executor)
**Example**:
```bash
# Execute order #20 at current price
mxpy contract call <CONTRACT_ADDRESS> \
  --function executeLimitOrder \
  --arguments 0x14 0x025E70 0x03E8 \
  --pem executor.pem \
  --gas-limit 80000000 \
  --chain mainnet
```

#### `cancelLimitOrder(orderId)`
Cancel a pending limit order and return tokens to user.

**Parameters**:
- `orderId`: Order ID to cancel

**Access**: Order creator only
**Example**:
```bash
# Cancel order #20
mxpy contract call <CONTRACT_ADDRESS> \
  --function cancelLimitOrder \
  --arguments 0x14 \
  --pem wallet.pem \
  --gas-limit 10000000 \
  --chain mainnet
```

### Admin Endpoints

#### `whitelistToken(token)`
Add token to whitelist.

#### `removeToken(token)`
Remove token from whitelist.

#### `setPaused(bool)`
Pause/unpause contract.

#### `setMaxSlippage(basis_points)`
Update max slippage (e.g., 500 = 5%).

#### `setXExchangeRouter(address)`
Update xExchange router address.

## View Functions

#### `getPendingOrders() -> Vec<LimitOrder>`
Get all pending limit orders.

#### `getOrder(orderId) -> LimitOrder`
Get details of a specific order.

#### `getUserOrders(userAddress) -> Vec<u64>`
Get all order IDs for a specific user.

#### `getXExchangeRouter() -> ManagedAddress`
Get xExchange router address for swap execution.

## Events

#### `limitOrderCreated(orderId, user, fromToken, toToken, fromAmount, targetPrice)`
Emitted when a limit order is created.

#### `limitOrderExecuted(orderId, user, fromToken, toToken, fromAmount, toAmount, executionPrice)`
Emitted when a limit order executes successfully.

#### `limitOrderCancelled(orderId, user, fromToken, refundAmount)`
Emitted when a limit order is cancelled.

#### `limitOrderExpired(orderId, user, fromToken, refundAmount)`
Emitted when a limit order expires and tokens are refunded.

## Deployment

### Prerequisites
- Install [mxpy](https://docs.multiversx.com/sdk-and-tools/sdk-py/installing-mxpy)
- Install Rust with [MultiversX toolchain](https://docs.multiversx.com/developers/developer-reference/sc-build-reference)

### Build Contract
```bash
cd contracts/stellarnova-sc
mxpy contract build
```

### Deploy to Devnet
```bash
# 1. Prepare deployment arguments
XEXCHANGE_ROUTER="erd1qqqqqqqqqqqqqpgq..."  # xExchange router address
INITIAL_TOKENS="USDC-abc123 WEGLD-def456"
MAX_SLIPPAGE=500  # 5%

# 2. Deploy
mxpy contract deploy \
  --bytecode output/stellarnova-sc.wasm \
  --arguments $XEXCHANGE_ROUTER $INITIAL_TOKENS $MAX_SLIPPAGE \
  --pem deployer.pem \
  --gas-limit 100000000 \
  --chain devnet \
  --send
```

### Upgrade Contract
```bash
mxpy contract upgrade <CONTRACT_ADDRESS> \
  --bytecode output/stellarnova-sc.wasm \
  --arguments $XEXCHANGE_ROUTER $INITIAL_TOKENS $MAX_SLIPPAGE \
  --pem deployer.pem \
  --gas-limit 100000000 \
  --chain devnet \
  --send
```

## Testing

```bash
# Run tests
mxpy contract test

# Run specific test
cargo test --test integration_test
```

## Security Considerations

### ✅ Security Features
- Token whitelist (prevents trading of malicious tokens)
- Slippage protection (prevents sandwich attacks)
- Pause mechanism (emergency stop)
- User-isolated balances (no cross-user contamination)
- Explicit error messages

### ✅ Production Features (Implemented)
- [x] Full xExchange integration with real on-chain swaps
- [x] Direct ESDT payment pattern (no vault needed)
- [x] Slippage protection (configurable per order)
- [x] Automatic order execution via backend monitoring
- [x] Order cancellation and expiration handling
- [x] Event emissions for audit trail
- [x] **150+ successful transactions on mainnet!**

### 🚀 Future Enhancements
- [ ] Multi-hop routing for better prices
- [ ] Advanced order types (stop-loss, trailing stop)
- [ ] Gas optimization for cross-shard swaps
- [ ] MEV protection mechanisms
- [ ] Rate limiting for order creation

## xExchange Integration

**Status:** ✅ **Live on Mainnet**

The contract integrates directly with xExchange router for token swaps:

```rust
// Actual production implementation
self.tx()
    .to(&router_address)
    .typed(xexchange_proxy::XExchangeProxy)
    .swap_tokens_fixed_input(
        to_token.clone(),
        min_amount_out
    )
    .payment(EgldOrEsdtTokenPayment::new(
        from_token.clone(),
        0,
        from_amount
    ))
    .returns(ReturnsResult)
    .sync_call()
```

**Features:**
- Direct on-chain execution
- Slippage protection via `min_amount_out`
- Automatic token routing via xExchange
- WEGLD/EGLD handling for native token trades

## File Structure
```
stellarnova-sc/
├── src/
│   ├── lib.rs        # Main contract logic
│   ├── storage.rs    # Storage mappers
│   ├── events.rs     # Event definitions
│   └── errors.rs     # Error messages
├── Cargo.toml
└── README.md
```

## Contract Flow

1. **Create Limit Order**
   ```
   User → createLimitOrder (sends tokens with tx) → Contract locks tokens
   ```

2. **Automatic Execution**
   ```
   Backend monitors prices every 30 seconds
   → Price target met?
   → Backend calls executeLimitOrder()
   → Contract swaps tokens via xExchange
   → Tokens sent to user's wallet
   ```

3. **Cancel Order (Anytime)**
   ```
   User → cancelLimitOrder() → Contract refunds tokens
   ```

4. **Order Expiration**
   ```
   Order expires → Backend or user triggers refund → Tokens returned
   ```

## Demo Checklist

- [x] Deploy contract to mainnet ✅
- [x] Configure xExchange router ✅
- [x] Create test limit order (10 USDC → WEGLD) ✅
- [x] Backend monitors and executes order ✅
- [x] Verify execution in explorer ✅
- [x] Test order cancellation ✅
- [x] **150+ transactions completed on mainnet!** 🎉

## Support

For questions, contact the StellarNova team or open an issue.

## License

MIT
