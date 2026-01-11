#!/bin/bash

# StellarNova Devnet Deployment Script
# Deploys contract to MultiversX Devnet for testing

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/devnet.config.sh"

echo "========================================="
echo "StellarNova Devnet Deployment"
echo "========================================="
echo ""

# Show configuration
show_config

echo ""
echo "========================================="
echo "Pre-Deployment Validation"
echo "========================================="

# Validate configuration
if ! validate_config; then
    exit 1
fi

# Check if WASM exists
if [ ! -f "output/stellarnova-sc.wasm" ]; then
    echo "❌ WASM file not found! Run ./build.sh first"
    exit 1
fi

echo "✅ WASM file found ($(ls -lh output/stellarnova-sc.wasm | awk '{print $5}'))"

# Check if mxpy is installed
if ! command -v mxpy &> /dev/null; then
    echo "❌ mxpy not found!"
    echo ""
    echo "Install mxpy:"
    echo "  pip3 install multiversx-sdk-cli --upgrade"
    echo ""
    exit 1
fi

echo "✅ mxpy found: $(mxpy --version)"

# Get deployer address
DEPLOYER_ADDRESS=$(mxpy wallet convert --infile $DEPLOYER_PEM --in-format pem --out-format address-bech32)
echo ""
echo "Deployer Address: $DEPLOYER_ADDRESS"
echo "Wallet PEM: $DEPLOYER_PEM"

# Check wallet balance
echo ""
echo "Checking wallet balance on devnet..."
BALANCE_OUTPUT=$(mxpy account get --address=$DEPLOYER_ADDRESS --proxy=$PROXY 2>&1 || echo "")

if echo "$BALANCE_OUTPUT" | grep -q "balance"; then
    BALANCE=$(echo "$BALANCE_OUTPUT" | grep -oP '"balance":\s*"\K[0-9]+' || echo "0")
    BALANCE_EGLD=$(echo "scale=4; $BALANCE / 1000000000000000000" | bc)
    echo "Balance: $BALANCE_EGLD EGLD"

    # Check if balance is sufficient (need at least 0.05 EGLD)
    if (( $(echo "$BALANCE_EGLD < 0.05" | bc -l) )); then
        echo ""
        echo "⚠️  Low balance! You need at least 0.05 EGLD for deployment"
        echo ""
        echo "Get devnet EGLD from faucet:"
        echo "  https://devnet-wallet.multiversx.com/faucet"
        echo "  Your address: $DEPLOYER_ADDRESS"
        echo ""
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo "✅ Wallet funded and ready"
    fi
else
    echo "⚠️  Could not check balance (account may not exist on devnet yet)"
    echo ""
    echo "Get devnet EGLD from faucet:"
    echo "  https://devnet-wallet.multiversx.com/faucet"
    echo "  Your address: $DEPLOYER_ADDRESS"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Prepare deployment arguments
DEPLOY_ARGS="--bytecode output/stellarnova-sc.wasm \
  --pem $DEPLOYER_PEM \
  --proxy $PROXY \
  --chain $CHAIN_ID \
  --gas-limit $DEPLOY_GAS_LIMIT \
  --metadata-upgradeable \
  --metadata-readable \
  --metadata-payable \
  --metadata-payable-by-sc \
  --send"

# Build constructor arguments
# Format: init(max_slippage_bp: u64, initial_tokens: MultiValueEncoded)
CONSTRUCTOR_ARGS="--arguments $MAX_SLIPPAGE str:$TOKEN_USDC str:$TOKEN_WEGLD"

echo ""
echo "========================================="
echo "Deploying Contract to Devnet (Shard 1 Target)"
echo "========================================="
echo ""
echo "⚠️  CRITICAL: This contract should be deployed to Shard 1"
echo "   (same shard as xExchange WEGLD/USDC pair)"
echo "   for synchronous swaps to work!"
echo ""
echo "Arguments:"
echo "  Whitelisted:     $TOKEN_USDC, $TOKEN_WEGLD"
echo "  Max Slippage:    $MAX_SLIPPAGE bp (5%)"
echo ""

# Deploy contract
echo "Sending deployment transaction..."
DEPLOY_OUTPUT=$(mxpy contract deploy $DEPLOY_ARGS $CONSTRUCTOR_ARGS 2>&1)

echo "$DEPLOY_OUTPUT"

# Extract contract address
CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP 'erd1[a-z0-9]{58}' | head -1)

if [ -z "$CONTRACT_ADDRESS" ]; then
    echo ""
    echo "❌ Deployment failed! Could not extract contract address"
    echo ""
    echo "Common issues:"
    echo "1. Insufficient balance (need ~0.05 EGLD)"
    echo "2. Network connectivity"
    echo "3. Invalid PEM file"
    exit 1
fi

# Save contract address
echo "$CONTRACT_ADDRESS" > deployed-contract-devnet.txt
echo ""
echo "========================================="
echo "✅ Devnet Deployment Successful!"
echo "========================================="
echo ""
echo "Contract Address: $CONTRACT_ADDRESS"
echo "Deployer Address: $DEPLOYER_ADDRESS"
echo ""
echo "Saved to: deployed-contract-devnet.txt"
echo ""
echo "Explorer:"
echo "$EXPLORER/accounts/$CONTRACT_ADDRESS"
echo ""
echo "========================================="
echo "⚠️  IMPORTANT: Verify Shard Deployment"
echo "========================================="
echo ""
echo "Check contract shard on explorer (link above)"
echo "This contract should be in Shard 1 for sync swaps to work!"
echo ""
echo "========================================="
echo "Next Steps:"
echo "========================================="
echo ""
echo "1. Set xExchange pair address:"
echo "   Edit set-xexchange-pair-devnet.sh if needed, then run it"
echo ""
echo "2. Set executor address:"
echo "   ./set-executor-devnet.sh"
echo ""
echo "3. Test createLimitOrder (NEW flow - direct ESDT payment):"
echo "   Edit test-create-limit-order-devnet.sh and run it"
echo ""
echo "4. Test cancelLimitOrder (NEW endpoint):"
echo "   Create a test script to cancel an order"
echo ""
echo "5. Test executeLimitOrder:"
echo "   Use backend executor or test script"
echo ""
echo "6. If all tests pass, deploy to mainnet"
echo ""
