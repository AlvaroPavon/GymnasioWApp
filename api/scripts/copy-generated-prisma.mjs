import { cp, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(__dirname, "..");
const source = resolve(apiRoot, "src/generated/prisma");
const destination = resolve(apiRoot, "dist/src/generated/prisma");

await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true });
