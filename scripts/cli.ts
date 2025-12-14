function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (const arg of args) {
    if (!arg.includes("=")) continue;
    const [key, value] = arg.split("=");
    parsed[key] = value;
  }

  return parsed;
}
