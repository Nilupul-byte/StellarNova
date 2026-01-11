#!/bin/bash

# Create a test limit order on Devnet

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/devnet.config.sh"

CONTRACT_ADDRESS=$(cat deployed-contract-devnet.txt)

echo "========================================="
echo "Create Limit Order - Devnet"
echo "========================================="
echo ""

# Order parameters
FROM_TOKEN="$TOKEN_USDC"
TO_TOKEN="$TOKEN_WEGLD"
AMOUNT="500000000000000000"  # 0.5 USDC
TARGET_PRICE_NUM="100"       # Target price numerator
TARGET_PRICE_DEN="1"         # Target price denominator (price = 100/1 = 100 WEGLD per USDC)
SLIPPAGE="500"               # 5% slippage
DURATION="3600"              # 1 hour expiration

echo "Order Details:"
echo "  From:          $FROM_TOKEN"
echo "  To:            $TO_TOKEN"
echo "  Amount:        $(echo "scale=2; $AMOUNT / 1000000000000000000" | bc) USDC"
echo "  Target Price:  $TARGET_PRICE_NUM / $TARGET_PRICE_DEN"
echo "  Slippage:      $(echo "scale=2; $SLIPPAGE / 100" | bc)%"
echo "  Duration:      $DURATION seconds"
echo ""

# Get deployer address
DEPLOYER_ADDRESS=$(mxpy wallet convert --infile $DEPLOYER_PEM --in-format pem --out-format address-bech32 | tail -1)
echo "Creator:       $DEPLOYER_ADDRESS"
echo ""

echo "Creating limit order..."
echo ""

# Create limit order transaction
mxpy contract call $CONTRACT_ADDRESS \
  --pem $DEPLOYER_PEM \
  --proxy $PROXY \
  --chain $CHAIN_ID \
  --gas-limit 30000000 \
  --function "createLimitOrder" \
  --arguments str:$FROM_TOKEN $AMOUNT str:$TO_TOKEN $TARGET_PRICE_NUM $TARGET_PRICE_DEN $SLIPPAGE $DURATION \
  --send

echo ""
echo "========================================="
echo "✅ Limit Order Created!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Query the order to verify the fix:"
echo "   ./test-query-order-devnet.sh 1"
echo ""
echo "2. Check pending orders:"
echo "   ./test-query-pending-devnet.sh"
echo ""
