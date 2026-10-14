// Loads .env for CLI scripts (Next.js does this automatically for the app).
import { existsSync, readFileSync } from "node:fs";

export function loadDotEnv(path = ".env") {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    const [, key, raw] = m;
    if (process.env[key!] !== undefined) continue;
    process.env[key!] = raw!.replace(/^["']|["']$/g, "");
  }
}

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq?.split("=").slice(1).join("=");
}

export function flag(name: string) {
  return process.argv.includes(`--${name}`);
}
