#!/bin/bash

# Set Limit Order Executor Address on Devnet
# This sets the authorized address that can execute limit orders

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load devnet configuration
source "$SCRIPT_DIR/devnet.config.sh"

echo "========================================="
echo "Set Limit Order Executor - Devnet"
echo "========================================="
echo ""

# Get contract address
if [ ! -f "deployed-contract-devnet.txt" ]; then
    echo "❌ Contract address file not found!"
    echo "Deploy the contract first using: ./deploy-devnet.sh"
    exit 1
fi

CONTRACT_ADDRESS=$(cat deployed-contract-devnet.txt)
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
echo "Next: Test the deployment"
echo "  ./deposit-test-tokens.sh devnet"
echo ""
