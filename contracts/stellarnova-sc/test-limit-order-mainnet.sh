#!/bin/bash

# Test Limit Order on Mainnet
# Creates a test limit order using vault funds

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/mainnet.config.sh"

CONTRACT_ADDRESS=$(cat deployed-contract-mainnet.txt)

echo "========================================="
echo "Test Limit Order - Mainnet"
echo "========================================="
echo ""
echo "Contract: $CONTRACT_ADDRESS"
echo ""

# Get user address
USER_ADDRESS=$(mxpy wallet convert --infile $DEPLOYER_PEM --in-format pem --out-format address-bech32 | tail -1)
echo "User: $USER_ADDRESS"
echo ""

# Step 1: Check current balance
echo "========================================="
echo "Step 1: Check USDC Balance in Vault"
echo "========================================="
echo ""

BALANCE_OUTPUT=$(mxpy contract query $CONTRACT_ADDRESS \
  --proxy $PROXY \
  --function getUserTokenBalance \
  --arguments $USER_ADDRESS str:USDC-c76f1f 2>&1)

echo "$BALANCE_OUTPUT"
echo ""

# Check if user has balance
if echo "$BALANCE_OUTPUT" | grep -q "returnData"; then
    echo "✅ Vault balance query successful"
else
    echo "⚠️  No USDC in vault yet!"
    echo ""
    echo "You need to deposit USDC first:"
    echo "  1. Get USDC from xExchange"
    echo "  2. Send USDC to contract with 'deposit' function"
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 2: Get current WEGLD/USDC price for reference
echo ""
echo "========================================="
echo "Step 2: Current Market Info"
echo "========================================="
echo ""
echo "xExchange WEGLD/USDC pair:"
echo "https://xexchange.com/swap?firstToken=WEGLD-bd4d79&secondToken=USDC-c76f1f"
echo ""
echo "Check current price, then set your target price."
echo ""

# Step 3: Create test limit order
echo "========================================="
echo "Step 3: Create Limit Order"
echo "========================================="
echo ""
echo "We'll create a test limit order:"
echo ""
echo "Order Details:"
echo "  From: 1 USDC"
echo "  To: WEGLD"
echo "  Target Price: 50 USDC per 1 WEGLD"
echo "  Slippage: 500 bp (5%)"
echo "  Duration: 1 day (86400 seconds)"
echo ""
echo "Note: This order will execute when WEGLD price reaches 50 USDC"
echo "      (adjust target_price_num if you want different trigger)"
echo ""

read -p "Ready to create limit order? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Creating limit order..."
echo ""

# Order parameters
FROM_TOKEN="USDC-c76f1f"
FROM_AMOUNT="1000000"  # 1 USDC (6 decimals)
TO_TOKEN="WEGLD-bd4d79"
TARGET_PRICE_NUM="50000000"  # 50 USDC (6 decimals)
TARGET_PRICE_DENOM="1000000000000000000"  # 1 WEGLD (18 decimals)
SLIPPAGE_BP="500"  # 5%
DURATION="86400"  # 1 day in seconds

# Create limit order
CREATE_OUTPUT=$(mxpy contract call $CONTRACT_ADDRESS \
  --pem $DEPLOYER_PEM \
  --proxy $PROXY \
  --chain $CHAIN_ID \
  --gas-limit 20000000 \
  --function createLimitOrder \
  --arguments str:$FROM_TOKEN $FROM_AMOUNT str:$TO_TOKEN $TARGET_PRICE_NUM $TARGET_PRICE_DENOM $SLIPPAGE_BP $DURATION \
  --send 2>&1)

echo "$CREATE_OUTPUT"
echo ""

# Extract transaction hash
TX_HASH=$(echo "$CREATE_OUTPUT" | grep -oP 'emittedTransactionHash.*?[a-f0-9]{64}' | grep -oP '[a-f0-9]{64}' | head -1)

if [ -n "$TX_HASH" ]; then
    echo "========================================="
    echo "✅ Limit Order Created!"
    echo "========================================="
    echo ""
    echo "Transaction: https://explorer.multiversx.com/transactions/$TX_HASH"
    echo ""
    echo "Order Details:"
    echo "  Sell: 1 USDC"
    echo "  Buy: WEGLD"
    echo "  Target: 50 USDC per WEGLD"
    echo "  Expires: in 1 day"
    echo ""
    echo "========================================="
    echo "Next Steps:"
    echo "========================================="
    echo ""
    echo "1. Query pending orders:"
    echo "   ./query-pending-orders.sh"
    echo ""
    echo "2. Start backend executor:"
    echo "   cd ../../backend && npm run dev"
    echo ""
    echo "3. Monitor execution:"
    echo "   curl http://localhost:3001/api/limit-orders/executor/status"
    echo ""
    echo "4. Check order status on explorer:"
    echo "   https://explorer.multiversx.com/accounts/$CONTRACT_ADDRESS"
    echo ""
else
    echo "========================================="
    echo "❌ Failed to Create Limit Order"
    echo "========================================="
    echo ""
    echo "Possible reasons:"
    echo "1. Insufficient USDC in vault (need to deposit first)"
    echo "2. Gas limit too low"
    echo "3. Invalid parameters"
    echo ""
    echo "Check transaction details above for more info."
    exit 1
fi
