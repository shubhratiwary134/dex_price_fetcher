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
