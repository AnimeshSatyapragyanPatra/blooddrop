import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import {
  documentConfig,
  listDocumentsForReview,
  reviewDocument,
  viewDocumentFile,
} from "../controllers/documentController.js";

const router = Router();
router.get("/config", documentConfig);
export default router;

// Reviewing is a moderator job: it decides what blood a patient is matched with.
export const reviewRouter = Router();
reviewRouter.use(requireRole("admin"));
reviewRouter.get("/", listDocumentsForReview);
reviewRouter.get("/:id/file", viewDocumentFile);
reviewRouter.post("/:id/review", reviewDocument);
