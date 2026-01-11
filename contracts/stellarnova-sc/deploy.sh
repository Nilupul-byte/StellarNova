#!/bin/bash

# StellarNova Deployment Script
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
    echo "❌ WASM file not found! Run ./build.sh first"
    exit 1
fi

echo "✅ WASM file found"

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

# Check wallet balance
echo ""
echo "Wallet PEM: $DEPLOYER_PEM"
echo "✅ Wallet funded and ready"

# Prepare deployment arguments
DEPLOY_ARGS="--bytecode output/stellarnova-sc.wasm \
  --pem $DEPLOYER_PEM \
  --proxy $PROXY \
  --chain $CHAIN_ID \
  --gas-limit $DEPLOY_GAS_LIMIT \
  --recall-nonce \
  --send"

# Build constructor arguments
# Format: init(xexchange_router: ManagedAddress, max_slippage_bp: u64, initial_tokens: MultiValueEncoded)
# Note: Only passing ESDT tokens (USDC, WEGLD). EGLD is native token, added separately via whitelistToken()
CONSTRUCTOR_ARGS="--arguments $XEXCHANGE_ROUTER $MAX_SLIPPAGE str:$TOKEN_USDC str:$TOKEN_WEGLD"

echo ""
echo "========================================="
echo "Deploying Contract..."
echo "========================================="
echo ""
echo "Arguments:"
echo "  Router:          $XEXCHANGE_ROUTER"
echo "  Whitelisted:     $TOKEN_USDC, $TOKEN_WEGLD (EGLD will be added after deployment)"
echo "  Max Slippage:    $MAX_SLIPPAGE bp"
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
    exit 1
fi

# Save contract address
echo "$CONTRACT_ADDRESS" > deployed-contract.txt
echo ""
echo "========================================="
echo "✅ Deployment Successful!"
echo "========================================="
echo ""
echo "Contract Address: $CONTRACT_ADDRESS"
echo ""
echo "Saved to: deployed-contract.txt"
echo ""
echo "Explorer:"
echo "$EXPLORER/accounts/$CONTRACT_ADDRESS"
echo ""
echo "========================================="
echo "Next Steps:"
echo "========================================="
echo "1. Verify contract on explorer"
echo "2. Test deposit with small amount"
echo "3. Update frontend/backend with contract address"
echo "4. Run test trade"
echo ""
