#!/bin/bash

# Upgrade StellarNova Contract on Mainnet - Real xExchange Swap Integration
# This upgrade replaces the simulated swap with actual xExchange pair contract calls

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/mainnet.config.sh"

CONTRACT_ADDRESS=$(cat deployed-contract-mainnet.txt)
WASM_PATH="output/stellarnova-sc.wasm"

echo "========================================="
echo "Upgrade StellarNova - Real Swap Logic"
echo "========================================="
echo ""
echo "Contract: $CONTRACT_ADDRESS"
echo "WASM:     $WASM_PATH"
echo ""

# Check WASM file exists
if [ ! -f "$WASM_PATH" ]; then
    echo "❌ WASM file not found!"
    echo "Build the contract first:"
    echo "  sc-meta all build"
    exit 1
fi

# Get WASM size and hash
WASM_SIZE=$(wc -c < "$WASM_PATH")
WASM_HASH=$(shasum -a 256 "$WASM_PATH" | awk '{print $1}')

echo "Contract size: $WASM_SIZE bytes"
echo "Contract hash: $WASM_HASH"
echo ""

# Get deployer address
DEPLOYER_ADDRESS=$(mxpy wallet convert --infile $DEPLOYER_PEM --in-format pem --out-format address-bech32 | tail -1)
echo "Deployer: $DEPLOYER_ADDRESS"
echo ""

# Check balance
echo "Checking wallet balance..."
BALANCE_OUTPUT=$(mxpy account get --address $DEPLOYER_ADDRESS --proxy $PROXY 2>&1 || echo '{"account":{"balance":"0"}}')
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
echo "⚠️  UPGRADE DETAILS"
echo "========================================="
echo ""
echo "This upgrade will:"
echo "  ✅ Replace simulated swap (90% mock) with REAL xExchange swaps"
echo "  ✅ Add xExchange pair address storage"
echo "  ✅ Add setXExchangePair endpoint (owner-only)"
echo "  ✅ Call xExchange WEGLD/USDC pair contract directly"
echo "  ✅ Preserve all user balances"
echo "  ✅ Preserve all limit orders"
echo "  ✅ Keep all storage intact"
echo ""
echo "What changes:"
echo "  ❌ OLD: execute_dex_swap returns 90% of input (simulated)"
echo "  ✅ NEW: execute_dex_swap calls xExchange pair contract"
echo ""
echo "After upgrade, you MUST run:"
echo "  ./set-xexchange-pair-mainnet.sh"
echo "  (Sets pair address: erd1qqqqqqqqqqqqqpgqeel2kumf0r8ffyhth7pqdujjat9nx0862jpsg2pqaq)"
echo ""
echo "Cost: ~0.055 EGLD (~\$0.35 at \$6.30/EGLD)"
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
    echo "⚠️  IMPORTANT - Next Steps:"
    echo ""
    echo "1. Wait ~6 seconds for transaction to complete"
    echo ""
    echo "2. Set xExchange pair address:"
    echo "   ./set-xexchange-pair-mainnet.sh"
    echo ""
    echo "3. Restart backend to reload contract code"
    echo ""
    echo "4. Test with a limit order - it will now execute REAL swaps!"
    echo ""
else
    echo "========================================="
    echo "❌ Upgrade Failed"
    echo "========================================="
    echo ""
    echo "Check error above for details."
    exit 1
fi
