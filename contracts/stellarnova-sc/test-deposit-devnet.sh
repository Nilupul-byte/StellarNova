#!/bin/bash

# Test deposit USDC to StellarNova vault on Devnet

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/devnet.config.sh"

CONTRACT_ADDRESS=$(cat deployed-contract-devnet.txt)
AMOUNT=${1:-"1000000000000000000"}  # Default: 1 USDC (18 decimals)

echo "========================================="
echo "Deposit USDC to Vault - Devnet"
echo "========================================="
echo ""
echo "Contract:  $CONTRACT_ADDRESS"
echo "Token:     $TOKEN_USDC"
echo "Amount:    $AMOUNT ($(echo "scale=2; $AMOUNT / 1000000000000000000" | bc) USDC)"
echo ""

# Get deployer address
DEPLOYER_ADDRESS=$(mxpy wallet convert --infile $DEPLOYER_PEM --in-format pem --out-format address-bech32 | tail -1)
echo "From:      $DEPLOYER_ADDRESS"
echo ""

echo "Sending deposit transaction..."
echo ""

# Deposit transaction
# Format: ESDTTransfer@tokenId@amount@functionName@arguments
mxpy contract call $CONTRACT_ADDRESS \
  --pem $DEPLOYER_PEM \
  --proxy $PROXY \
  --chain $CHAIN_ID \
  --gas-limit 20000000 \
  --function "ESDTTransfer" \
  --arguments str:$TOKEN_USDC $AMOUNT str:deposit \
  --send

echo ""
echo "========================================="
echo "✅ Deposit Transaction Sent!"
echo "========================================="
echo ""
echo "Wait a few seconds, then check balance:"
echo "  ./query-balance-devnet.sh"
echo ""
