#!/bin/bash

# Set Limit Order Executor Address on Mainnet
# This sets the authorized address that can execute limit orders

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load mainnet configuration
source "$SCRIPT_DIR/mainnet.config.sh"

echo "========================================="
echo "Set Limit Order Executor - Mainnet"
echo "========================================="
echo ""

# Get contract address
if [ ! -f "deployed-contract-mainnet.txt" ]; then
    echo "❌ Contract address file not found!"
    echo "Deploy the contract first using: ./deploy.sh"
    exit 1
fi

CONTRACT_ADDRESS=$(cat deployed-contract-mainnet.txt)
EXECUTOR_ADDRESS="erd1x4kstuc47ajwfqu8klq72ul06jru8g4f0m0pzgumylzczvl388zqp64h9a"

echo "Contract:        $CONTRACT_ADDRESS"
echo "Executor:        $EXECUTOR_ADDRESS"
echo ""

# Call setLimitOrderExecutor
echo "Setting executor address..."
echo ""

mxpy contract call $CONTRACT_ADDRESS \
  --pem $DEPLOYER_PEM \
  --proxy $PROXY \
  --chain $CHAIN_ID \
  --gas-limit 10000000 \
  --function "setLimitOrderExecutor" \
  --arguments $EXECUTOR_ADDRESS \
  --send

echo ""
echo "========================================="
echo "✅ Executor address set successfully!"
echo "========================================="
echo ""
echo "Executor: $EXECUTOR_ADDRESS"
echo ""
echo "Next: Verify contract on explorer"
echo "  https://explorer.multiversx.com/accounts/$CONTRACT_ADDRESS"
echo ""
