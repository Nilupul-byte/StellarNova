#!/bin/bash

# StellarNova Mainnet Deployment Script
# Deploys contract to MultiversX Mainnet

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/mainnet.config.sh"

echo "========================================="
echo "StellarNova Mainnet Deployment"
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
    echo "❌ WASM file not found! Run sc-meta all build first"
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
DEPLOYER_ADDRESS=$(mxpy wallet convert --infile $DEPLOYER_PEM --in-format pem --out-format address-bech32 | tail -1)
echo ""
echo "Deployer Address: $DEPLOYER_ADDRESS"
echo "Wallet PEM: $DEPLOYER_PEM"

# Check wallet balance
echo ""
echo "Checking wallet balance on mainnet..."
BALANCE_OUTPUT=$(mxpy account get --address=$DEPLOYER_ADDRESS --proxy=$PROXY 2>&1 || echo "")

if echo "$BALANCE_OUTPUT" | grep -q "balance"; then
    BALANCE=$(echo "$BALANCE_OUTPUT" | grep -o '"balance": "[0-9]*"' | head -1 | grep -o '[0-9]*' | head -1)
    BALANCE_EGLD=$(echo "scale=4; $BALANCE / 1000000000000000000" | bc)
    echo "Balance: $BALANCE_EGLD EGLD"

    # Check if balance is sufficient (need at least 0.05 EGLD)
    REQUIRED="50000000000000000"  # 0.05 EGLD
    if [ "$BALANCE" -lt "$REQUIRED" ]; then
        echo ""
        echo "❌ Insufficient balance! You need at least 0.05 EGLD for deployment"
        echo "   Current: $BALANCE_EGLD EGLD"
        echo "   Required: 0.05 EGLD"
        echo ""
        exit 1
    else
        echo "✅ Wallet funded and ready"
    fi
else
    echo "⚠️  Could not check balance"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "========================================="
echo "⚠️  MAINNET DEPLOYMENT WARNING"
echo "========================================="
echo ""
echo "You are about to deploy to MAINNET!"
echo ""
echo "This will:"
echo "  - Deploy a NEW contract (not upgrade existing)"
echo "  - Cost ~0.05 EGLD (~\$2 at \$40/EGLD)"
echo "  - Create a new contract address"
echo "  - Require updating frontend/backend config"
echo ""
echo "Current contract: $(cat deployed-contract-mainnet.txt 2>/dev/null || echo 'None')"
echo ""
read -p "Are you SURE you want to deploy to mainnet? (yes/N): " -r
echo
if [[ ! $REPLY =~ ^yes$ ]]; then
    echo "Deployment cancelled."
    exit 0
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
echo "Deploying Contract to Mainnet (Shard 1 Target)"
echo "========================================="
echo ""
echo "⚠️  CRITICAL: This contract MUST be deployed to Shard 1"
echo "   (same shard as xExchange WEGLD/USDC pair)"
echo "   for synchronous swaps to work!"
echo ""
echo "Arguments:"
echo "  Whitelisted:     $TOKEN_USDC, $TOKEN_WEGLD"
echo "  Max Slippage:    $MAX_SLIPPAGE bp (5%)"
echo "  Metadata:        Payable + Payable by SC"
echo ""

# Deploy contract
echo "Sending deployment transaction..."
DEPLOY_OUTPUT=$(mxpy contract deploy $DEPLOY_ARGS $CONSTRUCTOR_ARGS 2>&1)

echo "$DEPLOY_OUTPUT"

# Extract contract address
CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -o 'erd1[a-z0-9]\{58\}' | head -1)

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
echo "$CONTRACT_ADDRESS" > deployed-contract-mainnet.txt
echo ""
echo "========================================="
echo "✅ Mainnet Deployment Successful!"
echo "========================================="
echo ""
echo "Contract Address: $CONTRACT_ADDRESS"
echo "Deployer Address: $DEPLOYER_ADDRESS"
echo ""
echo "Saved to: deployed-contract-mainnet.txt"
echo ""
echo "Explorer:"
echo "$EXPLORER/accounts/$CONTRACT_ADDRESS"
echo ""
echo "========================================="
echo "⚠️  IMPORTANT: Verify Shard Deployment"
echo "========================================="
echo ""
echo "Check contract shard on explorer (link above)"
echo "This contract MUST be in Shard 1 for sync swaps to work!"
echo ""
echo "If not in Shard 1, you'll need to re-deploy"
echo ""
echo "========================================="
echo "Next Steps (if in Shard 1):"
echo "========================================="
echo ""
echo "1. Set xExchange pair address:"
echo "   ./set-xexchange-pair-mainnet.sh"
echo ""
echo "2. Set executor address:"
echo "   ./set-executor-mainnet.sh"
echo ""
echo "3. Update frontend config:"
echo "   Edit: frontend/src/lib/stellarnova/limitOrders.ts"
echo "   Change: STELLARNOVA_CONTRACT = '$CONTRACT_ADDRESS'"
echo ""
echo "4. Update backend config:"
echo "   Edit: backend/src/config.ts"
echo "   Change: CONTRACT_ADDRESS = '$CONTRACT_ADDRESS'"
echo ""
