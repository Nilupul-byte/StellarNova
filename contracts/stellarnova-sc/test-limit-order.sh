#!/bin/bash

# Test Limit Order Creation
# This script creates a test limit order on mainnet

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/mainnet.config.sh"

CONTRACT="erd1qqqqqqqqqqqqqpgqv6xna5k6q6axnvce2n0g65n78vvuyx0088zq8scpu0"
WALLET_PEM="stellarnova-deployer.pem"

echo "========================================="
echo "Test Limit Order Creation"
echo "========================================="
echo ""

# Get wallet address
WALLET_ADDRESS=$(mxpy wallet convert --infile $WALLET_PEM --in-format pem --out-format address-bech32)
echo "Wallet: $WALLET_ADDRESS"
echo "Contract: $CONTRACT"
echo ""

# Step 1: Check current vault balance
echo "📊 Checking vault balances..."
echo ""

# Check USDC balance
echo "USDC Balance:"
mxpy contract query $CONTRACT \
  --proxy=$PROXY \
  --function=getUserTokenBalance \
  --arguments $WALLET_ADDRESS str:USDC-c76f1f \
  2>&1 | grep -A 3 "returnData" || echo "No USDC in vault"

echo ""

# Check WEGLD balance
echo "WEGLD Balance:"
mxpy contract query $CONTRACT \
  --proxy=$PROXY \
  --function=getUserTokenBalance \
  --arguments $WALLET_ADDRESS str:WEGLD-bd4d79 \
  2>&1 | grep -A 3 "returnData" || echo "No WEGLD in vault"

echo ""
echo "========================================="
echo "Creating Test Limit Order"
echo "========================================="
echo ""

# Order Parameters:
# - Sell: 1 USDC (1000000 with 6 decimals)
# - Buy: WEGLD
# - Target Price: 0.02 WEGLD per 1 USDC (or 50 USDC per 1 WEGLD)
#   Price = numerator / denominator = 50 / 1 = 50 USDC per WEGLD
#   So we want: when 1 WEGLD = 50 USDC (or less), execute
# - Slippage: 5% (500 basis points)
# - Duration: 1 hour (3600 seconds)

FROM_TOKEN="USDC-c76f1f"
FROM_AMOUNT="1000000"  # 1 USDC with 6 decimals
TO_TOKEN="WEGLD-bd4d79"
TARGET_PRICE_NUM="50"  # 50 USDC
TARGET_PRICE_DENOM="1"  # per 1 WEGLD
SLIPPAGE_BP="500"  # 5%
DURATION="3600"  # 1 hour

echo "Order Details:"
echo "  Sell: 1 $FROM_TOKEN"
echo "  Buy: $TO_TOKEN"
echo "  Target Price: $TARGET_PRICE_NUM USDC per $TARGET_PRICE_DENOM WEGLD"
echo "  Slippage: 5%"
echo "  Duration: 1 hour"
echo ""

read -p "Do you want to create this test order? (yes/no) " -r
echo

if [[ ! $REPLY == "yes" ]]; then
    echo "Cancelled"
    exit 0
fi

echo "Creating limit order..."
echo ""

# Convert arguments to hex
FROM_TOKEN_HEX=$(echo -n "$FROM_TOKEN" | xxd -p)
FROM_AMOUNT_HEX=$(printf '%x' $FROM_AMOUNT)
TO_TOKEN_HEX=$(echo -n "$TO_TOKEN" | xxd -p)
TARGET_NUM_HEX=$(printf '%x' $TARGET_PRICE_NUM)
TARGET_DENOM_HEX=$(printf '%x' $TARGET_PRICE_DENOM)
SLIPPAGE_HEX=$(printf '%x' $SLIPPAGE_BP)
DURATION_HEX=$(printf '%x' $DURATION)

# Create limit order
TX_HASH=$(mxpy contract call $CONTRACT \
  --pem $WALLET_PEM \
  --proxy $PROXY \
  --chain $CHAIN_ID \
  --gas-limit 20000000 \
  --function createLimitOrder \
  --arguments \
    str:$FROM_TOKEN \
    $FROM_AMOUNT \
    str:$TO_TOKEN \
    $TARGET_PRICE_NUM \
    $TARGET_PRICE_DENOM \
    $SLIPPAGE_BP \
    $DURATION \
  --send \
  2>&1 | grep -oP 'hash: \K[a-f0-9]+' || echo "")

if [ -z "$TX_HASH" ]; then
  echo "❌ Failed to create order"
  echo "Check if you have USDC deposited in vault:"
  echo "  mxpy contract call $CONTRACT --function deposit --token USDC-c76f1f --amount 10000000 ..."
  exit 1
fi

echo "✅ Limit Order Created!"
echo ""
echo "Transaction: $TX_HASH"
echo "Explorer: https://explorer.multiversx.com/transactions/$TX_HASH"
echo ""

# Wait a bit for transaction to process
echo "Waiting 10 seconds for transaction to process..."
sleep 10

# Query order ID (it will be the nextOrderId - 1)
echo ""
echo "Querying next order ID..."
NEXT_ORDER_ID=$(mxpy contract query $CONTRACT \
  --proxy=$PROXY \
  --function=getNextOrderId \
  2>&1 | grep -oP 'base64: \K[A-Za-z0-9+/=]+' | base64 -d | xxd -p | sed 's/^0*//')

if [ -n "$NEXT_ORDER_ID" ]; then
  ORDER_ID=$((16#$NEXT_ORDER_ID - 1))
  echo "Your order ID: $ORDER_ID"
  echo ""
  echo "✅ Order created successfully!"
  echo ""
  echo "The backend executor will:"
  echo "  1. Detect this order in the next check (~30 seconds)"
  echo "  2. Monitor xExchange price for USDC/WEGLD"
  echo "  3. Execute when price reaches 50 USDC per WEGLD (or better)"
  echo ""
  echo "Watch your backend logs to see it in action!"
else
  echo "Could not determine order ID, but order may have been created."
  echo "Check transaction on explorer."
fi

echo ""
echo "========================================="
echo "Useful Commands:"
echo "========================================="
echo ""
echo "# Get pending orders:"
echo "mxpy contract query $CONTRACT --proxy=$PROXY --function=getPendingOrders"
echo ""
echo "# Get order details:"
echo "mxpy contract query $CONTRACT --proxy=$PROXY --function=getLimitOrder --arguments ORDER_ID"
echo ""
echo "# Cancel order:"
echo "mxpy contract call $CONTRACT --pem $WALLET_PEM --function=cancelLimitOrder --arguments ORDER_ID --gas-limit 10000000 --send"
echo ""
