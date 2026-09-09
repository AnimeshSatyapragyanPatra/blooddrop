import "dotenv/config";
import cors from "cors";
import express from "express";
import { requireAuth } from "./middleware/auth.js";
import { MOCK } from "./lib/supabase.js";
import { BLOOD_GROUPS } from "./lib/blood.js";
import { MIN_DONATION_GAP_DAYS } from "./lib/eligibility.js";
import authRoutes from "./routes/auth.js";
import meRoutes from "./routes/me.js";
import donorRoutes from "./routes/donors.js";
import requestRoutes from "./routes/requests.js";
import responseRoutes from "./routes/responses.js";
import notificationRoutes from "./routes/notifications.js";
import reportRoutes from "./routes/reports.js";
import adminRoutes from "./routes/admin.js";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mock: MOCK });
});

// Domain constants the UI needs before anyone signs in.
app.get("/api/config", (_req, res) => {
  res.json({
    bloodGroups: BLOOD_GROUPS,
    donationGapDays: MIN_DONATION_GAP_DAYS,
    mock: MOCK,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/me", requireAuth, meRoutes);
app.use("/api/donors", requireAuth, donorRoutes);
app.use("/api/requests", requireAuth, requestRoutes);
app.use("/api/responses", requireAuth, responseRoutes);
app.use("/api/notifications", requireAuth, notificationRoutes);
app.use("/api/reports", requireAuth, reportRoutes);
app.use("/api/admin", requireAuth, adminRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

export default app;
