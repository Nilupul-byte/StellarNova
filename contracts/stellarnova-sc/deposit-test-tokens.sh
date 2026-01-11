#!/bin/bash

# Deposit Test Tokens to Vault
# This deposits a small amount of USDC to test limit orders

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/mainnet.config.sh"

CONTRACT="erd1qqqqqqqqqqqqqpgqv6xna5k6q6axnvce2n0g65n78vvuyx0088zq8scpu0"
WALLET_PEM="stellarnova-deployer.pem"

echo "========================================="
echo "Deposit Test Tokens to Vault"
echo "========================================="
echo ""

# Get wallet address
WALLET_ADDRESS=$(mxpy wallet convert --infile $WALLET_PEM --in-format pem --out-format address-bech32)
echo "Wallet: $WALLET_ADDRESS"
echo "Contract: $CONTRACT"
echo ""

# Deposit 10 USDC (10000000 with 6 decimals)
TOKEN="USDC-c76f1f"
AMOUNT="10000000"  # 10 USDC

echo "Depositing:"
echo "  Token: $TOKEN"
echo "  Amount: 10 USDC"
echo ""

read -p "Confirm deposit? (yes/no) " -r
echo

if [[ ! $REPLY == "yes" ]]; then
    echo "Cancelled"
    exit 0
fi

echo "Sending deposit transaction..."
echo ""

mxpy contract call $CONTRACT \
  --pem $WALLET_PEM \
  --proxy $PROXY \
  --chain $CHAIN_ID \
  --gas-limit 10000000 \
  --function deposit \
  --token-transfers $TOKEN:$AMOUNT \
  --send

echo ""
echo "✅ Deposit transaction sent!"
echo ""
echo "Wait a few seconds, then check your vault balance:"
echo "mxpy contract query $CONTRACT --proxy=$PROXY --function=getUserTokenBalance --arguments $WALLET_ADDRESS str:$TOKEN"
echo ""
