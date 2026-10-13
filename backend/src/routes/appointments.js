import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import {
  cancelAppointment,
  confirmAppointment,
  listFacilityAppointments,
} from "../controllers/appointmentController.js";

const router = Router();
router.post("/:id/cancel", cancelAppointment);
router.post("/:id/confirm", confirmAppointment);
export default router;

export const facilityRouter = Router();
facilityRouter.use(requireRole("facility", "admin"));
facilityRouter.get("/appointments", listFacilityAppointments);
