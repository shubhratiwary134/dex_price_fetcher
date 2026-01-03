import Chartscii from "chartscii";

export function plotCurveHelper({
  plottingData,
}: {
  plottingData: { size: number; profitUSD: number }[];
}) {
  const chartPoints = plottingData.map((p) => ({
    label: String(p.size),
    value: p.profitUSD,
  }));

  const options = {
    title: "Profit Curve",
    width: 80,
    height: 20,
    theme: "pastel",
    color: "pink",
    // show labels if you want them
    colorLabels: true,
    valueLabels: true,
    valueLabelsPrefix: "$",
  };

  // Create an instance of Chartscii
  const chart = new Chartscii(chartPoints, options);

  // Generate and print the ASCII chart
  console.log(chart.create());
}
