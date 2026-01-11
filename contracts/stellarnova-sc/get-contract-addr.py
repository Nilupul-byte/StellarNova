#!/usr/bin/env python3
import requests
import base64

# Transaction hash from deployment
tx_hash = "107d5da78ed7984927862fe3723eb41a972814f795dd0d9202b7766d410896c4"

# Get transaction details
url = f"https://api.multiversx.com/transactions/{tx_hash}"
response = requests.get(url)
tx_data = response.json()

print(f"Transaction status: {tx_data.get('status', 'unknown')}")
print(f"Function: {tx_data.get('function', 'N/A')}")

# Get smart contract results
results_url = f"https://api.multiversx.com/sc-results?originalTxHash={tx_hash}"
results_response = requests.get(results_url)
sc_results = results_response.json()

print(f"\nSmart Contract Results: {len(sc_results)} results")

for result in sc_results:
    if result.get('callType') == 'init':
        contract_addr = result.get('receiver', '')
        print(f"\n✅ CONTRACT DEPLOYED AT: {contract_addr}")
        print(f"   Length: {len(contract_addr)}")
        break
