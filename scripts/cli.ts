#!/usr/bin/env node

import { simulateTrade } from "./fetchPrices.js";
import { TOKEN_MAP } from "../config/tokens.js";
import { ROUTER_MAP } from "../config/routers.js";
import { findPerfectTradeSize } from "../helpers/tradeSizeHelper.js";
import { plotCurveHelper } from "../helpers/plotCurveHelper.js";
import { getValueInUSD } from "../services/conversionServices.js";
import { saveReport } from "../helpers/reportHelpers.js";
import { ReportData, ReportScenario } from "../type/reportTypes.js";
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
    const [routerAName, routerBName] = args.routers;
    const routerA = resolveAddress(ROUTER_MAP, routerAName);
    const routerB = resolveAddress(ROUTER_MAP, routerBName);

    console.log(`\n--- Direction A: Buy on ${routerAName}, Sell on ${routerBName} ---`);
    await simulateTrade(args.tradeSize, tokenIn, tokenOut, routerA, routerB, args.slippageBps, args.gasGwei);

    console.log(`\n--- Direction B: Buy on ${routerBName}, Sell on ${routerAName} ---`);
    await simulateTrade(args.tradeSize, tokenIn, tokenOut, routerB, routerA, args.slippageBps, args.gasGwei);

    return;
  }

  if (args.mode === "optimize") {
    const tokenIn = resolveAddress(TOKEN_MAP, args.tokenIn);
    const tokenOut = resolveAddress(TOKEN_MAP, args.tokenOut);
    const [routerAName, routerBName] = args.routers;
    const routerA = resolveAddress(ROUTER_MAP, routerAName);
    const routerB = resolveAddress(ROUTER_MAP, routerBName);
    const slippageInfo = args.slippageBps ?? [0];
    const gasGweiInfo = args.gasGwei ?? [0];

    // --- Probe both directions with a single mid-range trade size ---
    const probeSize = (args.minSize + args.maxSize) / 2;

    console.log(`\n Probing both directions with trade size ${probeSize}...`);

    const [probeAB, probeBA] = await Promise.all([
      simulateTrade(probeSize, tokenIn, tokenOut, routerA, routerB, 0, 0),
      simulateTrade(probeSize, tokenIn, tokenOut, routerB, routerA, 0, 0),
    ]);

    // Pick the more profitable direction
    const dirABIsBetter = probeAB.raw >= probeBA.raw;

    const direction = dirABIsBetter
      ? { label: `${routerAName} → ${routerBName}`, routerBuy: routerA, routerSell: routerB }
      : { label: `${routerBName} → ${routerAName}`, routerBuy: routerB, routerSell: routerA };

    console.log(`Better direction: ${direction.label}`);
    console.log(`   (A→B raw: ${probeAB.raw}, B→A raw: ${probeBA.raw})`);

    // --- Full optimize loop on the winning direction only ---
    const breakEvens: BreakEven[] = [];
    const reportScenarios: ReportScenario[] = [];

    console.log(`\n${"=".repeat(50)}`);
    console.log(`Optimizing: ${direction.label}`);
    console.log(`${"=".repeat(50)}`);

    for (const slippage of slippageInfo) {
      for (const gasGwei of gasGweiInfo) {
        const { results, bestResult } = await findPerfectTradeSize({
          tokenIn,
          tokenOut,
          routerBuy: direction.routerBuy,
          routerSell: direction.routerSell,
          minSize: args.minSize,
          maxSize: args.maxSize,
          stepSize: args.stepSize,
          slippageBps: slippage,
          gasGwei,
        });

        let breakEven: BreakEven | undefined;

        for (let i = 1; i < results.length; i++) {
          const prevProfit = Number(results[i - 1].profitUSD);
          const currProfit = Number(results[i].profitUSD);
          if (prevProfit < 0 && currProfit >= 0) {
               breakEven = {          // assign here
                     slippage,
                     gasGwei,
                     fromSize: results[i - 1].size,
                     toSize: results[i].size,
              };
              breakEvens.push(breakEven);
            break;
          }
        }

        if (args.curve) {

          const plottingData = results.map((point) => ({
            size: point.size,
            profitUSD: Number(point.profitUSD),
          }));
          plotCurveHelper({ plottingData });
        }

        if (bestResult) {
          console.log(`\nOptimal Trade Size [slippage=${slippage}bps gas=${gasGwei}gwei]:`);
          console.log(`→ size: ${bestResult.size} → profit: $${bestResult.profitUSD}`);
        }
        
        reportScenarios.push({
        slippage,
        gasGwei,
        bestSize: bestResult?.size ?? 0,
        bestProfitUSD: bestResult?.profitUSD ?? "0",
        results: results.map((r) => ({ size: r.size, profitUSD: r.profitUSD })),
        breakEven,
      });
      }
    }

    console.log(`\n📍 Break-even Summary — ${direction.label}`);
    console.log("-".repeat(40));

    if (breakEvens.length === 0) {
      console.log("No break-even found — unprofitable across all scenarios");
    } else {
      for (const breakEven of breakEvens) {
        console.log(
          `Slippage ${breakEven.slippage}bps | Gas ${breakEven.gasGwei ?? "live"}gwei → ` +
          `between ${breakEven.fromSize} and ${breakEven.toSize}`
        );
      }
    }

    const totalWorlds = slippageInfo.length * gasGweiInfo.length;
    console.log(`Viable in ${breakEvens.length} / ${totalWorlds} execution environments`);

    const reportData: ReportData = {
    metadata: {
      timestamp: new Date().toISOString(),
      tokenIn: args.tokenIn,
      tokenOut: args.tokenOut,
      routerA: routerAName,
      routerB: routerBName,
      chosenDirection: direction.label,
      minSize: args.minSize,
      maxSize: args.maxSize,
      stepSize: args.stepSize,
    },
    scenarios: reportScenarios,
    viableScenariosCount: breakEvens.length,
    totalScenariosCount: totalWorlds,
  };

  const reportPath = saveReport(reportData);
  console.log(`\n📄 Report saved: ${reportPath}`);

    return;
  }

  if (args.mode === "price") {
    const token = resolveAddress(TOKEN_MAP, args.token);
    const valueInUSD = await getValueInUSD(token);
    console.log("========================");
    if (valueInUSD) {
      console.log(`price of one unit of token ${args.token} in USD: $${valueInUSD.formatted}`);
    }
    return;
  }
}

main().catch((err) => {
  console.error("CLI Error:", err.message);
  process.exitCode = 1;
});