#!/bin/bash

# StellarNova Mainnet Configuration
# Fill in these values before deploying

# ========== WALLET CREDENTIALS ==========
# Path to your wallet PEM file (must have ~0.05 EGLD for gas)
# Example: export DEPLOYER_PEM="$HOME/wallet.pem"
export DEPLOYER_PEM="/Users/Nilupul/Nova/stellarnova/contracts/stellarnova-sc/stellarnova-deployer.pem"

# ========== NETWORK CONFIGURATION ==========
export CHAIN_ID="1"  # Mainnet chain ID
export PROXY="https://gateway.multiversx.com"
export EXPLORER="https://explorer.multiversx.com"

# ========== xExchange CONFIGURATION ==========
# xExchange Router V2 address on mainnet
# Official router: erd1qqqqqqqqqqqqqpgqq66xk9gfr4esuhem3jru86wg5hvp33a62jps2fy57p
export XEXCHANGE_ROUTER="erd1qqqqqqqqqqqqqpgqq66xk9gfr4esuhem3jru86wg5hvp33a62jps2fy57p"

# ========== TOKEN IDENTIFIERS ==========
# Mainnet token identifiers (verify these are current!)
export TOKEN_USDC="USDC-c76f1f"
export TOKEN_WEGLD="WEGLD-bd4d79"
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
        echo "Please edit mainnet.config.sh and fill in all required values"
        return 1
    fi

    echo "✅ Configuration validated"
    return 0
}

# Display configuration (without showing PEM path for security)
show_config() {
    echo "========================================="
    echo "Mainnet Configuration"
    echo "========================================="
    echo "Network:         Mainnet ($CHAIN_ID)"
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
    echo "Max Slippage:    $MAX_SLIPPAGE bp ($(echo "scale=2; $MAX_SLIPPAGE/100" | bc)%)"
    echo "Deploy Gas:      $DEPLOY_GAS_LIMIT"
    echo ""
    echo "PEM File:        $([ -n "$DEPLOYER_PEM" ] && echo "✓ Set" || echo "✗ Not set")"
    echo "========================================="
}
