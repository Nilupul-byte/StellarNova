/// Custom error messages for StellarNova
/// All errors are explicit and user-friendly for debugging

pub const ERROR_NOT_OWNER: &str = "Only contract owner can call this function";
pub const ERROR_CONTRACT_PAUSED: &str = "Contract is paused";
pub const ERROR_TOKEN_NOT_WHITELISTED: &str = "Token is not whitelisted for trading";
pub const ERROR_INSUFFICIENT_BALANCE: &str = "Insufficient balance in vault";
pub const ERROR_INVALID_AMOUNT: &str = "Amount must be greater than zero";
pub const ERROR_SAME_TOKEN: &str = "Cannot swap token to itself";
pub const ERROR_NO_PAYMENT: &str = "No payment received";
pub const ERROR_INVALID_TOKEN: &str = "Invalid token sent";
pub const ERROR_SLIPPAGE_TOO_HIGH: &str = "Slippage tolerance exceeded";
pub const ERROR_SWAP_FAILED: &str = "DEX swap execution failed";
pub const ERROR_ALREADY_WHITELISTED: &str = "Token already whitelisted";
pub const ERROR_NOT_WHITELISTED: &str = "Token not in whitelist";
