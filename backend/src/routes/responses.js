import { Router } from "express";
import { confirmOutcome } from "../controllers/responseController.js";

const router = Router();
router.post("/:responseId/outcome", confirmOutcome);
export default router;
