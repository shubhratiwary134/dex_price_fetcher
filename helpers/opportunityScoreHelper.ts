import { worldSummary } from "../type/analysisTypes.js";

// generates a score to judge a given opportunity based on various parameters
export function generateOpportunityScore(
  worldSummaries: worldSummary[]
): number {
  const total = worldSummaries.length;
  const viable = worldSummaries.filter((w) => w.isViable).length;

  const viableScore = viable / total;

  return viableScore;
}
