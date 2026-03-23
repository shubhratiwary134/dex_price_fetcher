import { ethers } from "ethers";
import { getProvider } from "../services/providerServices.js";
import { ERC20_ABI, ROUTER_ABI } from "../config/abi.js";
import { tokenDecimals } from "../services/tokenServices.js";
import { WETH } from "../config/tokens.js";
import { getValueInUSD } from "../services/conversionServices.js";
import { TradeQuotes } from "../type/analysisTypes.js";

const provider = await getProvider();

const whaleAddress = ethers.getAddress("0x06920C9fC643De77B99cB7670A944AD31eaAA260");

type profitType = {
  raw: bigint;
  profitInUSD: bigint;
};

function applySlippage(amount: bigint, slippageBps?: number): bigint {
  if (!slippageBps || slippageBps <= 0) return amount;
  const factor = 10_000n - BigInt(slippageBps);
  return (amount * factor) / 10_000n;
}

const KNOWN_BALANCE_SLOTS: Record<string, number> = {
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": 3,  // WETH
  "0x6B175474E89094C44Da98b954EedeAC495271d0F": 2,  // DAI
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": 9,  // USDC
  "0xdAC17F958D2ee523a2206206994597C13D831ec7": 2,  // USDT
  "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": 0,  // WBTC
};

async function forgeTokenBalance(
  tokenAddress: string,
  ownerAddress: string,
  amount: bigint
): Promise<void> {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const checksummed = ethers.getAddress(tokenAddress);
  const knownSlot = KNOWN_BALANCE_SLOTS[checksummed];

  if (knownSlot !== undefined) {
    const storageKey = ethers.solidityPackedKeccak256(
      ["uint256", "uint256"],
      [ownerAddress, knownSlot]
    );
    await provider.send("hardhat_setStorageAt", [
      tokenAddress,
      storageKey,
      ethers.zeroPadValue(ethers.toBeHex(amount), 32),
    ]);
    return;
  }

  // Fallback scan for unknown tokens
  for (let slot = 0; slot < 100; slot++) {
    for (const layout of ["A", "B"]) {
      const storageKey =
        layout === "A"
          ? ethers.solidityPackedKeccak256(
              ["uint256", "uint256"],
              [ownerAddress, slot]
            )
          : ethers.solidityPackedKeccak256(
              ["uint256", "uint256"],
              [slot, ownerAddress]
            );

      const original = await provider.getStorage(tokenAddress, storageKey);

      await provider.send("hardhat_setStorageAt", [
        tokenAddress,
        storageKey,
        ethers.zeroPadValue(ethers.toBeHex(amount), 32),
      ]);

      const actual = await token.balanceOf(ownerAddress);
      if (actual === amount) return;

      await provider.send("hardhat_setStorageAt", [
        tokenAddress,
        storageKey,
        original,
      ]);
    }
  }

  throw new Error(
    `Could not forge balance for token ${tokenAddress} — add it to KNOWN_BALANCE_SLOTS`
  );
}

// ------------------ FETCH QUOTES ------------------
// Does all chain calls once per trade size, returns raw data
// slippage and gas are NOT applied here — that happens in computeProfit
export async function fetchQuotes(
  tradeSize: number,
  tokenIn: string,
  tokenOut: string,
  routerBuyingAdd: string,
  routerSellingAdd: string,
): Promise<TradeQuotes> {

  // ------------------ IMPERSONATE ------------------
  await provider.send("hardhat_impersonateAccount", [whaleAddress]);
  const whaleSigner = new ethers.JsonRpcSigner(provider, whaleAddress);
  await provider.send("hardhat_setBalance", [whaleAddress, "0x1000000000000000000"]);

  // ------------------ CONTRACTS ------------------
  const routerBuying = new ethers.Contract(routerBuyingAdd, ROUTER_ABI, provider);
  const routerSelling = new ethers.Contract(routerSellingAdd, ROUTER_ABI, provider);
  const routerBuyingWithSigner = routerBuying.connect(whaleSigner) as any;
  const routerSellingWithSigner = routerSelling.connect(whaleSigner) as any;
  const tokenInContract = new ethers.Contract(tokenIn, ERC20_ABI, whaleSigner);
  const tokenOutContract = new ethers.Contract(tokenOut, ERC20_ABI, whaleSigner);

  // ------------------ DECIMALS ------------------
  const tokenInDecimals = await tokenDecimals(tokenIn);
  const tokenOutDecimals = await tokenDecimals(tokenOut);
  const amountIn = ethers.parseUnits(tradeSize.toString(), tokenInDecimals);

  // ------------------ FORGE BALANCES ------------------
  await forgeTokenBalance(tokenIn, whaleAddress, amountIn * 2n);

  // ------------------ APPROVALS ------------------
  const allowanceIn = await tokenInContract.allowance(whaleAddress, routerBuyingAdd);
  if (allowanceIn < amountIn) {
    await tokenInContract.approve(routerBuyingAdd, ethers.MaxUint256);
  }
  await tokenOutContract.approve(routerSellingAdd, ethers.MaxUint256);

  // ------------------ BUY LEG QUOTE ------------------
  const buyAmountsOut = await routerBuying.getAmountsOut(amountIn, [tokenIn, tokenOut]);
  const rawAmountOut: bigint = buyAmountsOut[1];

  // Forge tokenOut so sell leg gas estimation doesn't revert
  await forgeTokenBalance(tokenOut, whaleAddress, rawAmountOut * 2n);

  // ------------------ SELL LEG QUOTE ------------------
  // Input is rawAmountOut — what actually lands in wallet after buy
  const sellAmountsOut = await routerSelling.getAmountsOut(rawAmountOut, [tokenOut, tokenIn]);
  const rawFinalAmountOut: bigint = sellAmountsOut[1];

  // ------------------ GAS ESTIMATION ------------------
  const fallbackGasValue = 180_000n;
  const deadline = Math.floor(Date.now() / 1000) + 600;

  const [buyTx, sellTx] = await Promise.all([
    routerBuyingWithSigner.swapExactTokensForTokens.populateTransaction(
      amountIn, 0, [tokenIn, tokenOut], whaleAddress, deadline
    ),
    routerSellingWithSigner.swapExactTokensForTokens.populateTransaction(
      rawAmountOut, 0, [tokenOut, tokenIn], whaleAddress, deadline
    ),
  ]);

  const estimateOrFallback = async (tx: any, label: string): Promise<bigint> => {
    try {
      return await provider.estimateGas({ ...tx, from: whaleAddress });
    } catch (e: any) {
      console.warn(`Gas estimation failed for ${label}:`, e.message);
      return fallbackGasValue;
    }
  };

  const [gasBuy, gasSell] = await Promise.all([
    estimateOrFallback(buyTx, "BUY"),
    estimateOrFallback(sellTx, "SELL"),
  ]);

  const gasUnits = gasBuy + gasSell;

  // ------------------ GAS CONVERSION RATE ------------------
  // How much tokenIn is 1 ETH worth — used later to convert gas cost to tokenIn units
  let tokenInPerEth: bigint;
  if (tokenIn.toLowerCase() === WETH.toLowerCase()) {
    tokenInPerEth = ethers.parseEther("1"); // already WETH, 1:1
  } else {
    const ethToTokenIn = await routerBuying.getAmountsOut(
      ethers.parseEther("1"),
      [WETH, tokenIn]
    );
    tokenInPerEth = ethToTokenIn[1];
  }

  const priceTokenInUSD = await getValueInUSD(tokenIn);

  return {
    rawAmountOut,
    rawFinalAmountOut,
    gasUnits,
    tokenInPerEth,
    tokenInDecimals,
    tokenOutDecimals,
    amountIn,
    priceTokenInUSD: priceTokenInUSD!,
  };
}

// ------------------ COMPUTE PROFIT ------------------
// Pure function — no RPC calls, just math on top of quotes
// This is what runs for every slippage/gasGwei combo
export function computeProfit(
  quotes: TradeQuotes,
  slippageBps?: number,
  gasGwei?: number,
  feeData?: { gasPrice: bigint | null; maxFeePerGas: bigint | null }
): profitType {

  // Apply slippage to buy output (scenario modeling)
  const amountOut = applySlippage(quotes.rawAmountOut, slippageBps);

  // Scale sell output proportionally to slipped buy input, then apply slippage again
  const scaledFinalAmountOut =
    (quotes.rawFinalAmountOut * amountOut) / quotes.rawAmountOut;
  const finalAmountOut = applySlippage(scaledFinalAmountOut, slippageBps);

  // Gas price — use provided gwei or fall back to live fee data
  const gasPrice =
    gasGwei !== undefined
      ? ethers.parseUnits(gasGwei.toString(), "gwei")
      : (feeData?.gasPrice ?? feeData?.maxFeePerGas ?? ethers.parseUnits("20", "gwei"));

  const totalGasCostWei = quotes.gasUnits * gasPrice;

  // Convert gas cost from ETH → tokenIn units
  const gasCostTokenIn =
    (totalGasCostWei * quotes.tokenInPerEth) / ethers.parseEther("1");

  // Net profit in tokenIn units
  const netProfit = finalAmountOut - quotes.amountIn - gasCostTokenIn;

  // Convert to USD
  const netProfitInUSD =
    (netProfit * quotes.priceTokenInUSD.raw) /
    ethers.parseUnits("1", quotes.tokenInDecimals);

  return {
    raw: netProfit,
    profitInUSD: netProfitInUSD,
  };
}

// ------------------ SIMULATE TRADE ------------------
// Thin wrapper used by simulate mode and the direction probe in optimize mode
export async function simulateTrade(
  tradeSize: number,
  tokenIn: string,
  tokenOut: string,
  routerBuyingAdd: string,
  routerSellingAdd: string,
  slippageBps?: number,
  gasGwei?: number
): Promise<profitType> {
  const quotes = await fetchQuotes(
    tradeSize,
    tokenIn,
    tokenOut,
    routerBuyingAdd,
    routerSellingAdd
  );

  const feeData = await provider.getFeeData();

  const result = computeProfit(quotes, slippageBps, gasGwei, {
    gasPrice: feeData.gasPrice,
    maxFeePerGas: feeData.maxFeePerGas,
  });

  console.log("Profit:", ethers.formatUnits(result.raw, quotes.tokenInDecimals));
  console.log(
    "Profit in USD:",
    ethers.formatUnits(result.profitInUSD, quotes.priceTokenInUSD.decimals)
  );

  return result;
}