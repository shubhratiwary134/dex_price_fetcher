export function plotCurveHelper({
  plottingData,
}: {
  plottingData: { size: number; profitUSD: number }[];
}) {
  const chartHeight = 20;
  const barWidth = 7;
  const minVal = Math.min(...plottingData.map((p) => p.profitUSD));
  const maxVal = Math.max(...plottingData.map((p) => p.profitUSD));
  const range = maxVal - minVal || 1;

  console.log("\n  Profit Curve\n");

  // Draw rows from top to bottom
  for (let row = chartHeight; row >= 0; row--) {
    const rowValue = minVal + (row / chartHeight) * range;

    // Y-axis label every 5 rows
    const yLabel = row % 5 === 0
      ? `$${rowValue.toFixed(0)}`.padStart(12)
      : " ".repeat(12);

    let line = `${yLabel} │`;

    for (const point of plottingData) {
      const barHeight = Math.round(
        ((point.profitUSD - minVal) / range) * chartHeight
      );
      const filled = row <= barHeight;
      line += filled
        ? " ███ ".padEnd(barWidth)
        : " ".repeat(barWidth);
    }

    console.log(line);
  }

  // X-axis line
  const axisWidth = plottingData.length * barWidth + 1;
  console.log(`${"─".repeat(12)}─┴${"─".repeat(axisWidth)}`);

  // Trade size labels
  let sizeRow = " ".repeat(13) + "│";
  for (const point of plottingData) {
    sizeRow += String(point.size).padStart(Math.floor(barWidth / 2) + 1).padEnd(barWidth);
  }
  console.log(sizeRow);

}