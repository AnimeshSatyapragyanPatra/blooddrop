import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import {
  listReports,
  resolveReport,
  listVerifications,
  reviewVerification,
  overview,
} from "../controllers/adminController.js";

const router = Router();
router.use(requireRole("admin"));

router.get("/overview", overview);
router.get("/reports", listReports);
router.post("/reports/:id/resolve", resolveReport);
router.get("/verifications", listVerifications);
router.post("/verifications/:id/review", reviewVerification);

export default router;
