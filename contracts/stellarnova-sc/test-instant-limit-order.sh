#!/bin/bash

# Create a test limit order with target price slightly above/below current
# For testing immediate execution or waiting behavior

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/mainnet.config.sh"

CONTRACT_ADDRESS=$(cat deployed-contract-mainnet.txt)

echo "========================================="
echo "Create Test Limit Order"
echo "========================================="
echo ""
echo "Choose test mode:"
echo "  1) INSTANT - Target 0.01% ABOVE current price (executes immediately)"
echo "  2) WAITING - Target 0.01% BELOW current price (waits for price drop)"
echo ""
read -p "Select mode (1 or 2): " MODE
echo ""

if [[ "$MODE" != "1" && "$MODE" != "2" ]]; then
    echo "❌ Invalid choice. Use 1 or 2."
    exit 1
fi

# Get current price from xExchange
echo "📊 Fetching current USDC/WEGLD price..."

CURRENT_PRICE=$(curl -s 'https://graph.xexchange.com/graphql' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "query { pair(address: \"erd1qqqqqqqqqqqqqpgqeel2kumf0r8ffyhth7pqdujjat9nx0862jpsg2pqaq\") { info { reserves0 reserves1 } } }"
  }' | python3 -c "
import sys, json
data = json.load(sys.stdin)
reserves0 = float(data['data']['pair']['info']['reserves0'])
reserves1 = float(data['data']['pair']['info']['reserves1'])
# Price = USDC/WEGLD (how much USDC per WEGLD)
price = reserves0 / reserves1
print(f'{price:.6f}')
")

echo "Current price: $CURRENT_PRICE USDC per WEGLD"

# Calculate target price based on mode
if [[ "$MODE" == "1" ]]; then
    # 0.01% higher - will execute immediately
    TARGET_PRICE=$(python3 -c "print(f'{float('$CURRENT_PRICE') * 1.0001:.6f}')")
    MODE_TEXT="0.01% ABOVE (INSTANT EXECUTION)"
else
    # 0.01% lower - will wait
    TARGET_PRICE=$(python3 -c "print(f'{float('$CURRENT_PRICE') * 0.9999:.6f}')")
    MODE_TEXT="0.01% BELOW (WILL WAIT)"
fi

echo "Target price:  $TARGET_PRICE USDC per WEGLD ($MODE_TEXT)"
echo ""

# Convert to numerator/denominator (use denominator = 1000000 for precision)
DENOMINATOR=1000000
NUMERATOR=$(python3 -c "print(int(float('$TARGET_PRICE') * $DENOMINATOR))")

echo "Price as fraction: $NUMERATOR / $DENOMINATOR"
echo ""

# Order parameters
FROM_TOKEN="$TOKEN_USDC"
TO_TOKEN="$TOKEN_WEGLD"
AMOUNT="1000000"          # 0.001 USDC (6 decimals) - tiny test amount
SLIPPAGE="500"            # 5% slippage
DURATION="3600"           # 1 hour expiration

echo "Order Details:"
echo "  From:          $FROM_TOKEN"
echo "  To:            $TO_TOKEN"
echo "  Amount:        0.001 USDC (tiny test)"
echo "  Target Price:  $TARGET_PRICE"
echo "  Slippage:      5%"
echo "  Duration:      1 hour"
echo ""

# Get deployer address
DEPLOYER_ADDRESS=$(mxpy wallet convert --infile $DEPLOYER_PEM --in-format pem --out-format address-bech32 | tail -1)
echo "Creator:       $DEPLOYER_ADDRESS"
echo ""

if [[ "$MODE" == "1" ]]; then
    echo "⚠️  This order will execute on the NEXT check cycle (within 30 seconds)!"
else
    echo "⏰ This order will WAIT until price drops by 0.01%"
fi
echo ""
read -p "Create test order? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

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
  --arguments str:$FROM_TOKEN $AMOUNT str:$TO_TOKEN $NUMERATOR $DENOMINATOR $SLIPPAGE $DURATION \
  --send

echo ""
echo "========================================="
echo "✅ Test Order Created!"
echo "========================================="
echo ""
echo "📍 Current price:  $CURRENT_PRICE"
echo "🎯 Target price:   $TARGET_PRICE ($MODE_TEXT)"
echo ""
if [[ "$MODE" == "1" ]]; then
    echo "⏰ The order will execute within 30 seconds!"
else
    echo "⏳ The order will wait for price to drop by 0.01%"
fi
echo ""
echo "Check backend logs to see execution:"
echo "  tail -f /tmp/backend-mainnet.log"
echo ""
echo "Or check pending orders:"
echo "  curl -s https://api.multiversx.com/query \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"scAddress\":\"$CONTRACT_ADDRESS\",\"funcName\":\"getPendingOrders\"}' | jq"
echo ""
