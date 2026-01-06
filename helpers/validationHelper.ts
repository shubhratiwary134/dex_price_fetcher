import { ethers } from "ethers";
import { CliArgs, RawCliArgs } from "../type/cliTypes.js";

export function parseArgs(): RawCliArgs {
  const args = process.argv.slice(2);
  const parsed: RawCliArgs = {};

  for (const arg of args) {
    if (!arg.includes("=")) continue;
    const [key, value] = arg.split("=");
    parsed[key as keyof RawCliArgs] = value;
  }

  return parsed;
}

export function parseAndValidateArgs(raw: RawCliArgs): CliArgs {
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

  if (raw.mode === "optimize") {
    if (!raw.tokenIn) throw new Error("tokenIn is required");
    if (!raw.tokenOut) throw new Error("tokenOut is required");
    if (!raw.routerBuy) throw new Error("routerBuy is required");
    if (!raw.routerSell) throw new Error("routerSell is required");
    if (!raw.minSize) throw new Error("minSize is required");
    if (!raw.maxSize) throw new Error("maxSize is required");
    if (!raw.stepSize) throw new Error("stepSize is required");
    if (!raw.curve) raw.curve = "false";

    const minSize = Number(raw.minSize);
    const maxSize = Number(raw.maxSize);
    const stepSize = Number(raw.stepSize);
    const curve = Boolean(raw.curve);

    if (minSize <= 0 || maxSize <= 0 || stepSize <= 0) {
      throw new Error("minSize, maxSize, stepSize must be positive numbers");
    }

    if (minSize >= maxSize) {
      throw new Error("minSize must be < maxSize");
    }

    let slippageBps: number[] | undefined;

    let gasGwei: number[] | undefined;

    if (raw.slippageBps) {
      slippageBps = raw.slippageBps.split(",").map((v) => {
        const n = Number(v);
        if (Number.isNaN(n) || n < 0) {
          throw new Error("slippageBps must be non-negative numbers");
        }
        return n;
      });
    }

    if (raw.gasGwei) {
      gasGwei = raw.gasGwei.split(",").map((v) => {
        const n = Number(v);
        if (Number.isNaN(n) || n < 0) {
          throw new Error("gasGwei must be non-negative numbers");
        }
        return n;
      });
    }

    return {
      mode: "optimize",
      tokenIn: raw.tokenIn,
      tokenOut: raw.tokenOut,
      routerBuy: raw.routerBuy,
      routerSell: raw.routerSell,
      minSize,
      maxSize,
      stepSize,
      curve,
      slippageBps,
      gasGwei,
    };
  }

  if (raw.mode === "price") {
    if (!raw.token) throw new Error("token is required");
    return {
      mode: "price",
      token: raw.token,
    };
  }

  throw new Error(`Unsupported mode: ${raw.mode}`);
}

export function resolveAddress(
  map: Record<string, string>,
  input?: string
): string {
  if (!input) throw new Error("Missing input");

  if (ethers.isAddress(input as string)) return input;

  const resolved = map[input.toUpperCase()];
  if (!resolved) throw new Error(`Unknown value: ${input}`);

  return resolved;
}
