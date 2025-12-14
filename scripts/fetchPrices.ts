import { ethers } from "ethers";

import { DAI, WETH } from "../config/tokens.js";
import { SUSHISWAP_FACTORY, UNISWAP_V2_FACTORY } from "../config/factories.js";
import { ERC20_ABI, FACTORY_ABI, PAIR_ABI, ROUTER_ABI } from "../config/abi.js";
import { tokenDecimals } from "../services/tokenServices.js";
import { getProvider } from "../services/providerServices.js";
import { getValueInUSD } from "../helpers/conversionHelpers.js";
import { calculateProfit } from "../helpers/profitHelpers.js";

const walletAddress = process.env.PUBLIC_WALLET_ADDRESS;

const provider = await getProvider();

// -----------Core Functions-----------
async function getPriceForPool(
  factoryAdd: string,
  tokenA: string,
  tokenB: string,
  BaseTokenForPrice: string
): Promise<number> {
  // this function would be a helper to fetch the reserves of the pair and calculate the price
  console.log("starting the price fetch for the pool...");
  const factory = new ethers.Contract(factoryAdd, FACTORY_ABI, provider);

  const pairAddress = await factory.getPair(tokenA, tokenB);
  if (pairAddress === ethers.ZeroAddress) {
    throw new Error("Pair does not exist");
  }
  console.log(`Found pair at address: ${pairAddress}`);

  const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);

  const token0 = await pair.token0();
  const token1 = await pair.token1();
  const [r0, r1] = await pair.getReserves();

  // decimals fetch for accurate price calculation
  const token0Contract = new ethers.Contract(token0, ERC20_ABI, provider);
  const token1Contract = new ethers.Contract(token1, ERC20_ABI, provider);
  const dec0 = await token0Contract.decimals();
  const dec1 = await token1Contract.decimals();

  const reserve0 = parseFloat(ethers.formatUnits(r0, dec0));
  const reserve1 = parseFloat(ethers.formatUnits(r1, dec1));

  if (token0.toLowerCase() === BaseTokenForPrice.toLowerCase()) {
    //  this means token0 is WETH and token1 is DAI
    const price = reserve1 / reserve0;
    return price; // DAI per WETH
  } else {
    const price = reserve0 / reserve1;
    return price; // DAI per WETH
  }
}

// -----------Helper-----------

async function simulateTrade(
  tradeSize: number,
  tokenIn: string, // selling token
  tokenOut: string, // buying token
  routerBuyingAdd: string,
  routerSellingAdd: string
) {
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

  return netProfit;

  // using the getAmountOut formula to calculate the output amount for tradeSize
}

async function main() {
  // here we will call the getPriceForPool function with the factory address
  const uniPrice = await getPriceForPool(UNISWAP_V2_FACTORY, WETH, DAI, WETH);
  console.log(`Uniswap V2 WETH/DAI Price: ${uniPrice} DAI per WETH`);
  const sushiPrice = await getPriceForPool(SUSHISWAP_FACTORY, WETH, DAI, WETH);
  console.log(`SushiSwap WETH/DAI Price: ${sushiPrice} DAI per WETH`);

  const profit = calculateProfit(uniPrice, sushiPrice);

  console.log(`Potential Arbitrage Profit per WETH: ${profit} DAI`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
