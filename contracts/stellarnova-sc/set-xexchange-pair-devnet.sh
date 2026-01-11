#!/bin/bash

# Set xExchange Pair Address on Devnet
# For testing purposes only

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/devnet.config.sh"

CONTRACT_ADDRESS=$(cat deployed-contract-devnet.txt)

# NOTE: Devnet may not have a real xExchange pair for WEGLD/USDC
# Using mainnet pair address for testing contract functionality
# Swap execution will likely fail, but we can test order creation/cancellation
PAIR_ADDRESS="erd1qqqqqqqqqqqqqpgqeel2kumf0r8ffyhth7pqdujjat9nx0862jpsg2pqaq"

echo "========================================="
echo "Set xExchange Pair Address (Devnet)"
echo "========================================="
echo ""
echo "Contract: $CONTRACT_ADDRESS"
echo "Pair:     $PAIR_ADDRESS"
echo "          (Using mainnet pair for testing)"
echo ""
echo "⚠️  NOTE: This is a mainnet pair address."
echo "    Swap execution will fail on devnet,"
echo "    but we can test order creation/cancellation."
echo ""

# Get deployer address
DEPLOYER_ADDRESS=$(mxpy wallet convert --infile $DEPLOYER_PEM --in-format pem --out-format address-bech32 | tail -1)
echo "Caller:   $DEPLOYER_ADDRESS (must be owner)"
echo ""

echo "Calling setXExchangePair..."
echo ""

# Call setXExchangePair with the pair address
mxpy contract call $CONTRACT_ADDRESS \
  --pem $DEPLOYER_PEM \
  --proxy $PROXY \
  --chain $CHAIN_ID \
  --gas-limit 10000000 \
  --function "setXExchangePair" \
  --arguments $PAIR_ADDRESS \
  --send

echo ""
echo "========================================="
echo "✅ Pair Address Set Successfully!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Set executor address: ./set-executor-devnet.sh"
echo "  2. Test createLimitOrder (will work)"
echo "  3. Test cancelLimitOrder (will work)"
echo "  4. executeLimitOrder will fail (no real pair on devnet)"
echo ""
