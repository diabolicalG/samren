import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { catalogRouter } from "./catalog/catalog.routes.js";

export const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((value) => value.trim()), credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.use("/api/v1/catalog", catalogRouter);

app.get("/api/v1/health", (_request, response) => {
  response.status(200).json({ data: { status: "ok", service: "samren-api", timestamp: new Date().toISOString() }, error: null });
});

app.use((_request, response) => {
  response.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Route not found" } });
});
