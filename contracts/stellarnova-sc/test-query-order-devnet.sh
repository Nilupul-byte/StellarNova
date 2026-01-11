#!/bin/bash

# Query a specific limit order on Devnet - THIS IS THE KEY TEST!

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/devnet.config.sh"

CONTRACT_ADDRESS=$(cat deployed-contract-devnet.txt)
ORDER_ID=${1:-1}  # Default to order ID 1

echo "========================================="
echo "Query Limit Order - Devnet"
echo "========================================="
echo ""
echo "Contract:  $CONTRACT_ADDRESS"
echo "Order ID:  $ORDER_ID"
echo ""
echo "Testing the fix for getLimitOrder..."
echo ""

# Convert order ID to hex
ORDER_ID_HEX=$(printf '%02x' $ORDER_ID)

# Query the order using the API
echo "Querying order via MultiversX API..."
RESULT=$(curl -s "https://devnet-api.multiversx.com/query" \
  -H "Content-Type: application/json" \
  -d "{\"scAddress\":\"$CONTRACT_ADDRESS\",\"funcName\":\"getLimitOrder\",\"args\":[\"$ORDER_ID_HEX\"]}" )

echo "$RESULT" | python3 -m json.tool

# Check for actual errors (500 status code or error in returnCode)
if echo "$RESULT" | grep -q "\"statusCode\": 500"; then
    echo ""
    echo "========================================="
    echo "❌ FAILED - Got 500 error!"
    echo "========================================="
    echo ""
    echo "The fix didn't work. The contract code wasn't updated correctly."
    exit 1
elif echo "$RESULT" | grep -q "\"returnCode\": \"error\""; then
    echo ""
    echo "========================================="
    echo "⚠️  Query returned an error"
    echo "========================================="
    echo ""
    echo "Check the error message above."
    exit 1
else
    echo ""
    echo "========================================="
    echo "✅ SUCCESS - No 500 error!"
    echo "========================================="
    echo ""
    echo "The fix is working! The contract returns data instead of panicking."
    echo ""
    if echo "$RESULT" | grep -q "returnData"; then
        echo "Order data returned successfully."
    else
        echo "No order found (expected if order doesn't exist yet)."
    fi
fi
