import type { Express } from "express";
import express from "express";
import type { Server } from "http";
import path from "path";
import fs from "fs";

export async function setupVite(app: Express, server: Server) {
  // Import Vite only in dev
  const { createServer: createViteServer } = await import("vite");

  // Inline a minimal dev config. Do NOT import ../../vite.config to avoid bundling @vitejs/plugin-react.
  const vite = await createViteServer({
    configFile: false,
    server: { middlewareMode: true, hmr: { server }, allowedHosts: true as const },
    appType: "custom",
    root: path.resolve(import.meta.dirname, "..", "..", "client"),
  });

  app.use(vite.middlewares);

  app.use(async (req, res, next) => {
    try {
      const url = req.originalUrl;
      const clientIndex = path.resolve(import.meta.dirname, "..", "..", "client", "index.html");
      if (!fs.existsSync(clientIndex)) return next();
      const html = await vite.transformIndexHtml(url, fs.readFileSync(clientIndex, "utf-8"));
      res.status(200).setHeader("Content-Type", "text/html").end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use((_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
