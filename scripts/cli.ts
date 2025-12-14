import { ethers } from "ethers";
import { simulateTrade } from "./fetchPrices.js";
import { TOKEN_MAP } from "../config/tokens.js";
import { ROUTER_MAP } from "../config/routers.js";
import { cliArgs, cliMode } from "../type/cliTypes.js";

function parseArgs(): cliArgs {
  const args = process.argv.slice(2);

  const parsed: cliArgs = {};

  for (const arg of args) {
    if (!arg.includes("=")) continue;

    const [key, value] = arg.split("=");

    switch (key) {
      case "mode":
        parsed.mode = value as cliMode;
        break;

      case "tradeSize":
        parsed.tradeSize = Number(value);
        break;

      case "tokenIn":
      case "tokenOut":
      case "routerBuy":
      case "routerSell":
        parsed[key] = value;
        break;
    }
  }

  return parsed;
}

function resolveAddress(map: Record<string, string>, input?: string): string {
  if (!input) throw new Error("Missing input");

  if (ethers.isAddress(input as string)) return input;

  const resolved = map[input.toUpperCase()];
  if (!resolved) throw new Error(`Unknown value: ${input}`);

  return resolved;
}

async function main() {
  const args = parseArgs();
  const mode = args.mode || "fetchPrices";
  if (!mode) {
    throw new Error("mode is required (simulate | optimize | price)");
  }
  if (mode === "simulate") {
    const tokenIn = resolveAddress(TOKEN_MAP, args.tokenIn);
    const tokenOut = resolveAddress(TOKEN_MAP, args.tokenOut);
    const routerBuy = resolveAddress(ROUTER_MAP, args.routerBuy);
    const routerSell = resolveAddress(ROUTER_MAP, args.routerSell);

    const tradeSize = Number(args.tradeSize);
    if (!tradeSize || tradeSize <= 0) {
      throw new Error("tradeSize must be > 0");
    }

    await simulateTrade(tradeSize, tokenIn, tokenOut, routerBuy, routerSell);

    return;
  }
  throw new Error(`Unknown mode: ${mode}`);
}
main().catch((err) => {
  console.error(" CLI Error:", err.message);
  process.exitCode = 1;
});
