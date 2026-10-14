// Bundles the CLI scripts (create-admin, seed-demo, remove-demo, run-jobs) into
// plain JavaScript so they run in the production Docker image without tsx.
import { build } from "esbuild";

await build({
  entryPoints: ["scripts/create-admin.ts", "scripts/seed-demo.ts", "scripts/remove-demo.ts", "scripts/run-jobs.ts"],
  outdir: "dist-scripts",
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  tsconfig: "tsconfig.json",
  // Only packages present in the standalone runtime image stay external.
  external: ["@prisma/client", ".prisma/client"],
  alias: { "server-only": "./scripts/empty.js", "next/cache": "./scripts/next-cache-stub.js" },
  logLevel: "info",
});
