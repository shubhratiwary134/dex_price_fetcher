import { ethers } from "ethers";
import { config } from "hardhat";
import assert from "node:assert";
import { CHAINLINK_FEED_MAP } from "../config/feed.js";

const hardhatConfig = config.networks.hardhat;

const walletAddress = process.env.PUBLIC_WALLET_ADDRESS;

// 1. Narrow the type: Assert that this is the local simulated network
// In Hardhat v3, the local network type is "edr-simulated"
assert(
  hardhatConfig.type === "edr-simulated",
  "The 'hardhat' network is not defined or is not an 'edr-simulated' type"
);

// 2. Access 'forking' (TypeScript now knows it exists on this type)
const forkingConfig = hardhatConfig.forking;

if (!forkingConfig?.url) {
  throw new Error("Forking is not configured in your hardhat.config.ts");
}

// 3. Retrieve the URL (handling both static strings and Config Variables)
// Hardhat v3 config variables (like those from secrets) use .getUrl()
const MAINNET_RPC_URL =
  typeof forkingConfig.url === "object" && "getUrl" in forkingConfig.url
    ? await forkingConfig.url.getUrl()
    : forkingConfig.url;

const provider = new ethers.JsonRpcProvider(MAINNET_RPC_URL);

// -----------TOKEN ADDRESSES -----------
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
// ------------ROUTER ADDRESSES ------------
const UNISWAP_ROUTER = "0x7a250d5630B4c539739dF2C5dAcb4c659F2488D";
const SUSHI_ROUTER = "0xd9e1CE17f2641F24aE83637AB66a2CCA9C378B9F";

// -----------FACTORY ADDRESSES -----------
const UNISWAP_V2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const SUSHISWAP_FACTORY = "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac";

// ABIs
const FACTORY_ABI = [
  "function getPair(address, address) external view returns (address)",
];

const PAIR_ABI = [
  "function getReserves() view returns (uint112,uint112,uint32)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
];

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

const ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
];

export const PRICE_FEED_ABI = [
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
  "function version() view returns (uint256)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
];

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
function calculateProfit(price1: number, price2: number): number {
  const profit = Math.abs(price2 - price1);
  if (price2 > price1) {
    console.log(
      `buy on exchange 1 at price ${price1} and sell on exchange 2 on price ${price2}`
    );
  } else {
    console.log(
      `buy on exchange 2 at price ${price2} and sell on exchange 1 on price ${price1}`
    );
  }
  return profit;
}

async function getValueInUSD(tokenIn: string): Promise<number | null> {
  // Design note -- i will first try the chainLink price feed method and if not available i will fallback to using DEX prices.

  try {
    const chainlinkFeedAddress = CHAINLINK_FEED_MAP[tokenIn.toLowerCase()];
    if (chainlinkFeedAddress) {
      const feedContract = new ethers.Contract(
        chainlinkFeedAddress,
        PRICE_FEED_ABI,
        provider
      );
      const decimals = await feedContract.decimals();
      const latest = await feedContract.latestRoundData();
      const answer = latest.answer;

      const usdPrice = Number(ethers.formatUnits(answer, decimals));
      return usdPrice;
    }
  } catch (error) {
    console.log("Chainlink price feed fetch failed, trying DEX price...");
  }

  // Fallback to DEX prices
  try {
    const router = new ethers.Contract(UNISWAP_ROUTER, ROUTER_ABI, provider);
    const tokenInDecimals = await tokenDecimals(tokenIn);

    const amountsOut = await router.getAmountsOut(
      ethers.parseUnits("1", tokenInDecimals),
      [tokenIn, USDC]
    );
    const amountOut = amountsOut[1]; // amount of USD received
    const usdDecimals = await tokenDecimals(USDC);

    const usdPrice = Number(ethers.formatUnits(amountOut, usdDecimals));
    return usdPrice;
  } catch (error) {
    console.log("DEX-derived USD price unavailable.");
  }

  return null; // placeholder
}

async function calculateProfitWithGivenTradeSize(
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

  const gasBuy = await provider.estimateGas({
    ...buyTx,
    from: walletAddress,
  });
  const gasSell = await provider.estimateGas({
    ...sellTx,
    from: walletAddress,
  });
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

  const netProfit = finalAmountOut - amountIn - gasCostTokenIn;
  // assuming the tokenA is the selling token
  // tradeSize is in tokenA units
  console.log("Profit:", ethers.formatUnits(netProfit, tokenInDecimals));
  return netProfit;

  // using the getAmountOut formula to calculate the output amount for tradeSize
}

async function findPerfectTradeSize() {
  // this function will iterate over different trade sizes to find the optimal one
}

async function tokenDecimals(tokenAddress: string): Promise<number> {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const decimals = await tokenContract.decimals();
  return decimals;
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
