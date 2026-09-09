import { Router } from "express";
import {
  createRequest,
  listMyRequests,
  listNearbyRequests,
  getRequest,
  dispatchRequest,
  previewMatches,
  closeRequest,
} from "../controllers/requestController.js";
import { respond } from "../controllers/responseController.js";
import { revealContact, relayMessage } from "../controllers/contactController.js";

const router = Router();

// Static paths first — otherwise "/mine" would be read as an :id.
router.get("/mine", listMyRequests);
router.get("/nearby", listNearbyRequests);
router.get("/preview-matches", previewMatches);

router.post("/", createRequest);
router.get("/:id", getRequest);
router.post("/:id/dispatch", dispatchRequest);
router.post("/:id/respond", respond);
router.post("/:id/close", closeRequest);
router.get("/:id/contact", revealContact);
router.post("/:id/relay", relayMessage);

export default router;
