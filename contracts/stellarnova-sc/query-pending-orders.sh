#!/bin/bash

# Query Pending Limit Orders
# Shows all pending limit orders on the contract

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/mainnet.config.sh"

CONTRACT_ADDRESS=$(cat deployed-contract-mainnet.txt)

echo "========================================="
echo "Query Pending Limit Orders"
echo "========================================="
echo ""
echo "Contract: $CONTRACT_ADDRESS"
echo ""

# Query pending orders
echo "Fetching pending orders..."
echo ""

mxpy contract query $CONTRACT_ADDRESS \
  --proxy $PROXY \
  --function getPendingOrders

echo ""
echo "========================================="
echo "How to Read Output:"
echo "========================================="
echo ""
echo "If you see 'returnData' with hex values:"
echo "  - Order exists and is pending"
echo "  - Backend executor can detect it"
echo ""
echo "If you see empty result:"
echo "  - No pending orders"
echo "  - All orders executed or cancelled"
echo ""
echo "To decode order details, check:"
echo "https://explorer.multiversx.com/accounts/$CONTRACT_ADDRESS"
echo ""
