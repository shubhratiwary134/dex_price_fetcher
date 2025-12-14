// ABIs
export const FACTORY_ABI = [
  "function getPair(address, address) external view returns (address)",
];

export const PAIR_ABI = [
  "function getReserves() view returns (uint112,uint112,uint32)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
];

export const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

export const ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
];

export const PRICE_FEED_ABI = [
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
  "function version() view returns (uint256)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
];
