import { ethers } from "ethers";
import { CHAINLINK_FEED_MAP } from "../config/feed.js";
import { PRICE_FEED_ABI, ROUTER_ABI } from "../config/abi.js";
import { tokenDecimals } from "../services/tokenServices.js";
import { UNISWAP_ROUTER } from "../config/routers.js";
import { USDC } from "../config/tokens.js";
import { getProvider } from "../services/providerServices.js";

const provider = await getProvider();

export async function getValueInUSD(tokenIn: string): Promise<{
  raw: bigint;
  decimals: number;
  formatted: string;
} | null> {
  // Design note -- i will first try the chainLink price feed method and if not available i will fallback to using DEX prices.

  try {
    const chainlinkFeedAddress = CHAINLINK_FEED_MAP[tokenIn.toLowerCase()];
    if (chainlinkFeedAddress) {
      const feedContract = new ethers.Contract(
        chainlinkFeedAddress,
        PRICE_FEED_ABI,
        provider
      );
      const latest = await feedContract.latestRoundData();
      const raw = latest.answer;

      const decimals: number = await feedContract.decimals();
      const formatted = ethers.formatUnits(raw, decimals);
      return { raw, decimals, formatted };
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
    const raw = amountsOut[1]; // amount of USD received
    const decimals = 6; // USDC has 6 decimals

    const formatted = ethers.formatUnits(raw, decimals);
    return { raw, decimals, formatted };
  } catch (error) {
    console.log("DEX-derived USD price unavailable.");
  }

  return null; // placeholder
}
