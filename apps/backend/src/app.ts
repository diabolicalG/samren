import cors from "cors";
import express from "express";
import helmet from "helmet";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? "http://localhost:3000", credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/v1/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: "samren-api",
    timestamp: new Date().toISOString(),
  });
});

app.use((_request, response) => {
  response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
});