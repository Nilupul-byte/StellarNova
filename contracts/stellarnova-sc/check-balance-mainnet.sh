#!/bin/bash

# Check USDC Balance in Vault - Mainnet
# Shows your deposited USDC balance in the contract

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/mainnet.config.sh"

CONTRACT_ADDRESS=$(cat deployed-contract-mainnet.txt)

echo "========================================="
echo "Check Vault Balance - Mainnet"
echo "========================================="
echo ""

# Get user address
USER_ADDRESS=$(mxpy wallet convert --infile $DEPLOYER_PEM --in-format pem --out-format address-bech32 | tail -1)

echo "Contract: $CONTRACT_ADDRESS"
echo "User:     $USER_ADDRESS"
echo ""

# Check USDC balance
echo "Querying USDC balance..."
echo ""

BALANCE_OUTPUT=$(mxpy contract query $CONTRACT_ADDRESS \
  --proxy $PROXY \
  --function getUserTokenBalance \
  --arguments $USER_ADDRESS str:USDC-c76f1f 2>&1)

echo "$BALANCE_OUTPUT"
echo ""

# Try to decode the balance if returnData exists
if echo "$BALANCE_OUTPUT" | grep -q "returnData"; then
    # Extract hex value
    HEX_BALANCE=$(echo "$BALANCE_OUTPUT" | grep -oP '"returnData":\s*\["\K[^"]+' | head -1)

    if [ -n "$HEX_BALANCE" ]; then
        # Convert hex to decimal
        DECIMAL_BALANCE=$(echo "ibase=16; ${HEX_BALANCE^^}" | bc 2>/dev/null || echo "0")
        USDC_AMOUNT=$(echo "scale=6; $DECIMAL_BALANCE / 1000000" | bc 2>/dev/null || echo "0")

        echo "========================================="
        echo "✅ Vault Balance:"
        echo "========================================="
        echo ""
        echo "  USDC: $USDC_AMOUNT USDC ($DECIMAL_BALANCE micro-USDC)"
        echo ""

        if [ "$DECIMAL_BALANCE" -gt 0 ]; then
            echo "You can now create limit orders!"
            echo "  ./test-limit-order-mainnet.sh"
        else
            echo "No USDC in vault. Deposit first:"
            echo "  ./deposit-usdc-mainnet.sh"
        fi
    fi
else
    echo "========================================="
    echo "⚠️  No Balance Found"
    echo "========================================="
    echo ""
    echo "Vault is empty. Deposit USDC first:"
    echo "  ./deposit-usdc-mainnet.sh"
    echo ""
fi

# Also check WEGLD balance
echo ""
echo "Checking WEGLD balance..."
echo ""

WEGLD_OUTPUT=$(mxpy contract query $CONTRACT_ADDRESS \
  --proxy $PROXY \
  --function getUserTokenBalance \
  --arguments $USER_ADDRESS str:WEGLD-bd4d79 2>&1)

if echo "$WEGLD_OUTPUT" | grep -q "returnData"; then
    HEX_WEGLD=$(echo "$WEGLD_OUTPUT" | grep -oP '"returnData":\s*\["\K[^"]+' | head -1)

    if [ -n "$HEX_WEGLD" ]; then
        DECIMAL_WEGLD=$(echo "ibase=16; ${HEX_WEGLD^^}" | bc 2>/dev/null || echo "0")
        WEGLD_AMOUNT=$(echo "scale=18; $DECIMAL_WEGLD / 1000000000000000000" | bc 2>/dev/null || echo "0")

        echo "  WEGLD: $WEGLD_AMOUNT WEGLD"
    fi
fi

echo ""
