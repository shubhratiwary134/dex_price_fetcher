import { ethers } from "ethers";
import { simulateTrade } from "../scripts/fetchPrices.js";
import { getValueInUSD } from "../services/conversionServices.js";

export type OptimizationPoints = {
  size: number;
  profitTokenRaw: bigint;
  profitUSD: string;
};

async function findPerfectTradeSize(params: {
  tokenIn: string;
  tokenOut: string;
  routerBuy: string;
  routerSell: string;
  minSize: number;
  maxSize: number;
  stepSize: number;
}) {
  // this function will iterate over different trade sizes to find the optimal one
  const results: OptimizationPoints[] = [];
  let bestResult: OptimizationPoints | null = null;

  for (
    let size = params.minSize;
    size <= params.maxSize;
    size += params.stepSize
  ) {
    const profitToken = await simulateTrade(
      size,
      params.tokenIn,
      params.tokenOut,
      params.routerBuy,
      params.routerSell
    );

    const profitTokenRaw = profitToken.raw;
    const profitUSD = profitToken.profitInUSD;

    const point: OptimizationPoints = {
      size,
      profitTokenRaw: profitTokenRaw,
      profitUSD: ethers.formatUnits(profitUSD, 6),
    };

    results.push(point);

    if (
      !bestResult ||
      BigInt(profitUSD) > BigInt(ethers.parseUnits(bestResult.profitUSD, 6))
    ) {
      bestResult = point;
    }
  }
  return { results, bestResult };
}
