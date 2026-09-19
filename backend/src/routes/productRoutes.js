const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");

// Product search in mock store catalog
router.get("/search", productController.search);

// Track product
router.post("/track", productController.track);

// List tracked products
router.get("/tracked", productController.getAllTracked);

// Product details by ID
router.get("/:id", productController.getById);

// Price & stock history
router.get("/:id/history", productController.getHistory);

// Scrape logs for product
router.get("/:id/logs", productController.getLogs);

// Configure scrape frequency
router.patch("/:id/frequency", productController.updateFrequency);

// Stop tracking / delete product
router.delete("/:id", productController.deleteTracked);

// Trigger manual live scrape
router.post("/:id/scrape", productController.scrapeNow);

module.exports = router;
