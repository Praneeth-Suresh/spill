import "dotenv/config";
import express from "express";
import http from "http";
import net from "net";
import path from "path";
import fs from "fs";
import https from "https"; 
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function isInContainer() {
  try {
    return (
      fs.existsSync("/.dockerenv") ||
      (fs.existsSync("/proc/1/cgroup") &&
        fs.readFileSync("/proc/1/cgroup", "utf8").includes("docker"))
    );
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.status(200).json({ 
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    });
  });

  let server;
  if (
    process.env.RAILWAY_STATIC_URL ||
    process.env.RAILWAY_ENVIRONMENT
  ) {
    server = http.createServer(app);
    console.log("Running on Railway: using HTTP server (Railway provides HTTPS)");
  } else if (isInContainer()) {
    server = http.createServer(app);
    console.log("Running in container: using HTTP server (no HTTPS certs available)");
  } else if (process.env.NODE_ENV === "production") {
    const options = {
      key: fs.readFileSync("server.key"),
      cert: fs.readFileSync("server.cert"),
    };
    server = https.createServer(options, app);
    console.log("Running in production: using HTTPS server");
  } else {
    const options = {
      key: fs.readFileSync("server.key"),
      cert: fs.readFileSync("server.cert"),
    };
    server = https.createServer(options, app);
    console.log("Running in development: using HTTPS server");
  }

  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite"); // dynamic import only in dev
    await setupVite(app, server);
  } else {
    const { serveStatic } = await import("./static"); // ensures no vite.ts is loaded in prod
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
