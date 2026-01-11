# StellarNova Smart Contract

AI-powered trading agent on MultiversX. Execute trades using natural language without repeated wallet signatures.

## 🚀 Deployed Contract (Mainnet)

**Contract Address**: `erd1qqqqqqqqqqqqqpgqhcmms89zn6997pvpv9g7ckpcxz4mnjn088zqtvnz29`

🎉 **Live on Mainnet with 150+ Transactions!**

- [View on Explorer](https://explorer.multiversx.com/accounts/erd1qqqqqqqqqqqqqpgqhcmms89zn6997pvpv9g7ckpcxz4mnjn088zqtvnz29)
- Architecture: JEXchange (Direct ESDT payment, no vault needed)
- Supports: Limit orders with automatic execution when target price is met

## Architecture

**Vault-Based Approval Model**
- Users deposit tokens once into the contract
- Backend executes trades on behalf of users (no signature per trade)
- Users can withdraw anytime
- Non-custodial: only user can withdraw their funds

## Core Endpoints

### User Endpoints

#### `deposit()`
Deposit tokens into your vault.

**Payment**: Send tokens with transaction
**Access**: Anyone
**Example**:
```bash
# Deposit 100 USDC
mxpy contract call <CONTRACT_ADDRESS> \
  --function deposit \
  --pem wallet.pem \
  --gas-limit 10000000 \
  --chain devnet \
  --esdt-transfers USDC-abc123:100000000
```

#### `executeTrade(user, from_token, to_token, from_amount, min_amount_out)`
Execute a token swap (called by backend after AI parsing).

**Parameters**:
- `user`: User address
- `from_token`: Token to sell
- `to_token`: Token to buy
- `from_amount`: Amount to swap
- `min_amount_out`: Minimum acceptable output (slippage protection)

**Access**: Anyone (backend service)
**Example**:
```bash
# Swap 50 USDC for EGLD
mxpy contract call <CONTRACT_ADDRESS> \
  --function executeTrade \
  --arguments <USER_ADDRESS> str:USDC-abc123 str:EGLD 50000000 45000000 \
  --pem backend.pem \
  --gas-limit 20000000 \
  --chain devnet
```

#### `withdraw(token, amount)`
Withdraw tokens from vault.

**Parameters**:
- `token`: Token identifier
- `amount`: Amount to withdraw (0 = withdraw all)

**Access**: Token owner only
**Example**:
```bash
# Withdraw all EGLD
mxpy contract call <CONTRACT_ADDRESS> \
  --function withdraw \
  --arguments str:EGLD 0 \
  --pem wallet.pem \
  --gas-limit 10000000 \
  --chain devnet
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

#### `getUserTokenBalance(user, token) -> BigUint`
Get user's vault balance for a token.

#### `isTokenWhitelisted(token) -> bool`
Check if token is whitelisted.

#### `getWhitelistedTokens() -> Vec<TokenIdentifier>`
Get all whitelisted tokens.

#### `getXExchangeRouter() -> ManagedAddress`
Get xExchange router address.

## Events

#### `deposit(user, token, amount, new_balance)`
Emitted when user deposits.

#### `trade_executed(user, from_token, to_token, from_amount, to_amount, timestamp)`
Emitted when trade executes.

#### `withdraw(user, token, amount, remaining_balance)`
Emitted when user withdraws.

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

### ⚠️ MVP Limitations (TODO for Production)
- [ ] Replace simulated swap with actual xExchange integration
- [ ] Add daily/per-trade limits
- [ ] Implement rate limiting for execute_trade
- [ ] Add backend authentication for execute_trade
- [ ] Implement proper access control (only authorized backend can call execute_trade)
- [ ] Add MEV protection
- [ ] Implement multi-hop routing for better prices

## xExchange Integration (TODO)

Current implementation uses **simulated swaps** (90% of input). For production:

1. Add xExchange proxy contract interface
2. Replace `execute_dex_swap()` with actual contract call:
```rust
self.tx()
    .to(&router)
    .typed(xexchange_proxy::XExchangeProxy)
    .swap_tokens_fixed_input(to_token, min_amount_out)
    .payment((from_token, 0, from_amount))
    .returns(ReturnsResult)
    .sync_call()
```
3. Handle WEGLD wrapping/unwrapping for EGLD trades
4. Implement multi-pair routing for optimal prices

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

1. **Setup (One-time)**
   ```
   User → deposit(USDC) → Contract stores balance
   ```

2. **Trading (No signatures)**
   ```
   User types: "Buy 1 EGLD with USDC"
   → AI parses prompt
   → Backend calls executeTrade()
   → Contract executes swap
   → User sees result
   ```

3. **Withdrawal (Anytime)**
   ```
   User → withdraw(token) → Receives tokens back
   ```

## Demo Checklist

- [ ] Deploy contract to devnet
- [ ] Whitelist USDC, EGLD, WEGLD
- [ ] User deposits 100 USDC
- [ ] Execute test trade via backend
- [ ] Verify event in explorer
- [ ] User withdraws remaining balance

## Support

For questions, contact the StellarNova team or open an issue.

## License

MIT
