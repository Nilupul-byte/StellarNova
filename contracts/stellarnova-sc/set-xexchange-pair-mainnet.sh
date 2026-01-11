#!/bin/bash

# Set xExchange Pair Address on Mainnet
# Must be run AFTER upgrading the contract with swap logic

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/mainnet.config.sh"

CONTRACT_ADDRESS=$(cat deployed-contract-mainnet.txt)

# WEGLD/USDC pair address from xExchange
# Verified from: graph.xexchange.com
PAIR_ADDRESS="erd1qqqqqqqqqqqqqpgqeel2kumf0r8ffyhth7pqdujjat9nx0862jpsg2pqaq"

echo "========================================="
echo "Set xExchange Pair Address"
echo "========================================="
echo ""
echo "Contract: $CONTRACT_ADDRESS"
echo "Pair:     $PAIR_ADDRESS"
echo "          (WEGLD/USDC Liquidity Pool)"
echo ""

# Get deployer address
DEPLOYER_ADDRESS=$(mxpy wallet convert --infile $DEPLOYER_PEM --in-format pem --out-format address-bech32 | tail -1)
echo "Caller:   $DEPLOYER_ADDRESS (must be owner)"
echo ""

echo "This will configure the contract to use the WEGLD/USDC pair"
echo "for executing swaps when limit orders trigger."
echo ""

read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

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
echo "The contract will now use this pair for all swaps:"
echo "  Pair: $PAIR_ADDRESS"
echo ""
echo "Next steps:"
echo "  1. Restart the backend"
echo "  2. Test a limit order - it will execute a REAL swap!"
echo "  3. Watch backend logs: tail -f /tmp/backend-mainnet.log"
echo ""
echo "To verify the pair address was set:"
echo "  curl -s https://api.multiversx.com/query \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"scAddress\":\"$CONTRACT_ADDRESS\",\"funcName\":\"getXExchangePair\"}' | jq"
echo ""
