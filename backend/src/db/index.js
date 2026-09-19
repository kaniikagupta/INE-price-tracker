const supabaseRepository = require("./supabaseRepository");
const testSqliteRepository = require("./testSqliteRepository");
const env = require("../config/env");
const logger = require("../utils/logger");

const isTest = process.env.NODE_ENV === "test";
let activeRepo = null;

if (isTest) {
    activeRepo = testSqliteRepository;
} else if (supabaseRepository.isConfigured()) {
    activeRepo = supabaseRepository;
    logger.info(`Database: Using Supabase PostgreSQL repository (${env.SUPABASE_URL})`);
} else {
    logger.warn(
        "\n===================================================================\n" +
        " [SUPABASE POSTGRESQL REQUIRED FOR PRODUCTION]\n" +
        " SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured in .env.\n" +
        " Please run database/schema.sql in your Supabase SQL Editor and set:\n" +
        "   SUPABASE_URL=https://<your-project>.supabase.co\n" +
        "   SUPABASE_SERVICE_ROLE_KEY=<your-secret-key>\n" +
        " in backend/.env for persistent cloud PostgreSQL storage.\n" +
        " Operating in isolated local development mode for now.\n" +
        "===================================================================\n"
    );
    activeRepo = testSqliteRepository;
}

module.exports = activeRepo;
