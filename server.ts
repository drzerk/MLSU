import express from "express";
import path from "path";

const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

async function startServer(): Promise<void> {
  const app = express();
  const isProduction = process.env.NODE_ENV === "production";

  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "MLSU (Multi-Layer Secure Unlock) API & Interactive Simulator",
      version: "1.0.0",
      mode: isProduction ? "production" : "development",
    });
  });

  app.get("/api/info", (_req, res) => {
    res.json({
      name: "MLSU",
      description:
        "Research-grade reference model and interactive explorer for PIN-selected profiles. Not an Android ROM and not a device you can flash.",
      demoPins: {
        private: "471903",
        duress: "220561",
      },
      docs: [
        "README.md",
        "docs/p0-anforderungen.md",
        "reference/README.md",
      ],
    });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: HOST,
        port: PORT,
        allowedHosts: true,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist", "client");
    app.use(express.static(distPath, { index: false, maxAge: "1h" }));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`MLSU server running on http://${HOST}:${PORT} (${isProduction ? "production" : "development"})`);
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  console.error("Failed to start MLSU server:", err);
  process.exit(1);
});
