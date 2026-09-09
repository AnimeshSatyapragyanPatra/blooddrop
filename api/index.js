// Vercel serverless entry point.
// Reuses the same Express app the local backend runs (backend/src/app.js).
// vercel.json rewrites every /api/* request here. This file must stay at the
// repo root under api/ — that is where Vercel looks for serverless functions.
import app from "../backend/src/app.js";

export default app;
