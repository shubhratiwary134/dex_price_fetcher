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
  // this function would be a helper to fetch the reserves of the pair and calculate the price
  return 13;
}

async function main() {
  // here we will call the getPriceForPool function with the factory address
}
