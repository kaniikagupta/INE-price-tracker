const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        status: "OK",
        service: "INE Product Price Tracker API",
        database: db.name || "unknown",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
