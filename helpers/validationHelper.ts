import { ethers } from "ethers";
import { CliArgs, RawCliArgs } from "../type/cliTypes.js";
import { ROUTER_MAP } from "../config/routers.js";

export function parseArgs(): RawCliArgs {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  const parsed: RawCliArgs = {};
  for (const arg of args) {
    if (!arg.includes("=")) continue;
    const [key, value] = arg.split("=");
    parsed[key as keyof RawCliArgs] = value;
  }
  return parsed;
}

function parseRouters(raw: RawCliArgs): [string, string] {
  if (!raw.routers) {
    throw new Error(`routers is required. Example: routers=UNISWAP,SUSHISWAP`);
  }

  const parts = raw.routers.split(",").map((r) => r.trim().toUpperCase());

  if (parts.length !== 2) {
    throw new Error(
      `routers must be exactly 2 comma-separated values. Got: "${raw.routers}"`
    );
  }

  const [routerA, routerB] = parts;
  
  if (!ROUTER_MAP[routerA as keyof typeof ROUTER_MAP]) {
  throw new Error(
    `Unknown router "${routerA}". Available: ${Object.keys(ROUTER_MAP).join(", ")}`
  );
  }

  if (!ROUTER_MAP[routerB as keyof typeof ROUTER_MAP]) {
  throw new Error(
    `Unknown router "${routerB}". Available: ${Object.keys(ROUTER_MAP).join(", ")}`
  );
  }

  if (routerA === routerB) {
    throw new Error(
      `routers must be two different routers. Got the same router twice: "${routerA}"`
    );
  }

  return [routerA, routerB];
}

export function parseAndValidateArgs(raw: RawCliArgs): CliArgs {
  if (!raw.mode) {
    throw new Error("mode is required");
  }

  if (raw.mode === "simulate") {
    if (!raw.tokenIn) throw new Error("tokenIn is required");
    if (!raw.tokenOut) throw new Error("tokenOut is required");
    if (!raw.tradeSize) throw new Error("tradeSize is required");

    const tradeSize = Number(raw.tradeSize);
    if (Number.isNaN(tradeSize) || tradeSize <= 0) {
      throw new Error("tradeSize must be a positive number");
    }

    const routers = parseRouters(raw);

    let slippageBps: number | undefined;
    let gasGwei: number | undefined;

    if (raw.slippageBps) {
    const n = Number(raw.slippageBps);
    if (Number.isNaN(n) || n < 0) throw new Error("slippageBps must be a non-negative number");
    slippageBps = n;
    }

    if (raw.gasGwei) {
    const n = Number(raw.gasGwei);
    if (Number.isNaN(n) || n < 0) throw new Error("gasGwei must be a non-negative number");
    gasGwei = n;
    }

    return {
      mode: "simulate",
      tokenIn: raw.tokenIn,
      tokenOut: raw.tokenOut,
      routers,
      tradeSize,
      slippageBps,
      gasGwei,
    };
  }

  if (raw.mode === "optimize") {
    if (!raw.tokenIn) throw new Error("tokenIn is required");
    if (!raw.tokenOut) throw new Error("tokenOut is required");
    if (!raw.minSize) throw new Error("minSize is required");
    if (!raw.maxSize) throw new Error("maxSize is required");
    if (!raw.stepSize) throw new Error("stepSize is required");
    if (!raw.curve) raw.curve = "false";

    const minSize = Number(raw.minSize);
    const maxSize = Number(raw.maxSize);
    const stepSize = Number(raw.stepSize);
    const curve = raw.curve === "true";

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
        const n = Number(v.trim());
        if (Number.isNaN(n) || n < 0) {
          throw new Error("slippageBps must be non-negative numbers");
        }
        return n;
      });
    }

    if (raw.gasGwei) {
      gasGwei = raw.gasGwei.split(",").map((v) => {
        const n = Number(v.trim());
        if (Number.isNaN(n) || n < 0) {
          throw new Error("gasGwei must be non-negative numbers");
        }
        return n;
      });
    }

    const routers = parseRouters(raw);

    return {
      mode: "optimize",
      tokenIn: raw.tokenIn,
      tokenOut: raw.tokenOut,
      routers,
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

function printHelp(): void {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║           DEX Arbitrage Simulator — Help                 ║
╚══════════════════════════════════════════════════════════╝

USAGE
  npx tsx scripts/cli.ts mode=<mode> [args]

MODES
  simulate      Simulate a single trade and print profit
  optimize      Sweep trade sizes and find the optimal entry
  price         Get the current USD price of a token

SHARED ARGUMENTS
  tokenIn       Token you start and end with       e.g. WETH
  tokenOut      Intermediate token                 e.g. DAI
  routers       Two routers, comma-separated       e.g. UNISWAP,SUSHISWAP

AVAILABLE TOKENS
  WETH, USDC, DAI, USDT (or any raw address)

AVAILABLE ROUTERS
  UNISWAP, SUSHISWAP

──────────────────────────────────────────────────────────

MODE: simulate
  Required: tokenIn, tokenOut, routers, tradeSize

  npx tsx scripts/cli.ts \\
    mode=simulate tokenIn=WETH tokenOut=USDC \\
    routers="UNISWAP,SUSHISWAP" tradeSize=1

──────────────────────────────────────────────────────────

MODE: optimize
  Required: tokenIn, tokenOut, routers, minSize, maxSize, stepSize
  Optional: slippageBps, gasGwei, curve

  npx tsx scripts/cli.ts \\
    mode=optimize tokenIn=WETH tokenOut=USDC \\
    routers="UNISWAP,SUSHISWAP" \\
    minSize=1 maxSize=10 stepSize=1 \\
    slippageBps="10,30" gasGwei="20,50" curve=true

  slippageBps   Comma-separated scenario values    e.g. 10,30,50
  gasGwei       Comma-separated scenario values    e.g. 20,50,100
  curve         Print ASCII profit curve           e.g. curve=true

──────────────────────────────────────────────────────────

MODE: price
  Required: token

  npx tsx scripts/cli.ts mode=price token=WETH

══════════════════════════════════════════════════════════
`);
}