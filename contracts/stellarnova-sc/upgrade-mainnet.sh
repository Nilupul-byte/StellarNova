#!/bin/bash

# Upgrade StellarNova Contract on Mainnet
# Uses the upgrade function to update contract code while preserving storage
# This upgrade fixes the "NOT Payable" issue

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/mainnet.config.sh"

CONTRACT_ADDRESS=$(cat deployed-contract-mainnet.txt)
WASM_PATH="output/stellarnova-sc.wasm"

echo "========================================="
echo "Upgrade StellarNova Contract - Mainnet"
echo "========================================="
echo ""
echo "Contract: $CONTRACT_ADDRESS"
echo "WASM:     $WASM_PATH"
echo ""

# Check WASM file exists
if [ ! -f "$WASM_PATH" ]; then
    echo "❌ WASM file not found!"
    echo "Build the contract first:"
    echo "  sc-meta all build --locked"
    exit 1
fi

# Get WASM size
WASM_SIZE=$(wc -c < "$WASM_PATH")
echo "Contract size: $WASM_SIZE bytes"
echo ""

# Get deployer address
DEPLOYER_ADDRESS=$(mxpy wallet convert --infile $DEPLOYER_PEM --in-format pem --out-format address-bech32 | tail -1)
echo "Deployer: $DEPLOYER_ADDRESS"
echo ""

# Check balance
echo "Checking wallet balance..."
BALANCE_OUTPUT=$(mxpy get account --address $DEPLOYER_ADDRESS --proxy $PROXY 2>&1 || echo '{"account":{"balance":"0"}}')
BALANCE=$(echo "$BALANCE_OUTPUT" | grep -o '"balance": "[0-9]*"' | head -1 | grep -o '[0-9]*' | head -1)

if [ -n "$BALANCE" ] && [ "$BALANCE" != "0" ]; then
    BALANCE_EGLD=$(echo "scale=4; $BALANCE / 1000000000000000000" | bc)
    echo "Balance: $BALANCE_EGLD EGLD"
    echo ""

    # Check if sufficient (need ~0.055 EGLD for upgrade)
    REQUIRED="55000000000000000"  # 0.055 EGLD
    if [ "$BALANCE" -lt "$REQUIRED" ]; then
        echo "⚠️  Low balance! Upgrade needs ~0.055 EGLD"
        echo "   You have: $BALANCE_EGLD EGLD"
        echo "   Need: 0.055 EGLD"
        echo ""
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
else
    echo "⚠️  Could not check balance"
    echo ""
fi

echo "========================================="
echo "⚠️  IMPORTANT - Read Before Upgrading"
echo "========================================="
echo ""
echo "This upgrade will:"
echo "  ✅ Make contract PAYABLE (accept ESDT tokens)"
echo "  ✅ Preserve all user balances"
echo "  ✅ Preserve all limit orders"
echo "  ✅ Keep all storage intact"
echo ""
echo "After upgrade:"
echo "  ✅ Users can deposit USDC/WEGLD"
echo "  ✅ All features work as before"
echo ""
echo "Cost: ~0.055 EGLD (~$2.20 at $40/EGLD)"
echo ""

read -p "Ready to upgrade? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Upgrade cancelled."
    exit 0
fi

echo ""
echo "Upgrading contract..."
echo ""

# Execute upgrade with payable metadata
# Metadata flags: upgradeable (01) + readable (02) + payable (04) + payable by SC (08) = 0F
UPGRADE_OUTPUT=$(mxpy contract upgrade $CONTRACT_ADDRESS \
  --bytecode $WASM_PATH \
  --pem $DEPLOYER_PEM \
  --proxy $PROXY \
  --chain $CHAIN_ID \
  --gas-limit 100000000 \
  --metadata-payable \
  --metadata-payable-by-sc \
  --send 2>&1)

echo "$UPGRADE_OUTPUT"
echo ""

# Extract transaction hash
TX_HASH=$(echo "$UPGRADE_OUTPUT" | grep -oP 'emittedTransactionHash.*?[a-f0-9]{64}' | grep -oP '[a-f0-9]{64}' | head -1)

if [ -n "$TX_HASH" ]; then
    echo "========================================="
    echo "✅ Contract Upgraded Successfully!"
    echo "========================================="
    echo ""
    echo "Transaction: https://explorer.multiversx.com/transactions/$TX_HASH"
    echo ""
    echo "Contract: https://explorer.multiversx.com/accounts/$CONTRACT_ADDRESS"
    echo ""
    echo "Wait ~6 seconds, then verify:"
    echo "  1. Contract shows 'Payable' ✓"
    echo "  2. Contract shows 'Payable by Smart Contract' ✓"
    echo ""
    echo "After verification, test deposit:"
    echo "  ./deposit-usdc-mainnet.sh"
    echo ""
else
    echo "========================================="
    echo "❌ Upgrade Failed"
    echo "========================================="
    echo ""
    echo "Check error above for details."
    exit 1
fi
