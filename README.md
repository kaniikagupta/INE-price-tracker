# INE Product Price Tracker

An autonomous, full-stack price and availability tracking system built for INE's hosted mock store ([demo.inelabteamdev.com](https://demo.inelabteamdev.com/)). The application automates browser interaction using Playwright to bypass client-side anti-bot verification, reveal dynamic prices, track stock status, record historical trends, detect price drops, and execute scheduled scrapes via an external cron service.

---

## Overview

The INE mock store conceals live selling prices behind an interactive **"REVEAL PRICE"** button that enforces mouse movement and dwell verification. This project solves that engineering challenge with a resilient Playwright scraper, an Express backend with honest attempt logging and dual-mode database support (Supabase PostgreSQL + local SQLite fallback), and a modern React dashboard.

---

## Features

### Core Features
- **Partial & Full Product Search**: Instant search across all ~1,000 mock store products by name, brand, or SKU without spinning up slow browser instances.
- **Product Tracking**: Track single or multiple products with automatic initial scraping and duplicate prevention.
- **Dynamic Price Reveal Scraper**: Simulates natural mouse movements and dwell times to activate the reveal button, dismisses cookie consent overlays, and extracts live selling prices and stock quantities.
- **Anti-Obfuscation Parsing**: Ignores decoy hidden DOM elements (`aria-hidden="true"`, `display: none`), strikethrough MRP tags, and discount badges.
- **Multi-Format Price Normalization**: Seamlessly normalizes standard Indian formats (`₹21,470`), European notation (`₹12.079,00`), spaced numbers (`₹ 12 079`), full-width Unicode numerals (`\uFF10-\uFF19`), and trailing tax text.
- **Stock Quantity & Status Extraction**: Distinguishes between `IN STOCK` (extracting available units e.g. `50 LEFT`, `62 in stock`) and `OUT OF STOCK`.
- **Invalid Data Protection**: Strict validation prevents any zero, negative, `NaN`, or empty data from entering the database. Failures preserve existing valid data.
- **Honest Scrape Logs**: Every scrape attempt is recorded with its duration, attempt number, and status (`SUCCESS`, `RETRY`, `FAILED`, `STRUCTURE_CHANGED`).
- **Price & Stock History**: Chronological records visualized via an interactive line chart and tabular history.
- **Headed Scraper Demonstration Mode**: Visibly runs Chromium with `--fail-test` support to demonstrate retry logic and backoff during screen recordings.
- **Scheduled 2-Hour Scraping**: Endpoint `POST /api/scraper/run` secured by `x-cron-secret` with fault isolation (one product failure never stops others).

### Bonus Features
- **Bonus 1 — Multi-Product Dashboard**: Aggregated dashboard displaying metrics, price change indicators, and stock badges.
- **Bonus 2 — Price Drop Detection**: Automatically detects when the latest valid price drops below the previous price, displaying a price drop amount and percentage badge (e.g. `↓ ₹3,530 (-14%)`).
- **Bonus 3 — Back-in-Stock Detection**: Highlights when a product transitions from `OUT OF STOCK` to `IN STOCK` with a dynamic alert pill.
- **Bonus 4 — Page Structure Change Detection**: Classifies missing structural elements as `STRUCTURE_CHANGED` and logs actionable alerts.
- **Bonus 5 — Configurable Scrape Frequency**: Supports custom frequencies (1h, 2h default, 6h, 12h, 24h) persisted per product.
- **Bonus 6 — GitHub Actions CI/CD**: Automated workflow (`.github/workflows/ci.yml`) validating tests and building the frontend.

---

## Architecture

```
                    React Frontend (Vercel)
                               |
                               | REST API (JSON)
                               ↓
                   Express Backend (Render)
                               |
            ┌──────────────────┼──────────────────┐
            ↓                  ↓                  ↓
    Database Layer      Scraper Service       API Logic
(Supabase PostgreSQL      (Playwright)     (Search, Tracking,
  / SQLite Fallback)   (Mouse Dwell & DOM)   History, & Logs)
                               ↑
                               | every 2 hours
                               | (x-cron-secret)
                        cron-job.org
```

---

## Tech Stack

- **Frontend**: React 19, Vite, Vanilla CSS (Design Tokens, Dark Glassmorphism, Responsive Grid)
- **Backend**: Node.js (v24), Express 5, CORS, Dotenv
- **Scraping**: Playwright Chromium
- **Database**: Supabase PostgreSQL (Production) / `node:sqlite` (Zero-config local fallback & testing)
- **External Scheduler**: cron-job.org
- **CI/CD**: GitHub Actions

---

## Project Structure

```
INE-price-tracker/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment & constants
│   │   ├── controllers/     # Route controllers
│   │   ├── db/              # Dual-mode DB adapter (Supabase / SQLite)
│   │   ├── middleware/      # Cron authentication & error handler
│   │   ├── routes/          # Express API routes
│   │   ├── scraper/         # Playwright scraper, parser, & retry handler
│   │   ├── services/        # Catalog, tracking, price history, & logs
│   │   ├── utils/           # Logger
│   │   ├── app.js           # Express app setup
│   │   └── server.js        # Server listener (0.0.0.0:PORT)
│   ├── scripts/
│   │   └── headed-scrape.js # Visible browser demo with --fail-test
│   ├── tests/
│   │   └── all.test.js      # 33 comprehensive unit/integration tests
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/             # REST API client
│   │   ├── components/      # Chart, tables, modals, cards, navbar
│   │   ├── pages/           # Dashboard page
│   │   ├── App.jsx          # Root layout
│   │   ├── index.css        # Modern design system
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── .env.example
│   └── package.json
│
├── database/
│   └── schema.sql           # Production Supabase PostgreSQL schema
│
├── .github/
│   └── workflows/
│       └── ci.yml           # GitHub Actions CI workflow
│
├── README.md
├── DESIGN.md
└── .gitignore
```

---

## Database Schema

Located at [`database/schema.sql`](file:///c:/Users/kanik/OneDrive/Desktop/INE-price%20-tracker/database/schema.sql):

### 1. `tracked_products`
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `product_name` | TEXT | Product title |
| `product_url` | TEXT UNIQUE | Target mock store URL |
| `product_sku` | TEXT | Product SKU |
| `brand` | TEXT | Brand name |
| `category` | TEXT | Category name |
| `is_active` | BOOLEAN | Tracking status (default: TRUE) |
| `scrape_frequency_minutes` | INTEGER | Interval (default: 120) |
| `last_scraped_at` | TIMESTAMPTZ | Last scrape timestamp |
| `next_scrape_at` | TIMESTAMPTZ | Next scheduled scrape |
| `last_price` | NUMERIC(12,2) | Last valid selling price |
| `last_stock_status` | TEXT | `IN STOCK` / `OUT OF STOCK` |
| `last_stock_quantity` | INTEGER | Units available |

### 2. `price_history`
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `tracked_product_id` | UUID (FK) | References `tracked_products(id)` ON DELETE CASCADE |
| `price` | NUMERIC(12,2) | Verified price (> 0) |
| `stock_status` | TEXT | Stock status |
| `stock_quantity` | INTEGER | Units remaining |
| `scraped_at` | TIMESTAMPTZ | Timestamp of scrape |

### 3. `scrape_logs`
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `tracked_product_id` | UUID (FK) | References `tracked_products(id)` ON DELETE CASCADE |
| `attempt_number` | INTEGER | Attempt number (1 to 3) |
| `status` | TEXT | `SUCCESS`, `RETRY`, `FAILED`, `STRUCTURE_CHANGED` |
| `message` | TEXT | Honest error or extraction summary |
| `duration_ms` | INTEGER | Attempt execution time |
| `created_at` | TIMESTAMPTZ | Log creation time |

---

## Environment Variables

### Backend (`backend/.env`):
```env
PORT=5000
FRONTEND_URL=http://localhost:5173
CRON_SECRET=your_secure_cron_secret

# Supabase PostgreSQL (Required for Production Database)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key

# Scraper Settings
SCRAPER_HEADLESS=true
MAX_ATTEMPTS=3
PAGE_TIMEOUT=30000
ELEMENT_TIMEOUT=10000
DEFAULT_SCRAPE_FREQUENCY_MINUTES=120
```

### Frontend (`frontend/.env`):
```env
VITE_API_URL=http://localhost:5000/api
```

---

## Database Setup (Supabase PostgreSQL)

1. Create a free project at [supabase.com](https://supabase.com/).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Paste and run the complete schema script from [`database/schema.sql`](file:///c:/Users/kanik/OneDrive/Desktop/INE-price%20-tracker/database/schema.sql). This automatically creates:
   - `tracked_products` table with foreign key cascades and scheduling indexes.
   - `price_history` table with price constraints (`CHECK (price > 0)`).
   - `scrape_logs` table with status constraints (`CHECK (status IN ('SUCCESS', 'RETRY', 'FAILED', 'STRUCTURE_CHANGED'))`).
   - Trigger `set_tracked_products_updated_at` for automatic timestamp updates.
4. In Supabase **Project Settings → API**, copy:
   - **Project URL** -> `SUPABASE_URL`
   - **service_role secret** -> `SUPABASE_SERVICE_ROLE_KEY`
5. Place these values into `backend/.env`.

---

## Local Setup

### Prerequisites
- Node.js >= 20 (Node 24 recommended)
- npm

### 1. Install Dependencies
```bash
# Backend
cd backend
npm install
npx playwright install chromium

# Frontend
cd ../frontend
npm install
```

---

## Running Locally

### Start Backend
```bash
cd backend
npm run dev
```
Backend runs at `http://localhost:5000`. Health check: `http://localhost:5000/api/health`.

### Start Frontend
```bash
cd frontend
npm run dev
```
Frontend runs at `http://localhost:5173`.

---

## Running Scraper

### Headless Scraper (CLI Test)
```bash
cd backend
npm run scraper
```

### Headed Scraper (Visible Window for Screen Recording)
Visibly opens Chromium, performs mouse movement over the price box, clicks **Reveal Price**, and prints live results:
```bash
cd backend
npm run scraper:headed
```
You can also pass a specific product URL or ID:
```bash
npm run scraper:headed https://demo.inelabteamdev.com/product/12
# Or by ID
npm run scraper:headed 39
```

### Controlled Failure Demonstration
Demonstrates exponential backoff retries and honest attempt logging without modifying the real website:
```bash
cd backend
npm run scraper:headed:fail
```

---

## Testing

Run the comprehensive test suite (42 automated unit and integration tests across 12 suites):
```bash
npm test
```
**Test Coverage Includes**:
- Server health endpoint
- Price normalization (Indian, European, spaced, unicode numerals, decimals, tax suffixes)
- Invalid price rejection (negative, zero, NaN, empty strings)
- Stock status & quantity extraction
- Catalog search deduplication (duplicate URL, duplicate ID, duplicate SKU removal)
- Partial, full, and case-insensitive search
- Product tracking & duplicate prevention (409 Conflict)
- Price history retrieval & chronological ordering
- Price drop detection calculations
- Back-in-stock state transition alerts
- Honest scrape logging (RETRY, SUCCESS, FAILED)
- Retry behavior with exponential backoff
- Preserving valid data on scrape failure
- Supabase repository interface and method contracts
- Cron authentication (`x-cron-secret`)
- Fault isolation across products
- Configurable scrape frequency

---

## Scheduled Scraping & cron-job.org Setup

Because free-tier web services on Render go to sleep after inactivity, an external cron service triggers scraping every 2 hours:

1. Register at [cron-job.org](https://cron-job.org/).
2. Click **Create Cronjob**.
3. **URL**: `https://<your-render-app>.onrender.com/api/scraper/run`
4. **Execution Schedule**: Every 2 hours (e.g. `0 */2 * * *`).
5. **Request Method**: `POST`
6. **Headers**:
   - Key: `x-cron-secret`
   - Value: `<your-CRON_SECRET>`
7. **Save**: cron-job.org will now reliably wake your server and scrape all due tracked products every 2 hours.

---

## Supabase Setup

1. Log in to [Supabase](https://supabase.com/) and create a new project.
2. Open the **SQL Editor** in your Supabase dashboard.
3. Paste and run the contents of [`database/schema.sql`](file:///c:/Users/kanik/OneDrive/Desktop/INE-price%20-tracker/database/schema.sql).
4. Go to **Project Settings** → **API**.
5. Copy your **Project URL**, **anon key**, and **service_role key**.
6. Set them in your backend environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

---

## Render Deployment (Backend)

1. Connect your GitHub repository to [Render](https://render.com/).
2. Create a new **Web Service**.
3. **Root Directory**: `backend`
4. **Environment**: `Node`
5. **Build Command**:
   ```bash
   npm install && npx playwright install --with-deps chromium
   ```
6. **Start Command**:
   ```bash
   npm start
   ```
7. **Environment Variables**:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render sets this automatically)
   - `FRONTEND_URL`: `https://<your-vercel-app>.vercel.app`
   - `CRON_SECRET`: `<your-secure-cron-secret>`
   - `SUPABASE_URL`: `<your-supabase-url>`
   - `SUPABASE_SERVICE_ROLE_KEY`: `<your-supabase-service-key>`

---

## Vercel Deployment (Frontend)

1. Import your GitHub repository to [Vercel](https://vercel.com/).
2. **Framework Preset**: `Vite`
3. **Root Directory**: `frontend`
4. **Build Command**: `npm run build`
5. **Output Directory**: `dist`
6. **Environment Variables**:
   - `VITE_API_URL`: `https://<your-render-backend>.onrender.com/api`
7. Click **Deploy**.

---

---

## Live Deployment

- **Frontend (Vercel):** https://ine-price-tracker-tau.vercel.app
- **Backend (Render):** https://ine-price-tracker-ebrm.onrender.com
- **Scheduled Scraping:** cron-job.org runs the scraper every 2 hours.

## API Documentation

| Method | Endpoint | Description | Headers / Body |
|---|---|---|---|
| `GET` | `/api/health` | Service health status | — |
| `GET` | `/api/products/search?q=` | Search mock store catalog | Query: `q` |
| `POST` | `/api/products/track` | Track a product | Body: `{ product_name, product_url, ... }` |
| `GET` | `/api/products/tracked` | List all tracked products | — |
| `GET` | `/api/products/:id` | Get single product details | — |
| `GET` | `/api/products/:id/history` | Get price & stock history | — |
| `GET` | `/api/products/:id/logs` | Get scrape attempt logs | — |
| `POST` | `/api/products/:id/scrape` | Trigger manual live scrape | — |
| `PATCH` | `/api/products/:id/frequency` | Update scrape interval | Body: `{ frequency_minutes: 120 }` |
| `DELETE` | `/api/products/:id` | Stop tracking / delete | — |
| `POST` | `/api/scraper/run` | Scheduled cron scrape | Header: `x-cron-secret` |

---

## Reliability Strategy

1. **Anti-Bot Hover Simulation**: Replays 14 micro-pointer movements across the price block followed by 650ms dwell to satisfy the client's internal `minMoves` and `minDwellMs` criteria.
2. **Cookie Banner Purge**: Automatically dismisses consent banners to prevent actionability timeouts.
3. **Decoy Filtering**: Eliminates hidden DOM nodes and strikethrough MRP prices before price parsing.
4. **Exponential Backoff**: Retries transient network or rendering failures up to 3 times with progressive delays (1s, 2s).
5. **Zero Data Corruption Guarantee**: Invalid prices or scraping failures preserve existing verified prices without writing corrupted records.
6. **Structure Change Flagging**: Missing DOM selectors trigger `STRUCTURE_CHANGED` status to alert maintainers.

---

## Known Limitations

- **Mock Store Only**: Built specifically for `https://demo.inelabteamdev.com/`. Does not scrape third-party stores.
- **Single Page Catalog Pagination**: The mock store catalog API currently serves 1,000 items in 17 pages. If the store expands beyond 10,000 items, background pagination streaming should be implemented.
