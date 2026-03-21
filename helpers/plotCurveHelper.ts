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
  const allNegative = plottingData.every((p) => p.profitUSD < 0);
  const minVal = Math.min(...plottingData.map((p) => p.profitUSD));

  // Chartscii can't handle negative values, shift everything up if needed
  const shifted = allNegative ? plottingData.map((p) => ({
    size: p.size,
    profitUSD: p.profitUSD - minVal + 1, // all positive now, shape preserved
  })) : plottingData;

  const chartPoints = shifted.map((p) => ({
    label: `${p.size} ($${plottingData.find(o => o.size === p.size)!.profitUSD.toFixed(2)})`, // show real value in label
    value: p.profitUSD,
  }));

  const options = {
    title: allNegative ? "Profit Curve (all negative — showing relative shape)" : "Profit Curve",
    width: 80,
    height: 20,
    theme: theme || "pastel",
    color: color || "pink",
    colorLabels: true,
    valueLabels: true,
    valueLabelsPrefix: "$",
  };

  const chart = new Chartscii(chartPoints, options);
  console.log(chart.create());
}
