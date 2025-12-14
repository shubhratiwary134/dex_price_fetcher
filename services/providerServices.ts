import assert from "assert";
import { ethers, JsonRpcProvider } from "ethers";
import { config } from "hardhat";

export const getProvider = async (): Promise<ethers.JsonRpcProvider> => {
  const hardhatConfig = config.networks.hardhat;

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

  return provider;
};
