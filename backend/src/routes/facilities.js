import { Router } from "express";
import { listFacilities, getFacilitySlots } from "../controllers/facilityController.js";

const router = Router();
router.get("/", listFacilities);
router.get("/:id/slots", getFacilitySlots);
export default router;
