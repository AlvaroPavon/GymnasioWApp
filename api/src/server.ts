import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { prisma } from "./db/prisma.js";
import { startCronJobs } from "./jobs/scheduler.js";
import { realtimeHub } from "./services/realtime.service.js";

const app = createApp();
let stopCronJobs: (() => void) | undefined;

await prisma.$connect();

if (env.CRON_ENABLED) {
  stopCronJobs = startCronJobs();
}

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`GimnasioWapp API listening on ${env.HOST}:${env.PORT}`);
});
realtimeHub.attach(server);

async function shutdown() {
  stopCronJobs?.();
  realtimeHub.close();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
