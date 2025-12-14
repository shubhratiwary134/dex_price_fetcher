The CLI is implemented as a Hardhat-native script to enable mainnet-fork simulations, but the core logic is framework-agnostic and can be reused in a standalone Node CLI if needed.

This design allows:
- deterministic simulations
- real mainnet liquidity
- zero capital risk

