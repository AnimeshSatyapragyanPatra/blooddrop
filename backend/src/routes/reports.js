import { Router } from "express";
import { createReport } from "../controllers/reportController.js";

const router = Router();
router.post("/", createReport);
export default router;
