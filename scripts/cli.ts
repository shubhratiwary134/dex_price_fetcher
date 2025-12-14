import { ethers } from "ethers";
import { simulateTrade } from "./fetchPrices.js";
import { TOKEN_MAP } from "../config/tokens.js";
import { ROUTER_MAP } from "../config/routers.js";
import { CliArgs, RawCliArgs } from "../type/cliTypes.js";

function parseArgs(): RawCliArgs {
  const args = process.argv.slice(2);
  const parsed: RawCliArgs = {};

  for (const arg of args) {
    if (!arg.includes("=")) continue;
    const [key, value] = arg.split("=");
    parsed[key as keyof RawCliArgs] = value;
  }

  return parsed;
}

function parseAndValidateArgs(raw: RawCliArgs): CliArgs {
  if (!raw.mode) {
    throw new Error("mode is required");
  }

  if (raw.mode === "simulate") {
    if (!raw.tokenIn) throw new Error("tokenIn is required");
    if (!raw.tokenOut) throw new Error("tokenOut is required");
    if (!raw.routerBuy) throw new Error("routerBuy is required");
    if (!raw.routerSell) throw new Error("routerSell is required");
    if (!raw.tradeSize) throw new Error("tradeSize is required");

    const tradeSize = Number(raw.tradeSize);
    if (Number.isNaN(tradeSize) || tradeSize <= 0) {
      throw new Error("tradeSize must be a positive number");
    }

    return {
      mode: "simulate",
      tokenIn: raw.tokenIn,
      tokenOut: raw.tokenOut,
      routerBuy: raw.routerBuy,
      routerSell: raw.routerSell,
      tradeSize,
    };
  }

  throw new Error(`Unsupported mode: ${raw.mode}`);
}

function resolveAddress(map: Record<string, string>, input?: string): string {
  if (!input) throw new Error("Missing input");

  if (ethers.isAddress(input as string)) return input;

  const resolved = map[input.toUpperCase()];
  if (!resolved) throw new Error(`Unknown value: ${input}`);

  return resolved;
}

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
  }
}

main().catch((err) => {
  console.error(" CLI Error:", err.message);
  process.exitCode = 1;
});
