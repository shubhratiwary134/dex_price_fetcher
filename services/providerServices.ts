import assert from "assert";
import { ethers, JsonRpcProvider } from "ethers";
import { config } from "hardhat";

/* 
This code extracts the live RPC URL from your configuration and connects your script directly to that external node (like Alchemy or Infura). 
Because it talks directly to the live network, you cannot manipulate the environment. You cannot impersonate accounts or spoof token balances.
This is why your gas estimations fail or revert to fallback values when your live public address does not have the required funds or approvals.
*/

// export const getProvider = async (): Promise<ethers.JsonRpcProvider> => {
//   const hardhatConfig = config.networks.hardhat;

//   // 1. Narrow the type: Assert that this is the local simulated network
//   // In Hardhat v3, the local network type is "edr-simulated"
//   assert(
//     hardhatConfig.type === "edr-simulated",
//     "The 'hardhat' network is not defined or is not an 'edr-simulated' type"
//   );

//   // 2. Access 'forking' (TypeScript now knows it exists on this type)
//   const forkingConfig = hardhatConfig.forking;

//   if (!forkingConfig?.url) {
//     throw new Error("Forking is not configured in your hardhat.config.ts");
//   }

//   // 3. Retrieve the URL (handling both static strings and Config Variables)
//   // Hardhat v3 config variables (like those from secrets) use .getUrl()
//   const MAINNET_RPC_URL =
//     typeof forkingConfig.url === "object" && "getUrl" in forkingConfig.url
//       ? await forkingConfig.url.getUrl()
//       : forkingConfig.url;

//   const provider = new ethers.JsonRpcProvider(MAINNET_RPC_URL);

//   return provider;
// };

/* 
  This code connects the script to a local simulated blockchain running directly on your computer at port 8545. When you start this local node, 
  it automatically pulls the live state from the mainnet behind the scenes. Because your script is now talking to your own local simulation rather than the live network,
  you have absolute control.You can impersonate whale accounts, grant unlimited token approvals, and run perfect execution simulations without spending real money.
*/

export const getProvider = async (): Promise<ethers.JsonRpcProvider> => {
  const localNodeUrl = "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(localNodeUrl);
  
  return provider;
};