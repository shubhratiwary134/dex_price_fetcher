export type BreakEven = {
  slippage: number;
  gasGwei?: number;
  fromSize: number;
  toSize: number;
};

export type worldSummary = {
  slippageBps: number;
  gasGwei: number;

  peakProfitUSD: bigint;
  optimalSize: number;

  isViable: boolean;

  breakEvenLower?: number;
  breakEvenUpper?: number;
};

export type TradeQuotes = {
  rawAmountOut: bigint;
  rawFinalAmountOut: bigint;
  gasUnits: bigint;
  tokenInPerEth: bigint;
  tokenInDecimals: number;
  tokenOutDecimals: number;
  amountIn: bigint;
  priceTokenInUSD: { raw: bigint; decimals: number; formatted: string };
};