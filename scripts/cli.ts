import { cliArgs } from "../type/cliTypes.js";

function parseArgs(): cliArgs {
  const args = process.argv.slice(2);
  const parsed: cliArgs = {};

  for (const arg of args) {
    if (!arg.includes("=")) continue;
    const [key, value] = arg.split("=");
    parsed[key as keyof cliArgs] = value;
  }

  return parsed;
}
