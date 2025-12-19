import { ethers } from "ethers";
import { simulateTrade } from "../scripts/fetchPrices.js";
import { getValueInUSD } from "../services/conversionServices.js";
import { tokenDecimals } from "../services/tokenServices.js";

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
    const profitTokenRaw = await simulateTrade(
      size,
      params.tokenIn,
      params.tokenOut,
      params.routerBuy,
      params.routerSell
    );

    const price = await getValueInUSD(params.tokenIn);
    if (!price) continue;

    const profitUSD =
      (profitTokenRaw * price.raw) /
      ethers.parseUnits("1", await tokenDecimals(params.tokenIn));

    const point: OptimizationPoints = {
      size,
      profitTokenRaw: profitTokenRaw,
      profitUSD: ethers.formatUnits(profitUSD, price.decimals),
    };

    results.push(point);

    if (
      !bestResult ||
      BigInt(profitUSD) >
        BigInt(ethers.parseUnits(bestResult.profitUSD, price.decimals))
    ) {
      bestResult = point;
    }
  }
  return { results, bestResult };
}
