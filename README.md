# dex-arb-simulator

A command-line tool for simulating and analyzing DEX arbitrage opportunities on a forked Ethereum mainnet. Supports trade size optimization, multi-scenario slippage and gas sensitivity analysis, direction auto-detection, and structured report generation.

---

## How It Works

The tool connects to a locally running Hardhat fork of Ethereum mainnet and uses Uniswap V2-style router contracts to simulate arbitrage trades between two DEXes. It calculates realistic profit estimates by accounting for pool fees, price impact, slippage, and gas costs without executing any real transactions.

For each analysis, the tool automatically determines the more profitable trading direction (e.g. buy on Uniswap, sell on Sushiswap vs. the reverse) by probing both directions before running the full optimization.

---

## Prerequisites

- Node.js 18 or higher
- A locally running Hardhat fork of Ethereum mainnet on port 8545

To start a fork:

```bash
npx hardhat node --fork YOUR_MAINNET_RPC_URL
```

The tool connects to http://127.0.0.1:8545 automatically.
Your RPC URL can be obtained free from Alchemy or Infura.
The fork must be running before executing any dex-arb commands.


## Installation
```bash
npm install -g dex-arb-simulator
```

---

## Modes

### simulate

Simulates a single arbitrage trade at a fixed size and prints the profit for both trading directions.
```bash
dex-arb mode=simulate \
  tokenIn=WETH \
  tokenOut=DAI \
  routers="UNISWAP,SUSHISWAP" \
  tradeSize=1
```

With optional slippage and gas scenario:
```bash
dex-arb mode=simulate \
  tokenIn=WETH \
  tokenOut=DAI \
  routers="UNISWAP,SUSHISWAP" \
  tradeSize=1 \
  slippageBps=10 \
  gasGwei=20
```

| Argument | Required | Description |
|---|---|---|
| tokenIn | Yes | Token you start and end with (e.g. WETH) |
| tokenOut | Yes | Intermediate token used in the swap (e.g. DAI) |
| routers | Yes | Two routers, comma-separated (e.g. UNISWAP,SUSHISWAP) |
| tradeSize | Yes | Amount of tokenIn to trade |
| slippageBps | No | Slippage in basis points (e.g. 10 = 0.1%) |
| gasGwei | No | Gas price in gwei. Uses live network price if omitted |

---

### optimize

Sweeps a range of trade sizes to find the optimal entry point. Runs a full slippage and gas sensitivity matrix, identifies break-even trade sizes, and saves a structured Markdown report to the `./reports` folder.
```bash
dex-arb mode=optimize \
  tokenIn=WETH \
  tokenOut=DAI \
  routers="UNISWAP,SUSHISWAP" \
  minSize=1 \
  maxSize=10 \
  stepSize=1 \
  slippageBps="10,30,50" \
  gasGwei="20,50,100"
```

With ASCII profit curve:
```bash
dex-arb mode=optimize \
  tokenIn=WETH \
  tokenOut=DAI \
  routers="UNISWAP,SUSHISWAP" \
  minSize=1 maxSize=10 stepSize=1 \
  slippageBps="10,30" gasGwei="20,50" \
  curve=true
```

| Argument | Required | Description |
|---|---|---|
| tokenIn | Yes | Token you start and end with |
| tokenOut | Yes | Intermediate token |
| routers | Yes | Two routers, comma-separated |
| minSize | Yes | Minimum trade size to test |
| maxSize | Yes | Maximum trade size to test |
| stepSize | Yes | Increment between trade sizes |
| slippageBps | No | Comma-separated slippage scenarios in basis points |
| gasGwei | No | Comma-separated gas price scenarios in gwei |
| curve | No | Print an ASCII profit curve. Set to true to enable |

---

### price

Returns the current USD price of a token using on-chain pool data.
```bash
dex-arb mode=price token=WETH
```

| Argument | Required | Description |
|---|---|---|
| token | Yes | Token symbol or address |

---

## Supported Tokens

| Symbol | Address |
|---|---|
| WETH | 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 |
| DAI | 0x6B175474E89094C44Da98b954EedeAC495271d0F |
| USDC | 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 |
| USDT | 0xdAC17F958D2ee523a2206206994597C13D831ec7 |
| WBTC | 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599 |

Any ERC-20 token address can also be passed directly.

---

## Supported Routers

| Name | Address |
|---|---|
| UNISWAP | 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D |
| SUSHISWAP | 0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f |

---

## Report Output

After every optimize run, a Markdown report is saved to `./reports/` with the filename:
```
report_WETH_DAI_2024-01-15T10-30-00.md
```

The report includes:

- Run configuration and chosen trading direction
- Optimal trade size and profit per scenario
- Break-even trade size for each slippage and gas combination
- Full results table per trade size
- Viability summary across all scenarios

---

## Help
```bash
dex-arb --help
```

---

## Notes

- This tool uses Uniswap V2-style routers. Uniswap V3 pools are not currently supported.
- Slippage in this tool is a scenario modeling parameter, not a transaction protection value. It represents how much the market moves against you on each leg of the trade.
- USDC requires a known storage slot override due to its proxy contract architecture. This is handled automatically.
- The tool requires a Hardhat fork to be running before execution. It does not start or manage the fork itself.

---

## License

MIT