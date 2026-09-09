import { Router } from "express";
import { searchDonors } from "../controllers/donorController.js";

const router = Router();
router.get("/search", searchDonors);
export default router;
