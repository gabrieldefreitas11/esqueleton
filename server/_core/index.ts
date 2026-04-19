import "dotenv/config";
import compression from "compression";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

import { registerAuthRoutes } from "./oauth";
import { registerWebhookRoutes } from "../webhookHandler";
import { appRouter, processAbandonedCarts } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(compression());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Vary", "Cookie");
    }
    next();
  });

  registerAuthRoutes(app);
  registerWebhookRoutes(app);

  // Cron: abandoned-cart emails. Proteger com `x-cron-secret` ou `?secret=...`.
  app.all("/api/cron/abandoned-carts", async (req, res) => {
    const expected = ENV.cronSecret;
    if (!expected) {
      return res.status(503).json({ error: "CRON_SECRET não configurado" });
    }
    const provided =
      (req.headers["x-cron-secret"] as string | undefined) ||
      (typeof req.query.secret === "string" ? req.query.secret : undefined);
    if (provided !== expected) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const result = await processAbandonedCarts();
      return res.json(result);
    } catch (error) {
      console.error("[Cron] abandoned-carts failed", error);
      return res.status(500).json({ error: (error as Error).message });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  const distIndexPath = path.resolve(
    import.meta.dirname,
    "../..",
    "dist",
    "public",
    "index.html"
  );
  const hasBuiltAssets = fs.existsSync(distIndexPath);

  if (!hasBuiltAssets) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
