# StellarNova 🌌

> AI-powered natural language trading on MultiversX

Trade crypto with plain English. No complex interfaces. No repeated wallet signatures.

**🚀 Try it now:** [https://stellarnova.netlify.app/](https://stellarnova.netlify.app/)

**📜 Live Smart Contract (Mainnet):** [erd1qqqq...088zqtvnz29](https://explorer.multiversx.com/accounts/erd1qqqqqqqqqqqqqpgqhcmms89zn6997pvpv9g7ckpcxz4mnjn088zqtvnz29) • **150+ Transactions** 🎉

---

## What is StellarNova?

StellarNova is a **non-custodial DEX interface** that combines instant market swaps with AI-powered limit orders. All trades execute through **xExchange routers** - the most liquid DEX on MultiversX.

Unlike traditional DEX interfaces, StellarNova offers:
- **Instant Market Swaps** - Direct integration with xExchange router for best execution
- **Atlas AI** - AI-analyzed limit orders with automatic execution via xExchange
- **Natural Language** - Future support for trading via plain English commands
- **xExchange Powered** - All swaps executed through official xExchange routers

---

## Why StellarNova?

**The Problem:**
- DEX trading requires constant monitoring for price movements
- Setting limit orders is complex and requires technical knowledge
- No AI assistance for trade timing and strategy

**Our Solution:**
- **Market Swaps** - Execute instant swaps through xExchange with one click
- **Limit Orders** - Set price targets and let our backend executor handle execution
- **AI Analysis** - Get AI-powered insights on your trades (powered by DeepSeek)
- **Non-Custodial** - You maintain full control, all transactions signed by your wallet

---

## How It Works

### Basic Mode (Market Swaps)
```
User connects wallet
    ↓
Select tokens & amount
    ↓
Transaction signed by user's wallet
    ↓
Swap executed via xExchange router (best liquidity)
    ↓
Tokens received instantly
```

### Atlas AI Mode (Limit Orders)
```
User creates limit order
    ↓
Order stored on-chain with target price
    ↓
Backend executor monitors prices (every 30s)
    ↓
When target price met → auto-execute swap via xExchange
    ↓
Tokens delivered to user's wallet
```

---

## Modes

### 🟢 Market Swap
- **xExchange Router Integration** - Swap tokens instantly at current market price using official xExchange liquidity
- **Best Execution** - Leverages xExchange's deep liquidity pools for optimal pricing
- **No intermediaries** - Your wallet signs directly with xExchange router
- **Simple & fast** - One transaction, immediate execution
- **Location:** Dashboard → StellarNova Trader

### 🔵 Atlas AI (Limit Orders)
- **Set target prices** - Define your entry/exit points
- **Automatic execution** - Backend monitors and executes via xExchange when price reached
- **xExchange powered swaps** - All limit orders execute through official xExchange routers
- **AI analysis** - Get DeepSeek-powered insights on trade timing
- **Order management** - View and cancel pending orders
- **Location:** Atlas → Limit Orders

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS 4 |
| **Blockchain** | MultiversX (Rust smart contracts) |
| **DEX Integration** | **xExchange Routers** - Official integration for all swaps (market & limit orders) |
| **Liquidity** | xExchange Liquidity Pools - Best execution on MultiversX |
| **AI** | DeepSeek API (trade analysis) |
| **Backend** | Node.js, Express, TypeScript (limit order executor) |
| **Wallet** | MultiversX DeFi Wallet, xPortal, Web Wallet, Passkey |

---

## Live Demo

**Mainnet:** [Coming Soon - Link will be provided]

**Devnet:** [Testing Environment - Link will be provided]

**Smart Contract:**
- **Mainnet:** `erd1qqqqqqqqqqqqqpgqhcmms89zn6997pvpv9g7ckpcxz4mnjn088zqtvnz29`
- **Devnet:** `erd1qqqqqqqqqqqqqpgqhcmms89zn6997pvpv9g7ckpcxz4mnjn088zqtvnz29`

---

## Security Model

### Non-Custodial Architecture
- ✅ **User funds never leave user's wallet** (market swaps)
- ✅ **Limit orders use ESDT payment** - Tokens sent with order creation, locked on-chain
- ✅ **User-signed transactions** - All deposits/cancellations require wallet signature
- ✅ **Backend cannot withdraw** - Only executes orders that meet price conditions
- ✅ **Slippage protection** - Max 15-20% slippage to prevent sandwich attacks

### Smart Contract Security
- ✅ Limit order storage with expiration
- ✅ Order ownership validation
- ✅ Price verification before execution
- ✅ Event emissions for all operations
- ⚠️ **Beta Status** - Not yet audited, use at your own risk

---

## Roadmap

### ✅ Phase 1 — MVP (Current)

Core functionality delivered and demo-ready:

- [x] xExchange direct swap integration
- [x] MultiversX wallet connection (DeFi Wallet, xPortal, Passkey)
- [x] Limit order smart contract deployed
- [x] Backend executor service
- [x] AI-assisted trade analysis (DeepSeek)
- [x] Order management UI

### 🔄 Phase 2 — Advanced Trading (Planned | Q1 2026)

Focused on power users and automation:

- [ ] **Dollar-Cost Averaging (DCA)** — Automated recurring buys/sells
- [ ] **Natural language conditional orders** — e.g. "Buy 10 USDC worth of WEGLD if price drops 5%"
- [ ] Advanced order types (stop-loss, take-profit, trailing stop)
- [ ] Multi-pair routing for improved execution
- [ ] Portfolio analytics dashboard

### 🚀 Phase 3 — Social & Distribution (Exploratory | Q2 2026)

User growth and social trading experiments:

- [ ] **Social integrations** — X / Telegram / Discord alerts
- [ ] **Prompt-based token launch workflows** — "Launch my token with 1M supply"
- [ ] Copy trading & strategy sharing
- [ ] Mobile apps (iOS & Android)

### 🌐 Phase 4 — Cross-Chain & Research (Long-Term Vision)

Research-driven expansion:

- [ ] Multi-chain support (Ethereum, BSC, Solana)
- [ ] Cross-chain swaps & liquidity aggregation
- [ ] Advanced AI strategies (sentiment analysis, on-chain signals, technical indicators)

---

## Supported Tokens

**Current:**
- WEGLD (Wrapped EGLD)
- USDC (USD Coin)

**Future:** All xExchange-listed tokens

---

## Documentation

- **[Frontend README](frontend/README.md)** - UI architecture, wallet integration
- **[Backend README](backend/README.md)** - API, executor service, AI integration
- **[AI README](ai/README.md)** - AI models, prompt engineering, analysis logic
- **[Contract README](contracts/stellarnova-sc/README.md)** - Smart contract API, deployment
- **[Architecture Guide](ARCHITECTURE.md)** - System design, data flow, component interactions

---

## Disclaimer

⚠️ **Beta Phase - Use at Your Own Risk**

StellarNova is currently in **beta testing**. While we've implemented security best practices:
- Smart contracts are **not yet audited**
- Limit orders are **experimental**
- AI analysis is **for informational purposes only**

**This is NOT financial advice. Always:**
- Start with small amounts
- Understand slippage and price impact
- Do your own research (DYOR)

---

## Team

Built with ❤️ for the MultiversX ecosystem

**Contact:** nilupulweerasingh27@gmail.com

---

<div align="center">

**🌌 StellarNova** • **Non-Custodial** • **AI-Powered** • **Beta**

*Trade smarter, not harder*

</div>
