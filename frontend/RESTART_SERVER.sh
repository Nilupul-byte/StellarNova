#!/bin/bash
# Stop any running processes on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null

# Navigate to project directory
cd /Users/Nilupul/Nova/stellarnova/mx-template-dapp

# Start the dev server
npm run start-devnet
