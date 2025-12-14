export type CliArgs = SimulateArgs | OptimizeArgs | PriceArgs | MonitorArgs;

export type cliMode = "simulate" | "optimize" | "price" | "monitor";

export type RawCliArgs = {
  mode?: string;
  tokenIn?: string;
  tokenOut?: string;
  routerBuy?: string;
  routerSell?: string;
  tradeSize?: string;
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
