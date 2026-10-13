import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { createFacility, verifyFacility } from "../controllers/facilityController.js";
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
router.post("/facilities", createFacility);
router.post("/facilities/:id/verify", verifyFacility);
router.get("/verifications", listVerifications);
router.post("/verifications/:id/review", reviewVerification);

export default router;
