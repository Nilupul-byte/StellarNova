/// Limit Order Module for StellarNova
///
/// JEXchange-style architecture:
/// - Orders created with direct ESDT payment
/// - Tokens held in contract until execution or cancellation
/// - Synchronous swaps (no async callbacks)

multiversx_sc::imports!();
multiversx_sc::derive_imports!();

#[type_abi]
#[derive(TopEncode, TopDecode, NestedEncode, NestedDecode)]
pub enum OrderStatus {
    Pending,
    Executed,
    Cancelled,
    Expired,
}

#[type_abi]
#[derive(TopEncode, TopDecode)]
pub struct LimitOrder<M: ManagedTypeApi> {
    pub order_id: u64,
    pub user: ManagedAddress<M>,
    pub from_token: TokenIdentifier<M>,
    pub from_amount: BigUint<M>,
    pub to_token: TokenIdentifier<M>,
    pub target_price_numerator: BigUint<M>,     // e.g., 50 USDC
    pub target_price_denominator: BigUint<M>,   // e.g., 1 WEGLD
    pub slippage_bp: u64,                        // basis points (e.g., 500 = 5%)
    pub expires_at: u64,                         // timestamp
    pub status: OrderStatus,
    pub created_at: u64,
}

#[multiversx_sc::module]
pub trait LimitOrdersModule:
    crate::storage::StorageModule
    + crate::events::EventsModule
    + crate::dex::DexModule
{
    /// Create a limit order with ESDT payment (JEXchange style)
    ///
    /// User sends tokens directly, contract holds them until execution/cancellation
    ///
    /// # Payment
    /// User must send the tokens they want to sell
    ///
    /// # Arguments
    /// * `to_token` - Token to buy
    /// * `target_price_num` - Target price numerator
    /// * `target_price_denom` - Target price denominator
    /// * `slippage_bp` - Slippage tolerance in basis points
    /// * `expires_in_seconds` - How long until order expires
    #[payable("*")]
    #[endpoint(createLimitOrder)]
    fn create_limit_order(
        &self,
        to_token: TokenIdentifier,
        target_price_num: BigUint,
        target_price_denom: BigUint,
        slippage_bp: u64,
        expires_in_seconds: u64,
    ) -> u64 {
        require!(!self.paused().get(), "Contract is paused");

        let caller = self.blockchain().get_caller();
        let (from_token, from_amount) = self.call_value().single_fungible_esdt();

        // Validate tokens
        require!(
            self.whitelisted_tokens().contains(&from_token),
            "From token not whitelisted"
        );
        require!(
            self.whitelisted_tokens().contains(&to_token),
            "To token not whitelisted"
        );
        require!(*from_token != to_token, "Cannot swap token to itself");

        // Validate amounts
        require!(*from_amount > 0u64, "Amount must be greater than zero");
        require!(target_price_num > 0u64, "Target price numerator must be positive");
        require!(target_price_denom > 0u64, "Target price denominator must be positive");

        // Validate slippage
        let max_slippage = self.max_slippage().get();
        require!(
            slippage_bp <= max_slippage,
            "Slippage exceeds maximum allowed"
        );

        // Calculate expiry
        #[allow(deprecated)]
        let current_time = self.blockchain().get_block_timestamp();
        let expires_at = current_time + expires_in_seconds;

        // Create order
        let order_id = self.next_order_id().get();
        let order = LimitOrder {
            order_id,
            user: caller.clone(),
            from_token: from_token.clone(),
            from_amount: from_amount.clone(),
            to_token: to_token.clone(),
            target_price_numerator: target_price_num.clone(),
            target_price_denominator: target_price_denom.clone(),
            slippage_bp,
            expires_at,
            status: OrderStatus::Pending,
            created_at: current_time,
        };

        // Store order
        self.limit_orders(order_id).set(&order);
        self.user_orders(&caller).insert(order_id);
        self.next_order_id().set(order_id + 1);

        // Emit event (tokens are already in contract)
        self.limit_order_created_event(
            order_id,
            &caller,
            &from_token,
            &from_amount,
            &to_token,
            &target_price_num,
            &target_price_denom,
            expires_at,
        );

        order_id
    }

    /// Execute a limit order (called by backend executor)
    ///
    /// Performs SYNC swap on xExchange and sends output tokens to user
    ///
    /// # Arguments
    /// * `order_id` - ID of order to execute
    /// * `current_price_num` - Current price numerator (for verification)
    /// * `current_price_denom` - Current price denominator
    #[endpoint(executeLimitOrder)]
    fn execute_limit_order(
        &self,
        order_id: u64,
        current_price_num: BigUint,
        current_price_denom: BigUint,
    ) {
        require!(!self.paused().get(), "Contract is paused");

        let caller = self.blockchain().get_caller();
        let executor = self.limit_order_executor().get();

        require!(caller == executor, "Only executor can execute orders");

        let order = self.limit_orders(order_id).get();

        require!(
            matches!(order.status, OrderStatus::Pending),
            "Order is not pending"
        );

        #[allow(deprecated)]
        let current_time = self.blockchain().get_block_timestamp();
        require!(current_time <= order.expires_at, "Order expired");

        // Verify price condition is met
        let target_price = &order.target_price_numerator * &current_price_denom;
        let current_price = &current_price_num * &order.target_price_denominator;

        require!(
            current_price <= target_price,
            "Price condition not met"
        );

        // Calculate minimum output with slippage
        let min_amount_out = self.calculate_min_output(
            &order.from_amount,
            &order.target_price_numerator,
            &order.target_price_denominator,
            order.slippage_bp,
        );

        // Store execution context for callback
        let context = crate::storage::SwapExecutionContext {
            order_id,
            user: order.user.clone(),
            executor: caller.clone(),
            to_token: order.to_token.clone(),
            min_amount_out: min_amount_out.clone(),
        };
        self.pending_swap_executions(order_id).set(&context);

        // Execute ASYNC swap on xExchange (works cross-shard!)
        let pair_address = self.xexchange_pair().get();

        self.tx()
            .to(&pair_address)
            .gas(30_000_000u64)
            .raw_call("swapTokensFixedInput")
            .argument(&order.to_token)
            .argument(&min_amount_out)
            .single_esdt(&order.from_token, 0u64, &order.from_amount)
            .with_callback(self.callbacks().swap_callback(order_id))
            .with_extra_gas_for_callback(10_000_000)
            .register_promise();
    }

    /// Callback handler for async swap completion (PROMISES API)
    #[promises_callback]
    fn swap_callback(
        &self,
        order_id: u64,
        #[call_result] result: ManagedAsyncCallResult<MultiValueEncoded<EsdtTokenPayment>>,
    ) {
        // Retrieve execution context
        let context_mapper = self.pending_swap_executions(order_id);
        require!(!context_mapper.is_empty(), "Execution context not found");

        let context = context_mapper.get();
        context_mapper.clear();

        match result {
            ManagedAsyncCallResult::Ok(payments) => {
                // Extract swap output
                let mut output_amount = BigUint::zero();
                for payment in payments.into_iter() {
                    if payment.token_identifier == context.to_token {
                        output_amount = payment.amount;
                        break;
                    }
                }

                require!(
                    output_amount >= context.min_amount_out,
                    "Swap output below minimum"
                );

                // Calculate execution fee
                let fee_bps = self.execution_fee_bps().get();
                let execution_fee = &output_amount * &BigUint::from(fee_bps) / &BigUint::from(10000u64);
                let user_amount = &output_amount - &execution_fee;

                // Send tokens
                if execution_fee > 0u64 {
                    self.send().direct_esdt(
                        &context.executor,
                        &context.to_token,
                        0u64,
                        &execution_fee,
                    );
                }

                self.send().direct_esdt(
                    &context.user,
                    &context.to_token,
                    0u64,
                    &user_amount,
                );

                // Mark order as executed
                let mut order = self.limit_orders(order_id).get();
                order.status = OrderStatus::Executed;
                self.limit_orders(order_id).set(&order);

                // Emit event
                #[allow(deprecated)]
                let current_time = self.blockchain().get_block_timestamp();
                self.limit_order_executed_event(
                    order_id,
                    &context.user,
                    &order.from_token,
                    &order.from_amount,
                    &context.to_token,
                    &user_amount,
                    current_time,
                );
            }
            ManagedAsyncCallResult::Err(err) => {
                // Swap failed - order remains pending for retry
                sc_panic!("Swap failed: {}", err.err_msg);
            }
        }
    }

    /// Cancel a limit order (user can cancel their own orders)
    ///
    /// Returns tokens to user immediately
    ///
    /// # Arguments
    /// * `order_id` - ID of order to cancel
    #[endpoint(cancelLimitOrder)]
    fn cancel_limit_order(&self, order_id: u64) {
        let caller = self.blockchain().get_caller();
        let mut order = self.limit_orders(order_id).get();

        require!(order.user == caller, "Not your order");
        require!(
            matches!(order.status, OrderStatus::Pending),
            "Order is not pending"
        );

        // Return tokens to user
        self.send().direct_esdt(&caller, &order.from_token, 0, &order.from_amount);

        // Mark as cancelled
        order.status = OrderStatus::Cancelled;
        self.limit_orders(order_id).set(&order);

        // Emit event
        self.limit_order_cancelled_event(
            order_id,
            &caller,
            &order.from_token,
            &order.from_amount,
        );
    }

    // ========== VIEW FUNCTIONS ==========

    /// Get all pending orders (for backend executor)
    #[view(getPendingOrders)]
    fn get_pending_orders(&self) -> MultiValueEncoded<LimitOrder<Self::Api>> {
        let mut result = MultiValueEncoded::new();
        let next_id = self.next_order_id().get();

        for order_id in 1..next_id {
            if !self.limit_orders(order_id).is_empty() {
                let order = self.limit_orders(order_id).get();
                if matches!(order.status, OrderStatus::Pending) {
                    result.push(order);
                }
            }
        }

        result
    }

    /// Get user's orders
    #[view(getUserOrders)]
    fn get_user_orders(&self, user: ManagedAddress) -> MultiValueEncoded<LimitOrder<Self::Api>> {
        let mut result = MultiValueEncoded::new();

        for order_id in self.user_orders(&user).iter() {
            if !self.limit_orders(order_id).is_empty() {
                result.push(self.limit_orders(order_id).get());
            }
        }

        result
    }

    /// Get order by ID
    #[view(getOrder)]
    fn get_order(&self, order_id: u64) -> LimitOrder<Self::Api> {
        self.limit_orders(order_id).get()
    }

    // ========== ADMIN FUNCTIONS ==========

    /// Set executor address (owner only)
    #[only_owner]
    #[endpoint(setLimitOrderExecutor)]
    fn set_limit_order_executor(&self, executor: ManagedAddress) {
        self.limit_order_executor().set(&executor);
    }

    /// Set execution fee in basis points (owner only)
    /// Example: 10 = 0.1%, 50 = 0.5%, 100 = 1%
    #[only_owner]
    #[endpoint(setExecutionFeeBps)]
    fn set_execution_fee_bps(&self, fee_bps: u64) {
        require!(fee_bps <= 500, "Fee too high (max 5%)");
        self.execution_fee_bps().set(fee_bps);
    }

    // ========== HELPER FUNCTIONS ==========

    fn calculate_min_output(
        &self,
        from_amount: &BigUint,
        target_price_num: &BigUint,
        target_price_denom: &BigUint,
        slippage_bp: u64,
    ) -> BigUint {
        // Expected output = from_amount * target_price_num / target_price_denom
        let expected_output = from_amount * target_price_num / target_price_denom;

        // Min output = expected - slippage
        let slippage_factor = 10000u64 - slippage_bp;
        let min_output = &expected_output * slippage_factor / 10000u64;

        min_output
    }

    // ========== STORAGE ==========

    #[storage_mapper("nextOrderId")]
    fn next_order_id(&self) -> SingleValueMapper<u64>;

    #[storage_mapper("limitOrders")]
    fn limit_orders(&self, order_id: u64) -> SingleValueMapper<LimitOrder<Self::Api>>;

    #[storage_mapper("userOrders")]
    fn user_orders(&self, user: &ManagedAddress) -> UnorderedSetMapper<u64>;

    #[storage_mapper("limitOrderExecutor")]
    fn limit_order_executor(&self) -> SingleValueMapper<ManagedAddress>;
}
