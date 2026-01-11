#![no_std]

multiversx_sc::imports!();

pub mod storage;
pub mod events;
pub mod errors;
pub mod dex;
pub mod limit_orders;

/// StellarNova Smart Contract
/// AI-powered limit order system on MultiversX
///
/// JEXchange-style Architecture:
/// - Direct ESDT payment for order creation
/// - Asynchronous swaps on xExchange (works cross-shard!)
/// - No vault complexity - tokens held in orders
/// - Users can cancel orders anytime
/// - Execution fee rewards bots for order execution
///
/// Works on ANY shard - async callbacks handle cross-shard swaps!
#[multiversx_sc::contract]
pub trait StellarNova:
    storage::StorageModule
    + events::EventsModule
    + dex::DexModule
    + limit_orders::LimitOrdersModule
{

    /// Initialize the contract
    ///
    /// # Arguments
    /// * `max_slippage_bp` - Maximum slippage in basis points (e.g., 500 = 5%)
    /// * `initial_tokens` - List of tokens to whitelist (WEGLD, USDC)
    #[init]
    fn init(
        &self,
        max_slippage_bp: u64,
        initial_tokens: MultiValueEncoded<TokenIdentifier>,
    ) {
        let caller = self.blockchain().get_caller();

        self.owner().set(&caller);
        self.max_slippage().set(max_slippage_bp);
        self.paused().set(false);

        // Whitelist initial tokens
        for token in initial_tokens {
            self.whitelisted_tokens().insert(token);
        }

        // Initialize limit order system
        self.next_order_id().set_if_empty(1u64);
        self.limit_order_executor().set_if_empty(&caller); // Owner is default executor

        // Set default execution fee: 10 bps = 0.1%
        self.execution_fee_bps().set_if_empty(10u64);
    }

    // ========== ADMIN ENDPOINTS ==========
    // Note: User endpoints (createLimitOrder, executeLimitOrder, cancelLimitOrder)
    // are in limit_orders.rs module

    /// Add token to whitelist
    #[only_owner]
    #[endpoint(whitelistToken)]
    fn whitelist_token(&self, token: TokenIdentifier) {
        require!(
            !self.whitelisted_tokens().contains(&token),
            "Token already whitelisted"
        );

        self.whitelisted_tokens().insert(token.clone());
        self.token_whitelisted_event(&token);
    }

    /// Remove token from whitelist
    #[only_owner]
    #[endpoint(removeToken)]
    fn remove_token(&self, token: TokenIdentifier) {
        require!(
            self.whitelisted_tokens().contains(&token),
            "Token not in whitelist"
        );

        self.whitelisted_tokens().swap_remove(&token);
        self.token_removed_event(&token);
    }

    /// Pause/unpause contract (emergency stop)
    #[only_owner]
    #[endpoint(setPaused)]
    fn set_paused(&self, paused: bool) {
        self.paused().set(paused);
        self.pause_state_changed_event(paused);
    }

    /// Update maximum slippage tolerance
    #[only_owner]
    #[endpoint(setMaxSlippage)]
    fn set_max_slippage(&self, max_slippage_bp: u64) {
        self.max_slippage().set(max_slippage_bp);
    }

    /// Set xExchange pair address (owner only)
    /// For WEGLD/USDC pair: erd1qqqqqqqqqqqqqpgqeel2kumf0r8ffyhth7pqdujjat9nx0862jpsg2pqaq
    #[only_owner]
    #[endpoint(setXExchangePair)]
    fn set_xexchange_pair(&self, pair: ManagedAddress) {
        self.xexchange_pair().set(&pair);
    }

    /// Upgrade contract code
    /// Allows owner to upgrade contract without redeployment
    /// Preserves all storage (user balances, orders, etc.)
    #[upgrade]
    fn upgrade(&self) {
        // Storage is automatically preserved during upgrade
        // No additional migration logic needed for now
    }

    // ========== VIEW FUNCTIONS ==========

    /// Check if token is whitelisted
    #[view(isTokenWhitelisted)]
    fn is_token_whitelisted(&self, token: TokenIdentifier) -> bool {
        self.whitelisted_tokens().contains(&token)
    }
}
