export function calculateProfit(price1: number, price2: number): number {
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
