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
import { BreakEven } from "../type/analysisTypes.js";

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

    const breakEvens: BreakEven[] = [];

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

        for (let i = 1; i < results.length; i++) {
          const prevProfit = Number(results[i - 1].profitUSD);
          const currProfit = Number(results[i].profitUSD);

          if (prevProfit < 0 && currProfit >= 0) {
            breakEvens.push({
              slippage,
              gasGwei: gasGwei,
              fromSize: results[i - 1].size,
              toSize: results[i].size,
            });
            break;
          }
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

    console.log("\n📍 Break-even Summary");
    console.log("--------------------");

    for (const breakEven of breakEvens) {
      console.log(
        `Slippage ${breakEven.slippage} bps | Gas ${
          breakEven.gasGwei ?? "live"
        } gwei → ` + `between ${breakEven.fromSize} and ${breakEven.toSize}`
      );
    }

    const totalBreakEvens = breakEvens.length;
    const totalWorlds = slippageInfo.length * gasGweiInfo.length;
    console.log(
      `\n Viable in ${totalBreakEvens} / ${totalWorlds} execution environments`
    );

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
