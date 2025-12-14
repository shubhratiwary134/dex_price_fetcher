export type cliArgs = {
  mode?: cliMode;
  tokenIn?: string;
  tokenOut?: string;
  routerBuy?: string;
  routerSell?: string;
  tradeSize?: number;
};

export type cliMode = "simulate" | "optimize" | "price" | "monitor";
