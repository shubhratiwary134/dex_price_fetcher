export type CliArgs = SimulateArgs | OptimizeArgs | PriceArgs | MonitorArgs;

export type cliMode = "simulate" | "optimize" | "price" | "monitor";

export type ChartTheme = "pastel" | "dark" | "light";

export type ChartColor = "pink" | "blue" | "green" | "red";

export type RawCliArgs = {
  mode?: string;

  // shared
  tokenIn?: string;
  tokenOut?: string;
  routerBuy?: string;
  routerSell?: string;

  // simulate
  tradeSize?: string;

  // optimize
  minSize?: string;
  maxSize?: string;
  stepSize?: string;
  curve?: string;
  slippageBps?: string; // taking comma separated values for slippage bps in the cli
  gasGwei?: string; // taking comma separated values for gas gwei for a gas sensitivity analysis
  opportunityScore?: string;

  // price
  token?: string;

  // monitor
  interval?: string;
};

export type SimulateArgs = {
  mode: "simulate";
  tokenIn: string;
  tokenOut: string;
  routerBuy: string;
  routerSell: string;
  tradeSize: number;
};

export type OptimizeArgs = {
  mode: "optimize";
  tokenIn: string;
  tokenOut: string;
  routerBuy: string;
  routerSell: string;
  minSize: number;
  maxSize: number;
  stepSize: number;
  curve: boolean | false;
  slippageBps?: number[];
  gasGwei?: number[];
  opportunityScore?: boolean | false;
};

export type PriceArgs = {
  mode: "price";
  token: string;
};

export type MonitorArgs = {
  mode: "monitor";
  tokenIn: string;
  tokenOut: string;
  interval: number;
};
