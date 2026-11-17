import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { catalogRouter } from "./catalog/catalog.routes.js";
import { authRouter } from "./auth/auth.routes.js";
import { authenticateSession } from "./auth/session.js";
import { adminCatalogRouter } from "./catalog/admin.routes.js";
import { adminMediaRouter } from "./media/admin.routes.js";
import { mediaRouter } from "./media/media.routes.js";
import { anivexaRouter } from "./anivexa/router.js";

export const app = express();
app.set("trust proxy", env.TRUST_PROXY_HOPS);
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdn.dashjs.org"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "https:"],
      mediaSrc: ["'self'", "blob:", "https:"],
      workerSrc: ["'self'", "blob:"],
    },
  },
}));
app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((value) => value.trim()), credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(authenticateSession);

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/admin/catalog", adminCatalogRouter);
app.use("/api/v1/admin/catalog", adminMediaRouter);
app.use("/api/v1/catalog", catalogRouter);
app.use("/api/v1/media", mediaRouter);
app.use("/api/v1/anivexa", anivexaRouter);

app.get("/api/v1/health", (_request, response) => {
  response.status(200).json({ data: { status: "ok", service: "samren-api", timestamp: new Date().toISOString() }, error: null });
});

app.use((_request, response) => {
  response.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Route not found" } });
});
