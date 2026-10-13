import { Router } from "express";
import { me } from "../controllers/authController.js";
import { getMyDonorProfile, upsertMyDonorProfile, setPaused } from "../controllers/donorController.js";
import { listMyReports, requestVerification } from "../controllers/reportController.js";
import { listMyAppointments } from "../controllers/appointmentController.js";
import { submitDocument, listMyDocuments } from "../controllers/documentController.js";

const router = Router();
router.get("/", me);
router.get("/donor", getMyDonorProfile);
router.put("/donor", upsertMyDonorProfile);
router.patch("/donor/paused", setPaused);
router.get("/appointments", listMyAppointments);
router.get("/documents", listMyDocuments);
router.post("/documents", submitDocument);
router.get("/reports", listMyReports);
router.post("/verification", requestVerification);
export default router;
