import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createServer } from "http";
import { config } from "../config/index.js";
import { initializeIndexer } from "./services/eventIndexer.js";
import { initWebSocket } from "./services/wsService.js";
import apiRoutes from "./routes/api.js";
import keeperRoutes, { setKeeperStatsProvider } from "./routes/keeper.js";

const app = express();
const server = createServer(app);

// ─── Middleware ───────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(morgan("dev"));
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────────
app.use("/api", apiRoutes);
app.use("/api", keeperRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ─── Error Handler ───────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start Server ────────────────────────────────────────────────
server.listen(config.port, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║     ZKTrader Backend API                  ║
  ║     Port: ${config.port}                          ║
  ║     Env:  ${config.nodeEnv}                  ║
  ║     Chain: ${config.chainId}                         ║
  ║     WebSocket: ws://localhost:${config.port}/ws     ║
  ╚═══════════════════════════════════════════╝
  `);

  // Initialize blockchain event indexer
  initializeIndexer();

  // Initialize WebSocket server for real-time updates
  initWebSocket(server);
});

export default app;
