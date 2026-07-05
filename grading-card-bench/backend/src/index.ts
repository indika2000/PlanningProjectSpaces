import express from "express";
import path from "node:path";
import { JsonStore } from "./store.js";
import { createRoutes } from "./routes.js";

const PORT = Number(process.env.GCB_BACKEND_PORT ?? 8788);
const DATA_DIR = process.env.GCB_DATA_DIR ?? path.resolve("data");

async function main() {
  const store = new JsonStore(DATA_DIR);
  await store.init();

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    next();
  });
  app.options("*", (_req, res) => res.sendStatus(204));

  app.get("/health", (_req, res) => res.json({ ok: true, service: "gcb-backend" }));
  app.use(createRoutes(store));

  app.listen(PORT, () => {
    console.log(`GCB backend listening on http://localhost:${PORT} (data: ${DATA_DIR})`);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
