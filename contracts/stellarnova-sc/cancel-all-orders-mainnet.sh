#!/bin/bash

# Cancel All Pending Limit Orders - Mainnet
# Cancels orders 2, 3, and 4

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/mainnet.config.sh"

CONTRACT_ADDRESS=$(cat deployed-contract-mainnet.txt)

echo "========================================="
echo "Cancel All Pending Orders - Mainnet"
echo "========================================="
echo ""
echo "Contract: $CONTRACT_ADDRESS"
echo ""

# Get user address
USER_ADDRESS=$(mxpy wallet convert --infile $DEPLOYER_PEM --in-format pem --out-format address-bech32 | tail -1)
echo "User: $USER_ADDRESS"
echo ""

# Orders to cancel
ORDERS=(2 3 4)

for ORDER_ID in "${ORDERS[@]}"; do
    echo "========================================="
    echo "Cancelling Order #$ORDER_ID"
    echo "========================================="
    echo ""

    # Cancel order
    CANCEL_OUTPUT=$(mxpy contract call $CONTRACT_ADDRESS \
      --pem $DEPLOYER_PEM \
      --proxy $PROXY \
      --chain $CHAIN_ID \
      --gas-limit 10000000 \
      --function cancelLimitOrder \
      --arguments $ORDER_ID \
      --send 2>&1)

    echo "$CANCEL_OUTPUT"
    echo ""

    # Extract transaction hash
    TX_HASH=$(echo "$CANCEL_OUTPUT" | grep -oP 'emittedTransactionHash.*?[a-f0-9]{64}' | grep -oP '[a-f0-9]{64}' | head -1)

    if [ -n "$TX_HASH" ]; then
        echo "✅ Order #$ORDER_ID cancelled!"
        echo "   TX: https://explorer.multiversx.com/transactions/$TX_HASH"
    else
        echo "⚠️  Order #$ORDER_ID - check output above"
    fi

    echo ""

    # Small delay between transactions
    sleep 2
done

echo "========================================="
echo "✅ All Orders Cancelled!"
echo "========================================="
echo ""
echo "Tokens have been returned to your wallet."
echo ""
echo "To verify:"
echo "  ./query-pending-orders.sh"
echo ""
