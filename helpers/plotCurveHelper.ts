import Chartscii from "chartscii";
import { ChartColor, ChartTheme } from "../type/cliTypes.js";

export function plotCurveHelper({
  plottingData,
  theme,
  color,
}: {
  plottingData: { size: number; profitUSD: number }[];
  theme?: ChartTheme;
  color?: ChartColor;
}) {
  const chartPoints = plottingData.map((p) => ({
    label: String(p.size),
    value: p.profitUSD,
  }));

  const options = {
    title: "Profit Curve",
    width: 80,
    height: 20,
    theme: theme || "pastel",
    color: color || "pink",
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
