const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const healthRoutes = require("./routes/healthRoutes");
const productRoutes = require("./routes/productRoutes");
const scraperRoutes = require("./routes/scraperRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// CORS configuration
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, cron-job.org)
        if (!origin) return callback(null, true);
        if (origin === env.FRONTEND_URL || origin.includes("localhost") || origin.includes("127.0.0.1") || origin.includes("vercel.app")) {
            return callback(null, true);
        }
        return callback(null, true); // Permissive in dev/intern project
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-cron-secret"]
}));

app.use(express.json());

// Routes
app.use("/api", healthRoutes);
app.use("/api/products", productRoutes);
app.use("/api/scraper", scraperRoutes);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
