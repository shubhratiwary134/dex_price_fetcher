import { ethers } from "ethers";
import { ERC20_ABI } from "../config/abi.js";
import { getProvider } from "./providerServices.js";

const provider = await getProvider();

export async function tokenDecimals(tokenAddress: string): Promise<number> {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const decimals = await tokenContract.decimals();
  return decimals;
}
