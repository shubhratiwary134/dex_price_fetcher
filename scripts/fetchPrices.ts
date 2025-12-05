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

async function getPriceForPool(factoryAdd: string): Promise<number> {
  console.log("starting the price fetch for the pool...");
  const factory = new ethers.Contract(factoryAdd, FACTORY_ABI, provider);

  const pairAddress = await factory.getPair(WETH, DAI);
  if (pairAddress === ethers.ZeroAddress) {
    throw new Error("Pair does not exist");
  }
  console.log(`Found pair at address: ${pairAddress}`);

  const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);

  const token0 = await pair.token0();
  const token1 = await pair.token1();
  // this function would be a helper to fetch the reserves of the pair and calculate the price
  return 13;
}

// -----------Helper-----------
function getLexOrder(address1: string, address2: string): [string, string] {
  // this function is used to return the token0 and token1 in lexicographical order
  // this prevent the onchain calls and redundant if-else blocks to figure out the token0 and token1
  return ["fugasi1", "fugasi2"];
}

async function main() {
  // here we will call the getPriceForPool function with the factory address
}
