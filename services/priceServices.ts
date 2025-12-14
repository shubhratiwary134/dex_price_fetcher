import { ethers } from "ethers";
import { ERC20_ABI, FACTORY_ABI, PAIR_ABI } from "../config/abi.js";
import { getProvider } from "./providerServices.js";

const provider = await getProvider();

export async function getPriceForPool(
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
