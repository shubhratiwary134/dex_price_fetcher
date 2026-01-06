import { ethers } from "ethers";
import { simulateTrade } from "./fetchPrices.js";
import { TOKEN_MAP } from "../config/tokens.js";
import { ROUTER_MAP } from "../config/routers.js";
import { findPerfectTradeSize } from "../helpers/tradeSizeHelper.js";
import { plotCurveHelper } from "../helpers/plotCurveHelper.js";
import { getValueInUSD } from "../services/conversionServices.js";
import {
  parseAndValidateArgs,
  parseArgs,
  resolveAddress,
} from "../helpers/validationHelper.js";

async function main() {
  const rawArgs = parseArgs();
  const args = parseAndValidateArgs(rawArgs);

  if (args.mode === "simulate") {
    const tokenIn = resolveAddress(TOKEN_MAP, args.tokenIn);
    const tokenOut = resolveAddress(TOKEN_MAP, args.tokenOut);
    const routerBuy = resolveAddress(ROUTER_MAP, args.routerBuy);
    const routerSell = resolveAddress(ROUTER_MAP, args.routerSell);

    await simulateTrade(
      args.tradeSize,
      tokenIn,
      tokenOut,
      routerBuy,
      routerSell
    );

    return;
  } else if (args.mode === "optimize") {
    const tokenIn = resolveAddress(TOKEN_MAP, args.tokenIn);
    const tokenOut = resolveAddress(TOKEN_MAP, args.tokenOut);
    const routerBuy = resolveAddress(ROUTER_MAP, args.routerBuy);
    const routerSell = resolveAddress(ROUTER_MAP, args.routerSell);

    const slippageInfo = args.slippageBps ?? [0];

    const gasGweiInfo = args.gasGwei ?? [0];

    for (const slippage of slippageInfo) {
      for (const gasGwei of gasGweiInfo) {
        // we find the perfect trade size for each slippage value provided
        const { results, bestResult } = await findPerfectTradeSize({
          tokenIn,
          tokenOut,
          routerBuy,
          routerSell,
          minSize: args.minSize,
          maxSize: args.maxSize,
          stepSize: args.stepSize,
          slippageBps: slippage,
          gasGwei,
        });

        for (const r of results) {
          console.log(`${r.size} → $${r.profitUSD}`);
        }

        if (args.curve) {
          // Plotting logic would go here
          const plottingData = results.map((point) => ({
            size: point.size,
            profitUSD: Number(point.profitUSD),
          }));

          plotCurveHelper({ plottingData });
        }

        if (bestResult) {
          console.log(`\nOptimal Trade Size for ${slippage} bps :`);
          console.log(`→ ${bestResult.size} → $${bestResult.profitUSD}`);
        }
      }
    }

    return;
  } else if (args.mode === "price") {
    const token = resolveAddress(TOKEN_MAP, args.token);
    const valueInUSD = await getValueInUSD(token);

    console.log("========================");
    if (valueInUSD) {
      console.log(
        `price of one unit of token ${args.token} in USD: $${valueInUSD.formatted}`
      );
    }
    return;
  }
}

main().catch((err) => {
  console.error(" CLI Error:", err.message);
  process.exitCode = 1;
});
