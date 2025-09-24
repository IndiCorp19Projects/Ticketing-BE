import express from "express";
import { getItems, createItem, updateItem, deleteItem } from "../controllers/itemController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getItems);
router.post("/", protect, createItem);
router.put("/:id", protect, updateItem);
router.delete("/:id", protect, deleteItem);

export default router;
