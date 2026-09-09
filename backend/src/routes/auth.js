import { Router } from "express";
import { register, mockLogin } from "../controllers/authController.js";

const router = Router();
router.post("/register", register);
router.post("/mock-login", mockLogin);
export default router;
