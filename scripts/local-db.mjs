// Local development database without Neon or Docker.
//
// Starts one PGlite (Postgres compiled to WebAssembly) server on 127.0.0.1,
// stored in .data/pglite, then runs the given command with DATABASE_URL
// pointing at it. Only this process opens the data folder, so Next.js's
// several dev workers can all connect safely over the Postgres protocol.
//
// Usage: node scripts/local-db.mjs <command> [args...]
//   e.g. node scripts/local-db.mjs next dev

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const DATA_DIR = ".data/pglite";
const PORT = Number(process.env.LOCAL_DB_PORT ?? 5433);

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: node scripts/local-db.mjs <command> [args...]");
  process.exit(1);
}

mkdirSync(DATA_DIR, { recursive: true });
const db = await PGlite.create(DATA_DIR, { extensions: { btree_gist } });
const server = new PGLiteSocketServer({
  db,
  host: "127.0.0.1",
  port: PORT,
  maxConnections: 20,
});

try {
  await server.start();
} catch (error) {
  console.error(
    `[local-db] Could not listen on 127.0.0.1:${PORT}. Set LOCAL_DB_PORT to another port.`,
  );
  console.error(error);
  await db.close();
  process.exit(1);
}

const url = `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`;
console.info(`[local-db] Local Postgres (PGlite) ready at ${url}`);

const child = spawn(command, args, {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});

let stopping = false;
async function stop(code) {
  if (stopping) return;
  stopping = true;
  await server.stop().catch(() => {});
  await db.close().catch(() => {});
  process.exit(code);
}

child.on("exit", (code, signal) => stop(code ?? (signal ? 1 : 0)));
child.on("error", (error) => {
  console.error(`[local-db] Failed to start "${command}":`, error.message);
  stop(1);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
