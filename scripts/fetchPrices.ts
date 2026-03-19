import { ethers } from "ethers";
import { getProvider } from "../services/providerServices.js";
import { ERC20_ABI, ROUTER_ABI } from "../config/abi.js";
import { tokenDecimals } from "../services/tokenServices.js";
import { WETH } from "../config/tokens.js";
import { getValueInUSD } from "../services/conversionServices.js";


const provider = await getProvider();

const whaleAddress = "0x06920c9fc643de77b99cb7670a944ad31eaaa260";

type profitType = {
  raw: bigint;
  profitInUSD: bigint;
};

function applySlippage(amount: bigint, slippageBps?: number): bigint {
  if (!slippageBps || slippageBps <= 0) return amount;

  const factor = 10_000n - BigInt(slippageBps);
  return (amount * factor) / 10_000n;
}

export async function simulateTrade(
  tradeSize: number,
  tokenIn: string, // selling token
  tokenOut: string, // buying token
  routerBuyingAdd: string,
  routerSellingAdd: string,
  slippageBps?: number,
  gasGwei?: number
): Promise<profitType> {
  // this function will take into account slippage and fees to calculate realistic profit
  console.log(
    `flow is: buy tokenOut with tokenIn, then sell tokenOut for tokenIn`
  );

  // ------------------ IMPERSONATE ------------------
  // Using a whale account so that simulation does not fail due to insufficient balance
  await provider.send("hardhat_impersonateAccount", [whaleAddress]);

  const whaleSigner = await provider.getSigner(whaleAddress);

  // Give ETH for gas so transactions don’t revert during estimation
  await provider.send("hardhat_setBalance", [
    whaleAddress,
    "0x1000000000000000000", // ~18 ETH
  ]);

  // ------------------ READ CONTRACTS ------------------
  const routerBuying = new ethers.Contract(
    routerBuyingAdd,
    ROUTER_ABI,
    provider
  );


  // ------------------ WRITE CONTRACTS ------------------
  // signer is required for simulating real execution (gas estimation, approvals, etc.)
  const routerBuyingWithSigner = routerBuying.connect(whaleSigner) as any;

  const tokenInContract = new ethers.Contract(
    tokenIn,
    ERC20_ABI,
    whaleSigner
  );

  const tokenOutContract = new ethers.Contract(
    tokenOut,
    ERC20_ABI,
    whaleSigner
  );

  // ------------------ DECIMALS ------------------
  const tokenInDecimals = await tokenDecimals(tokenIn);
  const tokenOutDecimals = await tokenDecimals(tokenOut);

  const amountIn = ethers.parseUnits(tradeSize.toString(), tokenInDecimals);

  // ------------------ APPROVALS ------------------
  // approvals are required otherwise gas estimation / swaps will revert
  const allowanceIn = await tokenInContract.allowance(whaleAddress, routerBuyingAdd);

  if (allowanceIn < amountIn) {
  await tokenInContract.approve(routerBuyingAdd, ethers.MaxUint256);
  }

  await tokenOutContract.approve(routerSellingAdd, ethers.MaxUint256);

  // ------------------ BUY LEG (READ) ------------------
  const amountsOut = await routerBuying.getAmountsOut(amountIn, [
    tokenIn,
    tokenOut,
  ]);
  
  const prevAmountOut = amountsOut[1]; // amount of tokenOut received
  const amountOut = applySlippage(prevAmountOut, slippageBps);

  console.log(
    `Buying ${ethers.formatUnits(
      amountOut,
      tokenOutDecimals
    )} of tokenOut with ${tradeSize} of tokenIn`
  );

  // amountOut is the input for the selling router
  // ------------------ SELL LEG (READ) ------------------
  
  const routerSelling = new ethers.Contract(
    routerSellingAdd,
    ROUTER_ABI,
    provider
  );

  const routerSellingWithSigner = routerSelling.connect(whaleSigner) as any;

  const amountsOutSelling = await routerSelling.getAmountsOut(amountOut, [
    tokenOut,
    tokenIn,
  ]);

  const quotedFinalAmountOut = amountsOutSelling[1]; // final amount of tokenIn received after selling
  const finalAmountOut = applySlippage(
    quotedFinalAmountOut,
    slippageBps
  );

  // making sure to factor in trading fees and slippage for a more accurate profit calculation
  // i basically know the amount i would be buying and then i would calculate the output amount based on that.
  // calculations would be done using the getAmountOut formula from Uniswap and SushiSwap

  // -------------Estimate gas fees ---------------

  const fallbackGasValue = 180000n;

  let gasBuy: bigint;
  let gasSell: bigint;

  const deadline = Math.floor(Date.now() / 1000) + 600;

  const buyTx =
    await routerBuyingWithSigner.swapExactTokensForTokens.populateTransaction(
      amountIn,
      0,
      [tokenIn, tokenOut],
      whaleAddress,
      deadline
    );

  const sellTx =
    await routerSellingWithSigner.swapExactTokensForTokens.populateTransaction(
      amountOut,
      0,
      [tokenOut, tokenIn],
      whaleAddress,
      deadline
    );

  try {
    gasBuy = await provider.estimateGas({
      ...buyTx,
      from: whaleAddress,
    });
  } catch (error: any) {
    console.warn("⚠️ Gas estimation failed for BUY leg:", error.message);
    gasBuy = fallbackGasValue;
  }

  try {
    gasSell = await provider.estimateGas({
      ...sellTx,
      from: whaleAddress,
    });
  } catch (error: any) {
    console.warn("⚠️ Gas estimation failed for SELL leg:", error.message);
    gasSell = fallbackGasValue;
  }

  const totalGas = gasBuy + gasSell;

  let gasPrice: bigint;

  if (gasGwei !== undefined) {
    gasPrice = ethers.parseUnits(gasGwei.toString(), "gwei");
  } else {
    const feeData = await provider.getFeeData();
    gasPrice =
      feeData.gasPrice ??
      feeData.maxFeePerGas ??
      ethers.parseUnits("20", "gwei");
  }

  const totalGasCostWei = totalGas * gasPrice;

  // ------------------ GAS → TOKEN ------------------
  const ethToTokenIn = await routerBuying.getAmountsOut(
    ethers.parseEther("1"),
    [WETH, tokenIn]
  );

  const tokenInPerEth = ethToTokenIn[1];

  const gasCostTokenIn =
    (totalGasCostWei * tokenInPerEth) / ethers.parseEther("1");

  // ------------------ PROFIT ------------------
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