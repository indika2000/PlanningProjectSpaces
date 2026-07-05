import express from "express";
import { JsonStore } from "./store.js";
import { createRoutes } from "./routes.js";

/** Build the express app around a store (separated for tests). */
export function createApp(store: JsonStore): express.Express {
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
  return app;
}
