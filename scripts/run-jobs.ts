/** Runs background jobs once (for external cron schedulers): npm run jobs:run */
import { loadDotEnv } from "./lib/env";
loadDotEnv();

import { prisma } from "../src/server/db";
import { runJobs } from "../src/server/jobs";

runJobs()
  .then((r) => console.log(JSON.stringify(r)))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
