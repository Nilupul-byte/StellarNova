multiversx_sc::imports!();

/// Storage module for StellarNova
/// JEXchange-style architecture: orders hold tokens directly
#[multiversx_sc::module]
pub trait StorageModule {

    // ========== TOKEN WHITELIST ==========

    /// Whitelisted tokens that can be traded
    /// Only these tokens are allowed in the system
    #[view(getWhitelistedTokens)]
    #[storage_mapper("whitelistedTokens")]
    fn whitelisted_tokens(&self) -> UnorderedSetMapper<TokenIdentifier>;

    // ========== DEX INTEGRATION ==========

    /// xExchange WEGLD/USDC pair address for direct swaps
    /// Address: erd1qqqqqqqqqqqqqpgqeel2kumf0r8ffyhth7pqdujjat9nx0862jpsg2pqaq
    /// IMPORTANT: Deploy contract to Shard 1 (same as this pair) for sync calls!
    #[view(getXExchangePair)]
    #[storage_mapper("xExchangePair")]
    fn xexchange_pair(&self) -> SingleValueMapper<ManagedAddress>;

    // ========== CONFIGURATION ==========

    /// Contract owner (for admin functions)
    #[view(getOwner)]
    #[storage_mapper("owner")]
    fn owner(&self) -> SingleValueMapper<ManagedAddress>;

    /// Contract paused state (emergency stop)
    #[view(isPaused)]
    #[storage_mapper("paused")]
    fn paused(&self) -> SingleValueMapper<bool>;

    /// Maximum slippage tolerance (basis points, e.g., 500 = 5%)
    #[view(getMaxSlippage)]
    #[storage_mapper("maxSlippage")]
    fn max_slippage(&self) -> SingleValueMapper<u64>;

    // ========== ASYNC EXECUTION CONTEXT ==========

    /// Track pending async swap executions
    /// Maps order_id to execution context for callback handling
    #[storage_mapper("pendingSwaps")]
    fn pending_swap_executions(&self, order_id: u64) -> SingleValueMapper<SwapExecutionContext<Self::Api>>;

    /// Execution fee (in bps, e.g., 10 = 0.1%)
    /// Bot gets this percentage of output tokens as reward
    #[view(getExecutionFeeBps)]
    #[storage_mapper("executionFeeBps")]
    fn execution_fee_bps(&self) -> SingleValueMapper<u64>;
}

use multiversx_sc::derive_imports::*;

/// Context stored during async swap execution
#[type_abi]
#[derive(TopEncode, TopDecode, NestedEncode, NestedDecode)]
pub struct SwapExecutionContext<M: ManagedTypeApi> {
    pub order_id: u64,
    pub user: ManagedAddress<M>,
    pub executor: ManagedAddress<M>,
    pub to_token: TokenIdentifier<M>,
    pub min_amount_out: BigUint<M>,
}
