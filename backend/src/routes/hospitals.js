import { Router } from "express";
import { nearbyHospitals } from "../controllers/hospitalController.js";

const router = Router();
router.get("/nearby", nearbyHospitals);
export default router;
