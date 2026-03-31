import { Router, Request, Response } from "express";
import { fetchFearGreedIndex, fetchFearGreedHistory } from "../services/fearGreedService.js";

const router = Router();

// ─── Fear & Greed Index ──────────────────────────────────────────
router.get("/fear-greed", async (_req: Request, res: Response) => {
  try {
    const data = await fetchFearGreedIndex();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch Fear & Greed Index" });
  }
});

router.get("/fear-greed/history", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const history = await fetchFearGreedHistory(days);
    res.json({ history, days });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// ─── Keeper Stats ────────────────────────────────────────────────
// NOTE: The keeper instance is managed by the main server process.
// These routes provide read-only stats.
let keeperStatsGetter: (() => any) | null = null;

export function setKeeperStatsProvider(getter: () => any) {
  keeperStatsGetter = getter;
}

router.get("/keeper/stats", (_req: Request, res: Response) => {
  if (!keeperStatsGetter) {
    res.json({ status: "not_running", message: "Keeper not initialized" });
    return;
  }
  res.json({ status: "running", ...keeperStatsGetter() });
});

export default router;
