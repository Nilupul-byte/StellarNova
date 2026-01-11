# Security Notice

## 🚨 API Keys Exposed in Initial Commit

**Status:** FIXED (keys removed from code, awaiting revocation)

### Issue Details

Two DeepSeek API keys were found in the codebase:

#### 1. Hardcoded API Key (CRITICAL - Was Pushed to GitHub)
- **File:** `ai/test-deepseek.ts` (line 21)
- **Key:** `sk-fa179d4a1d8842acbc7dfeff1c3db803`
- **Status:** 🔴 **EXPOSED IN PUBLIC REPOSITORY**
- **Commit:** e1503ed (Initial commit)
- **Action Required:** **REVOKE IMMEDIATELY**

#### 2. Environment Variable API Key (Protected)
- **File:** `frontend/.env` (gitignored)
- **Key:** `sk-f7d105b6fde24363b12fbb040272f73e`
- **Status:** 🟡 Not pushed to GitHub (properly gitignored)
- **Action Required:** **REVOKE AS PRECAUTION**

### Immediate Actions Required

1. **Revoke Both API Keys:**
   - Go to: https://platform.deepseek.com/api_keys
   - Delete both keys immediately
   - Generate new key for development

2. **Update Local Environment:**
   ```bash
   # Update frontend/.env with new key
   VITE_DEEPSEEK_API_KEY=your_new_key_here
   ```

3. **Never commit new key:**
   - `.gitignore` is properly configured
   - Always use environment variables
   - Never hardcode secrets in test files

### What Was Fixed

✅ Removed hardcoded API key from `ai/test-deepseek.ts`
✅ Added environment variable check with error message
✅ Updated code to require `DEEPSEEK_API_KEY` env var

### Git History Note

The exposed key `sk-fa179d4a1d8842acbc7dfeff1c3db803` exists in git history (commit e1503ed). Even though the code is now fixed, the key is still visible in the repository history.

**Options:**
1. **Recommended:** Revoke the old key and move forward with fixed code
2. **Advanced:** Rewrite git history to remove key (complicated, requires force push)

### Protected Files

The following sensitive files are properly gitignored and were NOT pushed:

✅ `backend/executor-wallet.pem` - Executor wallet private key
✅ `contracts/stellarnova-sc/stellarnova-deployer.pem` - Deployer private key
✅ `contracts/stellarnova-sc/WALLET_INFO.txt` - Wallet mnemonic
✅ `frontend/.env` - Environment variables with API key
✅ `.claude/` - Claude Code CLI data

### Security Best Practices Going Forward

1. **Never hardcode secrets** - Always use environment variables
2. **Review before commit** - Check for sensitive data before `git add`
3. **Use .env.example** - Provide templates without real values
4. **Rotate keys regularly** - Change API keys every 3-6 months
5. **Monitor API usage** - Watch for unexpected usage patterns

### Contact

If you discover any security issues, please:
- Do NOT open a public issue
- Contact: nilupulweerasinghe27@gmail.com
- Or DM on Twitter/X: @YourHandle

---

**Last Updated:** January 11, 2026
**Fixed in Commit:** [Next commit after e1503ed]
