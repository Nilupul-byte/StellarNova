#!/bin/bash

# StellarNova Query Helper
# Quick queries for deployed contract

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/mainnet.config.sh"

# Get contract address
if [ -f "deployed-contract.txt" ]; then
    CONTRACT=$(cat deployed-contract.txt)
else
    echo "❌ deployed-contract.txt not found!"
    echo "Run ./deploy.sh first or create the file with your contract address"
    exit 1
fi

echo "Contract: $CONTRACT"
echo "Network: $PROXY"
echo ""

# Helper function to query
query() {
    local function=$1
    shift
    mxpy contract query $CONTRACT \
        --proxy $PROXY \
        --function $function \
        "$@" 2>/dev/null || echo "Query failed"
}

# Show menu
show_menu() {
    echo "========================================="
    echo "StellarNova Contract Queries"
    echo "========================================="
    echo "1. Get Owner"
    echo "2. Get Whitelisted Tokens"
    echo "3. Get Max Slippage"
    echo "4. Get xExchange Router"
    echo "5. Check if Paused"
    echo "6. Check Token Whitelisted"
    echo "7. Get User Balance"
    echo "8. All Info (Quick Summary)"
    echo "0. Exit"
    echo "========================================="
    echo -n "Select option: "
}

# Parse user address from PEM if available
get_user_address() {
    if [ -f "$DEPLOYER_PEM" ]; then
        mxpy wallet pem-address $DEPLOYER_PEM 2>/dev/null
    else
        echo ""
    fi
}

# Main loop
while true; do
    show_menu
    read -r choice
    echo ""

    case $choice in
        1)
            echo "Owner Address:"
            query getOwner
            echo ""
            ;;
        2)
            echo "Whitelisted Tokens:"
            query getWhitelistedTokens
            echo ""
            ;;
        3)
            echo "Max Slippage (basis points):"
            query getMaxSlippage
            echo ""
            ;;
        4)
            echo "xExchange Router:"
            query getXExchangeRouter
            echo ""
            ;;
        5)
            echo "Contract Paused:"
            query isPaused
            echo ""
            ;;
        6)
            echo -n "Enter token identifier (e.g., USDC-c76f1f): "
            read -r token
            echo "Is $token whitelisted:"
            query isTokenWhitelisted --arguments str:$token
            echo ""
            ;;
        7)
            echo -n "Enter user address (or press enter for your address): "
            read -r user_addr
            if [ -z "$user_addr" ]; then
                user_addr=$(get_user_address)
                if [ -z "$user_addr" ]; then
                    echo "❌ Could not determine user address"
                    continue
                fi
                echo "Using: $user_addr"
            fi
            echo -n "Enter token identifier (e.g., USDC-c76f1f): "
            read -r token
            echo "Balance of $token for user:"
            query getUserTokenBalance --arguments $user_addr str:$token
            echo ""
            ;;
        8)
            echo "========================================="
            echo "Contract Summary"
            echo "========================================="
            echo ""
            echo "Contract Address:"
            echo "  $CONTRACT"
            echo ""
            echo "Owner:"
            query getOwner | sed 's/^/  /'
            echo ""
            echo "xExchange Router:"
            query getXExchangeRouter | sed 's/^/  /'
            echo ""
            echo "Max Slippage:"
            query getMaxSlippage | sed 's/^/  /'
            echo ""
            echo "Paused:"
            query isPaused | sed 's/^/  /'
            echo ""
            echo "Whitelisted Tokens:"
            query getWhitelistedTokens | sed 's/^/  /'
            echo ""
            echo "Explorer:"
            echo "  $EXPLORER/accounts/$CONTRACT"
            echo ""
            ;;
        0)
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo "Invalid option"
            echo ""
            ;;
    esac
done
