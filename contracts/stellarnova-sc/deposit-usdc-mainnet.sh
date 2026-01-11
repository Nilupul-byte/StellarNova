#!/bin/bash

# Deposit USDC to StellarNova Contract - Mainnet
# This deposits USDC tokens into your vault for trading/limit orders

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/mainnet.config.sh"

CONTRACT_ADDRESS=$(cat deployed-contract-mainnet.txt)

echo "========================================="
echo "Deposit USDC to Vault - Mainnet"
echo "========================================="
echo ""
echo "Contract: $CONTRACT_ADDRESS"
echo ""

# Get user address
USER_ADDRESS=$(mxpy wallet convert --infile $DEPLOYER_PEM --in-format pem --out-format address-bech32 | tail -1)
echo "User: $USER_ADDRESS"
echo ""

# Deposit amount (default: 5 USDC)
USDC_AMOUNT="${1:-5000000}"  # 5 USDC = 5,000,000 (6 decimals)
USDC_TOKEN="USDC-c76f1f"

echo "Deposit Details:"
echo "  Token: USDC-c76f1f"
echo "  Amount: $USDC_AMOUNT ($(echo "scale=6; $USDC_AMOUNT / 1000000" | bc) USDC)"
echo ""

read -p "Ready to deposit? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Sending USDC to contract..."
echo ""

# Execute deposit transaction
DEPOSIT_OUTPUT=$(mxpy contract call $CONTRACT_ADDRESS \
  --pem $DEPLOYER_PEM \
  --proxy $PROXY \
  --chain $CHAIN_ID \
  --gas-limit 10000000 \
  --function "ESDTTransfer" \
  --arguments str:$USDC_TOKEN $USDC_AMOUNT str:deposit \
  --send 2>&1)

echo "$DEPOSIT_OUTPUT"
echo ""

# Extract transaction hash
TX_HASH=$(echo "$DEPOSIT_OUTPUT" | grep -oP 'emittedTransactionHash.*?[a-f0-9]{64}' | grep -oP '[a-f0-9]{64}' | head -1)

if [ -n "$TX_HASH" ]; then
    echo "========================================="
    echo "✅ Deposit Transaction Sent!"
    echo "========================================="
    echo ""
    echo "Transaction: https://explorer.multiversx.com/transactions/$TX_HASH"
    echo ""
    echo "Wait ~6 seconds for confirmation, then check balance:"
    echo "  ./check-balance-mainnet.sh"
    echo ""
else
    echo "========================================="
    echo "❌ Deposit Failed"
    echo "========================================="
    echo ""
    echo "Possible reasons:"
    echo "1. Insufficient USDC in wallet"
    echo "2. Gas limit too low"
    echo "3. Invalid token identifier"
    echo ""
    echo "Check your USDC balance:"
    echo "  mxpy account get --address $USER_ADDRESS --proxy $PROXY"
    exit 1
fi
