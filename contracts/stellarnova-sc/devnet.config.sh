#!/bin/bash

# StellarNova Devnet Configuration
# For testing before mainnet deployment

# ========== WALLET CREDENTIALS ==========
# Path to your wallet PEM file (devnet wallet)
export DEPLOYER_PEM="/Users/Nilupul/Nova/stellarnova/contracts/stellarnova-sc/stellarnova-deployer.pem"

# ========== NETWORK CONFIGURATION ==========
export CHAIN_ID="D"  # Devnet chain ID
export PROXY="https://devnet-gateway.multiversx.com"
export EXPLORER="https://devnet-explorer.multiversx.com"

# ========== xExchange CONFIGURATION ==========
# xExchange Router V2 address on devnet
# Note: Using mainnet router as fallback - update if you have devnet router
# For testing, we'll simulate swaps without actual router interaction
export XEXCHANGE_ROUTER="erd1qqqqqqqqqqqqqpgqq66xk9gfr4esuhem3jru86wg5hvp33a62jps2fy57p"

# ========== TOKEN IDENTIFIERS ==========
# Devnet token identifiers
export TOKEN_USDC="USDC-3770a9"  # Devnet USDC token
export TOKEN_WEGLD="WEGLD-d7c6bb"  # Devnet WEGLD token
export TOKEN_EGLD="EGLD"

# ========== CONTRACT PARAMETERS ==========
# Maximum slippage tolerance in basis points (500 = 5%)
export MAX_SLIPPAGE="500"

# Gas limits
export DEPLOY_GAS_LIMIT="100000000"
export UPGRADE_GAS_LIMIT="100000000"

# ========== VALIDATION ==========
validate_config() {
    local errors=0

    if [ -z "$DEPLOYER_PEM" ]; then
        echo "❌ DEPLOYER_PEM not set"
        errors=$((errors + 1))
    elif [ ! -f "$DEPLOYER_PEM" ]; then
        echo "❌ DEPLOYER_PEM file not found: $DEPLOYER_PEM"
        errors=$((errors + 1))
    fi

    if [ -z "$XEXCHANGE_ROUTER" ]; then
        echo "❌ XEXCHANGE_ROUTER not set"
        errors=$((errors + 1))
    fi

    if [ $errors -gt 0 ]; then
        echo ""
        echo "❌ Configuration validation failed!"
        echo "Please edit devnet.config.sh and fill in all required values"
        return 1
    fi

    echo "✅ Configuration validated"
    return 0
}

# Display configuration
show_config() {
    echo "========================================="
    echo "Devnet Configuration"
    echo "========================================="
    echo "Network:         Devnet ($CHAIN_ID)"
    echo "Proxy:           $PROXY"
    echo "Explorer:        $EXPLORER"
    echo ""
    echo "xExchange:       $XEXCHANGE_ROUTER"
    echo ""
    echo "Tokens:"
    echo "  USDC:          $TOKEN_USDC"
    echo "  WEGLD:         $TOKEN_WEGLD"
    echo "  EGLD:          $TOKEN_EGLD"
    echo ""
    echo "Max Slippage:    $MAX_SLIPPAGE bp (5%)"
    echo "Deploy Gas:      $DEPLOY_GAS_LIMIT"
    echo ""
    echo "PEM File:        $([ -n "$DEPLOYER_PEM" ] && echo "✓ Set" || echo "✗ Not set")"
    echo "========================================="
}
