import path from "node:path";
import { JsonStore } from "./store.js";
import { createApp } from "./app.js";

const PORT = Number(process.env.GCB_BACKEND_PORT ?? 8788);
const DATA_DIR = process.env.GCB_DATA_DIR ?? path.resolve("data");

async function main() {
  const store = new JsonStore(DATA_DIR);
  await store.init();
  const app = createApp(store);
  app.listen(PORT, () => {
    console.log(`GCB backend listening on http://localhost:${PORT} (data: ${DATA_DIR})`);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
