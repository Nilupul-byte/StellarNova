/// DEX Integration Module for StellarNova
///
/// This module is kept for future extensibility
/// Currently, swap logic is directly in limit_orders module

multiversx_sc::imports!();

#[multiversx_sc::module]
pub trait DexModule:
    crate::storage::StorageModule
{
    // Module reserved for future DEX integrations
}
