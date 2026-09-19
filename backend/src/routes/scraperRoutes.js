const express = require("express");
const router = express.Router();
const scraperController = require("../controllers/scraperController");
const cronAuth = require("../middleware/cronAuth");

// Protected scheduled scraper trigger (called by cron-job.org every 2 hours)
router.post("/run", cronAuth, scraperController.runScheduledScrape);

module.exports = router;
