import { ethers } from "ethers";

import { DAI, WETH } from "../config/tokens.js";
import { SUSHISWAP_FACTORY, UNISWAP_V2_FACTORY } from "../config/factories.js";
import { ROUTER_ABI } from "../config/abi.js";
import { tokenDecimals } from "../services/tokenServices.js";
import { getProvider } from "../services/providerServices.js";
import { calculateProfit } from "../helpers/profitHelpers.js";
import { getValueInUSD } from "../services/conversionServices.js";
import { getPriceForPool } from "../services/priceServices.js";

const walletAddress = process.env.PUBLIC_WALLET_ADDRESS;

const provider = await getProvider();

type profitType = {
  raw: bigint;
  profitInUSD: bigint;
};

export async function simulateTrade(
  tradeSize: number,
  tokenIn: string, // selling token
  tokenOut: string, // buying token
  routerBuyingAdd: string,
  routerSellingAdd: string
): Promise<profitType> {
  // this function will take into account slippage and fees to calculate realistic profit
  console.log(
    `flow is: buy tokenOut with tokenIn, then sell tokenOut for tokenIn`
  );
  const routerBuying = new ethers.Contract(
    routerBuyingAdd,
    ROUTER_ABI,
    provider
  );
  const tokenInDecimals = await tokenDecimals(tokenIn);
  const tokenOutDecimals = await tokenDecimals(tokenOut);

  const amountIn = ethers.parseUnits(tradeSize.toString(), tokenInDecimals);
  const amountsOut = await routerBuying.getAmountsOut(amountIn, [
    tokenIn,
    tokenOut,
  ]);
  const amountOut = amountsOut[1]; // amount of tokenOut received

  console.log(
    `Buying ${ethers.formatUnits(
      amountOut,
      tokenOutDecimals
    )} of tokenOut with ${tradeSize} of tokenIn`
  );

  // amountOut is the input for the selling router
  const routerSelling = new ethers.Contract(
    routerSellingAdd,
    ROUTER_ABI,
    provider
  );
  const amountsOutSelling = await routerSelling.getAmountsOut(amountOut, [
    tokenOut,
    tokenIn,
  ]);
  const finalAmountOut = amountsOutSelling[1]; // final amount of tokenIn received after selling

  // making sure to factor in trading fees and slippage for a more accurate profit calculation
  // i basically know the amount i would be buying and then i would calculate the output amount based on that.
  // calculations would be done using the getAmountOut formula from Uniswap and SushiSwap

  // -------------Estimate gas fees ---------------

  const fallbackGasValue = 180000n;

  let gasBuy: bigint;
  let gasSell: bigint;

  const deadline = Math.floor(Date.now() / 1000) + 600;

  const buyTx = await routerBuying.swapExactTokensForTokens.populateTransaction(
    amountIn,
    0,
    [tokenIn, tokenOut],
    walletAddress,
    deadline
  );

  const sellTx =
    await routerSelling.swapExactTokensForTokens.populateTransaction(
      amountOut,
      0,
      [tokenOut, tokenIn],
      walletAddress,
      deadline
    );

  try {
    gasBuy = await provider.estimateGas({
      ...buyTx,
      from: walletAddress,
    });
  } catch (error: any) {
    console.warn("⚠️ Gas estimation failed for BUY leg:", error.message);
    gasBuy = fallbackGasValue;
  }

  try {
    gasSell = await provider.estimateGas({
      ...sellTx,
      from: walletAddress,
    });
  } catch (error: any) {
    console.warn("⚠️ Gas estimation failed for SELL leg:", error.message);
    gasSell = fallbackGasValue;
  }

  const totalGas = gasBuy + gasSell;

  const feeData = await provider.getFeeData();
  const gasPrice =
    feeData.gasPrice ?? feeData.maxFeePerGas ?? ethers.parseUnits("20", "gwei"); // fallback

  const totalGasCostWei = totalGas * gasPrice;

  const ethToTokenIn = await routerBuying.getAmountsOut(
    ethers.parseEther("1"),
    [WETH, tokenIn]
  );
  const tokenInPerEth = ethToTokenIn[1];

  const gasCostTokenIn =
    (totalGasCostWei * tokenInPerEth) / ethers.parseUnits("1", 18);

  const netProfit = finalAmountOut - amountIn - gasCostTokenIn; // in terms of tokenIn units
  // assuming the tokenA is the selling token
  // tradeSize is in tokenA units
  console.log("Profit:", ethers.formatUnits(netProfit, tokenInDecimals));

  const priceTokenInUSD = await getValueInUSD(tokenIn);

  const netProfitInUSD =
    (netProfit * priceTokenInUSD!.raw) /
    ethers.parseUnits("1", tokenInDecimals);

  console.log(
    "Profit in USD:",
    ethers.formatUnits(netProfitInUSD, priceTokenInUSD!.decimals)
  );

  return {
    raw: netProfit,
    profitInUSD: netProfitInUSD,
  };

  // using the getAmountOut formula to calculate the output amount for tradeSize
}
