#!/bin/bash

# StellarNova Upgrade Script
# Upgrades existing contract on mainnet

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/mainnet.config.sh"

echo "========================================="
echo "StellarNova Contract Upgrade"
echo "========================================="
echo ""

# Validate configuration
if ! validate_config; then
    exit 1
fi

# Check if contract address exists
if [ ! -f "deployed-contract.txt" ]; then
    echo "❌ deployed-contract.txt not found!"
    echo ""
    echo "Please create this file with your contract address, or provide it as argument:"
    echo "  ./upgrade.sh erd1..."
    echo ""
    exit 1
fi

# Get contract address (from file or argument)
if [ -n "$1" ]; then
    CONTRACT_ADDRESS="$1"
else
    CONTRACT_ADDRESS=$(cat deployed-contract.txt)
fi

echo "Contract Address: $CONTRACT_ADDRESS"
echo ""

# Check if WASM exists
if [ ! -f "output/stellarnova-sc.wasm" ]; then
    echo "❌ WASM file not found! Run ./build.sh first"
    exit 1
fi

echo "✅ WASM file found"

# Check if mxpy is installed
if ! command -v mxpy &> /dev/null; then
    echo "❌ mxpy not found!"
    exit 1
fi

# Verify you are the owner
echo "Verifying ownership..."
WALLET_ADDRESS=$(mxpy wallet convert --infile $DEPLOYER_PEM --in-format pem --out-format address-bech32)
echo "Your address: $WALLET_ADDRESS"

# Get contract owner from blockchain (skipping verification for now)
echo "⚠️  Skipping ownership verification (assuming deployer is owner)"
echo "✅ Ready to upgrade"

echo ""
echo "========================================="
echo "⚠️  IMPORTANT: Contract Upgrade"
echo "========================================="
echo ""
echo "This will upgrade the contract at:"
echo "  $CONTRACT_ADDRESS"
echo ""
echo "The upgrade will:"
echo "  ✓ Replace the contract code"
echo "  ✓ Keep all existing storage (user balances, etc.)"
echo "  ✓ Re-initialize with same parameters"
echo ""
read -p "Are you sure you want to upgrade? (yes/no) " -r
echo

if [[ ! $REPLY == "yes" ]]; then
    echo "Upgrade cancelled"
    exit 0
fi

# Prepare upgrade arguments
UPGRADE_ARGS="--bytecode output/stellarnova-sc.wasm \
  --pem $DEPLOYER_PEM \
  --proxy $PROXY \
  --chain $CHAIN_ID \
  --gas-limit $UPGRADE_GAS_LIMIT \
  --send"

# Constructor arguments (same as deployment)
CONSTRUCTOR_ARGS="--arguments $XEXCHANGE_ROUTER str:$TOKEN_USDC str:$TOKEN_WEGLD str:$TOKEN_EGLD $MAX_SLIPPAGE"

echo ""
echo "Upgrading contract..."
echo ""

# Upgrade contract
UPGRADE_OUTPUT=$(mxpy contract upgrade $CONTRACT_ADDRESS $UPGRADE_ARGS $CONSTRUCTOR_ARGS 2>&1)

echo "$UPGRADE_OUTPUT"

# Check if successful
if echo "$UPGRADE_OUTPUT" | grep -q "success"; then
    echo ""
    echo "========================================="
    echo "✅ Upgrade Successful!"
    echo "========================================="
    echo ""
    echo "Contract Address: $CONTRACT_ADDRESS"
    echo ""
    echo "Explorer:"
    echo "$EXPLORER/accounts/$CONTRACT_ADDRESS"
    echo ""
else
    echo ""
    echo "❌ Upgrade may have failed - check output above"
    exit 1
fi
