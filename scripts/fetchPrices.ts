import { ethers } from "ethers";

const provider = "";

// -----------TOKEN ADDRESSES -----------
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

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

  const reserve0 = Number(r0) / 10 ** dec0;
  const reserve1 = Number(r1) / 10 ** dec1;

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
  const profit = price2 - price1;
  return profit;
}

async function main() {
  // here we will call the getPriceForPool function with the factory address
  const uniPrice = await getPriceForPool(UNISWAP_V2_FACTORY, WETH, DAI, WETH);
  console.log(`Uniswap V2 WETH/DAI Price: ${uniPrice} DAI per WETH`);
  const sushiPrice = await getPriceForPool(SUSHISWAP_FACTORY, WETH, DAI, WETH);
  console.log(`SushiSwap WETH/DAI Price: ${sushiPrice} DAI per WETH`);

  const profit = calculateProfit(uniPrice, sushiPrice);

  if (profit == 0) {
    console.log("No arbitrage opportunity detected.");
  } else {
    console.log(
      `Arbitrage opportunity detected! Potential profit: ${profit} DAI per WETH`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
