export type ReportMetadata = {
  timestamp: string;
  tokenIn: string;
  tokenOut: string;
  routerA: string;
  routerB: string;
  chosenDirection: string;
  minSize: number;
  maxSize: number;
  stepSize: number;
};

export type ReportResult = {
  size: number;
  profitUSD: string;
};

export type ReportBreakEven = {
  slippage: number;
  gasGwei?: number;
  fromSize: number;
  toSize: number;
};

export type ReportScenario = {
  slippage: number;
  gasGwei: number;
  bestSize: number;
  bestProfitUSD: string;
  results: ReportResult[];
  breakEven?: ReportBreakEven;
};

export type ReportData = {
  metadata: ReportMetadata;
  scenarios: ReportScenario[];
  viableScenariosCount: number;
  totalScenariosCount: number;
};