import { ethers } from "ethers";
import { fetchQuotes, computeProfit } from "../scripts/fetchPrices.js";
import { getProvider } from "../services/providerServices.js";

const provider = await getProvider();

export type OptimizationPoints = {
  size: number;
  profitTokenRaw: bigint;
  profitUSD: string;
};

export async function findPerfectTradeSize(params: {
  tokenIn: string;
  tokenOut: string;
  routerBuy: string;
  routerSell: string;
  minSize: number;
  maxSize: number;
  stepSize: number;
  slippageBps?: number;
  gasGwei?: number;
}) {
  // this function will iterate over different trade sizes to find the optimal one
  const results: OptimizationPoints[] = [];
  let bestResult: OptimizationPoints | null = null;

  // Build sizes array
  const sizes: number[] = [];
  for (let size = params.minSize; size <= params.maxSize; size += params.stepSize) {
    sizes.push(Number(size.toFixed(10)));
  }

  // Fetch live fee data once — reused across all computeProfit calls
  const feeData = await provider.getFeeData();

  // Fetch quotes once per trade size — single set of RPC calls per size
  // slippage and gas are NOT applied here
  const quotesPerSize = await Promise.all(
    sizes.map((size) =>
      fetchQuotes(
        size,
        params.tokenIn,
        params.tokenOut,
        params.routerBuy,
        params.routerSell
      )
    )
  );

  // Apply slippage + gas in memory — zero additional RPC calls
  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i];
    const quotes = quotesPerSize[i];

    const { raw, profitInUSD } = computeProfit(
      quotes,
      params.slippageBps,
      params.gasGwei,
      {
        gasPrice: feeData.gasPrice,
        maxFeePerGas: feeData.maxFeePerGas,
      }
    );

    const point: OptimizationPoints = {
      size,
      profitTokenRaw: raw,
      profitUSD: ethers.formatUnits(profitInUSD, quotes.priceTokenInUSD.decimals),
    };

    results.push(point);

    if (
      !bestResult ||
      raw > bestResult.profitTokenRaw
    ) {
      bestResult = point;
    }
  }

  return { results, bestResult };
}