multiversx_sc::imports!();

/// Events module for StellarNova
/// JEXchange-style architecture: only limit order events + admin events
#[multiversx_sc::module]
pub trait EventsModule {

    // ========== ADMIN EVENTS ==========

    /// Emitted when a token is added to whitelist
    #[event("token_whitelisted")]
    fn token_whitelisted_event(
        &self,
        #[indexed] token: &TokenIdentifier,
    );

    /// Emitted when a token is removed from whitelist
    #[event("token_removed")]
    fn token_removed_event(
        &self,
        #[indexed] token: &TokenIdentifier,
    );

    /// Emitted when contract is paused/unpaused
    #[event("pause_state_changed")]
    fn pause_state_changed_event(
        &self,
        paused: bool,
    );

    // ========== LIMIT ORDER EVENTS ==========

    /// Emitted when a limit order is created
    #[event("limit_order_created")]
    fn limit_order_created_event(
        &self,
        #[indexed] order_id: u64,
        #[indexed] user: &ManagedAddress,
        #[indexed] from_token: &TokenIdentifier,
        #[indexed] from_amount: &BigUint,
        #[indexed] to_token: &TokenIdentifier,
        #[indexed] target_price_num: &BigUint,
        #[indexed] target_price_denom: &BigUint,
        expires_at: u64,  // Only this one non-indexed (data)
    );

    /// Emitted when a limit order is executed
    #[event("limit_order_executed")]
    fn limit_order_executed_event(
        &self,
        #[indexed] order_id: u64,
        #[indexed] user: &ManagedAddress,
        #[indexed] from_token: &TokenIdentifier,
        #[indexed] from_amount: &BigUint,
        #[indexed] to_token: &TokenIdentifier,
        #[indexed] to_amount: &BigUint,
        timestamp: u64,  // Only this one non-indexed (data)
    );

    /// Emitted when a limit order is cancelled
    #[event("limit_order_cancelled")]
    fn limit_order_cancelled_event(
        &self,
        #[indexed] order_id: u64,
        #[indexed] user: &ManagedAddress,
        #[indexed] token: &TokenIdentifier,
        amount: &BigUint,  // Only this one non-indexed (data)
    );

    /// Emitted when a limit order expires
    #[event("limit_order_expired")]
    fn limit_order_expired_event(
        &self,
        #[indexed] order_id: u64,
        #[indexed] user: &ManagedAddress,
        #[indexed] token: &TokenIdentifier,
        amount: &BigUint,  // Only this one non-indexed (data)
    );
}
