#!/bin/bash

# StellarNova Build Script
# Builds the smart contract using sc-meta (modern approach)

set -e

echo "========================================="
echo "Building StellarNova Smart Contract"
echo "========================================="

# Check if sc-meta is installed
if ! command -v sc-meta &> /dev/null; then
    echo "❌ sc-meta not found!"
    echo ""
    echo "Install MultiversX Rust toolchain:"
    echo "  cargo install multiversx-sc-meta"
    echo ""
    echo "OR use mxpy:"
    echo "  pip3 install multiversx-sdk-cli --upgrade"
    exit 1
fi

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf output/
cargo clean

# Build using sc-meta
echo "🔨 Building contract..."
sc-meta all build

# Check if build succeeded
if [ -f "output/stellarnova-sc.wasm" ]; then
    echo "✅ Build successful!"
    echo ""
    echo "📦 Artifacts:"
    ls -lh output/
    echo ""
    echo "✅ Ready for deployment!"
else
    echo "❌ Build failed - WASM file not found"
    exit 1
fi
